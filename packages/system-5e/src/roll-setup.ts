import type { Computed, ContentIndex, EntityFinder } from '@grimoire/engine';
import { finderOf, STAT_TYPE } from '@grimoire/engine';
import type { EffectOp, EntityId, EntityPartId, L10n } from '@grimoire/schema';
import { CRIT_RANGE_PATH, CRITICAL_FACE } from './attacks';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { equipmentOf } from './equipment';
import { ROLL_MODE_PATHS, ROLL_TARGETS } from './rolls';
import { rulesOf } from './rulesets';

// SHEET-39: what a tap on a number of the sheet rolls. The sheet knows a number by its computed
// path; this module says which d20 test the path is, where that test's roll mode lives, which
// `roll.*` targets its situational effects name, and, for a weapon attack, the damage to roll on a
// hit. The roll dialog (`apps/web`) reads it and names no fifth-edition path itself. Every path is
// one the other modules compute (`checks.ts`, `rolls.ts`, `attacks.ts`, `spellcasting.ts`).

/** The d20 tests a tap rolls. */
export type RollKind = 'check' | 'save' | 'skill' | 'init' | 'spellAttack' | 'weaponAttack';

/** What a weapon attack rolls on a hit: the weapon's dice, and the path of its damage bonus. */
export interface RollDamage {
  /** The weapon's own damage dice, such as `1d8`. */
  dice: string;
  /** The weapon's damage bonus: the computed path of a number added to the dice. */
  bonusPath: string;
}

/** One d20 test, found by the path of its bonus. */
export interface RollSetup {
  kind: RollKind;
  /** The test's own key: the stat, the skill, the casting class or the weapon. */
  key: string;
  /** For a check, a save or a skill: the key of the stat it tests. */
  stat?: string;
  /** The entry that names the test: the stat, the skill, the casting class or the weapon. */
  subject?: EntityId;
  /** The computed path of the bonus added to the d20: the number that was tapped. */
  path: string;
  /** The computed path of the test's roll mode: 1 advantage, −1 disadvantage, 0 neither. */
  modePath: string;
  /** The `roll.*` targets a situational effect names to apply to this test (SPEC §5.4). */
  targets: readonly string[];
  /** The lowest d20 face that is a critical hit; only an attack has one. */
  critical?: { rangePath: string | undefined };
  damage?: RollDamage;
}

/** A situational effect that names a test: shown as a chip, applied only when the person asks. */
export interface Situational {
  part: EntityPartId;
  source: EntityId;
  /** What the breakdown calls it. */
  label: L10n;
  /** The effect's own words on when it applies. */
  text: L10n;
  op: EffectOp;
  /** A number op's value: a number, or a roll formula such as `1d4`. */
  value?: string | number;
}

const PATTERNS = [
  { kind: 'check', pattern: /^checks\.([^.]+)\.total$/ },
  { kind: 'save', pattern: /^abilities\.([^.]+)\.save$/ },
  { kind: 'skill', pattern: /^skills\.([^.]+)\.total$/ },
  { kind: 'init', pattern: /^init\.total$/ },
  { kind: 'spellAttack', pattern: /^classes\.([^.]+)\.spell\.attack$/ },
  { kind: 'weaponAttack', pattern: /^attacks\.([^.]+)\.hit$/ },
] as const satisfies readonly { kind: RollKind; pattern: RegExp }[];

/** The test and its key that the tapped `path` is, or `undefined` for a path that rolls nothing. */
function matchOf(path: string): { kind: RollKind; key: string } | undefined {
  for (const { kind, pattern } of PATTERNS) {
    const found = pattern.exec(path);
    if (found !== null) return { kind, key: found[1] ?? '' };
  }
  return undefined;
}

