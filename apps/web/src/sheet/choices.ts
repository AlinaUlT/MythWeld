// SHEET-36: the rows of "What needs choosing" (SPEC §7.2), read from `Computed`: every pending
// choice of the grants (`pendingChoices`) and every key path not chosen yet (`pendingKeys`, a
// size), each with its options named, and the log entry that stores an answer. Pure: the stamp
// of an entry (its id and time) is the caller's, as for every action (ENG-26).
import {
  changeTo,
  entryOf,
  type LogStamp,
  type PendingChoice,
  type PendingKey,
  STAT_TYPE,
} from '@grimoire/engine';
import type { EntityId, EntityPartId, L10n, LogEntry } from '@grimoire/schema';
import { parseEntityId } from '@grimoire/schema';
import type { FifthEditionEntity } from '@grimoire/system-5e';
import type { SheetValue } from './SheetContext';

/** One thing a person can pick: what is stored, and how it is named. */
export interface ChoiceOption {
  /** What is stored: a key, or an entity id. */
  value: string;
  name: string;
  /** The entry is not in the character's content: the screen says "Missing: <id>". */
  missing: boolean;
}

interface RowBase {
  /** The key the row is listed under: a part id, or a key path. */
  id: string;
  /** The words for what is picked: a `choices.kind` key. */
  what: string;
  /** What is stored now, in the order stored; each is named. */
  chosen: readonly ChoiceOption[];
  options: readonly ChoiceOption[];
}

/** A grant's choice of `count` items: each tap stores at once. */
export interface PickRow extends RowBase {
  kind: 'pick';
  part: EntityPartId;
  /** The entity that gives the choice, named; none when its entry is missing. */
  source: string;
  sourceName: L10n | undefined;
  /** How many more items it asks for. */
  left: number;
  /** What the character stores for it now, if anything. */
  stored: readonly string[] | undefined;
}

/** A stat distribution: its patterns of numbers, and the stats placed in order. */
export interface DistributeRow extends RowBase {
  kind: 'distribute';
  part: EntityPartId;
  source: string;
  sourceName: L10n | undefined;
  patterns: readonly (readonly number[])[];
  stored: readonly string[] | undefined;
}

/** A key path not chosen yet: its options, and where the answer is stored. */
export interface KeyRow extends RowBase {
  kind: 'key';
  path: string;
  /** Where the character stores the answer; none when the module has no place for it. */
  answer: readonly string[] | undefined;
}

