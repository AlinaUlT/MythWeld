import type { DeriveInput, KeyPath, RuleWarning } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity, LineageDef, SpeciesDef } from './entity-types';

// ENG-48: the character's size, the key path `size`, one rule in both editions (ENG-48 §8). Its
// sizes are a gathered lineage's own, else the species'. Of one size, that size; of several, the
// one stored in `species.size`, else it is pending. An effect or an override may set it to any of
// them (ENG-43). SHEET-08: an effect or an override may also set any size an entry of the type
// `size` names (SRD 5.2.1's goliath, Large Form: "you can change your size to Large"); the choice
// still offers the species' own.

/** The character's size: a key, not a number. */
export const SIZE_PATH = 'size';

/** The entity type whose keys a size is (`entity-types.ts`). */
export const SIZE_TYPE = 'size';

/** The sizes the character's species offers: a gathered lineage's own, else the species'. */
function sizeGiver({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): SpeciesDef | LineageDef | undefined {
  const id = character.systemData.species?.id;
  let species: SpeciesDef | undefined;
  for (const { entity } of gathered.entities) {
    if (entity.type === 'lineage' && entity.size !== undefined) return entity;
    if (entity.type === 'species' && entity.id === id) species = entity;
  }
  return species;
}

/**
 * The size key path: the size of a species with one, else the one chosen in `species.size`, each
 * with a step naming the species or lineage; with none chosen, no key. A stored size it does not
 * offer is warned and not used. Its options are the sizes offered; its keys, every `size` entry's
 * key, then any size offered with no entry. Nothing when the character has no species.
 */
export function sizeKeys(
  input: DeriveInput<FifthEditionCharacter, FifthEditionEntity>,
): Record<string, KeyPath> {
  const giver = sizeGiver(input);
  const sizes = giver?.size;
  if (giver === undefined || sizes === undefined) return {};
  const stored = input.character.systemData.species?.size;
  const ruleWarnings: RuleWarning[] = [];
  if (stored !== undefined && !sizes.includes(stored)) {
    ruleWarnings.push({
      rule: 'sizeNotOffered',
      data: { size: stored, from: giver.id },
      message: `The stored size "${stored}" is not one "${giver.id}" offers (${sizes.join(', ')}); it is not used.`,
    });
  }
  const key = sizes.length === 1 ? sizes[0] : sizes.find((size) => size === stored);
  const { id: source, name: label } = giver;
  const entries = Object.keys(input.gathered.byKey[SIZE_TYPE] ?? {});
  const keys = [...entries, ...sizes.filter((size) => !entries.includes(size))];
  return {
    [SIZE_PATH]: {
      ...(key !== undefined && { key }),
      steps: key === undefined ? [] : [{ kind: 'entity', source, label, key }],
      keys,
      options: sizes,
      ...(ruleWarnings.length > 0 && { ruleWarnings }),
    },
  };
}
