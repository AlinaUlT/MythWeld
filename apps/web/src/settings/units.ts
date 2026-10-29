// SHEET-30: a stored distance, always in feet (SPEC §7.5), as the person's `distance` setting shows
// it. A metre is shown at the table's rate, 5 feet to 1.5 m (30 ft is 9 m), rounded to a tenth.
import type { Settings } from './settings';

/** Metres shown for one foot: 1.5 m for every 5 feet. */
export const METRES_PER_FOOT = 0.3;

/** A distance in the unit it is shown in. */
export interface ShownDistance {
  value: number;
  unit: 'ft' | 'm';
}

/** `feet` in the shown unit; feet stay as they are. */
export function shownDistance(feet: number, unit: Settings['distance']): ShownDistance {
  if (unit === 'm') return { value: Math.round(feet * METRES_PER_FOOT * 10) / 10, unit: 'm' };
  return { value: feet, unit: 'ft' };
}
