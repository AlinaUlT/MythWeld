// SHEET-79: where a skill's stat comes from (SPEC §6.1 step 7, ENG-43), opened from the skill's
// breakdown. It lists the steps that chose the stat (the skill's own, an effect's, a manual edit),
// and in edit mode a "Set by hand" form: the stat to take, from the stats the sheet has, and a
// note, saved as one change with its "Undo" toast (`setKeyOverride`); a button takes the edit
// away (`clearOverride`). As a number's override, it wins over every rule, and play mode locks it.
import { clearOverride, setKeyOverride } from '@grimoire/engine';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { perform } from '../sheet/changes';
import { nameIn } from '../sheet/names';
import { useSheet } from '../sheet/SheetContext';
import { Part } from '../theme/Part';
import { BottomSheet } from './BottomSheet';

export interface KeyBreakdownSheetProps {
  /** The key path: `skills.<key>.ability`. */
  path: string;
  /** What the stat is the stat of: the skill's name. */
  name: string;
  onClose: () => void;
}

export function KeyBreakdownSheet({ path, name, onClose }: KeyBreakdownSheetProps) {
  const { t } = useTranslation('breakdown');
  const { character, computed, editing, system } = useSheet();
  const id = useId();
  const stats = system.checks(computed).stats;
  const held = Object.hasOwn(computed.keys, path) ? computed.keys[path] : undefined;
  const stored = character.overrides.find((each) => each.path === path);
  const statName = (key: string) => {
    const found = stats.find((each) => each.key === key);
    return found === undefined ? key : nameIn(found.name);
  };
  const [pick, setPick] = useState(held?.key ?? '');
  const [note, setNote] = useState(stored?.note ?? '');
  const changed =
    held !== undefined &&
    (pick !== held.key || stored === undefined || note.trim() !== (stored.note ?? ''));

  const run = (action: Parameters<typeof perform>[1]) =>
    perform(character, action).catch((error: unknown) => console.error(error));

  return (
    <BottomSheet title={t('key.title')} onClose={onClose}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-17 font-bold" data-testid="key-summary">
          {held === undefined
            ? t('key.none')
            : t('key.summary', { name, stat: statName(held.key) })}
        </p>
        {held !== undefined && (
          <ul className="flex flex-col divide-y divide-line">
            {held.steps.map((step, at) => (
              // A key's steps are a fixed list, so a step's place is its key.
              // biome-ignore lint/suspicious/noArrayIndexKey: the list never changes order.
              <li key={at} className="flex flex-col gap-0.5 py-2">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-15 text-text">
                    {step.kind === 'override' ? t('manual') : nameIn(step.label)}
                  </span>
                  <span className="text-15 font-bold">{statName(step.key)}</span>
                </span>
                {step.kind === 'override' && (
                  <Part
                    as="span"
                    name="chip"
                    className="w-fit bg-warn-bg px-2 text-12 text-warn-text"
                    data-manual
                  >
                    {t('key.manualHint')}
                  </Part>
                )}
                {step.kind === 'override' && step.note !== undefined && (
                  <span className="text-13 text-muted">{step.note}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {held !== undefined &&
          (!editing ? (
            <p className="pb-2 text-13 text-muted" data-testid="override-locked">
              {t('key.locked')}
            </p>
          ) : (
            <form
              className="flex flex-col gap-2 border-t border-line pt-3 pb-2"
              aria-label={t('key.form')}
              onSubmit={(event) => {
                event.preventDefault();
                if (!changed) return;
                run((stamp) =>
                  setKeyOverride(
                    character,
                    computed,
                    { path, key: pick, keys: stats.map((each) => each.key), note },
                    stamp,
                  ),
                );
              }}
            >
              <h3 className="text-15 font-bold">{t('key.form')}</h3>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-stat`} className="text-13 font-semibold text-muted">
                  {t('key.stat')}
                </label>
                <Part
                  as="select"
                  id={`${id}-stat`}
                  name="field"
                  className="h-control w-full bg-surface px-3 text-16 text-text"
                  value={pick}
                  onChange={(event: { target: { value: string } }) => setPick(event.target.value)}
                >
                  {stats.map((each) => (
                    <option key={each.key} value={each.key}>
                      {nameIn(each.name)}
                    </option>
                  ))}
                </Part>
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
                  placeholder={t('key.notePlaceholder')}
                  onChange={(event: { target: { value: string } }) => setNote(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Part
                  as="button"
                  type="submit"
                  name="button"
                  fill="button"
                  disabled={!changed}
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
          ))}
      </div>
    </BottomSheet>
  );
}
