import { computedPathSchema } from '@grimoire/schema';
import { DICE_LIMITS, type DiceTerm, type DieSource, rollDice } from './dice';

// ENG-07: a formula is parsed into a frozen tree, and the tree is walked; no code ever runs (SPEC
// §5.6). The parser stops at a length and a depth limit, so a pack's formula cannot exhaust the
// stack. Nothing throws: a formula that does not parse, a missing path (read as 0), a value of the
// wrong kind or a division by 0 gives a value and a warning (SPEC §8.2). Each result lists the
// paths it read; each parsed formula lists every path its text names.

/** How long a formula may be, in characters, and how deep its parts may nest. */
export const FORMULA_LIMITS = { length: 1000, depth: 32 } as const;

/** What a path or a formula gives: a number, a yes/no, or a text. */
export type FormulaValue = number | boolean | string;

type UnaryOp = '-' | '+' | '!';
type BinaryOp = '||' | '&&' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/';

/** A dice term of a roll formula; `text` is the term as written, such as `2к6`. */
export interface DiceNode extends DiceTerm {
  readonly kind: 'dice';
  readonly at: number;
  readonly text: string;
}

/** The parts of a tree whose leaves may also be `D`. */
type NodeOf<D> =
  | { readonly kind: 'literal'; readonly at: number; readonly value: FormulaValue }
  | { readonly kind: 'path'; readonly at: number; readonly path: string }
  | {
      readonly kind: 'unary';
      readonly at: number;
      readonly op: UnaryOp;
      readonly operand: NodeOf<D>;
    }
  | {
      readonly kind: 'binary';
      readonly at: number;
      readonly op: BinaryOp;
      readonly left: NodeOf<D>;
      readonly right: NodeOf<D>;
    }
  | {
      readonly kind: 'choice';
      readonly at: number;
      readonly test: NodeOf<D>;
      readonly then: NodeOf<D>;
      readonly otherwise: NodeOf<D>;
    }
  | {
      readonly kind: 'call';
      readonly at: number;
      readonly name: string;
      readonly args: readonly NodeOf<D>[];
    }
  | D;

/** One part of a parsed formula. `at` is where it starts in the text, from 0. */
export type FormulaNode = NodeOf<never>;

/** One part of a parsed roll formula: a part of a formula, or a dice term. */
export type RollNode = NodeOf<DiceNode>;

/** A formula that parsed: its text, its tree, and every path the text names, in order. */
export interface ParsedFormula {
  readonly text: string;
  readonly root: FormulaNode;
  readonly paths: readonly string[];
}

/** A roll formula that parsed. A plain formula is one too: it has no dice. */
export interface ParsedRoll {
  readonly text: string;
  readonly root: RollNode;
  readonly paths: readonly string[];
}

/** Why a formula did not parse. `code` and its data are for the screen; `message` is for logs. */
export type FormulaError = { at: number; message: string } & (
  | { code: 'unexpected'; found: string }
  | { code: 'unknownName'; name: string }
  | { code: 'argumentCount'; name: string; found: number; min: number; max?: number }
  | { code: 'badPath'; path: string }
  | { code: 'tooLong'; length: number; limit: number }
  | { code: 'tooDeep'; limit: number }
  | { code: 'diceNotAllowed'; term: string }
  | {
      code: 'diceCount' | 'diceFaces' | 'diceKeep';
      term: string;
      found: number;
      min: number;
      max: number;
    }
);

/** Something an evaluation met: a parse error, or a value it had to replace. */
export type FormulaWarning =
  | FormulaError
  | ({ message: string } & (
      | { code: 'missingPath'; path: string }
      | { code: 'notAValue'; path: string }
      | { code: 'wrongType'; at: number }
      | { code: 'notFinite'; at: number }
      | { code: 'badFace'; at: number; term: string; count: number }
    ));

/** A path's value, given the path without `@`; `undefined` when the path is missing. */
export type FormulaReader = (path: string) => unknown;

/** A value, the paths read for it in the order first read, and what the evaluation met. */
export interface FormulaResult<V extends FormulaValue> {
  value: V;
  reads: readonly string[];
  warnings: readonly FormulaWarning[];
}

export type ParseResult<F = ParsedFormula> =
  | { ok: true; formula: F }
  | { ok: false; error: FormulaError };