export type ChoiceRow = PickRow | DistributeRow | KeyRow;

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
export function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/** A key as words, for an entry the content does not have: `masonsTools` is "Masons tools". */
export function keyWords(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The id of the entity a part id (`<entity id>#<grant id>`) belongs to. */
function ownerOf(part: EntityPartId): EntityId {
  return part.slice(0, part.lastIndexOf('#')) as EntityId;
}

/** The entry of an entity id, named; `missing` when the content does not have it. */
function entityOption(sheet: SheetValue, id: string): ChoiceOption {
  const found = sheet.content.index.get(id);
  return found.ok
    ? { value: id, name: nameIn(found.entity.name), missing: false }
    : { value: id, name: id, missing: true };
}

/** The entry of a key in one of `types`; a key with no entry is named from the key itself. */
function keyOption(sheet: SheetValue, types: readonly string[], key: string): ChoiceOption {
  for (const type of types) {
    const byKey = sheet.computed.byKey[type];
    const entry = byKey !== undefined && Object.hasOwn(byKey, key) ? byKey[key] : undefined;
    if (entry !== undefined) return { value: key, name: nameIn(entry.name), missing: false };
  }
  return { value: key, name: keyWords(key), missing: false };
}

type Grant = PendingChoice<FifthEditionEntity>['grant'];

/** The `choices.kind` key for what a pending grant picks. */
function whatOf(grant: Grant, first: string | undefined): string {
  if (grant.kind === 'proficiency') return grant.category;
  if (grant.kind === 'abilityScore') return 'distribute';
  const choose = 'choose' in grant ? grant.choose : undefined;
  if (choose !== undefined && !Array.isArray(choose.from) && choose.from.type !== undefined) {
    return choose.from.type;
  }
  return (first === undefined ? undefined : parseEntityId(first)?.type) ?? 'entity';
}

function rowOf(sheet: SheetValue, pending: PendingChoice<FifthEditionEntity>): ChoiceRow {
  const { part, grant } = pending;
  const types = grant.kind === 'proficiency' ? sheet.system.keyTypes(grant.category) : [];
  const named = (value: string): ChoiceOption => {
    if (grant.kind === 'abilityScore') return keyOption(sheet, [STAT_TYPE], value);
    return grant.kind === 'proficiency'
      ? keyOption(sheet, types, value)
      : entityOption(sheet, value);
  };
  const owner = sheet.content.index.get(ownerOf(part));
  const base = {
    id: part,
    part,
    source: owner.ok ? nameIn(owner.entity.name) : ownerOf(part),
    sourceName: owner.ok ? owner.entity.name : undefined,
    what: whatOf(grant, pending.options[0]),
    chosen: pending.chosen.map(named),
    options: pending.options.map(named),
    stored: sheet.character.choices[part],
  };
  if (grant.kind === 'abilityScore' && grant.mode === 'distribute') {
    return { ...base, kind: 'distribute', patterns: grant.patterns };
  }
  const asked = 'choose' in grant ? (grant.choose?.count ?? 0) : 0;
  return { ...base, kind: 'pick', left: Math.max(0, asked - pending.chosen.length) };
}

function keyRowOf(sheet: SheetValue, pending: PendingKey): KeyRow {
  const types = sheet.system.keyTypes(pending.path);
  return {
    kind: 'key',
    id: pending.path,
    path: pending.path,
    what: pending.path,
    chosen: [],
    options: pending.options.map((key) => keyOption(sheet, types, key)),
    answer: sheet.system.keyAnswer(pending.path),
  };
}

/** Every pending choice of the character, the grants' first, in the order `compute()` gives. */
export function choiceRows(sheet: SheetValue): ChoiceRow[] {
  return [
    ...sheet.computed.pendingChoices.map((pending) => rowOf(sheet, pending)),
    ...sheet.computed.pendingKeys.map((pending) => keyRowOf(sheet, pending)),
  ];
}

/** The numbers a pattern gives, as the screen writes them: `+2, +1`. */
export function patternWords(pattern: readonly number[]): string {
  return pattern.map((value) => `+${value}`).join(', ');
}

/** Who stamps an entry for the open sheet: the player, with the character's name. */
export function stampFor(sheet: SheetValue, id: string, at: string): LogStamp {
  const { id: actorId, name } = sheet.character;
  return { id, at, by: { role: 'player', name, actorId } };
}

/**
 * The entry that stores `items` as the answer of a grant's choice: the list under
 * `choices[part]`, or no list at all when `items` is empty (a choice emptied is a choice not made).
 */
export function pickEntry(
  sheet: SheetValue,
  row: PickRow | DistributeRow,
  items: readonly string[],
  stamp: LogStamp,
): LogEntry {
  return entryOf(stamp, {
    action: 'setChoice',
    subject: row.part,
    label: row.sourceName,
    changes: [
      changeTo(sheet.character, ['choices', row.part], items.length === 0 ? undefined : [...items]),
    ],
  });
}

/** The entry that stores `key` as the answer of a key path, where its module keeps it. */
export function keyEntry(
  sheet: SheetValue,
  row: KeyRow,
  option: ChoiceOption,
  stamp: LogStamp,
): LogEntry | undefined {
  if (row.answer === undefined) return undefined;
  return entryOf(stamp, {
    action: 'setKey',
    subject: row.path,
    label: { en: option.name },
    changes: [changeTo(sheet.character, row.answer, option.value)],
  });
}
