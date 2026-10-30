// SHEET-30: a number on the sheet. Its value is `Computed`'s at its path, read only as an own field
// (SHEET-33's note); a tap rolls it when it rolls (SHEET-39), and a long press, or the context
// menu, opens its breakdown (SHEET-33, SPEC §7.2). Every number of the header is one of these.
import type { TFunction } from 'i18next';
import { type PointerEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { shownDistance, shownWeight } from '../settings/units';
import { useSettings } from '../settings/useSettings';
import type { AppComputed } from '../systems';
import { useSheet } from './SheetContext';

/** How long a press lasts before it is a long press, in milliseconds. */
export const LONG_PRESS_MS = 500;

/** The number at `path`, or `undefined` when `compute()` gave none there. */
export function numberAt(computed: AppComputed, path: string): number | undefined {
  if (!Object.hasOwn(computed.values, path)) return undefined;
  const value = computed.values[path];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

type SheetT = TFunction<'sheet'>;

/** A number with its sign: "+3", "−1", "+0". */
export function signed(value: number, t: SheetT): string {
  return value < 0 ? t('signed.minus', { value: -value }) : t('signed.plus', { value });
}

/** How a number is written: as it is, with its sign, or as a distance stored in feet (SHEET-50: a weight in pounds). */
export type NumberFormat = 'plain' | 'signed' | 'distance' | 'weight';

export function formatNumber(
  value: number | undefined,
  format: NumberFormat,
  t: SheetT,
  distance: Parameters<typeof shownDistance>[1],
  weight: Parameters<typeof shownWeight>[1] = 'lb',
): string {
  if (value === undefined) return t('noValue');
  if (format === 'signed') return signed(value, t);
  if (format === 'distance') {
    const shown = shownDistance(value, distance);
    return t(`distance.${shown.unit}`, { value: shown.value });
  }
  if (format === 'weight') {
    const shown = shownWeight(value, weight);
    return t(`weight.${shown.unit}`, { value: shown.value });
  }
  return String(value);
}

/** The handlers of a control that a tap and a long press each do something on. */
export function usePress(onTap: (() => void) | undefined, onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const long = useRef(false);
  const stop = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  const press = () => {
    long.current = true;
    stop();
    onLongPress();
  };
  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.button !== 0) return;
      long.current = false;
      stop();
      timer.current = setTimeout(press, LONG_PRESS_MS);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (event: { preventDefault(): void }) => {
      event.preventDefault();
      if (!long.current) press();
    },
    onClick: () => {
      if (long.current) {
        long.current = false;
        return;
      }
      onTap?.();
    },
  };
}

interface SheetNumberProps {
  path: string;
  label: string;
  format?: NumberFormat;
  /** A tap rolls it. */
  rolls?: boolean;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
  /** The label after the value, as the header's row draws it; before it otherwise. */
  labelAfter?: boolean;
}

export function SheetNumber({
  path,
  label,
  format = 'plain',
  rolls = false,
  className,
  valueClassName,
  labelClassName,
  labelAfter = false,
}: SheetNumberProps) {
  const { t } = useTranslation('sheet');
  const { distance, weight } = useSettings();
  const sheet = useSheet();
  const handlers = usePress(rolls ? () => sheet.roll(path) : undefined, () =>
    sheet.breakdown(path),
  );
  const value = formatNumber(numberAt(sheet.computed, path), format, t, distance, weight);
  const name = <span className={labelClassName}>{label}</span>;
  return (
    <button type="button" data-path={path} className={className} {...handlers}>
      {!labelAfter && name}
      <span className={valueClassName}>{value}</span>
      {labelAfter && name}
    </button>
  );
}
