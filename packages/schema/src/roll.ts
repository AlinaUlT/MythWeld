import { z } from 'zod';
import { formulaSchema } from './formula';
import { computedPathSchema, entityIdSchema, uuidSchema } from './ids';
import { visibleTextSchema } from './text';

// ENG-26: a roll as the table link will send it (ADR 005 item 5.6): who rolled, what for, the dice,
// the result and the breakdown, and who may see it. The engine builds one with `recordRoll`; a
// device that receives one checks it here, so a record that does not add up is refused. The
// person's own modifiers are entries marked `own` (ADR 014 item 12).

/** Who rolled: a player or the game master (the DM of ADR 005), and the character, if one did. */
export const rollerSchema = z.strictObject({
  role: z.enum(['player', 'gm']),
  name: visibleTextSchema,
  actorId: uuidSchema.optional(),
});
export type Roller = z.infer<typeof rollerSchema>;

/**
 * Who sees a roll: everyone; `secret`, a player's roll that only they and the game master see;
 * `hidden`, a game master's roll that only the game master sees.
 */
export const rollVisibilitySchema = z.enum(['public', 'secret', 'hidden']);
export type RollVisibility = z.infer<typeof rollVisibilitySchema>;

/** A dice term as rolled (ENG-08's `DiceRoll`). A face of 0 is a die that gave none. */
const rolledTermSchema = z
  .strictObject({
    at: z.int().nonnegative(),
    text: visibleTextSchema,
    count: z.int().positive(),
    faces: z.int().min(2),
    keep: z
      .strictObject({ which: z.enum(['highest', 'lowest']), count: z.int().positive() })
      .optional(),
    results: z.array(z.int().nonnegative()),
    kept: z.array(z.boolean()),
    total: z.int().nonnegative(),
  })
  .superRefine((term, ctx) => {
    for (const field of ['results', 'kept'] as const) {
      if (term[field].length !== term.count) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `Holds ${term[field].length} dice; the term rolls ${term.count}.`,
        });
      }
    }
    for (const [index, face] of term.results.entries()) {
      if (face > term.faces) {
        ctx.addIssue({
          code: 'custom',
          path: ['results', index],
          message: `${face} is above the die's ${term.faces} faces.`,
        });
      }
    }
    const keeps = term.keep?.count ?? term.count;
    const kept = term.kept.filter(Boolean).length;
    if (kept !== keeps) {
      ctx.addIssue({
        code: 'custom',
        path: ['kept'],
        message: `Keeps ${kept} dice; the term keeps ${keeps}.`,
      });
    }
    const sum = term.results.reduce(
      (total, face, index) => (term.kept[index] ? total + face : total),
      0,
    );
    if (term.total !== sum) {
      ctx.addIssue({
        code: 'custom',
        path: ['total'],
        message: `${term.total} is not ${sum}, the sum of the kept faces.`,
      });
    }
  });

/** One entry of a roll's breakdown: a labelled part, the formula rolled, and what it gave. */
export const rollEntrySchema = z
  .strictObject({
    label: visibleTextSchema,
    formula: formulaSchema,
    value: z.number(),
    dice: z.array(rolledTermSchema),
    sourceId: entityIdSchema.optional(),
    /** The person's own modifier, added before the roll (ADR 009 item 11), not the rules'. */
    own: z.boolean(),
  })
  .superRefine((entry, ctx) => {
    for (const [index, term] of entry.dice.entries()) {
      if (entry.formula.slice(term.at, term.at + term.text.length) !== term.text) {
        ctx.addIssue({
          code: 'custom',
          path: ['dice', index, 'text'],
          message: `"${term.text}" is not at ${term.at} in "${entry.formula}".`,
        });
      }
    }
  });
export type RollEntry = z.infer<typeof rollEntrySchema>;

/** A roll as it is shown and sent: its `total` is the sum of its breakdown's values, in order. */
export const rollRecordSchema = z
  .strictObject({
    id: uuidSchema,
    rolledAt: z.iso.datetime(),
    by: rollerSchema,
    label: visibleTextSchema,
    path: computedPathSchema.optional(),
    visibility: rollVisibilitySchema,
    total: z.number(),
    breakdown: z.array(rollEntrySchema).min(1),
  })
  .superRefine((record, ctx) => {
    const sum = record.breakdown.reduce((total, entry) => total + entry.value, 0);
    if (record.total !== sum) {
      ctx.addIssue({
        code: 'custom',
        path: ['total'],
        message: `${record.total} is not ${sum}, the sum of the breakdown.`,
      });
    }
    const only = { secret: 'player', hidden: 'gm' } as const;
    if (record.visibility !== 'public' && record.by.role !== only[record.visibility]) {
      ctx.addIssue({
        code: 'custom',
        path: ['visibility'],
        message: `A ${record.visibility} roll is a ${only[record.visibility]}'s, not a ${record.by.role}'s.`,
      });
    }
  });
export type RollRecord = z.infer<typeof rollRecordSchema>;
