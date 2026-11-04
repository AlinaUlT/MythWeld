import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import i18n from '../src/i18n';
import { currentToast, hideToast, undoToast } from '../src/shared/undo';
import { perform } from '../src/sheet/changes';
import { Inspiration, STAR_POINTS } from '../src/sheet/header/Inspiration';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-55: golden A (2014) and golden B (2024) of SPEC §6.7 hold no inspiration, with the house
// maximum of 1; the owner's 3 and the held counts are the tests' own.

const a: AppCharacter = fifthEditionCharacterSchema.parse(goldenA);
const b: AppCharacter = fifthEditionCharacterSchema.parse(goldenB);
const t = i18n.getFixedT('en', 'inspiration');

/** `character` holding `held` inspiration, up to the house maximum `max`. */
function holding(character: AppCharacter, held: number, max = 1): AppCharacter {
  const { systemData } = character;
  return {
    ...character,
    systemData: {
      ...systemData,
      houseRules: { ...systemData.houseRules, inspirationMax: max },
      state: { ...systemData.state, inspiration: held },
    },
  };
}

function system(character: AppCharacter) {
  const found = sheetSystemOf(character);
  if (found === undefined) throw new Error('no sheet');
  return found;
}

function drawn(character: AppCharacter): string {
  const content = contentOf(character, installBuiltInPacks().packs);
  const sheet: SheetValue = {
    character,
    content,
    computed: compute(character, content.index, system(character).module),
    system: system(character),
    editing: false,
    roll: () => {},
    breakdown: () => {},
    cast: () => {},
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <SheetContext value={sheet}>
        <Inspiration />
      </SheetContext>
    </MemoryRouter>,
  );
}

/** The `data-filled` of each star button, in order. */
const stars = (html: string) => [...html.matchAll(/data-filled="(true|false)"/g)].map((m) => m[1]);

describe('SHEET-55 the inspiration stars', () => {
  it('draws one empty star for golden B, which holds none, and names its edition term', () => {
    const html = drawn(b);
    expect(stars(html)).toEqual(['false']);
    expect(html).toContain(`>${t('label.heroicInspiration', { held: 0, max: 1 })}</legend>`);
    expect(html).toContain(`aria-label="${t('gain')}"`);
    expect(html).not.toContain(t('rules', { max: 1 }));
  });

  it('draws golden A with the 2014 word', () => {
    expect(drawn(a)).toContain(`>${t('label.inspiration', { held: 0, max: 1 })}</legend>`);
  });

  it("draws the owner's 3 stars, two filled, with the edition's 1 beside them", () => {
    const html = drawn(holding(b, 2, 3));
    expect(stars(html)).toEqual(['true', 'true', 'false']);
    expect(html).toContain(`>${t('label.heroicInspiration', { held: 2, max: 3 })}</legend>`);
    expect(html.match(new RegExp(`aria-label="${t('spend')}"`, 'g'))).toHaveLength(2);
    expect(html.match(new RegExp(`aria-label="${t('gain')}"`, 'g'))).toHaveLength(1);
    expect(html).toContain('Rules: 1');
  });

  it("draws the board's star: the points of V3-Sheet's polygon", () => {
    // Copied from the `points` of the star in board V3-Sheet, not from a run of the code.
    expect(STAR_POINTS).toBe(
      '12.00,1.50 13.99,7.20 19.42,4.58 16.80,10.01 22.50,12.00 16.80,13.99 19.42,19.42 13.99,16.80 12.00,22.50 10.01,16.80 4.58,19.42 7.20,13.99 1.50,12.00 7.20,10.01 4.58,4.58 10.01,7.20',
    );
  });
});

describe('SHEET-55 gaining and spending', () => {
  let database: GrimoireDb;
  let count = 0;
  const three = holding(b, 1, 3);

  beforeEach(async () => {
    count += 1;
    database = new GrimoireDb(`sheet-55-${count}`);
    await database.open();
    await saveCharacter(three, database.characters);
  });

  afterEach(async () => {
    const toast = currentToast();
    if (toast !== undefined) hideToast(toast);
    await database.delete();
  });

  async function held() {
    const opened = await openCharacter(b.id, database.characters);
    if (!opened.ok) throw new Error('does not open');
    return opened.value.systemData.state.inspiration;
  }

  it('gains one, with the "Inspiration gained" toast, and Undo spends it again', async () => {
    const { gainInspiration } = system(three);
    const result = await perform(three, (stamp) => gainInspiration(three, stamp), database);
    expect(result.ok).toBe(true);
    expect(await held()).toBe(2);
    const toast = currentToast();
    if (toast === undefined) throw new Error('no toast');
    expect(toast.kind === 'changed' && toast.entry.action).toBe('gainInspiration');
    expect(i18n.getFixedT('en', 'toast')('done.gainInspiration')).toBe('Inspiration gained');
    expect((await undoToast(toast, undefined, database)).ok).toBe(true);
    expect(await held()).toBe(1);
  });

  it('spends one, with the "Inspiration spent" toast', async () => {
    const { spendInspiration } = system(three);
    const result = await perform(three, (stamp) => spendInspiration(three, stamp), database);
    expect(result.ok).toBe(true);
    expect(await held()).toBe(0);
    expect(currentToast()?.kind).toBe('changed');
    expect(i18n.getFixedT('en', 'toast')('done.spendInspiration')).toBe('Inspiration spent');
  });

  it('refuses to spend when none is held, and to gain at the maximum, writing nothing', async () => {
    const { gainInspiration, spendInspiration } = system(three);
    const none = holding(b, 0, 3);
    await saveCharacter(none, database.characters);
    const spent = await perform(none, (stamp) => spendInspiration(none, stamp), database);
    expect(spent).toMatchObject({ ok: false, code: 'noInspiration' });
    const full = holding(b, 3, 3);
    await saveCharacter(full, database.characters);
    const gained = await perform(full, (stamp) => gainInspiration(full, stamp), database);
    expect(gained).toMatchObject({ ok: false, code: 'atMax' });
    expect(await held()).toBe(3);
    expect(currentToast()).toBeUndefined();
  });

  it('stamps the change as the character’s player', async () => {
    const { gainInspiration } = system(three);
    await perform(three, (stamp) => gainInspiration(three, stamp), database);
    const toast = currentToast();
    expect(toast?.kind === 'changed' && toast.entry.by).toEqual({
      role: 'player',
      name: 'Golden B',
      actorId: b.id,
    });
  });
});
