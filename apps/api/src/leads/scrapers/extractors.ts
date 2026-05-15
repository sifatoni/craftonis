import { extractEmails, extractPhones } from './email-extractor';
import { buildLinkedInQueries, buildPlatformQueries } from './query-builder';

export const QUERY_MODE = { SAFE: 'safe', AGGRESSIVE: 'aggressive' };

const PLATFORM_FILTERS: Record<string, string> = {
  linkedin: 'linkedin.com/in',
  instagram: 'instagram.com',
  facebook: 'facebook.com',
};

const DESIGNATION_SYNONYMS: Record<string, string[]> = {
  'ceo': ['CEO','Chief Executive Officer','Managing Director'],
  'cto': ['CTO','Chief Technology Officer','VP Engineering'],
  'cfo': ['CFO','Chief Financial Officer','Finance Director'],
  'cmo': ['CMO','Chief Marketing Officer','Marketing Director'],
  'director': ['Director','Head','VP'],
  'manager': ['Manager','Lead','Senior Manager'],
  'founder': ['Founder','Co-Founder','Owner'],
  'marketing head': ['Marketing Head','Head of Marketing','Marketing Director'],
};

export function getDesignationVariants(designation: string): string[] {
  if (!designation) return [];
  return DESIGNATION_SYNONYMS[designation.toLowerCase().trim()] || [designation];
}

export function buildQueries(designation: string, area: string, industry: string, country: string, organization?: string) {
  return {
    linkedin: buildLinkedInQueries(designation, area, industry, country, organization),
    instagram: buildPlatformQueries('instagram.com', designation, area, industry, country, organization),
    facebook: buildPlatformQueries('facebook.com', designation, area, industry, country, organization),
  };
}

export async function extractResultsFromPage(page: any): Promise<any[]> {
  const { items, debug } = await page.evaluate(() => {
    const items: any[] = [];
    const seen = new Set<string>();
    const htmlLength = document.documentElement.innerHTML.length;
    const linksFound = document.querySelectorAll('a[href]').length;

    function getSnippet(el: Element | null): string {
      if (!el) return '';
      const SNIPPET_SELS = ['.VwiC3b','.lEBKkf','.IsZvec','.yXK7lf','.s3v9rd','[data-sncf]','.r025kc','.hgKElc','.MU70pf','.Uo8X3b','.ITZIwc','.x54gtf','.st'];
      for (const s of SNIPPET_SELS) {
        const node = el.querySelector(s);
        if (node && node.textContent && node.textContent.trim().length > 20) return node.textContent.trim();
      }
      const candidates = Array.from(el.querySelectorAll('div, span'))
        .filter((n: any) => n.children.length < 4 && n.textContent && n.textContent.trim().length > 40)
        .sort((a: any, b: any) => b.textContent.length - a.textContent.length);
      return candidates[0] ? (candidates[0] as any).textContent.trim().slice(0, 400) : (el.textContent || '').slice(0, 300).trim();
    }

    function addItem(rawHref: string, titleText: string, container: Element | null) {
      const href = (rawHref || '').split('?')[0].split('#')[0];
      if (!href.startsWith('http') || seen.has(href)) return;
      if (href.includes('google.com/search') || href.includes('accounts.google.com') || href.includes('google.com/intl')) return;
      seen.add(href);
      items.push({ title: (titleText || '').trim(), link: href, snippet: getSnippet(container) });
    }

    // Strategy 1: h3 inside anchor
    document.querySelectorAll('h3').forEach((h3: Element) => {
      const anchor = h3.closest('a') as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;
      const container = h3.closest('div.g, .tF2Cxc, .MjjYGa, [data-sokoban-container], [jscontroller]') ||
        anchor.closest('div.g, [jscontroller]') || anchor.parentElement?.parentElement?.parentElement || null;
      addItem(anchor.href, h3.textContent || '', container);
    });

    // Strategy 2: classic containers
    document.querySelectorAll('div.g, .tF2Cxc, .MjjYGa').forEach((container: Element) => {
      const anchor = container.querySelector('a[href^="http"]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const h3 = container.querySelector('h3');
      if (!h3) return;
      addItem(anchor.href, h3.textContent || '', container);
    });

    // Strategy 3: platform URL fallback
    if (items.length < 3) {
      const TARGETS = ['linkedin.com/in/','instagram.com/','facebook.com/'];
      document.querySelectorAll('a[href]').forEach((anchor: Element) => {
        const a = anchor as HTMLAnchorElement;
        const href = a.href || '';
        if (!TARGETS.some(t => href.includes(t))) return;
        const h3 = a.querySelector('h3') || a.closest('[jscontroller]')?.querySelector('h3') || a.parentElement?.querySelector('h3');
        const title = h3?.textContent || a.textContent || href;
        const container = a.closest('div.g, [jscontroller]') || a.parentElement?.parentElement || null;
        addItem(href, title || '', container);
      });
    }

    return { items, debug: { htmlLength, linksFound, resultsParsed: items.length } };
  });
  console.log(`[EXTRACT] HTML:${debug.htmlLength} Links:${debug.linksFound} Results:${debug.resultsParsed}`);
  return items;
}

export async function extractBingResultsFromPage(page: any): Promise<any[]> {
  return page.evaluate(() => {
    const items: any[] = [];
    const seen = new Set<string>();
    const TARGETS = ['linkedin.com/in/','instagram.com/','facebook.com/'];
    document.querySelectorAll('li.b_algo').forEach((li: Element) => {
      const anchor = li.querySelector('h2 a') as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;
      const href = anchor.href.split('?')[0];
      if (!TARGETS.some(t => href.includes(t)) || seen.has(href)) return;
      seen.add(href);
      const snippet = li.querySelector('.b_caption p')?.textContent || li.textContent || '';
      items.push({ title: anchor.textContent || '', link: href, snippet: snippet.trim().slice(0, 400) });
    });
    return items;
  });
}

function parseLinkedInTitle(title: string): { name: string; designation: string; organization: string } | null {
  const clean = String(title || '').replace(/\s+/g, ' ').trim();
  const mA = clean.match(/^([A-Z][a-z'.‑\-]+(?:\s+[A-Z][a-z'.‑\-]+){1,3})\s*[-–|]\s*([^|<>@\n\r]{2,60}?)\s*[-–|]\s*([^|<>@\n\r]{2,60}?)\s*\|?\s*LinkedIn/i);
  if (mA) return { name: mA[1].trim(), designation: mA[2].trim(), organization: mA[3].trim() };
  const mB = clean.match(/^([A-Z][a-z'.‑\-]+(?:\s+[A-Z][a-z'.‑\-]+){1,3})\s*[-–|]\s*([^|<>@\n\r]{2,60}?)\s*\|?\s*LinkedIn/i);
  if (mB) return { name: mB[1].trim(), designation: mB[2].trim(), organization: '' };
  const mC = clean.match(/^([A-Z][a-z'.‑\-]+(?:\s+[A-Z][a-z'.‑\-]+){1,3})\s*[-–|]\s*(.+?)\s+at\s+(.+?)(?:\s*[-–|]\s*LinkedIn)?$/i);
  if (mC) return { name: mC[1].trim(), designation: mC[2].trim(), organization: mC[3].trim() };
  const mD = clean.match(/^([A-Z][a-z'.‑\-]+(?:\s+[A-Z][a-z'.‑\-]+){1,3})\s*[-–]/i);
  if (mD) return { name: mD[1].trim(), designation: '', organization: '' };
  return null;
}

