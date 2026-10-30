import {
  type Computed,
  type ContentIndex,
  finderOf,
  type ResourceRecovery,
  recoveryOf,
  resourceUses,
} from '@grimoire/engine';
import { whole } from './actions';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity, SpellDef } from './entity-types';
import type { HeaderCasting } from './sheet-header';
import {
  grantCastingStat,
  PACT_LEVEL_PATH,
  PACT_SLOTS_PATH,
  slotsPath,
  statSpellPath,
} from './spellcasting';
import { MAX_SPELL_LEVEL } from './system';

// SHEET-46: what the Spells tab names for a fifth-edition character (board `V3-Spells`, ADR 010
// items 9 and 10, ADR 009 item 4): one column of slots per spell level that has any, the pact
// magic slots as a column of their own, the spells the character knows or has prepared, and the
// spells a feature grants, each with its source and, when the grant gives uses, its limit and
// "no spell slot" (ADR 014 item 7). The screen reads every number from `Computed` at these paths.

/** A column of the slot grid: one spell level, or the pact magic slots. */
export interface SlotColumn {
  /** `1` to `9`, or `pact`. */
  key: string;
  /** The spell level of its slots. */
  level: number;
  /** The path of the maximum: the number the column's breakdown is. */
  path: string;
  max: number;
  spent: number;
  /** The slots left, never below 0. */
  left: number;
}

/** One column's counts, with the spent ones kept as stored (a maximum may fall below them). */
function columnOf(
  key: string,
  level: number,
  path: string,
  max: number,
  spent: number,
): SlotColumn {
  return { key, level, path, max, spent, left: Math.max(0, max - spent) };
}

/**
 * The slot grid's columns, spell level 1 first and pact magic last: only a level with at least one
 * slot has a column, so a single higher-level slot, from any effect, shows (ADR 010 item 9).
 */
export function fifthEditionSlots(
  { systemData }: Pick<FifthEditionCharacter, 'systemData'>,
  computed: Pick<Computed<FifthEditionEntity>, 'values'>,
): SlotColumn[] {
  const { slotsSpent, pactSlotsSpent } = systemData.state;
  const columns: SlotColumn[] = [];
  for (let level = 1; level <= MAX_SPELL_LEVEL; level++) {
    const path = slotsPath(level);
    const max = whole(computed.values[path]);
    if (max > 0) columns.push(columnOf(`${level}`, level, path, max, slotsSpent[`${level}`] ?? 0));
  }
  const pact = whole(computed.values[PACT_SLOTS_PATH]);
  if (pact > 0) {
    const level = whole(computed.values[PACT_LEVEL_PATH]);
    columns.push(columnOf('pact', level, PACT_SLOTS_PATH, pact, pactSlotsSpent));
  }
  return columns;
}

/** What a spell grant's own uses are: the count, and what gives them back. */
export interface SpellLimit {
  /** The resource key of the grant. */
  key: string;
  max: number;
  spent: number;
  left: number;
  recovery: readonly ResourceRecovery[];
}

/** Where a spell on the tab comes from. */
export type SpellFrom =
  | {
      kind: 'class';
      /** The class or subclass whose list holds it. */
      source: string;
      /** Prepared when the list `prepared` has it; else known. */
      state: 'prepared' | 'known';
    }
  | {
      kind: 'grant';
      /** The entity whose grant gives it. */
      source: string;
      /** The grant's part: `castSpell` takes it as `grant` (ENG-57). */
      part: string;
      /** The grant's own uses; none when the spell is cast with a slot. */
      limit?: SpellLimit;
    };

/** A spell on the tab: its id, the entity when a pack has it, and where it comes from. */
export interface SheetSpell {
  id: string;
  /** `undefined` when no pack has the id, or the entity is not a spell: the row says it is missing. */
  spell?: SpellDef;
  from: SpellFrom;
}

/** The spells a class or subclass knows or has prepared: each once, prepared ones as prepared. */
function ofClasses(
  character: FifthEditionCharacter,
  find: (id: string) => FifthEditionEntity | undefined,
): SheetSpell[] {
  return Object.entries(character.systemData.spells).flatMap(([source, { known, prepared }]) => {
    const preparedIds = prepared ?? [];
    const ids = [...new Set([...preparedIds, ...(known ?? [])])];
    return ids.map((id): SheetSpell => {
      const found = find(id);
      const state = preparedIds.includes(id) ? 'prepared' : 'known';
      return {
        id,
        ...(found?.type === 'spell' && { spell: found }),
        from: { kind: 'class', source, state },
      };
    });
  });
}

/** The spells every reached `spell` grant gives, a fixed one first, then the ones chosen. */
function ofGrants(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
  find: (id: string) => FifthEditionEntity | undefined,
): SheetSpell[] {
  return computed.grants.flatMap(({ part, source, grant, chosen }) => {
    if (grant.kind !== 'spell') return [];
    const uses = grant.key === undefined ? undefined : resourceUses(character, computed, grant.key);
    const limit: SpellLimit | undefined =
      grant.key === undefined || uses === undefined
        ? undefined
        : { key: grant.key, ...uses, recovery: recoveryOf(computed, grant.key) };
    return [...(grant.fixed ?? []), ...chosen].map((id): SheetSpell => {
      const found = find(id);
      return {
        id,
        ...(found?.type === 'spell' && { spell: found }),
        from: { kind: 'grant', source, part, ...(limit !== undefined && { limit }) },
      };
    });
  });
}

/**
 * The spells the character has, to list: first those a class or subclass knows or has prepared,
 * then those a feature grants, each in the order the character holds them. The screen sorts the
 * first by level. A granted spell's uses are the resource of its grant's `key`, which the grant's
 * other spells share (ENG-57).
 */
export function fifthEditionSpells(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
  index: ContentIndex<FifthEditionEntity>,
): SheetSpell[] {
  const find = finderOf(character, index);
  return [...ofClasses(character, find), ...ofGrants(character, computed, find)];
}

/**
 * The DC and attack of the spells a feature grants with a stat of its own (ENG-51), one line for
 * each stat, in the order the grants come: `abilities.<stat>.spell`. `source` is that stat, as a
 * granted spell's casting has no class.
 */
export function fifthEditionGrantedCasting(
  computed: Computed<FifthEditionEntity>,
): HeaderCasting[] {
  const stats = new Set(computed.grants.flatMap(({ grant }) => grantCastingStat(grant) ?? []));
  return [...stats].flatMap((stat) => {
    const path = statSpellPath(stat);
    if (!Object.hasOwn(computed.values, `${path}.dc`)) return [];
    return [{ source: stat, ability: stat, dc: `${path}.dc`, attack: `${path}.attack` }];
  });
}
