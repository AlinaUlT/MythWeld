import type { EffectPhase, EntityPartId } from '@grimoire/schema';
import {
  type ComputedKey,
  type Derived,
  type KeyPath,
  LEVEL_PATH,
  type PartReader,
} from './derived';
import {
  type ActiveEffect,
  activeEffects,
  type EffectKey,
  type EffectNumber,
  type EffectReader,
  type EffectWarning,
  effectKey,
  effectNumber,
  numberChangeOf,
  phaseOf,
  statTargetOf,
} from './effects';
import type { CharacterCore, GatherableEntity, Gathered } from './gather';
import { applyEffects, type BasePhase, type BreakdownStep, type KeyStep } from './stats';

// ENG-17: SPEC §6.1 steps 6 and 7. A computed path is finished when it is computed: after its own
// steps come the effects left to it, by phase (`base`, `derived`, `final`), then by priority, then
// its override, which always wins. A base-phase effect on a stat's score or maximum is the base
// phase's (ENG-12). `level` is read by gathering and the base phase first, so nothing changes it.
// ENG-43: a key path is finished in the same order, by each `set` naming one of its keys.

/** What a `fixedPath` warning names as the cause when it is an override. */
export const OVERRIDE = 'override';

/** The phases in the order they apply. */
const PHASE_ORDER: Readonly<Record<EffectPhase, number>> = { base: 0, derived: 1, final: 2 };

/** Something the phases met. `code` and its data are for the screen; `message` is for logs. */
export type PhaseWarning =
  | EffectWarning
  | ({ message: string } & (
      | { code: 'noTarget'; part: EntityPartId; target: string }
      | { code: 'fixedPath'; path: string; by: EntityPartId | typeof OVERRIDE }
      | { code: 'toggleGone'; part: string }
      | { code: 'overrideNoPath'; path: string }
      | { code: 'overrideNotANumber'; path: string; value: boolean | string }
      | {
          code: 'overrideNotAKey';
          path: string;
          value: number | boolean | string;
          keys: readonly string[];
        }
    ));

/** Steps 6 and 7, as `computeDerived` runs them on each path. */
export interface Phases {
  /** A path's value after its own: its effects, then its override. An effect reads by its part. */
  finish(path: string, own: Derived, readBy: PartReader): Derived;
  /** A key path's key after its own: its effects' `set`s, then its override. */
  finishKey(path: string, own: KeyPath, readBy: PartReader): ComputedKey;
  /** Everything the phases met, ending with the targets and overrides no path finished. */
  end(): PhaseWarning[];
}

/** An effect left to a path, and the phase it applies in. */
interface LeftEffect {
  active: ActiveEffect;
  phase: EffectPhase;
}

/** The order effects apply in: by phase, then by priority; a stable sort keeps gathering order. */
function inOrder(
  a: { phase: EffectPhase; priority: number },
  b: { phase: EffectPhase; priority: number },
): number {
  return PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.priority - b.priority;
}

/**
 * The phases of a character: its effects by target, its overrides by path. `base` is what the
 * base phase reads, for a base-phase effect on a path other than a stat's score or maximum.
 */
