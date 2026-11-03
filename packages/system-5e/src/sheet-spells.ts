import type { Computed } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { PACT_LEVEL_PATH, PACT_SLOTS_PATH, slotsPath } from './spellcasting';
import { MAX_SPELL_LEVEL } from './system';

// SHEET-46: what the Spells tab names for a fifth-edition character (ADR 010 items 9 and 10, board
// `V3-Spells`): the slots as columns, one for each spell level the character has slots of, pact
// magic's as its own; the spells each class or subclass knows and has prepared; and the spells its
// grants give, each with the key of its own uses (ENG-57), which the screen pairs with the spell
// (two grants of one entity give two resources with one label). Every number is read from
// `Computed`; a spent count is the trackers'.

/** A column of the slot grid. */
export interface SlotColumn {
  /** The slot as the actions ask for it: a spell level, or pact magic's. */
  slot: { level: number } | 'pact';
  /** The spell level the slots are of. */
  level: number;
  max: number;
  /** The spent ones; never above `max` here. */
  spent: number;
}

/** The spells one class or subclass knows and has prepared. */
export interface SpellList {
  /** The class or subclass the lists belong to. */
  owner: string;
  known: string[];
  prepared: string[];
}

/** A spell a grant gives. */
export interface GrantedSpell {
  spell: string;
  /** The grant's part id: what a cast through its own uses asks for (ENG-57). */
  part: string;
  /** The entity whose grant it is. */
  from: string;
  /** The key of the grant's own uses; none for a spell cast with a slot. */
  key?: string;
  alwaysPrepared: boolean;
}

export interface SpellsShown {
  slots: SlotColumn[];
  lists: SpellList[];
  granted: GrantedSpell[];
}

/** A computed count: a whole number, never below 0; 0 when it is not a number. */
function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function fifthEditionSpells(
  character: FifthEditionCharacter,
  computed: Pick<Computed<FifthEditionEntity>, 'values' | 'grants'>,
): SpellsShown {
  const { values } = computed;
  const { state, spells } = character.systemData;
  const spentAt: Readonly<Partial<Record<string, number>>> = state.slotsSpent;
  const slots: SlotColumn[] = [];
  for (let level = 1; level <= MAX_SPELL_LEVEL; level += 1) {
    const max = whole(values[slotsPath(level)]);
    if (max === 0) continue;
    slots.push({ slot: { level }, level, max, spent: Math.min(max, spentAt[`${level}`] ?? 0) });
  }
  const pact = whole(values[PACT_SLOTS_PATH]);
  if (pact > 0) {
    slots.push({
      slot: 'pact',
      level: whole(values[PACT_LEVEL_PATH]),
      max: pact,
      spent: Math.min(pact, state.pactSlotsSpent),
    });
  }

  const lists = Object.entries(spells).map(
    ([owner, { known = [], prepared = [] }]): SpellList => ({
      owner,
      known: [...known],
      prepared: [...prepared],
    }),
  );

  const granted = computed.grants.flatMap(({ part, source, grant, chosen }): GrantedSpell[] => {
    if (grant.kind !== 'spell') return [];
    return [...new Set([...(grant.fixed ?? []), ...chosen])].map((spell) => ({
      spell,
      part,
      from: source,
      ...(grant.key !== undefined && { key: grant.key }),
      alwaysPrepared: grant.alwaysPrepared === true,
    }));
  });
  return { slots, lists, granted };
}
