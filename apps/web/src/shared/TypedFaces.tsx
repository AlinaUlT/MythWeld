// SHEET-69: the fields of "I roll myself" (SPEC §6.5), one per die of a formula: the dice panel's,
// and the roll dialog's for its d20 and its damage dice. A face outside the die's range is
// refused here, in one place, for every screen that takes typed faces.
import { useTranslation } from 'react-i18next';
import type { DiceField } from './dice';

const field = 'h-control rounded-field border border-line bg-surface px-3 text-16 text-text';

/** Whether `text` is a face of a die of `faces` faces. */
export function isFace(text: string, faces: number): boolean {
  const face = Number(text);
  return text.trim() !== '' && Number.isInteger(face) && face >= 1 && face <= faces;
}

/** Whether every die of `fields` has a face typed, each inside its die's range. */
export function allFaces(fields: readonly DiceField[], typed: readonly string[]): boolean {
  return fields.every(({ faces }, index) => isFace(typed[index] ?? '', faces));
}

/** The faces typed, as numbers, in the fields' order. */
export function typedNumbers(fields: readonly DiceField[], typed: readonly string[]): number[] {
  return fields.map((_, index) => Number(typed[index]));
}

export interface TypedFacesProps {
  fields: readonly DiceField[];
  typed: readonly string[];
  onChange: (typed: string[]) => void;
}

/** One number field per die. It draws nothing for a formula with no dice. */
export function TypedFaces({ fields, typed, onChange }: TypedFacesProps) {
  const { t } = useTranslation('dice');
  if (fields.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-12 font-semibold tracking-wide text-muted uppercase">
        {t('typed')}
      </legend>
      <div className="flex flex-wrap gap-2">
        {fields.map(({ key, term, faces, n }, index) => (
          <input
            key={key}
            type="number"
            inputMode="numeric"
            min={1}
            max={faces}
            aria-label={t('typedDie', { term, n })}
            placeholder={t('die', { faces })}
            value={typed[index] ?? ''}
            aria-invalid={(typed[index] ?? '') !== '' && !isFace(typed[index] ?? '', faces)}
            onChange={(event) => {
              const next = [...typed];
              next[index] = event.target.value;
              onChange(next);
            }}
            className={`${field} w-20 text-center`}
          />
        ))}
      </div>
    </fieldset>
  );
}
