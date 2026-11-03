import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import i18n from '../src/i18n';
import {
  choiceEntry,
  entityOfPart,
  patternsOf,
  pickName,
  picksLeft,
  picksOf,
  storedPicks,
} from '../src/sheet/choices';
import { ChoicesPanel } from '../src/sheet/panels/ChoicesPanel';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-36: the choices panel on golden B (SPEC §6.7: a human fighter 1, Soldier), whose seven
// choices are in its file. With them taken out each is pending; with the size taken out the human's
// own choice of Small or Medium is a pending key. The words are the packs' and the English locale's.

void i18n;
const packs = installBuiltInPacks().packs;

function sheetOf(change: object = {}): SheetValue {
  const character: AppCharacter = fifthEditionCharacterSchema.parse({ ...goldenB, ...change });
  const system = sheetSystemOf(character);
  if (system === undefined) throw new Error('no sheet');
  const content = contentOf(character, packs);
  const computed = compute(character, content.index, system.module);
  return {
    character,
    content,
    computed,
    system,
    editing: false,
    roll: () => {},
    breakdown: () => {},
  };
}

const withoutSize = {
  systemData: { ...goldenB.systemData, species: { id: 'srd-2024:species/human' } },
};

function drawn(sheet: SheetValue): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <ChoicesPanel onClose={() => {}} />
      </SheetContext>
    </MemoryRouter>,
  );
}

const parts = (html: string) => [...html.matchAll(/data-part="([^"]+)"/g)].map((found) => found[1]);

describe('SHEET-36 what needs choosing', () => {
  it('says nothing is left for a character that made every choice', () => {
    const sheet = sheetOf();
    expect([sheet.computed.pendingChoices, sheet.computed.pendingKeys]).toEqual([[], []]);
    expect(drawn(sheet)).toContain('Nothing is left to choose.');
  });

  it('lists each of golden B’s seven choices once its picks are taken out', () => {
    const sheet = sheetOf({ choices: {} });
    const html = drawn(sheet);
    expect(parts(html).sort()).toEqual(Object.keys(goldenB.choices).sort());
    expect(sheet.computed.pendingChoices).toHaveLength(7);
    expect(html).not.toContain('Nothing is left to choose.');
    expect(html).toContain('>Fighter</h3>');
    expect(html).toContain('>Soldier</h3>');
  });

  it('shows what a choice gives, how many picks it needs and its options by name', () => {
    const html = drawn(sheetOf({ choices: {} }));
    const fighter = html.split('data-part="srd-2024:class/fighter#skills"')[1] ?? '';
    const section = fighter.slice(0, fighter.indexOf('</section>'));
    expect(section).toContain('Skill proficiency: choose 2 more');
    expect(section).toContain('aria-label="Pick Acrobatics"');
    expect(section).toContain('aria-label="Pick Survival"');
  });

  it('shows a pick made as a chip to take back, and needs one fewer: Perception of two', () => {
    const html = drawn(sheetOf({ choices: { 'srd-2024:class/fighter#skills': ['perception'] } }));
    const section = (html.split('data-part="srd-2024:class/fighter#skills"')[1] ?? '').split(
      '</section>',
    )[0];
    expect(section).toContain('choose 1 more');
    expect(section).toContain('aria-label="Take back Perception"');
    expect(section).not.toContain('aria-label="Pick Perception"');
  });

  it('lists the size of a species that offers several as a pending key, answered from its list', () => {
    const sheet = sheetOf(withoutSize);
    expect(sheet.computed.pendingKeys.map(({ path }) => path)).toEqual(['size']);
    const html = drawn(sheet);
    expect(html).toContain('data-path="size"');
    expect(html).toContain('>Size</h3>');
    expect(html).toContain('aria-label="Pick Small"');
    expect(html).toContain('aria-label="Pick Medium"');
  });
});