function parseGenericTitle(title: string): { name: string; designation: string; organization: string } {
  const clean = String(title || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { name: 'Unknown', designation: '', organization: '' };
  const mName = clean.match(/^([A-Z][a-z'.‑\-]+(?:\s+[A-Z][a-z'.‑\-]+){1,3})/);
  if (mName) {
    const rest = clean.slice(mName[1].length).replace(/^[\s\-–|]+/, '');
    const parts = rest.split(/[-–|]/);
    return { name: mName[1].trim(), designation: (parts[0]||'').trim(), organization: (parts[1]||'').trim() };
  }
  const parts = clean.split(/[-–|]/);
  return { name: (parts[0]||clean).slice(0,60).trim()||'Unknown', designation: (parts[1]||'').trim(), organization: (parts[2]||'').trim() };
}

function detectPlatform(url: string): string {
  if (!url) return 'web';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('bing.com')) return 'bing';
  if (url.includes('maps.google')) return 'maps';
  if (url.includes('yellowpages')) return 'yellowpages';
  return 'web';
}

export function buildLeadFromResult(result: any, input: any, fallbackDesignation: string): any {
  const url = result.link || result.url || '';
  const platform = detectPlatform(url);
  let parsed = platform === 'linkedin'
    ? (parseLinkedInTitle(result.title) || parseGenericTitle(result.title))
    : parseGenericTitle(result.title);
  const text = `${result.snippet || ''} ${result.title || ''}`;
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  return {
    name: parsed.name || 'Unknown',
    designation: parsed.designation || fallbackDesignation || '',
    organization: parsed.organization || input.organization || '',
    industry: input.industry || '',
    location: input.location || '',
    area: input.area || '',
    email: emails[0] || '',
    phone: phones[0] || '',
    profileUrl: url,
    linkedinUrl: platform === 'linkedin' ? url : '',
    instagramUrl: platform === 'instagram' ? url : '',
    facebookUrl: platform === 'facebook' ? url : '',
    snippet: (result.snippet || '').slice(0, 500),
    platform,
    source: input.searchEngine || 'google',
  };
}
