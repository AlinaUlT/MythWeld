import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_BACKGROUND_COLOR } from '../src/config/app';
import { baseTheme, mergeParts, themeCss } from '../src/theme/theme';

const readme = readFileSync(
  new URL('../../../docs/design/mockups/README.md', import.meta.url),
  'utf8',
);
const indexCss = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

// The rows of "The tokens these mockups use": each names one or more tokens in camel case, and
// either one value for all of them or one value each.
const section = readme.slice(readme.indexOf('## The tokens these mockups use'));
const rows = [...section.matchAll(/^\| (`[^|]+`) \| (`[^|]+`) \|/gm)].map((match) => {
  const names = [...(match[1] ?? '').matchAll(/`([^`]+)`/g)].map((name) => name[1] ?? '');
  const values = [...(match[2] ?? '').matchAll(/`([^`]+)`/g)].map((value) => value[1] ?? '');
  return names.map((name, i) => ({ name, value: values.length === 1 ? values[0] : values[i] }));
});
const mockupTokens = rows.flat();
const kebab = (name: string) => `color-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

// WCAG 2 contrast, the formula the mockups' generator/gen2.py measures with.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

describe('SHEET-01 base theme tokens', () => {
  it('reads every colour row of the mockups README', () => {
    expect(mockupTokens.map((token) => token.name)).toEqual([
      'bg',
      'surface',
      'text',
      'strong',
      'onStrong',
      'muted',
      'line',
      'soft',
      'hp',
      'track',
      'temp',
      'warnBg',
      'warnText',
      'danger',
      'neutral',
      'scrimLow',
      'scrimMid',
      'scrim',
      'scrimHigh',
    ]);
  });

  it('fills every mockup colour in light with the mockup value, and in dark', () => {
    for (const { name, value } of mockupTokens) {
      expect(baseTheme.light[kebab(name)], name).toBe(value);
      expect(baseTheme.dark[kebab(name)], name).toBeDefined();
    }
  });

  it('fills the same keys in light and dark', () => {
    expect(Object.keys(baseTheme.dark).sort()).toEqual(Object.keys(baseTheme.light).sort());
  });

  it('fills the mockup fonts, the sizes, the corners and the shadows', () => {
    expect(baseTheme.shared['font-body']).toBe('Inter, system-ui, sans-serif');
    expect(baseTheme.shared['font-heading']).toBe("'EB Garamond', Georgia, serif");
    expect(baseTheme.shared['text-28']).toBe('1.75rem');
    expect(baseTheme.shared['radius-card']).toBe('14px');
    expect(baseTheme.shared['radius-button']).toBe('12px');
    expect(baseTheme.shared['radius-sheet']).toBe('20px');
    expect(baseTheme.shared['spacing-control']).toBe('44px');
    expect(baseTheme.light['shadow-sheet']).toBe('0 -8px 24px rgba(0, 0, 0, 0.18)');
  });

  it('names each text size by its pixels', () => {
    for (const [key, value] of Object.entries(baseTheme.shared)) {
      if (!key.startsWith('text-')) continue;
      expect(Number.parseFloat(value) * 16, key).toBe(Number(key.slice('text-'.length)));
    }
  });

  // Text and the colours read as text keep 4.5 : 1 on what they sit on, in both modes.
  const pairs = [
    ['color-text', 'color-bg'],
    ['color-text', 'color-surface'],
    ['color-text', 'color-soft'],
    ['color-muted', 'color-bg'],
    ['color-muted', 'color-surface'],
    ['color-muted', 'color-soft'],
    ['color-hp', 'color-surface'],
    ['color-temp', 'color-surface'],
    ['color-danger', 'color-surface'],
    ['color-warn-text', 'color-warn-bg'],
    ['color-on-strong', 'color-strong'],
    ['color-on-strong', 'color-danger'],
    ['color-on-strong', 'color-neutral'],
    ['color-on-strong', 'color-hp'],
  ] as const;
  for (const mode of ['light', 'dark'] as const) {
    it(`keeps 4.5 : 1 for text in ${mode}`, () => {
      for (const [fore, back] of pairs) {
        const ratio = contrast(baseTheme[mode][fore] ?? '', baseTheme[mode][back] ?? '');
        expect(ratio, `${fore} on ${back}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  // A slot's keys are read by <Slot> itself, not by a Tailwind utility (SHEET-03).
  it('maps every key in index.css once, and nothing else', () => {
    const block = indexCss.slice(indexCss.indexOf('@theme inline'));
    const mapped = [...block.matchAll(/--([a-z0-9-]+): var\(--theme-([a-z0-9-]+)\);/g)];
    for (const [, key, source] of mapped) expect(source).toBe(key);
    const keys = Object.keys({ ...baseTheme.shared, ...baseTheme.light }).filter(
      (key) => !key.startsWith('slot-'),
    );
    expect(mapped.map((match) => match[1]).sort()).toEqual(keys.sort());
  });

  it('clears the colours Tailwind brings, so a utility paints only with a token', () => {
    expect(indexCss).toContain('--color-*: initial;');
  });

  it('gives the manifest the dark page colour', () => {
    expect(APP_BACKGROUND_COLOR).toBe(baseTheme.dark['color-bg']);
  });

  it('writes light and shared values on :root, dark ones on .dark', () => {
    const css = themeCss(baseTheme);
    expect(css).toMatch(/^:root \{\n {2}--theme-font-body: Inter, system-ui, sans-serif;/);
    expect(css).toContain('  --theme-color-bg: #F5F5F3;');
    expect(css).toContain('.dark {\n  --theme-color-bg: #131417;');
  });

  it('refuses a key two concerns both fill', () => {
    expect(() =>
      mergeParts([{ shared: { 'radius-card': '1px' } }, { light: { 'radius-card': '2px' } }]),
    ).toThrow('Theme key radius-card is filled twice');
  });
});
