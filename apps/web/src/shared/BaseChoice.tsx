// SHEET-35: "Base calculation" (ENG-47, SPEC §6.1 step 5), under the breakdown of a number whose
// base can be worked out more than one way (armor class): each calculation that applies now, worked
// out (SHEET-21's `Computed.candidates`), and "Highest", which takes the pin away. A pick is one
// change with its "Undo" toast (the module's `baseChoice.pin`). Which calculation counts is the
// sheet's structure, so it is picked in edit mode only (SPEC §7.2), as a manual edit is.
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { stepLabel } from '../sheet/breakdown';
import { perform } from '../sheet/changes';
import { useSheet } from '../sheet/SheetContext';
import { Part } from '../theme/Part';

export function BaseChoice({ path }: { path: string }) {
  const { t } = useTranslation('breakdown');
  const { character, computed, editing, system } = useSheet();
  const { paths, pinned, pin } = system.baseChoice;
  const where = Object.hasOwn(paths, path) ? paths[path] : undefined;
  const candidates =
    where !== undefined && Object.hasOwn(computed.candidates, where)
      ? computed.candidates[where]
      : undefined;
  const held = pinned(character);
  if (candidates === undefined || (candidates.length < 2 && held === undefined)) return null;
  const counts = held !== undefined && candidates.some(({ key }) => key === held);

  const pick = (calc: string | undefined) =>
    perform(character, (stamp) => pin(character, { calc }, stamp)).catch((error: unknown) =>
      console.error(error),
    );
  const row = (key: string | undefined, label: string, value: string | undefined) => {
    const on = key === undefined ? !counts : key === held;
    return (
      <Part
        key={key ?? 'highest'}
        as="button"
        type="button"
        role="radio"
        name="button-secondary"
        aria-checked={on}
        disabled={!editing}
        onClick={() => void pick(key)}
        className={`flex min-h-control items-center gap-3 px-3 text-left text-15 ${on ? 'bg-soft font-bold' : ''}`}
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          {on && <Check aria-hidden className="size-5" />}
        </span>
        <span className="grow">{label}</span>
        {value !== undefined && <span className="font-bold">{value}</span>}
      </Part>
    );
  };

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3" data-testid="base-choice">
      <h3 className="text-15 font-bold">{t('base.title')}</h3>
      <div role="radiogroup" aria-label={t('base.title')} className="flex flex-col gap-1.5">
        {row(undefined, t('base.highest'), undefined)}
        {candidates.map(({ key, value, steps }) => {
          const first = steps[0];
          const label = first === undefined ? key : stepLabel(computed, system, first, t);
          return row(key, label, String(value));
        })}
      </div>
      {held !== undefined && !counts && (
        <p className="text-13 text-warn-text" data-testid="base-not-applying">
          {t('base.notApplying')}
        </p>
      )}
      {!editing && (
        <p className="text-13 text-muted" data-testid="base-locked">
          {t('base.locked')}
        </p>
      )}
    </section>
  );
}