describe('SHEET-36 the changes a pick makes', () => {
  it('stores the picks in order as one change, with the stored ones as before', () => {
    const sheet = sheetOf({ choices: { 'srd-2024:class/fighter#skills': ['perception'] } });
    const entry = choiceEntry(sheet.character, 'srd-2024:class/fighter#skills', [
      'perception',
      'survival',
    ]);
    expect(entry.action).toBe('setChoice');
    expect(entry.subject).toBe('srd-2024:class/fighter#skills');
    expect(entry.by).toEqual({ role: 'player', name: 'Golden B', actorId: goldenB.id });
    expect(entry.changes).toEqual([
      {
        path: ['choices', 'srd-2024:class/fighter#skills'],
        before: ['perception'],
        after: ['perception', 'survival'],
      },
    ]);
  });

  it('removes the stored choice when the last pick is taken back', () => {
    const sheet = sheetOf();
    expect(choiceEntry(sheet.character, 'srd-2024:class/fighter#skills', []).changes).toEqual([
      { path: ['choices', 'srd-2024:class/fighter#skills'], before: ['perception', 'survival'] },
    ]);
  });

  it('reads the stored picks as own fields only', () => {
    const sheet = sheetOf();
    expect(storedPicks(sheet.character, 'srd-2024:class/fighter#skills')).toEqual([
      'perception',
      'survival',
    ]);
    expect(storedPicks(sheet.character, 'srd-2024:feature/nothing#skills')).toEqual([]);
  });

  it('answers the size where the module keeps it: systemData.species.size', () => {
    const sheet = sheetOf(withoutSize);
    const answer = sheet.system.pendingKey('size');
    expect(answer?.type).toBe('size');
    expect(answer?.answer(sheet.character, 'small')).toEqual([
      { path: ['systemData', 'species', 'size'], after: 'small' },
    ]);
    expect(sheet.system.pendingKey('toString')).toBeUndefined();
    expect(sheet.system.pendingKey('ac.total')).toBeUndefined();
  });
});

describe('SHEET-36 the words of a choice', () => {
  const sheet = sheetOf({ choices: {} });
  const [skills] = sheet.computed.pendingChoices.filter(
    ({ part }) => part === 'srd-2024:class/fighter#skills',
  );
  const scores = sheet.computed.pendingChoices.find(({ part }) => part.endsWith('#ability-scores'));

  it('counts the picks a choice takes, and the ones it still needs', () => {
    if (skills === undefined || scores === undefined) throw new Error('no such choice');
    expect(picksOf(skills)).toBe(2);
    expect(picksLeft(skills)).toBe(2);
    expect(entityOfPart('srd-2024:class/fighter#skills')).toBe('srd-2024:class/fighter');
    expect(entityOfPart('plain')).toBe('plain');
    // Soldier’s ability scores: SRD 5.2.1 gives +2 and +1, or +1 +1 +1, in the order picked.
    expect(patternsOf(scores)).toEqual([
      [2, 1],
      [1, 1, 1],
    ]);
    expect(picksOf(scores)).toBe(3);
    expect(patternsOf(skills)).toEqual([]);
  });

  it('names a skill, a stat and a missing entry; and a key no entry has in its own words', () => {
    if (skills === undefined || scores === undefined) throw new Error('no such choice');
    const name = (choice: typeof skills, pick: string) =>
      pickName(
        sheet.computed,
        sheet.system,
        sheet.content.index,
        choice,
        pick,
        (id) => `Missing: ${id}`,
      );
    expect(name(skills, 'sleightOfHand')).toBe('Sleight of Hand');
    expect(name(scores, 'str')).toBe('Strength');
    expect(name(skills, 'srd-2024:feat/alert')).toBe('Alert');
    expect(name(skills, 'srd-2024:feat/nothing')).toBe('Missing: srd-2024:feat/nothing');
    expect(name(skills, 'madeUpKey')).toBe('Made up key');
  });
});
