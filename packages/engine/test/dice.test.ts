import { getRandomValues } from 'node:crypto';
import {
  DICE_LIMITS,
  type DiceRoll,
  type DieSource,
  evaluateFormula,
  type FormulaError,
  type FormulaReader,
  fairDie,
  type ParsedRoll,
  parseFormula,
  parseRoll,
  type RandomSource,
  type RollNode,
  randomSourceOf,
  rollFormula,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';

// Made-up paths and values (ADR 004 item 4). The expected values were computed with python3 from
// each formula's text and the scripted faces, and the chi-square thresholds with scipy, not by
// this code (ENG-08 §7).
const values: Record<string, unknown> = {
  level: 5,
  'stats.grit.mod': 2,
  'gear.worn': true,
  'gear.shield': false,
  'gear.kind': 'heavy',
};
const read: FormulaReader = (path) => (Object.hasOwn(values, path) ? values[path] : undefined);

/** A die that gives `faces` in order and records the faces it was asked for. */
function script(...faces: number[]) {
  const asked: number[] = [];
  const die: DieSource = (sides) => {
    asked.push(sides);
    return faces[asked.length - 1] ?? 1;
  };
  return { die, asked };
}

/** A random source that gives `numbers` in order and counts its draws. */
function numbers(...list: number[]) {
  let draws = 0;
  const random: RandomSource = () => list[draws++] ?? 0;
  return { random, draws: () => draws };
}

function parsedRoll(text: string): ParsedRoll {
  const result = parseRoll(text);
  if (!result.ok) throw new Error(`"${text}" did not parse: ${result.error.message}`);
  return result.formula;
}

function rollErrorOf(text: string): FormulaError {
  const result = parseRoll(text);
  if (result.ok) throw new Error(`"${text}" parsed`);
  return result.error;
}

function formulaErrorOf(text: string): FormulaError {
  const result = parseFormula(text);
  if (result.ok) throw new Error(`"${text}" parsed`);
  return result.error;
}

/** Every node of a roll formula's tree, the root first. */
function nodesOf(node: RollNode): RollNode[] {
  switch (node.kind) {
    case 'literal':
    case 'path':
    case 'dice':
      return [node];
    case 'unary':
      return [node, ...nodesOf(node.operand)];
    case 'binary':
      return [node, ...nodesOf(node.left), ...nodesOf(node.right)];
    case 'choice':
      return [node, ...nodesOf(node.test), ...nodesOf(node.then), ...nodesOf(node.otherwise)];
    case 'call':
      return [node, ...node.args.flatMap(nodesOf)];
  }
}

/** The platform's secure source, as the app passes it. */
const secure = () => randomSourceOf((into) => getRandomValues(into));

describe('ENG-08 dice notation is rolled', () => {
  it('has its limits', () => {
    expect(DICE_LIMITS).toEqual({ count: { min: 1, max: 999 }, faces: { min: 2, max: 1000 } });
  });

  it('reads a dice term in d or к, in either case, with kh or kl', () => {
    const cases: [string, object][] = [
      ['2d6', { count: 2, faces: 6 }],
      ['2к6', { count: 2, faces: 6 }],
      ['2D6', { count: 2, faces: 6 }],
      ['2К6', { count: 2, faces: 6 }],
      ['d20', { count: 1, faces: 20 }],
      ['к8', { count: 1, faces: 8 }],
      ['D20', { count: 1, faces: 20 }],
      ['2d20kh1', { count: 2, faces: 20, keep: { which: 'highest', count: 1 } }],
      ['2к20kh', { count: 2, faces: 20, keep: { which: 'highest', count: 1 } }],
      ['2d20kl1', { count: 2, faces: 20, keep: { which: 'lowest', count: 1 } }],
      ['2d20KL', { count: 2, faces: 20, keep: { which: 'lowest', count: 1 } }],
      ['4d6KH3', { count: 4, faces: 6, keep: { which: 'highest', count: 3 } }],
      ['37d6', { count: 37, faces: 6 }],
      ['3d7', { count: 3, faces: 7 }],
      ['999d6', { count: 999, faces: 6 }],
      ['1d2', { count: 1, faces: 2 }],
      ['1d1000', { count: 1, faces: 1000 }],
      ['02d06', { count: 2, faces: 6 }],
    ];
    for (const [text, term] of cases) {
      expect(parsedRoll(text).root, text).toEqual({ kind: 'dice', at: 0, text, ...term });
    }
  });

  it('parses the formula language with dice as values', () => {
    const cases: [string, string[]][] = [
      ['1d10 + @classes.fighter.level', ['classes.fighter.level']],
      ['2d20kh1 + @stats.grit.mod', ['stats.grit.mod']],
      ['2к6+3', []],
      ['-1d4', []],
      ['max(1, 1d4 - 3)', []],
      ['(2d6) * 2', []],
      ['@gear.worn ? 1d6 : 1d8', ['gear.worn']],
      ['@level + 1', ['level']],
    ];
    for (const [text, paths] of cases) expect(parsedRoll(text).paths, text).toEqual(paths);
  });

  it('refuses a term outside its limits, saying where and why', () => {
    const cases: [string, Partial<FormulaError>][] = [
      ['0d6', { code: 'diceCount', term: '0d6', found: 0, min: 1, max: 999, at: 0 }],
      ['1 + 0d6', { code: 'diceCount', term: '0d6', found: 0, min: 1, max: 999, at: 4 }],
      ['1000d6', { code: 'diceCount', term: '1000d6', found: 1000, min: 1, max: 999, at: 0 }],
      ['1d1', { code: 'diceFaces', term: '1d1', found: 1, min: 2, max: 1000, at: 0 }],
      ['1d0', { code: 'diceFaces', term: '1d0', found: 0, min: 2, max: 1000, at: 0 }],
      ['1d1001', { code: 'diceFaces', term: '1d1001', found: 1001, min: 2, max: 1000, at: 0 }],
      ['0d1', { code: 'diceCount', term: '0d1', found: 0, min: 1, max: 999, at: 0 }],
      ['2d20kh3', { code: 'diceKeep', term: '2d20kh3', found: 3, min: 1, max: 2, at: 0 }],
      ['2d20kh0', { code: 'diceKeep', term: '2d20kh0', found: 0, min: 1, max: 2, at: 0 }],
      ['@level + 2d20kl3', { code: 'diceKeep', term: '2d20kl3', found: 3, min: 1, max: 2, at: 9 }],
    ];
    for (const [text, error] of cases) {
      expect(rollErrorOf(text), text).toEqual({ ...error, message: expect.any(String) });
    }
    expect(rollErrorOf('1000d6').message).toBe(
      '"1000d6" at 0 rolls 1000 dice; a term rolls 1 to 999.',
    );
    expect(rollErrorOf('1d1').message).toBe('"1d1" at 0 has dice of 1 faces; a die has 2 to 1000.');
    expect(rollErrorOf('2d20kh3').message).toBe(
      '"2d20kh3" at 0 keeps 3 of 2 dice; it keeps 1 to 2.',
    );
  });

  it('keeps the errors of ENG-07 for text that is no dice term', () => {
    const cases: [string, Partial<FormulaError>][] = [
      ['2d', { code: 'unexpected', found: 'd', at: 1 }],
      ['2к', { code: 'unexpected', found: 'к', at: 1 }],
      ['d', { code: 'unknownName', name: 'd', at: 0 }],
      ['1.5d6', { code: 'unexpected', found: 'd6', at: 3 }],
      ['2d6 kh1', { code: 'unexpected', found: 'kh1', at: 4 }],
      ['2d6x', { code: 'unexpected', found: 'x', at: 3 }],
      ['@level d8', { code: 'unexpected', found: 'd8', at: 7 }],
    ];
    for (const [text, error] of cases) {
      expect(rollErrorOf(text), text).toEqual({ ...error, message: expect.any(String) });
    }
  });

  it('refuses dice in a plain formula, before any limit', () => {
    const cases: [string, Partial<FormulaError>][] = [
      ['1d10 + 2', { code: 'diceNotAllowed', term: '1d10', at: 0 }],
      ['2 + к6', { code: 'diceNotAllowed', term: 'к6', at: 4 }],
      ['0d6', { code: 'diceNotAllowed', term: '0d6', at: 0 }],
      ['D20', { code: 'diceNotAllowed', term: 'D20', at: 0 }],
    ];
    for (const [text, error] of cases) {
      expect(formulaErrorOf(text), text).toEqual({ ...error, message: expect.any(String) });
    }
    expect(formulaErrorOf('1d10 + 2').message).toBe(
      '"1d10" at 0 is a dice term; dice are allowed only in a roll formula.',
    );
  });

  it('rolls each term with the die it is given', () => {
    const { die, asked } = script(4, 5);
    expect(rollFormula('2d6 + 3', read, die)).toEqual({
      value: 12,
      reads: [],
      warnings: [],
      dice: [
        {
          at: 0,
          text: '2d6',
          count: 2,
          faces: 6,
          results: [4, 5],
          kept: [true, true],
          total: 9,
        },
      ],
    });
    expect(asked).toEqual([6, 6]);
    const cases: [string, number[], number][] = [
      ['2к6+3', [4, 5], 12],
      ['1d10 + @level', [7], 12],
      ['2d20kh1 + @stats.grit.mod', [7, 15], 17],
      ['-1d4', [3], -3],
      ['max(1, 1d4 - 3)', [1], 1],
      ['(2d6) * 2', [3, 6], 18],
      ['d20', [20], 20],
      ['к8', [8], 8],
      ['37d6', Array(37).fill(6), 222],
      ['3d7', [7, 7, 7], 21],
      ['1d20 >= 10', [12], 1],
      ['1d20 >= 10', [9], 0],
    ];
    for (const [text, faces, value] of cases) {
      const result = rollFormula(text, read, script(...faces).die);
      expect(result.value, text).toBe(value);
      expect(result.warnings, text).toEqual([]);
    }
  });

  it('keeps the highest or the lowest, the earlier die between equals', () => {
    const cases: [string, number[], boolean[], number][] = [
      ['2d20kh1', [7, 15], [false, true], 15],
      ['2d20kl1', [7, 15], [true, false], 7],
      ['2d20kh1', [9, 9], [true, false], 9],
      ['2d20kl1', [9, 9], [true, false], 9],
      ['4d6kh3', [3, 4, 1, 1], [true, true, true, false], 8],
      ['4d6kl3', [3, 4, 1, 1], [true, false, true, true], 5],
    ];
    for (const [text, faces, kept, total] of cases) {
      const result = rollFormula(text, read, script(...faces).die);
      expect(result.value, text).toBe(total);
      expect(result.dice, text).toEqual([expect.objectContaining({ results: faces, kept, total })]);
    }
    expect(rollFormula('2d20kh1', read, script(7, 15).die).dice[0]?.keep).toEqual({
      which: 'highest',
      count: 1,
    });
  });

  it('does not roll a term in a branch it does not take', () => {
    const cases: [string, number[], number, number[], string[]][] = [
      ['@gear.worn ? 1d6 : 1d8', [5], 5, [6], ['gear.worn']],
      ['@gear.shield ? 1d6 : 1d8', [8], 8, [8], ['gear.shield']],
      ['0 && 1d6', [], 0, [], []],
      ['if(@gear.worn, 2d4, 1d100)', [1, 2], 3, [4, 4], ['gear.worn']],
    ];
    for (const [text, faces, value, sides, reads] of cases) {
      const { die, asked } = script(...faces);
      const result = rollFormula(text, read, die);
      expect(result.value, text).toBe(value);
      expect(result.reads, text).toEqual(reads);
      expect(asked, text).toEqual(sides);
    }
  });

  it('lists the terms it rolled, in order, with where each starts', () => {
    const result = rollFormula('2d20kh1 + max(@level, 1d4)', read, script(12, 18, 2).die);
    expect(result.value).toBe(23);
    expect(result.reads).toEqual(['level']);
    expect(result.dice.map(({ at, text, total }) => ({ at, text, total }))).toEqual([
      { at: 0, text: '2d20kh1', total: 18 },
      { at: 22, text: '1d4', total: 2 },
    ]);
  });

  it('counts a face that is not one as 0, with a warning', () => {
    expect(rollFormula('3d6 + 1', read, script(6, 7, Number.NaN).die)).toEqual({
      value: 7,
      reads: [],
      warnings: [
        {
          code: 'badFace',
          at: 0,
          term: '3d6',
          count: 2,
          message: '2 of the dice of "3d6" at 0 gave no face from 1 to 6; 0 is used for each.',
        },
      ],
      dice: [expect.objectContaining({ results: [6, 0, 0], total: 6 })],
    });
    for (const face of [0, -1, 2.5, 7, Number.POSITIVE_INFINITY]) {
      const result = rollFormula('1d6', read, script(face).die);
      expect(result.value, String(face)).toBe(0);
      expect(result.warnings.map((w) => w.code)).toEqual(['badFace']);
    }
  });

  it('warns as a formula does: a missing path, a text used as a number', () => {
    expect(rollFormula('1d6 + @nothing.here', read, script(2).die)).toMatchObject({
      value: 2,
      warnings: [{ code: 'missingPath', path: 'nothing.here' }],
    });
    expect(rollFormula('@gear.kind', read, script().die)).toMatchObject({
      value: 0,
      warnings: [{ code: 'wrongType', at: 0 }],
    });
  });

  it('gives 0 for a roll formula that does not parse, and calls neither reader nor die', () => {
    let calls = 0;
    const reader: FormulaReader = (path) => {
      calls++;
      return read(path);
    };
    const { die, asked } = script(3);
    const error = rollErrorOf('@level + 1d1');
    expect(rollFormula('@level + 1d1', reader, die)).toEqual({
      value: 0,
      reads: [],
      warnings: [error],
      dice: [],
    });
    expect(calls).toBe(0);
    expect(asked).toEqual([]);
  });

  it('keeps a roll formula from evaluateFormula by its type, and rolls a plain one', () => {
    const roll = parsedRoll('1d6');
    // @ts-expect-error A ParsedRoll may hold dice; evaluateFormula takes a ParsedFormula.
    const evaluate = () => evaluateFormula(roll, read);
    expect(typeof evaluate).toBe('function');
    const plain = parseFormula('@level + 1');
    if (!plain.ok) throw new Error('did not parse');
    expect(rollFormula(plain.formula, read, script().die)).toEqual({
      value: 6,
      reads: ['level'],
      warnings: [],
      dice: [],
    });
  });

  it('freezes a parsed roll formula, and gives equal results for equal faces', () => {
    const text = '2d20kh1 + max(@level, 1d4)';
    const formula = parsedRoll(text);
    expect(Object.isFrozen(formula)).toBe(true);
    expect(Object.isFrozen(formula.paths)).toBe(true);
    const nodes = nodesOf(formula.root);
    expect(nodes.map((n) => n.kind)).toEqual(['binary', 'dice', 'call', 'path', 'dice']);
    for (const node of nodes) expect(Object.isFrozen(node), node.kind).toBe(true);
    const [, keepHighest] = nodes;
    if (keepHighest?.kind !== 'dice') throw new Error('no dice');
    expect(Object.isFrozen(keepHighest.keep)).toBe(true);
    const first = rollFormula(formula, read, script(12, 18, 2).die);
    expect(rollFormula(formula, read, script(12, 18, 2).die)).toEqual(first);
    expect(rollFormula(text, read, script(12, 18, 2).die)).toEqual(first);
  });

  it('rolls 999 dice of 1000 faces with the secure source', () => {
    const [roll] = rollFormula('999d1000', read, fairDie(secure())).dice as [DiceRoll];
    expect(roll.results).toHaveLength(999);
    for (const face of roll.results)
      expect(face >= 1 && face <= 1000 && Number.isInteger(face)).toBe(true);
    expect(roll.total).toBe(roll.results.reduce((a, b) => a + b, 0));
  });

  it('never throws, and every roll keeps its own rules', () => {
    // Seeded, so every run tries the same texts and faces: 2,000 roll formulas built from the
    // language with dice, half of them then damaged by one piece put in or one character taken out.
    let seed = 11;
    const next = (below: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return Math.floor(seed / 65536) % below;
    };
    const pick = (list: readonly string[]) => list[next(list.length)] as string;
    const random: RandomSource = () => next(65536) * 65536 + next(65536);
    const leaves = [
      '7',
      '@level',
      '@gear.worn',
      '1d6',
      '2к20kh1',
      'd8',
      '4d6kl3',
      '12d10',
      '3D4KH2',
    ];
    const binary = ['+', '-', '*', '/', '<', '>=', '==', '&&', '||'];
    const build = (depth: number): string => {
      switch (next(depth > 3 ? 1 : 5)) {
        case 0:
          return pick(leaves);
        case 1:
          return `(${build(depth + 1)})`;
        case 2:
          return `-${build(depth + 1)}`;
        case 3:
          return `${build(depth + 1)} ${pick(binary)} ${build(depth + 1)}`;
        default:
          return `${build(depth + 1)} ? ${build(depth + 1)} : ${build(depth + 1)}`;
      }
    };
    const pieces = [...'0123456789+-*()?:dк@ ', 'kh', 'kl', 'd20', '1000d6'];
    let damagedParses = 0;
    let terms = 0;
    for (let i = 0; i < 2000; i++) {
      let text = build(0);
      if (i % 2 === 0) {
        expect(parseRoll(text).ok, text).toBe(true);
      } else {
        const at = next(text.length + 1);
        const piece = next(2) === 0 ? pick(pieces) : '';
        text = text.slice(0, at) + piece + text.slice(at + (piece === '' ? 1 : 0));
        if (parseRoll(text).ok) damagedParses++;
      }
      const { value, dice } = rollFormula(text, read, fairDie(random));
      expect(Number.isFinite(value), text).toBe(true);
      for (const roll of dice) {
        terms++;
        const keeps = roll.keep?.count ?? roll.count;
        expect(roll.results, text).toHaveLength(roll.count);
        for (const face of roll.results) {
          expect(Number.isInteger(face) && face >= 1 && face <= roll.faces, text).toBe(true);
        }
        const kept = roll.results.filter((_, index) => roll.kept[index]);
        const dropped = roll.results.filter((_, index) => !roll.kept[index]);
        expect(kept, text).toHaveLength(keeps);
        expect(roll.total, text).toBe(kept.reduce((a, b) => a + b, 0));
        if (dropped.length > 0) {
          const highest = roll.keep?.which === 'highest';
          const worstKept = highest ? Math.min(...kept) : Math.max(...kept);
          const bestDropped = highest ? Math.max(...dropped) : Math.min(...dropped);
          expect(highest ? worstKept >= bestDropped : worstKept <= bestDropped, text).toBe(true);
        }
      }
    }
    expect(terms).toBeGreaterThan(1000);
    expect(damagedParses).toBeGreaterThan(0);
    expect(damagedParses).toBeLessThan(1000);
  });
});

describe('ENG-08 every face is equally likely', () => {
  it('keeps a number only below the largest multiple of the faces under 2^32', () => {
    // 2^32 − (2^32 % faces), from python3.
    const lines: [number, number][] = [
      [2, 4294967296],
      [3, 4294967295],
      [6, 4294967292],
      [7, 4294967292],
      [20, 4294967280],
      [1000, 4294967000],
    ];
    for (const [faces, below] of lines) {
      // The last number kept gives the top face; the line itself is drawn again.
      expect(fairDie(numbers(below - 1).random)(faces), String(faces)).toBe(faces);
      const source = numbers(below, 0);
      expect(fairDie(source.random)(faces), String(faces)).toBe(1);
      expect(source.draws(), String(faces)).toBe(2);
    }
    // Numbers in a row give every face once.
    const sixes = numbers(...Array.from({ length: 12 }, (_, i) => i));
    const die = fairDie(sixes.random);
    expect(Array.from({ length: 12 }, () => die(6))).toEqual([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6]);
  });

  it('draws again on a number that is not a whole number below 2^32', () => {
    const source = numbers(Number.NaN, -1, 1.5, 2 ** 32, 3);
    expect(fairDie(source.random)(6)).toBe(4);
    expect(source.draws()).toBe(5);
  });

  it('gives 0 after 16 numbers in a row that are not kept, and never hangs', () => {
    const top = 4294967295;
    const fifteen = numbers(...Array(15).fill(top), 5);
    expect(fairDie(fifteen.random)(6)).toBe(6);
    expect(fifteen.draws()).toBe(16);
    const sixteen = numbers(...Array(16).fill(top), 5);
    expect(fairDie(sixteen.random)(6)).toBe(0);
    expect(sixteen.draws()).toBe(16);
    const broken = rollFormula(
      '2d6',
      read,
      fairDie(() => top),
    );
    expect(broken.value).toBe(0);
    expect(broken.warnings).toMatchObject([{ code: 'badFace', count: 2 }]);
  });

  it('serves the platform numbers in order, 256 at a time', () => {
    let counter = 0;
    const asked: number[] = [];
    const random = randomSourceOf((into) => {
      asked.push(into.length);
      for (let i = 0; i < into.length; i++) into[i] = counter++;
    });
    const drawn = Array.from({ length: 600 }, () => random());
    expect(drawn).toEqual(Array.from({ length: 600 }, (_, i) => i));
    expect(asked).toEqual([256, 256, 256]);
  });

  /** Chi-square of `rolls` faces of `die` against the uniform count; a face outside fails. */
  function chiSquare(die: DieSource, faces: number, rolls: number): number {
    const counts = new Array<number>(faces + 1).fill(0);
    for (let i = 0; i < rolls; i++) {
      const face = die(faces);
      if (!(Number.isInteger(face) && face >= 1 && face <= faces)) throw new Error(`face ${face}`);
      counts[face] = (counts[face] as number) + 1;
    }
    const expected = rolls / faces;
    return counts.slice(1).reduce((sum, seen) => sum + (seen - expected) ** 2 / expected, 0);
  }

  it('passes a chi-square test on the secure source, at p = 10^-9', () => {
    // Thresholds: scipy 1.17.1 chi2.ppf(1 - 1e-9, faces - 1), cut to two decimals.
    const cases: [number, number, number][] = [
      [2, 20000, 37.32],
      [6, 60000, 50.69],
      [7, 70000, 53.34],
      [20, 200000, 81.55],
      [1000, 1000000, 1290.82],
    ];
    const die = fairDie(secure());
    for (const [faces, rolls, threshold] of cases) {
      expect(chiSquare(die, faces, rolls), `d${faces}`).toBeLessThan(threshold);
    }
  });

  it('fails the same test with a remainder bias', () => {
    // An 8-bit number modulo 100: faces 1–56 have 3 numbers of 256, faces 57–100 have 2.
    // python3: over 100,000 rolls the chi-square's mean is 3,858.7; the threshold is 207.89.
    const random = secure();
    const biased: DieSource = (faces) => ((random() & 0xff) % faces) + 1;
    expect(chiSquare(biased, 100, 100000)).toBeGreaterThan(207.89);
  });
});
