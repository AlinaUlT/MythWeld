import type { GrantOf } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_PENDING_KEYS,
  type FifthEditionEntity,
  fifthEditionOptionType,
  SIZE_PATH,
} from '../src/index.ts';

// SHEET-36: which entry names each key a pending choice offers. The pairs are the ones the packs'
// grants use (checked on the built-in packs by the web app's choices test): a skill proficiency
// offers skill keys, a save proficiency stat keys, a mastery proficiency weapon keys (ENG-16).

type Grant = GrantOf<FifthEditionEntity>;

const proficiency = (category: string): Grant =>
  ({ id: 'p', kind: 'proficiency', category, choose: { count: 1, from: ['x'] } }) as Grant;

describe('SHEET-36 the entries that name a choice', () => {
  it('names the entity type of the keys each proficiency category offers', () => {
    const types = Object.fromEntries(
      ['skill', 'save', 'armor', 'weapon', 'tool', 'language', 'mastery'].map((category) => [
        category,
        fifthEditionOptionType(proficiency(category)),
      ]),
    );
    expect(types).toEqual({
      skill: 'skill',
      save: 'ability',
      armor: 'item',
      weapon: 'item',
      tool: 'toolKind',
      language: 'language',
      mastery: 'item',
    });
  });

  it('names the stat of a distributed ability score, and nothing for a grant of entities', () => {
    const distribute = {
      id: 'a',
      kind: 'abilityScore',
      mode: 'distribute',
      from: ['str'],
      patterns: [[1]],
    } as Grant;
    expect(fifthEditionOptionType(distribute)).toBe('ability');
    const feat = { id: 'f', kind: 'entity', choose: { count: 1, from: { type: 'feat' } } } as Grant;
    expect(fifthEditionOptionType(feat)).toBeUndefined();
  });

  it('names nothing for a category it does not know, and not a prototype field', () => {
    expect(fifthEditionOptionType(proficiency('mystery'))).toBeUndefined();
    expect(fifthEditionOptionType(proficiency('constructor'))).toBeUndefined();
  });

  it("stores the species' size in the species, as ENG-48 reads it", () => {
    expect(FIFTH_EDITION_PENDING_KEYS[SIZE_PATH]).toEqual({
      type: 'size',
      place: ['systemData', 'species', 'size'],
    });
  });
});
