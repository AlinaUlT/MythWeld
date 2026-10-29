import { z } from 'zod';
import { entityKeySchema, uuidSchema } from './ids';
import { type Migration, openerOf } from './migration';
import { rollerSchema } from './roll';
import { l10nSchema, visibleTextSchema } from './text';

// ENG-30: a change to a character as one entry (ADR 014 item 10): who made it, when, what it
// changed, and each changed field's value before and after. The engine applies and reverses it
// (`applyEntry`, `reverseEntry`); an entry not applied yet is a pending change, and its `after`
// values are what a game master edits before approving it. A device that receives one checks it
// here first, so no entry can reach an object's prototype.

/** The steps that reach an object's prototype instead of its own fields. Never a path's step. */
export const UNSAFE_PATH_STEPS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

/** One field's name on the way from the character's root. */
const pathStepSchema = z
  .string()
  .min(1)
  .refine((step) => !UNSAFE_PATH_STEPS.includes(step), 'Reaches an object prototype.');

/**
 * A place in a stored character: field names from its root, `['state', 'resources', 'luck']`. A
 * list is one value, so a path never points into one.
 */
export const docPathSchema = z.array(pathStepSchema).min(1);
export type DocPath = z.infer<typeof docPathSchema>;

/** One field's value before and after. A missing value is a field that is not there. */
export const logChangeSchema = z.strictObject({
  path: docPathSchema,
  before: z.json().optional(),
  after: z.json().optional(),
});
export type LogChange = z.infer<typeof logChangeSchema>;

/** `inner` is `outer`, or a place inside it. */
function within(inner: readonly string[], outer: readonly string[]): boolean {
  return outer.length <= inner.length && outer.every((step, index) => inner[index] === step);
}

/** A change to a character: its changes touch each place once, and none inside another's. */
export const logEntrySchema = z.strictObject({
  id: uuidSchema,
  at: z.iso.datetime(),
  by: rollerSchema,
  /** What was done, as a key the screen names: `useResource`, `setCondition`. */
  action: entityKeySchema,
  /** What it was done to: a resource's key, a condition's id, a toggle's part id. */
  subject: visibleTextSchema,
  /** The name of what changed, when the content still has it. */
  label: l10nSchema.optional(),
  changes: z
    .array(logChangeSchema)
    .min(1)
    .superRefine((changes, ctx) => {
      for (const [index, { path }] of changes.entries()) {
        const other = changes.findIndex(
          (each, at) => at !== index && (within(path, each.path) || within(each.path, path)),
        );
        if (other !== -1 && other < index) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'path'],
            message: `Touches the place of change ${other}.`,
          });
        }
      }
    }),
});
export type LogEntry = z.infer<typeof logEntrySchema>;

// SHEET-23: a change as the device's history keeps it (SPEC §7.2): the entry as it was applied,
// at the history's version, under the character it changed. The entry names who made the change,
// not which character it changed, so the row does.

/** The history's stored shape. A change to it bumps this and adds a step to the chain. */
export const HISTORY_SCHEMA_VERSION = 1;

/** The steps to `HISTORY_SCHEMA_VERSION`: step N takes version N + 1 to N + 2. */
const HISTORY_MIGRATIONS: readonly Migration[] = [];

/**
 * One row of the history. `id` and `at` repeat the entry's id and its time, as the table's keys;
 * `at` is the time as `toISOString` writes it, so text order is time order.
 */
export const historyRowSchema = z
  .strictObject({
    schemaVersion: z.literal(HISTORY_SCHEMA_VERSION),
    id: uuidSchema,
    characterId: uuidSchema,
    at: z.iso.datetime(),
    entry: logEntrySchema,
  })
  .superRefine((row, ctx) => {
    const keys = { id: row.entry.id, at: new Date(row.entry.at).toISOString() };
    for (const [field, value] of Object.entries(keys)) {
      if (row[field as keyof typeof keys] !== value) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `${JSON.stringify(row[field as keyof typeof keys])} is not the entry's ${JSON.stringify(value)}.`,
        });
      }
    }
  });
export type HistoryRow = z.infer<typeof historyRowSchema>;

/** The row the history keeps for `entry`, a change to the character `characterId`. */
export function historyRowOf(characterId: string, entry: LogEntry): HistoryRow {
  return {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    id: entry.id,
    characterId,
    at: new Date(entry.at).toISOString(),
    entry,
  };
}

/** The migration frame for the history's rows. */
export const openHistoryRow = openerOf(historyRowSchema, [
  { field: 'schemaVersion', migrations: HISTORY_MIGRATIONS },
]);
