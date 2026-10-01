import { z } from 'zod';

// ENG-06: the migration frame. Every stored file (a pack, a locale overlay, a character) opens
// through `openerOf`. A version above the app's is refused before anything runs (ADR 003 item A6);
// an older one runs its migrations, one step per version; then the schema parses the result. A
// chain's current version is its number of migrations plus 1, so a version bumped without a step,
// or a step added without a bump, throws when the opener is built.

/** A stored file as JSON gives it: an object of plain values. */
export type StoredObject = Record<string, unknown>;

/**
 * One step between stored shapes: it gets a file of version N and returns it in the shape of
 * version N + 1. Pure: it never changes its argument. The frame writes N + 1 into the version
 * field, so a step does not.
 */
export type Migration = (file: Readonly<StoredObject>) => StoredObject;

/** A version field of a file, and the steps that lead to its current version. */
export interface VersionChain {
  field: string;
  migrations: readonly Migration[];
}

/**
 * What opening a file gives: the parsed file and the versions it had, or a refusal. A refusal's
 * `code` and numbers are for the screen, which says it in the person's language; `message` is
 * English, for logs.
 */
export type Opened<T> =
  | { ok: true; value: T; from: Readonly<Record<string, number>> }
  | { ok: false; code: 'newer'; field: string; found: number; current: number; message: string }
  | { ok: false; code: 'invalid'; error: z.ZodError; message: string };

/** The one value a schema's field takes, read from its literal. Throws when there is none. */
function literalVersionOf(schema: z.ZodType, field: string): number {
  const values = schema._zod.propValues?.[field];
  const [value] = values ?? [];
  if (values?.size !== 1 || typeof value !== 'number') {
    throw new Error(`The schema's "${field}" is not one number literal.`);
  }
  return value;
}

/** The file's version in `field`, or `undefined` when it holds no whole number from 1. */
function versionIn(file: unknown, field: string): number | undefined {
  if (typeof file !== 'object' || file === null || Array.isArray(file)) return undefined;
  const version: unknown = (file as StoredObject)[field];
  return Number.isInteger(version) && (version as number) >= 1 ? (version as number) : undefined;
}

/**
 * The migration frame for files of `schema`, whose version fields are `chains`' fields. A version
 * that is not a whole number from 1 is not migrated; the schema refuses it on its field.
 */
export function openerOf<S extends z.ZodType>(schema: S, chains: readonly VersionChain[]) {
  const steps = chains.map(({ field, migrations }) => {
    const current = literalVersionOf(schema, field);
    const counted = migrations.length + 1;
    if (current !== counted) {
      throw new Error(
        `The schema's "${field}" is ${current}, but its migrations lead to version ${counted}.`,
      );
    }
    return { field, migrations, current };
  });

  return (file: unknown): Opened<z.output<S>> => {
    const found = steps.map(({ field }) => versionIn(file, field));
    for (const [index, { field, current }] of steps.entries()) {
      const version = found[index];
      if (version !== undefined && version > current) {
        return {
          ok: false,
          code: 'newer',
          field,
          found: version,
          current,
          message: `The file was saved by a newer version of the app: its "${field}" is ${version}, and this app reads up to ${current}.`,
        };
      }
    }

    let upgraded = file;
    const from: Record<string, number> = {};
    for (const [index, { field, migrations, current }] of steps.entries()) {
      const version = found[index];
      if (version === undefined) continue;
      from[field] = version;
      for (const [step, migrate] of migrations.slice(version - 1, current - 1).entries()) {
        upgraded = { ...migrate(upgraded as StoredObject), [field]: version + step + 1 };
      }
    }

    const parsed = schema.safeParse(upgraded);
    if (!parsed.success) {
      return {
        ok: false,
        code: 'invalid',
        error: parsed.error,
        message: z.prettifyError(parsed.error),
      };
    }
    return { ok: true, value: parsed.data, from };
  };
}
