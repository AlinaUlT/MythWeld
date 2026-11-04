import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { NumberPad, type NumberPadMode } from '../src/sheet/panels/NumberPad';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-40: the number pad on golden B (SPEC §6.7: a human fighter 1 of the 2024 rules, 12 hit
// points), with 5 temporary hit points where the board V3-TempHP draws them ("12 / 12 +5"). The
// pad's typing and its changes are the e2e test's; here, what it shows before a digit is typed.

void i18n;
const packs = installBuiltInPacks().packs;

function drawn(
  mode: NumberPadMode,
  temp = 0,
  current = 12,
  localEntities: readonly object[] = [],
): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...goldenB,
    localEntities,
    systemData: {
      ...goldenB.systemData,
      state: { ...goldenB.systemData.state, hp: { current, temp } },
    },
  });
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const sheet: SheetValue = {
    character,
    content,
    computed: compute(character, content.index, system.module),
    system,
    editing: false,
    roll: () => {},
    breakdown: () => {},
    cast: () => {},
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <NumberPad mode={mode} onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');

describe('SHEET-40 the number pad', () => {
  it('opens in the mode of the dock button, with Damage, Heal and Temp HP to switch to', () => {
    const damage = drawn('damage');
    expect(text(damage)).toContain('|Damage|Heal|Temp HP|');
    expect(damage).toMatch(/aria-pressed="true"[^>]*>Damage</);
    expect(drawn('heal')).toMatch(/aria-pressed="true"[^>]*>Heal</);
  });

  it('shows the hit points before any digit: "12 / 12 → 12 / 12", and the amount 0', () => {
    const html = text(drawn('damage'));
    expect(html).toContain('|12 / 12 → 12 / 12|');
    expect(html).toContain('|0|');
  });

  it('shows temporary hit points in their own colour next to the hit points: "+5"', () => {
    const html = drawn('heal', 5);
    expect(text(html)).toContain('|12 / 12 → 12 / 12|+5|');
    expect(html).toContain('text-temp');
  });

  it('has the twelve keys of board V3-Keypad: 1 to 9, Clear, 0 and Delete', () => {
    const html = drawn('damage');
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      expect(html).toContain(`aria-label="${key}"`);
    }
    expect(html).toContain('aria-label="Clear"');
    expect(html).toContain('aria-label="Delete the last digit"');
  });

  it('names the action by the mode, and cannot apply an amount of 0', () => {
    for (const [mode, label] of [
      ['damage', 'Take 0 damage'],
      ['heal', 'Heal 0'],
    ] as const) {
      const html = drawn(mode);
      expect(text(html)).toContain(`|${label}|`);
      expect(html).toMatch(new RegExp(`disabled=""[^>]*>${label}<`));
    }
  });
});

describe('SHEET-72 the number pad’s damage type and critical hit', () => {
  // The pack holds the 13 damage types of the SRD (SHEET-84); a character's own entries (here
  // Mist and Rust, made up, with keys the SRD lacks) are offered with them.
  const SRD_TYPES = [
    'Acid',
    'Bludgeoning',
    'Cold',
    'Fire',
    'Force',
    'Lightning',
    'Necrotic',
    'Piercing',
    'Poison',
    'Psychic',
    'Radiant',
    'Slashing',
    'Thunder',
  ];
  const own = ['mist', 'rust'].map((slug) => ({
    id: `character:damageType/${slug}`,
    type: 'damageType',
    key: slug,
    ruleset: 'any',
    name: { en: slug === 'mist' ? 'Mist' : 'Rust' },
    source: { pack: 'character' },
  }));
  const chips = (html: string) =>
    [...html.matchAll(/aria-pressed="(true|false)"[^>]*>([^<]+)</g)].filter(
      ([, , name]) => name !== 'Damage' && name !== 'Heal' && name !== 'Temp HP',
    );

  it('offers each damage type the character finds as a chip in the Damage mode, none picked', () => {
    const found = chips(drawn('damage', 0, 12, own));
    expect(found.map(([, , name]) => name).sort()).toEqual([...SRD_TYPES, 'Mist', 'Rust'].sort());
    expect(found.every(([, pressed]) => pressed === 'false')).toBe(true);
    expect(text(drawn('damage'))).toContain('|Damage type|');
    expect(chips(drawn('damage')).map(([, , name]) => name)).toEqual(SRD_TYPES);
  });

  it('offers no type for healing or temporary hit points', () => {
    expect(chips(drawn('heal', 0, 12, own))).toEqual([]);
    expect(drawn('heal', 0, 12, own)).not.toContain('Damage type');
  });

  it('offers the critical hit only at 0 hit points, where it changes the death saves', () => {
    const switchText = 'Critical hit: two death save failures';
    expect(drawn('damage', 0, 0)).toContain(switchText);
    expect(drawn('damage', 0, 12)).not.toContain(switchText);
    expect(drawn('damage', 0, 5)).not.toContain(switchText);
    expect(drawn('heal', 0, 0)).not.toContain(switchText);
  });
});
