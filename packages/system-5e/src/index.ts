// The fifth-edition module (ADR 004): the 2014 and 2024 rules, as a system the core runs.
// ENG-31: a package of its own. It imports the core; the core (`@grimoire/schema`,
// `@grimoire/engine`) never imports it, by name or by a relative path, which `biome.json` refuses.
// Every module is a `packages/system-<id>` package named `@grimoire/system-<id>`.
// ENG-41: its code is pure TypeScript, as the engine's is. Lint refuses here every global the
// engine refuses, `Math.random`, and any import but its own files, the core and `zod`.

/** Fifth edition's system id, which its packs and characters name (ADR 004 item 3). */
export const FIFTH_EDITION_SYSTEM = '5e';

export * from './entity-types';
export * from './system';
