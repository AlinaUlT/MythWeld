import {
  evaluateCondition,
  evaluateFormula,
  evaluateNumber,
  FORMULA_LIMITS,
  type FormulaError,
  type FormulaNode,
  type FormulaReader,
  type ParsedFormula,
  parseFormula,
} from '@grimoire/engine';
import { describe, expect, it } from 'vitest';

// Made-up paths and values (ADR 004 item 4). The expected values were computed with python3 from
// each formula's text, not by this code (ENG-07 §7).
const values: Record<string, unknown> = {
  level: 5,
  'stats.grit.score': 15,
  'stats.grit.mod': 2,
  'stats.wit.score': 8,
  'gear.worn': true,
  'gear.shield': false,
  'gear.kind': 'heavy',
};
const read: FormulaReader = (path) => (Object.hasOwn(values, path) ? values[path] : undefined);

/** A reader over `values` that counts its calls per path. */
function counting() {
  const calls: string[] = [];
  const reader: FormulaReader = (path) => {
    calls.push(path);
    return read(path);
  };
  return { reader, calls };
}

function evaluated(text: string) {
  return evaluateFormula(text, read).value;
}

function parsed(text: string): ParsedFormula {
  const result = parseFormula(text);
  if (!result.ok) throw new Error(`"${text}" did not parse: ${result.error.message}`);
  return result.formula;
}

function errorOf(text: string): FormulaError {
  const result = parseFormula(text);
  if (result.ok) throw new Error(`"${text}" parsed`);
  return result.error;
}

