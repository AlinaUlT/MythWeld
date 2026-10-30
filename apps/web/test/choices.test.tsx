import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA, goldenC2014 } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import { recordChange } from '../src/db/history';
import i18n from '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { changeCharacter, currentToast } from '../src/shared/undo';
import { ChoicesPanel, whatKeyOf } from '../src/sheet/panels/ChoicesPanel';
import {
  type Ask,
  answerEntry,
  answers,
  asksOf,
  offeredOf,
  placed,
  storable,
  toggled,
  wordsOf,
} from '../src/sheet/panels/choices';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-36: the goldens of SPEC §6.7 with their stored choices taken away. Golden B at fighter 1
// stores seven choices (its fixture's `choicesB`); the list must offer exactly those seven, and
// answering each with what the fixture stores must give back the stored character the fixture is.

const packs = installBuiltInPacks().packs;
const typeOfEntity = (content: ReturnType<typeof contentOf>) => (id: string) => {
  const found = content.index.get(id);
  return found.ok ? found.entity.type : undefined;
};

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

function asksFor(golden: object): Ask[] {
  const { computed, system, content } = sheetOf(golden);
  return asksOf(computed, system, typeOfEntity(content));
}

function draw(sheet: SheetValue, node: ReactNode): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>{node}</SheetContext>
    </MemoryRouter>,
  );
}

const unchosen = { ...goldenB, choices: {} };
const noSize = {
  ...goldenB,
  systemData: { ...goldenB.systemData, species: { id: 'srd-2024:species/human' } },
};

describe('SHEET-36 the asks', () => {
  it('lists the seven choices golden B stores, each with its count and what it picks', () => {
    const asks = asksFor(unchosen);
    expect(
      asks.map(({ id, what, max, chosen, keyed, type, source }) => ({
        id,
        what,
        max,
        chosen,
        keyed,
        type,
        source,
      })),
    ).toEqual([
      {
        id: 'srd-2024:feature/skillful#skills',
        what: 'skill',
        max: 1,
        chosen: [],
        keyed: true,
        type: 'skill',
        source: 'srd-2024:feature/skillful',
      },
      {
        id: 'srd-2024:feature/versatile#feat',
        what: 'feat',
        max: 1,
        chosen: [],
        keyed: false,
        type: undefined,
        source: 'srd-2024:feature/versatile',
      },
      {
        id: 'srd-2024:background/soldier#ability-scores',
        what: 'abilityScore',
        max: 3,
        chosen: [],
        keyed: true,
        type: 'ability',
        source: 'srd-2024:background/soldier',
      },
      {
        id: 'srd-2024:background/soldier#tools',
        what: 'tool',
        max: 1,
        chosen: [],
        keyed: true,
        type: 'toolKind',
        source: 'srd-2024:background/soldier',
      },
      {
        id: 'srd-2024:class/fighter#skills',
        what: 'skill',
        max: 2,
        chosen: [],
        keyed: true,
        type: 'skill',
        source: 'srd-2024:class/fighter',
      },
      {
        id: 'srd-2024:feature/fighter-fighting-style#feat',
        what: 'feat',
        max: 1,
        chosen: [],
        keyed: false,
        type: undefined,
        source: 'srd-2024:feature/fighter-fighting-style',
      },
      {
        id: 'srd-2024:feature/fighter-weapon-mastery#kinds',
        what: 'mastery',
        max: 3,
        chosen: [],
        keyed: true,
        type: 'item',
        source: 'srd-2024:feature/fighter-weapon-mastery',
      },
    ]);
  });

  it('lists nothing for a character who has made every choice', () => {
    expect(asksFor(goldenB)).toEqual([]);
    expect(asksFor(goldenA)).toEqual([]);
    expect(asksFor(goldenC2014)).toEqual([]);
  });

  it("lists golden A's four, with the dwarf's lineage an entity and the languages 2 of 16", () => {
    const asks = asksFor({ ...goldenA, choices: {} });
    expect(asks.map(({ id, what, max, keyed }) => ({ id, what, max, keyed }))).toEqual([
      { id: 'srd-2014:species/dwarf#subrace', what: 'lineage', max: 1, keyed: false },
      { id: 'srd-2014:feature/tool-proficiency#tools', what: 'tool', max: 1, keyed: true },
      { id: 'srd-2014:background/acolyte#languages', what: 'language', max: 2, keyed: true },
      { id: 'srd-2014:class/cleric#skills', what: 'skill', max: 2, keyed: true },
    ]);
    expect(asks[2]?.options).toHaveLength(16);
  });

  it('lists a species size not chosen as an ask answered in the species, after the grants', () => {
    const asks = asksFor(noSize);
    const size = asks.at(-1);
    expect(size?.id).toBe('size');
    expect(size).toMatchObject({
      what: 'size',
      max: 1,
      chosen: [],
      keyed: true,
      type: 'size',
      place: { kind: 'key', place: ['systemData', 'species', 'size'] },
    });
    expect([...(size?.options ?? [])].sort()).toEqual(['medium', 'small']);
    expect(asks.filter(({ place }) => place.kind === 'choice')).toEqual([]);
  });

  it('keeps a half-made answer in the picks and offers the rest after it', () => {
    const [skills] = asksFor({
      ...goldenB,
      choices: { ...goldenB.choices, 'srd-2024:class/fighter#skills': ['survival'] },
    });
    expect(skills).toMatchObject({
      id: 'srd-2024:class/fighter#skills',
      max: 2,
      chosen: ['survival'],
    });
    expect(offeredOf(skills as Ask)[0]).toBe('survival');
    expect(offeredOf(skills as Ask)).toHaveLength(8);
    expect((skills as Ask).options).not.toContain('survival');
  });
});

