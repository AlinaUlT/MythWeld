import type { ContentIndex } from './content-index';
import {
  type CharacterCore,
  type GatherableEntity,
  type Gathered,
  gather,
  type NamedEntity,
} from './gather';

// The compute pipeline (SPEC §6.1, ADR 004 item 1). The core runs the steps; what only a game
// knows comes from its module. Each step's ticket adds what it gives to `Computed`.

/** What the core asks of a system's module about a character `C`. */
export interface SystemModule<C> {
  /** The character's level: what a grant's `atLevel` is measured against. */
  level(character: C): number;
  /**
   * The entities the module's part of the character names, in order (a fifth-edition species,
   * classes, feats; a Tales calling and talents). `level`, when given, is what that entity's
   * grants are measured against instead (a class's own level).
   */
  entities(character: C): readonly NamedEntity[];
}

/** What `compute()` gives. For now: what the character has (SPEC §6.1 steps 1–2). */
export type Computed<E extends GatherableEntity> = Gathered<E>;

/**
 * Computes a character of a system: `index` holds its active packs (`loadContentIndex`), `system`
 * is its system's module. Pure and deterministic: nothing passed in is changed, and the same
 * arguments give an equal result.
 */
export function compute<C extends CharacterCore<E>, E extends GatherableEntity>(
  character: C,
  index: ContentIndex<E>,
  system: SystemModule<C>,
): Computed<E> {
  return gather(character, index, system.level(character), system.entities(character));
}
