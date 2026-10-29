import {
  type ActiveEffect,
  type Computed,
  type FormulaReader,
  rollModeEffects,
} from '@grimoire/engine';
import type { EntityId, L10n } from '@grimoire/schema';
import { attackPath, CRIT_RANGE_PATH, CRITICAL_FACE } from './attacks';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity, ItemDef } from './entity-types';
import { ROLL_MODE_PATHS, ROLL_MODE_SIGNS, ROLL_TARGETS, rollModeOf } from './rolls';

// SHEET-39: what the roll dialog needs to know about a number it rolls. A tap on a number gives
// its computed path; this file says which d20 test that path is (ENG-34), where the test's roll
// mode is, which `roll.*` targets a situational effect names to reach it, and, for a weapon
// attack, the weapon and its damage. Everything is read from `Computed`; nothing here rolls.

/** The d20 tests a number on the sheet rolls. A death save is rolled by its own tracker (SHEET-43). */
export type RollTestKind = 'check' | 'save' | 'skill' | 'init' | 'weaponAttack' | 'spellAttack';

/** What a test is of, for the screen to name: a stat or a skill by its key, or an item by its id. */
export type RollSubject =
  | { type: 'stat'; key: string }
  | { type: 'skill'; key: string }
  | { type: 'item'; id: EntityId };

/** The damage of a weapon attack: its dice, and the path of what its damage roll adds. */
export interface RollDamage {
  formula: string;
  bonusPath: string;
}

/** A number the sheet rolls, understood: its test, its mode, its targets. */
export interface RollTest {
  kind: RollTestKind;
  /** The number's path: what the test adds to the d20. */
  path: string;
  /** The path of the test's roll mode: 1 advantage, −1 disadvantage, 0 neither (ENG-34). */
  modePath: string;
  /** The `roll.*` targets a situational effect names to apply to this test. */
  targets: readonly string[];
  /** What it is of; none for initiative and spell attacks. */
  subject?: RollSubject;
  /** The lowest d20 face that is a critical hit; attacks only. */
  critRange?: number;
  /** A weapon attack's damage, when its weapon has any. */
  damage?: RollDamage;
}

