import type { CharacterSection } from '@grimoire/schema';
import { type Applied, applyEntry, copyJson, type JsonValue, sameJson } from './log';
import { type ActionResult, changeTo, entryOf, type LogStamp } from './trackers';

// SHEET-57: the actions on a character's own lists (ADR 009 item 8, SPEC §5.8): a section is a
// named list, each entry a name and free text, and a companion with its small stat block is such
// an entry. Every system has them, so they live in the core. Like the overrides, the list is
// written as a whole: a log path steps only through objects (ENG-63). The ids are made by the app:
// the engine has no random source. Nothing here reads a rule; text is text.

/** The character, as these actions read and write it. */
export interface SectionedCharacter {
  readonly sections: readonly CharacterSection[];
}

/** Why a section action was refused. `code` and its data are for the screen. */
export type SectionRefusal = { message: string } & (
  | { code: 'noName' }
  | { code: 'idUsed'; id: string }
  | { code: 'noSection'; id: string }
  | { code: 'noEntry'; section: string; id: string }
  | { code: 'unchanged' }
);

/** The path of the lists. */
const SECTIONS_PATH = ['sections'] as const;

/** Text that shows a character, trimmed; none when it shows nothing. */
function visible(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/** The lists as the one change of an entry of `action`, applied. */
function written<C extends SectionedCharacter>(
  character: C,
  stamp: LogStamp,
  action: string,
  subject: string,
  name: string,
  after: readonly CharacterSection[],
): ActionResult<C, SectionRefusal> {
  const change = changeTo(character, SECTIONS_PATH, copyJson(after) as JsonValue);
  if (sameJson(change.before, change.after)) {
    return { ok: false, code: 'unchanged', message: `${action} changes nothing.` };
  }
  const entry = entryOf(stamp, { action, subject, label: { en: name }, changes: [change] });
  const applied: Applied<C> = applyEntry(character, entry);
  return applied.ok ? { ok: true, character: applied.character, entry } : applied;
}

/** Whether a section or entry id is taken, anywhere in the lists (ids never repeat). */
function taken(character: SectionedCharacter, id: string): boolean {
  return character.sections.some(
    (section) => section.id === id || section.entries.some((entry) => entry.id === id),
  );
}

/** A new section at the end: an empty list with a name. `ask.id` is made by the app. */
export function addSection<C extends SectionedCharacter>(
  character: C,
  ask: { id: string; name: string },
  stamp: LogStamp,
): ActionResult<C, SectionRefusal> {
  const name = visible(ask.name);
  if (name === undefined) {
    return { ok: false, code: 'noName', message: 'A section needs a name.' };
  }
  if (taken(character, ask.id)) {
    return { ok: false, code: 'idUsed', id: ask.id, message: `"${ask.id}" is used already.` };
  }
  const after = [...character.sections, { id: ask.id, name, entries: [] }];
  return written(character, stamp, 'addSection', ask.id, name, after);
}

/** Takes a section away with its entries. */
export function removeSection<C extends SectionedCharacter>(
  character: C,
  ask: { id: string },
  stamp: LogStamp,
): ActionResult<C, SectionRefusal> {
  const found = character.sections.find((section) => section.id === ask.id);
  if (found === undefined) {
    return {
      ok: false,
      code: 'noSection',
      id: ask.id,
      message: `No section has the id "${ask.id}".`,
    };
  }
  const after = character.sections.filter((section) => section.id !== ask.id);
  return written(character, stamp, 'removeSection', ask.id, found.name, after);
}

/** A new entry at the end of a section: a name and free text. `ask.id` is made by the app. */
export function addSectionEntry<C extends SectionedCharacter>(
  character: C,
  ask: { section: string; id: string; name: string; text?: string | undefined },
  stamp: LogStamp,
): ActionResult<C, SectionRefusal> {
  const found = character.sections.find((section) => section.id === ask.section);
  if (found === undefined) {
    return {
      ok: false,
      code: 'noSection',
      id: ask.section,
      message: `No section has the id "${ask.section}".`,
    };
  }
  const name = visible(ask.name);
  if (name === undefined) {
    return { ok: false, code: 'noName', message: 'An entry needs a name.' };
  }
  if (taken(character, ask.id)) {
    return { ok: false, code: 'idUsed', id: ask.id, message: `"${ask.id}" is used already.` };
  }
  const text = visible(ask.text);
  const entry = { id: ask.id, name, ...(text !== undefined && { text }) };
  const after = character.sections.map((section) =>
    section.id === ask.section ? { ...section, entries: [...section.entries, entry] } : section,
  );
  return written(character, stamp, 'addEntry', ask.id, name, after);
}

/** Takes an entry away from its section. */
export function removeSectionEntry<C extends SectionedCharacter>(
  character: C,
  ask: { section: string; id: string },
  stamp: LogStamp,
): ActionResult<C, SectionRefusal> {
  const found = character.sections.find((section) => section.id === ask.section);
  if (found === undefined) {
    return {
      ok: false,
      code: 'noSection',
      id: ask.section,
      message: `No section has the id "${ask.section}".`,
    };
  }
  const entry = found.entries.find((each) => each.id === ask.id);
  if (entry === undefined) {
    return {
      ok: false,
      code: 'noEntry',
      section: ask.section,
      id: ask.id,
      message: `The section has no entry "${ask.id}".`,
    };
  }
  const after = character.sections.map((section) =>
    section.id === ask.section
      ? { ...section, entries: section.entries.filter((each) => each.id !== ask.id) }
      : section,
  );
  return written(character, stamp, 'removeEntry', ask.id, entry.name, after);
}
