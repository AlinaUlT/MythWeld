// SHEET-30: the sheet's dock, pinned at the bottom near the thumb (board V3-Sheet, BRIEF P4): the
// hit point bar with temporary hit points in their own colour, as a number and a part of the bar
// (ADR 013 item 1, board V3-TempHP); Damage and Heal; under them the tabs, scrolled sideways. A long
// press on the hit points opens the maximum's breakdown. The dock writes its height into
// `--dock-height` on the page's root, so the toast (SHEET-23) and the dice button sit above it.
import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';
import type { NumberPadMode } from './panels/NumberPad';
import { useSheet } from './SheetContext';
import { numberAt, usePress } from './SheetNumber';
import { SHEET_TABS, type SheetTabId } from './tabs';

/** The CSS variable that holds the dock's height while the sheet is open. */
export const DOCK_HEIGHT_VAR = '--dock-height';

/** The share of the bar, in percent, that the hit points and the temporary ones each fill. */
export function barShares(current: number, max: number, temp: number) {
  const whole = Math.max(max, current) + temp;
  if (whole <= 0) return { hp: 0, temp: 0 };
  return { hp: (current / whole) * 100, temp: (temp / whole) * 100 };
}

function HitPoints() {
  const { t } = useTranslation('sheet');
  const sheet = useSheet();
  const { current, temp, maxPath } = sheet.system.hitPoints(sheet.character);
  const max = numberAt(sheet.computed, maxPath);
  const shares = barShares(current, max ?? 0, temp);
  const press = usePress(undefined, () => sheet.breakdown(maxPath));
  return (
    <button
      type="button"
      data-path={maxPath}
      aria-label={t('hp.summary', { current, max: max ?? t('noValue'), temp })}
      className="min-w-0 grow text-left select-none"
      {...press}
    >
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-12 tracking-wide text-muted uppercase">{t('hp.label')}</span>
        <span className="flex items-baseline gap-1 text-18 font-bold whitespace-nowrap">
          {current}
          <span className="text-13 font-medium text-muted">
            {t('hp.max', { value: max ?? t('noValue') })}
          </span>
          {temp > 0 && <span className="text-temp">{t('hp.temp', { value: temp })}</span>}
        </span>
      </span>
      <span className="flex h-2 overflow-hidden rounded-pill bg-track">
        <span className="bg-hp" style={{ width: `${shares.hp}%` }} />
        <span className="bg-temp" style={{ width: `${shares.temp}%` }} />
      </span>
    </button>
  );
}

interface DockProps {
  tab: SheetTabId;
  onTab: (tab: SheetTabId) => void;
  onNumberPad: (mode: NumberPadMode) => void;
}

export function SheetDock({ tab, onTab, onNumberPad }: DockProps) {
  const { t } = useTranslation('sheet');
  const dock = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = dock.current;
    if (element === null) return;
    const root = document.documentElement;
    const write = () => root.style.setProperty(DOCK_HEIGHT_VAR, `${element.offsetHeight}px`);
    write();
    const observer = new ResizeObserver(write);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(DOCK_HEIGHT_VAR);
    };
  }, []);

  // Arrow keys move along the tabs, as a tab list does.
  const step = (by: number) => {
    const at = SHEET_TABS.findIndex(({ id }) => id === tab);
    const next = SHEET_TABS[(at + by + SHEET_TABS.length) % SHEET_TABS.length];
    if (next === undefined) return;
    onTab(next.id);
    document.getElementById(`sheet-tab-${next.id}`)?.focus();
  };

  return (
    <div ref={dock} className="shrink-0">
      <Slot name="dock" className="border-t border-line">
        <div className="flex h-16 items-center gap-2 pr-3 pl-4">
          <HitPoints />
          <Part
            as="button"
            type="button"
            name="button"
            fill="button"
            onClick={() => onNumberPad('damage')}
            className="flex h-11 shrink-0 items-center px-3.5 font-semibold text-on-strong"
          >
            {t('damage')}
          </Part>
          <Part
            as="button"
            type="button"
            name="button-secondary"
            onClick={() => onNumberPad('heal')}
            className="flex h-11 shrink-0 items-center px-3.5 font-semibold"
          >
            {t('heal')}
          </Part>
        </div>
        <div
          role="tablist"
          aria-label={t('tabs.label')}
          className="flex overflow-x-auto border-t border-line px-1.5"
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') step(1);
            else if (event.key === 'ArrowLeft') step(-1);
            else return;
            event.preventDefault();
          }}
        >
          {SHEET_TABS.map(({ id }) => {
            const selected = id === tab;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`sheet-tab-${id}`}
                aria-selected={selected}
                aria-controls="sheet-tab-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => onTab(id)}
                className={`flex h-12 shrink-0 items-center border-b-2 px-2.5 whitespace-nowrap ${
                  selected ? 'border-strong font-bold text-text' : 'border-transparent text-muted'
                }`}
              >
                {t(`tabs.${id}`)}
              </button>
            );
          })}
        </div>
      </Slot>
    </div>
  );
}
