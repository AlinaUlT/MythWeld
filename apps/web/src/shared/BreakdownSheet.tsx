// SHEET-33: a number's breakdown (SPEC §7.2, BRIEF P5 sheet 2, board V3-Roll): "Where this number
// comes from". The summary line reads "Athletics +5 = Strength +3, Proficiency bonus +2"; below it,
// one line for each part with its source, a manual edit labelled "Manual edit". The sheet mounts it
// on a number's long press with that number's computed path and its format, so the number reads as
// it did on the sheet. Missing is not broken: a path that has no steps says so. SHEET-34: under the
// lines, the number's "Override by hand" form (`OverrideEditor`). SHEET-35: above it, a number with
// several base calculations (AC) offers them to pick from (`BaseChoice`).
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/useSettings';
import { breakdownOf } from '../sheet/breakdown';
import { useSheet } from '../sheet/SheetContext';
import { formatNumber, type NumberFormat } from '../sheet/SheetNumber';
import { Part } from '../theme/Part';
import { BaseChoice } from './BaseChoice';
import { BottomSheet } from './BottomSheet';
import { OverrideEditor } from './OverrideEditor';

export interface BreakdownSheetProps {
  path: string;
  format?: NumberFormat;
  onClose: () => void;
}

export function BreakdownSheet({ path, format = 'plain', onClose }: BreakdownSheetProps) {
  const { t } = useTranslation('breakdown');
  const { t: ts } = useTranslation('sheet');
  const { distance } = useSettings();
  const { computed, system } = useSheet();
  const view = breakdownOf(computed, system, path, t);
  const shown = (change: number, first: boolean) =>
    formatNumber(change, format === 'plain' && !first ? 'signed' : format, ts, distance);
  const total = formatNumber(view.total, format, ts, distance);
  return (
    <BottomSheet title={t('title')} onClose={onClose}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-17 font-bold" data-testid="breakdown-summary">
          {view.lines.length === 0
            ? t('summaryNone', { name: view.name, total })
            : t('summary', {
                name: view.name,
                total,
                parts: view.lines
                  .map((line) => `${line.label} ${shown(line.change, line.first)}`)
                  .join(t('separator')),
              })}
        </p>
        {view.lines.length === 0 ? (
          <p className="text-14 text-muted">{t('none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {view.lines.map((line, at) => (
              // A breakdown is a fixed list of steps, so a step's place is its key.
              // biome-ignore lint/suspicious/noArrayIndexKey: the list never changes order.
              <li key={at} className="flex flex-col gap-0.5 py-2">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-15 text-text">{line.label}</span>
                  <span className="text-15 font-bold">{shown(line.change, line.first)}</span>
                </span>
                {line.manual && (
                  <Part
                    as="span"
                    name="chip"
                    className="w-fit bg-warn-bg px-2 text-12 text-warn-text"
                    data-manual
                  >
                    {t('manualHint')}
                  </Part>
                )}
                {line.note !== undefined && <span className="text-13 text-muted">{line.note}</span>}
              </li>
            ))}
          </ul>
        )}
        <BaseChoice path={path} />
        <OverrideEditor path={path} distance={format === 'distance'} />
      </div>
    </BottomSheet>
  );
}
