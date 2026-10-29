import type { CSSProperties } from 'react';
import type { ThemePart } from './part';

// SHEET-03: the named places a screen draws and a skin fills (ADR 015 item 6). A slot sets the CSS
// properties listed here, each from its own theme key `slot-<slot>-<property>`. With no skin, the
// base theme below fills every key; a skin fills the same keys and cannot add a slot. A value may
// be anything its property takes: a colour, a gradient, a picture, rings around the token.
export const slotProperties = {
  app: ['background'],
  page: ['background'],
  'character-page': ['background'],
  header: ['background'],
  dock: ['background', 'box-shadow'],
  card: ['background'],
  button: ['background'],
  portrait: ['background'],
  'token-frame-thin': ['box-shadow'],
  'token-frame-ring': ['box-shadow'],
  'token-frame-double': ['box-shadow'],
  dice: ['background'],
} as const satisfies Record<string, readonly string[]>;

export type SlotName = keyof typeof slotProperties;

// The boards' look, read from the colour and shadow tokens, so each mode follows its own colours.
// The pages are clear, so the app background shows through them.
export const slots = {
  shared: {
    'slot-app-background': 'var(--theme-color-bg)',
    'slot-page-background': 'transparent',
    'slot-character-page-background': 'transparent',
    'slot-header-background': 'var(--theme-color-surface)',
    'slot-dock-background': 'var(--theme-color-surface)',
    'slot-dock-box-shadow': 'var(--theme-shadow-dock)',
    'slot-card-background': 'var(--theme-color-surface)',
    'slot-button-background': 'var(--theme-color-strong)',
    'slot-portrait-background': 'var(--theme-color-strong)',
    'slot-token-frame-thin-box-shadow': '0 0 0 1px var(--theme-color-muted)',
    'slot-token-frame-ring-box-shadow':
      '0 0 0 2px var(--theme-color-surface), 0 0 0 4px var(--theme-color-strong)',
    'slot-token-frame-double-box-shadow':
      '0 0 0 2px var(--theme-color-surface), 0 0 0 3px var(--theme-color-strong), 0 0 0 5px var(--theme-color-surface), 0 0 0 6px var(--theme-color-strong)',
    'slot-dice-background': 'var(--theme-color-surface)',
  },
} satisfies ThemePart;

// `box-shadow` → `boxShadow`, the name a React style takes.
export const camel = (property: string) =>
  property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

// The style a slot's element wears: each property reads the slot's theme key.
export function slotStyle(name: SlotName): CSSProperties {
  return Object.fromEntries(
    slotProperties[name].map((property) => [
      camel(property),
      `var(--theme-slot-${name}-${property})`,
    ]),
  );
}
