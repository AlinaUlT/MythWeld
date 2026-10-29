import { STAT_TYPE } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import { fifthEditionKeyAnswer, fifthEditionKeyTypes, SIZE_PATH } from '../src/index.ts';

describe('SHEET-36 where the sheet stores an answer', () => {
  it('stores a size in the species, and knows no other key path', () => {
    expect(fifthEditionKeyAnswer(SIZE_PATH)).toEqual(['systemData', 'species', 'size']);
    expect(fifthEditionKeyAnswer('speed.walk')).toBeUndefined();
    expect(fifthEditionKeyAnswer('constructor')).toBeUndefined();
  });

  it("names the entity type of each proficiency category's keys", () => {
    expect(fifthEditionKeyTypes('skill')).toEqual(['skill']);
    expect(fifthEditionKeyTypes('language')).toEqual(['language']);
    expect(fifthEditionKeyTypes('save')).toEqual([STAT_TYPE]);
    for (const category of ['weapon', 'armor', 'tool', 'mastery']) {
      expect(fifthEditionKeyTypes(category)).toEqual(['item']);
    }
    expect(fifthEditionKeyTypes(SIZE_PATH)).toEqual(['size']);
    expect(fifthEditionKeyTypes('spell')).toEqual([]);
    expect(fifthEditionKeyTypes('toString')).toEqual([]);
  });
});
