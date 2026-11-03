// SHEET-54: the Notes tab's free text, plain text kept in `notes.free` (SPEC §5.8). The text is
// saved as one change when the field loses focus, not on each key, so one Undo reverses a whole
// writing. Text with no visible character is not stored: the note is removed. Notes are written in
// play mode too; they are the person's words, not a number the rules compute.
import type { LogEntry } from '@grimoire/schema';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeCharacter } from '../../shared/undo';
import type { AppCharacter } from '../../systems';
import { Part } from '../../theme/Part';
import { playerEntry } from '../changes';
import { useSheet } from '../SheetContext';

/** The key of the note this tab keeps. */
export const FREE_NOTE = 'free';

/**
 * The change that makes the stored note `text`; none when it already is. Text with no visible
 * character is no note: the key is removed.
 */
export function noteEntry(
  character: AppCharacter,
  text: string,
  now?: string,
): LogEntry | undefined {
  const stored = character.notes[FREE_NOTE];
  const after = /\S/.test(text) ? text : undefined;
  if (after === stored) return undefined;
  return playerEntry(
    character,
    'setNote',
    FREE_NOTE,
    [
      {
        path: ['notes', FREE_NOTE],
        ...(stored !== undefined && { before: stored }),
        ...(after !== undefined && { after }),
      },
    ],
    now,
  );
}

export function NotesText() {
  const { t } = useTranslation('notes');
  const { character } = useSheet();
  const id = useId();
  const stored = character.notes[FREE_NOTE];
  // A new stored text (an Undo) redraws the field with it.
  const [draft, setDraft] = useState(stored ?? '');
  const [seen, setSeen] = useState(stored);
  if (seen !== stored) {
    setSeen(stored);
    setDraft(stored ?? '');
  }

  const save = () => {
    const entry = noteEntry(character, draft);
    if (entry !== undefined) {
      changeCharacter(character.id, entry).catch((error: unknown) => console.error(error));
    }
  };

  return (
    <section className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-13 font-semibold text-muted">
        {t('label')}
      </label>
      <Part
        as="textarea"
        id={id}
        name="field"
        className="min-h-64 w-full resize-y bg-surface p-3 text-16 text-text"
        value={draft}
        placeholder={t('placeholder')}
        onChange={(event: { target: { value: string } }) => setDraft(event.target.value)}
        onBlur={save}
      />
    </section>
  );
}
