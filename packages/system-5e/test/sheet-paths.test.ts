import { describe, expect, it } from 'vitest';
import { fifthEditionPathParts } from '../src/index.ts';

// SHEET-33: how the module says a computed path is named: the entry it names by key, then words.

describe('SHEET-33 the parts of a computed path', () => {
  it('names a stat, a skill and a class by key, then the rest as words', () => {
    expect(fifthEditionPathParts('abilities.str.mod')).toEqual([
      { type: 'entry', entry: 'ability', key: 'str' },
      { type: 'word', word: 'mod' },
    ]);
    expect(fifthEditionPathParts('skills.athletics.total')).toEqual([
      { type: 'entry', entry: 'skill', key: 'athletics' },
      { type: 'word', word: 'total' },
    ]);
    expect(fifthEditionPathParts('classes.wizard.spell.dc')).toEqual([
      { type: 'entry', entry: 'class', key: 'wizard' },
      { type: 'word', word: 'spell' },
      { type: 'word', word: 'dc' },
    ]);
  });

  it('says a stat’s plain check is a check, and the proficiency bonus is its own word', () => {
    expect(fifthEditionPathParts('checks.dex.total')).toEqual([
      { type: 'entry', entry: 'ability', key: 'dex' },
      { type: 'word', word: 'check' },
      { type: 'word', word: 'total' },
    ]);
    expect(fifthEditionPathParts('prof')).toEqual([{ type: 'word', word: 'proficiencyBonus' }]);
  });

  it('gives one word for each segment of any other path, and never throws on an odd one', () => {
    expect(fifthEditionPathParts('ac.total')).toEqual([
      { type: 'word', word: 'ac' },
      { type: 'word', word: 'total' },
    ]);
    expect(fifthEditionPathParts('skills')).toEqual([{ type: 'word', word: 'skills' }]);
    expect(fifthEditionPathParts('abilities.')).toEqual([
      { type: 'word', word: 'abilities' },
      { type: 'word', word: '' },
    ]);
    expect(fifthEditionPathParts('toString')).toEqual([{ type: 'word', word: 'toString' }]);
  });
});
