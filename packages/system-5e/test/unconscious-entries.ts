import { loadContentIndex } from '@grimoire/engine';
import type { z } from 'zod';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  type fifthEditionEntitySchema,
  openFifthEditionPack,
  UNCONSCIOUS_CONDITION,
} from '../src/index.ts';
import { opened } from './golden/checks.ts';
import { srd2014, srd2024 } from './golden/index.ts';

// ENG-62's Unconscious entries, which ENG-65's test shares. They are written here, a name and a
// number only: each sets `speed.all.mul` to 0 (SRD 5.1 "can't move", SRD 5.2.1 "Your Speed is 0",
// ENG-62 §8).

type EntityInput = z.input<typeof fifthEditionEntitySchema>;
export type Edition = '2014' | '2024';

export const UNCONSCIOUS_2014 = 'srd-2014:condition/unconscious';
export const UNCONSCIOUS_2024 = 'srd-2024:condition/unconscious';

/** An edition's Unconscious condition: its key, and its speed set to 0. */
export function unconscious(ruleset: Edition): Extract<EntityInput, { type: 'condition' }> {
  return {
    id: ruleset === '2014' ? UNCONSCIOUS_2014 : UNCONSCIOUS_2024,
    type: 'condition',
    key: UNCONSCIOUS_CONDITION,
    ruleset,
    name: { en: 'Unconscious' },
    source: { pack: `srd-${ruleset}` },
    effects: [{ id: 'speed-0', target: 'speed.all.mul', op: 'set', value: 0 }],
  };
}

/** The 2014 pack with its Unconscious entry. */
export const with2014 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(
    openFifthEditionPack({ ...srd2014, entities: [...srd2014.entities, unconscious('2014')] }),
  ),
]).index;
/** The 2024 pack with its Unconscious entry. */
export const with2024 = loadContentIndex(FIFTH_EDITION_SYSTEM, [
  opened(
    openFifthEditionPack({ ...srd2024, entities: [...srd2024.entities, unconscious('2024')] }),
  ),
]).index;

/** The pack of the character's edition, with its Unconscious entry. */
export const withEntry = (character: FifthEditionCharacter) =>
  character.ruleset === '2014' ? with2014 : with2024;
