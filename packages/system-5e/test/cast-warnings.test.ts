import { compute } from '@grimoire/engine';
import type { EntityId } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import {
  type CastAsk,
  type CastWarning,
  castSpell,
  castWarnings,
  type FifthEditionCharacter,
  fifthEditionModule,
  INCAPACITATED_CONDITION,
  type SlotAsk,
} from '../src/index.ts';
import {
  type CharacterInput,
  CONCENTRATION,
  done,
  hexer,
  indexOf,
  ownSpell,
  refused,
  slot,
  stamp,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenB, goldenC2014, goldenC2024 } from './golden/index.ts';

// SHEET-17: what forbids a cast warns, and the cast still happens. Golden C as its wizard 3 alone
// has no armor training (ENG-46's "the wizard"); golden A (2014) is cleric 1 with two level 1
// slots and Bless (ENG-20); golden B as the made-up hexer 3 has two pact slots of level 2. The
// conditions and spells are made up, names and numbers only: the Unconscious one grants the
// Incapacitated one, as both SRDs' Unconscious does (SHEET-17 §8). Every expected value was worked
// out by hand in SHEET-17 §3.

type EntityInput = FifthEditionCharacter['localEntities'][number];
type Row = CharacterInput['systemData']['inventory'][number];

const source = { pack: 'character' };
const BLESS = 'srd-2014:spell/bless';
const SPARK = ownSpell('spark', 1, false);
const FLICKER = ownSpell('flicker', 0, false);
const INCAPACITATED: EntityId = 'character:condition/incapacitated';
const UNCONSCIOUS: EntityId = 'character:condition/unconscious';

/** A made-up condition of the key `incapacitated`. */
const incapacitated: EntityInput = {
  id: INCAPACITATED,
  type: 'condition',
  key: INCAPACITATED_CONDITION,
  ruleset: 'any',
  name: { en: 'Incapacitated' },
  source,
};

/** A made-up condition of the key `unconscious`, granting the Incapacitated one, or nothing. */
const unconscious = (grants: boolean): EntityInput => ({
  id: UNCONSCIOUS,
  type: 'condition',
  key: 'unconscious',
  ruleset: 'any',
  name: { en: 'Unconscious' },
  source,
  ...(grants && { grants: [{ id: 'inert', kind: 'entity', fixed: [INCAPACITATED] }] }),
});

const CONDITIONS = [incapacitated, unconscious(true)];

/** An equipped row of the SRD item `itemId`. */
const row = (n: number, itemId: NonNullable<Row['itemId']>): Row => ({
  uid: `c3000000-0000-4000-8000-00000000000${n}`,
  itemId,
  qty: 1,
  equipped: true,
  attuned: false,
});

const mail2014 = row(1, 'srd-2014:item/chain-mail');
const shield2014 = row(2, 'srd-2014:item/shield');
const mail2024 = row(1, 'srd-2024:item/chain-mail');
const shield2024 = row(2, 'srd-2024:item/shield');

/** Golden C as its wizard alone, wearing `inventory`, with the made-up spells and conditions. */
const wizard = (golden: CharacterInput, inventory: Row[], stored: EntityId[] = []) =>
  withTrackers(
    golden,
    {},
    {
      localEntities: [SPARK, FLICKER, ...CONDITIONS],
      state: { ...golden.state, conditions: stored.map((id) => ({ id })) },
      systemData: {
        ...golden.systemData,
        classes: golden.systemData.classes.slice(0, 1),
        inventory,
      },
    },
  );

/** Golden A at `current` hit points, with these own conditions, storing `stored`. */
const cleric = (current: number, conditions: EntityInput[], stored: EntityId[] = []) =>
  withTrackers(
    goldenA,
    { current },
    {
      localEntities: [FLICKER, ...conditions],
      state: { ...goldenA.state, conditions: stored.map((id) => ({ id })) },
    },
  );

/** Golden B as hexer 3 at `current` hit points, with the made-up conditions. */
const pactCaster = (current: number) =>
  withTrackers(
    goldenB,
    { current },
    {
      localEntities: [hexer, ...CONDITIONS],
      systemData: {
        ...goldenB.systemData,
        classes: [{ id: 'character:class/hexer', level: 3, hp: ['max', 1, 1] }],
      },
    },
  );

