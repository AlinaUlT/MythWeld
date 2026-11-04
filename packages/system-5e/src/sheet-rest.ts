import type { Computed } from '@grimoire/engine';
import { resourceUses } from '@grimoire/engine';
import type { EntityId, L10n } from '@grimoire/schema';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { hitDicePath } from './hit-dice';
import type { RestResult } from './rests';
import { rulesOf } from './rulesets';
import { HIT_DIE_SIZES, MAX_SPELL_LEVEL } from './system';

// SHEET-45: what the Rest panel asks of a fifth-edition character (board V3-Rest, BRIEF P6). The
// panel runs `shortRest` or `longRest` on a copy and lists what it changed, so the lists hold no
// rest rule: each line below is the difference between the character before and after. The hit
// dice a short rest can spend, and whether the edition's long rest asks for food and drink for
// exhaustion (SRD 5.1), are the module's too.

/** A size of hit die the character has: how many, and how many are not spent. */
export interface RestHitDie {
  die: number;
  max: number;
  left: number;
}

/** One thing a rest gives back or ends. */
export type RestLine =
  | { kind: 'hitPoints'; from: number; to: number; max: number }
  | { kind: 'tempHitPoints'; lost: number }
  /** A short rest's hit die: what it rolled and the hit points it gave. */
  | { kind: 'hitDie'; die: number; roll: number; hp: number }
  | { kind: 'hitDiceBack'; die: number; back: number }
  | { kind: 'slots'; level: number; back: number }
  | { kind: 'pactSlots'; back: number }
  | { kind: 'uses'; key: string; label: L10n | undefined; back: number; left: number; max: number }
  | { kind: 'condition'; id: EntityId; from: number; to: number }
  | { kind: 'concentrationEnds'; id: EntityId }
  | { kind: 'inspiration'; to: number }
  | { kind: 'knockOutEnds' };

/** A computed number, 0 when it is not one. */
function numberAt(computed: Pick<Computed<FifthEditionEntity>, 'values'>, path: string): number {
  const value = computed.values[path];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** The hit dice the character has, the largest first, with the ones not spent. */
export function fifthEditionRestDice(
  character: FifthEditionCharacter,
  computed: Pick<Computed<FifthEditionEntity>, 'values'>,
): RestHitDie[] {
  const spent: Readonly<Partial<Record<string, number>>> = character.systemData.state.hitDiceSpent;
  return [...HIT_DIE_SIZES]
    .sort((a, b) => b - a)
    .flatMap((die) => {
      const max = Math.max(0, Math.floor(numberAt(computed, hitDicePath(die))));
      return max === 0 ? [] : [{ die, max, left: Math.max(0, max - (spent[`d${die}`] ?? 0)) }];
    });
}

/** Whether the edition's long rest lowers exhaustion only with food and drink (SRD 5.1). */
export function restNeedsFood(character: Pick<FifthEditionCharacter, 'ruleset'>): boolean {
  return rulesOf(character).longRestNeedsFood;
}

/**
 * What a rest that worked changed, line by line, from the character before it (and its
 * `computed`) and the character after. A thing that did not change has no line.
 */
export function fifthEditionRestLines(
  before: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
  result: Extract<RestResult, { ok: true }>,
): RestLine[] {
  const after = result.character;
  const was = before.systemData.state;
  const now = after.systemData.state;
  const lines: RestLine[] = [];
  const max = Math.floor(numberAt(computed, 'hp.max'));
  if (now.hp.current > was.hp.current) {
    lines.push({ kind: 'hitPoints', from: was.hp.current, to: now.hp.current, max });
  }
  if (was.hp.temp > 0 && now.hp.temp === 0)
    lines.push({ kind: 'tempHitPoints', lost: was.hp.temp });
  for (const { die, roll, hp } of result.outcome.hitDice) {
    lines.push({ kind: 'hitDie', die, roll, hp });
  }
  for (const die of [...HIT_DIE_SIZES].sort((a, b) => b - a)) {
    const back = (was.hitDiceSpent[`d${die}`] ?? 0) - (now.hitDiceSpent[`d${die}`] ?? 0);
    if (back > 0) lines.push({ kind: 'hitDiceBack', die, back });
  }
  for (let level = 1; level <= MAX_SPELL_LEVEL; level += 1) {
    const key = `${level}` as keyof typeof was.slotsSpent;
    const back = (was.slotsSpent[key] ?? 0) - (now.slotsSpent[key] ?? 0);
    if (back > 0) lines.push({ kind: 'slots', level, back });
  }
  if (was.pactSlotsSpent > now.pactSlotsSpent) {
    lines.push({ kind: 'pactSlots', back: was.pactSlotsSpent - now.pactSlotsSpent });
  }
  for (const key of new Set(computed.resources.map((given) => given.key))) {
    const earlier = resourceUses(before, computed, key);
    const later = resourceUses(after, computed, key);
    if (earlier === undefined || later === undefined || later.left <= earlier.left) continue;
    lines.push({
      kind: 'uses',
      key,
      label: computed.resources.find((given) => given.key === key)?.label,
      back: later.left - earlier.left,
      left: later.left,
      max: Math.floor(later.max),
    });
  }
  for (const stored of before.state.conditions) {
    const kept = after.state.conditions.find(({ id }) => id === stored.id);
    const from = stored.level ?? 1;
    const to = kept === undefined ? 0 : (kept.level ?? 1);
    if (to < from) lines.push({ kind: 'condition', id: stored.id, from, to });
  }
  if (was.concentration !== undefined && now.concentration === undefined) {
    lines.push({ kind: 'concentrationEnds', id: was.concentration });
  }
  if (now.inspiration > was.inspiration) lines.push({ kind: 'inspiration', to: now.inspiration });
  if (was.knockedOut !== undefined && now.knockedOut === undefined) {
    lines.push({ kind: 'knockOutEnds' });
  }
  return lines;
}
