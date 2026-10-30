// SHEET-36: the choices list's model (SPEC §7.2, "What needs choosing"): every choice the character
// has not made, as one `Ask` whatever made it: a grant's pending choice (`Computed.pendingChoices`)
// or a key path not chosen (`Computed.pendingKeys`). An answer is a change to the stored
// character, built as every other change is (`entryOf`, `changeTo`), so it is undone by the toast.
// A grant's answer is its list in `choices`, in the order picked; a key path's goes where its
// system says (fifth edition's size: `systemData.species.size`).
import { changeTo, entryOf, patternOf } from '@grimoire/engine';
import type { L10n, LogEntry } from '@grimoire/schema';
import type { AppCharacter, AppComputed, SheetSystem } from '../../systems';

/** Where an answer is stored. */
export type AskPlace = { kind: 'choice'; part: string } | { kind: 'key'; place: readonly string[] };

/** One choice to make. */
export interface Ask {
  /** The grant's part id, or the key path: what the row is keyed by. */
  id: string;
  place: AskPlace;
  /** The word for what is chosen, a key of `choices:what`; `other` when the locale has none. */
  what: string;
  /** The entity that asks, when one does. */
  source: string | undefined;
  /** How many must be picked; for a distribution, the most any of its patterns takes. */
  max: number;
  /** What is stored of the answer, in the order picked. */
  chosen: readonly string[];
  /** What may still be picked: an entity id, or a key of `type`. */
  options: readonly string[];
  /** Whether `options` are keys, named by the entries of `type`, and not entity ids. */
  keyed: boolean;
  /** The entity type the keys are entries of, when the system knows it. */
  type: string | undefined;
  /** A distribution's numbers, one list per way of placing them; the i-th pick gets the i-th. */
  patterns: readonly (readonly number[])[] | undefined;
  /** How many more picks an answer needs, when fewer options than that can be offered. */
  short: number;
}

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
export function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/** The entity id of the part `part` (`<entityId>#<grantId>`). */
function sourceOf(part: string): string {
  return part.slice(0, part.lastIndexOf('#'));
}

/**
 * Every choice the character has not made: the grants' first, in the order gathering met them,
 * then the key paths. `typeOfEntity` names the type of an entity id the content knows, for
 * the word of an entity grant ("feat").
 */
export function asksOf(
  computed: AppComputed,
  system: Pick<SheetSystem, 'optionType' | 'pendingKeys'>,
  typeOfEntity: (id: string) => string | undefined,
): Ask[] {
  const grants = computed.pendingChoices.map(({ part, grant, chosen, options }): Ask => {
    const patterns = 'patterns' in grant ? grant.patterns : undefined;
    const max =
      patterns !== undefined
        ? Math.max(...patterns.map((pattern) => pattern.length))
        : (('choose' in grant ? grant.choose?.count : undefined) ?? chosen.length + options.length);
    const first = options[0];
    const what =
      grant.kind === 'proficiency'
        ? grant.category
        : grant.kind === 'abilityScore'
          ? grant.kind
          : (first !== undefined && typeOfEntity(first)) || 'other';
    return {
      id: part,
      place: { kind: 'choice', part },
      what,
      source: sourceOf(part),
      max,
      chosen,
      options,
      keyed: grant.kind === 'proficiency' || grant.kind === 'abilityScore',
      type: system.optionType(grant),
      patterns,
      short: Math.max(0, max - chosen.length - options.length),
    };
  });
  const keys = computed.pendingKeys.map(({ path, options }): Ask => {
    const answer = Object.hasOwn(system.pendingKeys, path) ? system.pendingKeys[path] : undefined;
    return {
      id: path,
      // A key path this system cannot answer is listed, and has nowhere to be stored.
      place: { kind: 'key', place: answer?.place ?? [] },
      what: path,
      source: undefined,
      max: 1,
      chosen: [],
      options,
      keyed: true,
      type: answer?.type,
      patterns: undefined,
      short: Math.max(0, 1 - options.length),
    };
  });
  return [...grants, ...keys];
}

/** What the person can tap: what is stored of the answer, then what may still be picked. */
export function offeredOf(ask: Ask): string[] {
  return [...ask.chosen, ...ask.options.filter((option) => !ask.chosen.includes(option))];
}

/**
 * `picks` with `option` toggled: taken out when picked, put last when not, and ignored when
 * `max` are picked already. When only one can be picked, the option replaces the pick.
 */
export function toggled(ask: Ask, picks: readonly string[], option: string): string[] {
  if (picks.includes(option)) return picks.filter((pick) => pick !== option);
  if (ask.max === 1) return [option];
  return picks.length < ask.max ? [...picks, option] : [...picks];
}

/** Whether `picks` answer the ask: as many as it needs, or as many as one of its patterns has. */
export function answers(ask: Ask, picks: readonly string[]): boolean {
  if (ask.patterns !== undefined) return patternOf({ patterns: ask.patterns }, picks) !== undefined;
  return picks.length === ask.max;
}

/** The number each pick gets from the distribution, in the order picked; none for another ask. */
export function placed(ask: Ask, picks: readonly string[]): readonly number[] {
  if (ask.patterns === undefined) return [];
  return patternOf({ patterns: ask.patterns }, picks) ?? [];
}

/** Why an ask cannot be answered here: its key path has no place to be stored in this system. */
export function storable(ask: Ask): boolean {
  return ask.place.kind === 'choice' || ask.place.place.length > 0;
}

/** The change that answers `ask` with `picks`, for the stored character as `character`. */
export function answerEntry(
  character: AppCharacter,
  ask: Ask,
  picks: readonly string[],
  stamp: { id: string; at: string },
): LogEntry {
  const path = ask.place.kind === 'choice' ? ['choices', ask.place.part] : ask.place.place;
  const after = ask.place.kind === 'choice' ? [...picks] : picks[0];
  return entryOf(
    {
      ...stamp,
      by: { role: 'player', name: character.name, actorId: character.id },
    },
    {
      action: 'makeChoice',
      subject: ask.id,
      changes: [changeTo(character, path, after)],
    },
  );
}

/** A key as words, for an option the content has no entry for: `smithsTools` is "Smiths tools". */
export function wordsOf(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
