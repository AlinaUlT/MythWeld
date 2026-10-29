// SHEET-27: what the manual form holds while the person types (SPEC §7.4, BRIEF P3), and the ask it
// gives its system's maker. Nothing typed is ever dropped by another field: a pick that a pack, a
// rules base or the mix switch no longer offers stays, and its step warns (SPEC §8.2). A score
// field that holds no whole number counts as `UNTYPED_SCORE` until it does, and says so.
import {
  type CharacterCore,
  type Computed,
  type ContentIndex,
  keyFinderOf,
  keysOfTypeOf,
  STAT_TYPE,
  shareRuleset,
} from '@grimoire/engine';
import type { EntityId, L10n } from '@grimoire/schema';
import type { AppEntity, InstalledPack } from '../../content/packs';
import type { AppRuleset, ManualCharacterAsk, ManualFormSystem } from '../../systems';

/** What each step of the form is given. */
export interface StepProps {
  draft: Draft;
  /** Changes the form: `next` takes the form as it is now. */
  change: (next: (draft: Draft) => Draft) => void;
  form: ManualFormSystem;
  installed: readonly InstalledPack[];
  /** The entries of the ticked packs. */
  entities: readonly AppEntity[];
  computed: Computed<AppEntity>;
  stats: readonly FormStat[];
}

/** A class the form names: its id, its level and, when picked, its subclass. */
export interface DraftClass {
  id: EntityId;
  level: number;
  subclass?: EntityId;
}

/** The form as the person left it. */
export interface Draft {
  system: string;
  ruleset: AppRuleset;
  /** The active packs, in the order the device lists them. */
  packs: readonly string[];
  /** "Mix editions": the character may take content of the other edition. */
  mix: boolean;
  name: string;
  species?: EntityId;
  background?: EntityId;
  classes: readonly DraftClass[];
  /** Stat key → the text in its field. */
  scores: Readonly<Record<string, string>>;
}

/** What a score field counts as while it holds no whole number: the field's starting text. */
export const UNTYPED_SCORE = 10;

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
export function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/** The ids of the packs that hold content for `ruleset`, in the device's order. */
export function packsFor(ruleset: string, installed: readonly InstalledPack[]): string[] {
  return installed
    .filter(({ pack }) => shareRuleset(pack.ruleset, ruleset))
    .map(({ pack }) => pack.id);
}

/** A new form: the system's newest rules base, with its packs, mixing off, nothing else picked. */
export function newDraft(form: ManualFormSystem, installed: readonly InstalledPack[]): Draft {
  const ruleset = form.rulesets[form.rulesets.length - 1] ?? form.rulesets[0];
  if (ruleset === undefined) throw new Error(`The system "${form.system}" has no rules base.`);
  return {
    system: form.system,
    ruleset,
    packs: packsFor(ruleset, installed),
    mix: false,
    name: '',
    classes: [],
    scores: {},
  };
}

/** The form on another rules base; without mixing, its packs become that rules base's. */
export function withRuleset(
  draft: Draft,
  ruleset: AppRuleset,
  installed: readonly InstalledPack[],
): Draft {
  return draft.mix
    ? { ...draft, ruleset }
    : { ...draft, ruleset, packs: packsFor(ruleset, installed) };
}

/** The form with `pack` on or off, the packs kept in the device's order. */
export function withPack(
  draft: Draft,
  pack: string,
  on: boolean,
  installed: readonly InstalledPack[],
): Draft {
  const packs = installed
    .map((each) => each.pack.id)
    .filter((id) => (id === pack ? on : draft.packs.includes(id)));
  return { ...draft, packs };
}

/** The entries of `type` the form offers: its rules base's, or every edition's when it mixes. */
export function optionsOf(
  entities: readonly AppEntity[],
  type: AppEntity['type'],
  draft: Pick<Draft, 'ruleset' | 'mix'>,
): AppEntity[] {
  return entities
    .filter((entity) => entity.type === type)
    .filter((entity) => draft.mix || shareRuleset(entity.ruleset, draft.ruleset))
    .sort((a, b) => nameIn(a.name).localeCompare(nameIn(b.name)) || a.id.localeCompare(b.id));
}

/** The subclasses the form offers for the class `classId`: those naming its key. */
export function subclassOptionsOf(
  entities: readonly AppEntity[],
  classId: string,
  draft: Pick<Draft, 'ruleset' | 'mix'>,
): AppEntity[] {
  const found = entities.find((entity) => entity.id === classId);
  if (found?.type !== 'class') return [];
  return optionsOf(entities, 'subclass', draft).filter(
    (entity) => entity.type === 'subclass' && entity.classKey === found.key,
  );
}

/** The levels the form adds up: no more than `maxLevel` in all. */
export function levelsLeft(classes: readonly DraftClass[], maxLevel: number): number {
  return maxLevel - classes.reduce((sum, entry) => sum + entry.level, 0);
}

/** A stat the form asks a score for: its key and its entry. */
export interface FormStat {
  key: string;
  entity: AppEntity;
}

/**
 * The stats a character of this form has, in their entries' order (D3): each stat key the packs
 * hold, found as the engine finds it (its rules base's entry, else any when it mixes).
 */
export function statsOf(
  index: ContentIndex<AppEntity>,
  draft: Pick<Draft, 'ruleset' | 'mix'>,
): FormStat[] {
  const core: CharacterCore<AppEntity> = {
    ruleset: draft.ruleset,
    allowMixedRulesets: draft.mix,
    abilities: { base: {} },
    choices: {},
    state: { conditions: [], toggles: {} },
    overrides: [],
    localEntities: [],
  };
  const findKey = keyFinderOf(core, index);
  return keysOfTypeOf(
    core,
    index,
    findKey,
  )(STAT_TYPE)
    .flatMap((key) => {
      const entity = findKey(STAT_TYPE, key);
      return entity?.type === 'ability' ? [{ key, entity, order: entity.order }] : [];
    })
    .sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ key, entity }) => ({ key, entity }));
}

/** The whole number a score field holds, or `undefined` while it holds none. */
export function typedScore(text: string | undefined): number | undefined {
  if (text === undefined) return undefined;
  const trimmed = text.trim();
  return /^[-−]?\d{1,4}$/.test(trimmed) ? Number(trimmed.replace('−', '-')) : undefined;
}

/** The score the form counts for `key`. */
export function scoreOf(draft: Pick<Draft, 'scores'>, key: string): number {
  return typedScore(draft.scores[key]) ?? UNTYPED_SCORE;
}

/**
 * What the form asks its system's maker for. `stats` are the keys the character has; `unnamed`
 * is the name a character gets when the field is left empty, so nothing blocks "Create".
 */
export function askOf(
  draft: Draft,
  stats: readonly string[],
  made: { id: string; at: string; unnamed: string },
): ManualCharacterAsk {
  const name = draft.name.trim();
  return {
    id: made.id,
    at: made.at,
    ruleset: draft.ruleset,
    allowMixedRulesets: draft.mix,
    name: name === '' ? made.unnamed : name,
    packs: draft.packs,
    ...(draft.species !== undefined && { species: draft.species }),
    ...(draft.background !== undefined && { background: draft.background }),
    classes: draft.classes.map(({ id, level, subclass }) => ({
      id,
      level,
      ...(subclass !== undefined && { subclass }),
    })),
    scores: Object.fromEntries(stats.map((key) => [key, scoreOf(draft, key)])),
  };
}
