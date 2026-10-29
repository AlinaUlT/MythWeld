// SHEET-33: a number's breakdown (BRIEF P5 sheet 2, board `V3-Roll`): "Where this number comes
// from", one line per step of `Computed.breakdown`, each naming its source, and a "Manual edit"
// label when a manual edit decided the number (SPEC §6.1 step 7, §7.2). The sheet mounts it on a
// number's long press, with that number's computed path (SHEET-30). The override field is SHEET-34.
import { X } from 'lucide-react';
import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../settings/useSettings';
import { useSheet } from '../sheet/SheetContext';
import { formatNumber, type NumberFormat } from '../sheet/SheetNumber';
import { Part } from '../theme/Part';
import { breakdownOf } from './breakdown';

export interface BreakdownSheetProps {
  path: string;
  onClose: () => void;
}

export function BreakdownSheet({ path, onClose }: BreakdownSheetProps) {
  const { t } = useTranslation('breakdown');
  const { t: sheetT } = useTranslation('sheet');
  const { distance } = useSettings();
  const { computed, system } = useSheet();
  const titleId = useId();
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const { name, value, lines, manual } = breakdownOf(computed, path, t);
  // The number is written as the sheet writes it; each line moves it by a signed amount, in feet
  // for a distance (SPEC §7.5).
  const shown: NumberFormat = system.numbers.find((each) => each.path === path)?.format ?? 'plain';
  const total = formatNumber(value, shown, sheetT, distance);
  const amount = (change: number) =>
    formatNumber(change, shown === 'distance' ? 'distance' : 'signed', sheetT, distance);

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t('close')}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-scrim"
      />
      <Part
        name="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-path={path}
        className="relative flex max-h-[80dvh] flex-col bg-surface pb-3"
      >
        <header className="flex shrink-0 items-center gap-1 py-2 pl-5">
          <h2 id={titleId} className="grow font-heading text-24 font-bold">
            {t('title')}
          </h2>
          <Part
            as="button"
            type="button"
            name="icon-button"
            aria-label={t('close')}
            onClick={onClose}
            className="mr-1 flex size-control shrink-0 items-center justify-center text-text"
          >
            <X aria-hidden className="size-[22px]" />
          </Part>
        </header>
        <p className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pb-2">
          <span className="text-18 font-semibold">{name}</span>
          <span className="text-18 font-semibold" data-testid="breakdown-total">
            {total}
          </span>
          {manual && (
            <Part name="chip" className="px-2.5 py-0.5 text-12 font-semibold text-muted">
              {t('manual')}
            </Part>
          )}
        </p>
        <div className="min-h-0 grow overflow-y-auto">
          {lines.length === 0 ? (
            <p className="px-5 py-2 text-15 text-muted">{t('empty')}</p>
          ) : (
            <ul>
              {lines.map((line, at) => (
                <li
                  // The steps are in the order they were taken, and none is dropped or moved.
                  // biome-ignore lint/suspicious/noArrayIndexKey: the list never changes order.
                  key={at}
                  data-manual={line.manual || undefined}
                  className="flex items-baseline gap-3 border-t border-line px-5 py-2.5"
                >
                  <span className="flex min-w-0 grow flex-col">
                    <span className="text-15 font-semibold">{line.name}</span>
                    {line.detail !== undefined && (
                      <span className="text-14 break-words text-muted">{line.detail}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-15 font-semibold">{amount(line.change)}</span>
                </li>
              ))}
              <li className="flex items-baseline gap-3 border-t border-line px-5 py-2.5">
                <span className="grow text-15 font-semibold">{t('total')}</span>
                <span className="shrink-0 text-15 font-semibold">{total}</span>
              </li>
            </ul>
          )}
        </div>
      </Part>
    </div>
  );
}
