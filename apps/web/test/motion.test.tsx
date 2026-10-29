import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Motion } from '../src/theme/Motion';
import {
  type MotionName,
  motionIsStill,
  motionPresets,
  motionStyle,
  setMotionStill,
  watchOnScreen,
} from '../src/theme/motions';
import { baseTheme, mergeParts, themeCss } from '../src/theme/theme';

const board = (name: string) =>
  readFileSync(new URL(`../../../docs/design/mockups/V3-${name}.dc.html`, import.meta.url), 'utf8');
const motionCss = readFileSync(new URL('../src/theme/motion.css', import.meta.url), 'utf8');

const names = Object.keys(motionPresets) as MotionName[];
const loops = names.filter((name) => motionPresets[name].kind === 'loop');

// A key's value with each `var(--theme-…)` replaced by the base theme's value.
function resolve(value: string): string {
  return value.replace(/var\(--theme-([a-z0-9-]+)\)/g, (_, key: string) =>
    resolve(baseTheme.shared[key] ?? `missing ${key}`),
  );
}

// A document and an element just big enough for the motion switch and watchOnScreen.
function fakeDocument() {
  const events = new EventTarget();
  return Object.assign(events, {
    visibilityState: 'visible' as DocumentVisibilityState,
    documentElement: { dataset: {} as Record<string, string> },
  });
}
function fakeElement(doc: ReturnType<typeof fakeDocument>) {
  const attributes = new Set<string>();
  return {
    ownerDocument: doc,
    attributes,
    toggleAttribute(name: string, on: boolean) {
      if (on) attributes.add(name);
      else attributes.delete(name);
      return on;
    },
  };
}
function fakeObserver() {
  const seen: { report?: (entries: { isIntersecting: boolean }[]) => void; off: boolean } = {
    off: false,
  };
  class Observer {
    constructor(report: (entries: { isIntersecting: boolean }[]) => void) {
      seen.report = report;
    }
    observe() {}
    disconnect() {
      seen.off = true;
    }
  }
  return { seen, Observer };
}

