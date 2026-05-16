const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

import { getBrowserConfig, setupPage } from './stealth-config';
import { sleep, randInt, randomScroll, simulateMouseMovement } from './delay';
import { buildQueries } from './extractors';
import { buildLeadFromResult } from './extractors';
import { ScrapeInput, ScrapeSignal } from './google-search-scraper';
import { extractEmails, extractPhones } from './email-extractor';

const CHROME_PROFILE_DIR = require('path').join(require('os').homedir(), '.craftonis-ddg-profile');

async function extractDDGResults(page: any): Promise<any[]> {
  return page.evaluate(() => {
    const items: any[] = [];
    const seen = new Set<string>();
    const TARGETS = ['linkedin.com/in/', 'instagram.com/', 'facebook.com/'];
    
    // DuckDuckGo result selectors
    document.querySelectorAll('[data-testid="result"], .result, article').forEach((container: Element) => {
      const anchor = container.querySelector('a[href*="http"]') as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;
      const href = anchor.href.split('?')[0];
      if (!TARGETS.some(t => href.includes(t)) || seen.has(href)) return;
      seen.add(href);
      const titleEl = container.querySelector('h2, h3, [data-testid="result-title-a"]');
      const snippetEl = container.querySelector('[data-result="snippet"], .result__snippet, span');
      items.push({
        title: titleEl?.textContent?.trim() || anchor.textContent?.trim() || '',
        link: href,
        snippet: snippetEl?.textContent?.trim().slice(0, 400) || ''
      });
    });
    
    // Fallback: scan all links
    if (items.length < 3) {
      document.querySelectorAll('a[href]').forEach((a: Element) => {
        const anchor = a as HTMLAnchorElement;
        const href = anchor.href.split('?')[0];
        if (!TARGETS.some(t => href.includes(t)) || seen.has(href)) return;
        seen.add(href);
        items.push({ title: anchor.textContent?.trim() || '', link: href, snippet: '' });
      });
    }
    
    return items;
  });
}

async function clickMoreResults(page: any): Promise<boolean> {
  try {
    const btn = await page.$('button#more-results, [data-testid="more-results"], button.btn--more');
    if (btn) { await btn.click(); await sleep(2000); return true; }
    return false;
  } catch (_) { return false; }
}

export async function scrapeDuckDuckGo(
  input: ScrapeInput,
  onProgress: (data: any) => void,
  signal: ScrapeSignal,
  onData: (leads: any[], meta: any) => void,
): Promise<any[]> {
  const designations = input.designations?.length ? input.designations.slice(0, 3) : ['CEO'];
  const PLATFORMS = ['linkedin', 'instagram', 'facebook'];
  const allLeads: any[] = [];
  let browser: any;

  try {
    browser = await puppeteerExtra.launch({
      headless: 'new',
      userDataDir: CHROME_PROFILE_DIR,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--lang=en-US,en'],
      ignoreHTTPSErrors: true,
    });
  } catch (err: any) {
    throw new Error(`DDG browser launch failed: ${err.message}`);
  }

  signal.onCancel = () => browser?.close().catch(() => {});

  try {
    const page = await browser.newPage();
    await setupPage(page);

    for (const platform of PLATFORMS) {
      if (signal.cancelled) break;
      onProgress({ step: `ddg-${platform}`, message: `[DDG] Starting ${platform.toUpperCase()} search...`, count: allLeads.length });

      for (const designation of designations) {
        if (signal.cancelled) break;
        const queries = buildQueries(designation, input.area || '', input.industry || '', input.location || 'Bangladesh', input.organization);
        const platformQueries = platform === 'linkedin' ? queries.linkedin : platform === 'instagram' ? queries.instagram : queries.facebook;

        for (const query of platformQueries.slice(0, 3)) {
          if (signal.cancelled) break;
          try {
            const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web`;
            onProgress({ step: 'log', message: `[DDG/${platform.toUpperCase()}] Searching...`, count: allLeads.length });
            
            try {
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            } catch (err: any) {
              // Try again with networkidle2
              try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
              } catch (_) {
                onProgress({ step: 'log', message: `[DDG] Skipping slow page`, count: allLeads.length });
                continue;
              }
            }
            await sleep(randInt(2000, 4000));
            await simulateMouseMovement(page);
            await randomScroll(page, 'normal');
            
            // Load more results based on page range
            const maxScrolls = (input.endPage || 3) - (input.startPage || 1) + 1;
            for (let s = 0; s < maxScrolls; s++) {
              await clickMoreResults(page);
              await randomScroll(page, 'light');
            }
            
            const results = await extractDDGResults(page);
            const pageLeads = results.map(r => buildLeadFromResult(r, { ...input, searchEngine: 'duckduckgo' }, designation));
            if (pageLeads.length > 0) {
              allLeads.push(...pageLeads);
              onData(pageLeads, { platform, engine: 'duckduckgo' });
            }
            onProgress({ step: 'log', message: `[DDG/${platform.toUpperCase()}] ${pageLeads.length} leads found`, count: allLeads.length });
            await sleep(randInt(2000, 4000));
          } catch (err: any) {
            onProgress({ step: 'log', message: `[DDG] Error: ${err.message}`, count: allLeads.length });
          }
        }
      }
    }
  } finally {
    await browser?.close().catch(() => {});
    signal.onCancel = undefined;
  }

  return allLeads;
}
