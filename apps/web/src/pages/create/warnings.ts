// SHEET-27: the warnings the manual form shows, each under the pick it is about (BRIEF P3: inline,
// in amber, never blocking "Create"). A step shows what `compute()` says of the entities the person
// picked in it: missing from the packs, of the other edition, a prerequisite not met, no starting
// languages. What those entities give in turn (a species' features) is not repeated under them.
// Two ability score increases from two editions are SHEET-29's window; a pending choice is the
// sheet's badge (SHEET-36).
import type { Computed } from '@grimoire/engine';
import type { AppEntity } from '../../content/packs';
import { nameIn } from './draft';

/** One warning as the screen words it: a key under `create:warn` and its values. */
export interface FormWarning {
  key:
    | 'missing'
    | 'otherRuleset'
    | 'otherRulesetNotMixing'
    | 'prerequisite'
    | 'prerequisiteNamed'
    | 'prerequisiteScore'
    | 'noStartingLanguages';
  values: Readonly<Record<string, string | number>>;
}

/** The warnings `computed` gives about the picked entity `id`, in its order. */
export function warningsAbout(computed: Computed<AppEntity>, id: string): FormWarning[] {
  const stats = computed.byKey.ability ?? {};
  const shown: FormWarning[] = [];
  for (const warning of computed.warnings) {
    switch (warning.code) {
      case 'missing':
        if (warning.id === id) shown.push({ key: 'missing', values: { id } });
        break;
      case 'otherRuleset':
        if (warning.entity === id) {
          shown.push({
            key: warning.mixingAllowed ? 'otherRuleset' : 'otherRulesetNotMixing',
            values: { ruleset: warning.ruleset },
          });
        }
        break;
      case 'unmetPrerequisite': {
        if (warning.entity !== id) break;
        const { prerequisite } = warning;
        if (prerequisite.kind === 'formula') {
          shown.push({ key: 'prerequisiteNamed', values: { label: nameIn(prerequisite.label) } });
        } else if (prerequisite.kind === 'ability') {
          const stat = stats[prerequisite.key];
          const name = stat === undefined ? prerequisite.key : nameIn(stat.name);
          shown.push({ key: 'prerequisiteScore', values: { stat: name, min: prerequisite.min } });
        } else {
          shown.push({ key: 'prerequisite', values: {} });
        }
        break;
      }
      case 'characterRule':
        if (warning.rule === 'noStartingLanguages' && warning.data?.entity === id) {
          shown.push({ key: 'noStartingLanguages', values: {} });
        }
        break;
      default:
        break;
    }
  }
  return shown;
}
