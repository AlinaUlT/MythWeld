// SHEET-33: what a number's breakdown says (SPEC §6.2, §7.2): its name, its value, and one line per
// step of `Computed.breakdown[path]`, each naming where it came from. The screen reads only own
// fields of `Computed` (ENG-40: a path may be `toString`), and every word goes through i18next.
import type { BreakdownStep } from '@grimoire/engine';
import { STAT_TYPE } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { TFunction } from 'i18next';
import { en } from '../i18n/namespaces';
import { numberAt } from '../sheet/SheetNumber';
import type { AppComputed } from '../systems';

type BreakdownT = TFunction<'breakdown'>;
type NameKey = keyof typeof en.breakdown.names;
type FieldKey = keyof typeof en.breakdown.fields;
type RuleKey = keyof typeof en.breakdown.rules;

/** One line of a breakdown: what it is, where it came from, how much it moved the number. */
export interface BreakdownLine {
  name: string;
  /** Where it came from, when its name does not say. */
  detail?: string;
  change: number;
  /** The line is the person's own edit (SPEC §6.1 step 7). */
  manual: boolean;
}

export interface Breakdown {
  /** The number's name: "Armor class", "STR modifier". */
  name: string;
  value: number | undefined;
  lines: BreakdownLine[];
  /** A manual edit decided the value. */
  manual: boolean;
}

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/** What the key `key` names, as a short subject: a stat's abbreviation, else an entry's name. */
function subjectOf(computed: AppComputed, key: string): string | undefined {
  const stat = Object.hasOwn(computed.byKey, STAT_TYPE) ? computed.byKey[STAT_TYPE] : undefined;
  const found = stat !== undefined && Object.hasOwn(stat, key) ? stat[key] : undefined;
  if (found?.type === STAT_TYPE) return nameIn(found.abbr);
  for (const entities of Object.values(computed.byKey)) {
    if (Object.hasOwn(entities, key)) return nameIn(entities[key]?.name ?? {});
  }
  return undefined;
}

/**
 * A computed path in words: a fixed one by its entry, `<group>.<key>.<field>` by the key's entry
 * and the field's word, any other as the path itself.
 */
export function pathName(path: string, computed: AppComputed, t: BreakdownT): string {
  const id = path.replaceAll('.', '_');
  if (Object.hasOwn(en.breakdown.names, id)) return t(`names.${id as NameKey}`);
  const [group, key, ...field] = path.split('.');
  // An ability's check says so; the same word under `abilities` means the stat itself.
  const fieldId = (group === 'checks' ? ['check', ...field] : field).join('_');
  if (key !== undefined && fieldId !== '' && Object.hasOwn(en.breakdown.fields, fieldId)) {
    const subject = subjectOf(computed, key);
    if (subject !== undefined) {
      return t('subjectField', { subject, field: t(`fields.${fieldId as FieldKey}`) });
    }
  }
  return path;
}

function ruleName(rule: string, t: BreakdownT): string {
  return Object.hasOwn(en.breakdown.rules, rule)
    ? t(`rules.${rule as RuleKey}`)
    : t('rules.other', { rule });
}

function nameAndDetail(
  step: BreakdownStep,
  computed: AppComputed,
  t: BreakdownT,
): { name: string; detail?: string } {
  switch (step.kind) {
    case 'base':
      return { name: t('step.base') };
    case 'default':
      return { name: t(step.of === 'stat' ? 'step.defaultStat' : 'step.defaultSystem') };
    case 'grant':
      return {
        name: nameIn(step.label),
        detail:
          step.formula === undefined
            ? t('step.grant')
            : t('step.grantFormula', { formula: step.formula }),
      };
    case 'effect':
      return { name: nameIn(step.label), detail: t('step.effect') };
    case 'cap':
      return { name: t('step.cap') };
    case 'level':
      return { name: t('step.level') };
    case 'formula':
      return { name: t(`step.formulaOf.${step.of}`), detail: step.formula };
    case 'entity':
      return { name: nameIn(step.label), detail: step.formula };
    case 'path':
      return { name: pathName(step.path, computed, t) };
    case 'rule':
      return { name: ruleName(step.rule, t) };
    case 'condition':
      return { name: nameIn(step.label), detail: t('step.condition') };
    case 'override':
      return { name: t('step.override'), detail: step.note };
  }
}

/**
 * The breakdown of the number at `path`. A path step that moved nothing is a modifier the
 * character has none of, so it is not a line; every other step is.
 */
export function breakdownOf(computed: AppComputed, path: string, t: BreakdownT): Breakdown {
  const steps = Object.hasOwn(computed.breakdown, path) ? (computed.breakdown[path] ?? []) : [];
  const lines = steps
    .filter((step) => step.kind !== 'path' || step.change !== 0)
    .map((step): BreakdownLine => {
      const { name, detail } = nameAndDetail(step, computed, t);
      return {
        name,
        change: step.change,
        manual: step.kind === 'override',
        ...(detail !== undefined && detail !== '' && { detail }),
      };
    });
  return {
    name: pathName(path, computed, t),
    value: numberAt(computed, path),
    lines,
    manual: steps.some((step) => step.kind === 'override'),
  };
}
