import {
  type ActionResult,
  applyEntry,
  type ContentIndex,
  changeTo,
  compute,
  copyJson,
  type EntityFinder,
  entryOf,
  finderOf,
  type LogStamp,
  type MadeChanges,
  sameJson,
} from '@grimoire/engine';
import type { LogChange } from '@grimoire/schema';
import {
  type FifthEditionCharacter,
  type FifthEditionData,
  fifthEditionCharacterSchema,
} from './character';
import type { LevelHitPoints } from './combat';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionModule } from './module';
import { MAX_LEVEL } from './system';

// ENG-36: a level-up (SPEC §6.4, §7.4) as one log entry (ADR 014 item 10), built from the
// character it changes: the class one level higher with that level's hit points, its subclass,
// the picks the level opens, the feats and spells taken, and the current hit points, which rise by
// what the maximum rises, so the hit points lost stay lost. `reverseEntry` with the entry is the
// undo. What a person may bend (a multiclass prerequisite, the subclass level, the house rules) is
// the level-up wizard's warning (phase 4), never a refusal here.

/** A feat taken at a level-up, as `systemData.feats` keeps it. */
type TakenFeat = FifthEditionData['feats'][number];

/** The spells one class or subclass knows and has prepared, as `systemData.spells` keeps them. */
type Casting = FifthEditionData['spells'][keyof FifthEditionData['spells']];

/** What a level-up asks for. */
export interface LevelUpAsk {
  /** The class that gains the level: one the character has, or a new one, taken last. */
  readonly class: string;
  /** The new level's hit points: a roll of the class's die, its average, or its maximum. */
  readonly hp: LevelHitPoints;
  /** The subclass the class takes at this level. */
  readonly subclass?: string;
  /** The picks for the grants the level opens, or picks made again: part id → keys or ids. */
  readonly choices?: Readonly<Record<string, readonly string[]>>;
  /** Feats taken at this level, each in place of a grant's ability score improvement or by hand. */
  readonly feats?: readonly TakenFeat[];
  /** The spells a class or subclass knows and has prepared after this level, by its id. */
  readonly spells?: Readonly<Record<string, Casting>>;
}

/** The types a level-up names an entity as. */
type Named = 'class' | 'subclass' | 'feat';

/** A place in the result that its schema refuses, and why. */
export interface LevelUpIssue {
  path: readonly (string | number)[];
  message: string;
}

/** Why a level-up did not happen. `code` and its data are for the screen; `message` is for logs. */
export type LevelUpRefusal = { message: string } & (
  | { code: 'maxLevel'; level: number }
  | { code: 'missing'; id: string }
  | { code: 'wrongType'; id: string; type: string; expected: Named }
  | { code: 'otherClass'; id: string; classKey: string; expected: string }
  | { code: 'hasSubclass'; id: string; subclass: string }
  | { code: 'badHitPoints'; value: number; die: number }
  | { code: 'invalid'; issues: readonly LevelUpIssue[] }
);

/** What a level-up gives: the character one level higher and its entry, or why nothing changed. */
export type LevelUpResult = ActionResult<FifthEditionCharacter, LevelUpRefusal>;

const CLASSES = ['systemData', 'classes'];
const FEATS = ['systemData', 'feats'];
const SPELLS = ['systemData', 'spells'];
const HP_CURRENT = ['systemData', 'state', 'hp', 'current'];

/** The entity `id` names, the character's own first, when it is of the `expected` type. */
function named<T extends Named>(
  find: EntityFinder<FifthEditionEntity>,
  id: string,
  expected: T,
):
  | { ok: true; entity: Extract<FifthEditionEntity, { type: T }> }
  | ({ ok: false } & LevelUpRefusal) {
  const entity = find(id);
  if (entity === undefined) {
    return { ok: false, code: 'missing', id, message: `No pack has "${id}".` };
  }
  if (entity.type !== expected) {
    const { type } = entity;
    const message = `"${id}" is a ${type}, not a ${expected}.`;
    return { ok: false, code: 'wrongType', id, type, expected, message };
  }
  return { ok: true, entity: entity as Extract<FifthEditionEntity, { type: T }> };
}