/** A dice term as rolled: the term, each die's face in the order rolled, which were kept, the sum. */
export interface DiceRoll extends DiceTerm {
  at: number;
  text: string;
  results: readonly number[];
  kept: readonly boolean[];
  total: number;
}

/** A roll formula's number, the paths read, what it met, and each dice term it rolled, in order. */
export interface RollResult extends FormulaResult<number> {
  dice: readonly DiceRoll[];
}

// --- The functions -------------------------------------------------------------------------------

interface Arity {
  min: number;
  max?: number;
}

interface FunctionDef extends Arity {
  apply(args: readonly number[]): number;
}

// A Map, so a name such as `constructor` is never found on an object's prototype.
const FUNCTIONS: ReadonlyMap<string, FunctionDef> = new Map<string, FunctionDef>([
  ['floor', { min: 1, max: 1, apply: ([x = 0]) => Math.floor(x) }],
  ['ceil', { min: 1, max: 1, apply: ([x = 0]) => Math.ceil(x) }],
  ['round', { min: 1, max: 1, apply: ([x = 0]) => Math.round(x) }],
  ['abs', { min: 1, max: 1, apply: ([x = 0]) => Math.abs(x) }],
  ['min', { min: 1, apply: (xs) => Math.min(...xs) }],
  ['max', { min: 1, apply: (xs) => Math.max(...xs) }],
  [
    'clamp',
    { min: 3, max: 3, apply: ([x = 0, low = 0, high = 0]) => Math.min(Math.max(x, low), high) },
  ],
]);

// `if(test, then, otherwise)` parses to a choice, like `?:`, so it reads only the branch it takes.
const IF = 'if';
const IF_ARITY: Arity = { min: 3, max: 3 };

// --- Tokens --------------------------------------------------------------------------------------

type TokenKind = 'number' | 'text' | 'name' | 'path' | 'dice' | 'op' | 'end';

interface Token {
  kind: TokenKind;
  text: string;
  at: number;
}

/** Thrown inside the parser only; `parseFormula` turns it into its result. */
class Refusal {
  readonly error: FormulaError;

  constructor(error: FormulaError) {
    this.error = error;
  }
}

const TWO_CHAR_OPS = new Set(['&&', '||', '==', '!=', '<=', '>=']);
const ONE_CHAR_OPS = new Set(['+', '-', '*', '/', '(', ')', ',', '?', ':', '!', '<', '>']);
const DIGIT = /[0-9]/;
const NAME_START = /[A-Za-z_]/;
const NAME_PART = /[A-Za-z0-9_]/;
const PATH_PART = /[A-Za-z0-9_.]/;
const SPACE = /\s/;
// A dice term: a count (1 when none), `d` or `к`, the faces, and `kh` or `kl` with a count (1 when
// none). Letters in either case. Sticky, so it matches only where a token starts.
const DICE = /([0-9]*)[dк]([0-9]+)(?:k([hl])([0-9]*))?/iy;

function unexpected(found: string, at: number): Refusal {
  const what = found === '' ? 'the end of the formula' : `"${found}"`;
  return new Refusal({ code: 'unexpected', found, at, message: `Unexpected ${what} at ${at}.` });
}

/** The length of the run of characters matching `part`, from `start`. */
function runOf(text: string, start: number, part: RegExp): number {
  let end = start;
  while (end < text.length && part.test(text[end] as string)) end++;
  return end - start;
}

function tokensOf(text: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < text.length) {
    const char = text[at] as string;
    if (SPACE.test(char)) {
      at++;
      continue;
    }
    let length: number;
    let kind: TokenKind;
    DICE.lastIndex = at;
    const dice = DICE.exec(text);
    if (dice !== null) {
      kind = 'dice';
      length = dice[0].length;
    } else if (DIGIT.test(char)) {
      kind = 'number';
      length = runOf(text, at, DIGIT);
      if (text[at + length] === '.' && DIGIT.test(text[at + length + 1] ?? '')) {
        length += 1 + runOf(text, at + length + 1, DIGIT);
      }
    } else if (char === "'") {
      kind = 'text';
      const close = text.indexOf("'", at + 1);
      if (close === -1) throw unexpected('', text.length);
      length = close + 1 - at;
    } else if (NAME_START.test(char)) {
      kind = 'name';
      length = runOf(text, at, NAME_PART);
    } else if (char === '@') {
      kind = 'path';
      length = 1 + runOf(text, at + 1, PATH_PART);
    } else if (TWO_CHAR_OPS.has(text.slice(at, at + 2))) {
      kind = 'op';
      length = 2;
    } else if (ONE_CHAR_OPS.has(char)) {
      kind = 'op';
      length = 1;
    } else {
      throw unexpected(char, at);
    }
    tokens.push({ kind, text: text.slice(at, at + length), at });
    at += length;
  }
  tokens.push({ kind: 'end', text: '', at: text.length });
  return tokens;
}

