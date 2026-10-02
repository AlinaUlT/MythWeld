import {
  type BreakdownStep,
  type Derived,
  type DerivedStep,
  type DeriveInput,
  evaluateNumber,
  type GrantOf,
} from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { D20_BONUS_PATH, PROF_PATH, sumOf, zeroStep } from './checks';
import { classesOf } from './classes';
import type { ClassDef, FifthEditionEntity, SpellcastingDef, SubclassDef } from './entity-types';
import { type EditionRules, rulesOf } from './rulesets';
import { MAX_SPELL_LEVEL } from './system';

// ENG-15: fifth edition's spellcasting numbers (SPEC §6.1 step 5). Each class that casts gives its
// save DC, attack bonus and spell counts; the character's slots come from its one casting class's
// table, or from the multiclass table at its caster level, whose half-caster rounding is its
// edition's (`rulesets/`). Pact magic is a pool of its own. The rules are ENG-15 §8's.
// ENG-51: a spell a grant gives with its own stat is cast with that stat, so each stat a grant
// names has a DC and an attack of its own; every spell attack adds `attack.spell.bonus` too.

/** What a spell save DC starts from (both SRDs: "8 + …"). */
export const SPELL_DC_BASE = 8;

/** What every spell save DC adds (SPEC §5.4). */
export const SPELL_DC_BONUS_PATH = 'spell.dc.bonus';

/** What every spell attack bonus adds (SPEC §5.4). */
export const SPELL_ATTACK_BONUS_PATH = 'spell.attack.bonus';

/**
 * What every attack roll with a spell adds (SPEC §5.4's `attack.<…>.bonus`, beside the weapon
 * kinds). A spell attack adds both this and `spell.attack.bonus`: the SRD words one bonus both
 * ways (ENG-51 §8), so an effect on either counts.
 */
export const ATTACK_SPELL_BONUS_PATH = 'attack.spell.bonus';

/** The multiclass caster level: what the multiclass table is read at. */
export const CASTER_LEVEL_PATH = 'spell.casterLevel';

/** The spell level of the pact magic slots. */
export const PACT_LEVEL_PATH = 'spell.pact.level';

/** How many pact magic slots the character has. */
export const PACT_SLOTS_PATH = 'spell.pact.slots';

/** The path of the slots of a spell level, 1 to 9; `slotsSpent`'s key `"1"` is `level1`'s. */
export function slotsPath(spellLevel: number): string {
  return `spell.slots.level${spellLevel}`;
}

/**
 * The Multiclass Spellcaster table: per caster level 1 to 20, the slots of spell levels 1 to 9.
 * SRD 5.1 and SRD 5.2.1 print the same table, equal to a full caster's (ENG-15 §8).
 */
export const MULTICLASS_SLOTS: readonly (readonly number[])[] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** The progressions whose slots join the multiclass caster level. */
type SlotProgression = Extract<SpellcastingDef['progression'], 'full' | 'half' | 'third'>;

/** The progression gives slots that join the caster level: not pact magic, not none. */
function joinsCasterLevel(
  progression: SpellcastingDef['progression'],
): progression is SlotProgression {
  return progression === 'full' || progression === 'half' || progression === 'third';
}

/** What a class's levels are divided by in the caster level, by its progression. */
const DIVISORS: Readonly<Record<SlotProgression, number>> = { full: 1, half: 2, third: 3 };

/** The two ways an edition rounds half a half caster's levels. */
const ROUNDING: Readonly<Record<EditionRules['halfCasterRounding'], (n: number) => number>> = {
  down: Math.floor,
  up: Math.ceil,
};

/**
 * How many of a class's levels its progression counts toward the caster level: all of a full
 * caster's, half a half caster's by the edition's rounding, a third of a third caster's rounded
 * down in both editions. A class `alone` in casting by slots counts its levels divided, rounded up,
 * once its share is above 0: dnd5e's rule, which gives the SRD's own half-caster tables from the
 * multiclass one (ENG-15 §8).
 */
