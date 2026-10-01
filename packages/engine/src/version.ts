import { versionSchema } from '@grimoire/schema';

// Semver 2.0.0 precedence (its item 11), for a dependency's lowest version (ENG-05). The numbers
// are compared as text, by length and then by digit: a semver number has no leading zero, so a
// version of any length compares right.

const DIGITS = /^\d+$/;

/** -1, 0 or 1, as `a` is below, equal to or above `b` in plain text order. */
function byText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Compares two whole numbers written without leading zeros. */
function byNumber(a: string, b: string): number {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return byText(a, b);
}

/** Compares two pre-release identifiers: digits by number, below any with a letter or hyphen. */
function byIdentifier(a: string, b: string): number {
  const aDigits = DIGITS.test(a);
  const bDigits = DIGITS.test(b);
  if (aDigits && bDigits) return byNumber(a, b);
  if (aDigits !== bDigits) return aDigits ? -1 : 1;
  return byText(a, b);
}

/** Major, minor and patch, and the pre-release identifiers. Throws on a text that is not semver. */
function partsOf(version: string): { numbers: string[]; preRelease: string[] } {
  if (!versionSchema.safeParse(version).success) {
    throw new Error(`"${version}" is not a semver version.`);
  }
  const dash = version.indexOf('-');
  const numbers = (dash === -1 ? version : version.slice(0, dash)).split('.');
  const preRelease = dash === -1 ? [] : version.slice(dash + 1).split('.');
  return { numbers, preRelease };
}

/**
 * -1, 0 or 1, as version `a` is below, equal to or above version `b` by semver 2.0.0 precedence.
 * Throws when either is not a version `versionSchema` takes.
 */
export function compareVersions(a: string, b: string): number {
  const x = partsOf(a);
  const y = partsOf(b);
  for (const [index, number] of x.numbers.entries()) {
    const order = byNumber(number, y.numbers[index] as string);
    if (order !== 0) return order;
  }
  // A version without pre-release identifiers is above one with them.
  if (x.preRelease.length === 0 || y.preRelease.length === 0) {
    return Math.sign(y.preRelease.length - x.preRelease.length);
  }
  for (const [index, identifier] of x.preRelease.entries()) {
    const other = y.preRelease[index];
    if (other === undefined) return 1;
    const order = byIdentifier(identifier, other);
    if (order !== 0) return order;
  }
  return x.preRelease.length < y.preRelease.length ? -1 : 0;
}