// --- The parser ----------------------------------------------------------------------------------

// Binding strength, as in JavaScript. `?:` binds least and groups to the right; the others group
// to the left.
const CHOICE = 1;
const UNARY = 8;
const BINARY: ReadonlyMap<string, number> = new Map([
  ['||', 2],
  ['&&', 3],
  ['==', 4],
  ['!=', 4],
  ['<', 5],
  ['<=', 5],
  ['>', 5],
  ['>=', 5],
  ['+', 6],
  ['-', 6],
  ['*', 7],
  ['/', 7],
]);

function frozen<N extends RollNode>(node: N): N {
  return Object.freeze(node);
}

class Parser {
  private next = 0;
  readonly paths = new Set<string>();

  private readonly tokens: readonly Token[];
  /** Whether dice terms are allowed: in a roll formula only. */
  private readonly rolls: boolean;

  constructor(tokens: readonly Token[], rolls: boolean) {
    this.tokens = tokens;
    this.rolls = rolls;
  }

  private peek(): Token {
    return this.tokens[this.next] as Token;
  }

  private take(): Token {
    const token = this.peek();
    if (token.kind !== 'end') this.next++;
    return token;
  }

  private isOp(op: string): boolean {
    const token = this.peek();
    return token.kind === 'op' && token.text === op;
  }

  private expect(op: string): void {
    const token = this.take();
    if (token.kind !== 'op' || token.text !== op) throw unexpected(token.text, token.at);
  }

  /** One level deeper than `depth`, opened by the token at `at`; refused past the limit. */
  private deeper(depth: number, at: number): number {
    if (depth >= FORMULA_LIMITS.depth) {
      const limit = FORMULA_LIMITS.depth;
      throw new Refusal({
        code: 'tooDeep',
        limit,
        at,
        message: `The formula nests deeper than ${limit} levels at ${at}.`,
      });
    }
    return depth + 1;
  }

  whole(): RollNode {
    const root = this.expression(0, 0);
    const rest = this.peek();
    if (rest.kind !== 'end') throw unexpected(rest.text, rest.at);
    return root;
  }

  private expression(weakest: number, depth: number): RollNode {
    let left = this.prefix(depth);
    for (;;) {
      const token = this.peek();
      if (token.kind !== 'op') return left;
      if (token.text === '?' && CHOICE >= weakest) {
        this.take();
        const inner = this.deeper(depth, token.at);
        const then = this.expression(0, inner);
        this.expect(':');
        const otherwise = this.expression(CHOICE, inner);
        left = frozen({ kind: 'choice', at: token.at, test: left, then, otherwise });
        continue;
      }
      const strength = BINARY.get(token.text);
      if (strength === undefined || strength < weakest) return left;
      this.take();
      const right = this.expression(strength + 1, this.deeper(depth, token.at));
      left = frozen({ kind: 'binary', at: token.at, op: token.text as BinaryOp, left, right });
    }
  }

  private prefix(depth: number): RollNode {
    const token = this.take();
    switch (token.kind) {
      case 'number':
        return frozen({ kind: 'literal', at: token.at, value: Number(token.text) });
      case 'text':
        return frozen({ kind: 'literal', at: token.at, value: token.text.slice(1, -1) });
      case 'path':
        return this.path(token);
      case 'dice':
        return this.dice(token);
      case 'name':
        return this.name(token, depth);
      case 'op':
        if (token.text === '(') {
          const inner = this.expression(0, this.deeper(depth, token.at));
          this.expect(')');
          return inner;
        }
        if (token.text === '-' || token.text === '+' || token.text === '!') {
          const operand = this.expression(UNARY, this.deeper(depth, token.at));
          return frozen({ kind: 'unary', at: token.at, op: token.text, operand });
        }
        throw unexpected(token.text, token.at);
      case 'end':
        throw unexpected('', token.at);
    }
  }