/** Every node of a tree, the root first. */
function nodesOf(node: FormulaNode): FormulaNode[] {
  switch (node.kind) {
    case 'literal':
    case 'path':
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

describe('ENG-07 formulas evaluate safely', () => {
  it('has a length and a depth limit', () => {
    expect(FORMULA_LIMITS).toEqual({ length: 1000, depth: 32 });
  });

  it('binds and groups as JavaScript does', () => {
    const cases: [string, number][] = [
      ['2 + 3 * 4', 14],
      ['(2 + 3) * 4', 20],
      ['10 - 4 - 3', 3],
      ['24 / 4 / 3', 2],
      ['2.5 * 2', 5],
      ['-2 * @level', -10],
      ['+@level', 5],
      ['- -3', 3],
      ['@level > 10 ? 3 : @level > 4 ? 2 : 1', 2],
      ['@gear.worn ? 0 : 1 ? 2 : 3', 0],
      ['@gear.worn ? 13 : 10 + @stats.grit.mod', 13],
      ['@gear.shield ? 2 : 10 + @stats.grit.mod', 12],
      ['floor((@stats.grit.score - 10) / 2)', 2],
      ['floor((@stats.wit.score - 10) / 2)', -1],
      ['  @level\n*\t2 ', 10],
    ];
    for (const [text, value] of cases) {
      expect(evaluateFormula(text, read), text).toEqual({
        value,
        reads: expect.any(Array),
        warnings: [],
      });
    }
  });

  it("parses every reference SPEC §5.6 lists, and SPEC §5.3–§5.4's formulas", () => {
    const references = [
      'abilities.dex.mod',
      'abilities.san.score',
      'prof',
      'level',
      'classes.fighter.level',
      'classes.fighter.table.secondWindUses',
      'skills.stealth.total',
      'conditions.exhaustion.level',
      'armor.worn',
      'armor.group',
      'shield',
      'equipped',
      'attuned',
      'score',
    ];
    for (const path of references) expect(parsed(`@${path}`).paths).toEqual([path]);
    const formulas: [string, string[]][] = [
      ['floor((@score - 10) / 2)', ['score']],
      ['-2 * @conditions.exhaustion.level', ['conditions.exhaustion.level']],
      ['@conditions.exhaustion.level >= 2', ['conditions.exhaustion.level']],
      ['+@prof', ['prof']],
      ['+@level', ['level']],
      ['10 + @abilities.dex.mod + @abilities.con.mod', ['abilities.dex.mod', 'abilities.con.mod']],
    ];
    for (const [text, paths] of formulas) expect(parsed(text).paths, text).toEqual(paths);
  });

  it('applies its eight functions', () => {
    const cases: [string, number][] = [
      ['floor((9 - 10) / 2)', -1],
      ['ceil(7 / 2)', 4],
      ['round(2.5)', 3],
      ['round(-2.5)', -2],
      ['round(2.4)', 2],
      ['abs(-4)', 4],
      ['min(3, @level, 4)', 3],
      ['max(1, @level)', 5],
      ['max(@level)', 5],
      ['clamp(@level * 3, 1, 12)', 12],
      ['clamp(-4, 1, 12)', 1],
      ['clamp(7, 1, 12)', 7],
      ['if(@gear.worn, 1, 2)', 1],
      ['if(@gear.shield, 1, 2)', 2],
    ];
    for (const [text, value] of cases) expect(evaluated(text), text).toBe(value);
  });

  it('reads a missing path as 0, with a warning', () => {
    expect(evaluateFormula('@nothing.here + 2', read)).toEqual({
      value: 2,
      reads: ['nothing.here'],
      warnings: [
        {
          code: 'missingPath',
          path: 'nothing.here',
          message: 'Missing: @nothing.here; 0 is used.',
        },
      ],
    });
    // Read twice, warned once.
    expect(evaluateFormula('@nothing.here * 2 - @nothing.here', read).warnings).toHaveLength(1);
  });

  it('reads a value that is not a number, a yes/no or a text as 0, with a warning', () => {
    const odd: Record<string, unknown> = {
      nan: Number.NaN,
      infinite: Number.POSITIVE_INFINITY,
      none: null,
      group: { mod: 2 },
      list: [1],
      action: () => 1,
    };
    for (const path of Object.keys(odd)) {
      const result = evaluateFormula(`@${path} + 1`, (p) => odd[p]);
      expect(result.value, path).toBe(1);
      expect(result.warnings, path).toEqual([
        { code: 'notAValue', path, message: expect.stringContaining(`@${path}`) },
      ]);
    }
    // A plain object as the store: its prototype's names are not values.
    const store: Record<string, unknown> = {};
    for (const path of ['constructor', 'toString', 'valueOf']) {
      const result = evaluateFormula(`@${path}`, (p) => store[p]);
      expect(result.value, path).toBe(0);
      expect(
        result.warnings.map((w) => w.code),
        path,
      ).toEqual(['notAValue']);
    }
  });

  it('lists the paths it read, in order, once each, calling the reader once per path', () => {
    const { reader, calls } = counting();
    expect(evaluateFormula('@level + @stats.grit.score * @level', reader)).toEqual({
      value: 80,
      reads: ['level', 'stats.grit.score'],
      warnings: [],
    });
    expect(calls).toEqual(['level', 'stats.grit.score']);
  });

  it('does not read a branch it does not take', () => {
    const cases: [string, unknown, string[]][] = [
      ['@gear.worn ? @level : @nothing.here', 5, ['gear.worn', 'level']],
      ['@gear.shield ? @nothing.here : @level', 5, ['gear.shield', 'level']],
      ['if(@gear.shield, @nothing.here, 7)', 7, ['gear.shield']],
      ['@gear.shield && @nothing.here', false, ['gear.shield']],
      ['@gear.worn || @nothing.here', true, ['gear.worn']],
    ];
    for (const [text, value, reads] of cases) {
      const { reader, calls } = counting();
      expect(evaluateFormula(text, reader), text).toEqual({ value, reads, warnings: [] });
      expect(calls, text).toEqual(reads);
    }
  });

  it('lists every path its text names, taken or not', () => {
    expect(parsed('@gear.worn ? @level : @nothing.here').paths).toEqual([
      'gear.worn',
      'level',
      'nothing.here',
    ]);
    expect(parsed('@level + max(@level, @stats.grit.mod)').paths).toEqual([
      'level',
      'stats.grit.mod',
    ]);
    expect(parsed('3 * 4').paths).toEqual([]);
  });

  it('gives each kind of value its result', () => {
    const cases: [string, unknown][] = [
      ['0 || 3', true],
      ['0 && 3', false],
      ['2 && 3', true],
      ['!0', true],
      ['!@gear.worn', false],
      ['@level >= 5', true],
      ['@level > 5', false],
      ['@level <= 4', false],
      ['@level < 6', true],
      ['@level == 5', true],
      ['@level != 5', false],
      ["@gear.kind == 'heavy'", true],
      ["@gear.kind != 'light'", true],
      ['@gear.kind == 0', false],
      ["'1' == 1", false],
      ['@gear.worn == 1', true],
      ['@gear.worn == true', true],
      ['true && @gear.worn', true],
      ['false', false],
      ["'heavy'", 'heavy'],
      ["''", ''],
      ["@gear.worn ? 'yes' : 'no'", 'yes'],
      ['@gear.worn + 1', 2],
      ['@gear.shield + 1', 1],
    ];
    for (const [text, value] of cases) {
      expect(evaluateFormula(text, read), text).toEqual({
        value,
        reads: expect.any(Array),
        warnings: [],
      });
    }
    expect(evaluateFormula('1 + @gear.kind', read)).toEqual({
      value: 1,
      reads: ['gear.kind'],
      warnings: [
        { code: 'wrongType', at: 4, message: 'A text is used as a number at 4; 0 is used.' },
      ],
    });
    expect(evaluateFormula('@gear.kind < 3', read)).toMatchObject({
      value: true,
      warnings: [{ code: 'wrongType', at: 0 }],
    });
  });

  it('gives 0 for a result that is not a finite number, and never -0', () => {
    const cases: [string, number][] = [
      ['1 / 0', 2],
      ['0 / 0', 2],
      ['@level / (@level - 5)', 7],
      ['9'.repeat(400), 0],
    ];
    for (const [text, at] of cases) {
      const result = evaluateFormula(text, read);
      expect(result.value, text).toBe(0);
      expect(result.warnings, text).toEqual([
        { code: 'notFinite', at, message: expect.stringContaining('not a finite number') },
      ]);
    }
    expect(Object.is(evaluated('-0'), 0)).toBe(true);
    expect(Object.is(evaluated('ceil(-0.5)'), 0)).toBe(true);
    expect(Object.is(evaluateFormula('@zero', () => -0).value, 0)).toBe(true);
  });

  it('converts a result to a number, or to a condition', () => {
    expect(evaluateNumber('@gear.worn', read)).toEqual({
      value: 1,
      reads: ['gear.worn'],
      warnings: [],
    });
    expect(evaluateNumber('@gear.shield', read).value).toBe(0);
    expect(evaluateNumber('@level > 2', read).value).toBe(1);
    expect(evaluateNumber('@level * 2', read).value).toBe(10);
    expect(evaluateNumber('@gear.kind', read)).toEqual({
      value: 0,
      reads: ['gear.kind'],
      warnings: [
        { code: 'wrongType', at: 0, message: 'A text is used as a number at 0; 0 is used.' },
      ],
    });
    const conditions: [string, boolean][] = [
      ['@level', true],
      ['0', false],
      ["''", false],
      ['@gear.kind', true],
      ['@gear.shield', false],
      ['@level - 5', false],
    ];
    for (const [text, value] of conditions) {
      expect(evaluateCondition(text, read), text).toEqual({
        value,
        reads: expect.any(Array),
        warnings: [],
      });
    }
    expect(evaluateCondition('@nothing.here', read)).toMatchObject({
      value: false,
      warnings: [{ code: 'missingPath', path: 'nothing.here' }],
    });
  });

  it('says why a formula does not parse, and where', () => {
    const cases: [string, Partial<FormulaError>][] = [
      ['2 +', { code: 'unexpected', found: '', at: 3 }],
      ['2 + * 3', { code: 'unexpected', found: '*', at: 4 }],
      ['(2 + 3', { code: 'unexpected', found: '', at: 6 }],
      ['2 + 3)', { code: 'unexpected', found: ')', at: 5 }],
      ['2 # 3', { code: 'unexpected', found: '#', at: 2 }],
      ['@level = 5', { code: 'unexpected', found: '=', at: 7 }],
      ['@level & 1', { code: 'unexpected', found: '&', at: 7 }],
      ['1d10 + 2', { code: 'unexpected', found: 'd10', at: 1 }],
      ['', { code: 'unexpected', found: '', at: 0 }],
      ['   ', { code: 'unexpected', found: '', at: 3 }],
      ["'open", { code: 'unexpected', found: '', at: 5 }],
      ['"x"', { code: 'unexpected', found: '"', at: 0 }],
      ['1.', { code: 'unexpected', found: '.', at: 1 }],
      ['.5', { code: 'unexpected', found: '.', at: 0 }],
      ['floor + 1', { code: 'unexpected', found: '+', at: 6 }],
      ['1 + prof', { code: 'unknownName', name: 'prof', at: 4 }],
      ['sqrt(4)', { code: 'unknownName', name: 'sqrt', at: 0 }],
      ['constructor(1)', { code: 'unknownName', name: 'constructor', at: 0 }],
      ['toString(1)', { code: 'unknownName', name: 'toString', at: 0 }],
      ['__proto__(1)', { code: 'unknownName', name: '__proto__', at: 0 }],
      ['floor(1, 2)', { code: 'argumentCount', name: 'floor', found: 2, min: 1, max: 1, at: 0 }],
      ['clamp(1, 2)', { code: 'argumentCount', name: 'clamp', found: 2, min: 3, max: 3, at: 0 }],
      ['if(1, 2)', { code: 'argumentCount', name: 'if', found: 2, min: 3, max: 3, at: 0 }],
      ['min()', { code: 'argumentCount', name: 'min', found: 0, min: 1, at: 0 }],
      ['1 + @stats..score', { code: 'badPath', path: 'stats..score', at: 4 }],
      ['@Level', { code: 'badPath', path: 'Level', at: 0 }],
      ['@level.', { code: 'badPath', path: 'level.', at: 0 }],
      ['@', { code: 'badPath', path: '', at: 0 }],
      ['@1x', { code: 'badPath', path: '1x', at: 0 }],
      ['@a_b', { code: 'badPath', path: 'a_b', at: 0 }],
    ];
    for (const [text, error] of cases) {
      expect(errorOf(text), text).toEqual({ ...error, message: expect.any(String) });
    }
    expect(errorOf('1 + prof').message).toBe(
      'Unknown name "prof" at 4. A path starts with @: @prof.',
    );
    expect(errorOf('min()').message).toBe('"min" at 0 takes 1 or more values, not 0.');
  });

  it('stops at 1,000 characters', () => {
    const long = `${'1+'.repeat(500)}1`;
    expect(long).toHaveLength(1001);
    expect(errorOf(long)).toEqual({
      code: 'tooLong',
      length: 1001,
      limit: 1000,
      at: 1000,
      message: 'The formula is 1001 characters long; the limit is 1000.',
    });
    const longest = ` ${'1+'.repeat(499)}1`;
    expect(longest).toHaveLength(1000);
    expect(evaluated(longest)).toBe(500);
  });

  it('stops at 32 levels, but not on a chain of one operator', () => {
    const nests: [string, (n: number) => string, number][] = [
      ['brackets', (n) => `${'('.repeat(n)}1${')'.repeat(n)}`, 32],
      ['unary minus', (n) => `${'-'.repeat(n)}1`, 32],
      ['functions', (n) => `${'floor('.repeat(n)}1${')'.repeat(n)}`, 192],
    ];
    for (const [what, nest, at] of nests) {
      expect(evaluated(nest(32)), what).toBe(1);
      expect(errorOf(nest(33)), what).toEqual({
        code: 'tooDeep',
        limit: 32,
        at,
        message: `The formula nests deeper than 32 levels at ${at}.`,
      });
    }
    expect(evaluated(`${'1+'.repeat(499)}1`)).toBe(500);
  });

  it('gives 0 for a formula that does not parse, and never calls the reader', () => {
    const { reader, calls } = counting();
    const error = errorOf('@level +');
    expect(evaluateFormula('@level +', reader)).toEqual({ value: 0, reads: [], warnings: [error] });
    expect(evaluateNumber('@level +', reader)).toEqual({ value: 0, reads: [], warnings: [error] });
    expect(evaluateCondition('@level +', reader)).toEqual({
      value: false,
      reads: [],
      warnings: [error],
    });
    expect(calls).toEqual([]);
  });

  it('freezes a parsed formula, and gives equal results twice', () => {
    const text = '@gear.worn ? -@level : max(@level, 2) + floor(@stats.grit.mod / 2)';
    const formula = parsed(text);
    expect(Object.isFrozen(formula)).toBe(true);
    expect(Object.isFrozen(formula.paths)).toBe(true);
    const nodes = nodesOf(formula.root);
    expect(nodes).toHaveLength(12);
    for (const node of nodes) expect(Object.isFrozen(node), node.kind).toBe(true);
    for (const node of nodes)
      if (node.kind === 'call') expect(Object.isFrozen(node.args)).toBe(true);
    const first = evaluateFormula(formula, read);
    expect(first).toEqual({ value: -5, reads: ['gear.worn', 'level'], warnings: [] });
    expect(evaluateFormula(formula, read)).toEqual(first);
    expect(evaluateFormula(text, read)).toEqual(first);
  });

  it('never throws, whatever the text', () => {
    // A seeded generator, so every run tries the same texts: 5,000 formulas built from the
    // language, half of them then damaged by one piece put in or one character taken out.
    let seed = 7;
    const next = (below: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return Math.floor(seed / 65536) % below;
    };
    const pick = (list: readonly string[]) => list[next(list.length)] as string;
    const leaves = [
      '0',
      '7',
      '2.5',
      '@level',
      '@gear.kind',
      '@gear.worn',
      '@nothing.here',
      "'heavy'",
    ];
    const binary = ['+', '-', '*', '/', '<', '<=', '>', '>=', '==', '!=', '&&', '||'];
    // Each function with the number of values it takes; 0 for `min` and `max`, given 1 to 3 here.
    const functions: [string, number][] = [
      ['floor', 1],
      ['ceil', 1],
      ['round', 1],
      ['abs', 1],
      ['min', 0],
      ['max', 0],
      ['clamp', 3],
      ['if', 3],
    ];
    const build = (depth: number): string => {
      switch (next(depth > 3 ? 1 : 6)) {
        case 0:
          return pick(leaves);
        case 1:
          return `(${build(depth + 1)})`;
        case 2:
          return `${pick(['-', '+', '!'])}${build(depth + 1)}`;
        case 3:
          return `${build(depth + 1)} ${pick(binary)} ${build(depth + 1)}`;
        case 4:
          return `${build(depth + 1)} ? ${build(depth + 1)} : ${build(depth + 1)}`;
        default: {
          const [name, count] = functions[next(functions.length)] as [string, number];
          const args = Array.from({ length: count || 1 + next(3) }, () => build(depth + 1));
          return `${name}(${args.join(', ')})`;
        }
      }
    };
    const pieces = [...'0123456789.+-*/(),?:!<>=&|\'"@_ adfx', '@level', 'min(', '&&', 'true'];
    let damagedParses = 0;
    for (let i = 0; i < 5000; i++) {
      let text = build(0);
      if (i % 2 === 0) {
        expect(parseFormula(text).ok, text).toBe(true);
      } else {
        const at = next(text.length + 1);
        const piece = next(2) === 0 ? pick(pieces) : '';
        text = text.slice(0, at) + piece + text.slice(at + (piece === '' ? 1 : 0));
        if (parseFormula(text).ok) damagedParses++;
      }
      for (const evaluate of [evaluateFormula, evaluateNumber, evaluateCondition]) {
        const { value } = evaluate(text, read);
        expect(['number', 'boolean', 'string'], text).toContain(typeof value);
        if (typeof value === 'number') expect(Number.isFinite(value), text).toBe(true);
      }
    }
    // Every formula the language builds parses; the damaged ones are tried both ways.
    expect(damagedParses).toBeGreaterThan(0);
    expect(damagedParses).toBeLessThan(2500);
  });
});
