// SHEET-34: "Override by hand" (SPEC §6.1 step 7, BRIEF P5 sheet 2): under a number's breakdown, a
// field for the number the person wants there and a note, saved as one change with its "Undo"
// toast (`setOverride`, the core's action), and a button that takes the edit away (`clearOverride`).
// The edit always wins over every rule, and the breakdown then shows it as "Manual edit". A manual
// edit changes the sheet's structure, so it is made in edit mode only (SPEC §7.2: play mode locks
// the structure); play mode says so. The number must be one `compute()` gave and one an edit can
// apply to; the engine refuses the rest, and this form does not offer them.
import { clearOverride, LEVEL_PATH, setOverride } from '@grimoire/engine';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { perform } from '../sheet/changes';
import { useSheet } from '../sheet/SheetContext';
import { numberAt } from '../sheet/SheetNumber';
import { Part } from '../theme/Part';

/** A number as a person types it: digits with one optional point and a sign (a minus sign too). */
const TYPED = /^[-−+]?\d+(\.\d+)?$/;

/** The number a text means, or `undefined` when it is not one. */
export function typedNumber(text: string): number | undefined {
  const trimmed = text.trim();
  return TYPED.test(trimmed) ? Number(trimmed.replace('−', '-')) : undefined;
}

export interface OverrideEditorProps {
  path: string;
  /** The number is a distance, stored in feet. */
  distance?: boolean;
}

export function OverrideEditor({ path, distance = false }: OverrideEditorProps) {
  const { t } = useTranslation('breakdown');
  const { character, computed, editing } = useSheet();
  const total = numberAt(computed, path);
  const stored = character.overrides.find((each) => each.path === path);
  if (total === undefined || path === LEVEL_PATH) return null;
  if (!editing) {
    return (
      <p className="pb-2 text-13 text-muted" data-testid="override-locked">
        {t('override.locked')}
      </p>
    );
  }
  // A new stored edit (a save, an Undo) draws the form again with it.
  return (
    <Form
      key={JSON.stringify(stored ?? null)}
      path={path}
      total={total}
      stored={stored}
      distance={distance}
    />
  );
}

interface FormProps extends OverrideEditorProps {
  total: number;
  stored: { value: number | boolean | string; note?: string } | undefined;
}

function Form({ path, total, stored, distance }: FormProps) {
  const { t } = useTranslation('breakdown');
  const { character, computed } = useSheet();
  const id = useId();
  const held = typeof stored?.value === 'number' ? stored.value : undefined;
  const [text, setText] = useState(String(held ?? total));
  const [note, setNote] = useState(stored?.note ?? '');
  const value = typedNumber(text);
  const changed = held === undefined || value !== held || note.trim() !== (stored?.note ?? '');

  const run = (action: Parameters<typeof perform>[1]) =>
    perform(character, action).catch((error: unknown) => console.error(error));

  return (
    <form
      className="flex flex-col gap-2 border-t border-line pt-3 pb-2"
      aria-label={t('override.title')}
      onSubmit={(event) => {
        event.preventDefault();
        if (value === undefined) return;
        run((stamp) => setOverride(character, computed, { path, value, note }, stamp));
      }}
    >
      <h3 className="text-15 font-bold">{t('override.title')}</h3>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-value`} className="text-13 font-semibold text-muted">
          {t('override.value')}
        </label>
        <Part
          as="input"
          id={`${id}-value`}
          name="field"
          inputMode="decimal"
          autoComplete="off"
          className="h-control w-full bg-surface px-3 text-16 text-text"
          value={text}
          aria-invalid={text !== '' && value === undefined}
          onChange={(event: { target: { value: string } }) => setText(event.target.value)}
        />
        {distance && <p className="text-12 text-muted">{t('override.feet')}</p>}
        {text.trim() !== '' && value === undefined && (
          <p className="text-12 text-warn-text" role="alert">
            {t('override.notANumber')}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-note`} className="text-13 font-semibold text-muted">
          {t('override.note')}
        </label>
        <Part
          as="input"
          id={`${id}-note`}
          name="field"
          autoComplete="off"
          className="h-control w-full bg-surface px-3 text-16 text-text"
          value={note}
          placeholder={t('override.notePlaceholder')}
          onChange={(event: { target: { value: string } }) => setNote(event.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Part
          as="button"
          type="submit"
          name="button"
          fill="button"
          disabled={value === undefined || !changed}
          className="h-control grow px-4 text-16 font-bold text-on-strong"
        >
          {t('override.save')}
        </Part>
        {stored !== undefined && (
          <Part
            as="button"
            type="button"
            name="button-secondary"
            className="h-control grow px-4 text-16"
            onClick={() => run((stamp) => clearOverride(character, path, stamp))}
          >
            {t('override.remove')}
          </Part>
        )}
      </div>
    </form>
  );
}
