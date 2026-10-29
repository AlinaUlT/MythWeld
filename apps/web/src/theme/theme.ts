// SHEET-01: the base theme is data, one file per concern, each imported here and nowhere else.
// index.css maps each Tailwind theme variable to `--theme-<key>`; applyTheme() fills those from
// the data, so a skin later replaces values without touching a component (ADR 015).
import { colors } from './colors';
import { motion, STILL_SELECTOR } from './motions';
import type { ThemePart } from './part';
import { parts } from './parts';
import { shape } from './shape';
import { slots } from './slots';
import { typography } from './typography';

export type { ThemePart } from './part';

export interface Theme {
  light: Record<string, string>;
  dark: Record<string, string>;
  shared: Record<string, string>;
  still: Record<string, string>;
}

export function mergeParts(list: readonly ThemePart[]): Theme {
  const theme: Theme = { light: {}, dark: {}, shared: {}, still: {} };
  for (const part of list) {
    for (const [key, value] of Object.entries(part.still ?? {})) {
      if (key in theme.still) throw new Error(`Theme key ${key} is filled twice`);
      theme.still[key] = value;
    }
    for (const mode of ['light', 'dark', 'shared'] as const) {
      for (const [key, value] of Object.entries(part[mode] ?? {})) {
        // A key is filled once per mode, and never both per mode and shared.
        const taken =
          key in theme[mode] ||
          (mode === 'shared' ? key in theme.light || key in theme.dark : key in theme.shared);
        if (taken) throw new Error(`Theme key ${key} is filled twice`);
        theme[mode][key] = value;
      }
    }
  }
  // A still value replaces a shared one; a key that is never filled has nothing to replace.
  for (const key of Object.keys(theme.still)) {
    if (!(key in theme.shared)) throw new Error(`Theme key ${key} is stopped but never filled`);
  }
  return theme;
}

export const baseTheme = mergeParts([colors, typography, shape, slots, parts, motion]);

function block(selector: string, values: Record<string, string>): string {
  const lines = Object.entries(values).map(([key, value]) => `  --theme-${key}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

// Light and shared values sit on :root; dark values on `.dark`, the class index.html puts on
// <html> (dark is the default, SPEC §7.2). Still values come last, so they win while the phone asks
// for reduced motion or the app's switch stops it (SHEET-05).
export function themeCss(theme: Theme): string {
  const css = `${block(':root', { ...theme.shared, ...theme.light })}\n${block('.dark', theme.dark)}\n`;
  if (Object.keys(theme.still).length === 0) return css;
  const still = block(':root', theme.still).replace(/^/gm, '  ');
  return `${css}@media (prefers-reduced-motion: reduce) {\n${still}\n}\n${block(STILL_SELECTOR, theme.still)}\n`;
}

export function applyTheme(theme: Theme, doc: Document = document): void {
  let style = doc.getElementById('theme');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'theme';
    doc.head.append(style);
  }
  style.textContent = themeCss(theme);
}