/** The value at `path`, only when `computed` has it as its own number. */
function numberAt(computed: Computed<FifthEditionEntity>, path: string): number | undefined {
  if (!Object.hasOwn(computed.values, path)) return undefined;
  const value = computed.values[path];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** A skill's stat: its key path's key, else the skill's own. */
function skillStat(computed: Computed<FifthEditionEntity>, key: string): string | undefined {
  const keyed = Object.hasOwn(computed.keys, `skills.${key}.ability`)
    ? computed.keys[`skills.${key}.ability`]
    : undefined;
  if (keyed !== undefined) return keyed.key;
  const skill = Object.hasOwn(computed.byKey.skill ?? {}, key)
    ? computed.byKey.skill?.[key]
    : undefined;
  return skill?.type === 'skill' ? skill.ability : undefined;
}

/** The equipped weapon whose attack key is `key`, as ENG-16 gave it its paths. */
function weaponOf(computed: Computed<FifthEditionEntity>, key: string): ItemDef | undefined {
  for (const { entity } of computed.entities) {
    if (entity.type === 'item' && entity.key === key && entity.weapon !== undefined) return entity;
  }
  return undefined;
}

type Found = Omit<RollTest, 'path' | 'modePath'> & { modePath: string };

function found(path: string, computed: Computed<FifthEditionEntity>): Found | undefined {
  const [first, key, ...rest] = path.split('.');
  if (path === 'init.total') {
    return { kind: 'init', modePath: ROLL_MODE_PATHS.init, targets: ROLL_TARGETS.init() };
  }
  if (key === undefined || key === '') return undefined;
  const at = rest.join('.');
  if (first === 'checks' && at === 'total') {
    return {
      kind: 'check',
      modePath: ROLL_MODE_PATHS.check(key),
      targets: ROLL_TARGETS.check(key),
      subject: { type: 'stat', key },
    };
  }
  if (first === 'abilities' && at === 'save') {
    return {
      kind: 'save',
      modePath: ROLL_MODE_PATHS.save(key),
      targets: ROLL_TARGETS.save(key),
      subject: { type: 'stat', key },
    };
  }
  if (first === 'abilities' && at === 'spell.attack') return spellAttack();
  if (first === 'classes' && at === 'spell.attack') return spellAttack();
  if (first === 'skills' && at === 'total') {
    const stat = skillStat(computed, key);
    if (stat === undefined) return undefined;
    return {
      kind: 'skill',
      modePath: ROLL_MODE_PATHS.skill(key),
      targets: ROLL_TARGETS.skill(key, stat),
      subject: { type: 'skill', key },
    };
  }
  if (first === 'attacks' && at === 'hit') {
    const weapon = weaponOf(computed, key);
    if (weapon?.weapon === undefined) return undefined;
    const damage = weapon.weapon.damage;
    const range = numberAt(computed, CRIT_RANGE_PATH) ?? CRITICAL_FACE;
    return {
      kind: 'weaponAttack',
      modePath: `${attackPath(key)}.mode`,
      targets: ROLL_TARGETS.weaponAttack(weapon.weapon.kind),
      subject: { type: 'item', id: weapon.id },
      critRange: range,
      ...(damage !== undefined &&
        Object.hasOwn(computed.values, `${attackPath(key)}.damage`) && {
          damage: { formula: damage.formula, bonusPath: `${attackPath(key)}.damage` },
        }),
    };
  }
  return undefined;
}

function spellAttack(): Found {
  return {
    kind: 'spellAttack',
    modePath: ROLL_MODE_PATHS.spellAttack,
    targets: ROLL_TARGETS.spellAttack(),
    critRange: CRITICAL_FACE,
  };
}

/**
 * The d20 test a number at `path` rolls, or `undefined` when the path is none of them or
 * `computed` has no value at it or at its roll mode: a tap on such a number rolls nothing, and
 * the screen says so (SPEC §8.2).
 */
export function rollTestOf(
  path: string,
  computed: Computed<FifthEditionEntity>,
): RollTest | undefined {
  if (numberAt(computed, path) === undefined) return undefined;
  const test = found(path, computed);
  if (test === undefined || numberAt(computed, test.modePath) === undefined) return undefined;
  return { ...test, path };
}

/**
 * The signs the sheet's own sources give the test's roll mode: one per step of its breakdown.
 * When the mode's value is not what those steps give, a manual edit set it (ENG-34), and that
 * value is the one source.
 */
export function modeSigns(computed: Computed<FifthEditionEntity>, modePath: string): number[] {
  const mode = numberAt(computed, modePath) ?? 0;
  const steps = Object.hasOwn(computed.breakdown, modePath) ? computed.breakdown[modePath] : [];
  const signs = (steps ?? []).map(({ value }) => value);
  return rollModeOf(signs) === mode ? signs : [mode];
}

/** A situational effect the person may switch on for one roll (ENG-34, SPEC §5.4). */
export interface SituationalMode {
  /** The effect's part id: stable, and what the screen keys its chip by. */
  part: string;
  /** What the chip says: the effect's `situational` text. */
  hint: L10n;
  /** What the effect is called: its own label, else its entity's name. */
  label: L10n;
  sign: 1 | -1;
}

/**
 * The advantage and disadvantage effects of the character that name one of `targets` and are
 * marked situational, in the entities' order: never part of a number until the person switches
 * one on for a roll. A dormant entity's, a suppressed one's and one whose `when` is false are not
 * offered. Another op, and a number op, are not offered.
 */
export function situationalModes(
  character: Pick<FifthEditionCharacter, 'state'>,
  computed: Computed<FifthEditionEntity>,
  targets: readonly string[],
): SituationalMode[] {
  const effects: ActiveEffect[] = [];
  for (const { entity, paths, dormant, suppressed } of computed.entities) {
    for (const effect of entity.effects ?? []) {
      const part = `${entity.id}#${effect.id}` as const;
      if (effect.situational === undefined) continue;
      if (dormant === true && effect.when === undefined) continue;
      if (suppressed?.includes(effect.id) === true) continue;
      if (
        effect.toggle !== undefined &&
        !(character.state.toggles[part] ?? effect.toggle.default)
      ) {
        continue;
      }
      effects.push({
        effect,
        part,
        source: entity.id,
        label: effect.label ?? entity.name,
        ...(paths && { paths }),
      });
    }
  }
  const read: FormulaReader = (path) =>
    Object.hasOwn(computed.values, path) ? computed.values[path] : undefined;
  return rollModeEffects(
    effects,
    targets,
    () => ({ read }),
    () => {},
  ).flatMap(({ part, op, label }) => {
    const hint = effects.find((each) => each.part === part)?.effect.situational;
    return hint === undefined ? [] : [{ part, hint, label, sign: ROLL_MODE_SIGNS[op] }];
  });
}
