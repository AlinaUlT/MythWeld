import type { Gathered } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { ClassDef, FifthEditionEntity, SubclassDef } from './entity-types';

// ENG-13: the classes a character has, as the module's steps read them; moved here by ENG-15,
// which also reads each class's subclass.

/** A class the character has, with its level and the subclass `systemData` names for it. */
export interface HadClass {
  entity: ClassDef;
  level: number;
  subclass?: SubclassDef;
}

/** The character's level: its classes' levels added up. */
export function characterLevel({ systemData }: Pick<FifthEditionCharacter, 'systemData'>): number {
  return systemData.classes.reduce((sum, entry) => sum + entry.level, 0);
}

/** Each class the character has that a pack holds, with its level, in the order taken. */
export function classesOf(
  character: FifthEditionCharacter,
  gathered: Gathered<FifthEditionEntity>,
): HadClass[] {
  const had = new Map(gathered.entities.map(({ entity }) => [entity.id as string, entity]));
  return character.systemData.classes.flatMap(({ id, level, subclass: subclassId }) => {
    const entity = had.get(id);
    if (entity?.type !== 'class') return [];
    const subclass = subclassId === undefined ? undefined : had.get(subclassId);
    return [{ entity, level, ...(subclass?.type === 'subclass' && { subclass }) }];
  });
}