describe('SHEET-36 picking', () => {
  const [, , soldier, , fighter] = asksFor(unchosen) as [Ask, Ask, Ask, Ask, Ask];

  it('adds a pick, takes it out when tapped again and stops at the count', () => {
    let picks: readonly string[] = [];
    picks = toggled(fighter, picks, 'athletics');
    picks = toggled(fighter, picks, 'history');
    expect(picks).toEqual(['athletics', 'history']);
    expect(toggled(fighter, picks, 'insight')).toEqual(['athletics', 'history']);
    expect(toggled(fighter, picks, 'athletics')).toEqual(['history']);
    expect(answers(fighter, ['athletics'])).toBe(false);
    expect(answers(fighter, picks)).toBe(true);
  });

  it('replaces the pick when only one is wanted', () => {
    const [skillful] = asksFor(unchosen) as [Ask];
    expect(toggled(skillful, ['arcana'], 'stealth')).toEqual(['stealth']);
    expect(toggled(skillful, ['stealth'], 'stealth')).toEqual([]);
  });

  it("gives the soldier's picks +2 and +1, or +1 each for three, in the order picked", () => {
    expect(soldier.patterns).toEqual([
      [2, 1],
      [1, 1, 1],
    ]);
    expect(answers(soldier, ['str'])).toBe(false);
    expect(placed(soldier, ['str'])).toEqual([]);
    expect(answers(soldier, ['str', 'con'])).toBe(true);
    expect(placed(soldier, ['str', 'con'])).toEqual([2, 1]);
    expect(placed(soldier, ['con', 'str'])).toEqual([2, 1]);
    expect(placed(soldier, ['str', 'dex', 'con'])).toEqual([1, 1, 1]);
    expect(toggled(soldier, ['str', 'dex', 'con'], 'wis')).toEqual(['str', 'dex', 'con']);
  });

  it('writes a key as words when the content has no entry for it', () => {
    expect(wordsOf('smithsTools')).toBe('Smiths tools');
    expect(wordsOf('dice')).toBe('Dice');
    expect(wordsOf('threeDragonAnte')).toBe('Three dragon ante');
  });

  it('cannot store a key path its system does not answer', () => {
    const [size] = asksFor(noSize).slice(-1) as [Ask];
    expect(storable(size)).toBe(true);
    expect(storable({ ...size, place: { kind: 'key', place: [] } })).toBe(false);
    expect(storable(soldier)).toBe(true);
  });

  it('has a word for what each ask picks, and `other` for what the locale does not name', () => {
    for (const { what } of [...asksFor(unchosen), ...asksFor({ ...goldenA, choices: {} })]) {
      expect(whatKeyOf(what)).toBe(what);
    }
    expect(whatKeyOf('constructor')).toBe('other');
    expect(whatKeyOf('mystery')).toBe('other');
    expect(en.choices.what.other).toBe('Choice');
  });
});

describe('SHEET-36 the list as drawn', () => {
  const t = i18n.getFixedT('en', 'choices');

  it("shows golden B's seven choices, each with its source and how much is picked", () => {
    const html = draw(sheetOf(unchosen), <ChoicesPanel onClose={() => {}} />);
    expect(html).toContain(`>${t('title')}</h2>`);
    expect(html.match(/<li>/g)).toHaveLength(7);
    expect(html).toContain('>Fighter</span>');
    expect(html).toContain('>Soldier</span>');
    expect(html).toContain('>Skills</span>');
    expect(html).toContain('>Ability scores</span>');
    expect(html).toContain('0 of 3');
    expect(html).toContain('0 of 2');
  });

  it('says there is nothing to choose when every choice is made', () => {
    const html = draw(sheetOf(goldenB), <ChoicesPanel onClose={() => {}} />);
    expect(html).toContain(t('empty'));
    expect(html).not.toContain('<li>');
  });

  it('lists the size beside the grants', () => {
    const html = draw(sheetOf(noSize), <ChoicesPanel onClose={() => {}} />);
    expect(html.match(/<li>/g)).toHaveLength(1);
    expect(html).toContain('>Size</span>');
  });
});

