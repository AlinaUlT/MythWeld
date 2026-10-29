import type { FifthEditionCharacter } from './character';

// SHEET-24: what a list of characters names under a fifth-edition character's name (board
// `V3-Characters`): its species, then each class with its level, in the order taken. The screen
// looks each id up in the character's packs; a lineage stays out, as the board names the species.

/** An entity a list card names, with its level when it is a class. */
export interface ListLinePart {
  id: string;
  level?: number;
}

/** The species' id, then each class's id with its level, in the order taken. */
export function fifthEditionListLine({
  systemData,
}: Pick<FifthEditionCharacter, 'systemData'>): ListLinePart[] {
  const species = systemData.species === undefined ? [] : [{ id: systemData.species.id }];
  return [...species, ...systemData.classes.map(({ id, level }) => ({ id, level }))];
}
