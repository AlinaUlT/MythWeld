import { applyEntry, changeTo, compute, loadContentIndex } from '@grimoire/engine';
import type { LogEntry } from '@grimoire/schema';
import { describe, expect, it } from 'vitest';
import {
  FIFTH_EDITION_SYSTEM,
  type FifthEditionCharacter,
  fifthEditionModule,
  followMaximum,
  HP_CURRENT_PATH,
  madeByHand,
  openFifthEditionCharacter,
  openFifthEditionPack,
} from '../src/index.ts';
import { stamp } from './action-checks.ts';
import { opened } from './golden/checks.ts';
import { goldenA, srd2014 } from './golden/index.ts';

// SHEET-88: a pick taken back lowers the maximum, and the current hit points never stay above it.
// SHEET-85: a character at full hit points stays at full when a pick raises the maximum; one
// below full keeps its current hit points. Golden A is made as the form makes it (a Dwarf, no
// subrace picked yet), then picks the Hill Dwarf: SPEC §6.7 golden A says 12 hit points.

const index = loadContentIndex(FIFTH_EDITION_SYSTEM, [opened(openFifthEditionPack(srd2014))]).index;

const SUBRACE = 'srd-2014:species/dwarf#subrace';
const HILL_DWARF = 'srd-2014:lineage/hill-dwarf';

/** Golden A as the form makes it: the person's inputs only, no pick, current at the maximum. */
function formA(): FifthEditionCharacter {
  const data = goldenA.systemData;
  return madeByHand(
    {
      id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
      at: '2026-11-08T12:00:00.000Z',
      ruleset: goldenA.ruleset,
      allowMixedRulesets: goldenA.allowMixedRulesets,
      name: goldenA.name,
      packs: goldenA.packs,
      species: data.species.id,
      background: data.background.id,
      classes: data.classes.map(({ id, level, subclass }) => ({
        id,
        level,
        ...(subclass !== undefined && { subclass }),
      })),
      scores: goldenA.abilities.base,
    },
    index,
  ).character;
}

/** The entry that stores the Hill Dwarf pick, as the choices panel builds it. */
function pickHillDwarf(): LogEntry {
  return {
    ...stamp,
    action: 'setChoice',
    subject: SUBRACE,
    changes: [{ path: ['choices', SUBRACE], after: [HILL_DWARF] }],
  };
}

const maxOf = (character: FifthEditionCharacter) =>
  compute(character, index, fifthEditionModule).values['hp.max'];

function applied(character: FifthEditionCharacter, entry: LogEntry): FifthEditionCharacter {
  const result = applyEntry(character, entry);
  if (!result.ok) throw new Error(result.message);
  return result.character;
}

describe('SHEET-85 current hit points follow a pick that raises the maximum', () => {
  it('moves a character at full to the new maximum: golden A reads 12 of 12', () => {
    const made = formA();
    const before = made.systemData.state.hp.current;
    expect(before).toBe(maxOf(made));
    const entry = followMaximum(made, pickHillDwarf(), index);
    const picked = applied(made, entry);
    expect(maxOf(picked)).toBe(12);
    expect(picked.systemData.state.hp.current).toBe(12);
    expect(before).toBeLessThan(12);
  });

  it('adds the hit points to the same entry, so one undo gives both back', () => {
    const made = formA();
    const entry = followMaximum(made, pickHillDwarf(), index);
    expect(entry.changes).toEqual([
      { path: ['choices', SUBRACE], after: [HILL_DWARF] },
      { path: [...HP_CURRENT_PATH], before: made.systemData.state.hp.current, after: 12 },
    ]);
  });

  it('keeps the current hit points of a character below full', () => {
    const made = formA();
    const hurt = applied(made, {
      ...stamp,
      action: 'hp',
      subject: 'hp',
      changes: [changeTo(made, HP_CURRENT_PATH, 5)],
    });
    const entry = followMaximum(hurt, pickHillDwarf(), index);
    expect(entry.changes).toHaveLength(1);
    expect(applied(hurt, entry).systemData.state.hp.current).toBe(5);
  });

  it('does not heal a character at 0 hit points', () => {
    const made = formA();
    const down = applied(made, {
      ...stamp,
      action: 'hp',
      subject: 'hp',
      changes: [changeTo(made, HP_CURRENT_PATH, 0)],
    });
    const entry = followMaximum(down, pickHillDwarf(), index);
    expect(entry.changes).toHaveLength(1);
  });

  it('leaves an entry that does not raise the maximum as it is', () => {
    const made = formA();
    const note: LogEntry = {
      ...stamp,
      action: 'setNote',
      subject: 'free',
      changes: [{ path: ['notes', 'free'], after: 'a note' }],
    };
    expect(followMaximum(made, note, index)).toBe(note);
  });

  it('leaves an entry that cannot be applied as it is', () => {
    const made = formA();
    const stale: LogEntry = {
      ...stamp,
      action: 'setChoice',
      subject: SUBRACE,
      changes: [{ path: ['choices', SUBRACE], before: ['somebody:else'], after: [HILL_DWARF] }],
    };
    expect(followMaximum(made, stale, index)).toBe(stale);
  });

  it('leaves a character with no class as it is: it has no maximum', () => {
    const empty = madeByHand(
      {
        id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
        at: '2026-11-08T12:00:00.000Z',
        ruleset: '2014',
        allowMixedRulesets: false,
        name: 'Nobody',
        packs: goldenA.packs,
        classes: [],
        scores: goldenA.abilities.base,
      },
      index,
    ).character;
    const entry = pickHillDwarf();
    expect(followMaximum(empty, entry, index)).toBe(entry);
  });
});

/** The entry that takes the Hill Dwarf pick back. */
function takeBackHillDwarf(): LogEntry {
  return {
    ...stamp,
    action: 'setChoice',
    subject: SUBRACE,
    changes: [{ path: ['choices', SUBRACE], before: [HILL_DWARF] }],
  };
}

/** Golden A with the Hill Dwarf picked (12 hit points, SPEC §6.7) and `current` hit points. */
function pickedA(current: number): FifthEditionCharacter {
  const golden = opened(openFifthEditionCharacter(goldenA));
  return applied(golden, {
    ...stamp,
    action: 'hp',
    subject: 'hp',
    changes: [changeTo(golden, HP_CURRENT_PATH, current)],
  });
}

describe('SHEET-88 current hit points stay inside the maximum when a pick is taken back', () => {
  it('takes a character at full down to the lower maximum: 12 of 12 becomes 11 of 11', () => {
    const picked = pickedA(12);
    expect(maxOf(picked)).toBe(12);
    const entry = followMaximum(picked, takeBackHillDwarf(), index);
    expect(entry.changes).toEqual([
      { path: ['choices', SUBRACE], before: [HILL_DWARF] },
      { path: [...HP_CURRENT_PATH], before: 12, after: 11 },
    ]);
    const back = applied(picked, entry);
    expect(maxOf(back)).toBe(11);
    expect(back.systemData.state.hp.current).toBe(11);
  });

  it('keeps hit points that are already at or under the lower maximum', () => {
    for (const current of [0, 5, 11]) {
      const picked = pickedA(current);
      const entry = followMaximum(picked, takeBackHillDwarf(), index);
      expect(entry.changes).toHaveLength(1);
      expect(applied(picked, entry).systemData.state.hp.current).toBe(current);
    }
  });
});
