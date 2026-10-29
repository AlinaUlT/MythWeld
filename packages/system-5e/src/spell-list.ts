import {
  ANY_RULESET,
  type Computed,
  type ContentIndex,
  finderOf,
  type LogStamp,
  type ResourceRecovery,
  recoveryOf,
  resourceUses,
} from '@grimoire/engine';
import type { EntityId, L10n } from '@grimoire/schema';
import { whole } from './actions';
import { regainSlot, type SlotResult, spendSlot } from './casting';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionCasting, type HeaderCasting } from './sheet-header';
import {
  grantCastingStat,
  PACT_LEVEL_PATH,
  PACT_SLOTS_PATH,
  slotsPath,
  statSpellPath,
} from './spellcasting';
import { MAX_SPELL_LEVEL } from './system';

// SHEET-46: what the Spells tab shows for a fifth-edition character (board `V3-Spells`, ADR 010
// items 9 and 10): the slot grid, one column per spell level, and the spell list. Both read
// `Computed` and the stored trackers; the screen does no rule of its own.

/**
 * One column of the slot grid: the slots of a spell level, or the pact magic slots, all of one
 * level. `max` is the computed number of them (ENG-15), `spent` the stored count (ENG-20), `left`
 * what can still be cast with.
 */
export interface SlotColumn {
  kind: 'slots' | 'pact';
  /** The spell level of every slot in the column, 1 to 9. */
  level: number;
  max: number;
  spent: number;
  left: number;
}

/** The count spent of a spell level's slots, as stored. */
function spentAt(character: FifthEditionCharacter, level: number): number {
  const spent: Readonly<Partial<Record<string, number>>> = character.systemData.state.slotsSpent;
  return spent[`${level}`] ?? 0;
}

/**
 * The slot grid, by spell level from 1 up: a column for each level the character has slots of,
 * and one for its pact magic slots, after the column of its level when it has both. A level with
 * no slot has no column; a single higher-level slot, from an effect, has its own (ADR 010 item 9).
 */
export function fifthEditionSlotGrid(
  character: FifthEditionCharacter,
  computed: Pick<Computed<FifthEditionEntity>, 'values'>,
): SlotColumn[] {
  const read = (path: string) => (Object.hasOwn(computed.values, path) ? computed.values[path] : 0);
  const columns: SlotColumn[] = [];
  const column = (kind: SlotColumn['kind'], level: number, max: number, spent: number) =>
    columns.push({ kind, level, max, spent, left: Math.max(0, max - spent) });
  const pactLevel = whole(read(PACT_LEVEL_PATH));
  const pactSlots = whole(read(PACT_SLOTS_PATH));
  const pactSpent = character.systemData.state.pactSlotsSpent;
  for (let level = 1; level <= MAX_SPELL_LEVEL; level++) {
    const max = whole(read(slotsPath(level)));
    if (max > 0) column('slots', level, max, spentAt(character, level));
    if (pactSlots > 0 && pactLevel === level) column('pact', level, pactSlots, pactSpent);
  }
  return columns;
}

/** The own uses of a spell a grant gives, which it is cast through with no slot (ENG-57). */
export interface SpellUses {
  /** The resource key of the grant. */
  key: string;
  max: number;
  spent: number;
  left: number;
  /** What comes back, and when: each event the grants name (SHEET-20). */
  recovery: readonly ResourceRecovery[];
}

/** Where a spell on the list comes from. */
export type SpellFrom =
  | { kind: 'list'; source: EntityId }
  | { kind: 'grant'; source: EntityId; part: string };

/** A spell on the sheet's list. */
export interface SpellListEntry {
  /** The spell's id. */
  id: EntityId;
  from: SpellFrom;
  /** The name of the entity `from` names; `undefined` when no pack has it. */
  sourceName?: L10n;
  /** `undefined` for a spell no pack has: the sheet shows it as missing (SPEC §8.2). */
  spell?: Extract<FifthEditionEntity, { type: 'spell' }>;
  /**
   * `true` for a spell on a list that holds spells known and spells prepared, where it is known
   * and not prepared. A spell a grant gives is always ready.
   */
  unprepared: boolean;
  /** A grant gives it as always prepared, outside the count the class allows. */
  alwaysPrepared?: true;
  /** Its own uses and no slot: the grant gives it a limit of its own (ADR 010 item 10). */
  uses?: SpellUses;
  /** The ruleset of the spell when it is not the character's and not `any` (ADR 005 item 3.5). */
  otherRuleset?: string;
}

