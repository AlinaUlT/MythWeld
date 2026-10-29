// SHEET-54: the Notes tab's free text (SPEC §5.8 `notes`, plain text): one box for each key the
// SPEC lists. A box saves when it loses focus, as one change (`setNote`) with its "Undo" toast. A
// box emptied removes its key, because a stored note always shows something. Notes are written in
// play mode too: they are not a number, and the SPEC calls the tab plain text (§7.2).
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeCharacter } from '../../shared/undo';
import { Part } from '../../theme/Part';
import { useSheet } from '../SheetContext';

/** The keys of `notes` the tab offers, in the order SPEC §5.8 lists them. */
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

/** What a box holds becomes the stored text: none when it shows nothing. */
export function storedNote(text: string): string | undefined {
  return /\S/.test(text) ? text : undefined;
}

function NoteBox({ noteKey }: { noteKey: (typeof NOTE_KEYS)[number] }) {
  const { t } = useTranslation('notes');
  const { character } = useSheet();
  const stored = character.notes[noteKey];
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const id = useId();
  const shown = draft ?? stored ?? '';
  const label = t(`keys.${noteKey}`);

  const save = () => {
    const text = draft;
    setDraft(undefined);
    if (text === undefined) return;
    const after = storedNote(text);
    if (after === stored) return;
    void changeCharacter(character.id, {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      by: { role: 'player', name: character.player ?? character.name },
      action: 'setNote',
      subject: noteKey,
      label: { en: label },
      changes: [{ path: ['notes', noteKey], before: stored, after }],
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-13 font-semibold text-muted">
        {label}
      </label>
      <Part
        as="textarea"
        id={id}
        name="field"
        rows={4}
        value={shown}
        onChange={(event: { target: { value: string } }) => setDraft(event.target.value)}
        onBlur={save}
        className="w-full resize-y bg-surface px-3 py-2 text-16 text-text"
      />
    </div>
  );
}

export function NotesText() {
  return (
    <div className="flex flex-col gap-3.5" data-section="notes">
      {NOTE_KEYS.map((key) => (
        <NoteBox key={key} noteKey={key} />
      ))}
    </div>
  );
}