/** The warnings without their log message. */
const codes = (warnings: readonly CastWarning[]) =>
  warnings.map(({ message, ...warning }) => {
    expect(message).not.toBe('');
    return warning;
  });

/** What forbids `character` casting now. */
const warningsOf = (character: FifthEditionCharacter) =>
  codes(castWarnings(compute(character, indexOf(character), fifthEditionModule)));

/** A cast on `character`, from its edition's pack. */
const cast = (character: FifthEditionCharacter, spell: string, slotAsk?: SlotAsk) => {
  const ask: CastAsk = { spell, ...(slotAsk !== undefined && { slot: slotAsk }) };
  return castSpell(character, indexOf(character), ask, stamp);
};

/** A rule step of a training penalty on `spell.cannotCast`. */
const rule = (name: 'untrainedArmor' | 'untrainedShield', change: number) => ({
  kind: 'rule',
  rule: name,
  value: 1,
  change,
});

const NO_SPELLS = { code: 'cannotCast', steps: [rule('untrainedArmor', 1)] };
const INERT = { code: 'incapacitated', condition: INCAPACITATED };

describe('SHEET-17 casting warns of what forbids it', () => {
  it('names the condition key that stops every cast', () => {
    expect(INCAPACITATED_CONDITION).toBe('incapacitated');
  });

  it('warns of armor worn without training, with the steps of spell.cannotCast', () => {
    expect(warningsOf(wizard(goldenC2014, [mail2014]))).toEqual([NO_SPELLS]);
    expect(warningsOf(wizard(goldenC2014, [mail2014, shield2014]))).toEqual([
      { code: 'cannotCast', steps: [rule('untrainedArmor', 1), rule('untrainedShield', 0)] },
    ]);
    expect(warningsOf(wizard(goldenC2024, [mail2024]))).toEqual([NO_SPELLS]);
    // 2024's shield without training takes its AC, not spells (ENG-46).
    expect(warningsOf(wizard(goldenC2024, [shield2024]))).toEqual([]);
    expect(warningsOf(wizard(goldenC2014, []))).toEqual([]);
  });

  it('warns of the Incapacitated condition, stored or granted by the Unconscious one', () => {
    expect(warningsOf(cleric(12, CONDITIONS, [INCAPACITATED]))).toEqual([INERT]);
    expect(warningsOf(cleric(0, CONDITIONS))).toEqual([INERT]);
    // Golden B wears its chain mail, which the hexer gives no training for (ENG-46 §11).
    expect(warningsOf(pactCaster(0))).toEqual([NO_SPELLS, INERT]);
    expect(warningsOf(cleric(12, CONDITIONS))).toEqual([]);
    expect(warningsOf(pactCaster(12))).toEqual([NO_SPELLS]);
  });

  it('lets the pack decide what the Unconscious condition includes', () => {
    expect(warningsOf(cleric(0, [incapacitated, unconscious(false)]))).toEqual([]);
  });

  it('gives both warnings, the training first', () => {
    expect(warningsOf(wizard(goldenC2014, [mail2014], [INCAPACITATED]))).toEqual([
      NO_SPELLS,
      INERT,
    ]);
  });

  it('casts as before, the warnings in its outcome', () => {
    const mailed = wizard(goldenC2014, [mail2014]);
    const spark = done(mailed, cast(mailed, SPARK.id, { level: 1 }));
    expect(spark.entry.changes).toEqual([{ path: slot(1), after: 1 }]);
    expect(codes(spark.outcome.warnings)).toEqual([NO_SPELLS]);

    const inert = cleric(12, CONDITIONS, [INCAPACITATED]);
    const bless = done(inert, cast(inert, BLESS, { level: 1 }));
    expect(bless.entry.changes).toEqual([
      { path: slot(1), after: 1 },
      { path: CONCENTRATION, after: BLESS },
    ]);
    expect(codes(bless.outcome.warnings)).toEqual([INERT]);

    const free = cleric(12, []);
    expect(done(free, cast(free, BLESS, { level: 1 })).outcome.warnings).toEqual([]);
  });

  it('keeps its refusals, while castWarnings still warns before the cast', () => {
    const inert = cleric(12, CONDITIONS, [INCAPACITATED]);
    expect(refused(cast(inert, FLICKER.id))).toEqual({ code: 'unchanged' });
    expect(warningsOf(inert)).toEqual([INERT]);
  });
});
