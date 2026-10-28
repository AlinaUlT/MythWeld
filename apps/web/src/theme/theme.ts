// SHEET-01: the base theme is data, one file per concern, each imported here and nowhere else.
// index.css maps each Tailwind theme variable to `--theme-<key>`; applyTheme() fills those from
// the data, so a skin later replaces values without touching a component (ADR 015).
import { colors } from './colors';
import { motion } from './motion';
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
}

export function mergeParts(list: readonly ThemePart[]): Theme {
  const theme: Theme = { light: {}, dark: {}, shared: {} };
  for (const part of list) {
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
  return theme;
}

export const baseTheme = mergeParts([colors, typography, shape, slots, parts, motion]);

function block(selector: string, values: Record<string, string>): string {
  const lines = Object.entries(values).map(([key, value]) => `  --theme-${key}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

// Light and shared values sit on :root; dark values on `.dark`, the class index.html puts on
// <html> (dark is the default, SPEC §7.2).
export function themeCss(theme: Theme): string {
  return `${block(':root', { ...theme.shared, ...theme.light })}\n${block('.dark', theme.dark)}\n`;
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