describe('SHEET-05 motion presets that stop for reduced motion', () => {
  it('names the two transitions and three loops a skin can pick', () => {
    // `slide` is SHEET-25's: a swiped card on My characters.
    expect(names).toEqual(['turn', 'slide', 'pulse', 'float', 'spin']);
    expect(loops).toEqual(['pulse', 'float', 'spin']);
  });

  it('gives the turn the boards’ chevron motion', () => {
    for (const name of ['Create', 'Conflict']) {
      const drawn = [...board(name).matchAll(/transition: ([a-z]+) ([\d.]+)s ([a-z-]+)/g)];
      expect(drawn.length, name).toBeGreaterThan(0);
      for (const [, property, seconds, easing] of drawn) {
        expect(resolve(baseTheme.shared['motion-turn'] ?? '')).toBe(
          `${property} ${Number(seconds) * 1000}ms ${easing}`,
        );
      }
    }
  });

  it('fills each preset’s speed, a loop’s size, its value, and no other motion key', () => {
    const expected = names.flatMap((name) => [
      `motion-${name}-duration`,
      ...('size' in motionPresets[name] ? [`motion-${name}-size`] : []),
      `motion-${name}`,
    ]);
    const filled = Object.keys(baseTheme.shared).filter((key) => key.startsWith('motion-'));
    expect(filled.sort()).toEqual(expected.sort());
    expect(Object.keys(baseTheme.light).some((key) => key.startsWith('motion-'))).toBe(false);
    expect(resolve(baseTheme.shared['motion-pulse'] ?? '')).toBe(
      'motion-pulse 2s ease-in-out infinite alternate',
    );
    expect(resolve(baseTheme.shared['motion-spin'] ?? '')).toBe(
      'motion-spin 8s linear infinite normal',
    );
  });

  it('moves only what a phone draws cheaply: position, size, opacity', () => {
    for (const name of names) {
      const preset = motionPresets[name];
      if (preset.kind === 'transition') expect(['transform', 'opacity']).toContain(preset.property);
    }
    const frames = [...motionCss.matchAll(/@keyframes ([a-z-]+) \{([^@]*?)\n\}/g)];
    expect(frames.map((frame) => frame[1])).toEqual(loops.map((name) => `motion-${name}`));
    for (const [, name, body] of frames) {
      const properties = [...(body ?? '').matchAll(/^\s+([a-z-]+):/gm)].map((match) => match[1]);
      expect(properties.length, name).toBeGreaterThan(0);
      for (const property of properties) {
        expect(['opacity', 'translate', 'rotate', 'scale'], name).toContain(property);
      }
    }
  });

  it('stops every preset under the phone’s setting and under the app’s switch', () => {
    expect(baseTheme.still).toEqual(
      Object.fromEntries(names.map((name) => [`motion-${name}`, 'none'])),
    );
    const css = themeCss(baseTheme);
    expect(css).toContain(
      '@media (prefers-reduced-motion: reduce) {\n  :root {\n    --theme-motion-turn: none;',
    );
    expect(css).toContain(":root[data-motion='still'] {\n  --theme-motion-turn: none;");
    // The still blocks come after the normal ones, so they win at the same specificity.
    expect(css.indexOf('@media')).toBeGreaterThan(css.indexOf('--theme-motion-turn: transform'));
  });

  it('refuses a still value for a key no concern fills, or filled twice', () => {
    expect(() => mergeParts([{ still: { 'motion-wiggle': 'none' } }])).toThrow(
      'Theme key motion-wiggle is stopped but never filled',
    );
    expect(() =>
      mergeParts([
        { shared: { 'motion-turn': 'x' }, still: { 'motion-turn': 'none' } },
        { still: { 'motion-turn': 'none' } },
      ]),
    ).toThrow('Theme key motion-turn is filled twice');
  });

  it('wears a transition or an animation, read from the preset’s key', () => {
    expect(motionStyle('turn')).toEqual({ transition: 'var(--theme-motion-turn)' });
    expect(motionStyle('float')).toEqual({ animation: 'var(--theme-motion-float)' });
  });

  it('turns the app’s switch on and off, and reads it with the phone’s setting', () => {
    const doc = fakeDocument();
    let reduce = false;
    const win = {
      document: doc,
      matchMedia: (query: string) => ({ matches: query.includes('reduce') && reduce }),
    } as unknown as Window;
    expect(motionIsStill(win)).toBe(false);
    setMotionStill(true, doc as unknown as Document);
    expect(doc.documentElement.dataset.motion).toBe('still');
    expect(motionIsStill(win)).toBe(true);
    setMotionStill(false, doc as unknown as Document);
    expect(doc.documentElement.dataset.motion).toBeUndefined();
    reduce = true;
    expect(motionIsStill(win)).toBe(true);
  });

  it('pauses a loop off screen and in the background, and lets go when unmounted', () => {
    const doc = fakeDocument();
    const el = fakeElement(doc);
    const { seen, Observer } = fakeObserver();
    const stop = watchOnScreen(el as unknown as Element, {
      IntersectionObserver: Observer as unknown as typeof IntersectionObserver,
    });
    expect(el.attributes.has('data-motion-paused')).toBe(false);
    seen.report?.([{ isIntersecting: false }]);
    expect(el.attributes.has('data-motion-paused')).toBe(true);
    seen.report?.([{ isIntersecting: true }]);
    expect(el.attributes.has('data-motion-paused')).toBe(false);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(el.attributes.has('data-motion-paused')).toBe(true);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(el.attributes.has('data-motion-paused')).toBe(false);
    stop();
    expect(seen.off).toBe(true);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(el.attributes.has('data-motion-paused')).toBe(false);
  });

  it('draws <Motion> with its preset, which a passed style cannot override', () => {
    expect(
      renderToStaticMarkup(
        <Motion preset="turn" as="span" className="inline-flex" style={{ transition: 'none' }} />,
      ),
    ).toBe(
      '<span class="inline-flex" data-skin-motion="turn" style="transition:var(--theme-motion-turn)"></span>',
    );
    expect(renderToStaticMarkup(<Motion preset="pulse" />)).toBe(
      '<div data-skin-motion="pulse" style="animation:var(--theme-motion-pulse)"></div>',
    );
  });
});
