import type { SystemModule } from '@grimoire/engine';
import type { TalesCharacter } from '../../schema/test/tales/index.ts';

// Tales' module (ENG-27), as far as the core asks of it so far: the character's level, and the
// entities its part names, the calling first, then the talents.

export const talesModule: SystemModule<TalesCharacter> = {
  level: (character) => character.systemData.level,
  entities: (character) =>
    [character.systemData.calling, ...character.systemData.talents].map((id) => ({ id })),
};
