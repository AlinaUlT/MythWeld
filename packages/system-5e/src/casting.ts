import {
  type ActionResult,
  type ContentIndex,
  changeTo,
  compute,
  finderOf,
  type LogStamp,
  resourceSpentPath,
  resourceUses,
} from '@grimoire/engine';
import type { LogChange } from '@grimoire/schema';
import {
  CONCENTRATION_PATH,
  isWhole,
  PACT_SPENT_PATH,
  settled,
  slotSpentPath,
  type Unchanged,
  whole,
} from './actions';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionModule } from './module';
import { PACT_LEVEL_PATH, PACT_SLOTS_PATH, slotsPath } from './spellcasting';
import { MAX_SPELL_LEVEL } from './system';

// ENG-20: fifth edition's slots and concentration (SPEC §6.4), each change one log entry (ADR 014
// item 10). A cast spends the slot the person picks, of the spell's level or higher, or a pact
// slot of a level at least the spell's, whichever class the spell is from; or no slot at all
// ("use a slot: no", ADR 014 item 7). A concentration spell takes the place of the one held. A
// slot is spent only while the computed slots (ENG-15) are more than the spent ones. The rules
// are ENG-20 §8's.
// ENG-57: or one of the own uses of the spell grant that gives the spell, named by its part: a
// resource of the core (`spell-uses.ts`), spent while its maximum is more than the uses spent.

/** A slot: one of a spell level, 1 to 9, or a pact magic slot. */
export type SlotAsk = { readonly level: number } | 'pact';

/**
 * What a cast asks for: the spell, and the slot it uses, or the part of the spell grant whose own
 * uses it spends (ENG-57); with neither, it uses none.
 */
export interface CastAsk {
  readonly spell: string;
  readonly slot?: SlotAsk;
  readonly grant?: string;
}

/** Why a slot or a cast did not change. `code` and its data are for the screen. */
export type SlotRefusal = { message: string } & (
  | { code: 'badLevel'; level: number }
  | { code: 'noSlotLeft'; slot: SlotAsk; max: number; spent: number }
  | { code: 'slotTooLow'; slot: SlotAsk; slotLevel: number; spellLevel: number }
  | { code: 'cantripSlot'; id: string }
  | { code: 'missing'; id: string }
  | { code: 'notASpell'; id: string; type: string }
  | { code: 'badCount'; count: number }
  | { code: 'slotAndGrant'; slot: SlotAsk; grant: string }
  | { code: 'noSpellUses'; grant: string }
  | { code: 'notGiven'; grant: string; id: string }
  | { code: 'noUseLeft'; grant: string; key: string; max: number; spent: number }
);

/** What a slot or a cast gives: the changed character and its entry, or why nothing changed. */
export type SlotResult = ActionResult<FifthEditionCharacter, SlotRefusal | Unchanged>;

/** Where a slot's spent count is kept, and the count. */
interface Spent {
  ok: true;
  path: string[];
  spent: number;
}

/** The text of a slot, for a log message and an entry's subject: its level, or `pact`. */
function slotName(slot: SlotAsk): string {
  return slot === 'pact' ? 'pact' : `${slot.level}`;
}

/** Where `slot`'s spent count is kept, and the count. Refused for a level outside 1 to 9. */
function spentOf(
  character: FifthEditionCharacter,
  slot: SlotAsk,
): Spent | ({ ok: false } & SlotRefusal) {
  const state = character.systemData.state;
  if (slot === 'pact') return { ok: true, path: PACT_SPENT_PATH, spent: state.pactSlotsSpent };
  const { level } = slot;
  if (!isWhole(level, 1) || level > MAX_SPELL_LEVEL) {
    const message = `${level} is not a spell level from 1 to ${MAX_SPELL_LEVEL}.`;
    return { ok: false, code: 'badLevel', level, message };
  }
  const spent: Readonly<Partial<Record<string, number>>> = state.slotsSpent;
  return { ok: true, path: slotSpentPath(level), spent: spent[`${level}`] ?? 0 };
}

/**
 * The change that spends one `slot`, with its level: refused for a bad level, and when the
 * character computes no more of them than are spent.
 */
function spending(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  slot: SlotAsk,
): { ok: true; level: number; change: LogChange } | ({ ok: false } & SlotRefusal) {
  const place = spentOf(character, slot);
  if (!place.ok) return place;
  const { values } = compute(character, index, fifthEditionModule);
  const max = whole(values[slot === 'pact' ? PACT_SLOTS_PATH : slotsPath(slot.level)]);
  const level = slot === 'pact' ? whole(values[PACT_LEVEL_PATH]) : slot.level;
  const { path, spent } = place;
  if (spent >= max) {
    const message = `The character has ${max} slots "${slotName(slot)}", ${spent} spent.`;
    return { ok: false, code: 'noSlotLeft', slot, max, spent, message };
  }
  return { ok: true, level, change: changeTo(character, path, spent + 1) };
}

/**
 * The change that spends one of the own uses of the spell grant at `grant`, which must give
 * `spell`: refused when no spell grant with uses at that part reaches the character, when it does
 * not give the spell, and when none of its uses is left.
 */
