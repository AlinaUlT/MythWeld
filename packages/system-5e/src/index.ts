// The fifth-edition module (ADR 004): the 2014 and 2024 rules, as a system the core runs.
// ENG-31: a package of its own. It imports the core; the core (`@grimoire/schema`,
// `@grimoire/engine`) never imports it, by name or by a relative path, which `biome.json` refuses.
// Every module is a `packages/system-<id>` package named `@grimoire/system-<id>`.
// ENG-41: its code is pure TypeScript, as the engine's is. Lint refuses here every global the
// engine refuses, `Math.random`, and any import but its own files, the core and `zod`.

export * from './ability-bonus';
export * from './actions';
export * from './attacks';
export * from './casting';
export * from './character';
export * from './checks';
export * from './classes';
export * from './combat';
export * from './death-saves';
export * from './entity-types';
export * from './equipment';
export * from './exhaustion';
export * from './hit-dice';
export * from './hit-points';
export * from './inspiration';
export * from './knock-out';
export * from './languages';
export * from './level-up';
export * from './module';
export * from './origin';
export * from './pack';
export * from './rests';
export * from './rolls';
export * from './rulesets';
export * from './size';
export * from './spell-dice';
export * from './spell-uses';
export * from './spellcasting';
export * from './system';
export * from './training';
export * from './unconscious';
