export async function isBlocked(page: any): Promise<boolean> {
  try {
    const title = await page.title();
    if (title.includes('Sorry') || title.includes('unusual traffic')) return true;
    return await page.evaluate(() => {
      const text = (document.body?.innerText || '').toLowerCase();
      return text.includes('unusual traffic') || text.includes('captcha') ||
        text.includes('verify you are human') || text.includes("i'm not a robot") ||
        !!document.querySelector('#captcha') ||
        !!document.querySelector('form[action*="sorry"]') ||
        !!document.querySelector('iframe[src*="recaptcha"]') ||
        !!document.querySelector('.g-recaptcha');
    });
  } catch (_) { return false; }
}

export async function hasNoResults(page: any): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return /did not match any documents|no results found/i.test(text) ||
        (!!document.querySelector('#topstuff:not(:empty)') && !document.querySelector('div.g, .tF2Cxc'));
    });
  } catch (_) { return false; }
}
