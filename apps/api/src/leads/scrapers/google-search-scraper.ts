// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteer = require('puppeteer-extra');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

import { getBrowserConfig, setupPage, handleGoogleConsent } from './stealth-config';
import { sleep, randInt, randomScroll, simulateMouseMovement, readingPause } from './delay';
import { buildQueries, extractResultsFromPage, extractBingResultsFromPage, buildLeadFromResult } from './extractors';
import { buildLinkedInQueries } from './query-builder';
import { isBlocked, hasNoResults } from './captcha-handler';

const MAX_TOTAL_LEADS = 300;
const MAX_PAGES = 7;

const COUNTRY_CODES: Record<string, string> = {
  bangladesh: 'bd', india: 'in', pakistan: 'pk', 'sri lanka': 'lk',
  nepal: 'np', usa: 'us', uk: 'gb', australia: 'au', canada: 'ca',
};

function getCountryCode(location = '', area = ''): string {
  const text = `${location} ${area}`.toLowerCase();
  for (const [name, code] of Object.entries(COUNTRY_CODES)) {
    if (text.includes(name)) return code;
  }
  return 'bd';
}

async function humanPageDelay() {
  if (Math.random() < 0.15) await sleep(randInt(8000, 12000));
  else await sleep(randInt(3000, 6000));
}

export interface ScrapeSignal {
  cancelled: boolean;
  captchaSolved: boolean;
  onCancel?: () => void;
}

export interface ScrapeInput {
  designations: string[];
  area?: string;
  industry?: string;
  location?: string;
  organization?: string;
  startPage?: number;
  endPage?: number;
  clientId: string;
}

async function waitForCaptchaSolved(signal: ScrapeSignal, onCaptcha: (data: any) => void, engine: string): Promise<void> {
  signal.captchaSolved = false;
  onCaptcha({ engine, message: `CAPTCHA detected on ${engine}. Please solve it in your browser then click Continue.` });
  // Wait up to 5 minutes for user to solve
  for (let i = 0; i < 300; i++) {
    if (signal.cancelled || signal.captchaSolved) break;
    await sleep(1000);
  }
  signal.captchaSolved = false;
}

async function safeGoto(page: any, url: string, onProgress: Function, signal: ScrapeSignal, onCaptcha: Function, leadsCount: number, engine: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(randInt(800, 1500));
      if (await isBlocked(page)) {
        if (attempt < 2) {
          await waitForCaptchaSolved(signal, onCaptcha as any, engine);
          if (signal.cancelled) return false;
          continue;
        }
        return false;
      }
      try {
        await page.waitForFunction(() =>
          document.querySelector('#search') !== null ||
          document.querySelector('#rso') !== null ||
          document.querySelectorAll('a h3').length > 0 ||
          document.querySelectorAll('li.b_algo').length > 0,
          { timeout: 10000 }
        );
      } catch (_) {}
      await sleep(randInt(600, 1200));
      if (engine === 'google') await handleGoogleConsent(page);
      return true;
    } catch (err: any) {
      onProgress({ step: 'log', message: `[RETRY] ${err.message}`, count: leadsCount });
      await sleep(4000);
    }
  }
  return false;
}