describe('SHEET-36 answering', () => {
  let database: GrimoireDb;
  let count = 0;
  const stamp = (n: number) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    at: new Date(Date.UTC(2026, 9, 29, 12, n)).toISOString(),
  });

  beforeEach(async () => {
    count += 1;
    database = new GrimoireDb(`sheet-36-${count}`);
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  /** The stored character `id`, opened. */
  async function stored(id: string): Promise<AppCharacter> {
    return fifthEditionCharacterSchema.parse(await database.characters.get(id));
  }

  it("answering each of golden B's seven choices with what its fixture stores gives the fixture back", async () => {
    const start = fifthEditionCharacterSchema.parse(unchosen);
    await saveCharacter(start, database.characters);
    let n = 0;
    for (const [part, picks] of Object.entries(goldenB.choices)) {
      const now = await stored(start.id);
      const content = contentOf(now, packs);
      const system = sheetSystemOf(now);
      if (system === undefined) throw new Error('no sheet');
      const computed = compute(now, content.index, system.module);
      const ask = asksOf(computed, system, typeOfEntity(content)).find(({ id }) => id === part);
      expect(ask, part).toBeDefined();
      expect(answers(ask as Ask, picks)).toBe(true);
      n += 1;
      const result = await recordChange(
        start.id,
        answerEntry(now, ask as Ask, picks, stamp(n)),
        stamp(n).at,
        database,
      );
      expect(result.ok, part).toBe(true);
    }
    const done = await stored(start.id);
    expect(done.choices).toEqual(goldenB.choices);
    expect(done.rev).toBe(7);
    const system = sheetSystemOf(done);
    if (system === undefined) throw new Error('no sheet');
    const content = contentOf(done, packs);
    const computed = compute(done, content.index, system.module);
    expect(computed.pendingChoices).toEqual([]);
    expect(computed.pendingKeys).toEqual([]);
    // The golden's own numbers (SPEC §6.7): the same character, so the same AC and initiative.
    const golden = sheetOf(goldenB).computed;
    expect(computed.values['ac.total']).toBe(golden.values['ac.total']);
    expect(computed.values['ac.total']).toBe(17);
    expect(computed.values['init.total']).toBe(3);
  });

  it('answers the size in the species, and a size already stored is a change from it', async () => {
    const start = fifthEditionCharacterSchema.parse(noSize);
    await saveCharacter(start, database.characters);
    const system = sheetSystemOf(start);
    if (system === undefined) throw new Error('no sheet');
    const content = contentOf(start, packs);
    const ask = asksOf(compute(start, content.index, system.module), system, typeOfEntity(content))
      .filter(({ place }) => place.kind === 'key')
      .at(-1) as Ask;
    const entry = answerEntry(start, ask, ['medium'], stamp(1));
    expect(entry.action).toBe('makeChoice');
    expect(entry.subject).toBe('size');
    expect(entry.changes).toEqual([{ path: ['systemData', 'species', 'size'], after: 'medium' }]);
    expect((await recordChange(start.id, entry, stamp(1).at, database)).ok).toBe(true);
    expect((await stored(start.id)).systemData.species).toEqual({
      id: 'srd-2024:species/human',
      size: 'medium',
    });
  });

  it("builds a grant's change as its list in `choices`, with who made it", () => {
    const start = fifthEditionCharacterSchema.parse(unchosen);
    const [skillful] = asksFor(unchosen) as [Ask];
    const entry = answerEntry(start, skillful, ['insight'], stamp(1));
    expect(entry).toMatchObject({
      action: 'makeChoice',
      subject: 'srd-2024:feature/skillful#skills',
      by: { role: 'player', name: 'Golden B', actorId: start.id },
      changes: [{ path: ['choices', 'srd-2024:feature/skillful#skills'], after: ['insight'] }],
    });
  });

  it('shows the undo toast, and refuses an answer made over a newer stored character', async () => {
    const start = fifthEditionCharacterSchema.parse(unchosen);
    await saveCharacter(start, database.characters);
    const [skillful] = asksFor(unchosen) as [Ask];
    const entry = answerEntry(start, skillful, ['insight'], stamp(1));
    const made = await changeCharacter(start.id, entry, stamp(1).at, database);
    expect(made.ok).toBe(true);
    expect(currentToast()).toEqual({ kind: 'changed', entry });
    // The same answer from the same (now older) copy: the place no longer holds what it says.
    const again = await changeCharacter(
      start.id,
      answerEntry(start, skillful, ['arcana'], stamp(2)),
      stamp(2).at,
      database,
    );
    expect(again).toMatchObject({ ok: false, code: 'changed' });
    expect((await stored(start.id)).choices['srd-2024:feature/skillful#skills']).toEqual([
      'insight',
    ]);
  });
});