function spendingUse(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  grant: string,
  spell: string,
): { ok: true; change: LogChange } | ({ ok: false } & SlotRefusal) {
  const computed = compute(character, index, fifthEditionModule);
  const reached = computed.grants.find(
    (each) => each.part === grant && each.grant.kind === 'spell',
  );
  const key = reached?.grant.kind === 'spell' ? reached.grant.key : undefined;
  const uses = key === undefined ? undefined : resourceUses(character, computed, key);
  if (reached === undefined || key === undefined || uses === undefined) {
    const message = `No spell grant with its own uses at "${grant}" reaches the character.`;
    return { ok: false, code: 'noSpellUses', grant, message };
  }
  const given = reached.grant.kind === 'spell' ? (reached.grant.fixed ?? []) : [];
  if (![...given, ...reached.chosen].includes(spell)) {
    const message = `"${grant}" does not give "${spell}".`;
    return { ok: false, code: 'notGiven', grant, id: spell, message };
  }
  const { max, spent, left } = uses;
  if (left < 1) {
    const message = `"${grant}" has ${max} uses of "${key}", ${spent} spent.`;
    return { ok: false, code: 'noUseLeft', grant, key, max, spent, message };
  }
  return { ok: true, change: changeTo(character, resourceSpentPath(key), spent + 1) };
}

/**
 * The character after casting `ask.spell` with `ask.slot`, through the own uses of the spell grant
 * `ask.grant`, or with neither, and the entry: the slot or the use is spent, and a concentration
 * spell becomes the one held, ending the one before. Refused for a spell no pack has or an entity
 * that is not a spell, a slot and a grant together, a cantrip with a slot, a slot it cannot use (a
 * bad level, none left, a level below the spell's), uses it cannot spend (no such grant, not its
 * spell, none left), and as `unchanged` when the cast changes nothing (no slot, no use, no new
 * concentration).
 */
export function castSpell(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: CastAsk,
  stamp: LogStamp,
): SlotResult {
  const { spell: id, slot, grant } = ask;
  const spell = finderOf(character, index)(id);
  if (spell === undefined)
    return { ok: false, code: 'missing', id, message: `No pack has "${id}".` };
  if (spell.type !== 'spell') {
    const { type } = spell;
    return { ok: false, code: 'notASpell', id, type, message: `"${id}" is a ${type}.` };
  }
  if (slot !== undefined && grant !== undefined) {
    const message = `A cast uses a slot or the uses of "${grant}", not both.`;
    return { ok: false, code: 'slotAndGrant', slot, grant, message };
  }
  const changes: LogChange[] = [];
  if (grant !== undefined) {
    const used = spendingUse(character, index, grant, spell.id);
    if (!used.ok) return used;
    changes.push(used.change);
  }
  if (slot !== undefined) {
    if (spell.level === 0) {
      const message = `"${id}" is a cantrip, cast without a slot.`;
      return { ok: false, code: 'cantripSlot', id, message };
    }
    const spent = spending(character, index, slot);
    if (!spent.ok) return spent;
    if (spent.level < spell.level) {
      const message = `A slot "${slotName(slot)}" of level ${spent.level} cannot hold a spell of level ${spell.level}.`;
      return {
        ok: false,
        code: 'slotTooLow',
        slot,
        slotLevel: spent.level,
        spellLevel: spell.level,
        message,
      };
    }
    changes.push(spent.change);
  }
  if (spell.concentration) changes.push(changeTo(character, CONCENTRATION_PATH, spell.id));
  return settled<SlotRefusal>(
    character,
    stamp,
    { action: 'castSpell', subject: spell.id, label: spell.name, changes },
    `Casting "${id}" without a slot changes nothing.`,
  );
}

/**
 * The character after spending one `ask.slot` with no spell, and the entry. Refused for a bad
 * level, and when none is left.
 */
export function spendSlot(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly slot: SlotAsk },
  stamp: LogStamp,
): SlotResult {
  const spent = spending(character, index, ask.slot);
  if (!spent.ok) return spent;
  return settled<SlotRefusal>(
    character,
    stamp,
    { action: 'spendSlot', subject: slotName(ask.slot), changes: [spent.change] },
    'Spending the slot changes nothing.',
  );
}

/**
 * The character after `ask.amount` spent slots of `ask.slot`, or all of them, are given back, and
 * the entry: the spent count goes down, never below 0. Refused for a bad level or amount, and as
 * `unchanged` when none is spent.
 */
export function regainSlot(
  character: FifthEditionCharacter,
  ask: { readonly slot: SlotAsk; readonly amount: number | 'all' },
  stamp: LogStamp,
): SlotResult {
  const { slot, amount } = ask;
  if (amount !== 'all' && !isWhole(amount, 1)) {
    const message = `${amount} is not a count of slots.`;
    return { ok: false, code: 'badCount', count: amount, message };
  }
  const place = spentOf(character, slot);
  if (!place.ok) return place;
  const { path, spent } = place;
  if (spent === 0) {
    return { ok: false, code: 'unchanged', message: `No slot "${slotName(slot)}" is spent.` };
  }
  return settled<SlotRefusal>(
    character,
    stamp,
    {
      action: 'regainSlot',
      subject: slotName(slot),
      changes: [changeTo(character, path, amount === 'all' ? 0 : Math.max(0, spent - amount))],
    },
    `No slot "${slotName(slot)}" is spent.`,
  );
}

/**
 * The character with no concentration, and the entry, whether or not a pack still has the spell.
 * Refused as `unchanged` when it concentrates on nothing.
 */
export function endConcentration(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  stamp: LogStamp,
): SlotResult {
  const id = character.systemData.state.concentration;
  if (id === undefined) {
    return { ok: false, code: 'unchanged', message: 'The character concentrates on nothing.' };
  }
  return settled<SlotRefusal>(
    character,
    stamp,
    {
      action: 'endConcentration',
      subject: id,
      label: finderOf(character, index)(id)?.name,
      changes: [changeTo(character, CONCENTRATION_PATH, undefined)],
    },
    'The character concentrates on nothing.',
  );
}