export function phasesOf<E extends GatherableEntity>(
  character: CharacterCore<E>,
  gathered: Gathered<E>,
  base: BasePhase,
): Phases {
  const warnings: PhaseWarning[] = [];
  const warn = (warning: PhaseWarning) => warnings.push(warning);
  const fixed = (by: EntityPartId | typeof OVERRIDE) =>
    warn({
      code: 'fixedPath',
      path: LEVEL_PATH,
      by,
      message: `${by === OVERRIDE ? 'An override' : `"${by}"`} changes @${LEVEL_PATH}, which gathering and the base phase have read; it is not applied.`,
    });

  // A stored switch counts only for an effect with a toggle, of an entity the character has.
  const toggles = new Set(
    gathered.entities.flatMap(({ entity }) =>
      (entity.effects ?? []).flatMap(({ id, toggle }) =>
        toggle === undefined ? [] : [`${entity.id}#${id}`],
      ),
    ),
  );
  for (const part of Object.keys(character.state.toggles)) {
    if (toggles.has(part)) continue;
    warn({
      code: 'toggleGone',
      part,
      message: `The switch "${part}" names no toggle of an entity the character has; it is not used.`,
    });
  }

  const byTarget = new Map<string, LeftEffect[]>();
  for (const active of activeEffects(gathered.entities, character.state.toggles)) {
    const { effect, part } = active;
    const phase = phaseOf(effect);
    if (phase === 'base' && statTargetOf(effect.target) !== undefined) continue;
    if (effect.target === LEVEL_PATH) {
      fixed(part);
      continue;
    }
    const left = byTarget.get(effect.target) ?? [];
    byTarget.set(effect.target, left);
    left.push({ active, phase });
  }

  const overrides = new Map<string, CharacterCore<E>['overrides'][number]>();
  for (const override of character.overrides) {
    if (override.path === LEVEL_PATH) fixed(OVERRIDE);
    else overrides.set(override.path, override);
  }

  const baseReader: EffectReader = {
    read: base.read,
    allows: (path) => base.read(path) !== undefined,
  };
  const finished = new Set<string>();

  return {
    finish(path, own, readBy) {
      finished.add(path);
      const steps: BreakdownStep[] = [...own.steps];
      const numbers: (EffectNumber & { phase: EffectPhase })[] = [];
      for (const { active, phase } of byTarget.get(path) ?? []) {
        const reader = phase === 'base' ? baseReader : { read: readBy(active.part) };
        const number = effectNumber(active, reader, warn);
        if (number !== undefined) numbers.push({ ...number, phase });
      }
      numbers.sort(inOrder);
      let value = applyEffects(steps, own.value, numbers);

      const override = overrides.get(path);
      if (override !== undefined) {
        if (typeof override.value === 'number') {
          const { note } = override;
          steps.push({
            kind: 'override',
            value: override.value,
            change: override.value - value,
            ...(note !== undefined && { note }),
          });
          value = override.value;
        } else {
          warn({
            code: 'overrideNotANumber',
            path,
            value: override.value,
            message: `The override of ${path} is ${JSON.stringify(override.value)}, not a number; it is not applied.`,
          });
        }
      }
      return { value, steps };
    },

    finishKey(path, own, readBy) {
      finished.add(path);
      const steps: KeyStep[] = [...own.steps];
      const keys: (EffectKey & { phase: EffectPhase })[] = [];
      for (const { active, phase } of byTarget.get(path) ?? []) {
        const reader = phase === 'base' ? baseReader : { read: readBy(active.part) };
        const set = effectKey(active, own.keys, reader, warn);
        if (set !== undefined) keys.push({ ...set, phase });
      }
      keys.sort(inOrder);
      let key = own.key;
      for (const { key: each, part, source, label } of keys) {
        steps.push({ kind: 'effect', part, source, label, key: each });
        key = each;
      }

      const override = overrides.get(path);
      if (override !== undefined) {
        const { value, note } = override;
        if (typeof value === 'string' && own.keys.includes(value)) {
          steps.push({ kind: 'override', key: value, ...(note !== undefined && { note }) });
          key = value;
        } else {
          warn({
            code: 'overrideNotAKey',
            path,
            value,
            keys: own.keys,
            message: `The override of ${path} is ${JSON.stringify(value)}, which is none of its keys (${own.keys.join(', ')}); it is not applied.`,
          });
        }
      }
      return { key, steps };
    },

    end() {
      const rest: PhaseWarning[] = [];
      for (const [target, left] of byTarget) {
        if (finished.has(target)) continue;
        for (const { active } of left) {
          // Another op names a list or a roll, which is not a number path (ENG-17 §3 item 5).
          if (numberChangeOf(active.effect) === undefined) continue;
          rest.push({
            code: 'noTarget',
            part: active.part,
            target,
            message: `"${active.part}" changes ${target}, which the character has no value for; it is not applied.`,
          });
        }
      }
      for (const path of overrides.keys()) {
        if (finished.has(path)) continue;
        rest.push({
          code: 'overrideNoPath',
          path,
          message: `The override of ${path} names no value the character has; it is not applied.`,
        });
      }
      return [...warnings, ...rest];
    },
  };
}
