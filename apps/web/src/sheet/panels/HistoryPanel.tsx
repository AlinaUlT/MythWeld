// SHEET-59: "Change history" (SPEC §7.2: the last 50 states, ADR 013 item 2: undo any change),
// opened from the sheet's "⋯" menu. The changes the history keeps for the character, newest first,
// each named as its toast names it, with the time it was made and an "Undo" of its own. The
// stored history is watched, so a change or an undo shows at once. An undo reverses that one
// change only where the character still holds what the change wrote. Where a later change wrote
// over the same place, the row says so and its "Undo" is off: the later change is undone first.
// Nothing is overwritten, and no change is lost. (ADR 002: the engine's `reverseEntry` refuses a
// place that moved on, and the panel asks it before it offers the button.)
import { reverseEntry } from '@grimoire/engine';
import type { LogEntry } from '@grimoire/schema';
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type History, readHistory, undoChange } from '../../db/history';
import { BottomSheet } from '../../shared/BottomSheet';
import { doneKeyOf, nameOf } from '../../shared/ToastHost';
import { Part } from '../../theme/Part';
import { useSheet } from '../SheetContext';
import type { PanelProps } from './panel';

/** The time a change was made, in the person's language: the day and the hour and minute. */
function timeOf(at: string, language: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime())
    ? at
    : date.toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
}

/** The history as the panel draws it, with what undoing a change does. */
export function HistoryList({
  history,
  onUndo,
  refusedId,
}: {
  history: History | undefined;
  onUndo: (entry: LogEntry) => void;
  /** The change whose undo was refused when it was tried, if any. */
  refusedId?: string | undefined;
}) {
  const { t } = useTranslation('actions');
  const { t: tt, i18n } = useTranslation('toast');
  const { character } = useSheet();
  if (history === undefined)
    return <p className="py-2 text-15 text-muted">{t('historyLoading')}</p>;
  if (history.entries.length === 0 && history.refused.length === 0) {
    return <p className="py-2 text-15 text-muted">{t('historyNone')}</p>;
  }
  return (
    <div className="flex flex-col gap-2 pb-2">
      <p className="text-13 text-muted">{t('historyNote', { count: history.entries.length })}</p>
      <ul className="flex flex-col divide-y divide-line" data-testid="history">
        {history.entries.map((entry) => {
          const text = tt(`done.${doneKeyOf(entry.action)}`, {
            name: nameOf(entry, i18n.language),
          });
          const possible = reverseEntry(character, entry).ok;
          return (
            <li key={entry.id} data-change={entry.id} className="flex items-center gap-2 py-2">
              <span className="flex min-w-0 grow flex-col">
                <span className="text-15 text-text">{text}</span>
                <span className="text-12 text-muted">{timeOf(entry.at, i18n.language)}</span>
                {(!possible || refusedId === entry.id) && (
                  <span className="text-12 text-warn-text" role="note">
                    {t('historyBlocked')}
                  </span>
                )}
              </span>
              <Part
                as="button"
                type="button"
                name="button-secondary"
                disabled={!possible}
                aria-label={t('historyUndo', { text })}
                onClick={() => onUndo(entry)}
                className="flex h-control shrink-0 items-center px-4 text-14 font-semibold"
              >
                {tt('undo')}
              </Part>
            </li>
          );
        })}
        {history.refused.map((each) => (
          <li key={each.id} className="py-2 text-14 text-muted">
            {t('historyRefused')}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HistoryPanel({ onClose }: PanelProps) {
  const { t } = useTranslation('actions');
  const { character } = useSheet();
  const [history, setHistory] = useState<History | undefined>(undefined);
  const [refusedId, setRefusedId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const watching = liveQuery(() => readHistory(character.id)).subscribe({
      next: setHistory,
      error: (error: unknown) => console.error(error),
    });
    return () => watching.unsubscribe();
  }, [character.id]);

  const undo = (entry: LogEntry) => {
    setRefusedId(undefined);
    undoChange(entry.id).then(
      (result) => {
        if (!result.ok) setRefusedId(entry.id);
      },
      (error: unknown) => console.error(error),
    );
  };

  return (
    <BottomSheet title={t('history')} onClose={onClose}>
      <HistoryList history={history} onUndo={undo} refusedId={refusedId} />
    </BottomSheet>
  );
}
