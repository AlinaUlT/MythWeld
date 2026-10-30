// SHEET-30: the Notes tab's free text. SHEET-54: one text box for each note of SPEC §5.8, saved
// when the person leaves it, as a change with its "Undo" toast (SHEET-23). An empty box removes
// its note: a stored note always shows something (`visibleTextSchema`).
import type { LogEntry } from '@grimoire/schema';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeCharacter } from '../../shared/undo';
import type { AppCharacter } from '../../systems';
import { useSheet } from '../SheetContext';

/** The notes of SPEC §5.8, in the order the tab shows them. */
export const NOTE_KEYS = [
  'appearance',
  'personality',
  'ideals',
  'bonds',
  'flaws',
  'backstory',
  'allies',
  'free',
] as const;

export type NoteKey = (typeof NOTE_KEYS)[number];

/** The note `key` as stored; empty when the character has none. */
export function noteOf(character: AppCharacter, key: NoteKey): string {
  const notes: Readonly<Record<string, string | undefined>> = character.notes;
  return Object.hasOwn(notes, key) ? (notes[key] ?? '') : '';
}

/**
 * The change that makes the note `key` say `text`, or `undefined` when it already does. Text of
 * only spaces removes the note.
 */
export function noteEntry(
  character: AppCharacter,
  key: NoteKey,
  text: string,
  id: string,
  now: string,
): LogEntry | undefined {
  const before = noteOf(character, key);
  const after = /\S/.test(text) ? text : '';
  if (after === before) return undefined;
  return {
    id,
    at: now,
    by: { role: 'player', name: character.name, actorId: character.id },
    action: 'setNote',
    subject: key,
    changes: [
      {
        path: ['notes', key],
        ...(before !== '' && { before }),
        ...(after !== '' && { after }),
      },
    ],
  };
}

function Note({ noteKey, stored }: { noteKey: NoteKey; stored: string }) {
  const { t } = useTranslation('notes');
  const { character } = useSheet();
  const fieldId = useId();
  const [draft, setDraft] = useState(stored);
  const save = () => {
    const entry = noteEntry(
      character,
      noteKey,
      draft,
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    if (entry !== undefined) void changeCharacter(character.id, entry);
  };
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-12 tracking-wide text-muted uppercase">
        {t(`fields.${noteKey}`)}
      </label>
      <textarea
        id={fieldId}
        value={draft}
        rows={noteKey === 'free' ? 8 : 3}
        spellCheck
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        className="w-full rounded-field border border-line bg-surface px-3 py-2 text-16 text-text"
      />
    </div>
  );
}

export function NotesText() {
  const { character } = useSheet();
  return (
    <div className="flex flex-col gap-3.5">
      {NOTE_KEYS.map((key) => {
        const stored = noteOf(character, key);
        // The box starts again from the stored text when it changes, as an undo does.
        return <Note key={`${key}:${stored}`} noteKey={key} stored={stored} />;
      })}
    </div>
  );
}