/** `computed`'s own number at `path`, or `undefined`. */
function numberAt(computed: Computed<FifthEditionEntity>, path: string): number | undefined {
  if (!Object.hasOwn(computed.values, path)) return undefined;
  const value = computed.values[path];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** The id of the entry of `type` with `key` that the character has, when it has one. */
function subjectOf(
  computed: Computed<FifthEditionEntity>,
  type: string,
  key: string,
): { subject: EntityId } | Record<string, never> {
  const found = computed.byKey[type]?.[key];
  return found === undefined ? {} : { subject: found.id };
}

/** The first equipped weapon with the attack key `key`: the one `attacks.<key>` was computed for. */
function weaponOf(
  character: FifthEditionCharacter,
  find: EntityFinder<FifthEditionEntity>,
  key: string,
) {
  return equipmentOf(character, find).weapons.find(({ item }) => item.key === key)?.item;
}

/**
 * The d20 test that the number at `path` is, when it is one and `compute()` gave it a bonus and a
 * mode; `undefined` otherwise (a path that rolls nothing, a weapon no longer equipped). A
 * skill's stat is the one its key path names (ENG-43). Never throws.
 */
export function rollSetupOf(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
  index: ContentIndex<FifthEditionEntity>,
  path: string,
): RollSetup | undefined {
  const match = matchOf(path);
  if (match === undefined || numberAt(computed, path) === undefined) return undefined;
  const { kind, key } = match;
  const made = (setup: Omit<RollSetup, 'kind' | 'key' | 'path'>): RollSetup | undefined =>
    numberAt(computed, setup.modePath) === undefined ? undefined : { kind, key, path, ...setup };

  switch (kind) {
    case 'check':
      return made({
        stat: key,
        ...subjectOf(computed, STAT_TYPE, key),
        modePath: ROLL_MODE_PATHS.check(key),
        targets: ROLL_TARGETS.check(key),
      });
    case 'save':
      return made({
        stat: key,
        ...subjectOf(computed, STAT_TYPE, key),
        modePath: ROLL_MODE_PATHS.save(key),
        targets: ROLL_TARGETS.save(key),
      });
    case 'skill': {
      const stat = computed.keys[`skills.${key}.ability`]?.key;
      if (stat === undefined) return undefined;
      return made({
        stat,
        ...subjectOf(computed, 'skill', key),
        modePath: ROLL_MODE_PATHS.skill(key),
        targets: ROLL_TARGETS.skill(key, stat),
      });
    }
    case 'init':
      return made({ modePath: ROLL_MODE_PATHS.init, targets: ROLL_TARGETS.init() });
    case 'spellAttack':
      return made({
        ...subjectOf(computed, 'class', key),
        modePath: ROLL_MODE_PATHS.spellAttack,
        targets: ROLL_TARGETS.spellAttack(),
        critical: { rangePath: undefined },
      });
    case 'weaponAttack': {
      const item = weaponOf(character, finderOf(character, index), key);
      const weapon = item?.weapon;
      if (item === undefined || weapon === undefined) return undefined;
      const damage = weapon.damage;
      return made({
        subject: item.id,
        modePath: `attacks.${key}.mode`,
        targets: ROLL_TARGETS.weaponAttack(weapon.kind),
        critical: { rangePath: CRIT_RANGE_PATH },
        ...(damage !== undefined && {
          damage: { dice: damage.formula, bonusPath: `attacks.${key}.damage` },
        }),
      });
    }
  }
}

/** The lowest d20 face that is a critical hit for `setup`: its range's computed value, else 20. */
export function criticalRangeOf(setup: RollSetup, computed: Computed<FifthEditionEntity>): number {
  const path = setup.critical?.rangePath;
  return (path === undefined ? undefined : numberAt(computed, path)) ?? CRITICAL_FACE;
}

/**
 * The situational effects that name one of `setup`'s targets, in the entities' order: an
 * `advantage`, a `disadvantage` or an `add` that the person may switch on for this roll (SPEC
 * §5.4). An entity that is dormant or suppressed gives none, as in `activeEffects`.
 */
export function situationalOf(
  computed: Computed<FifthEditionEntity>,
  setup: RollSetup,
): Situational[] {
  const found: Situational[] = [];
  for (const { entity, dormant, suppressed } of computed.entities) {
    for (const effect of entity.effects ?? []) {
      if (effect.situational === undefined || dormant === true) continue;
      if (suppressed?.includes(effect.id) === true) continue;
      if (!setup.targets.includes(effect.target)) continue;
      const mode = effect.op === 'advantage' || effect.op === 'disadvantage';
      if (!mode && effect.op !== 'add') continue;
      found.push({
        part: `${entity.id}#${effect.id}`,
        source: entity.id,
        label: effect.label ?? entity.name,
        text: effect.situational,
        op: effect.op,
        ...(effect.op === 'add' && { value: effect.value }),
      });
    }
  }
  return found;
}

/** Whether spending the character's inspiration gives advantage in its edition (2014). */
export function inspirationAdvantage(character: FifthEditionCharacter): boolean {
  return (
    rulesOf(character).inspiration.use === 'advantage' && character.systemData.state.inspiration > 0
  );
}
