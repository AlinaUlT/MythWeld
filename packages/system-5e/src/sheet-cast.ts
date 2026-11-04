import type { Computed } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { classesOf } from './classes';
import type { FifthEditionEntity } from './entity-types';

// SHEET-47: what the cast panel asks of a fifth-edition character beyond the cast itself
// (`castSpell`, ENG-20): the stat the spell is cast with, which a spell's `@mod` reads (ENG-53), so
// the panel shows the dice the cast will roll.

/**
 * The stat `spell` is cast with: the spellcasting stat of the class, or the subclass, whose list
 * holds it; failing that, the stat of the one class that casts. None when the character has no
 * such class, or more than one and the spell is in none of their lists (a spell a feature grants
 * names no stat of its own here: its `@mod` then stays, which a roll reads as 0, and warns).
 */
export function spellCastingStat(
  character: FifthEditionCharacter,
  computed: Pick<Computed<FifthEditionEntity>, 'entities'>,
  spell: string,
): string | undefined {
  const casters = classesOf(character, computed).flatMap(({ entity, subclass }) => {
    const ability = (entity.spellcasting ?? subclass?.spellcasting)?.ability;
    return ability === undefined
      ? []
      : [{ owners: [entity.id as string, ...(subclass ? [subclass.id as string] : [])], ability }];
  });
  const lists: Readonly<
    Record<string, { known?: readonly string[]; prepared?: readonly string[] } | undefined>
  > = character.systemData.spells;
  const listed = (owner: string) => {
    const { known = [], prepared = [] } = lists[owner] ?? {};
    return known.includes(spell) || prepared.includes(spell);
  };
  const holder = casters.find(({ owners }) => owners.some(listed));
  if (holder !== undefined) return holder.ability;
  return casters.length === 1 ? casters[0]?.ability : undefined;
}