/** The hit point maximum the character computes, or `undefined` when it is not a number. */
function maxOf(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
): number | undefined {
  const value = compute(character, index, fifthEditionModule).values['hp.max'];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * The character one level higher in `ask.class`, with the entry that makes the change: the class
 * with that level's hit points (a new class is taken last, at level 1), the subclass, the picks,
 * the feats and the spells asked for, and the current hit points raised by the maximum's rise,
 * never below 0. Refused, with nothing changed, past level 20, for a class, subclass or feat no pack
 * has or of another type, a roll the class's die cannot give, a subclass for a class that has one,
 * or a result the character's schema refuses.
 */
export function levelUp(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: LevelUpAsk,
  stamp: LogStamp,
): LevelUpResult {
  const level = fifthEditionModule.level(character);
  if (level >= MAX_LEVEL) {
    const message = `The character is level ${level}, the highest there is.`;
    return { ok: false, code: 'maxLevel', level, message };
  }
  const find = finderOf(character, index);
  const found = named(find, ask.class, 'class');
  if (!found.ok) return found;
  const taken = found.entity;
  const { hp } = ask;
  const die = taken.hitDie;
  if (typeof hp === 'number' && !(Number.isInteger(hp) && hp >= 1 && hp <= die)) {
    const message = `A d${die} does not roll ${hp}.`;
    return { ok: false, code: 'badHitPoints', value: hp, die, message };
  }
  const data = character.systemData;
  const had = data.classes.find((entry) => entry.id === taken.id);
  if (ask.subclass !== undefined) {
    if (had?.subclass !== undefined) {
      const { subclass } = had;
      const message = `"${taken.id}" already has the subclass "${subclass}".`;
      return { ok: false, code: 'hasSubclass', id: taken.id, subclass, message };
    }
    const sub = named(find, ask.subclass, 'subclass');
    if (!sub.ok) return sub;
    const { id, classKey } = sub.entity;
    if (classKey !== taken.key) {
      const message = `"${id}" is a subclass of "${classKey}", not of "${taken.key}".`;
      return { ok: false, code: 'otherClass', id, classKey, expected: taken.key, message };
    }
  }
  for (const feat of ask.feats ?? []) {
    const isFeat = named(find, feat.id, 'feat');
    if (!isFeat.ok) return isFeat;
  }

  const subclass = ask.subclass === undefined ? {} : { subclass: ask.subclass };
  const classes =
    had === undefined
      ? [...data.classes, { id: taken.id, ...subclass, level: 1, hp: [hp] }]
      : data.classes.map((entry) =>
          entry === had
            ? { ...entry, ...subclass, level: entry.level + 1, hp: [...entry.hp, hp] }
            : entry,
        );
  const changes: LogChange[] = [
    changeTo(character, CLASSES, copyJson(classes)),
    ...Object.entries(ask.choices ?? {}).map(([part, picked]) =>
      changeTo(character, ['choices', part], copyJson(picked)),
    ),
    ...(ask.feats === undefined || ask.feats.length === 0
      ? []
      : [changeTo(character, FEATS, copyJson([...data.feats, ...ask.feats]))]),
    ...Object.entries(ask.spells ?? {}).map(([id, casting]) =>
      changeTo(character, [...SPELLS, id], copyJson(casting)),
    ),
  ].filter((change) => !sameJson(change.before, change.after));
  const made: Omit<MadeChanges, 'changes'> = {
    action: 'levelUp',
    subject: taken.id,
    label: taken.name,
  };

  const draft = applyEntry(character, entryOf(stamp, { ...made, changes }));
  if (!draft.ok) return draft;
  const checked = fifthEditionCharacterSchema.safeParse(draft.character);
  if (!checked.success) {
    const issues = checked.error.issues.map(({ path, message }) => ({
      path: path.map((step) => (typeof step === 'symbol' ? String(step) : step)),
      message,
    }));
    const listed = issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    return {
      ok: false,
      code: 'invalid',
      issues,
      message: `The character after the level-up would not open: ${listed}.`,
    };
  }
  const before = maxOf(character, index);
  const after = maxOf(draft.character, index);
  if (before !== undefined && after !== undefined) {
    const current = data.state.hp.current;
    const raised = Math.max(0, Math.floor(current + after - before));
    if (raised !== current) changes.push(changeTo(character, HP_CURRENT, raised));
  }
  const entry = entryOf(stamp, { ...made, changes });
  const applied = applyEntry(character, entry);
  return applied.ok ? { ok: true, character: applied.character, entry } : applied;
}
