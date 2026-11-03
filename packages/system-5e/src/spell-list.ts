import { type Computed, type ContentIndex, finderOf, resourceUses } from '@grimoire/engine';
import type { EntityId, L10n } from '@grimoire/schema';
import { whole } from './actions';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { PACT_LEVEL_PATH, PACT_SLOTS_PATH, slotsPath } from './spellcasting';
import { MAX_SPELL_LEVEL } from './system';

// SHEET-46: what the Spells tab names for a fifth-edition character (ADR 010 items 9 and 10, ADR
// 009 item 4, board `V3-Spells`): the slot grid, one column per spell level that has slots, the
// pact magic slots a column of their own; and the spell list, the spells a class knows or has
// prepared followed by the spells a feature grants, each with its source and, for a grant with its
// own uses, those uses ("1/LR", cast with no spell slot, ENG-57). Pure: the screen only draws it.

/** One column of the slot grid. */
export interface SlotColumn {
  /** `"1"` to `"9"`, or `"pact"`. */
  key: string;
  /** The spell level of the slots in it. */
  level: number;
  pact: boolean;
  /** How many the character has now (`spell.slots.level<N>`, `spell.pact.slots`). */
  max: number;
  /** How many are still there: the slots less the spent ones, never below 0. */
  left: number;
}

/**
 * The slot grid: the spell levels 1 to 9 the character has slots of, then the pact slots when it
 * has any. A column's circles are `max`, the first `left` of them full. A level with no slot has
 * no column, so the grid follows the slots the character really has, a single higher-level slot
 * included (ADR 010 item 9).
 */
export function fifthEditionSlots(
  character: FifthEditionCharacter,
  computed: Pick<Computed<FifthEditionEntity>, 'values'>,
): SlotColumn[] {
  const { state } = character.systemData;
  const spentAt: Readonly<Partial<Record<string, number>>> = state.slotsSpent;
  const columns: SlotColumn[] = [];
  for (let level = 1; level <= MAX_SPELL_LEVEL; level++) {
    const max = whole(computed.values[slotsPath(level)]);
    if (max < 1) continue;
    columns.push({
      key: `${level}`,
      level,
      pact: false,
      max,
      left: Math.max(0, max - (spentAt[`${level}`] ?? 0)),
    });
  }
  const pact = whole(computed.values[PACT_SLOTS_PATH]);
  if (pact > 0) {
    columns.push({
      key: 'pact',
      level: whole(computed.values[PACT_LEVEL_PATH]),
      pact: true,
      max: pact,
      left: Math.max(0, pact - state.pactSlotsSpent),
    });
  }
  return columns;
}

/** The own uses of a spell a grant gives. */
export interface SpellRowUses {
  /** The key of the resource, `resources.<key>.max`. */
  key: string;
  max: number;
  left: number;
  /** The recovery events, each once, in the order the grant lists them (`long`, `short`, …). */
  recovery: readonly string[];
}

/** One line of the spell list. */
export interface SpellRow {
  /** The spell's id. */
  id: EntityId;
  /** Where the line comes from: a class's own spells, or a spell grant of an entity. */
  from: 'class' | 'grant';
  /** The class or subclass whose spell it is, or the entity that grants it. */
  source: EntityId;
  /** The source's name; absent when no pack has it. */
  sourceName?: L10n;
  /** The grant's part, for a spell a grant gives (the `grant` of a cast, ENG-57). */
  grant?: string;
  /** Absent when no pack has the spell: the screen says it is missing, and nothing else is known. */
  name?: L10n;
  /** 0 for a cantrip. */
  level?: number;
  /** The spell's own rules base, `2014`, `2024` or `any`. */
  ruleset?: string;
  /** The spell is of the other rules base than the character's (it is not `any`). */
  otherRuleset: boolean;
  /** Whether it is ready to cast: prepared, or known by a class that casts what it knows. */
  prepared: boolean;
  /** A spell a grant gives with its own uses, cast with no spell slot. */
  uses?: SpellRowUses;
}

/** The recovery events of a grant's uses, each once. */
function recoveryEvents(recovery: readonly { on: string }[]): string[] {
  return [...new Set(recovery.map(({ on }) => on))];
}

/**
 * The spell list: first what each class or subclass in `systemData.spells` knows and has
 * prepared, then what each spell grant that reaches the character gives (a fixed spell, and a
 * chosen one). A spell a class knows that is not prepared is listed, `prepared: false`, when the
 * class prepares its spells; a class that casts what it knows has every spell ready. Ordered by
 * spell level, a cantrip first, then in the order met. A spell no pack has is still a row.
 */
export function fifthEditionSpellRows(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
  index: ContentIndex<FifthEditionEntity>,
): SpellRow[] {
  const find = finderOf(character, index);
  const rows: SpellRow[] = [];

  const row = (
    id: EntityId,
    from: SpellRow['from'],
    source: EntityId,
    prepared: boolean,
    more: Pick<SpellRow, 'grant' | 'uses'> = {},
  ): SpellRow => {
    const spell = find(id);
    const found = spell?.type === 'spell' ? spell : undefined;
    const sourceName = find(source)?.name;
    return {
      id,
      from,
      source,
      ...(sourceName !== undefined && { sourceName }),
      ...more,
      ...(found !== undefined && {
        name: found.name,
        level: found.level,
        ruleset: found.ruleset,
      }),
      otherRuleset:
        found !== undefined && found.ruleset !== 'any' && found.ruleset !== character.ruleset,
      prepared,
    };
  };

  for (const [source, { known = [], prepared = [] }] of Object.entries(
    character.systemData.spells,
  )) {
    const owner = find(source as EntityId);
    const def =
      owner?.type === 'class' || owner?.type === 'subclass' ? owner.spellcasting : undefined;
    const castsWhatItKnows = def?.preparation === 'known';
    const ready = new Set(prepared);
    for (const id of new Set([...known, ...prepared])) {
      rows.push(row(id, 'class', source as EntityId, castsWhatItKnows || ready.has(id)));
    }
  }

  for (const { part, source, grant, chosen } of computed.grants) {
    if (grant.kind !== 'spell') continue;
    // A chosen id is stored as written; a pack's entity ids are `<pack>:<type>/<slug>`.
    const given = new Set([...(grant.fixed ?? []), ...(chosen as EntityId[])]);
    const uses = grant.key === undefined ? undefined : resourceUses(character, computed, grant.key);
    for (const id of given) {
      rows.push(
        row(id, 'grant', source, true, {
          grant: part,
          ...(grant.uses !== undefined &&
            grant.key !== undefined &&
            uses !== undefined && {
              uses: {
                key: grant.key,
                max: uses.max,
                left: uses.left,
                recovery: recoveryEvents(grant.uses.recovery),
              },
            }),
        }),
      );
    }
  }

  // A stable sort: the same level keeps the order met. A missing spell, with no level, goes last.
  return rows
    .map((each, order) => ({ each, order }))
    .sort(
      (a, b) =>
        (a.each.level ?? MAX_SPELL_LEVEL + 1) - (b.each.level ?? MAX_SPELL_LEVEL + 1) ||
        a.order - b.order,
    )
    .map(({ each }) => each);
}
