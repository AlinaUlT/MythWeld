import {
  AVERAGE_LIMITS,
  averageOf,
  averageOfDice,
  type DiceTerm,
  type DieSource,
  distributionOfDice,
  evaluateNumber,
  type FormulaReader,
  type ParsedRoll,
  parseRoll,
  rollFormula,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';

// Made-up paths and values (ADR 004 item 4). Every expected average is python3's, with fractions,
// over every outcome of the dice or by a closed form; none comes from this code (ENG-52 §7).
const values: Record<string, unknown> = {
  level: 5,
  'stats.grit.mod': 2,
  'gear.worn': true,
  'gear.shield': false,
  'gear.kind': 'heavy',
};
const read: FormulaReader = (path) => (Object.hasOwn(values, path) ? values[path] : undefined);

// Within 10⁻⁹: `toBeCloseTo(x, 9)` checks |difference| < 5 × 10⁻¹⁰.
const DIGITS = 9;

function parsedRoll(text: string): ParsedRoll {
  const result = parseRoll(text);
  if (!result.ok) throw new Error(`"${text}" did not parse: ${result.error.message}`);
  return result.formula;
}

function termOf(text: string): DiceTerm {
  const { root } = parsedRoll(text);
  if (root.kind !== 'dice') throw new Error(`"${text}" is not one dice term`);
  return root;
}

/**
 * Every outcome of a roll formula, through `rollFormula` with a scripted die: the mean of its
 * values, each weighted by its chance, every path read and every warning met. `undefined` past
 * `most` outcomes. A walk over the faces the die is asked for, so a term in a branch not taken is
 * not rolled, as in a real roll.
 */
function everyRoll(text: string, most = 20_000) {
  const parsed = parseRoll(text);
  const formula = parsed.ok ? parsed.formula : text;
  let outcomes = 0;
  let mean = 0;
  const reads = new Set<string>();
  const warnings = new Set<string>();
  const stack: number[][] = [[]];
  for (let prefix = stack.pop(); prefix !== undefined; prefix = stack.pop()) {
    const asked: number[] = [];
    const faces = prefix;
    const die: DieSource = (sides) => {
      asked.push(sides);
      return faces[asked.length - 1] ?? 1;
    };
    const result = rollFormula(formula, read, die);
    if (asked.length > prefix.length) {
      const sides = asked[prefix.length] as number;
      for (let face = sides; face >= 1; face--) stack.push([...prefix, face]);
      continue;
    }
    outcomes++;
    if (outcomes > most) return undefined;
    mean += asked.reduce((chance, sides) => chance / sides, 1) * result.value;
    for (const path of result.reads) reads.add(path);
    for (const warning of result.warnings) warnings.add(JSON.stringify(warning));
  }
  return { mean, reads, warnings };
}

// python3, fractions, every outcome where there are at most 100,000; `9d20kh1`, `999d1000kh1`,
// `999d1000kl1` and `999d6kh998` by the closed forms of the highest and the lowest die;
// `20d20kh10` by the order statistics.
const TERMS: [string, number][] = [
  ['2d6', 7],
  ['1d20', 10.5],
  ['2d20kh1', 13.825],
  ['2d20kl1', 7.175],
  ['4d6kh3', 15869 / 1296],
  ['4d6kl3', 11347 / 1296],
  ['3d6kh3', 10.5],
  ['5d10kh2', 15.95825],
  ['5d10kl4', 18.70825],
  ['20d20kh10', 152.53571428568807],
  ['9d20kh1', 18.462587343867188],
  ['999d1000', 499999.5],
  ['999d1000kh1', 999.4180987796336],
  ['999d1000kl1', 1.581901220366367],
  ['999d6kh998', 3495.5],
];

// python3, fractions, every outcome. Paths: level 5, stats.grit.mod 2, gear.worn true,
// gear.shield false.
const FORMULAS: [string, number][] = [
  ['1d10 + @level', 10.5],
  ['2d20kh1 + @stats.grit.mod', 15.825],
  ['2к6+3', 10],
  ['-1d4', -2.5],
  ['(2d6) * 2', 14],
  ['1d6 * 1d6', 12.25],
  ['1d6 / 2', 1.75],
  ['12 / 1d6', 4.9],
  ['(1d6 + 1d6) / (1d2)', 5.25],
  ['max(1, 1d6 - 3)', 1.5],
  ['max(1, 1d4 - 3)', 1],
  ['floor(1d6 / 2)', 1.5],
  ['round(1d4 / 2)', 1.5],
  ['clamp(2d6, 4, 10)', 7],
  ['abs(1d6 - 1d6)', 35 / 18],
  ['max(2d20kh1, 1d20)', 15.4875],
  ['max(0, 4d6kh3 - 10)', 3403 / 1296],
  ['min(1d8, 1d8) + 1d4 * 2', 8.1875],
  ['1d20 >= 10', 0.55],
  ['!(1d4 == 1)', 0.75],
  ['1d4 == 1 || 1d4 == 1', 0.4375],
  ['1d6 > 3 && @gear.worn', 0.5],
  ['1d20 >= 11 ? 2d6 : 0', 3.5],
  ['if(1d4 > 2, 1d6, -1d6)', 0],
  ['@gear.worn ? 1d6 : 1d8', 3.5],
  ['@gear.shield ? 1d6 : 1d8 + @level', 9.5],
  ['1d2 == 2 ? @level : @stats.grit.mod', 3.5],
  ['1d20 > 20 ? @level : 1', 1],
];

describe("ENG-52 a roll formula's average", () => {
  it('has a limit on the exact walk', () => {
    expect(AVERAGE_LIMITS).toEqual({ outcomes: 100000 });
  });

  it("gives one term's exact average, kept dice included", () => {
    for (const [text, average] of TERMS) {
      expect(averageOfDice(termOf(text)), text).toBeCloseTo(average, DIGITS);
    }
  });

  it("gives one term's chances in rising order, up to the limit", () => {
    // python3: of the 400 outcomes of 2d20, 39 have a highest die of 20 (400 − 19²) and 1 of 1.
    const advantage = distributionOfDice(termOf('2d20kh1'));
    expect([...(advantage?.keys() ?? [])]).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(advantage?.get(20)).toBeCloseTo(39 / 400, 12);
    expect(advantage?.get(1)).toBeCloseTo(1 / 400, 12);
    const three = [...(distributionOfDice(termOf('3d2')) ?? [])];
    expect(three.map(([total]) => total)).toEqual([3, 4, 5, 6]);
    three.forEach(([, chance], at) => {
      expect(chance).toBeCloseTo([1 / 8, 3 / 8, 3 / 8, 1 / 8][at] as number, 12);
    });
    for (const text of ['2d20kh1', '3d2', '4d6kh3', '6d6kl2', '50d20', '1d1000']) {
      const chances = distributionOfDice(termOf(text));
      if (chances === undefined) throw new Error(`${text} gave no chances`);
      const sum = [...chances.values()].reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1), text).toBeLessThan(1e-12);
      const mean = [...chances].reduce((a, [total, chance]) => a + total * chance, 0);
      expect(mean, text).toBeCloseTo(averageOfDice(termOf(text)), DIGITS);
    }
    // 6^6 = 46,656 outcomes are counted; 6^7 = 279,936 are past the limit.
    expect(distributionOfDice(termOf('6d6kh3'))).toBeDefined();
    expect(distributionOfDice(termOf('7d6kh3'))).toBeUndefined();
    // The second die of 999d1000 would pair 1,000 totals with 1,000 faces.
    expect(distributionOfDice(termOf('999d1000'))).toBeUndefined();
    // With a limit of 36: one die pairs 1 × 6, the second 6 × 6.
    expect(distributionOfDice(termOf('2d6'), 36)?.size).toBe(11);
    expect(distributionOfDice(termOf('2d6'), 35)).toBeUndefined();
  });

  it("gives a formula's exact average", () => {
    for (const [text, average] of FORMULAS) {
      const result = averageOf(text, read);
      expect(result.value, text).toBeCloseTo(average, DIGITS);
      expect(result.warnings, text).toEqual([]);
    }
  });

  it('reads a path when some outcome reads it', () => {
    const readsOf = (text: string) => averageOf(text, read).reads;
    expect(readsOf('@gear.worn ? 1d6 : 1d8')).toEqual(['gear.worn']);
    expect(readsOf('@gear.shield ? 1d6 : 1d8 + @level')).toEqual(['gear.shield', 'level']);
    expect(readsOf('1d2 == 2 ? @level : @stats.grit.mod')).toEqual(['level', 'stats.grit.mod']);
    expect(readsOf('1d20 > 20 ? @level : 1')).toEqual([]);
    expect(averageOf('0 && @level + 1d6', read)).toEqual({ value: 0, reads: [], warnings: [] });
  });

  it('gives each warning some outcome meets, once', () => {
    expect(averageOf('1d6 + @nothing', read)).toMatchObject({
      value: 3.5,
      reads: ['nothing'],
      warnings: [{ code: 'missingPath', path: 'nothing' }],
    });
    const text = averageOf('@gear.kind + 1d4', read);
    expect(text.value).toBe(2.5);
    expect(text.warnings).toHaveLength(1);
    expect(text.warnings).toMatchObject([{ code: 'wrongType', at: 0 }]);
    // `/` at 11 (python3 str.index); each of the six faces divides by 0.
    const division = averageOf('max(0, 1d6 / 0)', read);
    expect(division.value).toBe(0);
    expect(division.warnings).toHaveLength(1);
    expect(division.warnings).toMatchObject([{ code: 'notFinite', at: 11 }]);
  });

  it('gives 0 for a formula that does not parse, and never calls the reader', () => {
    let calls = 0;
    const reader: FormulaReader = (path) => {
      calls++;
      return read(path);
    };
    const parsed = parseRoll('@level + 1d1');
    if (parsed.ok) throw new Error('parsed');
    expect(averageOf('@level + 1d1', reader)).toEqual({
      value: 0,
      reads: [],
      warnings: [parsed.error],
    });
    expect(calls).toBe(0);
  });

  it('falls back past the limit, with a warning, taking back what it read', () => {
    const big = averageOf('max(1, 999d1000)', read);
    expect(big.value).toBe(499999.5);
    expect(big.reads).toEqual([]);
    expect(big.warnings).toHaveLength(1);
    expect(big.warnings).toMatchObject([{ code: 'notExact', at: 0, limit: 100000 }]);
    const kept = averageOf('max(1, 9d20kh1)', read);
    expect(kept.value).toBe(averageOfDice(termOf('9d20kh1')));
    expect(kept.value).toBeCloseTo(18.462587343867188, DIGITS);
    expect(kept.warnings).toMatchObject([{ code: 'notExact', at: 0 }]);
    // The exact walk read @level in the branch 1d2 == 1; the fallback takes the other branch.
    const branch = averageOf('max(0, 1d2 == 1 ? @level : 999d1000)', read);
    expect(branch.value).toBe(499999.5);
    expect(branch.reads).toEqual([]);
    expect(branch.warnings).toMatchObject([{ code: 'notExact', at: 0 }]);
    // Only the part past the limit falls back: `max` at 6 (python3 str.index).
    const part = averageOf('1d6 + max(1, 999d1000)', read);
    expect(part.value).toBe(500003);
    expect(part.warnings).toMatchObject([{ code: 'notExact', at: 6 }]);
    // python3: 12d10 has 109 totals; 12d10 * 12d10 pairs 11,881 and gives 3,788 products, which
    // with a third 12d10 pair 412,892; three arguments of max pair 109³ = 1,295,029. Each term's
    // average is 12 × 5.5 = 66.
    const product = averageOf('max(1, 12d10 * 12d10 * 12d10)', read);
    expect(product.value).toBe(66 ** 3);
    expect(product.warnings).toMatchObject([{ code: 'notExact', at: 0 }]);
    const three = averageOf('max(12d10, 12d10, 12d10)', read);
    expect(three.value).toBe(66);
    expect(three.warnings).toMatchObject([{ code: 'notExact', at: 0 }]);
  });

  it("gives a plain formula's value, and equal results twice", () => {
    const plain = averageOf('@level * 2', read);
    expect(plain).toEqual({ value: 10, reads: ['level'], warnings: [] });
    expect(plain).toEqual(evaluateNumber('@level * 2', read));
    const text = 'max(2d20kh1, 1d20) + @level';
    const formula = parsedRoll(text);
    const first = averageOf(formula, read);
    expect(averageOf(formula, read)).toEqual(first);
    expect(averageOf(text, read)).toEqual(first);
  });

  it('agrees with every roll of each formula', () => {
    for (const [text] of FORMULAS) {
      const rolls = everyRoll(text);
      if (rolls === undefined) throw new Error(`${text} has too many outcomes`);
      const average = averageOf(text, read);
      expect(average.value, text).toBeCloseTo(rolls.mean, DIGITS);
      expect(new Set(average.reads), text).toEqual(rolls.reads);
      expect(new Set(average.warnings.map((w) => JSON.stringify(w))), text).toEqual(rolls.warnings);
    }
  });

  it('agrees with every roll of seeded formulas, and never throws', () => {
    // Seeded, so every run tries the same texts: 2,000 roll formulas built from the language, half
    // of them then damaged by one piece put in or one character taken out, as in ENG-08's run.
    let seed = 52;
    const next = (below: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return Math.floor(seed / 65536) % below;
    };
    const pick = (list: readonly string[]) => list[next(list.length)] as string;
    const small = ['7', '0', '@level', '@gear.worn', '@gear.kind', '@nothing', '1d6', '2к4kh1'];
    const smallDice = ['d3', '3d2kl2', '1d2', '2d3kh1'];
    const large = ['12d10', '999d1000', '7d6kh3', '4d6kh3'];
    const binary = ['+', '-', '*', '/', '<', '>=', '==', '!=', '&&', '||'];
    const build = (leaves: readonly string[], depth: number): string => {
      const inner = () => build(leaves, depth + 1);
      switch (next(depth > 2 ? 1 : 8)) {
        case 0:
          return pick(leaves);
        case 1:
          return `(${inner()})`;
        case 2:
          return `${pick(['-', '!', '+'])}${inner()}`;
        case 3:
          return `${pick(['max', 'min'])}(${inner()}, ${inner()})`;
        case 4:
          return `${pick(['floor', 'abs', 'round', 'ceil'])}(${inner()})`;
        case 5:
          return `clamp(${inner()}, ${inner()}, ${inner()})`;
        case 6:
          return `${inner()} ? ${inner()} : ${inner()}`;
        default:
          return `${inner()} ${pick(binary)} ${inner()}`;
      }
    };
    const pieces = [...'0123456789+-*/()?:,!dк@ ', 'kh', 'kl', 'd20', 'max(', '999d1000'];
    let compared = 0;
    let fellBack = 0;
    for (let i = 0; i < 2000; i++) {
      const leaves = i % 4 === 3 ? [...small, ...large] : [...small, ...smallDice];
      let text = build(leaves, 0);
      if (i % 2 === 1) {
        const at = next(text.length + 1);
        const piece = next(2) === 0 ? pick(pieces) : '';
        text = text.slice(0, at) + piece + text.slice(at + (piece === '' ? 1 : 0));
      }
      const average = averageOf(text, read);
      expect(Number.isFinite(average.value), text).toBe(true);
      if (average.warnings.some((w) => w.code === 'notExact')) {
        fellBack++;
        continue;
      }
      const rolls = everyRoll(text, 500);
      if (rolls === undefined) continue;
      compared++;
      expect(average.value, text).toBeCloseTo(rolls.mean, DIGITS);
      expect(new Set(average.reads), text).toEqual(rolls.reads);
      expect(new Set(average.warnings.map((w) => JSON.stringify(w))), text).toEqual(rolls.warnings);
    }
    expect(compared).toBeGreaterThan(1000);
    expect(fellBack).toBeGreaterThan(0);
  });
});
