import type { BreakdownStep, DerivedStep, DeriveInput } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { classesOf } from './classes';
import type { FifthEditionEntity } from './entity-types';
import { HIT_DIE_SIZES } from './system';

// ENG-21: a character's hit dice, by size (SPEC §6.4's rests spend and regain them): each class
// gives one die of its `hitDie` per level, as SRD 5.1's "maximum number of Hit Dice, which is
// equal to the character's level" (ENG-21 §8). Every size has its path, 0 when no class has it;
// an effect or an override changes it as any derived value.

/** The path of the character's hit dice of `die` faces: `hitDice.d10.max`. */
export function hitDicePath(die: number): string {
  return `hitDice.d${die}.max`;
}

/** Each size's hit dice: the levels of the classes with that die, one step per class. */
export function hitDiceSteps({
  character,
  gathered,
}: DeriveInput<FifthEditionCharacter, FifthEditionEntity>): Record<string, DerivedStep> {
  const classes = classesOf(character, gathered);
  return Object.fromEntries(
    HIT_DIE_SIZES.map((die): [string, DerivedStep] => {
      const steps = classes
        .filter(({ entity }) => entity.hitDie === die)
        .map(
          ({ entity, level }): BreakdownStep => ({
            kind: 'entity',
            source: entity.id,
            label: entity.name,
            value: level,
            change: level,
          }),
        );
      const value = steps.reduce((sum, step) => sum + step.change, 0);
      return [hitDicePath(die), () => ({ value, steps })];
    }),
  );
}
