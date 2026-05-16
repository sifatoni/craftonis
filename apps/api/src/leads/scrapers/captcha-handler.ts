export async function isBlocked(page: any): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      // Only block if actual CAPTCHA elements are present — not just text
      return (
        !!document.querySelector('form[action*="sorry"]') ||
        !!document.querySelector('iframe[src*="recaptcha"]') ||
        !!document.querySelector('.g-recaptcha') ||
        !!document.querySelector('#captcha') ||
        !!document.querySelector('input[name="captcha"]')
      );
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
