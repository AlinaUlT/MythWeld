import type { Computed } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import { CRIT_RANGE_PATH, type WeaponKind } from './attacks';
import type { FifthEditionEntity } from './entity-types';
import { ROLL_MODE_PATHS, ROLL_MODE_SIGNS, ROLL_TARGETS } from './rolls';

// SHEET-39: what the roll dialog asks of the module for a number that rolls (BRIEF P5 sheet 1): the
// kind of d20 test it is, the path of its roll mode (ENG-34), the `roll.*` targets a situational
// effect names to apply to it, and, for a weapon attack, the critical range and the damage it
// rolls. The dialog adds its own sources to the mode's steps with `rollModeOf` (rolls.ts), rolls
// `d20Formula(mode)` and reads the kept face with `attackOutcome` (attacks.ts).

/** The d20 tests a number of the sheet rolls. */
export type RollKind = 'check' | 'save' | 'skill' | 'init' | 'weaponAttack' | 'spellAttack';

/** What a weapon attack rolls for damage: the weapon's dice and the path of the bonus it adds. */
export interface RollDamage {
  dice: string;
  bonus: string;
  /** What names the damage on the sheet's paths: `attacks.<key>.damage`. */
  path: string;
}

/** A d20 test: the number it adds and how its mode is made. */
export interface RollTest {
  kind: RollKind;
  /** The path of the number the roll adds to the d20: the number the sheet shows. */
  bonus: string;
  /** The path of the test's roll mode: 1 advantage, −1 disadvantage, 0 neither (ENG-34). */
  mode: string;
  /** The `roll.*` targets a situational effect names to apply to this test. */
  targets: readonly string[];
  /** A weapon attack's critical range path (`crit.range`). */
  critRange?: string;
  damage?: RollDamage;
}

function has(computed: Computed<FifthEditionEntity>, path: string): boolean {
  return Object.hasOwn(computed.values, path);
}

/** The test the number at `path` is, or `undefined` when the number is not one that rolls. */
export function fifthEditionRollTest(
  computed: Computed<FifthEditionEntity>,
  path: string,
): RollTest | undefined {
  if (!has(computed, path)) return undefined;
  if (path === 'init.total') {
    return { kind: 'init', bonus: path, mode: ROLL_MODE_PATHS.init, targets: ROLL_TARGETS.init() };
  }
  const [root, key, last, extra] = path.split('.');
  if (key === undefined || key === '') return undefined;
  if (root === 'checks' && last === 'total' && extra === undefined) {
    return {
      kind: 'check',
      bonus: path,
      mode: ROLL_MODE_PATHS.check(key),
      targets: ROLL_TARGETS.check(key),
    };
  }
  if (root === 'abilities' && last === 'save' && extra === undefined) {
    return {
      kind: 'save',
      bonus: path,
      mode: ROLL_MODE_PATHS.save(key),
      targets: ROLL_TARGETS.save(key),
    };
  }
  if (root === 'skills' && last === 'total' && extra === undefined) {
    const entity = computed.byKey.skill?.[key];
    const stat =
      computed.keys[`skills.${key}.ability`]?.key ??
      (entity?.type === 'skill' ? entity.ability : undefined);
    if (stat === undefined) return undefined;
    return {
      kind: 'skill',
      bonus: path,
      mode: ROLL_MODE_PATHS.skill(key),
      targets: ROLL_TARGETS.skill(key, stat),
    };
  }
  if ((root === 'classes' || root === 'abilities') && last === 'spell' && extra === 'attack') {
    return {
      kind: 'spellAttack',
      bonus: path,
      mode: ROLL_MODE_PATHS.spellAttack,
      targets: ROLL_TARGETS.spellAttack(),
    };
  }
  if (root === 'attacks' && last === 'hit' && extra === undefined) {
    const weapon = computed.entities
      .map(({ entity }) => entity)
      .find(
        (entity) => entity.type === 'item' && entity.key === key && entity.weapon !== undefined,
      );
    if (weapon?.type !== 'item' || weapon.weapon === undefined) return undefined;
    const kind: WeaponKind = weapon.weapon.kind;
    const damage = weapon.weapon.damage;
    const damagePath = `attacks.${key}.damage`;
    return {
      kind: 'weaponAttack',
      bonus: path,
      mode: `attacks.${key}.mode`,
      targets: ROLL_TARGETS.weaponAttack(kind),
      critRange: CRIT_RANGE_PATH,
      ...(damage !== undefined &&
        has(computed, damagePath) && {
          damage: { dice: damage.formula, bonus: damagePath, path: damagePath },
        }),
    };
  }
  return undefined;
}

/** A situational effect that applies to a test when the person switches it on (SPEC §5.4). */
export interface Situational {
  /** The effect's part id, which the dialog keeps its switch under. */
  part: string;
  /** What the breakdown calls it: the effect's label, else its entity's name. */
  label: L10n;
  /** The situation it names ("against being frightened"). */
  situation: L10n;
  /** 1 for advantage, −1 for disadvantage. */
  sign: 1 | -1;
}

/**
 * The situational effects of the character that name one of `targets` with advantage or
 * disadvantage, in the entities' order. A dormant entity's effect is left out, as every effect of
 * it is (ENG-44); a suppressed one is too (ENG-46).
 */
export function fifthEditionSituational(
  computed: Computed<FifthEditionEntity>,
  targets: readonly string[],
): Situational[] {
  const found: Situational[] = [];
  for (const { entity, dormant, suppressed } of computed.entities) {
    for (const effect of entity.effects ?? []) {
      if (effect.situational === undefined) continue;
      if (effect.op !== 'advantage' && effect.op !== 'disadvantage') continue;
      if (!targets.includes(effect.target)) continue;
      if (dormant === true && effect.when === undefined) continue;
      if (suppressed?.includes(effect.id) === true) continue;
      found.push({
        part: `${entity.id}#${effect.id}`,
        label: effect.label ?? entity.name,
        situation: effect.situational,
        sign: ROLL_MODE_SIGNS[effect.op],
      });
    }
  }
  return found;
}