  private path(token: Token): RollNode {
    const path = token.text.slice(1);
    if (!computedPathSchema.safeParse(path).success) {
      throw new Refusal({
        code: 'badPath',
        path,
        at: token.at,
        message: `"@${path}" at ${token.at} is not a path: camelCase steps joined by dots.`,
      });
    }
    this.paths.add(path);
    return frozen({ kind: 'path', at: token.at, path });
  }

  private name(token: Token, depth: number): RollNode {
    const name = token.text;
    if (name === 'true' || name === 'false') {
      return frozen({ kind: 'literal', at: token.at, value: name === 'true' });
    }
    const arity = name === IF ? IF_ARITY : FUNCTIONS.get(name);
    if (arity === undefined) {
      const hint = this.isOp('(') ? '' : ` A path starts with @: @${name}.`;
      throw new Refusal({
        code: 'unknownName',
        name,
        at: token.at,
        message: `Unknown name "${name}" at ${token.at}.${hint}`,
      });
    }
    this.expect('(');
    const inner = this.deeper(depth, token.at);
    const args: RollNode[] = [];
    if (!this.isOp(')')) {
      args.push(this.expression(0, inner));
      while (this.isOp(',')) {
        this.take();
        args.push(this.expression(0, inner));
      }
    }
    this.expect(')');
    if (args.length < arity.min || args.length > (arity.max ?? Number.POSITIVE_INFINITY)) {
      const takes = arity.max === undefined ? `${arity.min} or more` : `${arity.min}`;
      throw new Refusal({
        code: 'argumentCount',
        name,
        found: args.length,
        min: arity.min,
        ...(arity.max === undefined ? {} : { max: arity.max }),
        at: token.at,
        message: `"${name}" at ${token.at} takes ${takes} values, not ${args.length}.`,
      });
    }
    if (name === IF) {
      const [test, then, otherwise] = args as [RollNode, RollNode, RollNode];
      return frozen({ kind: 'choice', at: token.at, test, then, otherwise });
    }
    return frozen({ kind: 'call', at: token.at, name, args: Object.freeze(args) });
  }

  private dice(token: Token): DiceNode {
    const { text: term, at } = token;
    if (!this.rolls) {
      throw new Refusal({
        code: 'diceNotAllowed',
        term,
        at,
        message: `"${term}" at ${at} is a dice term; dice are allowed only in a roll formula.`,
      });
    }
    DICE.lastIndex = 0;
    const [, counted, sided, which, kept] = DICE.exec(term) as RegExpExecArray;
    const count = counted === '' ? 1 : Number(counted);
    const faces = Number(sided);
    const outside = (found: number, { min, max }: { min: number; max: number }) =>
      found < min || found > max;
    if (outside(count, DICE_LIMITS.count)) {
      const { min, max } = DICE_LIMITS.count;
      throw new Refusal({
        code: 'diceCount',
        term,
        found: count,
        min,
        max,
        at,
        message: `"${term}" at ${at} rolls ${count} dice; a term rolls ${min} to ${max}.`,
      });
    }
    if (outside(faces, DICE_LIMITS.faces)) {
      const { min, max } = DICE_LIMITS.faces;
      throw new Refusal({
        code: 'diceFaces',
        term,
        found: faces,
        min,
        max,
        at,
        message: `"${term}" at ${at} has dice of ${faces} faces; a die has ${min} to ${max}.`,
      });
    }
    if (which === undefined) return frozen({ kind: 'dice', at, text: term, count, faces });
    const keeps = kept === '' ? 1 : Number(kept);
    if (outside(keeps, { min: 1, max: count })) {
      throw new Refusal({
        code: 'diceKeep',
        term,
        found: keeps,
        min: 1,
        max: count,
        at,
        message: `"${term}" at ${at} keeps ${keeps} of ${count} dice; it keeps 1 to ${count}.`,
      });
    }
    const keep = Object.freeze({
      which: which.toLowerCase() === 'h' ? ('highest' as const) : ('lowest' as const),
      count: keeps,
    });
    return frozen({ kind: 'dice', at, text: term, count, faces, keep });
  }
}

function parse(text: string, rolls: boolean): ParseResult<ParsedRoll> {
  const limit = FORMULA_LIMITS.length;
  if (text.length > limit) {
    return {
      ok: false,
      error: {
        code: 'tooLong',
        length: text.length,
        limit,
        at: limit,
        message: `The formula is ${text.length} characters long; the limit is ${limit}.`,
      },
    };
  }
  try {
    const parser = new Parser(tokensOf(text), rolls);
    const root = parser.whole();
    const paths = Object.freeze([...parser.paths]);
    return { ok: true, formula: Object.freeze({ text, root, paths }) };
  } catch (thrown) {
    if (thrown instanceof Refusal) return { ok: false, error: thrown.error };
    throw thrown;
  }
}