export function casterShare(
  progression: SlotProgression,
  level: number,
  rules: EditionRules,
  alone = false,
): number {
  const divisor = DIVISORS[progression];
  const round = progression === 'half' ? ROUNDING[rules.halfCasterRounding] : Math.floor;
  const share = round(level / divisor);
  return alone && share > 0 ? Math.ceil(level / divisor) : share;
}

/** A class that casts at its level: its key, its level, and whose `spellcasting` it casts by. */
interface Caster {
  key: string;
  level: number;
  def: SpellcastingDef;
  owner: ClassDef | SubclassDef;
}

/**
 * Whether a spellcasting casts at a class level: its slot row there has a slot, or it knows a
 * cantrip there. With neither column, it casts from level 1.
 */
export function castsAt(def: SpellcastingDef, level: number): boolean {
  if (def.slotsTable === undefined && def.cantripsKnown === undefined) return true;
  const row = def.slotsTable?.[level - 1] ?? [];
  return row.some((slots) => slots > 0) || (def.cantripsKnown?.[level - 1] ?? 0) > 0;
}

/** A number of a class's or subclass's own field; with `formula` when the field is one. */
function entityStep(owner: ClassDef | SubclassDef, value: number, formula?: string): BreakdownStep {
  return {
    kind: 'entity',
    source: owner.id,
    label: owner.name,
    ...(formula !== undefined && { formula }),
    value,
    change: value,
  };
}

/** A number the step always gives, with its steps. */
function fixed(value: number, steps: readonly BreakdownStep[]): DerivedStep {
  return () => ({ value, steps });
}

/** A spell count: a column's number at the class's level, or a formula's value. */
function countStep(caster: Caster, count: string | readonly number[]): DerivedStep {
  if (typeof count !== 'string') {
    const value = count[caster.level - 1] ?? 0;
    return fixed(value, [entityStep(caster.owner, value)]);
  }
  return (read): Derived => {
    const { value, warnings } = evaluateNumber(count, read);
    return { value, steps: [entityStep(caster.owner, value, count)], warnings };
  };
}

/** The DC and attack bonus of spells cast with `stat`, as `<path>.dc` and `<path>.attack`. */
function castingSteps(path: string, stat: string): Record<string, DerivedStep> {
  const mod = { path: `abilities.${stat}.mod` };
  return {
    [`${path}.dc`]: sumOf([
      { rule: 'spellDcBase', value: SPELL_DC_BASE },
      mod,
      { path: PROF_PATH },
      { path: SPELL_DC_BONUS_PATH },
    ]),
    [`${path}.attack`]: sumOf([
      mod,
      { path: PROF_PATH },
      { path: SPELL_ATTACK_BONUS_PATH },
      { path: ATTACK_SPELL_BONUS_PATH },
      { path: D20_BONUS_PATH },
    ]),
  };
}

/**
 * Where the DC and attack of spells cast with a stat a grant names are: `abilities.<stat>.spell`,
 * then `.dc` and `.attack`.
 */
export function statSpellPath(stat: string): string {
  return `abilities.${stat}.spell`;
}

/**
 * The stat the spells a grant gives are cast with: a `spell` grant's own `ability`. None for
 * another kind of grant, or a grant that names none: its spells are its class's (ENG-51 §4).
 */
export function grantCastingStat(grant: GrantOf<FifthEditionEntity>): string | undefined {
  return grant.kind === 'spell' ? grant.ability : undefined;
}

/** The multiclass table's row at a caster level; none below 1, the last above 20. */
function multiclassRow(casterLevel: number): readonly number[] {
  const at = Math.min(Math.floor(casterLevel), MULTICLASS_SLOTS.length);
  return at < 1 ? [] : (MULTICLASS_SLOTS[at - 1] ?? []);
}

/**
 * The spellcasting steps of a character: `spell.dc.bonus`, `spell.attack.bonus` and
 * `attack.spell.bonus`; each casting class's `classes.<key>.spell.*`; each stat a `spell` grant
 * names, its `abilities.<stat>.spell.dc` and `.attack`; with a class casting by slots,
 * `spell.casterLevel` and `spell.slots.level1` to `level9`; with one casting by pact magic,
 * `spell.pact.level` and `spell.pact.slots`.
 */
