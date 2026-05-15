export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export async function randomScroll(page: any, depth = 'normal'): Promise<void> {
  try {
    const steps = depth === 'light' ? 1 : randInt(2, 4);
    for (let i = 0; i < steps; i++) {
      if (Math.random() > 0.5) {
        await page.mouse.wheel({ deltaY: randInt(150, 350) });
      } else {
        const amount = randInt(180, 400);
        await page.evaluate((px: number) => window.scrollBy({ top: px, behavior: 'smooth' }), amount);
      }
      await sleep(randInt(300, 900));
    }
    if (Math.random() > 0.7) {
      await page.mouse.wheel({ deltaY: -randInt(80, 200) });
      await sleep(randInt(400, 800));
    }
  } catch (_) {}
}
export async function simulateMouseMovement(page: any): Promise<void> {
  try {
    const vp = page.viewport() || { width: 1280, height: 800 };
    for (let i = 0; i < randInt(3, 6); i++) {
      const x = randInt(100, vp.width - 100);
      const y = randInt(100, vp.height - 100);
      await page.mouse.move(x, y, { steps: randInt(10, 25) });
      await sleep(randInt(80, 250));
    }
  } catch (_) {}
}
export async function readingPause(page: any): Promise<void> {
  await sleep(randInt(800, 2000));
  if (Math.random() > 0.5) await randomScroll(page, 'light');
}