/** The spell list's rows in the order stored, then the order granted. */
function entriesOf(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
): Pick<SpellListEntry, 'id' | 'from' | 'unprepared' | 'alwaysPrepared'>[] {
  const rows: Pick<SpellListEntry, 'id' | 'from' | 'unprepared' | 'alwaysPrepared'>[] = [];
  // A list that keeps spells known beside spells prepared: a prepared caster's or a spellbook's.
  const keepsKnown = new Set<string>(
    computed.entities.flatMap(({ entity }) =>
      (entity.type === 'class' || entity.type === 'subclass') &&
      (entity.spellcasting?.preparation === 'prepared' ||
        entity.spellcasting?.preparation === 'spellbook')
        ? [entity.id]
        : [],
    ),
  );
  for (const [source, { known = [], prepared = [] }] of Object.entries(
    character.systemData.spells,
  )) {
    for (const id of new Set([...prepared, ...known])) {
      rows.push({
        id: id as EntityId,
        from: { kind: 'list', source: source as EntityId },
        unprepared: keepsKnown.has(source) && known.includes(id) && !prepared.includes(id),
      });
    }
  }
  for (const { part, source, grant, chosen } of computed.grants) {
    if (grant.kind !== 'spell') continue;
    for (const id of new Set([...(grant.fixed ?? []), ...chosen])) {
      rows.push({
        id: id as EntityId,
        from: { kind: 'grant', source, part },
        unprepared: false,
        ...(grant.alwaysPrepared === true && { alwaysPrepared: true as const }),
      });
    }
  }
  return rows;
}

/** The own uses of the spell grant at `part`, or none when it gives its spells slots. */
function usesOf(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
  part: string,
): SpellUses | undefined {
  const reached = computed.grants.find((each) => each.part === part);
  const key = reached?.grant.kind === 'spell' ? reached.grant.key : undefined;
  if (key === undefined) return undefined;
  const uses = resourceUses(character, computed, key);
  if (uses === undefined) return undefined;
  return { key, ...uses, recovery: recoveryOf(computed, key) };
}

/**
 * The spells the character has, to list: those its classes and subclasses know and have prepared,
 * then those its features give, each once for each place it comes from. A pack that lacks a spell
 * leaves it in, without its `spell`, so the sheet says "Missing: <id>" (SPEC §8.2). A spell of the
 * other edition carries `otherRuleset`, as a gathered entity gets its warning: a spell a grant
 * names is looked up, not gathered (SHEET-28).
 */
export function fifthEditionSpells(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  computed: Computed<FifthEditionEntity>,
): SpellListEntry[] {
  const find = finderOf(character, index);
  return entriesOf(character, computed).map((row) => {
    const found = find(row.id);
    const spell = found?.type === 'spell' ? found : undefined;
    const uses = row.from.kind === 'grant' ? usesOf(character, computed, row.from.part) : undefined;
    const sourceName = find(row.from.source)?.name;
    const foreign =
      spell !== undefined && spell.ruleset !== ANY_RULESET && spell.ruleset !== character.ruleset;
    return {
      ...row,
      ...(sourceName !== undefined && { sourceName }),
      ...(spell !== undefined && { spell }),
      ...(uses !== undefined && { uses }),
      ...(foreign && { otherRuleset: spell.ruleset }),
    };
  });
}

/**
 * The spellcasting at the top of the Spells tab: what the header shows for each casting class
 * (`fifthEditionCasting`), then a row for each stat a spell grant names, whose spells are cast with
 * their own DC and attack (ENG-51). The header's line names the classes only (SHEET-30).
 */
export function fifthEditionSpellcasting(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
): HeaderCasting[] {
  const rows = fifthEditionCasting(character, computed);
  const stats = new Set<string>();
  for (const { source, grant } of computed.grants) {
    const stat = grantCastingStat(grant);
    const path = stat === undefined ? undefined : statSpellPath(stat);
    if (stat === undefined || path === undefined || stats.has(stat)) continue;
    if (!Object.hasOwn(computed.values, `${path}.dc`)) continue;
    stats.add(stat);
    rows.push({ source, ability: stat, dc: `${path}.dc`, attack: `${path}.attack` });
  }
  return rows;
}

/**
 * The change one tap on a circle of the grid makes (BRIEF: slots are trackers play mode changes):
 * one slot of `column` spent, or given back. Refused as `spendSlot` and `regainSlot` refuse.
 */
export function fifthEditionSlotChange(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  column: Pick<SlotColumn, 'kind' | 'level'>,
  spend: boolean,
  stamp: LogStamp,
): SlotResult {
  const slot = column.kind === 'pact' ? ('pact' as const) : { level: column.level };
  return spend
    ? spendSlot(character, index, { slot }, stamp)
    : regainSlot(character, { slot, amount: 1 }, stamp);
}
