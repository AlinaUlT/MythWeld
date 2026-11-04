// SHEET-80: "Edit" for a custom entry (SHEET-52): a custom item's name, weight and words, or a
// custom feature's name and words, in a form that opens on what the entry says now. A save is one
// change with its "Undo" toast, and the panel closes; a refusal is said in the panel, never thrown.
// The item's count, where it is kept and its switches stay on the Gear tab; the entry's id stays
// (SPEC §5.1). The weight is shown in the person's unit; a weight left as it was shown is kept as
// stored, since a kilogram shows rounded to a tenth.
import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shownWeight, storedWeight } from '../../settings/units';
import { useSettings } from '../../settings/useSettings';
import { BottomSheet } from '../../shared/BottomSheet';
import { typedNumber } from '../../shared/OverrideEditor';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { useSheet } from '../SheetContext';

/** What is edited: a custom item's row, or a custom feature's entity, with the words it has now. */
export type EditTarget =
  | { kind: 'item'; uid: string; name: string; weight: number | undefined; text: string }
  | { kind: 'feature'; id: string; name: string; text: string };

const field = 'h-control w-full bg-surface px-3 text-16 text-text';

/** The weight a text means, above 0; `null` for an empty text (no weight), `undefined` when bad. */
function typedPositive(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const value = typedNumber(text);
  return value !== undefined && value > 0 ? value : undefined;
}

export function EditCustomPanel({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  const { t } = useTranslation('add');
  const { character, system } = useSheet();
  const { weight: unit } = useSettings();
  const id = useId();
  const first =
    target.kind === 'item' && target.weight !== undefined
      ? String(shownWeight(target.weight, unit).value)
      : '';
  const [name, setName] = useState(target.name);
  const [weight, setWeight] = useState(first);
  const [text, setText] = useState(target.text);
  const [refused, setRefused] = useState<string | undefined>(undefined);

  const typedWeight = typedPositive(weight);
  const ready = /\S/.test(name) && (target.kind === 'feature' || typedWeight !== undefined);
  const title = t(`edit.${target.kind}`);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    const made = await perform(character, (stamp) => {
      if (target.kind === 'feature') {
        return system.editCustomFeature(character, { id: target.id, name, text }, stamp);
      }
      const kept = weight === first ? target.weight : undefined;
      const stored =
        typedWeight === null || typedWeight === undefined
          ? undefined
          : (kept ?? storedWeight(typedWeight, unit));
      return system.editCustomItem(
        character,
        { uid: target.uid, name, weight: stored, text },
        stamp,
      );
    }).catch((error: unknown) => {
      console.error(error);
      return undefined;
    });
    if (made?.ok) onClose();
    // Saving what is there already is not an error: the panel just closes.
    else if (made !== undefined && 'code' in made && made.code === 'unchanged') onClose();
    else setRefused(made !== undefined && 'code' in made ? made.code : 'other');
  };

  return (
    <BottomSheet title={title} onClose={onClose}>
      <form className="flex flex-col gap-3 pb-2" onSubmit={submit} aria-label={title}>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="text-13 font-semibold text-muted">
            {t('name')}
          </label>
          <Part
            as="input"
            id={`${id}-name`}
            name="field"
            autoComplete="off"
            className={field}
            value={name}
            onChange={(event: { target: { value: string } }) => setName(event.target.value)}
          />
        </div>
        {target.kind === 'item' && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-weight`} className="text-13 font-semibold text-muted">
              {t('weight', { unit })}
            </label>
            <Part
              as="input"
              id={`${id}-weight`}
              name="field"
              inputMode="decimal"
              autoComplete="off"
              className={field}
              value={weight}
              aria-invalid={typedWeight === undefined}
              onChange={(event: { target: { value: string } }) => setWeight(event.target.value)}
            />
            <p className="text-12 text-muted">{t('weightHint')}</p>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-text`} className="text-13 font-semibold text-muted">
            {t('text')}
          </label>
          <Part
            as="textarea"
            id={`${id}-text`}
            name="field"
            className="min-h-24 w-full resize-y bg-surface p-3 text-16 text-text"
            value={text}
            placeholder={t('textPlaceholder')}
            onChange={(event: { target: { value: string } }) => setText(event.target.value)}
          />
        </div>
        {refused !== undefined && (
          <p className="bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
            {t(`refused.${refused}`, { defaultValue: t('edit.refused') })}
          </p>
        )}
        <div className="flex gap-2">
          <Part
            as="button"
            type="button"
            name="button-secondary"
            className="h-control grow px-4 text-16"
            onClick={onClose}
          >
            {t('edit.cancel')}
          </Part>
          <Part
            as="button"
            type="submit"
            name="button"
            fill="button"
            disabled={!ready}
            className="h-control grow px-4 text-16 font-bold text-on-strong"
          >
            {t('edit.save')}
          </Part>
        </div>
      </form>
    </BottomSheet>
  );
}
