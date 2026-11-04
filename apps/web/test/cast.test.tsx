import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import { CastPanel } from '../src/sheet/panels/CastPanel';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-47: the cast panel, drawn before any tap. Golden C (2014: wizard 3 and paladin 3, caster
// level 4, slots 4 and 3, Charisma 14 and Intelligence 15, SPEC §6.7) with Cure Wounds prepared by
// its paladin: 1d8 + the Charisma modifier +2 at a level 1 slot (SRD 5.1: "1d8 + your spellcasting
// ability modifier"). Golden A (2014: cleric 1, Wisdom) has Bless always prepared. The cantrip, the
// conditions and the rule are made up. The taps and the casts are the e2e test's.

// The page's choices need a `document`, which a static render has none of: `rollMyself` is held here.
const settings = vi.hoisted(() => ({ rollMyself: false }));
vi.mock('../src/settings/useSettings', () => ({ useSettings: () => settings }));

void i18n;
const packs = installBuiltInPacks().packs;

const source = { pack: 'character' };
const flicker = {
  id: 'character:spell/flicker',
  type: 'spell',
  ruleset: 'any',
  name: { en: 'Flicker' },
  source,
  level: 0,
  school: 'evocation',
  castingTime: { value: 1, unit: 'action' },
  range: { kind: 'self' },
  components: { v: true, s: true },
  duration: { kind: 'instant' },
  concentration: false,
  ritual: false,
  classes: ['wizard'],
} as const;
const incapacitated = {
  id: 'character:condition/incapacitated',
  type: 'condition',
  key: 'incapacitated',
  ruleset: 'any',
  name: { en: 'Incapacitated' },
  source,
} as const;

function drawn(
  spell: string,
  extra: Record<string, unknown> = {},
  golden: typeof goldenC2014 | typeof goldenA = goldenC2014,
): string {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({
    ...golden,
    localEntities: [flicker, incapacitated],
    systemData: {
      ...golden.systemData,
      spells: {
        'srd-2014:class/paladin': { prepared: ['srd-2014:spell/cure-wounds'] },
        'srd-2014:class/wizard': { prepared: [flicker.id] },
      },
    },
    ...extra,
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
        <CastPanel spell={spell} part={undefined} onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
const CURE = 'srd-2014:spell/cure-wounds';

describe('SHEET-47 the cast panel', () => {
  it('names the spell, its level and school, and the slots left of the levels that can hold it', () => {
    const html = text(drawn(CURE));
    expect(html).toContain('|Cure Wounds|');
    expect(html).toContain('Level 1 · Evocation · Slots left: Level 1 4 of 4 · Level 2 3 of 3');
  });

  it('shows the dice at the lowest slot: 1d8 + 2, and the slots as chips with the first pressed', () => {
    const html = drawn(CURE);
    expect(text(html)).toContain('Healing: 1d8 + 2');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Level 1</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Level 2</);
    expect(text(html)).toContain('|Slot level|');
  });

  it('has "See full description", "Don’t use a spell slot", Cast and the healing roll', () => {
    const html = text(drawn(CURE));
    expect(html).toContain('|See full description|');
    expect(html).toContain('|Don&#x27;t use a spell slot|');
    expect(html).toContain('|Cast|');
    expect(html).toContain('|Healing|');
    expect(html).not.toContain('|Damage|');
  });

  it('draws a spell with no dice with no dice section', () => {
    const html = text(drawn('srd-2014:spell/bless', {}, goldenA));
    expect(html).toContain('|Bless|');
    expect(html).not.toContain('At this level');
    expect(html).not.toContain('|Healing|');
  });

  it('draws a cantrip with no slot to pick and no switch', () => {
    const html = text(drawn(flicker.id));
    expect(html).toContain('Cantrip · Evocation');
    expect(html).not.toContain('|Slot level|');
    expect(html).not.toContain('spell slot|');
  });

  it('warns before Cast of a condition that takes the action away, and says the cast still works', () => {
    const html = text(
      drawn(CURE, {
        state: { ...goldenC2014.state, conditions: [{ id: incapacitated.id }] },
      }),
    );
    expect(html).toContain(
      'Incapacitated: the character can take no action to cast. The cast still works.',
    );
  });

  it('warns of a rule that stops casting, with the steps of its number', () => {
    const html = text(drawn(CURE, { overrides: [{ path: 'spell.cannotCast', value: 1 }] }));
    expect(html).toContain('A rule stops this character casting spells. The cast still works.');
    expect(html).toContain('Manual edit');
  });

  it('says Missing for a spell no pack holds', () => {
    expect(text(drawn('srd-2014:spell/nothing'))).toContain('Missing: srd-2014:spell/nothing');
  });
});

describe('SHEET-74 the cast panel counts the faces a person types', () => {
  afterEach(() => {
    settings.rollMyself = false;
  });

  it('draws no field for the dice while "I roll myself" is off', () => {
    const html = drawn(CURE);
    expect(html).not.toContain('What your dice show');
    expect(html).not.toContain('type="number"');
  });

  it('draws one field for Cure Wounds’ 1d8 and keeps the healing roll off until it holds a face', () => {
    settings.rollMyself = true;
    const html = drawn(CURE);
    expect(html).toContain('What your dice show');
    expect(html.match(/aria-label="[^"]*, die \d"/g)).toEqual(['aria-label="1d8, die 1"']);
    expect(html).toMatch(/disabled=""[^>]*>Healing</);
    // Cast is not a roll: it stays on.
    expect(html).not.toMatch(/disabled=""[^>]*>Cast</);
  });

  it('draws no field and no disabled roll for a spell with no dice', () => {
    settings.rollMyself = true;
    const html = drawn('srd-2014:spell/bless', {}, goldenA);
    expect(html).not.toContain('What your dice show');
  });
});
