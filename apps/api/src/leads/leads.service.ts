import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LeadsGateway } from './leads.gateway';
import { ScrapeInput } from './scrapers/google-search-scraper';
import { scrapeDuckDuckGo } from './scrapers/duckduckgo-scraper';
import { scrapeYandex } from './scrapers/yandex-scraper';
import { scrapeGoogleMaps } from './scrapers/maps-scraper';
import { scrapeYellowPages } from './scrapers/yellow-pages-scraper';
import { mergeLeads } from './scrapers/lead-merger';
import { scoreAndClean } from './scrapers/scoring-engine';
import { v4 as uuidv4 } from 'uuid';
import * as xlsx from 'xlsx';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsGateway: LeadsGateway,
  ) {}

  async startScrape(tenantId: string, input: any) {
    const jobId = uuidv4();
    const signal = { cancelled: false, captchaSolved: false, onCancel: undefined };
    LeadsGateway.cancelSignals.set(jobId, signal);

    setImmediate(async () => {
      try {
        let allLeads: any[] = [];
        const onProgress = (data: any) => this.leadsGateway.emitProgress(input.clientId, data);
        const onCaptcha = (data: any) => this.leadsGateway.emitCaptcha(input.clientId, { ...data, jobId });
        
        const onData = async (leads: any[], meta: any) => {
          const validLeads = leads.filter(l => l.email || l.phone);
          if (validLeads.length === 0) return;
          const blurred = validLeads.map(l => this.blurLead(l)).filter(Boolean);
          this.leadsGateway.emitLeads(input.clientId, blurred);
          await this.saveLeads(tenantId, validLeads);
        };

        // Step 1: DuckDuckGo
        onProgress({ step: 'ddg-start', message: '[DDG] Starting DuckDuckGo search...', count: 0 });
        const ddgLeads = await scrapeDuckDuckGo(
          input,
          onProgress,
          signal,
          async (pageLeads, meta) => {
            const scored = scoreAndClean(pageLeads, input.designations);
            const validLeads = scored.filter(l => l.email || l.phone);
            if (validLeads.length === 0) return;
            await this.saveLeads(tenantId, validLeads);
            this.leadsGateway.emitLeads(input.clientId, validLeads.map(l => this.blurLead(l)).filter(Boolean));
          }
        );
        allLeads = mergeLeads(allLeads, ddgLeads);

        // Step 3: Yandex
        if (!signal.cancelled) {
          onProgress({ step: 'yandex-start', message: '[YANDEX] Starting Yandex search...', count: allLeads.length });
          const yandexLeads = await scrapeYandex(
            input,
            onProgress,
            signal,
            async (pageLeads, meta) => {
              const scored = scoreAndClean(pageLeads, input.designations);
              const validLeads = scored.filter(l => l.email || l.phone);
              if (validLeads.length === 0) return;
              await this.saveLeads(tenantId, validLeads);
              this.leadsGateway.emitLeads(input.clientId, validLeads.map(l => this.blurLead(l)).filter(Boolean));
            }
          );
          allLeads = mergeLeads(allLeads, yandexLeads);
        }

        if (!signal.cancelled) {
          const mapLeads = await scrapeGoogleMaps(input, onProgress, signal, onData);
          allLeads = mergeLeads(allLeads, mapLeads);
        }

        if (!signal.cancelled) {
          const ypLeads = await scrapeYellowPages(input, onProgress, signal, onData);
          allLeads = mergeLeads(allLeads, ypLeads);
        }

        const finalLeads = scoreAndClean(allLeads, input.designations);
        await this.saveLeads(tenantId, finalLeads);

        this.leadsGateway.emitComplete(input.clientId, { total: finalLeads.length });
      } catch (err: any) {
        this.leadsGateway.emitError(input.clientId, err.message);
      } finally {
        LeadsGateway.cancelSignals.delete(jobId);
      }
    });

    return { jobId };
  }

  async cancelScrape(jobId: string) {
    const signal = LeadsGateway.cancelSignals.get(jobId);
    if (signal) {
      signal.cancelled = true;
      if (signal.onCancel) signal.onCancel();
    }
  }

  async getLeads(tenantId: string, filters: any = {}) {
    const where: any = { 
      tenantId,
      OR: [
        { email: { not: null, not: '' } },
        { phone: { not: null, not: '' } }
      ]
    };
    if (filters.valueBand) where.valueBand = filters.valueBand;
    if (filters.platform) where.platform = filters.platform;
    if (filters.crmStage) where.crmStage = filters.crmStage;
    if (filters.revealed !== undefined) where.revealed = filters.revealed === 'true';

    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { contactScore: 'desc' },
      take: 500,
    });

    return leads.map(l => l.revealed ? l : this.blurLead(l));
  }

  async revealLead(tenantId: string, leadId: string) {
    const wallet = await this.prisma.tokenWallet.upsert({
      where: { tenantId },
      create: { tenantId, balance: 0 },
      update: {},
    });

    if (wallet.balance < 1) {
      throw new BadRequestException('Insufficient tokens');
    }

    return await this.prisma.$transaction(async (tx: any) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId, tenantId } });
      if (!lead) throw new BadRequestException('Lead not found');
      if (lead.revealed) return lead;

      await tx.tokenWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: 1 } },
      });

      await tx.tokenLedger.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT',
          amount: 1,
          description: `Revealed lead ${leadId}`,
          leadId,
        },
      });

      return await tx.lead.update({
        where: { id: leadId },
        data: { revealed: true },
      });
    });
  }

  async bulkReveal(tenantId: string, leadIds: string[]) {
    const wallet = await this.prisma.tokenWallet.upsert({
      where: { tenantId },
      create: { tenantId, balance: 0 },
      update: {},
    });

    if (wallet.balance < leadIds.length) {
      throw new BadRequestException('Insufficient tokens');
    }

    let revealedCount = 0;
    for (const leadId of leadIds) {
      try {
        const lead = await this.prisma.lead.findUnique({ where: { id: leadId, tenantId } });
        if (lead && !lead.revealed) {
          await this.revealLead(tenantId, leadId);
          revealedCount++;
        }
      } catch (err) {}
    }
    return revealedCount;
  }

  async getTokenBalance(tenantId: string) {
    const wallet = await this.prisma.tokenWallet.upsert({
      where: { tenantId },
      create: { tenantId, balance: 0 },
      update: {},
    });
    return wallet.balance;
  }

  async addTokens(tenantId: string, amount: number) {
    const wallet = await this.prisma.tokenWallet.upsert({
      where: { tenantId },
      create: { tenantId, balance: 0 },
      update: {},
    });

    await this.prisma.tokenWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    await this.prisma.tokenLedger.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,
        description: 'Admin granted tokens',
      },
    });

    return wallet.balance + amount;
  }

  async updateCrmStage(tenantId: string, leadId: string, stage: string) {
    return this.prisma.lead.update({
      where: { id: leadId, tenantId },
      data: { crmStage: stage },
    });
  }

  async exportLeads(tenantId: string, format: 'csv' | 'excel', filters: any) {
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, revealed: true, ...filters },
      orderBy: { contactScore: 'desc' },
    });

    const data = leads.map(l => ({
      Name: l.name,
      Designation: l.designation,
      Organization: l.organization,
      Email: l.email,
      Phone: l.phone,
      LinkedIn: l.linkedinUrl,
      Location: l.location,
      Score: l.contactScore,
      Band: l.valueBand,
    }));

    if (format === 'csv') {
      const header = Object.keys(data[0] || {}).join(',');
      const rows = data.map(d => Object.values(d).map(v => `"${v || ''}"`).join(','));
      return Buffer.from([header, ...rows].join('\n'));
    } else {
      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Leads');
      return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
  }

  private blurLead(lead: any) {
    if (!lead.email && !lead.phone) return null;
    return {
      ...lead,
      email: lead.email ? lead.email.replace(/(?<=.{2}).(?=.*@)/g, '*') : null,
      phone: lead.phone ? lead.phone.replace(/\d(?=\d{4})/g, '*') : null,
      revealed: false,
    };
  }

  async saveLeads(tenantId: string, leads: any[]) {
    for (const lead of leads) {
      if (!lead.email && !lead.phone) continue;
      try {
        await this.prisma.lead.upsert({
          where: {
            id: lead.id || 'new-lead-id', // Assuming UUID or finding by unique constraint
          },
          create: {
            tenantId,
            name: lead.name,
            designation: lead.designation,
            organization: lead.organization,
            email: lead.email,
            emailType: lead.emailType,
            phone: lead.phone,
            linkedinUrl: lead.linkedinUrl,
            instagramUrl: lead.instagramUrl,
            facebookUrl: lead.facebookUrl,
            profileUrl: lead.profileUrl,
            location: lead.location,
            area: lead.area,
            industry: lead.industry,
            snippet: lead.snippet,
            platform: lead.platform,
            source: lead.source,
            contactScore: lead.contactScore,
            valueBand: lead.valueBand,
            revealed: false,
          },
          update: {
            contactScore: lead.contactScore,
            valueBand: lead.valueBand,
          },
        });
      } catch (err: any) {
        // Fallback check if unique constraint failed because we don't have a unique ID yet
        try {
          // If no ID provided, we just create it since the schema doesn't have a unique constraint on email/phone yet
          await this.prisma.lead.create({
            data: {
              tenantId,
              name: lead.name,
              designation: lead.designation,
              organization: lead.organization,
              email: lead.email,
              emailType: lead.emailType,
              phone: lead.phone,
              linkedinUrl: lead.linkedinUrl,
              instagramUrl: lead.instagramUrl,
              facebookUrl: lead.facebookUrl,
              profileUrl: lead.profileUrl,
              location: lead.location,
              area: lead.area,
              industry: lead.industry,
              snippet: lead.snippet,
              platform: lead.platform,
              source: lead.source,
              contactScore: lead.contactScore,
              valueBand: lead.valueBand,
              revealed: false,
            }
          });
        } catch (_) {}
      }
    }
  }
}