/** Parses a formula, or says why it does not parse. A dice term is refused. Never throws. */
export function parseFormula(text: string): ParseResult {
  // Dice are refused here, so the tree has none.
  return parse(text, false) as ParseResult;
}

/** Parses a roll formula: a formula whose values may also be dice terms (SPEC §5.6). */
export function parseRoll(text: string): ParseResult<ParsedRoll> {
  return parse(text, true);
}

/**
 * ENG-16: each dice term of a parsed roll formula, in the order written, those in either branch
 * of a `?:` included. None means its value takes no roll (SRD 5.2.1's "fixed damage amount").
 */
export function diceOf(roll: ParsedRoll): DiceNode[] {
  const found: DiceNode[] = [];
  const stack: RollNode[] = [roll.root];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    switch (node.kind) {
      case 'dice':
        found.push(node);
        break;
      case 'unary':
        stack.push(node.operand);
        break;
      case 'binary':
        stack.push(node.right, node.left);
        break;
      case 'choice':
        stack.push(node.otherwise, node.then, node.test);
        break;
      case 'call':
        stack.push(...[...node.args].reverse());
        break;
    }
  }
  return found;
}

// --- The walker ----------------------------------------------------------------------------------

/** A condition's reading of a value: `0`, `false` and `''` are false; anything else is true. */
function truthOf(value: FormulaValue): boolean {
  return value !== 0 && value !== false && value !== '';
}

/** A value as a number: a yes/no as 1 or 0, a text as 0 with a `wrongType` warning. */
function numberOf(value: FormulaValue, at: number, warnings: FormulaWarning[]): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  warnings.push({
    code: 'wrongType',
    at,
    message: `A text is used as a number at ${at}; 0 is used.`,
  });
  return 0;
}

function isValue(raw: unknown): raw is FormulaValue {
  return (
    typeof raw === 'boolean' ||
    typeof raw === 'string' ||
    (typeof raw === 'number' && Number.isFinite(raw))
  );
}

class Walk {
  private readonly values = new Map<string, FormulaValue>();
  readonly warnings: FormulaWarning[] = [];

  private readonly read: FormulaReader;
  private readonly dice: (node: DiceNode) => number;

  constructor(read: FormulaReader, dice: (node: DiceNode) => number) {
    this.read = read;
    this.dice = dice;
  }

  get reads(): string[] {
    return [...this.values.keys()];
  }

  /** A finite number, with `-0` as `0`; anything else warns and gives 0. */
  finite(number: number, at: number): number {
    if (Number.isFinite(number)) return number === 0 ? 0 : number;
    this.warnings.push({
      code: 'notFinite',
      at,
      message: `The value at ${at} is not a finite number (a division by 0, or too large); 0 is used.`,
    });
    return 0;
  }

  /** A value as a number: a yes/no as 1 or 0, a text as 0 with a warning. */
  number(value: FormulaValue, at: number): number {
    return numberOf(value, at, this.warnings);
  }

  private path(path: string): FormulaValue {
    const known = this.values.get(path);
    if (known !== undefined) return known;
    const raw = this.read(path);
    let value: FormulaValue = 0;
    if (raw === undefined) {
      this.warnings.push({ code: 'missingPath', path, message: `Missing: @${path}; 0 is used.` });
    } else if (isValue(raw)) {
      value = raw === 0 ? 0 : raw;
    } else {
      this.warnings.push({
        code: 'notAValue',
        path,
        message: `@${path} is not a number, a yes/no or a text; 0 is used.`,
      });
    }
    this.values.set(path, value);
    return value;
  }

  private numberAt(node: RollNode): number {
    return this.number(this.value(node), node.at);
  }

  value(node: RollNode): FormulaValue {
    switch (node.kind) {
      case 'literal':
        return typeof node.value === 'number' ? this.finite(node.value, node.at) : node.value;
      case 'path':
        return this.path(node.path);
      case 'unary':
        if (node.op === '!') return !truthOf(this.value(node.operand));
        return this.finite(
          node.op === '-' ? -this.numberAt(node.operand) : this.numberAt(node.operand),
          node.at,
        );
      case 'choice':
        return truthOf(this.value(node.test)) ? this.value(node.then) : this.value(node.otherwise);
      case 'call': {
        const args = node.args.map((arg) => this.numberAt(arg));
        return this.finite((FUNCTIONS.get(node.name) as FunctionDef).apply(args), node.at);
      }
      case 'binary':
        return this.binary(node.op, node.left, node.right, node.at);
      case 'dice':
        return this.dice(node);
    }
  }

