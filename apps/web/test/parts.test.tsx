import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Part } from '../src/theme/Part';
import {
  basePicks,
  type PartName,
  partProperties,
  partStyle,
  partStyles,
  partsTheme,
} from '../src/theme/parts';
import { slotProperties } from '../src/theme/slots';
import { baseTheme, mergeParts } from '../src/theme/theme';

const board = (name: string) =>
  readFileSync(new URL(`../../../docs/design/mockups/V3-${name}.dc.html`, import.meta.url), 'utf8');

const names = Object.keys(partStyles) as PartName[];
const keys = names.flatMap((name) => partProperties.map((property) => `part-${name}-${property}`));

// A key's value with each `var(--theme-…)` replaced by the token's value in that mode.
function resolve(value: string, mode: 'light' | 'dark'): string {
  return value.replace(/var\(--theme-([a-z0-9-]+)\)/g, (_, key: string) =>
    resolve(baseTheme[mode][key] ?? baseTheme.shared[key] ?? `missing ${key}`, mode),
  );
}
const fill = (key: string, mode: 'light' | 'dark') =>
  resolve(baseTheme[mode][key] ?? baseTheme.shared[key] ?? `missing ${key}`, mode);

describe('SHEET-04 each part takes its style from a fixed menu', () => {
  it('names the parts phase 2 draws, the boards second button among them', () => {
    expect(names).toEqual([
      'button',
      'button-secondary',
      'icon-button',
      'card',
      'panel',
      'chip',
      'sheet',
      'toast',
    ]);
  });

  it('offers each part at least two styles, each setting every part property', () => {
    for (const name of names) {
      const menu = Object.values(partStyles[name]);
      expect(menu.length, name).toBeGreaterThanOrEqual(2);
      for (const style of menu)
        expect(Object.keys(style).sort()).toEqual([...partProperties].sort());
    }
  });

  it('fills every part key in both modes from the base picks, and no other part key', () => {
    for (const key of keys) {
      for (const mode of ['light', 'dark'] as const)
        expect(fill(key, mode), key).not.toMatch(/missing/);
    }
    const filled = Object.keys({ ...baseTheme.shared, ...baseTheme.light, ...baseTheme.dark });
    expect(filled.filter((key) => key.startsWith('part-')).sort()).toEqual([...keys].sort());
  });

  // Each base pick, with its tokens read in light, is the shape the board draws: `drawn` is the
  // board's text, `look` is border, corner and shadow. A border of `0` on a board is `none` here.
  it.each([
    [
      'button',
      'Rest',
      'border-radius: 12px; background: #1C1D20; color: #FFFFFF; border: 0',
      ['none', '12px', 'none'],
    ],
    [
      'button-secondary',
      'Rest',
      'border-radius: 12px; background: transparent; color: #1C1D20; border: 1px solid #5E6269',
      ['1px solid #5E6269', '12px', 'none'],
    ],
    // The board's settings button has no border, fill or corner; the corner shapes a fill a skin adds.
    [
      'icon-button',
      'Player',
      'aria-label="Settings" style="width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent"',
      ['none', '12px', 'none'],
    ],
    [
      'card',
      'Dice',
      'background: #FFFFFF; border: 1px solid #E2E2DE; border-radius: 14px',
      ['1px solid #E2E2DE', '14px', 'none'],
    ],
    [
      'panel',
      'Player',
      'height: 128px; box-sizing: border-box; background: #FFFFFF; border: 1px solid #E2E2DE; border-radius: 14px; border-radius: 16px',
      ['1px solid #E2E2DE', '16px', 'none'],
    ],
    // A 15 px corner on a 30 px chip is half its height: a pill (SHEET-01).
    [
      'chip',
      'Feats',
      'height: 30px; padding: 0 12px; border-radius: 15px; display: flex; align-items: center; font-size: 13px; background: #EDECE8',
      ['none', '9999px', 'none'],
    ],
    [
      'sheet',
      'Cast',
      'background: #FFFFFF; border-radius: 20px 20px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18)',
      ['none', '20px 20px 0 0', '0 -8px 24px rgba(0, 0, 0, 0.18)'],
    ],
    [
      'toast',
      'Features',
      'height: 48px; border-radius: 12px; background: #1C1D20; color: #FFFFFF; display: flex',
      ['none', '12px', 'none'],
    ],
  ])('%s in light is what V3-%s draws', (name, boardName, drawn, look) => {
    expect(board(boardName)).toContain(drawn);
    const [border, radius, shadow] = look as [string, string, string];
    expect(fill(`part-${name}-border`, 'light')).toBe(border);
    expect(fill(`part-${name}-border-radius`, 'light')).toBe(radius);
    expect(fill(`part-${name}-box-shadow`, 'light')).toBe(shadow);
    if (border !== 'none') expect(drawn).toContain(`border: ${border}`);
    if (drawn.includes('border-radius') && !radius.startsWith('9999'))
      expect(drawn).toContain(`border-radius: ${radius}`);
    if (shadow !== 'none') expect(drawn).toContain(`box-shadow: ${shadow}`);
    if (border === 'none') expect(drawn).not.toMatch(/border: [1-9]/);
    if (shadow === 'none') expect(drawn).not.toContain('box-shadow');
  });

  it('switches a part to another style of its menu, the other parts unchanged', () => {
    const raised = partsTheme({ ...basePicks, card: 'raised' });
    expect(raised.shared).toMatchObject({
      'part-card-border': 'none',
      'part-card-border-radius': 'var(--theme-radius-card)',
      'part-card-box-shadow': 'var(--theme-shadow-raised)',
    });
    const base = partsTheme(basePicks).shared ?? {};
    for (const [key, value] of Object.entries(raised.shared ?? {}))
      if (!key.startsWith('part-card-')) expect(value, key).toBe(base[key]);
    // The theme still merges with the other concerns, so a skin's picks replace the base's.
    expect(() => mergeParts([raised])).not.toThrow();
  });

  it('refuses a style the menu does not have, and a part left without a pick', () => {
    expect(() => partsTheme({ ...basePicks, panel: 'parchment' })).toThrow(
      'Part panel has no style parchment',
    );
    const { toast: _, ...withoutToast } = basePicks;
    expect(() => partsTheme(withoutToast)).toThrow('Part toast has no style undefined');
  });

  it('gives each part property a style that reads its key', () => {
    expect(partStyle('card')).toEqual({
      border: 'var(--theme-part-card-border)',
      borderRadius: 'var(--theme-part-card-border-radius)',
      boxShadow: 'var(--theme-part-card-box-shadow)',
    });
  });

  it('draws the part on the element asked for, its look over a style the screen passes', () => {
    const html = renderToStaticMarkup(
      <Part as="button" name="chip" type="button" style={{ border: 'none', width: '2px' }}>
        x
      </Part>,
    );
    expect(html).toBe(
      '<button type="button" data-skin-part="chip" style="border:var(--theme-part-chip-border);width:2px;border-radius:var(--theme-part-chip-border-radius);box-shadow:var(--theme-part-chip-box-shadow)">x</button>',
    );
  });

  it('takes its fill from a slot that sets only the background', () => {
    const html = renderToStaticMarkup(
      <Part as="button" name="button" fill="button">
        x
      </Part>,
    );
    expect(html).toBe(
      '<button data-skin-part="button" data-skin-slot="button" style="background:var(--theme-slot-button-background);border:var(--theme-part-button-border);border-radius:var(--theme-part-button-border-radius);box-shadow:var(--theme-part-button-box-shadow)">x</button>',
    );
    expect(slotProperties.button).toEqual(['background']);
    expect(slotProperties.card).toEqual(['background']);
    // The dock's slot sets a shadow too, which the part's shadow would hide.
    // @ts-expect-error a slot setting more than the background cannot fill a part
    expect(renderToStaticMarkup(<Part name="card" fill="dock" />)).toContain('box-shadow');
  });
});
