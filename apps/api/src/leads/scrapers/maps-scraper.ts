// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteerExtra = require('puppeteer-extra');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

import { getBrowserConfig, setupPage } from './stealth-config';
import { sleep, randInt } from './delay';
import { extractEmails, extractPhones, normalizePhone } from './email-extractor';
import { ScrapeInput, ScrapeSignal } from './google-search-scraper';
import { buildLeadFromResult } from './extractors';

export async function scrapeGoogleMaps(
  input: ScrapeInput,
  onProgress: Function,
  signal: ScrapeSignal,
  onData: Function
): Promise<any[]> {
  const query = `${input.industry || ''} ${input.area || ''} ${input.location || 'Bangladesh'}`.trim();
  if (!query) return [];

  const allLeads: any[] = [];
  let browser: any;

  try {
    browser = await puppeteerExtra.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-dev-shm-usage',
        '--disable-notifications',
        '--disable-infobars',
        '--lang=en-US,en',
      ],
      ignoreHTTPSErrors: true,
    });

    if (signal) signal.onCancel = () => browser?.close().catch(() => {});

    const page = await browser.newPage();
    await setupPage(page);

    onProgress({ step: 'google-maps', message: `[MAPS] Searching for: ${query}...`, count: allLeads.length });

    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(randInt(2000, 4000));

    // Scroll the feed to load more results
    try {
      for (let i = 0; i < 10; i++) {
        if (signal.cancelled) break;
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) feed.scrollBy(0, 1000);
        });
        await sleep(randInt(800, 1500));
      }
    } catch (_) {}

    // Extract business links
    const businesses = await page.evaluate(() => {
      const items: any[] = [];
      document.querySelectorAll('a[href*="/maps/place/"]').forEach((el: Element) => {
        const url = (el as HTMLAnchorElement).href;
        const name = el.getAttribute('aria-label') || '';
        if (url && name) items.push({ name, url });
      });
      // Deduplicate
      const seen = new Set();
      return items.filter(i => {
        if (seen.has(i.url)) return false;
        seen.add(i.url);
        return true;
      }).slice(0, 25);
    });

    onProgress({ step: 'log', message: `[MAPS] Found ${businesses.length} businesses. Extracting details...`, count: allLeads.length });

    for (const biz of businesses) {
      if (signal.cancelled) break;
      try {
        await page.goto(biz.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(randInt(1500, 3000));

        const details = await page.evaluate(() => {
          let phone = '';
          let website = '';
          document.querySelectorAll('button[data-item-id]').forEach((el) => {
            const id = el.getAttribute('data-item-id') || '';
            if (id.startsWith('phone:')) phone = id.replace('phone:', '');
            if (id.startsWith('authority:')) website = id.replace('authority:', '');
          });
          if (!website) {
            const webLink = document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement;
            if (webLink) website = webLink.href;
          }
          return { phone, website };
        });

        let email = '';
        if (details.website && details.website.startsWith('http')) {
          try {
            const webPage = await browser.newPage();
            await setupPage(webPage);
            
            const visitQueue = [details.website];
            const visited = new Set();
            let foundEmails: string[] = [];

            while (visitQueue.length > 0 && foundEmails.length === 0) {
              const urlToVisit = visitQueue.shift()!;
              if (visited.has(urlToVisit)) continue;
              visited.add(urlToVisit);
              
              try {
                await webPage.goto(urlToVisit, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await sleep(randInt(1000, 2000));
                
                const text = await webPage.evaluate(() => document.body.innerText || '');
                foundEmails = extractEmails(text);
                
                if (foundEmails.length === 0 && urlToVisit === details.website) {
                  // Fallback pages
                  const links = await webPage.evaluate(() => {
                    const l: string[] = [];
                    document.querySelectorAll('a').forEach(a => {
                      const h = a.href || '';
                      if (h.includes('contact') || h.includes('about')) l.push(h);
                    });
                    return l.slice(0, 3);
                  });
                  visitQueue.push(...links);
                }
              } catch (_) {}
            }
            if (foundEmails.length > 0) email = foundEmails[0];
            await webPage.close().catch(() => {});
          } catch (_) {}
        }

        const normPhone = normalizePhone(details.phone) || details.phone;

        if (email || normPhone) {
          const lead = buildLeadFromResult({
            title: biz.name,
            link: details.website || biz.url,
            snippet: 'Google Maps Business',
          }, { ...input, searchEngine: 'maps' }, input.designations?.[0] || 'Owner');
          
          lead.email = email || lead.email;
          lead.phone = normPhone || lead.phone;
          lead.organization = biz.name;
          lead.platform = 'maps';

          allLeads.push(lead);
          onData([lead], { platform: 'maps', engine: 'maps', page: 1 });
          onProgress({ step: 'log', message: `[MAPS] Extracted ${biz.name}`, count: allLeads.length });
        }
      } catch (_) {}
    }
  } catch (err: any) {
    onProgress({ step: 'log', message: `[MAPS] Error: ${err.message}`, count: allLeads.length });
  } finally {
    await browser?.close().catch(() => {});
    if (signal) signal.onCancel = undefined;
  }

  return allLeads;
}
