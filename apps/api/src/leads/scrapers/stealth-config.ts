const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];
const VIEWPORTS = [
  { width: 1366, height: 768 }, { width: 1920, height: 1080 },
  { width: 1440, height: 900 }, { width: 1280, height: 800 },
];
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
export function getRandomUA(): string { return pick(USER_AGENTS); }
export function getRandomViewport() { return pick(VIEWPORTS); }
export function getBrowserConfig(opts: { headless?: any; proxy?: string } = {}) {
  const vp = getRandomViewport();
  const args = [
    '--no-sandbox', '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-web-security', '--disable-dev-shm-usage',
    '--disable-notifications', '--disable-infobars',
    `--window-size=${vp.width},${vp.height}`, '--lang=en-US,en',
  ];
  if (opts.proxy) args.push(`--proxy-server=${opts.proxy}`);
  return { headless: opts.headless !== undefined ? opts.headless : 'new', args, defaultViewport: vp, ignoreHTTPSErrors: true };
}
export async function setupPage(page: any, userAgent?: string): Promise<void> {
  const ua = userAgent || getRandomUA();
  const vp = getRandomViewport();
  await page.setViewport(vp);
  await page.setUserAgent(ua);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    if (!(window as any).chrome) {
      (window as any).chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}), app: {} };
    }
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
    const getParam = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param: number) {
      if (param === 37445) return 'Intel Inc.';
      if (param === 37446) return 'Intel Iris OpenGL Engine';
      return getParam.call(this, param);
    };
  });
}
export async function handleGoogleConsent(page: any): Promise<boolean> {
  const candidates = ['#L2AGLb','button[aria-label*="Accept all"]','button[aria-label*="Accept"]','#acceptButton','form[action*="consent"] button','.QS5gu.sy4vM'];
  for (const sel of candidates) {
    try {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 1200)); return true; }
    } catch (_) {}
  }
  return false;
}
