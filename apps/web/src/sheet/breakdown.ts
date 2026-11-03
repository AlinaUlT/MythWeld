// SHEET-33: the lines of a number's breakdown (SPEC §6.2, §7.2): one for each step `compute()` kept,
// each naming its source, from `Computed.breakdown` at the number's path. A step is named by what
// it carries: an entry's own label, a path by its parts (the module says which segment is a stat's
// or a skill's key), a rule by its name, a manual edit as "Manual edit" (§6.1 step 7). Paths are
// read as own fields only: `Computed.breakdown` is a plain object, so `breakdown['toString']` would
// be a function (ENG-40's `RESERVED_KEYS`), and such a path has no steps.
import type { TFunction } from 'i18next';
import type { AppComputed, SheetSystem } from '../systems';
import { nameIn } from './names';
import { numberAt } from './SheetNumber';
import { wordsOf } from './sections/AboutList';

type BreakdownT = TFunction<'breakdown'>;

/** One line of a breakdown. */
export interface BreakdownLine {
  /** What made this part: its source's name, or the step's words. */
  label: string;
  /** How much the number moved with it. */
  change: number;
  /** The number's first part, written without a sign. */
  first: boolean;
  /** A manual edit, which replaces the number (SPEC §6.1 step 7). */
  manual: boolean;
  /** The person's note on a manual edit. */
  note?: string;
}

/** What the breakdown sheet draws for the number at a path. */
export interface BreakdownView {
  /** The number's name: "Athletics", "Strength modifier". */
  name: string;
  total: number | undefined;
  lines: BreakdownLine[];
}

/** The first letter capitalised, the rest as it is. */
function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The words of a computed path: each entry's name, each other segment in the locale's words. */
export function pathName(
  computed: AppComputed,
  system: Pick<SheetSystem, 'pathParts'>,
  path: string,
  t: BreakdownT,
): string {
  const words = system.pathParts(path).flatMap((part) => {
    if (part.type === 'word')
      return [t(`word.${part.word}`, { defaultValue: wordsOf(part.word).toLowerCase() })];
    const kept = Object.hasOwn(computed.byKey, part.entry) ? computed.byKey[part.entry] : undefined;
    const found = kept !== undefined && Object.hasOwn(kept, part.key) ? kept[part.key] : undefined;
    return [found === undefined ? wordsOf(part.key) : nameIn(found.name)];
  });
  return capital(words.filter((word) => word !== '').join(' '));
}

/** The steps of the number at `path`; none when `compute()` kept none for it. */
export function stepsAt(computed: AppComputed, path: string) {
  return Object.hasOwn(computed.breakdown, path) ? (computed.breakdown[path] ?? []) : [];
}

export function breakdownOf(
  computed: AppComputed,
  system: Pick<SheetSystem, 'pathParts'>,
  path: string,
  t: BreakdownT,
): BreakdownView {
  const steps = stepsAt(computed, path);
  // A zero-valued path step is a bonus slot nothing filled; it says nothing, unless nothing else does.
  const said = steps.filter((step) => !(step.kind === 'path' && step.change === 0));
  const shown = said.length === 0 ? steps : said;
  const lines = shown.map((step, at): BreakdownLine => {
    const line = { change: step.change, first: at === 0, manual: false };
    switch (step.kind) {
      case 'base':
        return { ...line, label: t('step.base') };
      case 'default':
        return { ...line, label: t(`step.default.${step.of}`) };
      case 'grant':
      case 'effect':
      case 'entity':
      case 'condition':
        return { ...line, label: nameIn(step.label) };
      case 'cap':
        return { ...line, label: t('step.cap') };
      case 'level':
        return { ...line, label: t('step.level') };
      case 'formula':
        return { ...line, label: t('step.formula', { formula: step.formula }) };
      case 'path':
        return { ...line, label: pathName(computed, system, step.path, t) };
      case 'rule':
        return {
          ...line,
          label: t(`rule.${step.rule}`, {
            defaultValue: capital(wordsOf(step.rule).toLowerCase()),
          }),
        };
      case 'override':
        return {
          ...line,
          label: t('manual'),
          manual: true,
          ...(step.note !== undefined && step.note !== '' && { note: step.note }),
        };
      default:
        return { ...line, label: t('step.unknown') };
    }
  });
  return { name: pathName(computed, system, path, t), total: numberAt(computed, path), lines };
}
