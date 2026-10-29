import { expect, type Page, test } from '@playwright/test';
import { motionSettings } from '../src/theme/motion';

const presets = Object.keys(motionSettings);

// The test draws one element per preset, the markup <Motion> makes, since no screen uses one yet.
async function drawPresets(page: Page) {
  await page.goto('./');
  await page.evaluate((names) => {
    for (const name of names) {
      const element = document.createElement('div');
      element.dataset.motion = name;
      element.className = 'probe';
      element.style.width = '80px';
      element.style.height = '40px';
      document.body.append(element);
    }
  }, presets);
}

// Each probe's animation name and play state, and its ::before layer's.
function states(page: Page) {
  return page.$$eval('.probe', (all) =>
    all.map((el) => {
      const own = getComputedStyle(el);
      const layer = getComputedStyle(el, '::before');
      return {
        preset: el.getAttribute('data-motion'),
        name: own.animationName,
        state: own.animationPlayState,
        layer: layer.animationName,
        layerState: layer.animationPlayState,
      };
    }),
  );
}

test('SHEET-05 the presets run, and stop for the phone and for the app switch', async ({
  page,
}) => {
  await drawPresets(page);
  expect((await states(page)).map((s) => [s.preset, s.name, s.layer])).toEqual([
    ['pulse', 'motion-pulse', 'none'],
    ['float', 'motion-float', 'none'],
    ['glow', 'none', 'motion-glow'],
    ['sparkle', 'none', 'motion-sparkle'],
    ['gradient-shift', 'none', 'motion-gradient-shift'],
  ]);

  // The app switch off: every preset is a still picture; on again, they run.
  await page.evaluate(() => document.documentElement.classList.add('motion-off'));
  for (const s of await states(page))
    expect([s.name, s.layer], s.preset ?? '').toEqual(['none', 'none']);
  await page.evaluate(() => document.documentElement.classList.remove('motion-off'));
  expect((await states(page))[0]?.name).toBe('motion-pulse');

  // The phone's "reduce motion".
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const s of await states(page))
    expect([s.name, s.layer], s.preset ?? '').toEqual(['none', 'none']);
  const transition = await page.evaluate(() => {
    const probe = document.querySelector('.probe') as HTMLElement;
    probe.style.transition = 'transform 1s';
    return getComputedStyle(probe).transitionDuration;
  });
  expect(transition).toBe('0s');
});

test('SHEET-05 a preset pauses off screen and in the background', async ({ page }) => {
  await drawPresets(page);
  for (const s of await states(page))
    expect(s.state === 'running' && s.layerState === 'running').toBe(true);

  // What <Motion> sets when its element leaves the screen.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.probe')) el.setAttribute('data-motion-paused', '');
  });
  for (const s of await states(page)) expect([s.state, s.layerState]).toEqual(['paused', 'paused']);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.probe')) el.removeAttribute('data-motion-paused');
  });

  // The app goes to the background: main.tsx's watcher marks the page, and every preset pauses.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  for (const s of await states(page)) expect([s.state, s.layerState]).toEqual(['paused', 'paused']);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  for (const s of await states(page))
    expect([s.state, s.layerState]).toEqual(['running', 'running']);
});

test('SHEET-05 the five presets running add no layout (ADR 015 item 9)', async ({ page }) => {
  await drawPresets(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const read = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    const get = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
    return { layout: get('LayoutCount'), style: get('RecalcStyleCount') };
  };
  // Let the first frames settle, then count over two seconds of running presets. Nothing else
  // runs on the page, so what grows is theirs. A requestAnimationFrame counter is left out: it
  // makes a style pass of its own every frame.
  await page.waitForTimeout(500);
  const before = await read();
  await page.waitForTimeout(2000);
  const after = await read();
  const layout = after.layout - before.layout;
  const style = after.style - before.style;
  console.log(`SHEET-05 2 s of five presets: layout +${layout}, style +${style}`);
  expect(layout).toBe(0);
  // Two seconds are 120 frames at 60 a second; an animation the main thread runs takes a style
  // pass on each. The presets run on the compositor and take far fewer.
  expect(style).toBeLessThan(60);
});
