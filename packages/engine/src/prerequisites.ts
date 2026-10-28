import type { EntityId, Prerequisite } from '@grimoire/schema';
import { evaluateCondition, type FormulaValue, type FormulaWarning } from './formula';
import type { GatherableEntity, HadEntity, ProficiencyGiven } from './gather';

// SHEET-14: SPEC §5.5, §8.2. Each entity the character has is checked against the prerequisites
// that apply to it, on the computed values; each one unmet is a warning, never a block, so the
// entity's effects and grants apply all the same.

/** Something the prerequisites met. `code` and its data are for the screen; `message` for logs. */
export type PrerequisiteWarning = { message: string } & (
  | { code: 'unmetPrerequisite'; entity: EntityId; prerequisite: Prerequisite }
  | { code: 'prerequisiteFormula'; entity: EntityId; warning: FormulaWarning }
);

/** What a prerequisite is checked against: the character's values, entities and proficiencies. */
export interface PrerequisiteInput<E extends GatherableEntity> {
  entities: readonly HadEntity<E>[];
  proficiencies: readonly ProficiencyGiven[];
  values: Readonly<Record<string, FormulaValue>>;
  /** The prerequisites that apply to an entity on this character. */
  prerequisitesOf: (entity: E) => readonly Prerequisite[];
}

/** A value as a number: one that is not a number, or is missing, reads as 0. */
function numberAt(values: Readonly<Record<string, FormulaValue>>, path: string): number {
  const value = values[path];
  return typeof value === 'number' ? value : 0;
}

/** A warning for each prerequisite an entity the character has does not meet, in their order. */
export function prerequisiteWarnings<E extends GatherableEntity>(
  input: PrerequisiteInput<E>,
): PrerequisiteWarning[] {
  const { entities, proficiencies, values } = input;
  const had = new Set<string>(entities.map(({ entity }) => entity.id));
  const read = (path: string) => values[path];
  const warnings: PrerequisiteWarning[] = [];
  for (const { entity } of entities) {
    for (const prerequisite of input.prerequisitesOf(entity)) {
      let met: boolean;
      switch (prerequisite.kind) {
        case 'ability':
          met = numberAt(values, `abilities.${prerequisite.key}.score`) >= prerequisite.min;
          break;
        case 'level':
          met = numberAt(values, 'level') >= prerequisite.min;
          break;
        case 'entity':
          met = had.has(prerequisite.id);
          break;
        case 'proficiency':
          met = proficiencies.some(
            ({ category, key }) => category === prerequisite.category && key === prerequisite.key,
          );
          break;
        case 'formula': {
          const result = evaluateCondition(prerequisite.formula, read);
          for (const warning of result.warnings) {
            warnings.push({
              code: 'prerequisiteFormula',
              entity: entity.id,
              warning,
              message: `A prerequisite of ${entity.id}: ${warning.message}`,
            });
          }
          met = result.value;
          break;
        }
      }
      if (!met) {
        warnings.push({
          code: 'unmetPrerequisite',
          entity: entity.id,
          prerequisite,
          message: `${entity.id} has a prerequisite the character does not meet: ${describe(prerequisite)}.`,
        });
      }
    }
  }
  return warnings;
}

/** A prerequisite in words, for logs. */
function describe(prerequisite: Prerequisite): string {
  switch (prerequisite.kind) {
    case 'ability':
      return `${prerequisite.key} ${prerequisite.min}`;
    case 'level':
      return `level ${prerequisite.min}`;
    case 'entity':
      return prerequisite.id;
    case 'proficiency':
      return `${prerequisite.category} ${prerequisite.key}`;
    case 'formula':
      return prerequisite.formula;
  }
}
