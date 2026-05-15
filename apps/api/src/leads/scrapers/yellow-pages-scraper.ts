// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteer = require('puppeteer-extra');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

import { getBrowserConfig, setupPage, handleGoogleConsent } from './stealth-config';
import { sleep, randInt } from './delay';
import { extractEmails, extractPhones } from './email-extractor';
import { ScrapeInput, ScrapeSignal } from './google-search-scraper';
import { buildLeadFromResult, extractResultsFromPage } from './extractors';
import { hasNoResults } from './captcha-handler';

export async function scrapeYellowPages(
  input: ScrapeInput,
  onProgress: Function,
  signal: ScrapeSignal,
  onData: Function
): Promise<any[]> {
  const allLeads: any[] = [];
  let browser: any;

  try {
    browser = await puppeteer.launch({
      ...getBrowserConfig({ headless: 'new' }),
    });

    if (signal) signal.onCancel = () => browser?.close().catch(() => {});

    const page = await browser.newPage();
    await setupPage(page);

    onProgress({ step: 'yellow-pages', message: `[YELLOW PAGES] Starting...`, count: allLeads.length });

    const queries = [
      `site:yellowpages.com.bd "${input.industry || ''}" "${input.area || ''}" "@gmail.com" OR "@yahoo.com"`,
      `site:bdjobs.com "${input.designations?.[0] || 'Manager'}" "${input.area || ''}"`
    ];

    for (const query of queries) {
      if (signal.cancelled) break;
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`;
      
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await handleGoogleConsent(page);
        await sleep(randInt(1500, 3000));

        if (await hasNoResults(page)) continue;

        const results = await extractResultsFromPage(page);
        onProgress({ step: 'log', message: `[YELLOW PAGES] Found ${results.length} links to visit...`, count: allLeads.length });

        for (const res of results.slice(0, 15)) {
          if (signal.cancelled) break;
          
          try {
            const detailPage = await browser.newPage();
            await setupPage(detailPage);
            await detailPage.goto(res.link, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await sleep(randInt(1000, 2000));

            const text = await detailPage.evaluate(() => document.body.innerText || '');
            const emails = extractEmails(text);
            const phones = extractPhones(text);

            await detailPage.close().catch(() => {});

            if (emails.length > 0 || phones.length > 0) {
              const lead = buildLeadFromResult(res, { ...input, searchEngine: 'yellowpages' }, input.designations?.[0] || 'Unknown');
              if (emails[0]) lead.email = emails[0];
              if (phones[0]) lead.phone = phones[0];
              lead.platform = 'yellowpages';

              allLeads.push(lead);
              onData([lead], { platform: 'yellowpages', engine: 'google', page: 1 });
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
  } catch (err: any) {
    onProgress({ step: 'log', message: `[YELLOW PAGES] Error: ${err.message}`, count: allLeads.length });
  } finally {
    await browser?.close().catch(() => {});
    if (signal) signal.onCancel = undefined;
  }

  return allLeads;
}