export function spellcastingSteps({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): Record<string, DerivedStep> {
  const steps: Record<string, DerivedStep> = {
    [SPELL_DC_BONUS_PATH]: zeroStep,
    [SPELL_ATTACK_BONUS_PATH]: zeroStep,
    [ATTACK_SPELL_BONUS_PATH]: zeroStep,
  };

  // A class casts by its own spellcasting, else by its subclass's, from the level it starts at.
  const casters = classesOf(character, gathered).flatMap(
    ({ entity, level, subclass }): Caster[] => {
      const owner = entity.spellcasting === undefined ? subclass : entity;
      const def = owner?.spellcasting;
      if (owner === undefined || def === undefined || !castsAt(def, level)) return [];
      return [{ key: entity.key, level, def, owner }];
    },
  );

  for (const caster of casters) {
    const { key, def } = caster;
    const path = `classes.${key}.spell`;
    Object.assign(steps, castingSteps(path, def.ability));
    if (def.preparedCount !== undefined) {
      steps[`${path}.prepared`] = countStep(caster, def.preparedCount);
    }
    if (def.cantripsKnown !== undefined) {
      steps[`${path}.cantrips`] = countStep(caster, def.cantripsKnown);
    }
    if (def.spellsKnown !== undefined) steps[`${path}.known`] = countStep(caster, def.spellsKnown);
  }

  // A stat a grant that applies names: one DC and attack for every grant that names it.
  const stats = new Set(gathered.grants.flatMap(({ grant }) => grantCastingStat(grant) ?? []));
  for (const stat of stats) Object.assign(steps, castingSteps(statSpellPath(stat), stat));

  // The caster level: each class casting by slots adds its share, rounded on its own; one alone
  // counts as dnd5e counts it.
  const bySlots = casters.flatMap(({ key, level, def, owner }) => {
    const progression = def.progression;
    return joinsCasterLevel(progression) ? [{ key, level, def, owner, progression }] : [];
  });
  if (bySlots.length > 0) {
    const rules = rulesOf(character);
    steps[CASTER_LEVEL_PATH] = (read) => {
      const parts = bySlots.map(({ key, progression }): BreakdownStep => {
        const path = `classes.${key}.level`;
        const level = read(path);
        const change = casterShare(progression, level, rules, bySlots.length === 1);
        return { kind: 'path', path, value: level, change };
      });
      return { value: parts.reduce((sum, part) => sum + part.change, 0), steps: parts };
    };

    // One casting class reads its own table; several, or one without a table, the multiclass one.
    const [only] = bySlots;
    const own = bySlots.length === 1 ? only?.def.slotsTable?.[only.level - 1] : undefined;
    for (let spellLevel = 1; spellLevel <= MAX_SPELL_LEVEL; spellLevel++) {
      const at = spellLevel - 1;
      if (only !== undefined && own !== undefined) {
        const value = own[at] ?? 0;
        steps[slotsPath(spellLevel)] = fixed(
          value,
          value === 0 ? [] : [entityStep(only.owner, value)],
        );
        continue;
      }
      steps[slotsPath(spellLevel)] = (read) => {
        const casterLevel = read(CASTER_LEVEL_PATH);
        const value = multiclassRow(casterLevel)[at] ?? 0;
        const step: BreakdownStep = {
          kind: 'path',
          path: CASTER_LEVEL_PATH,
          value: casterLevel,
          change: value,
        };
        return { value, steps: value === 0 ? [] : [step] };
      };
    }
  }

  // Pact magic: the first pact class's row holds its slots at one spell level, the highest given.
  const pact = casters.find(({ def }) => def.progression === 'pact');
  if (pact !== undefined) {
    const row = pact.def.slotsTable?.[pact.level - 1] ?? [];
    let level = 0;
    row.forEach((slots, at) => {
      if (slots > 0) level = at + 1;
    });
    const slots = row[level - 1] ?? 0;
    steps[PACT_LEVEL_PATH] = fixed(level, level === 0 ? [] : [entityStep(pact.owner, level)]);
    steps[PACT_SLOTS_PATH] = fixed(slots, slots === 0 ? [] : [entityStep(pact.owner, slots)]);
  }
  return steps;
}
