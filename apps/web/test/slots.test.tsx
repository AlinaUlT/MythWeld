import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Slot } from '../src/theme/Slot';
import { type SlotName, slotProperties, slotStyle } from '../src/theme/slots';
import { baseTheme } from '../src/theme/theme';

const board = (name: string) =>
  readFileSync(new URL(`../../../docs/design/mockups/V3-${name}.dc.html`, import.meta.url), 'utf8');

const names = Object.keys(slotProperties) as SlotName[];
const keys = names.flatMap((name) =>
  slotProperties[name].map((property) => `slot-${name}-${property}`),
);

// A slot's value with each `var(--theme-…)` replaced by the token's value in that mode.
function resolve(value: string, mode: 'light' | 'dark'): string {
  return value.replace(/var\(--theme-([a-z0-9-]+)\)/g, (_, key: string) =>
    resolve(baseTheme[mode][key] ?? baseTheme.shared[key] ?? `missing ${key}`, mode),
  );
}
const fill = (key: string, mode: 'light' | 'dark') =>
  resolve(baseTheme[mode][key] ?? baseTheme.shared[key] ?? `missing ${key}`, mode);

describe('SHEET-03 slots the base theme fills', () => {
  it('names the slots of ADR 015 item 6, the token frame in its three board styles', () => {
    expect(names).toEqual([
      'app',
      'page',
      'character-page',
      'header',
      'dock',
      'card',
      'button',
      'portrait',
      'token-frame-thin',
      'token-frame-ring',
      'token-frame-double',
      'dice',
    ]);
  });

  it('fills every slot key in both modes, and no other slot key', () => {
    for (const key of keys) {
      for (const mode of ['light', 'dark'] as const)
        expect(fill(key, mode), key).not.toMatch(/missing/);
    }
    const filled = Object.keys({ ...baseTheme.shared, ...baseTheme.light, ...baseTheme.dark });
    expect(filled.filter((key) => key.startsWith('slot-')).sort()).toEqual([...keys].sort());
  });

  // Each light value, with its tokens read, is the value the board draws.
  it.each([
    ['slot-app-background', 'Sheet', 'background: #F5F5F3'],
    ['slot-header-background', 'Sheet', '<header style="flex-shrink: 0; background: #FFFFFF'],
    [
      'slot-dock-background',
      'Sheet',
      'background: #FFFFFF; border-top: 1px solid #E2E2DE; box-shadow',
    ],
    ['slot-dock-box-shadow', 'Sheet', 'box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05)'],
    [
      'slot-card-background',
      'Dice',
      'background: #FFFFFF; border: 1px solid #E2E2DE; border-radius: 14px',
    ],
    ['slot-button-background', 'Token', 'border-radius: 12px; background: #1C1D20'],
    ['slot-portrait-background', 'Token', 'border-radius: 50%; background: #1C1D20'],
    ['slot-token-frame-thin-box-shadow', 'Token', 'box-shadow: 0 0 0 1px #5E6269"'],
    [
      'slot-token-frame-ring-box-shadow',
      'Token',
      'box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #1C1D20"',
    ],
    [
      'slot-token-frame-double-box-shadow',
      'Token',
      'box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 3px #1C1D20, 0 0 0 5px #FFFFFF, 0 0 0 6px #1C1D20"',
    ],
    ['slot-dice-background', 'Dice', 'height: 64px; box-sizing: border-box; background: #FFFFFF'],
  ])('%s in light is what V3-%s draws', (key, name, drawn) => {
    const value = fill(key, 'light');
    expect(drawn).toContain(value);
    expect(board(name)).toContain(drawn);
  });

  it('leaves the pages clear, so the app background shows', () => {
    expect(fill('slot-page-background', 'dark')).toBe('transparent');
    expect(fill('slot-character-page-background', 'dark')).toBe('transparent');
    expect(fill('slot-app-background', 'dark')).toBe(baseTheme.dark['color-bg']);
  });

  it('gives each slot property a style that reads its key', () => {
    expect(slotStyle('dock')).toEqual({
      background: 'var(--theme-slot-dock-background)',
      boxShadow: 'var(--theme-slot-dock-box-shadow)',
    });
  });

  it('draws the slot on the element asked for, its look over a style the screen passes', () => {
    const html = renderToStaticMarkup(
      <Slot as="nav" name="dock" className="fixed" style={{ background: 'none', width: '2px' }}>
        x
      </Slot>,
    );
    expect(html).toBe(
      '<nav class="fixed" data-skin-slot="dock" style="background:var(--theme-slot-dock-background);width:2px;box-shadow:var(--theme-slot-dock-box-shadow)">x</nav>',
    );
  });
});
