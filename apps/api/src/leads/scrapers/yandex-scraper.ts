const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

import { getBrowserConfig, setupPage } from './stealth-config';
import { sleep, randInt, randomScroll, simulateMouseMovement } from './delay';
import { buildQueries, buildLeadFromResult } from './extractors';
import { ScrapeInput, ScrapeSignal } from './google-search-scraper';

const CHROME_PROFILE_DIR = require('path').join(require('os').homedir(), '.craftonis-yandex-profile');

async function extractYandexResults(page: any): Promise<any[]> {
  return page.evaluate(() => {
    const items: any[] = [];
    const seen = new Set<string>();
    const TARGETS = ['linkedin.com/in/', 'instagram.com/', 'facebook.com/'];

    // Yandex result selectors
    document.querySelectorAll('.serp-item, .organic, [data-fast-name="organic"]').forEach((container: Element) => {
      const anchors = container.querySelectorAll('a[href]');
      anchors.forEach((a: Element) => {
        const anchor = a as HTMLAnchorElement;
        const href = (anchor.href || '').split('?')[0];
        if (!TARGETS.some(t => href.includes(t)) || seen.has(href)) return;
        seen.add(href);
        const titleEl = container.querySelector('h2, h3, .organic__title, .OrganicTitle');
        const snippetEl = container.querySelector('.organic__content-wrapper, .TextContainer, .OrganicText');
        items.push({
          title: titleEl?.textContent?.trim() || anchor.textContent?.trim() || '',
          link: href,
          snippet: snippetEl?.textContent?.trim().slice(0, 400) || ''
        });
      });
    });

    // Fallback
    if (items.length < 3) {
      document.querySelectorAll('a[href]').forEach((a: Element) => {
        const anchor = a as HTMLAnchorElement;
        const href = (anchor.href || '').split('?')[0];
        if (!TARGETS.some(t => href.includes(t)) || seen.has(href)) return;
        seen.add(href);
        items.push({ title: anchor.textContent?.trim() || '', link: href, snippet: '' });
      });
    }

    return items;
  });
}

export async function scrapeYandex(
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
    throw new Error(`Yandex browser launch failed: ${err.message}`);
  }

  signal.onCancel = () => browser?.close().catch(() => {});

  try {
    const page = await browser.newPage();
    await setupPage(page);

    for (const platform of PLATFORMS) {
      if (signal.cancelled) break;
      onProgress({ step: `yandex-${platform}`, message: `[YANDEX] Starting ${platform.toUpperCase()} search...`, count: allLeads.length });

      for (const designation of designations) {
        if (signal.cancelled) break;
        const queries = buildQueries(designation, input.area || '', input.industry || '', input.location || 'Bangladesh', input.organization);
        const platformQueries = platform === 'linkedin' ? queries.linkedin : platform === 'instagram' ? queries.instagram : queries.facebook;

        for (const query of platformQueries.slice(0, 3)) {
          if (signal.cancelled) break;
          const startPage = input.startPage || 1;
          const endPage = Math.min(input.endPage || 3, startPage + 2);

          for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
            if (signal.cancelled) break;
            try {
              const p = (pageNum - 1) * 10;
              const url = `https://yandex.com/search/?text=${encodeURIComponent(query)}&p=${pageNum - 1}&lr=10393&lang=en`;
              onProgress({ step: 'log', message: `[YANDEX/${platform.toUpperCase()}] Page ${pageNum}...`, count: allLeads.length });

              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
              await sleep(randInt(2000, 4000));
              await simulateMouseMovement(page);
              await randomScroll(page, 'normal');

              // Check for Yandex SmartCaptcha
              const blocked = await page.evaluate(() => {
                return !!document.querySelector('.CheckboxCaptcha') ||
                  !!document.querySelector('.AdvancedCaptcha') ||
                  !!document.querySelector('[class*="captcha"]');
              });
              if (blocked) {
                onProgress({ step: 'log', message: '[YANDEX] Captcha detected — skipping', count: allLeads.length });
                break;
              }

              const results = await extractYandexResults(page);
              const pageLeads = results.map(r => buildLeadFromResult(r, { ...input, searchEngine: 'yandex' }, designation));
              if (pageLeads.length > 0) {
                allLeads.push(...pageLeads);
                onData(pageLeads, { platform, engine: 'yandex' });
              }
              onProgress({ step: 'log', message: `[YANDEX/${platform.toUpperCase()}] Page ${pageNum}: ${pageLeads.length} leads`, count: allLeads.length });
              await sleep(randInt(3000, 6000));
            } catch (err: any) {
              onProgress({ step: 'log', message: `[YANDEX] Error: ${err.message}`, count: allLeads.length });
            }
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
