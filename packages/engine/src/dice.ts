// ENG-08: the engine has no randomness of its own. A roll takes its numbers from a source the
// caller passes in (the app's is `crypto.getRandomValues`), and a die keeps only the numbers below
// the largest multiple of its faces, so no face gains from a remainder (ADR 014 item 11). Lint
// refuses `Math.random` here. A dice term is parsed and walked in formula.ts.

/** How many dice one term may roll, and how many faces a die may have. */
export const DICE_LIMITS = {
  count: { min: 1, max: 999 },
  faces: { min: 2, max: 1000 },
} as const;

/** Which dice a term keeps: the highest or the lowest `count` of them. */
export interface DiceKeep {
  readonly which: 'highest' | 'lowest';
  readonly count: number;
}

/** What one dice term rolls: `count` dice of `faces` faces, all kept or only some. */
export interface DiceTerm {
  readonly count: number;
  readonly faces: number;
  readonly keep?: DiceKeep;
}

/** A whole number from 0 to 2^32 − 1, every one equally likely. */
export type RandomSource = () => number;

/** A face of a die of `faces` faces: a whole number from 1 to `faces`. */
export type DieSource = (faces: number) => number;

/** One term rolled: each die's face in the order rolled, which were kept, and their sum. */
export interface RolledDice {
  results: number[];
  kept: boolean[];
  total: number;
  /** How many dice gave no face (counted as 0). */
  badFaces: number;
}

const RANGE = 2 ** 32;
const BATCH = 256;
// A working source draws again 16 times in a row less than once in 10^100 rolls; a broken one
// must not hang the roll.
const DRAWS = 16;

/**
 * A random source over the platform's `fill`, such as `(a) => crypto.getRandomValues(a)`,
 * which it asks for 256 numbers at a time.
 */
export function randomSourceOf(fill: (into: Uint32Array) => unknown): RandomSource {
  const batch = new Uint32Array(BATCH);
  let next = BATCH;
  return () => {
    if (next === BATCH) {
      fill(batch);
      next = 0;
    }
    return batch[next++] as number;
  };
}

/**
 * A fair die over `random`: a number is kept only below the largest multiple of the faces that
 * fits in 2^32, so each face has exactly as many numbers. After 16 numbers in a row that are not
 * kept, the die gives 0, which is no face, and the roll warns.
 */
export function fairDie(random: RandomSource): DieSource {
  return (faces) => {
    const below = RANGE - (RANGE % faces);
    for (let draw = 0; draw < DRAWS; draw++) {
      const number = random();
      if (Number.isInteger(number) && number >= 0 && number < below) return (number % faces) + 1;
    }
    return 0;
  };
}

/**
 * Rolls one term with `die`. A face that is not a whole number from 1 to the faces counts as 0.
 * `kh` and `kl` keep by value; between equal faces the earlier die is kept.
 */
export function rollDice(term: DiceTerm, die: DieSource): RolledDice {
  let badFaces = 0;
  const results = Array.from({ length: term.count }, () => {
    const face = die(term.faces);
    if (Number.isInteger(face) && face >= 1 && face <= term.faces) return face;
    badFaces++;
    return 0;
  });
  let kept = results.map(() => true);
  if (term.keep !== undefined) {
    const sign = term.keep.which === 'highest' ? -1 : 1;
    const order = results
      .map((_, index) => index)
      .sort((a, b) => sign * ((results[a] as number) - (results[b] as number)) || a - b);
    const keep = new Set(order.slice(0, term.keep.count));
    kept = results.map((_, index) => keep.has(index));
  }
  const total = results.reduce((sum, face, index) => (kept[index] ? sum + face : sum), 0);
  return { results, kept, total, badFaces };
}

/** How many outcomes one step of an exact average may pair: past it, the average falls back. */
export const AVERAGE_LIMITS = { outcomes: 100_000 } as const;

/**
 * One term's exact average. The sum of the `k` highest dice is the sum, over each face `x`, of
 * how many kept dice show `x` or more: `min(k, N)`, where `N`, the dice at `x` or more, is a
 * binomial count. The lowest `k` are the mirror: `k × (faces + 1)` less the highest `k`.
 */
export function averageOfDice({ count, faces, keep }: DiceTerm): number {
  if (keep === undefined) return (count * (faces + 1)) / 2;
  const highest = highestSum(count, faces, keep.count);
  return keep.which === 'highest' ? highest : keep.count * (faces + 1) - highest;
}

/** The average sum of the `kept` highest of `count` dice of `faces` faces. */
function highestSum(count: number, faces: number, kept: number): number {
  // Past half the dice, the dropped ones are counted instead: the highest `kept` are all the dice
  // less the lowest `count - kept`.
  if (kept * 2 > count) {
    const dropped = count - kept;
    return (count * (faces + 1)) / 2 - dropped * (faces + 1) + highestSum(count, faces, dropped);
  }
  let sum = 0;
  for (let face = 1; face <= faces; face++) {
    sum += averageAtMost(kept, count, (faces - face + 1) / faces);
  }
  return sum;
}

/** `E[min(kept, N)]` for `N` a binomial count of `count` tries, each a success with `chance`. */
function averageAtMost(kept: number, count: number, chance: number): number {
  if (chance === 1) return kept;
  // The chance of exactly `j` successes, from j = 0 up, in logs so 999 tries neither overflow nor
  // underflow on the way.
  const odds = Math.log(chance) - Math.log1p(-chance);
  let logOf = count * Math.log1p(-chance);
  let short = 0;
  for (let j = 0; j < kept; j++) {
    short += (kept - j) * Math.exp(logOf);
    logOf += Math.log((count - j) / (j + 1)) + odds;
  }
  return kept - short;
}

/**
 * How likely each total of one term is, in rising order of totals. A term with no keep adds one
 * die at a time; a term that keeps counts every outcome. `undefined` when a step would pair more
 * than `limit` totals with faces, or a term that keeps has more than `limit` outcomes.
 */
export function distributionOfDice(
  term: DiceTerm,
  limit: number = AVERAGE_LIMITS.outcomes,
): ReadonlyMap<number, number> | undefined {
  const { count, faces, keep } = term;
  if (keep === undefined) {
    // chances[i] is the chance of the total `i + dice so far`.
    let chances = [1];
    for (let die = 0; die < count; die++) {
      if (chances.length * faces > limit) return undefined;
      const next = new Array<number>(chances.length + faces - 1).fill(0);
      chances.forEach((chance, at) => {
        for (let face = 0; face < faces; face++) {
          next[at + face] = (next[at + face] as number) + chance / faces;
        }
      });
      chances = next;
    }
    return new Map(chances.map((chance, at) => [at + count, chance]));
  }
  const outcomes = faces ** count;
  if (outcomes > limit) return undefined;
  const counts = new Map<number, number>();
  const results = new Array<number>(count).fill(1);
  const order =
    keep.which === 'highest' ? (a: number, b: number) => b - a : (a: number, b: number) => a - b;
  for (let outcome = 0; outcome < outcomes; outcome++) {
    const total = [...results]
      .sort(order)
      .slice(0, keep.count)
      .reduce((sum, face) => sum + face, 0);
    counts.set(total, (counts.get(total) ?? 0) + 1);
    // The next outcome, as an odometer turns.
    for (let die = 0; die < count; die++) {
      if ((results[die] as number) < faces) {
        results[die] = (results[die] as number) + 1;
        break;
      }
      results[die] = 1;
    }
  }
  return new Map(
    [...counts].sort(([a], [b]) => a - b).map(([total, times]) => [total, times / outcomes]),
  );
}