export async function scrapeGoogleSearch(
  input: ScrapeInput,
  onProgress: (data: any) => void,
  signal: ScrapeSignal,
  onData: (leads: any[], meta: any) => void,
  onCaptcha: (data: any) => void,
): Promise<any[]> {
  const designations = input.designations?.length ? input.designations.slice(0, 3) : ['CEO'];
  const startPg = input.startPage && input.startPage >= 1 ? input.startPage : 1;
  const endPg = input.endPage && input.endPage >= startPg ? Math.min(input.endPage, startPg + 9) : Math.floor(Math.random() * 4) + 4;

  const GOOGLE_PLATFORMS = ['linkedin', 'instagram', 'facebook'];
  const BING_PLATFORMS = ['linkedin', 'instagram', 'facebook'];

  const allLeads: any[] = [];
  let browser: any;

  try {
    browser = await puppeteer.launch({
      ...getBrowserConfig({ headless: 'new' }),
    });
  } catch (err: any) {
    throw new Error(`Failed to launch browser: ${err.message}`);
  }

  signal.onCancel = () => browser?.close().catch(() => {});

  try {
    const page = await browser.newPage();
    await setupPage(page);

    // Warm up
    try {
      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await handleGoogleConsent(page);
      await simulateMouseMovement(page);
      await sleep(randInt(1000, 2000));
    } catch (_) {}

    // ── GOOGLE: LinkedIn → Instagram → Facebook ──────────────────────────
    for (const platform of GOOGLE_PLATFORMS) {
      if (signal.cancelled || allLeads.length >= MAX_TOTAL_LEADS) break;
      onProgress({ step: `google-${platform}`, message: `[GOOGLE] Starting ${platform.toUpperCase()} search...`, count: allLeads.length });

      for (const designation of designations) {
        if (signal.cancelled) break;
        const { linkedin, instagram, facebook } = buildQueries(designation, input.area || '', input.industry || '', input.location || 'Bangladesh', input.organization);
        const queries = platform === 'linkedin' ? linkedin : platform === 'instagram' ? instagram : facebook;

        for (const query of queries) {
          if (signal.cancelled || allLeads.length >= MAX_TOTAL_LEADS) break;
          for (let pageNum = startPg; pageNum <= endPg; pageNum++) {
            if (signal.cancelled) break;
            const start = (pageNum - 1) * 10;
            const glCode = getCountryCode(input.location, input.area);
            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10&hl=en&gl=${glCode}&pws=0`;
            onProgress({ step: 'log', message: `[GOOGLE/${platform.toUpperCase()}] Page ${pageNum} — searching...`, count: allLeads.length });
            const success = await safeGoto(page, url, onProgress, signal, onCaptcha, allLeads.length, 'google');
            if (!success) continue;
            if (await hasNoResults(page)) break;
            await simulateMouseMovement(page);
            await randomScroll(page, 'normal');
            await readingPause(page);
            const results = await extractResultsFromPage(page);
            const pageLeads = results.map(r => buildLeadFromResult(r, { ...input, searchEngine: 'google' }, designation)).filter(Boolean);
            if (pageLeads.length > 0) { allLeads.push(...pageLeads); onData(pageLeads, { platform, engine: 'google', page: pageNum }); }
            onProgress({ step: 'log', message: `[GOOGLE/${platform.toUpperCase()}] Page ${pageNum}: ${pageLeads.length} leads (Total: ${allLeads.length})`, count: allLeads.length });
            await humanPageDelay();
          }
          await sleep(randInt(1500, 3000));
        }
      }
    }

    // ── BING: LinkedIn → Instagram → Facebook ────────────────────────────
    try {
      await page.goto('https://www.bing.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(randInt(1000, 2000));
    } catch (_) {}

    for (const platform of BING_PLATFORMS) {
      if (signal.cancelled || allLeads.length >= MAX_TOTAL_LEADS) break;
      onProgress({ step: `bing-${platform}`, message: `[BING] Starting ${platform.toUpperCase()} search...`, count: allLeads.length });

      for (const designation of designations) {
        if (signal.cancelled) break;
        const { linkedin, instagram, facebook } = buildQueries(designation, input.area || '', input.industry || '', input.location || 'Bangladesh', input.organization);
        const queries = (platform === 'linkedin' ? linkedin : platform === 'instagram' ? instagram : facebook).slice(0, 3);

        for (const query of queries) {
          if (signal.cancelled || allLeads.length >= MAX_TOTAL_LEADS) break;
          for (let pageNum = startPg; pageNum <= Math.min(endPg, startPg + 2); pageNum++) {
            if (signal.cancelled) break;
            const first = (pageNum - 1) * 10 + 1;
            const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10&setlang=en`;
            onProgress({ step: 'log', message: `[BING/${platform.toUpperCase()}] Page ${pageNum} — searching...`, count: allLeads.length });
            const success = await safeGoto(page, url, onProgress, signal, onCaptcha, allLeads.length, 'bing');
            if (!success) continue;
            const results = await extractBingResultsFromPage(page);
            const pageLeads = results.map(r => buildLeadFromResult(r, { ...input, searchEngine: 'bing' }, designation)).filter(Boolean);
            if (pageLeads.length > 0) { allLeads.push(...pageLeads); onData(pageLeads, { platform, engine: 'bing', page: pageNum }); }
            onProgress({ step: 'log', message: `[BING/${platform.toUpperCase()}] Page ${pageNum}: ${pageLeads.length} leads`, count: allLeads.length });
            await humanPageDelay();
          }
        }
      }
    }

  } finally {
    await browser?.close().catch(() => {});
    signal.onCancel = undefined;
  }

  onProgress({ step: 'log', message: `[SCRAPER] Search engine scraping complete — ${allLeads.length} leads`, count: allLeads.length });
  return allLeads;
}
