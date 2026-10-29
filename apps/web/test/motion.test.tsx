import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Motion } from '../src/theme/Motion';
import {
  type MotionPreset,
  motionSettings,
  pauseInBackground,
  pauseOffScreen,
  setAppMotion,
} from '../src/theme/motion';
import { baseTheme } from '../src/theme/theme';

const css = readFileSync(new URL('../src/theme/motion.css', import.meta.url), 'utf8');
const indexCss = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const board = readFileSync(
  new URL('../../../docs/design/mockups/V3-Create.dc.html', import.meta.url),
  'utf8',
);

const presets = Object.keys(motionSettings) as MotionPreset[];
const keys = presets.flatMap((preset) =>
  motionSettings[preset].map((setting) => `motion-${preset}-${setting}`),
);

// The body of one `@keyframes` block.
function keyframes(name: string): string {
  const start = css.indexOf(`@keyframes ${name} {`);
  if (start < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  return '';
}

// A stand-in for the browser's class list and events, enough for the switches.
function standIn(visibilityState: 'visible' | 'hidden') {
  const classes = new Set<string>();
  const listeners = new Map<string, () => void>();
  const doc = {
    visibilityState,
    documentElement: {
      classList: {
        toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      },
    },
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  return { doc, classes, listeners };
}

describe('SHEET-05 animation presets', () => {
  it('lists the five presets of ADR 015 item 8', () => {
    expect(presets).toEqual(['pulse', 'float', 'glow', 'sparkle', 'gradient-shift']);
  });

  it('fills every setting of every preset, and no other motion key', () => {
    for (const key of keys) expect(baseTheme.shared[key], key).toBeDefined();
    const filled = Object.keys({ ...baseTheme.shared, ...baseTheme.light, ...baseTheme.dark });
    expect(filled.filter((key) => key.startsWith('motion-')).sort()).toEqual([...keys].sort());
  });

  it('takes the colours of a preset from the colour tokens, so each mode has its own', () => {
    for (const key of keys.filter((key) => /-(?:color|from|to)$/.test(key)))
      expect(baseTheme.shared[key], key).toMatch(/^var\(--theme-color-[a-z-]+\)$/);
  });

  it('gives each preset a rule and keyframes that read each of its settings', () => {
    for (const preset of presets) {
      expect(css, preset).toContain(`[data-motion="${preset}"]`);
      expect(keyframes(`motion-${preset}`), preset).not.toBe('');
      for (const setting of motionSettings[preset])
        expect(css, `${preset} ${setting}`).toContain(`var(--theme-motion-${preset}-${setting})`);
    }
  });

  it('animates only what a phone draws cheaply (ADR 015 item 9)', () => {
    for (const preset of presets) {
      const properties = [...keyframes(`motion-${preset}`).matchAll(/([a-z-]+):/g)].map(
        (match) => match[1],
      );
      expect(properties.length, preset).toBeGreaterThan(0);
      for (const property of properties)
        expect(['scale', 'translate', 'transform', 'opacity'], preset).toContain(property);
    }
  });

  it('stops every animation and transition for the phone and for the app switch', () => {
    // Each stop's block, its biome-ignore comments taken out.
    const stop = (selector: string) => {
      const start = css.indexOf(selector);
      return css.slice(start, css.indexOf('}', start)).replace(/\/\*[^*]*\*\//g, '');
    };
    for (const selector of ['@media (prefers-reduced-motion: reduce)', '.motion-off,']) {
      expect(stop(selector), selector).toMatch(
        /\*::after \{\s+animation: none !important;\s+transition: none !important;\s+$/,
      );
    }
  });

  it('gives the default transition the boards one motion, from the theme', () => {
    expect(board).toContain('transition: transform 0.2s ease');
    expect(baseTheme.shared['default-transition-duration']).toBe('0.2s');
    expect(baseTheme.shared['default-transition-timing-function']).toBe('ease');
    expect(indexCss).toContain('--ease-*: initial;');
    expect(indexCss).toContain('--animate-*: initial;');
  });

  it('draws a preset on the element asked for', () => {
    expect(renderToStaticMarkup(<Motion preset="glow" as="div" className="size-6" />)).toBe(
      '<div class="size-6" data-motion="glow"></div>',
    );
    expect(renderToStaticMarkup(<Motion preset="pulse" />)).toBe(
      '<span data-motion="pulse"></span>',
    );
  });

  it('pauses an element off screen, and runs it again in view', () => {
    let report: (entries: { isIntersecting: boolean }[]) => void = () => {};
    const disconnect = vi.fn();
    class Observer {
      constructor(callback: typeof report) {
        report = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
    const toggleAttribute = vi.fn();
    const stop = pauseOffScreen(
      { toggleAttribute } as unknown as Element,
      Observer as unknown as typeof IntersectionObserver,
    );
    report([{ isIntersecting: false }]);
    report([{ isIntersecting: true }]);
    expect(toggleAttribute.mock.calls).toEqual([
      ['data-motion-paused', true],
      ['data-motion-paused', false],
    ]);
    stop();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('leaves the element running where the browser has no observer', () => {
    const toggleAttribute = vi.fn();
    pauseOffScreen({ toggleAttribute } as unknown as Element, undefined)();
    expect(toggleAttribute).not.toHaveBeenCalled();
  });

  it('marks the page hidden while the app is in the background', () => {
    const { doc, classes, listeners } = standIn('visible');
    const stop = pauseInBackground(doc as unknown as Document);
    expect(classes.has('app-hidden')).toBe(false);
    doc.visibilityState = 'hidden';
    listeners.get('visibilitychange')?.();
    expect(classes.has('app-hidden')).toBe(true);
    stop();
    expect(listeners.size).toBe(0);
  });

  it('turns the app switch off and on', () => {
    const { doc, classes } = standIn('visible');
    setAppMotion(false, doc as unknown as Document);
    expect(classes.has('motion-off')).toBe(true);
    setAppMotion(true, doc as unknown as Document);
    expect(classes.has('motion-off')).toBe(false);
  });
});
