// SHEET-30: a stored distance, always in feet (SPEC §7.5), as the person's `distance` setting shows
// it. A metre is shown at the table's rate, 5 feet to 1.5 m (30 ft is 9 m), rounded to a tenth.
// SHEET-68: a square is 5 feet (SRD 5.2.1, "Playing on a Grid"); a part of a square left over is
// dropped, as Speed is moved in whole 5-foot squares.
// SHEET-50: a stored weight, always in pounds (SPEC §7.5), as the person's `weight` setting shows
// it. A kilogram is shown at the physical rate, rounded to a tenth; a weight is no rule's number.
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

/** Kilograms in one pound. */
export const KILOGRAMS_PER_POUND = 0.45359237;

/** A weight in the unit it is shown in. */
export interface ShownWeight {
  value: number;
  unit: Settings['weight'];
}

/** `pounds` in the shown unit; pounds are rounded to a hundredth, kilograms to a tenth. */
export function shownWeight(pounds: number, unit: Settings['weight']): ShownWeight {
  if (unit === 'kg') return { value: Math.round(pounds * KILOGRAMS_PER_POUND * 10) / 10, unit };
  return { value: Math.round(pounds * 100) / 100, unit };
}