  private binary(op: BinaryOp, left: RollNode, right: RollNode, at: number): FormulaValue {
    switch (op) {
      case '&&':
        return truthOf(this.value(left)) && truthOf(this.value(right));
      case '||':
        return truthOf(this.value(left)) || truthOf(this.value(right));
      case '==':
        return sameValue(this.value(left), this.value(right));
      case '!=':
        return !sameValue(this.value(left), this.value(right));
    }
    const a = this.numberAt(left);
    const b = this.numberAt(right);
    switch (op) {
      case '<':
        return a < b;
      case '<=':
        return a <= b;
      case '>':
        return a > b;
      case '>=':
        return a >= b;
      case '+':
        return this.finite(a + b, at);
      case '-':
        return this.finite(a - b, at);
      case '*':
        return this.finite(a * b, at);
      case '/':
        return this.finite(a / b, at);
    }
  }
}

/** Two texts compare as text; a text and anything else are unequal; the rest compare as numbers. */
function sameValue(a: FormulaValue, b: FormulaValue): boolean {
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return Number(a) === Number(b);
}

// Never called: `parseFormula` refuses dice, and a `ParsedFormula`'s type has none.
const NO_DICE = (): number => 0;

/**
 * Evaluates a formula against `read`. Never throws: a formula that does not parse gives 0 with
 * its error as the one warning, and the reader is not called.
 */
export function evaluateFormula(
  formula: string | ParsedFormula,
  read: FormulaReader,
): FormulaResult<FormulaValue> {
  const parsed =
    typeof formula === 'string' ? parseFormula(formula) : { ok: true as const, formula };
  if (!parsed.ok) return { value: 0, reads: [], warnings: [parsed.error] };
  const walk = new Walk(read, NO_DICE);
  const value = walk.value(parsed.formula.root);
  return { value, reads: walk.reads, warnings: walk.warnings };
}

/** Evaluates a formula to a number: a yes/no as 1 or 0, a text as 0 with a warning. */
export function evaluateNumber(
  formula: string | ParsedFormula,
  read: FormulaReader,
): FormulaResult<number> {
  const result = evaluateFormula(formula, read);
  const warnings = [...result.warnings];
  return { ...result, value: numberOf(result.value, 0, warnings), warnings };
}

/** Evaluates a formula to `true` or `false`: `0`, `false` and `''` are false. */
export function evaluateCondition(
  formula: string | ParsedFormula,
  read: FormulaReader,
): FormulaResult<boolean> {
  const result = evaluateFormula(formula, read);
  return { ...result, value: truthOf(result.value) };
}

/**
 * Rolls a roll formula: evaluates it to a number as `evaluateNumber` does, rolling each dice term
 * it reaches with `die`; a term in a branch not taken is not rolled. A face that is not one counts
 * as 0, with a warning. Never throws: a formula that does not parse gives 0 with its error as the
 * one warning, and neither the reader nor the die is called.
 */
export function rollFormula(
  formula: string | ParsedRoll,
  read: FormulaReader,
  die: DieSource,
): RollResult {
  const parsed = typeof formula === 'string' ? parseRoll(formula) : { ok: true as const, formula };
  if (!parsed.ok) return { value: 0, reads: [], warnings: [parsed.error], dice: [] };
  const dice: DiceRoll[] = [];
  const walk: Walk = new Walk(read, (node) => {
    const { results, kept, total, badFaces } = rollDice(node, die);
    const { at, text, count, faces, keep } = node;
    if (badFaces > 0) {
      walk.warnings.push({
        code: 'badFace',
        at,
        term: text,
        count: badFaces,
        message: `${badFaces} of the dice of "${text}" at ${at} gave no face from 1 to ${faces}; 0 is used for each.`,
      });
    }
    dice.push({ at, text, count, faces, ...(keep && { keep }), results, kept, total });
    return total;
  });
  const value = walk.number(walk.value(parsed.formula.root), 0);
  return { value, reads: walk.reads, warnings: walk.warnings, dice };
}
