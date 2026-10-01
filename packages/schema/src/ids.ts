import { z } from 'zod';

// Lowercase letters and digits, in groups joined by single hyphens: `srd-2024`, `savage-attacker`.
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// camelCase, starting with a letter: `feat`, `damageType`, `sleightOfHand`.
const CAMEL_STEP = '[a-z][a-zA-Z0-9]*';
const CAMEL = new RegExp(`^${CAMEL_STEP}$`);
// camelCase steps joined by single dots, with no wildcard: `abilities.san.score`.
const PATH = new RegExp(`^${CAMEL_STEP}(?:\\.${CAMEL_STEP})*$`);

/** A pack's id: `srd-2014`, `srd-2024`, `hb-local`. */
export const packIdSchema = z.string().regex(KEBAB);

/** A game system's id, which its packs and characters name. The core lists none. */
export const systemIdSchema = z.string().regex(KEBAB);

/**
 * A version in semver 2.0.0 form, without build metadata: `1.0.0`, `2.1.0-beta.1`. The pattern is
 * semver.org's own.
 */
export const versionSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/,
  );

/** An entity type's name as it appears in ids: `feat`, `damageType`. The list is not fixed here. */
export const entityTypeNameSchema = z.string().regex(CAMEL);

/** The last part of an entity id: `alert`, `savage-attacker`. */
export const slugSchema = z.string().regex(KEBAB);

/** `<packId>:<type>/<slug>` (SPEC §5.1). Stable: renaming an entity never changes it. */
export const entityIdSchema = z.templateLiteral([
  packIdSchema,
  ':',
  entityTypeNameSchema,
  '/',
  slugSchema,
]);
export type EntityId = z.infer<typeof entityIdSchema>;

/** The entity id's pattern with its type part fixed: what a JSON Schema checks per type. */
export function entityIdPatternOf(type: string): string {
  return `^${KEBAB.source.slice(1, -1)}:${type}\\/${KEBAB.source.slice(1, -1)}$`;
}

/** A short key for formulas: `str`, `stealth`, `fighter`. One step of a formula path. */
export const entityKeySchema = z.string().regex(CAMEL);

/** A place in the computed character that an effect targets (SPEC §5.4), such as `init.bonus`. */
export const computedPathSchema = z.string().regex(PATH);
export type ComputedPath = z.infer<typeof computedPathSchema>;

/**
 * An edition of the entity's system (`2014`, `2024`), or `any`. The core names no game: the
 * module narrows this to its own editions.
 */
export const rulesetIdSchema = z.string().regex(KEBAB);
export type RulesetId = z.infer<typeof rulesetIdSchema>;

export interface EntityIdParts {
  pack: string;
  type: string;
  slug: string;
}

/** Splits an entity id into its parts, or returns `undefined` when it is not a valid id. */
export function parseEntityId(id: string): EntityIdParts | undefined {
  if (!entityIdSchema.safeParse(id).success) return undefined;
  const colon = id.indexOf(':');
  const slash = id.indexOf('/', colon);
  return {
    pack: id.slice(0, colon),
    type: id.slice(colon + 1, slash),
    slug: id.slice(slash + 1),
  };
}
