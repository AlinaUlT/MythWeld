import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import { recordChange, undoChange } from '../src/db/history';
import i18n from '../src/i18n';
import { en } from '../src/i18n/namespaces';
import {
  choiceRows,
  type DistributeRow,
  type KeyRow,
  keyEntry,
  keyWords,
  type PickRow,
  patternWords,
  pickEntry,
  stampFor,
} from '../src/sheet/choices';
import { ChoicesPanel, kindKeyOf } from '../src/sheet/panels/ChoicesPanel';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-36: golden B (a human fighter 1) and golden A (a hill dwarf cleric 1) of SPEC §6.7 with
// their choices unmade. Counts and parts are those `compute()` gives for them, read from its
// `pendingChoices` (the ticket's §2): 7 for B, 4 for A. Option counts are the packs' entries a
// grant offers: Fighter 2 skills of 8, the soldier's tools 4, Skillful 18 skills.

await i18n.changeLanguage('en');
const packs = installBuiltInPacks().packs;
const STAMP_ID = '00000000-0000-4000-8000-000000000036';
const AT = '2026-10-29T10:00:00.000Z';

function sheetOf(golden: object): SheetValue {
  const character: AppCharacter = fifthEditionCharacterSchema.parse(golden);
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

const unmadeB = { ...goldenB, choices: {} };
const unmadeA = { ...goldenA, choices: {} };
/** Golden B with every choice made and the species' size not chosen. */
const noSize = {
  ...goldenB,
  systemData: { ...goldenB.systemData, species: { id: goldenB.systemData.species.id } },
};

function pick(sheet: SheetValue, part: string): PickRow {
  const row = choiceRows(sheet).find((each) => each.kind === 'pick' && each.part === part);
  if (row?.kind !== 'pick') throw new Error(`no pick row ${part}`);
  return row;
}

function distribution(sheet: SheetValue): DistributeRow {
  const row = choiceRows(sheet).find((each) => each.kind === 'distribute');
  if (row?.kind !== 'distribute') throw new Error('no distribution');
  return row;
}

const names = (options: readonly { name: string }[]) => options.map(({ name }) => name);

describe('SHEET-36 the rows of what needs choosing', () => {
  it('lists the 7 pending choices of golden B, in the order compute() gives them', () => {
    const rows = choiceRows(sheetOf(unmadeB));
    expect(rows.map(({ id }) => id)).toEqual([
      'srd-2024:feature/skillful#skills',
      'srd-2024:feature/versatile#feat',
      'srd-2024:background/soldier#ability-scores',
      'srd-2024:background/soldier#tools',
      'srd-2024:class/fighter#skills',
      'srd-2024:feature/fighter-fighting-style#feat',
      'srd-2024:feature/fighter-weapon-mastery#kinds',
    ]);
    expect(rows.map(({ kind }) => kind)).toEqual([
      'pick',
      'pick',
      'distribute',
      'pick',
      'pick',
      'pick',
      'pick',
    ]);
    expect(rows.map(({ what }) => what)).toEqual([
      'skill',
      'feat',
      'distribute',
      'tool',
      'skill',
      'feat',
      'mastery',
    ]);
  });

  it('lists the 4 pending choices of golden A', () => {
    const rows = choiceRows(sheetOf(unmadeA));
    expect(rows.map(({ id }) => id)).toEqual([
      'srd-2014:species/dwarf#subrace',
      'srd-2014:feature/tool-proficiency#tools',
      'srd-2014:background/acolyte#languages',
      'srd-2014:class/cleric#skills',
    ]);
    expect(rows.map(({ what }) => what)).toEqual(['lineage', 'tool', 'language', 'skill']);
  });

  it('lists nothing for a character whose choices are made', () => {
    expect(choiceRows(sheetOf(goldenB))).toEqual([]);
    expect(choiceRows(sheetOf(goldenA))).toEqual([]);
  });

  it('names the source and the options, and counts what is left', () => {
    const sheet = sheetOf(unmadeB);
    const skills = pick(sheet, 'srd-2024:class/fighter#skills');
    expect(skills.source).toBe('Fighter');
    expect(skills.left).toBe(2);
    expect(skills.options).toHaveLength(8);
    expect(names(skills.options).slice(0, 3)).toEqual([
      'Acrobatics',
      'Animal Handling',
      'Athletics',
    ]);
    expect(pick(sheet, 'srd-2024:feature/skillful#skills').options).toHaveLength(18);
    expect(pick(sheet, 'srd-2024:feature/fighter-weapon-mastery#kinds').left).toBe(3);
    // A feat is an entry; a tool has none, so it reads from its key.
    expect(names(pick(sheet, 'srd-2024:feature/versatile#feat').options)).toEqual(['Alert']);
    expect(names(pick(sheet, 'srd-2024:background/soldier#tools').options)).toEqual([
      'Dice',
      'Dragonchess',
      'Playing cards',
      'Three dragon ante',
    ]);
  });

  it('shows a choice made in part with its items, and what is left', () => {
    const partly = { ...unmadeB, choices: { 'srd-2024:class/fighter#skills': ['perception'] } };
    const row = pick(sheetOf(partly), 'srd-2024:class/fighter#skills');
    expect(row.left).toBe(1);
    expect(names(row.chosen)).toEqual(['Perception']);
    expect(row.options).toHaveLength(7);
    expect(row.stored).toEqual(['perception']);
  });

  it('gives a distribution its patterns and its stats, named', () => {
    const row = distribution(sheetOf(unmadeB));
    expect(row.patterns).toEqual([
      [2, 1],
      [1, 1, 1],
    ]);
    expect(names(row.options)).toEqual(['Strength', 'Dexterity', 'Constitution']);
    expect(row.options.map(({ value }) => value)).toEqual(['str', 'dex', 'con']);
    expect(patternWords([2, 1])).toBe('+2, +1');
    expect(patternWords([1, 1, 1])).toBe('+1, +1, +1');
  });

  it('lists a size not chosen as a key row stored in the species', () => {
    const rows = choiceRows(sheetOf(noSize));
    expect(rows).toHaveLength(1);
    const row = rows[0] as KeyRow;
    expect(row.kind).toBe('key');
    expect(row.path).toBe('size');
    expect(names(row.options)).toEqual(['Medium', 'Small']);
    expect(row.answer).toEqual(['systemData', 'species', 'size']);
  });

  it('says a missing owner by its id and still lists its choice', () => {
    const sheet = sheetOf(unmadeA);
    const gone = { ...sheet, content: contentOf(sheet.character, []) };
    const rows = choiceRows({ ...gone, computed: sheet.computed });
    expect(rows[0]?.kind === 'pick' && rows[0].source).toBe('srd-2014:species/dwarf');
    expect(rows[0]?.options[0]).toEqual({
      value: 'srd-2014:lineage/hill-dwarf',
      name: 'srd-2014:lineage/hill-dwarf',
      missing: true,
    });
  });

  it('writes a key as words', () => {
    expect(keyWords('masonsTools')).toBe('Masons tools');
    expect(keyWords('dice')).toBe('Dice');
    expect(keyWords('')).toBe('');
  });
});

describe('SHEET-36 the entry that stores an answer', () => {
  const sheet = sheetOf(unmadeB);
  const stamp = stampFor(sheet, STAMP_ID, AT);

  it('stamps the player with the character', () => {
    expect(stamp).toEqual({
      id: STAMP_ID,
      at: AT,
      by: { role: 'player', name: 'Golden B', actorId: goldenB.id },
    });
  });

  it('stores the list under choices, none before', () => {
    const row = pick(sheet, 'srd-2024:class/fighter#skills');
    const entry = pickEntry(sheet, row, ['perception', 'survival'], stamp);
    expect(entry.action).toBe('setChoice');
    expect(entry.subject).toBe('srd-2024:class/fighter#skills');
    expect(entry.label).toEqual({ en: 'Fighter' });
    expect(entry.changes).toEqual([
      {
        path: ['choices', 'srd-2024:class/fighter#skills'],
        after: ['perception', 'survival'],
      },
    ]);
  });

  it('removes the list when the last item goes', () => {
    const partly = sheetOf({
      ...unmadeB,
      choices: { 'srd-2024:class/fighter#skills': ['perception'] },
    });
    const row = pick(partly, 'srd-2024:class/fighter#skills');
    expect(pickEntry(partly, row, [], stamp).changes).toEqual([
      { path: ['choices', 'srd-2024:class/fighter#skills'], before: ['perception'] },
    ]);
  });

  it('stores a size in the species, and nothing where the module has no place', () => {
    const sized = sheetOf(noSize);
    const row = choiceRows(sized)[0] as KeyRow;
    const small = row.options.find(({ value }) => value === 'small');
    if (small === undefined) throw new Error('no small');
    const entry = keyEntry(sized, row, small, stamp);
    expect(entry?.action).toBe('setKey');
    expect(entry?.label).toEqual({ en: 'Small' });
    expect(entry?.changes).toEqual([{ path: ['systemData', 'species', 'size'], after: 'small' }]);
    expect(keyEntry(sized, { ...row, answer: undefined }, small, stamp)).toBeUndefined();
  });
});

describe('SHEET-36 an answer is stored, and undone', () => {
  let database: GrimoireDb;
  let count = 0;

  beforeEach(async () => {
    count += 1;
    database = new GrimoireDb(`sheet-36-${count}`);
    await database.open();
  });
  afterEach(async () => {
    database.close();
    await database.delete();
  });

  async function stored(id: string): Promise<AppCharacter> {
    return fifthEditionCharacterSchema.parse(await database.characters.get(id));
  }

  it('takes the 7 pending choices of golden B to 6 by one answer, and back by its undo', async () => {
    const sheet = sheetOf(unmadeB);
    await saveCharacter(sheet.character, database.characters);
    const row = pick(sheet, 'srd-2024:class/fighter#skills');
    const entry = pickEntry(sheet, row, ['perception', 'survival'], stampFor(sheet, STAMP_ID, AT));
    const done = await recordChange(sheet.character.id, entry, AT, database);
    expect(done.ok).toBe(true);
    const after = sheetOf(await stored(sheet.character.id));
    expect(after.computed.pendingChoices).toHaveLength(6);
    expect(choiceRows(after).some(({ id }) => id === row.id)).toBe(false);
    expect(after.character.choices[row.part]).toEqual(['perception', 'survival']);

    const undone = await undoChange(STAMP_ID, AT, database);
    expect(undone.ok).toBe(true);
    const back = sheetOf(await stored(sheet.character.id));
    expect(back.computed.pendingChoices).toHaveLength(7);
    expect(back.character.choices[row.part]).toBeUndefined();
  });

  it('keeps a choice pending after one of its two items, and ends it with the second', async () => {
    const sheet = sheetOf(unmadeB);
    await saveCharacter(sheet.character, database.characters);
    const row = pick(sheet, 'srd-2024:class/fighter#skills');
    await recordChange(
      sheet.character.id,
      pickEntry(sheet, row, ['perception'], stampFor(sheet, STAMP_ID, AT)),
      AT,
      database,
    );
    const half = sheetOf(await stored(sheet.character.id));
    expect(half.computed.pendingChoices).toHaveLength(7);
    expect(pick(half, row.part).left).toBe(1);
    await recordChange(
      sheet.character.id,
      pickEntry(half, pick(half, row.part), ['perception', 'survival'], {
        ...stampFor(half, '00000000-0000-4000-8000-000000000037', AT),
      }),
      AT,
      database,
    );
    expect(sheetOf(await stored(sheet.character.id)).computed.pendingChoices).toHaveLength(6);
  });

  it('ends a distribution when the stats fill a pattern', async () => {
    const sheet = sheetOf(unmadeB);
    await saveCharacter(sheet.character, database.characters);
    const row = distribution(sheet);
    const done = await recordChange(
      sheet.character.id,
      pickEntry(sheet, row, ['str', 'con'], stampFor(sheet, STAMP_ID, AT)),
      AT,
      database,
    );
    expect(done.ok).toBe(true);
    const after = sheetOf(await stored(sheet.character.id));
    expect(after.character.choices[row.part]).toEqual(['str', 'con']);
    expect(after.computed.pendingChoices.map(({ part }) => part)).not.toContain(row.part);
  });

  it('stores a size and ends the key row', async () => {
    const sheet = sheetOf(noSize);
    await saveCharacter(sheet.character, database.characters);
    const row = choiceRows(sheet)[0] as KeyRow;
    const small = row.options.find(({ value }) => value === 'small');
    if (small === undefined) throw new Error('no small');
    const entry = keyEntry(sheet, row, small, stampFor(sheet, STAMP_ID, AT));
    if (entry === undefined) throw new Error('no entry');
    expect((await recordChange(sheet.character.id, entry, AT, database)).ok).toBe(true);
    const after = sheetOf(await stored(sheet.character.id));
    expect(after.character.systemData.species?.size).toBe('small');
    expect(after.computed.pendingKeys).toEqual([]);
    expect(after.computed.keys.size?.key).toBe('small');
  });

  it('refuses an answer made over a newer one, and writes nothing', async () => {
    const sheet = sheetOf(unmadeB);
    await saveCharacter(sheet.character, database.characters);
    const row = pick(sheet, 'srd-2024:class/fighter#skills');
    await recordChange(
      sheet.character.id,
      pickEntry(sheet, row, ['perception'], stampFor(sheet, STAMP_ID, AT)),
      AT,
      database,
    );
    // The open sheet still holds no list there, so its entry says `before` is none.
    const late = pickEntry(sheet, row, ['survival'], {
      ...stampFor(sheet, '00000000-0000-4000-8000-000000000037', AT),
    });
    const refused = await recordChange(sheet.character.id, late, AT, database);
    expect(refused).toMatchObject({ ok: false, code: 'changed' });
    expect((await stored(sheet.character.id)).choices[row.part]).toEqual(['perception']);
  });
});

describe('SHEET-36 the panel', () => {
  const draw = (golden: object) =>
    renderToStaticMarkup(
      <SheetContext value={sheetOf(golden)}>
        <ChoicesPanel onClose={() => {}} />
      </SheetContext>,
    );

  it('says nothing is left when every choice is made', () => {
    const html = draw(goldenB);
    expect(html).toContain('role="dialog"');
    expect(html).toContain(en.choices.title);
    expect(html).toContain(en.choices.empty);
    expect(html).not.toContain('<h3');
  });

  it('draws a card for each pending choice, with its options as buttons', () => {
    const html = draw(unmadeB);
    expect(html.match(/<h3/g)).toHaveLength(7);
    expect(html).toContain('Fighter');
    expect(html).toContain('Skills · 2 left to choose');
    expect(html).toContain('aria-label="Choose Acrobatics"');
    expect(html).toContain('aria-label="Choose Alert"');
    expect(html).not.toContain(en.choices.empty);
    expect(html).not.toContain('role="alert"');
  });

  it('shows a distribution its patterns first, and no stats before one is picked', () => {
    const html = draw(unmadeB);
    expect(html).toContain('Raise by');
    expect(html).toContain('+2, +1');
    expect(html).toContain('+1, +1, +1');
    expect(html).not.toContain('aria-label="Choose Strength"');
  });

  it('shows a chosen item with its Remove button', () => {
    const html = draw({ ...unmadeB, choices: { 'srd-2024:class/fighter#skills': ['perception'] } });
    expect(html).toContain('aria-label="Remove Perception"');
    expect(html).toContain('1 left to choose');
    // The Skillful card still offers Perception; the Fighter card, which holds it, does not.
    expect(html.match(/aria-label="Choose Perception"/g)).toHaveLength(1);
  });

  it('draws a size as a card without a title', () => {
    const html = draw(noSize);
    expect(html).toContain('Size');
    expect(html).toContain('aria-label="Choose Small"');
    expect(html).not.toContain('<h3');
  });

  it('gives a kind with no words of its own the generic ones', () => {
    expect(kindKeyOf('skill')).toBe('skill');
    expect(kindKeyOf('size')).toBe('size');
    expect(kindKeyOf('spell')).toBe('other');
    expect(kindKeyOf('constructor')).toBe('other');
  });
});
