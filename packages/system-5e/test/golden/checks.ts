import type { DerivedStep, SystemModule } from '@grimoire/engine';
import {
  type FifthEditionCharacter,
  type FifthEditionEntity,
  fifthEditionModule,
} from '../../src/index.ts';

// ENG-09's checks of a golden pack and its characters, shared by both editions' tests (ENG-10).
// ENG-10 widened them for 2024: a weapon's mastery is a key; a `formula` prerequisite and a
// recovery amount are formulas. No 2014 entity has any of these.

/** A file opened, or the test fails with why it did not open. */
export function opened<T>(result: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

/** Every grant of an entity, a class's multiclass grants included. */
function grantsOf(entity: FifthEditionEntity) {
  const multiclass = entity.type === 'class' ? (entity.multiclass?.grants ?? []) : [];
  return [...(entity.grants ?? []), ...multiclass];
}

/** Every prerequisite of an entity, a class's multiclass prerequisites included. */
function prerequisitesOf(entity: FifthEditionEntity) {
  const multiclass = entity.type === 'class' ? (entity.multiclass?.prerequisites ?? []) : [];
  return [...(entity.prerequisites ?? []), ...multiclass];
}

/** The items a choice lists; none when it has no list, or picks by a filter. */
function listed(choose: { from: readonly string[] | object } | undefined): readonly string[] {
  return choose !== undefined && Array.isArray(choose.from) ? choose.from : [];
}

/** The entity ids an entity's grants name. */
export function idsNamedBy(entity: FifthEditionEntity): string[] {
  const ids: string[] = [];
  for (const grant of grantsOf(entity)) {
    if (grant.kind === 'entity' || grant.kind === 'spell') {
      ids.push(...(grant.fixed ?? []), ...listed(grant.choose));
    } else if (grant.kind === 'item') {
      ids.push(...(grant.fixed ?? []).map((item) => item.id), ...listed(grant.choose));
    }
  }
  return ids;
}

/** The entity type a proficiency's keys name, where the pack has entities of one. */
const KEYED_CATEGORIES: Readonly<Record<string, string>> = { skill: 'skill', language: 'language' };

/** `<type>:<key>` for every key an entity names that an entity of that type should have. */
export function keysNamedBy(entity: FifthEditionEntity): string[] {
  const named: [string, string][] = [];
  const stat = (key: string) => named.push(['ability', key]);
  for (const grant of grantsOf(entity)) {
    if (grant.kind === 'proficiency') {
      const type = KEYED_CATEGORIES[grant.category];
      if (type === undefined) continue;
      for (const key of [...(grant.fixed ?? []), ...listed(grant.choose)]) named.push([type, key]);
    } else if (grant.kind === 'abilityScore') {
      for (const key of grant.mode === 'fixed' ? Object.keys(grant.values) : grant.from) stat(key);
    }
  }
  for (const prerequisite of prerequisitesOf(entity)) {
    if (prerequisite.kind === 'ability') stat(prerequisite.key);
  }
  if (entity.type === 'class') entity.saves.forEach(stat);
  if (entity.type === 'class' || entity.type === 'subclass') {
    if (entity.spellcasting !== undefined) {
      stat(entity.spellcasting.ability);
      const classKey = entity.spellcasting.spellList.classKey;
      if (classKey !== undefined) named.push(['class', classKey]);
    }
  }
  if (entity.type === 'subclass') named.push(['class', entity.classKey]);
  if (entity.type === 'skill') stat(entity.ability);
  if (entity.type === 'spell') {
    if (entity.save !== undefined) stat(entity.save);
    for (const damage of entity.damage ?? []) named.push(['damageType', damage.type]);
  }
  if (entity.type === 'item' && entity.weapon !== undefined) {
    if (entity.weapon.damage !== undefined) named.push(['damageType', entity.weapon.damage.type]);
    for (const property of entity.weapon.properties ?? []) named.push(['weaponProperty', property]);
    if (entity.weapon.mastery !== undefined) named.push(['weaponMastery', entity.weapon.mastery]);
  }
  return named.map(([type, key]) => `${type}:${key}`);
}

/** The formulas and the roll formulas an entity holds. */
export function formulasOf(entity: FifthEditionEntity): { formulas: string[]; rolls: string[] } {
  const formulas: string[] = [];
  const rolls: string[] = [];
  for (const effect of entity.effects ?? []) {
    const numeric = ['add', 'mul', 'max', 'min'].includes(effect.op);
    if (numeric && typeof effect.value === 'string') formulas.push(effect.value);
    if (effect.when !== undefined) formulas.push(effect.when);
  }
  for (const grant of grantsOf(entity)) {
    if (grant.kind !== 'resource') continue;
    formulas.push(grant.uses.max);
    for (const { amount } of grant.uses.recovery) if (amount !== 'all') formulas.push(amount);
  }
  for (const prerequisite of prerequisitesOf(entity)) {
    if (prerequisite.kind === 'formula') formulas.push(prerequisite.formula);
  }
  if (entity.type === 'class' || entity.type === 'subclass') {
    const count = entity.spellcasting?.preparedCount;
    if (typeof count === 'string') formulas.push(count);
  }
  if (entity.type === 'item' && entity.weapon !== undefined) {
    if (entity.weapon.damage !== undefined) rolls.push(entity.weapon.damage.formula);
    if (entity.weapon.versatile !== undefined) rolls.push(entity.weapon.versatile);
  }
  if (entity.type === 'spell') {
    rolls.push(...(entity.damage ?? []).map((damage) => damage.formula));
    if (entity.scaling !== undefined) rolls.push(entity.scaling.formula);
  }
  return { formulas, rolls };
}

/** The entity ids a character names: its species, background, classes, items and choices. */
export function idsNamedByCharacter(character: FifthEditionCharacter): string[] {
  const data = character.systemData;
  return [
    ...[data.species, data.background].flatMap((entry) => (entry ? [entry.id] : [])),
    ...data.classes.flatMap((entry) => [entry.id, ...(entry.subclass ? [entry.subclass] : [])]),
    ...data.inventory.flatMap((row) => (row.itemId ? [row.itemId] : [])),
    ...Object.entries(character.choices).flatMap(([part, chosen]) => [
      part.slice(0, part.indexOf('#')),
      ...(chosen ?? []).filter((item) => item.includes(':')),
    ]),
  ];
}

/**
 * The paths the goldens' mechanics read or change that a later ticket's steps give, each from
 * where it starts (ENG-10 §3 item 9): hit points, initiative, armor class, armor worn and speed
 * are ENG-14's, the critical range ENG-16's (SPEC §6.5: a d20's highest face). Chain mail is the
 * armor goldens B, B4 and D wear.
 */
export const STAND_INS: Readonly<Record<string, number>> = {
  'hp.max.bonus': 0,
  'init.bonus': 0,
  'ac.bonus': 0,
  'armor.worn': 1,
  'speed.all.bonus': 0,
  'crit.range': 20,
};

/**
 * ENG-13: fifth edition's module, with `STAND_INS` for the paths it does not give yet. A stand-in
 * for a path the module gives fails the test: the ticket that gives the path removes its stand-in.
 */
export const standingIn: SystemModule<FifthEditionCharacter, FifthEditionEntity> = {
  ...fifthEditionModule,
  derive: (input) => {
    const steps: Record<string, DerivedStep> = { ...fifthEditionModule.derive(input) };
    for (const [path, value] of Object.entries(STAND_INS)) {
      if (path in steps) throw new Error(`The module gives ${path}; remove its stand-in.`);
      steps[path] = () => ({
        value,
        steps: [{ kind: 'rule', rule: 'standIn', value, change: value }],
      });
    }
    return steps;
  },
};
