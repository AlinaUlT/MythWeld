// SHEET-30: a stored distance, always in feet (SPEC §7.5), as the person's `distance` setting shows
// it. A metre is shown at the table's rate, 5 feet to 1.5 m (30 ft is 9 m), rounded to a tenth.
// SHEET-68: a square is 5 feet (SRD 5.2.1, "Playing on a Grid"); a part of a square left over is
// dropped, as Speed is moved in whole 5-foot squares.
import type { Settings } from './settings';

/** Metres shown for one foot: 1.5 m for every 5 feet. */
export const METRES_PER_FOOT = 0.3;

/** Feet in one square of a grid. */
export const FEET_PER_SQUARE = 5;

/** A distance in the unit it is shown in. */
export interface ShownDistance {
  value: number;
  unit: Settings['distance'];
}

/** `feet` in the shown unit; feet stay as they are. */
export function shownDistance(feet: number, unit: Settings['distance']): ShownDistance {
  if (unit === 'm') return { value: Math.round(feet * METRES_PER_FOOT * 10) / 10, unit: 'm' };
  if (unit === 'sq') return { value: Math.floor(feet / FEET_PER_SQUARE), unit: 'sq' };
  return { value: feet, unit: 'ft' };
}
