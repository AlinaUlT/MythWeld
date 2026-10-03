# ENG — The game-free core and the fifth-edition module

**Why this theme:** Every number the app shows comes from the engine, and a wrong rule gives a
wrong number with no error. This theme builds the schemas, formulas, dice, effects and the
`compute()` pipeline, with no UI: first the core, which knows no game and is tested on a made-up
system, then the fifth-edition module as its own package (ADR 004). The golden tests of SPEC §6.7
are its proof.
**SPEC:** stage 1, sections §4.1, §5, §6; ADR 004, ADR 005
**Order and status:** [`BACKLOG.md`](../../tickets/BACKLOG.md) — never repeated here.
**Theme is closed when:** every ENG row is ✅ or ❌, and the phase 1 gate named in `BACKLOG.md`
(SPEC §12 stage 1, widened by ADR 004 and ADR 005) is proved.
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections above,
ADR 004.
**This file:** the theme's closed tickets, moved here as each one closed. Open tickets are in
[`docs/tickets/ENG_TICKET.md`](../../tickets/ENG_TICKET.md).

---

### ENG-01 The engine stays pure · XS

**Hat:** CI fails if `engine` imports React, DOM, Dexie or the network
**Where:** `biome.json` — a new override for `packages/engine/src/**`;
`packages/engine/tsconfig.json` — changed; `packages/engine/test/tsconfig.json` and
`packages/engine/test/purity.test.ts` — new; `packages/engine/package.json` — the typecheck
script, and `@types/node` for the tests
**Depends on:** SETUP-03 (CI runs the gate), SETUP-05 (how a lint rule is tested)

**What it should look like when done:**
1. `pnpm lint` fails on any import in `packages/engine/src` other than the package's own files
   and `@grimoire/schema`. That covers `react`, `react-dom/client`, `dexie`, `node:http`, network
   libraries (`axios`, `ws`), `import type`, `export … from`, a dynamic `import()`, and a
   relative path into `apps/` or `node_modules/`. The message starts with `ENG-01`.
2. `pnpm lint` fails on these globals in `packages/engine/src`: `globalThis`, `self`, `window`,
   `document`, `navigator`, `location`, `localStorage`, `sessionStorage`, `indexedDB`, `fetch`,
   `XMLHttpRequest`, `WebSocket`, `EventSource`. The message starts with `ENG-01`.
3. `pnpm typecheck` checks `packages/engine/src` with `lib: ["ES2022"]` and `types: []`, so
   `document`, `window`, `process`, `fetch` and `localStorage` are errors there. The tests are
   checked by their own `test/tsconfig.json` with Node types, which never reach `src`.
4. A test proves items 1–3, and fails when any one guard is removed.
5. The quality gate is green. CI runs the same lint, typecheck and test (SETUP-03), so CI fails
   in each case of items 1–3.

**Tests:** `packages/engine/test/purity.test.ts` — `describe('ENG-01 engine purity')`, 4 tests.
Sample files are linted and type-checked in a temp folder holding copies of the real `biome.json`,
`biome/`, `tsconfig.base.json` and `packages/engine/tsconfig.json`, with the engine's
`node_modules` linked in. Control numbers: the line numbers of the forbidden lines in each sample,
written by hand.

**What came out of it:**

Before, measured with a sample file in `packages/engine/src`:
- `pnpm exec biome lint` on imports of `react`, `dexie`, `node:http`, `axios` and uses of
  `document`, `fetch`, `globalThis`: exit 0, `Checked 1 file`. No rule existed.
- `tsc` failed on them, but by accident: `Cannot find module 'react'`, because `react` was not
  installed for `engine`. With `react` linked into `packages/engine/node_modules`, the same
  import type-checked with exit 0. `(globalThis as { fetch?: unknown }).fetch` passed both.

After:
- Lint: `Checked 54 files`, 0 errors (52 files before).
- Typecheck: `Scope: 5 of 6 workspace projects`, all `Done`.
- Test: `Test Files 7 passed (7)`, `Tests 22 passed (22)`, 1.12 s (before: 6 files, 18 tests).
  The new file alone: 4 passed, 742 ms.
- Build: `Done`.
- The test bites. Override removed from `biome.json`: 2 of its 4 tests fail. `"DOM"` added to
  the engine's `lib`: 1 fails. `"types": ["node"]` in the engine's config: 1 fails. The
  `apps/` and `node_modules/` patterns removed: 1 fails.

Differences from the row, and why:
- The import rule is an allow-list, not a list of forbidden names. "The network" has no end of
  libraries; an allow-list refuses every one. A new pure dependency (for example `zod`) is added
  to the list in `biome.json`, which the message says.
- A relative path is allowed, which let `../../../apps/web/src/db/db.ts` bring in Dexie: that
  import passed lint and typecheck. `**/apps/**` and `**/node_modules/**` after the allowed
  entries close it (Biome reads the list in order; the last match wins).
- Biome's pattern `*` matches one path segment, so it missed `@scope/pkg/sub` and
  `react-dom/client`. `**` is used.
- The engine's tests got their own tsconfig with `@types/node` 22.20.4, the version already in
  the lockfile. Before, `src` and `test` were one program; a test that needed Node would have
  given Node's global `fetch` to `src`. This ticket's test is the first that needs Node.
- `biome.json` does not accept comments (`biome check` fails on one), so the ENG-01 code comment
  is in `packages/engine/tsconfig.json`, and each lint message starts with `ENG-01`.
- `pnpm exec biome lint --stdin-file-path` was tried for the test and dropped: it reports
  `The contents aren't fixed` with exit 1 even for a clean file.

Found, not fixed:
- A relative path can still climb into a sibling package, for example
  `../../content/src/index.ts`. The rule cannot tell how deep a file sits, so it cannot tell a
  climb out of `packages/engine` from a path inside it. Today no sibling package holds React,
  DOM, Dexie or the network. The package boundary itself is ENG-31's: the note on its row in
  `BACKLOG.md` now says so.

Nothing for the changelog.

---

### ENG-02 The entity base

**Hat:** The entity base has a core Zod schema, ids included
**Depends on:** ENG-01 (the engine's import rule allows `@grimoire/schema`)
**Size:** S
**Screen:** No
**SPEC:** §5.1, §5.2; ADR 003 items A1, A2; ADR 004 items 1, 3

---

#### 1. Where the code lives

**Main file:** `packages/schema/src/entity-base.ts` — new. The fields every entity has.
- `packages/schema/src/ids.ts` — new: pack id, type name, slug, entity id, key, ruleset id.
- `packages/schema/src/index.ts` — changes: exports both files.
- `packages/schema/package.json` — changes: `zod` as a dependency; the typecheck script also
  checks the tests.
- `packages/schema/test/tsconfig.json`, `packages/schema/test/entity-base.test.ts` — new.

#### 2. What is missing now

- `packages/schema/src/index.ts` is `export {};`. No schema exists.
- `grep -n zod pnpm-lock.yaml` prints nothing: Zod (SPEC §4.2, Zod 4) is not installed.
- `packages/schema` has no `test/` folder; `pnpm test` runs 7 files, 22 tests, none for it.

#### 3. What it should look like when done

1. `@grimoire/schema` exports `entityBaseSchema` and the type `EntityBase`, with the fields of
   SPEC §5.2 except those listed in §9: `id`, `type`, `key?`, `ruleset`, `name`, `aliases?`,
   `summary?`, `text?`, `tags?`, `source`, `meta?`.
2. `entityIdSchema` accepts `<packId>:<type>/<slug>` (SPEC §5.1): `srd-2024:feat/alert`,
   `hb-local:skill/occultism`, `hb-local:ability/san`, `srd-2014:damageType/fire`. Pack id and
   slug are lowercase letters and digits in groups joined by single hyphens; the type is
   camelCase. It refuses `SRD:feat/alert`, `srd:feat/Alert`, `srd:feat/a/b`, `srd:feat/`,
   `:feat/a`, `srd:Feat/a`, `srd:feat/a--b`, `srd-:feat/a`, `srd feat/a`.
3. `parseEntityId('srd-2024:feat/alert')` returns
   `{ pack: 'srd-2024', type: 'feat', slug: 'alert' }`; a malformed id returns `undefined`.
4. An entity whose id names another type than its `type` is refused, with the issue on `id`:
   `hb-local:skill/occultism` with `type: 'ability'`.
5. `name`, `summary`, `text` and each alias take `en` and `ru` only; at least one is present,
   and a present one holds a visible character. `{}`, `{ de: 'x' }`, `{ en: '' }` and
   `{ en: '  ' }` are refused.
6. `ruleset` is an edition id of the system (`2014`, `2024`) or `any`. The core names no game:
   a made-up edition `first-age` is accepted. `''` and `Any` are refused.
7. `key` is camelCase, fit to be one step of a formula path (SPEC §5.6): `str`, `san`,
   `sleightOfHand` are accepted; `Str`, `sleight-of-hand`, `1st`, `''` are refused.
8. `meta.translation` takes exactly `official`, `community`, `machine`, `reviewed` (the four
   values of SPEC §5.2, the owner's decision of 2026-09-27); anything else is refused.
9. `meta.foundry` is refused (ADR 003 item A1). `meta.variantOf` must be an entity id;
   `meta.manual` is a boolean.
10. `source` has `pack` (a pack id), and optional `page`, `book`, `author`, `license` (ADR 003
    item A2) and `links`. A link is an `http` or `https` URL; `javascript:alert(1)` and
    `ftp://example.org` are refused.
11. Any field not named here is refused, at the top level and inside `source` and `meta`.
12. A valid entity parses to an object equal to its input: nothing is added or dropped.
13. `z.toJSONSchema(entityBaseSchema)` runs without an error (ENG-05 exports the pack's).
14. The quality gate is green.

#### 4. How to do it

1. `pnpm --filter @grimoire/schema add zod@^4.6.5` (the latest release, `npm view zod version`).
2. `ids.ts`: one kebab pattern for pack id, slug and ruleset id; a camelCase pattern for the
   type name and the key. `entityIdSchema = z.templateLiteral([packId, ':', typeName, '/',
   slug])`, so its TypeScript type is `` `${string}:${string}/${string}` `` and the JSON Schema
   keeps the pattern. `parseEntityId` splits a checked id.
3. `entity-base.ts`: `localeSchema`, `l10nSchema`, `translationSchema`, `entitySourceSchema`,
   `entityMetaSchema`, `entityBaseSchema`. Every object is `z.strictObject`. The id-matches-type
   check is a `superRefine` on the base; ENG-03 extends the base, and the check comes along
   (measured on Zod 4.6.5: `.extend()` on a refined object keeps its refinement).
4. The tests of §7, and `test/tsconfig.json` as in `packages/engine/test`.

Technical choices (ADR 002):
- **Strict objects.** Zod's default drops an unknown field without a word, which loses data;
  passing it through lets unchecked data into storage (ADR 003 item A6). Refusing does neither,
  and a field added later is a widening, which no stored file can fail.
- **Narrow patterns for ids.** A pattern widened later never breaks a stored id; a pattern
  narrowed later can. ADR 002 item 2 picks the narrow one.
- **`ruleset` stays required**, as SPEC §5.2 has it. A system with no editions writes `any`.
  Making it optional later needs no migration; the other way would.
- **`name` needs one language, not `en`.** SPEC §5.2 says "at least one language". A person's
  own entry may have only a Russian name; the SRD packs carry both (CLAUDE.md, entity names).

#### 5. Stored data

Nothing stored changes. No pack or character is stored yet; `schemaVersion` starts with ENG-05
and ENG-06.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/schema/test/entity-base.test.ts` — `describe('ENG-02 entity base')`: ids,
  `parseEntityId`, id and type agree, `L10n`, `ruleset`, `key`, `meta`, `source`, unknown
  fields, the round trip, the JSON Schema export.
- Control values from: the ids of SPEC §5.1 and Appendix Д; the four translation values of
  SPEC §5.2; ADR 003 items A1, A2. Test entities are made up; they hold no rules text.

#### 8. Checked against the source

SPEC §5.1 says SRD slugs match the slugs of 5e-database. Measured on 5e-bits/5e-srd-api at
commit `e6edf9a`, `packages/5e-database/src/{2014,2024}/en/*.json`, every top-level `index`:
see §11. No rules fact is used.

#### 9. Not in this ticket

- `effects`, `grants`, `prerequisites` on the base: ENG-04 adds them with their schemas.
- The core entity types (`ability`, `skill`, …) and their own fields: ENG-03. A module's types,
  and its edition list for `ruleset`: ENG-24.
- `key` unique among a character's packs; an id's pack matching the pack that holds it: ENG-25.
- The pack, `schemaVersion`, the JSON Schema file: ENG-05. Local entities of a character: ENG-06.
- Size limits on text and lists: phase 5 (ADR 003 item A6).
- Error messages a person reads on import: phase 5.
- `meta.foundry`'s replacement, the Foundry exporter's mapping: phase L1 (ADR 003 item A1).

#### 10. Rake check

- **Everything is data; the core names no game.** No type list, edition list or stat name is
  in the base. The test accepts a made-up edition and type.
- **Ids are stable.** The id is its own field with a fixed pattern; `name` is separate, so a
  rename never touches the id.
- **Missing is not broken.** A schema refuses bad data at the door; it does not look anything
  up. Missing references are ENG-25's.
- **Entity names stay bilingual.** `name` holds `en` and `ru` side by side.
- **Licensing.** Test data is made up; no SRD or book text.
- **Nothing invisible.** A name of only spaces is refused; no invisible characters are written.

#### 11. What came out of it

Measured:
- The new test file alone: `Tests 13 passed (13)`, 335 ms.
- Lint: `Checked 58 files`, 0 errors (54 before).
- Typecheck: `Scope: 5 of 6 workspace projects`, all `Done`. `packages/schema` now also checks
  `test/` (`tsc --listFilesOnly` lists `test/entity-base.test.ts`).
- Test: `Test Files 8 passed (8)`, `Tests 35 passed (35)`, 889 ms (before: 7 files, 22 tests).
- Build: `Done`.
- The tests bite. Each guard removed on its own, 13 tests run each time: the id-matches-type
  check, 1 fails; `strictObject` → `object`, 2 fail; any link protocol, 1 fails; the
  at-least-one-language check, 1 fails; the visible-text pattern, 2 fail.
- Zod 4.6.5 added to `packages/schema`: the lockfile has 10 lines added, 1 removed;
  `pnpm install --frozen-lockfile` passes.

Slugs of 5e-database, measured at `e6edf9a` over `src/2014/en` and `src/2024/en`: 4,428
top-level `index` values; 4,417 fit the slug pattern, 11 do not:
- 10 in `2014/en/5e-SRD-Features.json`, a triple hyphen:
  `dragon-ancestor-black---acid-damage` and the same for blue, brass, bronze, copper, gold,
  green, red, silver, white;
- 1 in `2024/en/5e-SRD-Magic-Items.json`, parentheses: `stone-of-good-luck-(luckstone)`.

The pattern stays narrow (ADR 002 items 2 and 3). SPEC §5.1's "SRD slugs match 5e-database"
holds for 4,417 of 4,428; the import maps the other 11 (`---` → `-`, parentheses dropped).
Measured: all 11 fit the pattern after that, and none then equals another `index` in its file.
The intent of §5.1, an easy export mapping, is kept.

Differences from §3: none.

Found, not fixed:
- The exported JSON Schema keeps the id pattern but loses three checks, measured on
  `z.toJSONSchema(entityBaseSchema)`: "at least one language" (no `minProperties`), "http or
  https only" (links become `format: uri`), and "the id's type equals `type`". A hand-written
  pack can pass the JSON Schema and still be refused by Zod. Noted on ENG-05 in `BACKLOG.md`.
- The 11 slugs above: noted for phase 3 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-03 The core entity types

**Hat:** The core entity types have Zod schemas
**Depends on:** ENG-02 (the entity base)
**Size:** S
**Screen:** No
**SPEC:** §5.3 (`AbilityDef`, `SkillDef`, `ConditionDef`); ADR 004 items 1, 4

---

#### 1. Where the code lives

**Main file:** `packages/schema/src/entity-types.ts` — new. The types the game-free core owns.
- `packages/schema/src/formula.ts` — new: the stored form of a formula.
- `packages/schema/src/entity-base.ts` — changes: `visibleTextSchema` is exported.
- `packages/schema/src/index.ts` — changes: exports both new files.
- `packages/schema/test/entity-types.test.ts` — new.

#### 2. What is missing now

- `@grimoire/schema` exports only the base: `grep -n "ability\|skill\|condition"
  packages/schema/src/*.ts` prints nothing.
- No formula schema exists; SPEC §5.3's `modFormula` and `totalFormula` have nothing to use.
- `pnpm test`: 8 files, 35 tests; none for an entity type.

#### 3. What it should look like when done

1. `@grimoire/schema` exports `abilityDefSchema`, `skillDefSchema`, `conditionDefSchema`,
   `coreEntitySchema`, `formulaSchema`, and the types `AbilityDef`, `SkillDef`, `ConditionDef`,
   `CoreEntity`, `Formula`.
2. The core owns three types, the ones every system needs and ADR 004 item 1 names (stats,
   skills) plus conditions on a character: `ability`, `skill`, `condition`. Each is the base with
   `type` fixed to its name.
3. `ability` needs `key`, `abbr` (L10n) and `order` (a whole number, 0 or more); it takes
   `modFormula?`, `hasSave?`, `defaultMax?` (a whole number, 1 or more).
4. `skill` needs `key` and `ability`, a stat's key in the key pattern of ENG-02; it takes
   `totalFormula?` and `passive?`.
5. `condition` takes `maxLevel?`, a whole number, 1 or more.
6. A formula is stored as text with a visible character; `''` and `'   '` are refused.
7. A made-up stat `san` passes with the same fields as `str`; so does `grit`.
8. Parsing adds nothing: no default modifier formula, save or maximum is filled in.
9. The base's checks hold in every type: an id naming another type is refused on `id`; an
   unknown field is refused (`abbr` on a skill).
10. `coreEntitySchema` picks the schema by `type`; `feat` is refused on `type`.
11. `z.toJSONSchema(coreEntitySchema)` gives three options, each with
    `additionalProperties: false`.
12. The quality gate is green.

#### 4. How to do it

1. `formula.ts`: `formulaSchema = visibleTextSchema`.
2. `entity-types.ts`: `entityBaseSchema.safeExtend({ type: z.literal('ability'), … })` per type;
   `coreEntitySchema = z.discriminatedUnion('type', [...])`.
3. The tests of §7.

Technical choices (ADR 002):
- **Only three core types.** SPEC §5.2's list is fifth edition's (ADR 004 changes it to core
  types plus a module's). `species`, `class`, `subclass`, `background`, `feat`, `feature`,
  `spell`, `item` and the simple types (`language`, `damageType`, `weaponProperty`,
  `weaponMastery`, `toolKind`, `rule`) are fifth edition's: ENG-32. Adding a type to the core
  later breaks nothing stored.
- **No defaults in the schema.** SPEC §5.3's defaults (`floor((@score - 10) / 2)`, a save, a
  maximum of 20) are fifth edition's rules; the module supplies them (ENG-24, ENG-28). The core
  schema keeps the fields optional and the round trip exact.
- **`safeExtend`, not `extend`.** Measured on Zod 4.6.5: `entityBaseSchema.extend({ type:
  z.literal('ability') })` throws `Cannot overwrite keys on object schemas containing
  refinements. Use .safeExtend() instead.` `safeExtend` keeps the id-matches-type check.
- **No formula length limit here.** The limits are ENG-07's, with its parser; size limits on
  stored text are phase 5's (ENG-02 §9).

#### 5. Stored data

Nothing stored changes. No pack or character is stored yet.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/schema/test/entity-types.test.ts` — `describe('ENG-03 core entity types')`: round
  trip with no defaults, a custom stat like a standard one, the fields of each type, the base's
  checks, the choice by `type`, the type names, the JSON Schema export.
- Control values from: SPEC §5.3's field lists; the stat keys `str` and `san` of SPEC §5.3 and
  D3. Test entities are made up; they hold no rules text.

#### 8. Checked against the source

Nothing to check: no rules fact is used. The fields come from SPEC §5.3.

#### 9. Not in this ticket

- `effects`, `grants`, `prerequisites`, `UsesDef`: ENG-04.
- The fifth-edition types and their defaults: ENG-32; how a module adds its types: ENG-24.
- A skill's `ability` naming a stat that exists; a `key` unique among packs: ENG-25.
- Parsing a formula, its length and depth limits: ENG-07.
- The roll table, a core entity (ADR 005 item 8): its phase, L3.

#### 10. Rake check

- **Everything is data; the core names no game.** No stat, skill or condition name is in the
  code. The test passes `san` and `grit` exactly like `str`.
- **Each system's rules live in its own module.** No fifth-edition default is in the core.
- **Formulas never run code.** A formula is only text here; nothing evaluates it.
- **Entity names stay bilingual.** `abbr` is L10n, like `name`.
- **Licensing.** Test data is made up; no SRD or book text.

#### 11. What came out of it

Measured:
- The new test file alone: `Tests 9 passed (9)`, 402 ms.
- Lint: `Checked 61 files`, 0 errors (58 before).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 9 passed (9)`, `Tests 44 passed (44)`, 1.20 s (before: 8 files, 35 tests).
- Build: `Done`.
- The tests bite. Each guard removed on its own, 9 tests run each time: `order` any number,
  1 fails; `key` optional on `ability`, 2 fail; a skill's `ability` any text, 1 fails; a formula
  any text, 2 fail; `maxLevel` 0 or less allowed, 1 fails; `ability` built without the base's
  id check, 1 fails.

Differences from §3: none.

Found, not fixed:
- ENG-02 §4 says `.extend()` on the refined base keeps the check. True when adding keys;
  replacing a key (`type`) throws, measured above. ENG-24 and ENG-32 use `safeExtend`. No row
  needed.

Nothing for the changelog.

---

### ENG-04 Effects, grants, prerequisites

**Hat:** Effects, grants, prerequisites have game-free Zod schemas
**Depends on:** ENG-03 (the formula schema, the core types that carry them)
**Size:** S
**Screen:** No
**SPEC:** §5.2 (`effects`, `grants`, `prerequisites`), §5.4, §5.5; ADR 004 items 1, 4

---

#### 1. Where the code lives

**Main file:** `packages/schema/src/grant.ts` — new. Grants, choices, `UsesDef`.
- `packages/schema/src/effect.ts` — new: effects.
- `packages/schema/src/prerequisite.ts` — new: prerequisites.
- `packages/schema/src/text.ts` — new: `visibleTextSchema`, `localeSchema`, `l10nSchema`, moved
  out of `entity-base.ts`.
- `packages/schema/src/ids.ts` — changes: `computedPathSchema`.
- `packages/schema/src/entity-base.ts` — changes: `effects`, `grants`, `prerequisites`.
- `packages/schema/src/entity-types.ts`, `packages/schema/src/formula.ts` — change: import the
  text schemas from `text.ts`.
- `packages/schema/src/index.ts` — changes: exports the new files.
- `packages/schema/test/mechanics.test.ts` — new.

#### 2. What is missing now

- `grep -rn "effects\|grants\|prerequisites\|UsesDef\|Choose" packages/schema/src/` prints
  nothing, exit 1.
- `entityBaseSchema` is strict, so an entity with `effects` or `grants` is refused today:
  Appendix Д's feat cannot be written.
- `pnpm test`: `Test Files 9 passed (9)`, `Tests 44 passed (44)`; none for an effect, a grant or
  a prerequisite.

#### 3. What it should look like when done

1. `@grimoire/schema` exports `effectSchema`, `effectOpSchema`, `effectPhaseSchema`,
   `grantSchema`, `grantBaseSchema`, `chooseKeysSchema`, `chooseEntitiesSchema`,
   `usesDefSchema`, `prerequisiteSchema`, `computedPathSchema`, and the types `Effect`,
   `EffectOp`, `EffectPhase`, `Grant`, `ChooseKeys`, `ChooseEntities`, `UsesDef`,
   `Prerequisite`, `ComputedPath`.
2. Every entity takes `effects?`, `grants?`, `prerequisites?`. The `grants` and `effects` of
   Appendix Д's feat parse to equal objects.
3. A computed path is camelCase steps joined by dots: `abilities.san.score`, `d20.all.bonus`,
   `init.bonus` are accepted; `''`, `.score`, `score.`, `abilities..score`,
   `abilities.San.score`, `abilities.*.score`, `abilities.san-x.score` are refused.
4. An effect needs `id` (a slug), `target` (a computed path), `op`, `value`; it takes `phase?`
   (`base`, `derived`, `final`), `priority?` (a whole number), `when?` (a formula),
   `situational?` (L10n), `toggle?` (`label` L10n and `default` boolean, both needed),
   `label?` (L10n).
5. `op` takes exactly the nine of SPEC §5.4: `add`, `mul`, `set`, `max`, `min`, `append`,
   `advantage`, `disadvantage`, `note`; anything else is refused on `op`.
6. `value` fits its `op`: `add`, `mul`, `max`, `min` take a number or a formula; `set` a number,
   a boolean or text; `append` text; `advantage` and `disadvantage` only `true`; `note` L10n.
   `add` with `true`, `add` with `Infinity`, `append` with `3`, `advantage` with `false`, `note`
   with plain text are refused on `value`.
7. A grant needs `id` (a slug) and `kind`; it takes `atLevel?`, a whole number, 1 or more. The
   core's kinds are `entity`, `proficiency`, `abilityScore`, `resource`. `feat`, `feature`,
   `spell`, `item` are refused on `kind`.
8. `entity` takes `fixed?` (entity ids) and `choose?`; `proficiency` needs `category` (a key) and
   takes `fixed?` (keys), `choose?`, `level?` (a number above 0). Each needs `fixed`, `choose` or
   both; with neither it is refused.
9. `choose` needs `count`, a whole number, 1 or more, and `from`: either a list (keys for
   `proficiency`, entity ids for `entity`) or a filter with at least one of `type`, `tag`,
   `category`. A list with a repeat, an empty list, `{}` and a `count` above the list's length
   are refused. `fixed` is a list with no repeat and at least one item.
10. `abilityScore` with `mode: 'fixed'` needs `values`: stat key → whole number, not 0, at least
    one. With `mode: 'distribute'` it needs `from` (stat keys, no repeat, at least one) and
    `patterns` (at least one list of whole numbers of 1 or more, none longer than `from`).
11. `resource` needs `key`, `label` (L10n) and `uses`. `uses` needs `max` (a formula) and
    `recovery` (at least one item); a recovery item needs `on` (a key) and `amount` (`all` or a
    formula).
12. A prerequisite is one of `ability` (`key`, `min` a whole number), `level` (`min` a whole
    number, 1 or more), `entity` (`id` an entity id), `proficiency` (`category`, `key`, both
    keys), `formula` (`formula`, `label` L10n). Another `kind` is refused on `kind`.
13. Two effects of one entity with the same `id` are refused on `effects.<n>.id`; two grants, on
    `grants.<n>.id`. An effect and a grant may share an id.
14. A made-up game passes: recovery `on: 'scene'`, proficiency category `lore` at `level: 3`, a
    stat `grit`.
15. Any field not named here is refused, in every object. Parsing adds nothing: a valid input
    parses to an equal object.
16. `z.toJSONSchema` runs for `effectSchema`, `grantSchema`, `prerequisiteSchema` and
    `entityBaseSchema`; every object option has `additionalProperties: false`.
17. The quality gate is green.

#### 4. How to do it

1. `text.ts`: move `visibleTextSchema`, `localeSchema`, `l10nSchema` and their types out of
   `entity-base.ts`; point `entity-base.ts`, `entity-types.ts`, `formula.ts` at it.
2. `ids.ts`: `computedPathSchema`, built from the camelCase pattern the key already uses.
3. `effect.ts`: one strict object per group of ops, sharing the fields of §3 item 4;
   `effectSchema = z.discriminatedUnion('op', [...])`.
4. `grant.ts`: `usesDefSchema`; `chooseKeysSchema`, `chooseEntitiesSchema` from one builder;
   `grantBaseSchema = z.strictObject({ id, atLevel })`; each kind is
   `grantBaseSchema.safeExtend({ kind: z.literal(…), … })`; `abilityScore` is a union on `mode`
   nested in the union on `kind`.
5. `prerequisite.ts`: `z.discriminatedUnion('kind', [...])`.
6. `entity-base.ts`: `effects`, `grants`, `prerequisites`, each an optional list; effects and
   grants with a unique-id check on the list.
7. The tests of §7.

Technical choices (ADR 002):
- **The core's grant kinds name no game.** SPEC §5.5's `feature` and `feat` kinds become one
  `entity` kind: it gives entities by id or by choice, whatever their type. Feat and feature are
  fifth edition's types (ENG-03 §4). `spell` and `item` carry fifth edition's fields (the
  spellcasting stat, "always prepared"; a quantity in the inventory, which ADR 004 gives to the
  module), so ENG-32 adds them, and ENG-24 decides how a module adds a kind. Measured on Zod
  4.6.5: `safeExtend` with a wider `grants` list parses at run time but fails typecheck
  (`… is not assignable to type 'never'`), so ENG-24 needs another way than `safeExtend`.
- **Open keys where the list belongs to a system.** A proficiency's `category` and `level`, a
  recovery's `on`, a filter's `category` are checked for shape only (a key; a number above 0).
  Fifth edition's values (`skill`, `save`, `armor` …; 0.5, 1, 2; `short`, `long`, `dawn`,
  `turn`, `manual`) are its module's to list (ENG-24, ENG-32).
- **All nine ops stay in the core.** Each says what an effect does to a number, a list, a roll
  or a note; none names a stat, a type or a rule. What advantage does to a roll is ENG-34's, in
  the module. A module that needs another op widens the list, which no stored file can fail.
- **`value` is checked against `op`.** SPEC §5.4 gives one union for every op, so `add` with
  `true` would pass it. `advantage` and `disadvantage` take only `true`: SPEC needs a value,
  and `false` would mean nothing. `note` takes L10n, not a string: a note is text a person reads,
  and every such text in an entity is L10n (SPEC §5.2).
- **Effect and grant ids are slugs, unique in their list.** A choice is stored under
  `<entityId>#<grantId>` (SPEC §5.5); a slug cannot hold `#`. Toggles need one effect per id.
- **The proficiency prerequisite's `id` is named `key`.** Its value is a key, like a proficiency
  grant's `fixed`; everywhere else in the schemas an `id` is an entity id or a slug.
- **A choice that can never be completed is refused**: a repeat in a list, or a `count` above
  its length. A filter's size is not known until packs load (ENG-25).
- **The text schemas get their own file.** Effects, grants and prerequisites use L10n, and the
  base uses them; importing L10n from `entity-base.ts` would be an import cycle. What the
  package exports stays the same.

#### 5. Stored data

Nothing stored changes. No pack or character is stored yet.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/schema/test/mechanics.test.ts` — `describe('ENG-04 effects, grants, prerequisites')`:
  Appendix Д's grant and effect, computed paths, the fields of an effect, `value` by `op`, each
  grant kind, choices, `UsesDef`, each prerequisite kind, unique ids, a made-up game, unknown
  fields, the round trip, the JSON Schema export.
- Control values from: SPEC §5.4 and §5.5 field lists; Appendix Д's feat. The other test data is
  made up and holds no rules text.

#### 8. Checked against the source

Nothing to check: no rules fact is used. The fields come from SPEC §5.4 and §5.5.

#### 9. Not in this ticket

- Which targets exist (the catalog of SPEC §5.4), and an effect's phase taken from its target:
  ENG-17, with the module's targets from ENG-28.
- Evaluating `value` and `when`: ENG-07. Applying effects: ENG-12, ENG-17. Toggles in the
  character document: ENG-06.
- Expanding grants, storing choices, `pendingChoices`: ENG-06, ENG-11.
- Checking a prerequisite against a character (a warning, never a block, SPEC §8.2): see §11.
- Fifth edition's grant kinds `spell` and `item`, `FeatureDef.uses`, a class's multiclass
  prerequisites: ENG-32. How a module adds grant kinds and narrows the open keys: ENG-24.
- Formula length and depth limits: ENG-07. Size limits on lists: phase 5 (ADR 003 item A6).

#### 10. Rake check

- **Everything is data; the core names no game.** No rest, proficiency category, proficiency
  level or entity type of any game is in the code. The test passes a made-up game's `scene`
  recovery and `lore` proficiency.
- **Each system's rules live in its own module.** Fifth edition's lists are left to ENG-24 and
  ENG-32.
- **Formulas never run code.** `value`, `when` and `max` are only text here.
- **Missing is not broken; prerequisites warn.** A grant or prerequisite naming an id that does
  not exist is valid here. The schema checks the shape of a prerequisite, never a character
  against it.
- **Ids are stable.** Effect and grant ids are slugs, apart from their labels.
- **Entity names stay bilingual.** Labels, notes, `situational` and toggle labels are L10n.
- **Licensing.** Test data is made up, plus Appendix Д's homebrew feat; no SRD or book text.

#### 11. What came out of it

Measured:
- The new test file alone: `Tests 15 passed (15)`, 483 ms.
- Lint: `Checked 66 files`, 0 errors (61 before).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 10 passed (10)`, `Tests 59 passed (59)`, 1.09 s (before: 9 files, 44 tests).
- Build: `Done`.
- The tests bite. Each guard removed on its own, 15 tests run each time: `value` of
  `advantage` any value, 1 fails; `note` plain text allowed, 1 fails; `target` any text, 1 fails;
  the `append` option not strict, 1 fails; the unique-id check on a list, 1 fails; `fixed` or
  `choose` not needed, 1 fails; `count` above the list's length, 1 fails; a repeat in a list,
  3 fail; an empty filter, 1 fails; a stat change of 0, 1 fails; a pattern longer than `from`,
  1 fails; a recovery event any text, 1 fails; the prerequisite's `key` named `id`, 3 fail;
  `grantBaseSchema` not strict, 1 fails.
- The first run of that list found one gap: with the `append` option not strict, 15 of 15
  passed, because the unknown-field test tried only an `add` effect. The test now tries every
  effect, grant and prerequisite of its made-up data; the same change then fails 1.

Differences from §3: none.

Changed in an earlier ticket's test: ENG-02's `refuses a field it does not name` used
`effects: []` as its unknown field, and failed once `effects` became a field (ENG-02 §9 said
ENG-04 adds it). It now uses `effect: []`, still unknown; the rule it checks is unchanged.

Found, not fixed:
- The exported JSON Schema loses 8 of this ticket's checks, measured on `z.toJSONSchema`: no
  item twice in a list (no `uniqueItems`), ids unique in `effects` and `grants`, `fixed` or
  `choose`, a choice's `count` within its list, a filter's field, a stat change not 0, at least
  one stat (no `minProperties`), a pattern no longer than `from`. It keeps the path pattern and
  the `minItems` of lists. Added to the note on ENG-05 in `BACKLOG.md`.
- A module cannot add grant kinds with `safeExtend` (§4, measured). Noted on ENG-24; fifth
  edition's own kinds are noted on ENG-32.
- No row checks a prerequisite against a character (SPEC §5.5, §8.2: a warning, never a block).
  Noted for phases 2 and 4 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-24 A system module adds its types

**Hat:** A system module adds its entity types to the schemas
**Depends on:** ENG-04 (grants, prerequisites, the measurement on `safeExtend`)
**Size:** S
**Screen:** No
**SPEC:** §5.2 (`Ruleset`, `EntityType`), §5.5; ADR 004 items 1, 3, 4

---

#### 1. Where the code lives

**Main file:** `packages/schema/src/system.ts` — new. The three steps a module takes to define
its schemas.
- `packages/schema/src/grant.ts` — changes: `usesDefSchemaOf`, `coreGrantSchemasOf`;
  `uniqueList` is exported.
- `packages/schema/src/prerequisite.ts` — changes: `prerequisiteSchemaOf`.
- `packages/schema/src/entity-base.ts` — changes: `entityBaseSchemaOf`.
- `packages/schema/src/entity-types.ts` — changes: `coreEntitySchemasOf`.
- `packages/schema/src/index.ts` — changes: exports `system.ts`.
- `packages/schema/test/system.test.ts` — new.

#### 2. What is missing now

- A module cannot add a grant kind. Measured again on Zod 4.6.5: `entityBaseSchema.safeExtend`
  with a `grants` list that also takes a `spell` kind fails typecheck: `error TS2322: Type
  'ZodOptional<ZodArray<ZodDiscriminatedUnion<[…]>>>' is not assignable to type 'never'`.
- A module cannot add an entity type: `coreEntitySchema` is a fixed union of `ability`, `skill`,
  `condition`; its comment says "A module's types join this list in ENG-24".
- No list of a system is checked. `ruleset`, a proficiency's `category` and `level`, and a
  recovery's `on` take any value of the right shape: `grantSchema` accepts
  `category: 'anything'`, `level: 0.25`. `ids.ts` says "the module narrows this to its own
  editions"; nothing does.
- `pnpm test`: `Test Files 10 passed (10)`, `Tests 59 passed (59)`; none for a system.

#### 3. What it should look like when done

1. `@grimoire/schema` exports `systemListsOf`, `systemSchemasOf`, `systemEntitySchemaOf` and the
   type `GrantKindSchema`. A module defines its schemas in three steps: its lists; then its grant
   kinds and the base; then its entity types and the union by `type`.
2. `systemListsOf` takes `editions`, `proficiencyCategories`, `proficiencyLevels` and
   `recoveryEvents`, and returns each as a schema, plus a `usesDefSchema` with the system's
   recovery events.
3. An entity's `ruleset` takes only the system's editions and `any`. A made-up system with
   `first-age` and `second-age` refuses `2014`, `third-age` and `Any` on `ruleset`, in the
   core's types and in the module's.
4. A proficiency grant's `category` and a proficiency prerequisite's `category` take only the
   system's categories: `skill` is refused on `grants.0.category` and on
   `prerequisites.0.category`.
5. A proficiency grant's `level` takes only the system's levels: with `1, 2, 3`, the values
   `0.5`, `4` and `0` are refused on `grants.0.level`.
6. A recovery's `on` takes only the system's events, both in the core's `resource` grant and in a
   module's kind built with the system's `usesDefSchema`: `dawn` is refused on
   `grants.<n>.uses.recovery.0.on`.
7. `systemSchemasOf(lists, grantKinds)` adds the module's kinds to the core's four, and an
   entity's `grants` takes them. A kind nobody defined (`spell`) is refused on
   `grants.<n>.kind`; the core's own `grantSchema` refuses the module's kind on `kind`.
8. `systemEntitySchemaOf(schemas, entityTypes)` picks by `type` among the core's three types and
   the module's, in that order. The base's checks hold in a module's type: an id naming another
   type (on `id`), an unknown field, a grant id used twice (on `grants.1.id`), an unknown type
   (on `type`).
9. A list that cannot be right throws, and the message names the list: an empty list, an item
   twice, `any` as an edition, an edition outside the pack-id pattern, a category or event that
   is not camelCase, a level of 0 or less, a field not named here.
10. A grant kind or entity type that is taken, has no literal name, or is not camelCase throws
    when the system is defined, not when a pack is parsed: `The grant kind "entity" is given
    twice.`, `Each entity type needs a literal \`type\`.`, `The entity type "Talent" is not a
    camelCase name.`
11. Two systems stay apart: each refuses the other's categories, levels and kinds. The core's
    own schemas stay open, and their JSON Schema is the same as before, byte for byte.
12. The types follow the lists. For a made-up system, `z.infer` gives `type` as its five names,
    `ruleset` as `'first-age' | 'second-age' | 'any'`, a proficiency's `category` and `level` as
    its values, its kind in the grant's `kind`. A module type built on the core's open base is a
    type error. `pnpm typecheck` checks these.
13. `z.toJSONSchema` of a system's union gives one option per type, each with
    `additionalProperties: false` and `ruleset` as an `enum`; categories and levels are `enum`s.
14. The quality gate is green.

#### 4. How to do it

1. `grant.ts`: `usesDefSchemaOf(recoveryEvent)`; `coreGrantSchemasOf({ proficiencyCategory,
   proficiencyLevel, usesDef })` returns the four kinds. The open `usesDefSchema` and
   `grantSchema` are built by them from the open key schemas.
2. `prerequisite.ts`: `prerequisiteSchemaOf(proficiencyCategory)`; the open one takes
   `entityKeySchema`.
3. `entity-base.ts`: `entityBaseSchemaOf({ ruleset, grant, prerequisite })`; the open base takes
   the open schemas.
4. `entity-types.ts`: `coreEntitySchemasOf(base)` returns the three core types on that base.
5. `system.ts`: `systemListsOf` checks the lists with a Zod schema and turns them into enums;
   `systemSchemasOf` builds the grant union, the prerequisites, the base and the core types;
   `systemEntitySchemaOf` builds the union by `type`. A shared check refuses a taken, missing or
   badly shaped name, reading each option's literal values from Zod's `propValues`.
6. The tests of §7.

Technical choices (ADR 002):
- **The base is built, not extended.** `safeExtend` takes only a field whose type is narrower
  than the base's (§2, measured); a list with more grant kinds is wider. So each schema that holds
  a system's list is a function of that list, and the core's open schemas are the same functions
  given open keys. One code path serves both, which §3 item 11 proves.
- **Three steps, not one call.** A module's grant kind may need the system's `usesDefSchema`
  (fifth edition's `spell` grant, SPEC §5.5), and a module's entity type needs the base built
  with every grant kind. Each step is a plain call typed by its arguments, so the module keeps
  each schema as its own constant and exports it.
- **Names are checked when the system is defined.** Measured on Zod 4.6.5: a repeated
  discriminator value throws only on the first parse (its option map is built lazily). A module's
  mistake would then look like a person's pack failing.
- **`any` is not an edition.** ENG-02 made `any` the value for an entity of every edition; every
  system has it, so a list cannot hold it.
- **The core's three types are in every system's union.** ADR 004 item 1: stats and skills are
  the core's. A module type named `ability` throws.
- **A choice filter's `category` stays a key.** Its values are a field of a module's types, one
  list per type (a feat's category is not an item's), so no single system list can check it.

#### 5. Stored data

Nothing stored changes. No pack or character is stored yet, and the open schemas export the same
JSON Schema as before.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/schema/test/system.test.ts` — `describe('ENG-24 system schemas')`: a made-up
  system's types parse to equal objects; editions, categories, levels and recovery events by its
  lists; the module's grant kind; the base's checks in the module's types; refused lists; taken,
  missing and badly shaped names; two systems side by side, the core's schemas open; the inferred
  types (`expectTypeOf`, checked by `pnpm typecheck`); the JSON Schema export.
- Control values from: the made-up system of the test itself (ADR 004 item 4: no content from a
  real game); the open-schema JSON Schema measured before the change.

#### 8. Checked against the source

Nothing to check: no rules fact is used. Fifth edition's lists (SPEC §5.5's six proficiency
categories, the levels `0.5 | 1 | 2`, its rests) are not written here; ENG-32 writes them.

#### 9. Not in this ticket

- Fifth edition's lists, its grant kinds `spell` and `item`, its entity types: ENG-32, with this
  ticket's three steps.
- The pack's `system` field and the JSON Schema file per system: ENG-05.
- A pack of another system not loaded for a character; `key` unique within a ruleset: ENG-25.
- The defaults a system gives a stat (SPEC §5.3: the modifier formula, a save, a maximum of 20):
  ENG-03 §4 named ENG-24 and ENG-28. Parsing adds nothing, so no schema holds them; they come
  with the module's compute steps, ENG-28 (noted on its row in `BACKLOG.md`).
- Effect targets a module adds: ENG-17, ENG-28.
- The package rule that the core cannot import a module: ENG-31.
- The made-up test system as shared core test data: ENG-27. This ticket's system lives in its
  test file only.

#### 10. Rake check

- **Everything is data; the core names no game.** `system.ts` holds no edition, category,
  level, event, kind or type of any game; the lists are the module's arguments. The test system
  is made up.
- **Each system's rules live in its own module.** The core gets a system's lists as data; no
  `if (system === …)` is written.
- **Missing is not broken.** A schema checks shape against the system's lists; it looks nothing
  up. A module's own mistake throws when it is defined, before any person's data is read.
- **A stored-shape change needs a migration.** Nothing is stored yet; the open schemas' JSON
  Schema is unchanged, measured.
- **Licensing.** Test data is made up; no SRD or book text.

#### 11. What came out of it

Measured:
- The new test file alone: `Tests 11 passed (11)`, 460 ms.
- Lint: `Checked 68 files`, 0 errors (66 before).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 11 passed (11)`, `Tests 70 passed (70)`, 1.30 s (before: 10 files,
  59 tests).
- Build: `Done`.
- The open schemas did not change: `z.toJSONSchema` of `entityBaseSchema`, `grantSchema`,
  `prerequisiteSchema`, `coreEntitySchema`, `usesDefSchema`, the three core types and
  `effectSchema`, written to one file before and after: 202,149 bytes each, `cmp` finds no
  difference. ENG-02 to ENG-04's 37 tests pass unchanged.
- The tests bite. Each guard removed on its own, 11 tests run each time: the repeated-name
  check, 1 fails; the camelCase check, 1; the literal-name check, 1; `any` refused as an edition,
  1; a list's no-repeat and at-least-one check, 1; the lists' strict object, 1; `ruleset` left
  open, 2; a grant's `category` left open, 3; a prerequisite's `category` left open, 1; `level`
  left open, 3; recovery events left open, 1; the module's grant kinds dropped, 8; the module's
  entity types dropped, 8. The `@ts-expect-error` line removed: `pnpm typecheck` fails with
  `Type 'string' is not assignable to type '"any" | "first-age" | "second-age"'`.

Differences from §3: none.

Against the row: the row names grant kinds, proficiency categories and levels, and recovery
events. The code adds two more places for the same lists: the edition list for `ruleset`, which
ENG-02 §9 gave to this ticket and `ids.ts` promised; and a proficiency prerequisite's `category`,
which is the same list as a proficiency grant's. The row's hat, entity types, is item 8.

The first type test found a gap, fixed before the commit: with one generic for the whole list
object, `systemSchemasOf` typed `ruleset`, `category` and `level` as `string` and `number`
(`expectTypeOf` failed 3 times). Each list's schema is now its own generic.

Found, not fixed:
- An entity whose grants hold a module's kind is not assignable to the open `EntityBase` type:
  measured, `TS2322` for a system with a `boon` kind; with no module kind it is assignable.
  ENG-11 gathers grants for any system, so its types take the system's entity type, or treat a
  module's kinds as unknown to the core. Noted on ENG-11 in `BACKLOG.md`.
- The defaults a system gives a stat: noted on ENG-28 in `BACKLOG.md` (§9).
- ENG-32's note in `BACKLOG.md` said its kinds use ENG-04's `usesDefSchema`, whose recovery
  events are open. It now says the system's `usesDefSchema`, from `systemListsOf`.

Nothing for the changelog.

---

### ENG-05 The content pack

**Hat:** The content pack has a schema, exported as JSON Schema
**Depends on:** ENG-24 (a system's schemas, its entity union)
**Size:** S
**Screen:** No
**SPEC:** §5.7; ADR 003 items A2, A6, A7; ADR 004 item 3

---

#### 1. Where the code lives

**Main file:** `packages/schema/src/pack.ts` — new. The pack, the locale overlay, their
`schemaVersion`s, and the JSON Schema export.
- `packages/schema/src/ids.ts` — changes: `systemIdSchema`, `versionSchema`,
  `entityIdPatternOf`.
- `packages/schema/src/entity-base.ts` — changes: `linkSchema` and `listWithUniqueIds` are
  exported; a JSON Schema keyword for the link.
- `packages/schema/src/text.ts`, `grant.ts` — change: JSON Schema keywords for checks a
  refinement makes.
- `packages/schema/src/index.ts` — changes: exports `pack.ts`.
- `packages/schema/package.json` — changes: `ajv` and `ajv-formats` for the tests.
- `packages/schema/test/pack.test.ts` — new.

#### 2. What is missing now

- `grep -rn -i "ContentPack\|overlay\|schemaVersion\|semver" packages/schema/src/` prints
  nothing. No pack, no overlay, no `schemaVersion`, no pack version.
- No JSON Schema is exported for anything a person writes: the package's first line says "the
  content pack's JSON Schema", and nothing makes it.
- `z.toJSONSchema` drops 11 checks (ENG-02 §11: 3; ENG-04 §11: 8). A pack can pass the JSON Schema
  and be refused by Zod.
- `pnpm test`: `Test Files 11 passed (11)`, `Tests 70 passed (70)`; none for a pack.

#### 3. What it should look like when done

1. `@grimoire/schema` exports `packSchemaOf`, `localeOverlaySchema`, `packJsonSchemaOf`,
   `localeOverlayJsonSchema`, `PACK_SCHEMA_VERSION`, `LOCALE_OVERLAY_SCHEMA_VERSION`,
   `systemIdSchema`, `versionSchema`, `packLicenseSchema`, and the types `PackLicense`,
   `LocaleOverlay`.
2. `packSchemaOf({ system, ruleset, entity })` builds a system's pack schema from its id, its
   `rulesetSchema` and its entity union (ENG-24). A system id that is not kebab-case throws when
   the schema is built.
3. A pack has `id` (a pack id), `version` (semver: `1.0.0`, `2.1.0-beta.1`; refuses `1.0`,
   `v1.0.0`, `01.0.0`), `schemaVersion` (exactly `PACK_SCHEMA_VERSION`, which is `1`), `system`
   (exactly the system's id), `title` (L10n), `ruleset` (the system's editions or `any`),
   `license`, `entities`; and optional `description` (L10n), `authors`, `homepage`,
   `repository`, `copyrightNotice`, `dependsOn`.
4. `license` needs `name` and `redistributable` (a boolean); it takes `spdx?`, `url?`,
   `attribution?`.
5. `homepage`, `repository` and `license.url` are http or https links; `javascript:alert(1)` is
   refused.
6. `authors` is a list of visible texts, at least one, none twice. `dependsOn` is a list of
   `{ id, version? }`, at least one, no pack id twice; `version` is the lowest version needed, in
   semver.
7. Two entities with one id are refused on `entities.<n>.id`. An entity of a type the system does
   not have is refused on `entities.<n>.type`.
8. Another system's pack is refused on `system`; a newer or older `schemaVersion` is refused on
   `schemaVersion`.
9. No field says where a pack came from (ADR 003 item A7): `origin`, `builtIn`, `official` are
   refused as unknown fields. Any field not named here is refused, inside `license` and
   `dependsOn` too.
10. A valid pack parses to an equal object. The SPEC Appendix Д pack, with `system` added and its
    feat left out (fifth edition's type, ENG-32), passes the made-up system's pack schema.
11. `localeOverlaySchema` has `schemaVersion` (exactly `LOCALE_OVERLAY_SCHEMA_VERSION`, `1`),
    `packId`, `locale` (`en` or `ru`), `texts`: entity id → field name (camelCase) → visible
    text, at least one field per entity. An entity id of another pack is refused on
    `texts.<id>`. Unknown fields are refused.
12. `packJsonSchemaOf(packSchema)` and `localeOverlayJsonSchema()` return draft 2020-12 JSON
    Schema. A JSON Schema validator (Ajv, with formats) accepts every valid pack of the tests and
    refuses, in the JSON Schema alone, these 8 of the 11 checks that were lost: a language
    present, an http or https link, the id's type equal to `type`, no item twice in a list,
    `fixed` or `choose`, a filter's field, a stat change not 0, at least one stat.
13. The other checks a JSON Schema cannot hold are listed in the JSON Schema's own `description`:
    ids unique in `entities`, `effects` and `grants`; a choice's `count` within its list; a pattern
    no longer than `from`; an overlay's entity of its own pack. Zod stays the door.
14. The quality gate is green.

#### 4. How to do it

1. `ids.ts`: `systemIdSchema` (the kebab pattern); `versionSchema` (semver 2.0.0's own pattern,
   without build metadata); `entityIdPatternOf(type)`, the id pattern with the type part fixed.
2. JSON Schema keywords for refinements, with `.meta()` beside each refinement: `minProperties: 1`
   on L10n and on an ability score grant's `values`; a case-blind `^https?://` pattern on a link;
   `uniqueItems: true` on `uniqueList`; `anyOf` of `required` for `fixed` or `choose` and for a
   filter's field; `not: { const: 0 }` on a stat change.
3. `pack.ts`: `packLicenseSchema`, `dependencySchema`, `packSchemaOf`, `localeOverlaySchema`.
   `packJsonSchemaOf` calls `z.toJSONSchema(schema, { io: 'input', override })`; the override
   sets the id pattern of each entity option whose `type` is a constant, and the root gets
   `title` and the `description` of §3 item 13.
4. `pnpm --filter @grimoire/schema add -D ajv ajv-formats` (Ajv 8.20.0 is already in the
   lockfile).
5. The tests of §7.

Technical choices (ADR 002):
- **The pack is built per system, not opened.** A pack is parsed against its system's entity
  union, or its module types would be refused as unknown fields. ADR 004 item 3: a pack names one
  system.
- **`schemaVersion` is a literal of the current version.** The schema describes today's shape. A
  file of another version goes through the migration frame first (ENG-06), which refuses a newer
  one (ADR 003 item A6).
- **The overlay gets a `schemaVersion`.** SPEC §5.7 gives it none, but an overlay is a stored file
  like a pack (SPEC §5.8). Adding a required field later needs a migration; adding it now needs
  none.
- **An overlay's text values are plain strings in one language**, keyed by field name, as SPEC
  §5.7 has them. The field names are checked for shape only; which fields an entity has is its
  type's.
- **A dependency's `version` is the lowest one needed.** SPEC §5.7 says only `version?: string`.
  A semver version is the narrowest form; a range syntax can be added later without breaking a
  stored pack (ADR 002 item 2). How it is checked against an installed pack is ENG-25's.
- **Checks a refinement makes are written into the JSON Schema where JSON Schema can say them**,
  as metadata next to the refinement, so the two cannot drift apart. The id's type check needs
  the entity's `type`, so the export adds it per type option.
- **`io: 'input'`.** The JSON Schema is for people who write a pack. With no default or transform
  in the schemas the output is the same today; a default added later would otherwise be marked
  required.
- **Ajv for the test.** The proof that the exported file works is a real validator reading it.
  Test-only; nothing ships.

#### 5. Stored data

The pack and the overlay get their first stored shape: `schemaVersion: 1` each. No pack or
overlay is stored yet, so nothing migrates. The migration frame is ENG-06.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/schema/test/pack.test.ts` — `describe('ENG-05 content pack')`: a made-up system's pack
  and the Appendix Д pack round trip; each field; system, `schemaVersion`, unknown fields and the
  "where from" fields refused; repeated entity ids; the overlay; the JSON Schema read by Ajv,
  accepting valid packs and refusing the 8 recovered checks; the `description` listing the rest.
- Control values from: SPEC §5.7's field list; Appendix Д; ADR 003 items A2, A7; the semver 2.0.0
  specification's examples. The made-up system holds no rules text.

#### 8. Checked against the source

Nothing to check: no rules fact is used. The version pattern is semver.org's suggested regular
expression, without build metadata.

#### 9. Not in this ticket

- The migration frame, refusing a newer `schemaVersion` with a message: ENG-06.
- Missing dependencies, dependency loops, an entity id of another pack, a `key` unique in a
  ruleset, a pack of another system not loaded: ENG-25.
- The fifth-edition pack schema and its file `/schema/pack.schema.json` (SPEC §5.7): the module
  does not exist yet. ENG-32 builds its entity union; the file is written with it (noted on its
  row in `BACKLOG.md`).
- `.gmpack`, size limits, import messages: phase 5.
- Splitting SRD packs by type, the precache list: phase 3.

#### 10. Rake check

- **Everything is data; the core names no game.** `pack.ts` names no system, edition or type; the
  test system is made up.
- **Content and licensing.** Every pack carries `license` with `redistributable`, required. No
  field says where a pack came from; the app sets that (ADR 003 item A7), and the test refuses
  `origin`, `builtIn` and `official`.
- **A stored-shape change needs a migration.** The first shape is version 1; the frame is ENG-06.
- **Ids are stable.** Entity ids are unique in a pack.
- **Licensing.** Test data is made up, plus Appendix Д's homebrew; no SRD or book text.

#### 11. What came out of it

Measured:
- The new test file alone: `Tests 12 passed (12)`, 895 ms.
- Lint: `Checked 70 files`, 0 errors (68 before).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 12 passed (12)`, `Tests 82 passed (82)`, 1.60 s (before: 11 files,
  70 tests). ENG-02 to ENG-24's 70 tests pass unchanged.
- Build: `Done`.
- Ajv 8.20.0 and ajv-formats 3.0.1 added to `packages/schema` as dev dependencies: the lockfile
  has 19 lines added, 0 removed; `pnpm install --frozen-lockfile` passes.
- The tests bite. Each guard removed on its own, 12 tests run each time: each of the 8 JSON
  Schema keywords (`minProperties` on L10n, the link pattern, `uniqueItems`, `fixed` or `choose`,
  a filter's field, `not: { const: 0 }`, `minProperties` on a stat change), 1 fails each; the
  id-per-type override, 1; `schemaVersion` any whole number, 1; `system` any id, 1; entity ids
  not unique, 2; the overlay's own-pack check, 2; `license` not strict, 1; the system id check,
  1; `+` build metadata allowed in a version, 1.

Differences from §3:
- §3 item 11: a field name that is not camelCase is refused on `texts.<id>.<field>`, the path Zod
  gives a record key; §3 named no path for it.
- `linkSchema`, `listWithUniqueIds` and `entityIdPatternOf` are exported too: `pack.ts` uses
  them, and the package exports every file whole.
- The open schemas' own JSON Schema now carries the 7 keywords of §4 item 2 (ENG-24 §11 measured
  it byte for byte unchanged; it changes here on purpose). Zod's parse is unchanged: the keywords
  are metadata.
- `strictRequired` is off in the test's Ajv: it flags `anyOf: [{ required: ['fixed'] }, …]`, a
  valid pattern, because the branch does not repeat the property. Every other strict check is on.

The first run found a bug, fixed before the commit: the id's JSON Schema is one object shared by
every entity option, so setting its pattern in place gave all three core types the pattern of
`ability`, and Ajv refused every valid pack. The override now writes a new object.

The overlay's JSON Schema is 856 bytes.

Found, not fixed:
- No row writes the fifth-edition pack's JSON Schema file (`/schema/pack.schema.json`, SPEC
  §5.7): it needs ENG-32's entity union. New row ENG-38 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-06 The character document

**Hat:** The core character document has a schema, with the migration frame
**Depends on:** ENG-05 (the pack, its `schemaVersion`), ENG-24 (a system's lists, its entity union)
**Size:** S
**Screen:** No
**SPEC:** §5.8; ADR 003 item A6; ADR 004 items 1, 3 and its §5.8 row; ADR 005 items 3.2, 3.3;
ADR 014 item 8

---

#### 1. Where the code lives

**Main file:** `packages/schema/src/character.ts` — new. The core part of a character, the field
for the module's part, and the character's opener.
- `packages/schema/src/migration.ts` — new. The migration frame: one opener for every stored file.
- `packages/schema/src/pack.ts` — changes: `PACK_MIGRATIONS`, `packOpenerOf`,
  `LOCALE_OVERLAY_MIGRATIONS`, `openLocaleOverlay`.
- `packages/schema/src/system.ts` — changes: `systemListsOf` also returns `editionSchema`.
- `packages/schema/src/entity-base.ts` — changes: `listWithUnique`, which `listWithUniqueIds`
  now calls.
- `packages/schema/src/ids.ts` — changes: `entityPartIdSchema`, `uuidSchema`.
- `packages/schema/src/index.ts` — changes: exports the two new files.
- `packages/schema/test/character.test.ts`, `packages/schema/test/migration.test.ts` — new.

#### 2. What is missing now

- No character schema and no migration code. `git grep -n -i -E "migrat|character"` over
  `packages/schema/src` and `packages/engine/src` finds 9 lines: 8 comments and one error message
  (`Must hold a visible character.`). `pack.ts` line 17 says another version "goes through the
  migration frame first (ENG-06)".
- A pack from a newer app is not told apart from a broken one. Measured: a pack with
  `schemaVersion: 2` is refused with `Invalid input: expected 1` on `schemaVersion`. ADR 003 item
  A6 asks for a clear refusal that says the file is newer.
- No schema gives a system's editions without `any`. `systemListsOf` gives `rulesetSchema`, which
  takes `any`; a character has one rules base (ADR 005 item 3.2).
- `pnpm test`: `Test Files 12 passed (12)`, `Tests 82 passed (82)`; none for a character or a
  migration.

#### 3. What it should look like when done

1. `@grimoire/schema` exports `characterSchemaOf`, `characterOpenerOf`, `CHARACTER_SCHEMA_VERSION`
   (`1`), `CHARACTER_MIGRATIONS` (empty), `CHARACTER_PACK_ID` (`character`), `DEFAULT_ACTOR_KIND`
   (`pc`); `openerOf` and the types `Migration`, `VersionChain`, `Opened`, `StoredObject`;
   `PACK_MIGRATIONS`, `packOpenerOf`, `LOCALE_OVERLAY_MIGRATIONS`, `openLocaleOverlay`;
   `entityPartIdSchema`, `uuidSchema`, `listWithUnique`.
2. `characterSchemaOf({ system, systemSchemaVersion, edition, entity, systemData })` builds a
   system's character schema from its id, the version of the module's part, its editions, its
   entity union and the module's part.
3. The core part has these fields (ADR 004's §5.8 row, ADR 014 item 8). All are required but
   `player` and `portraitBlobId`:
   - `id` — a lowercase UUID;
   - `schemaVersion` — exactly `CHARACTER_SCHEMA_VERSION`; `systemSchemaVersion` — exactly the
     module's;
   - `rev` — a whole number, 0 or more;
   - `createdAt`, `updatedAt` — date and time in UTC, as `2026-10-01T09:00:00.000Z`;
   - `system` — exactly the system's id; `ruleset` — one of its editions, never `any`;
   - `allowMixedRulesets` — true or false;
   - `kind` — the actor's kind, a key: `pc`, `npc`, `enemy`, or one the DM names;
   - `mode` — `guided` or `manual`;
   - `name`, `player` — visible text; `portraitBlobId` — a lowercase UUID;
   - `packs` — pack ids in order, none twice; may be empty;
   - `abilities.base` — stat key → whole number;
   - `choices` — `<entityId>#<grantId>` → keys or entity ids, at least one, none twice;
   - `state.resources` — resource key → uses spent, a whole number from 0;
     `state.conditions` — `{ id, level? }`, no id twice; `state.toggles` —
     `<entityId>#<effectId>` → true or false;
   - `overrides` — `{ path, value, note? }`, no path twice; `value` is a number, true or false, or
     visible text;
   - `localEntities` — entities of the system, no id twice;
   - `notes` — key → visible text;
   - `systemData` — the module's part, checked by the module's schema.
4. A character's own entities have ids of the pack `character` (`character:talent/lucky-charm`).
   Another pack's id is refused on `localEntities.<n>.id`; `character` in `packs` is refused on
   `packs.<n>`.
5. Refused, each on its own path: another system (`system`); another `schemaVersion` or
   `systemSchemaVersion`; `any` or an edition the system lacks (`ruleset`); an id that is not a
   lowercase UUID (`id`); a time with an offset, or a date with no time (`createdAt`); a choice key
   with no `#<grantId>` (`choices.<key>`); an empty choice; a path overridden twice
   (`overrides.1.path`); a condition twice (`state.conditions.1.id`); an entity type the system
   lacks (`localEntities.<n>.type`); an unknown field in the module's part (`systemData`); any
   unknown field (the root).
6. A system's parts that cannot be right throw when the schema is built: a system id that is not
   kebab-case; a `systemSchemaVersion` that is not a whole number from 1; an `edition` schema that
   takes `any`.
7. `openerOf(schema, chains)` is the migration frame. Each chain names a version field and its
   migrations; its current version is the number of migrations plus 1. Opening a file:
   - a version above the current one, in any chain, is refused before any step runs:
     `{ ok: false, code: 'newer', field, found, current, message }`;
   - a version below it runs the steps from that version, in order; after each step the frame
     writes the next version into the field;
   - the result is parsed by the schema: `{ ok: true, value, from }`, or
     `{ ok: false, code: 'invalid', error, message }`;
   - the file passed in is never changed.
8. The frame checks itself when it is built. A version field that is not one number literal
   throws `The schema's "<field>" is not one number literal.`; a literal that differs from the
   number of migrations plus 1 throws `The schema's "schemaVersion" is 2, but its migrations lead
   to version 1.`
9. A character opens through two chains: the core's (`schemaVersion`, `CHARACTER_MIGRATIONS`) and
   the module's (`systemSchemaVersion`, the migrations given to `characterOpenerOf`). A pack
   (`packOpenerOf`) and an overlay (`openLocaleOverlay`) open through one chain each. Each core
   chain has no migration today, so its current version is 1.
10. A made-up file at version 3 with two migrations: a version 1 file opens in the version 3
    shape, `from: { schemaVersion: 1 }`; a version 2 file runs only the second step; version 4 is
    refused as `newer`.
11. The quality gate is green.

#### 4. How to do it

1. `ids.ts`: `entityPartIdSchema`, a template literal `<entityId>#<slug>`; `uuidSchema`,
   `z.uuid().lowercase()`.
2. `entity-base.ts`: `listWithUnique(item, field)`; `listWithUniqueIds(item)` calls it with
   `id`, with the same message.
3. `system.ts`: `systemListsOf` returns `editionSchema`, the editions without `any`.
4. `migration.ts`: `openerOf`. It reads each field's literal from the schema's `propValues`, as
   ENG-24 reads names.
5. `character.ts`: `characterSchemaOf`, the core's constants, `characterOpenerOf`.
6. `pack.ts`: the pack's and the overlay's migration lists and openers.
7. The tests of §7.

Technical choices (ADR 002):
- **The module's part is one field, `systemData`.** ADR 004 splits the document into "a core
  part plus a part the module owns". One field keeps them apart: a core field and a module field
  can never share a name, and the core never reads the module's names. SPEC §5.8 has every field
  at the top level; the module's fields keep their meaning and move into `systemData`
  (ADR 002 item 3).
- **Two versions, not one.** The core's shape and each module's shape change on their own. With
  one number, a core change would bump every system's version, and a module's change the core's.
  `schemaVersion` is the core's, as on a pack; `systemSchemaVersion` is the module's. Both sit at
  the top level, because a module's step also changes `localEntities`, a core field that holds
  the module's types.
- **The current version is counted, not written.** A chain's current version is its migrations
  plus 1, and the frame throws for a schema whose literal differs. A version bumped without a
  step, or a step without a bump, fails as soon as the opener is built: in every test that loads
  it.
- **The frame writes the new version**, not the step, so a step cannot forget it.
- **A refusal carries a code and numbers.** The screen says it in the person's language
  (`CLAUDE.md`: no visible string outside i18n). `message` is English, for logs and tests.
- **A newer file is refused before any step runs**, in any chain (ADR 003 item A6).
- **A version that is not a whole number from 1 is not migrated.** The schema refuses it on its
  field, as `invalid`.
- **The base stat scores are the core's** (`abilities.base`): stats are the core's (ADR 004
  item 1), and ENG-12 computes them in the core. The score method is the module's (ADR 014
  item 8).
- **`state` holds the core's trackers**: resources, conditions, toggles. Hit points, temporary
  hit points, hit dice, slots, death saves, concentration and inspiration are fifth edition's
  (ADR 004's context lists them) and go in ENG-33's `systemData`.
- **House rules are the module's.** Every item of SPEC §8.4 is a fifth-edition rule.
- **`notes` is a record of key → text.** SPEC §5.8's eight names include ideals, bonds and
  flaws, which are fifth edition's; which notes a sheet shows is the module's.
- **A character's own entities use the pack id `character`.** Their ids never collide with a
  pack's entries (ADR 003 item A3), and a copied character keeps them with no id change. Every
  character uses the same id; each character has its own content index.
- **The id is a lowercase UUID**, made by the app (`crypto.randomUUID()`), so characters made on
  two devices never share an id. Lowercase only, so one id has one spelling.
- **`kind` and `allowMixedRulesets` are required.** One spelling per state; making a field
  optional later needs no migration, the reverse does (ADR 002 item 2). The creation screen
  writes `DEFAULT_ACTOR_KIND`.
- **A choice holds at least one item.** An unmade choice has no entry; `[]` would be a second
  spelling of it.

#### 5. Stored data

The character gets its first stored shape: `schemaVersion: 1`, and the module's
`systemSchemaVersion`. Nothing is stored yet (the Dexie database has no tables, SETUP-06), so
nothing migrates. The pack's and the overlay's shapes do not change; they gain an opener and an
empty list of migrations.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/schema/test/character.test.ts` — `describe('ENG-06 character document')`: a full
  character round trips; each required field; ids, times and `rev`; system, versions, editions;
  kinds and modes; packs; choices; trackers; overrides; a character's own entities; the module's
  part and unknown fields; two systems apart; a system's parts that throw; the inferred types
  (`expectTypeOf`, checked by `pnpm typecheck`). `describe("ENG-06 a character opens through the
  core's chain and the module's")`: the current versions; a newer core or module; a module's step.
- `packages/schema/test/migration.test.ts` — `describe('ENG-06 migration frame')`: a made-up
  file at version 3 with two steps (counted with `vi.fn`); a frozen file never changed; a newer
  file refused before any step; versions that are not whole numbers from 1; a migrated file the
  schema refuses; two chains; the checks at build time; the types.
  `describe('ENG-06 the openers of packs and overlays')`.
- Control values from: SPEC §5.8, ADR 004, ADR 014 item 8; the made-up systems and files of the
  tests themselves (ADR 004 item 4); RFC 9562's UUID form; `Date.prototype.toISOString`'s form.

#### 8. Checked against the source

Nothing to check: no rules fact is used.

#### 9. Not in this ticket

- Fifth edition's part, in `systemData`: classes, species, background, feats, spells, the
  inventory, coins, hit points, hit dice, slots, death saves, concentration, inspiration, XP or
  milestone, the score method, the ability bonus source, house rules: ENG-33.
- How `compute()` finds the entities a character has, now that species, classes and feats are in
  the module's part; what a choice's items mean for each grant kind: ENG-11, ENG-12.
- A choice's item not in its grant's list, a toggle whose effect is gone, an override of a path
  `Computed` lacks: warnings in ENG-11 and ENG-17, never a refusal (missing is not broken).
- The Dexie `characters` table, making and saving a character, counting `rev`: phase 2.
- The screens that show a refusal: phase 2 (a character's JSON), phase 5 (a pack).
- The DM's list of actor kinds: the DM tools' phase (ADR 013 item 14).
- The campaign copy, custom sections, companions: their phases, with a migration then (ADR 009,
  ADR 014 item 9).
- A version of the module's shape in a pack: §11.

#### 10. Rake check

- **A stored-shape change needs a migration.** The frame ties each version to its steps; a bump
  without a step throws when the opener is built.
- **Everything is data; the core names no game.** `character.ts` names no stat, tracker or note
  of any game. `pc` is an actor kind, a key the DM may add to. The test systems are made up.
- **Each system's rules live in its own module.** The module's part and its steps are arguments;
  no `if (system === …)` is written.
- **Missing is not broken.** The schema checks shape only. A choice, toggle or condition naming a
  missing entity is not refused here.
- **Manual overrides always win.** They are stored with path, value and note, one per path, so
  two overrides never compete.
- **Ids are stable.** A character's own entities keep their ids when the character is copied.
- **No user-facing string literal in a component.** A refusal is a code with numbers; the screen
  writes its text.
- **Licensing.** Test data is made up; no SRD or book text.

#### 11. What came out of it

Measured:
- The two new test files alone: `Tests 29 passed (29)`, 524 ms (17 for the character, 12 for the
  frame).
- Lint: `Checked 74 files`, 0 errors (70 before).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 14 passed (14)`, `Tests 111 passed (111)`, 1.80 s (before: 12 files,
  82 tests). ENG-02 to ENG-05's 82 tests pass unchanged.
- Build: `Done`.
- The exported JSON Schemas did not change: `packJsonSchemaOf` of a made-up system's pack,
  `localeOverlayJsonSchema()`, and `z.toJSONSchema` of `entityBaseSchema` and `coreEntitySchema`,
  written to one file before and after: 98,749 bytes each, `cmp` finds no difference.
- The tests bite. Each guard removed on its own, 41 tests run each time (the two new files and
  ENG-05's): lowercase UUID, 1 fails; `character` refused in `packs`, 1; a pack twice, 1; own
  entities in the pack `character`, 1; one override per path, 1; a choice's at least one and none
  twice, 1; the choice key's shape, 1; the toggle key's shape, 1; `any` refused as a rules base,
  1; the system id check, 1; the module version check, 1; the module's part left unchecked, 2;
  the newer refusal, 4; the counted version, 2; the one-literal check, 1; the frame writing the
  version, 5; the frame changing the file in place, 4; whole versions only, 1; steps from the
  version found, 3. `systemSchemaVersion` left as any whole number: the character test file does
  not load (`The schema's "systemSchemaVersion" is not one number literal.`), so its 17 tests do
  not run. `ruleset` left as any text: `pnpm typecheck` fails with `TS2344` on the `expectTypeOf`
  line.

Differences from §3: none.

Against the row: the row names the core character document and the migration frame. ADR 004's
§5.8 row lists the core part as id, versions, system, packs, choices, overrides, local entities,
notes and trackers. The code also keeps in the core part: the name, the player, the portrait,
the rules base and the mixing switch (ADR 005 items 3.2, 3.3), the mode, the base stat scores
(§4), and the actor's kind (ADR 014 item 8).

Found, not fixed:
- A pack holds the module's entity types but carries only the core's `schemaVersion`. When a
  module's entity type changes shape, a stored pack has no version that says which shape its
  entities have. A character has `systemSchemaVersion` (this ticket); a pack needs the same. New
  row ENG-39 in `BACKLOG.md`.
- A pack may have the id `character`. No character can turn it on (this ticket refuses it in
  `packs`). Noted on ENG-25 in `BACKLOG.md`.
- Species, classes and feats move into the module's `systemData`, so the core cannot read them
  to gather a character's entities. Noted on ENG-11 in `BACKLOG.md`.
- The made-up test system is now written in four test files. ENG-27 makes it shared test data, as
  ENG-24 §9 planned.

Nothing for the changelog.

---

### ENG-39 The module's version on a pack

**Hat:** A pack records the schema version of its system's module
**Depends on:** ENG-05 (the pack), ENG-06 (the migration frame, a character's `systemSchemaVersion`)
**Size:** S
**Screen:** No
**SPEC:** §5.7, §5.8 (migrations); ADR 003 item A6; ADR 004 item 3 and its §5.8 row

---

#### 1. Where the code lives

**Main file:** `packages/schema/src/pack.ts` — changes: `packSchemaOf` takes the module's
`systemSchemaVersion`; `packOpenerOf` takes the module's migrations.
- `packages/schema/src/system.ts` — changes: `schemaVersionSchema` (moved from `character.ts`) and
  `checkSystemIdAndVersion`, which both builders call.
- `packages/schema/src/character.ts` — changes: calls `checkSystemIdAndVersion` in place of its
  own two checks.
- `packages/schema/test/pack.test.ts` — changes: the made-up packs gain the field; a new
  `describe` for ENG-39.
- `packages/schema/test/migration.test.ts` — changes: the ENG-06 pack opener gets the module's
  (empty) list of steps.

#### 2. What is missing now

- A pack's entities are the module's types (ENG-24), but its only version is `schemaVersion`, the
  core's. `packSchemaOf({ system, ruleset, entity })` takes no version for the module.
- Measured: a made-up pack with `systemSchemaVersion: 1` is refused at the root:
  `Unrecognized key: "systemSchemaVersion"`.
- `packOpenerOf(packSchema)` takes one argument (`packOpenerOf.length` is `1`) and runs one
  chain, the core's. A module has no place to give a pack its steps.
- A character carries both versions (ENG-06): `characterSchemaOf` takes `systemSchemaVersion`,
  `characterOpenerOf` the module's migrations.
- `pnpm test`: `Test Files 14 passed (14)`, `Tests 111 passed (111)`; `pack.test.ts` has 12.

#### 3. What it should look like when done

1. `packSchemaOf({ system, systemSchemaVersion, ruleset, entity })`. A pack has the required
   field `systemSchemaVersion`, exactly the number given, after `system`.
2. Refused on the path `systemSchemaVersion`: the field missing, `2`, `0`, `'1'`, `null`.
3. `packSchemaOf` throws `The system's schema version <n> is not a whole number from 1.` for `0`
   and `1.5`: the text `characterSchemaOf` uses. The system id check keeps its text:
   `The system id "Tales" is not kebab-case.`
4. `packOpenerOf(packSchema, systemMigrations)` opens a pack through two chains: the core's
   (`schemaVersion`, `PACK_MIGRATIONS`) and the module's (`systemSchemaVersion`,
   `systemMigrations`). A current pack opens with
   `from: { schemaVersion: 1, systemSchemaVersion: 1 }`.
5. A made-up module at version 2, whose step renames a talent's `tier` to `rank`:
   - a version 1 pack opens in the version 2 shape, with
     `from: { schemaVersion: 1, systemSchemaVersion: 1 }`;
   - a version 3 pack is refused as `newer` on `systemSchemaVersion`, `found: 3`, `current: 2`,
     before any step runs;
   - a pack with no `systemSchemaVersion` runs no step and is refused on that path;
   - the opener built with no step throws
     `The schema's "systemSchemaVersion" is 2, but its migrations lead to version 1.`
6. The pack's JSON Schema has `systemSchemaVersion` as `{ "type": "number", "const": 1 }`, in
   `required`. A validator refuses a pack without it, or with `2`, and accepts the made-up packs.
   Nothing else in the exported JSON Schemas changes.
7. The inferred type of `systemSchemaVersion` is the number given (`1`), not `number`.
8. `PACK_SCHEMA_VERSION` stays `1`; `PACK_MIGRATIONS` stays empty (§5).
9. The quality gate is green.

#### 4. How to do it

1. `system.ts`: `schemaVersionSchema`, moved from `character.ts`; `checkSystemIdAndVersion`.
2. `character.ts`: call it, in place of its two checks.
3. `pack.ts`: `packSchemaOf` takes `systemSchemaVersion` and calls the check; `packOpenerOf`
   takes `systemMigrations`.
4. The tests of §7.

Technical choices (ADR 002):
- **One version per module, for its packs and its characters.** The module's shape is one thing:
  its entity types sit in a pack's `entities` and in a character's `localEntities`, its own part
  in a character's `systemData`. One number says which shape of the module a file has, whichever
  file it is. A module gives its one version to `packSchemaOf` and to `characterSchemaOf`.
- **Each opener gets its own steps.** A character's step changes `localEntities` and
  `systemData`; a pack's step changes `entities`. A module version that changes only `systemData`
  has a pack step that returns the pack as it is. Both lists are counted against the one version,
  so a module that bumps it and forgets the pack's step fails when the pack opener is built.
- **The field is required.** One spelling per state; making a field optional later needs no
  migration, the reverse does (ADR 002 item 2), as ENG-06 did for a character.
- **The two checks are written once.** The system id and the module's version are checked by one
  function that both builders call, so a pack and a character are refused in the same words.

#### 5. Stored data

The pack's stored shape changes: version 1 gains the required field `systemSchemaVersion`.
`PACK_SCHEMA_VERSION` stays `1` and no migration is added, because no version 1 pack exists
outside this repository's test files:
- `packages/content` builds no pack (`src/index.ts` is `export {};`);
- the Dexie database has no tables (`this.version(1).stores({})`, SETUP-06);
- no screen imports a pack (phase 5);
- the pack's JSON Schema is not published (ENG-38).

A migration would convert files that were never written. The character's and the overlay's
shapes do not change.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/schema/test/pack.test.ts` — `describe("ENG-39 a pack carries the version of its
  module's shape")`: the version taken, the others refused; the throw for a version that cannot
  be right; the JSON Schema's constant; the inferred type (`expectTypeOf`, checked by
  `pnpm typecheck`); a module's step on an older pack, a newer pack, a pack with no version, an
  opener with a step missing. The ENG-05 tests now need the field among the required ones.
- `packages/schema/test/migration.test.ts` — the ENG-06 pack opener tests, with the module's empty
  list and the module's version in `from`.
- Control values from: ENG-06 §3 (the character's version, the frame's messages); the made-up
  system and packs of the tests (ADR 004 item 4).

#### 8. Checked against the source

Nothing to check: no rules fact is used.

#### 9. Not in this ticket

- The fifth-edition module's version and its steps: ENG-33, which gives the same number to its
  packs.
- The published `pack.schema.json`: ENG-38.
- The Appendix Д pack's new field in golden E: ENG-22.
- Loading packs into the content index, their dependencies and their system: ENG-25.
- A locale overlay's version of the module's shape: §11.

#### 10. Rake check

- **A stored-shape change needs a migration.** The pack's version 1 gains a field with no
  migration, because no version 1 pack exists (§5). From here, each module step is counted
  against the module's version when the opener is built.
- **The core names no game.** `pack.ts` names no system; the module's version and steps are
  arguments. No `if (system === …)` is written.
- **Missing is not broken.** Not touched: the schema checks shape only.
- **Licensing.** Test data is made up; no SRD or book text.

#### 11. What came out of it

Measured:
- `pack.test.ts` alone: `Tests 17 passed (17)`, 983 ms (12 before; 5 new for ENG-39).
- Lint: `Checked 74 files`, 0 errors (74 before: no new file).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 14 passed (14)`, `Tests 116 passed (116)`, 1.70 s (before: 14 files,
  111 tests, 1.75 s). ENG-02 to ENG-06's tests pass, with the field added to their made-up packs.
- Build: `apps/web build: Done`.
- The exported JSON Schemas: `packJsonSchemaOf` of the made-up pack, `localeOverlayJsonSchema()`,
  and `z.toJSONSchema` of `entityBaseSchema` and `coreEntitySchema`, written to one file before
  and after: 383,315 bytes before, 383,429 after. `diff` shows two changes only: the property
  `"systemSchemaVersion": { "type": "number", "const": 1 }`, and `"systemSchemaVersion"` in the
  pack's `required`.
- The tests bite. Each guard removed on its own, with the pack, migration and character test
  files run (46 tests): the field left out of the pack, 13 fail and the migration file does not
  load (`The schema's "systemSchemaVersion" is not one number literal.`); the field as any whole
  number, 3 fail and the migration file does not load; the module's chain left out of the opener,
  2 fail; the version check left out of the shared function, 2 fail (one pack test, one
  character test); the pack's call to the shared check left out, 2 fail. The field's type widened
  to `number`: `pnpm typecheck` fails with `TS2344` on the `expectTypeOf` line.

Differences from §3: none.

Against the row:
- The row is XS. The pack's stored shape changes, so §5 is needed, and by `TEMPLATE.md` the ticket
  is not XS. It is written in the full form, and the row is now S.
- The code also moves the system id check and the module version check into one function,
  `checkSystemIdAndVersion`, which `characterSchemaOf` now calls too. The messages are the same;
  ENG-06's character tests pass unchanged.

Found, not fixed:
- A locale overlay keys its texts by field name, and a module's entity types may add text
  fields. The overlay carries only the core's `schemaVersion`. When a module renames a text
  field, a stored overlay keeps the old name, and its text is no longer shown. Noted on phase 5
  in `BACKLOG.md`, the phase that stores imported overlays.
- Golden E's Appendix Д pack needs `systemSchemaVersion` as well as `system`. Noted on ENG-22 in
  `BACKLOG.md`.
- The fifth-edition module gives its one version to its packs too. Noted on ENG-33 in
  `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-25 Packs load into the content index

**Hat:** Packs are checked as they load into the content index
**Depends on:** ENG-05 (the pack, `dependsOn`), ENG-06 (`CHARACTER_PACK_ID`), ENG-24 (a system's
entity union), ENG-39 (the pack's module version)
**Size:** S
**Screen:** No
**SPEC:** §5.1, §5.7, §8.2; ADR 003 item A3; ADR 004 item 3; ADR 014 items 2–4

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/content-index.ts` — new. `loadContentIndex`: the checks a pack
passes as it loads, and the index built from the packs that load.
- `packages/engine/src/version.ts` — new. `compareVersions`: semver precedence, for a
  dependency's lowest version.
- `packages/engine/src/index.ts` — changes: exports the two new files.
- `packages/engine/test/content-index.test.ts` — new.

#### 2. What is missing now

- The engine exports nothing: `Object.keys(await import('@grimoire/engine'))` is `[]`.
  `git grep -n -i -E "content.?index|loadPack|dependsOn" packages/*/src` finds one line,
  `packages/schema/src/pack.ts:79`, the schema's `dependsOn` field.
- The pack schema passes, measured on a made-up system's pack schema (`safeParse(...).success`):
  - a pack `tales-extra` holding the entity `tales-core:ability/grit`, an id of another pack:
    `true`;
  - a pack whose id is `character`, the pack id of a character's own entities: `true`;
  - a pack whose `dependsOn` names itself: `true`;
  - a pack with two `ability` entities of key `grit`, both of edition `first-age`: `true`.
- Nothing checks a dependency, a loop of dependencies, a pack's system against a character's, or
  a key against another pack's; nothing looks an entry up by id, by key or by name.
- `pnpm test`: `Test Files 14 passed (14)`, `Tests 116 passed (116)`; none for the engine but
  ENG-01's purity and SETUP-02's smoke test.

#### 3. What it should look like when done

1. `@grimoire/engine` exports `loadContentIndex`, `compareVersions`, and the types
   `ContentIndex`, `LoadedContent`, `IndexedEntity`, `PackToLoad`, `PackRefusal`,
   `LoadWarning`, `Lookup`.
2. `loadContentIndex(system, packs)` takes the character's system id and its packs in order,
   parsed by the system's pack schema. It returns `{ index, loaded, refused, warnings }`. Two
   made-up packs with nothing wrong: `loaded` is both ids in the order given; `refused` and
   `warnings` are `[]`; `index.entities` holds every entity, by pack, then in its pack's order.
3. `index.get(id)` gives `{ ok: true, entity }` for a loaded entry. For any other id it gives
   `{ ok: false, code: 'missing', id, message: 'Missing: <id>' }` and never throws.
4. A pack is refused, and none of its entries loads, when (`code`):
   - an earlier pack has its id (`repeatedPack`); the earlier pack's entries stay;
   - its id is `character` (`reservedId`);
   - its `system` is not the character's (`otherSystem`, with the pack's `system`);
   - an entity's id names another pack (`foreignEntity`, with that id); `get` of that id still
     gives the other pack's entry;
   - it is on a loop of dependencies (`dependencyLoop`, with `loop`, the shortest loop through it,
     from the pack back to the pack). `a → b → a` refuses both: `['tales-a', 'tales-b',
     'tales-a']` and `['tales-b', 'tales-a', 'tales-b']`. A pack that needs itself:
     `['tales-a', 'tales-a']`. With `a → b, a → c, b → a, c → b`, `c` is refused too:
     `['tales-c', 'tales-b', 'tales-a', 'tales-c']`. The message names the loop:
     `tales-a → tales-b → tales-a`.
5. A pack loads with a warning when (`code`):
   - a dependency is not loaded, because it was not given or was refused
     (`missingDependency`); its ids give `missing`;
   - a dependency is loaded at a lower version than asked (`olderDependency`, with `needed` and
     `found`): `1.0.0-beta.1` or `1.1.0` found for `1.2.0` warns; `1.2.0` or `1.10.0` does not;
   - an entity has the type and key of an earlier entity, of this pack or an earlier one, and
     the two share a ruleset: the same edition, or either is `any` (`repeatedKey`, with the later
     `entity` and the `kept` earlier one). The same key in another type, or in two different
     editions, warns nothing (ADR 014 item 2).
6. `index.withKey(type, key)` lists every entry of that type and key, in load order.
   `index.copiesOf(id)` lists the entries of the same type and key in another edition, neither
   being `any` (ADR 014 item 3); `[]` for an entry with no key, or an id not loaded.
7. `index.names(locale)` maps each name and alias in that language, lowercased in it, to the ids
   that have it, in load order, none twice (ADR 014 item 4). `names('en').get('climb')` lists both
   editions' `Climb`; `names('ru').get('стойкость')` finds a Russian name; a language with no
   names gives an empty map.
8. `compareVersions(a, b)` is negative, `0` or positive by semver 2.0.0 precedence. It orders
   that text's chain `1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2
   < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0` and its `1.0.0 < 2.0.0 < 2.1.0 < 2.1.1`; `1.10.0` is
   above `1.9.0`. A text `versionSchema` refuses throws `"1.0" is not a semver version.`
9. Loading is pure: deep-frozen packs load, and loading the same packs twice gives equal results.
10. The inferred entity type of the index is the system's entity union, not `IndexedEntity`.
11. The quality gate is green.

#### 4. How to do it

1. `version.ts`: `compareVersions`, after the input passes `versionSchema`.
2. `content-index.ts`: the types; the per-pack checks; the loop check on the packs that pass
   them; the dependency checks on the packs that load; the maps by id, by type and key, by name.
3. `index.ts`: export both.
4. The tests of §7.

Technical choices (ADR 002):
- **The index is the engine's.** `compute(character, contentIndex, ruleset)` (SPEC §6.1) reads
  it, so it lives where compute will. It reads only the fields every entity has (ENG-02): id,
  type, key, ruleset, name, aliases. It names no game.
- **Refused whole, or loaded with a warning.** A pack is refused when loading it could do harm:
  replace another pack's entry (a repeated id, an entity of another pack's id), collide with a
  character's own entities (`character`), mix systems, or depend on itself. Anything else that
  is only missing loads, and warns (SPEC §8.2: missing is not broken).
- **A pack holding another pack's id is checked here, not in the schema.** Every pack passes
  through the loader before its entries can be looked up, the module's built-in packs included,
  so the guarantee "a pack never replaces another pack's entry" holds here whatever made the
  pack.
- **A loop refuses the packs on it, not the packs that need them.** A pack that needs a pack on a
  loop loads with `missingDependency`. A pack is on a loop when it can reach itself through its
  dependencies, so every pack of a loop is found, even one reached only by a side path.
- **A key is unique per type.** SPEC §5.1 says a key is unique among a character's packs. Every
  formula path in SPEC §5.6 names its type's group first (`@abilities.dex.mod`,
  `@skills.stealth.total`, `@classes.fighter.level`), so one key in two types never meets in a
  path, and ADR 014 item 3 finds a copy by type and key. Within a type, two rulesets meet when
  they are equal or either is `any`, since an `any` entry holds in every edition.
- **The first of a repeated key is kept.** Both entries stay in the index and both are found by
  `withKey`; the warning names the later one. Which entry a formula reads is compute's.
- **A refusal or warning has a `code` and its data for the screen, and an English `message` for
  logs**, as ENG-06's opener does. The screen shows `Missing: <id>` from its own i18n key.
- **Names are lowercased in their own language**, so the Russian names fold by Russian rules.
- **Version numbers are compared as text**: by length, then by digit, since a semver number has
  no leading zero. A version of any length compares right, with no number type's limit.

#### 5. Stored data

Nothing stored changes. The loader reads parsed packs; no schema, no `schemaVersion` and no Dexie
table changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/content-index.test.ts` — `describe('ENG-25 packs load into the content
  index')`: the load with nothing wrong; `missing`; each refusal; each warning; the loops of §3
  item 4; `withKey`, `copiesOf`, `names`; frozen input, equal results twice; the inferred type
  (`expectTypeOf`, checked by `pnpm typecheck`). `describe('ENG-25 dependency versions')`:
  `compareVersions` on semver 2.0.0's examples.
- Control values from: the made-up system and packs of the test (ADR 004 item 4), parsed by
  `packSchemaOf`; semver 2.0.0 item 11 (§8).

#### 8. Checked against the source

- **Semver precedence.** Source: Semantic Versioning 2.0.0, `semver.md` in the
  `semver/semver` repository (semver.org's own text; semver.org itself is blocked from this
  machine). Item 11: precedence compares major, minor, patch, then the pre-release identifiers;
  "major, minor, and patch versions are always compared numerically"; "a pre-release version has
  lower precedence than a normal version"; digit-only identifiers compare numerically, others "in
  ASCII sort order"; "Numeric identifiers always have lower precedence than non-numeric
  identifiers"; "A larger set of pre-release fields has a higher precedence than a smaller set,
  if all of the preceding identifiers are equal". Its examples are §3 item 8's. Item 9: "Numeric
  identifiers MUST NOT include leading zeroes", which `versionSchema` already enforces.
- No rules fact of any game is used.

#### 9. Not in this ticket

- Which entry a key path reads across rulesets, the one the character has or else the rules
  base's (ADR 014 item 2), and a character's own entities next to the packs' (`localEntities`):
  gathering a character's entities, ENG-11. `withKey` gives it the candidates.
- A choice whose filter finds fewer entries than its `count` (ENG-04 §4): which entries a filter
  finds depends on the character's packs and its other choices, so it is checked where choices
  are offered, ENG-11.
- A skill's `ability` naming no stat (ENG-03 §9 named ENG-25): the skill's total reads that
  stat's path, and a missing path is `0` with a warning (ENG-07), at compute.
- The ids inside an entity (a grant's `fixed`, a prerequisite's `id`, `meta.variantOf`, a
  module's own fields) are not scanned at load. Each one gives `missing` when it is looked up.
- A character's active pack that is not installed on the device: the app looks packs up before
  it loads them (phase 2).
- Error texts a person reads: phase 5 for import, phase 2 for the sheet.

#### 10. Rake check

- **`packages/engine` is pure TypeScript.** The new files import only `@grimoire/schema` and each
  other; ENG-01's lint and typecheck run on them.
- **The core names no game.** No stat, type, system or edition name is written in the code; the
  test system is made up. `any` is the core's word for every edition (`systemListsOf`).
- **Missing is not broken.** An unknown id gives `missing`, never a throw; a missing dependency
  warns. Only a pack that would do harm is refused.
- **Ids are stable.** The index is keyed by id; nothing renames or rewrites an entry.
- **`compute()` is pure.** Loading changes none of its arguments and gives the same result for
  the same packs.
- **Licensing.** Test data is made up; no SRD or book text.

#### 11. What came out of it

Measured:
- `content-index.test.ts` alone: `Tests 16 passed (16)`, 729 ms (14 for loading, 2 for
  versions).
- Lint: `Checked 77 files`, 0 errors (74 before; 3 new files).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 15 passed (15)`, `Tests 132 passed (132)`, 2.33 s (before: 14 files,
  116 tests, 2.09 s).
- Build: `apps/web build: Done`.
- The tests bite. Each guard removed on its own, the new test file run (16 tests): a repeated pack
  id, 1 fails; `character`, 1; another system, 1; an entity of another pack, 1; the loop check, 2;
  a missing dependency, 1; an older dependency, 1; a repeated key, 1; `any` meeting every
  edition, 1; names lowercased, 1; a name's id once, 1; copies only in another edition, 1;
  `missing` in place of a throw, 5; the input packs changed in place (reversed twice), 1;
  version numbers by length, 2; a pre-release below its normal version, 1; digits below letters,
  1; a longer pre-release above, 1; the version checked by `versionSchema`, 1. The loader's
  return type widened to `LoadedContent<IndexedEntity>`: `pnpm typecheck` fails with `TS4104`
  and `TS2344` on the two `expectTypeOf` lines.
- One test did not bite at first: "digits below letters" passed with the guard removed, because
  in plain text order digits already sort below letters. The chain gained identifiers whose text
  order is the reverse of semver's (`99` before `--` and `1a`); with them, the guard's removal
  fails 1 test.

Differences from §3: none.

Against the row:
- The row names a duplicate `key` among active packs of one ruleset. The code checks one type's
  keys (§4, against SPEC §5.1's letter), within a pack as well as between packs, and treats `any`
  as meeting every edition.
- Beyond the row, from the closed tickets that named ENG-25: an entity id of another pack (ENG-02
  §9, ENG-05 §9) is refused; a dependency's lowest version (ENG-05 §4) warns when an older one is
  loaded; a pack id given twice is refused, the other way one pack could replace another's
  entries.
- Moved out, with the reason in §9: a skill's `ability` naming no stat (ENG-03 §9) to compute's
  missing path; a filter that finds fewer entries than its `count` (ENG-04 §4) to ENG-11.

Found, not fixed:
- The index holds the packs only. A character's own entities, which key path an entry of two
  rulesets answers (ADR 014 item 2), and a filter that finds too few entries are decided where a
  character's entities are gathered. Noted on ENG-11 in `BACKLOG.md`.
- A character's active pack that is not installed on the device never reaches the loader, so
  nothing says which pack is missing; its entries show `Missing: <id>` one by one. Noted on
  phase 2 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-07 Formulas

**Hat:** Formulas evaluate safely, returning the paths they read
**Depends on:** ENG-03 (`formulaSchema`), ENG-04 (`computedPathSchema`)
**Size:** M
**Screen:** No
**SPEC:** §5.6, §4.2 (the formulas row), §8.2; ADR 003 item A6

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/formula.ts` — new. `parseFormula`: text to a frozen tree, with
the length and depth limits. `evaluateFormula`, `evaluateNumber`, `evaluateCondition`: the tree
walked against a reader of paths.
- `packages/engine/src/index.ts` — changes: exports the new file.
- `biome.json` — changes: `eval` and `Function` join the globals the engine may not name.
- `packages/engine/test/formula.test.ts` — new.
- `packages/engine/test/purity.test.ts` — changes: a second `describe` for the new globals.

#### 2. What is missing now

- `git grep -n -i formula packages/engine/src` finds one line, the comment at the top of
  `index.ts`. Nothing parses or evaluates a formula. `packages/schema/src/formula.ts` keeps a
  formula as text with a visible character and says ENG-07 parses it.
- The engine names `new Function` and `Function(…)` with no lint error. Measured on a file in
  `packages/engine/src` with `eval('1')`, `new Function('return 1')`, `Function('return 1')`:
  `biome lint` reports line 1 only (`lint/security/noGlobalEval`).
- `pnpm test`: `Test Files 15 passed (15)`, `Tests 132 passed (132)`; none for a formula.

#### 3. What it should look like when done

1. `@grimoire/engine` exports `parseFormula`, `evaluateFormula`, `evaluateNumber`,
   `evaluateCondition`, `FORMULA_LIMITS`, and the types `FormulaValue`, `FormulaNode`,
   `ParsedFormula`, `FormulaError`, `FormulaWarning`, `FormulaReader`, `FormulaResult`.
2. The language is SPEC §5.6's: numbers (`3`, `2.5`), `+ - * /`, unary `-` `+` `!`, brackets,
   `< <= > >= == !=`, `&& ||`, `?:`, the functions `floor ceil round min max abs clamp if`, and
   paths `@` + a computed path (`@stats.grit.score`). Also a text in single quotes (`'heavy'`) and
   `true`, `false`, so a path's text or yes/no value can be compared. Precedence and grouping as
   in JavaScript: `2 + 3 * 4` is 14, `(2 + 3) * 4` is 20, `10 - 4 - 3` is 3, `24 / 4 / 3` is 2,
   `@level > 10 ? 3 : @level > 4 ? 2 : 1` with level 5 is 2.
3. Every reference SPEC §5.6 lists parses as a path (`@abilities.dex.mod`, `@prof`,
   `@classes.fighter.table.secondWindUses` …), and so do the formulas SPEC §5.3 and §5.4 give
   (`floor((@score - 10) / 2)`, `-2 * @conditions.exhaustion.level`, `+@prof`,
   `10 + @abilities.dex.mod + @abilities.con.mod`, `@conditions.exhaustion.level >= 2`).
4. The functions, with level 5: `floor((9 - 10) / 2)` is -1; `ceil(7 / 2)` 4; `round(2.5)` 3,
   `round(-2.5)` -2, `round(2.4)` 2 (a half goes up); `abs(-4)` 4; `min(3, @level, 4)` 3;
   `max(1, @level)` 5; `clamp(@level * 3, 1, 12)` 12, `clamp(-4, 1, 12)` 1, `clamp(7, 1, 12)` 7;
   `if(@gear.worn, 1, 2)` 1 when worn. `min` and `max` take one value or more, `clamp` and `if`
   three, the others one.
5. `evaluateFormula(formula, read)` takes the text or a parsed formula and a reader, a function
   from a path (without `@`) to its value, or `undefined` when the path is missing. It returns
   `{ value, reads, warnings }` and never throws.
6. A missing path reads as `0` with a warning `missingPath` naming it: `@nothing.here + 2` is 2.
   A value that is not a finite number, a yes/no or a text (`NaN`, an object, a function) reads as
   `0` with `notAValue`. A plain object as the reader's store, `@constructor` gives `0` and
   `notAValue`, never the object's function.
7. `reads` lists each path the evaluation read, in the order first read, once each; the reader is
   called once per path. `@level + @stats.grit.score * @level` is 80, reads `['level',
   'stats.grit.score']`, two calls. A branch not taken is not read: with `gear.worn` true,
   `@gear.worn ? @level : @nothing.here` is 5, reads `['gear.worn', 'level']`, no warning; the
   same for `if(…)` and for `&&`, `||` stopping early.
8. A parsed formula's `paths` lists every path its text names, in order, once each, taken or not:
   `['gear.worn', 'level', 'nothing.here']` for the formula of item 7.
9. Kinds of value: arithmetic gives a number; a comparison, `!`, `&&`, `||` give `true` or
   `false` (`0 || 3` is `true`); `?:` and `if` give the branch's value. A yes/no counts as 1 or 0
   in arithmetic (`@gear.worn + 1` is 2 when worn). A text in arithmetic or in `<` warns
   `wrongType` and counts as 0. `==` and `!=` compare two texts as text, a text and a number as
   unequal, anything else as numbers. As a condition, `0`, `false` and `''` are false; any other
   value is true.
10. A result that is not a finite number warns `notFinite` and gives 0: `1 / 0`, `0 / 0`, a
    number written with 400 digits. `-0` gives `0`.
11. `evaluateNumber` gives a number: a yes/no as 1 or 0, a text as 0 with `wrongType`.
    `evaluateCondition` gives `true` or `false` by item 9.
12. `parseFormula(text)` gives `{ ok: true, formula }` or `{ ok: false, error }`, never a throw.
    `error` has a `code`, `at` (the place in the text, from 0) and an English `message`:
    - `unexpected`, with `found` (the text found, `''` at the end): `2 +` at 3; `2 + * 3` `*` at
      4; `(2 + 3` at 6; `2 + 3)` `)` at 5; `2 # 3` `#` at 2; `@level = 5` `=` at 7; `@level & 1`
      `&` at 7; `1d10 + 2` `d10` at 1; an empty or blank text at 0; `'open` at 5 (no closing
      quote); `"x"` `"` at 0;
    - `unknownName`, with `name`: `1 + prof` at 4, its message pointing to `@prof`; `sqrt(4)`;
      `constructor(1)`, `toString(1)`, `__proto__(1)`;
    - `argumentCount`, with `name`, `found`, `min`, `max`: `floor(1, 2)`, `clamp(1, 2)`, `min()`,
      `if(1, 2)`;
    - `badPath`, with `path`: `@stats..score` (at the `@`), `@Level`, `@level.`, `@`, `@1x`,
      `@a_b`;
    - `tooLong`, with `length` and `limit`: a text of 1,001 characters, at 1,000. 1,000
      characters parse: `' ' + '1+'.repeat(499) + '1'` gives 500.
    - `tooDeep`, with `limit`: 33 nested brackets, at the 33rd `(` (32); 32 parse. The same for
      33 unary `-` and 33 nested `floor(`. A long chain of one operator stays shallow: 499 `+`
      parse.
13. Evaluating a formula that does not parse gives `0` (`false` for a condition), `reads` `[]`, the
    parse error as its one warning, and never calls the reader.
14. A parsed formula, its tree and its `paths` are frozen. The same formula with the same reader
    gives equal results twice.
15. `FORMULA_LIMITS` is `{ length: 1000, depth: 32 }`.
16. In `packages/engine/src`, naming `eval` or `Function` fails lint: `eval('1')`,
    `new Function('return 1')`, `Function('return 1')` each give `noRestrictedGlobals` with the
    message `ENG-07: …`.
17. The quality gate is green.

#### 4. How to do it

1. `formula.ts`: the tokens (numbers, texts, names, paths, operators), then a precedence-climbing
   parser that builds frozen nodes, collects `paths` and counts depth; then the walker with its
   reads, warnings and the checks of items 6, 9 and 10.
2. `index.ts`: export it.
3. `biome.json`: `eval` and `Function` in the engine's `deniedGlobals`.
4. The tests of §7.

Technical choices (ADR 002):
- **Its own parser, not jsep.** SPEC §4.2 allows either. The language is small (§3 item 2); a
  library would be the engine's first outside dependency (ENG-01's lint allows only
  `@grimoire/schema`), and jsep's tree has nodes this language must refuse (members, arrays,
  `this`, calls on any expression). The parser knows only what §3 lists.
- **No code runs.** The tree is walked by a `switch` over six node kinds. A function is looked up
  in a `Map` of the eight names, so `constructor` or `__proto__` is never found on an object's
  prototype. Lint stops the engine from naming `eval` or `Function` at all.
- **The limits.** 1,000 characters, about 20 times the longest formula SPEC gives (44
  characters: `10 + @abilities.dex.mod + @abilities.con.mod`). Depth 32: each bracket, function
  argument, unary operand, `?:` part, and an operator's right side opens a level, and the parser
  stops before it goes deeper, so a hostile pack cannot exhaust the stack. A chain of one
  operator (`1 + 1 + …`) is a loop, not a level. Raising either is one number in
  `FORMULA_LIMITS`.
- **A path is a computed path.** The text after `@` must pass `computedPathSchema` (ENG-04), the
  same pattern an effect's target has; the parser does not repeat the pattern.
- **Text and yes/no literals.** SPEC §5.6 names `@armor.group` and `@armor.worn`, a text and a
  yes/no. Comparing them needs `'…'`, `true` and `false`. A text has no escapes and only single
  quotes, which need no escaping inside JSON.
- **Never a throw.** A formula that does not parse, a missing path, a value of a wrong kind, a
  division by 0: each gives 0 (or false) and a warning with a `code` and its data, for the screen,
  and an English `message`, for logs, as ENG-25 does. Missing is not broken (SPEC §8.2).
- **`reads` and `paths` are both given.** `reads` (what this evaluation read) is SPEC §5.6's list
  for the breakdown; `paths` (every path the text names) is what a cycle check (ENG-18) and the
  base-phase check (SPEC §5.6) need, since a branch not taken today is taken tomorrow.
- **Each path is read once per evaluation.** The result is the same even when the reader is
  not, and a missing path warns once.
- **`&&` and `||` give `true` or `false`,** not one of their operands as JavaScript does, so a
  condition's value is always a yes/no.
- **`round` takes a half up** (2.5 → 3, −2.5 → −2), as JavaScript's `Math.round`. No rule of
  SPEC uses `round` yet; a rule that rounds otherwise uses `floor` or `ceil`.
- **Parsing is separate from evaluating.** `compute()` can parse a formula once and evaluate it
  many times; whether it keeps a cache is for the benchmark (ENG-23) to show.

#### 5. Stored data

Nothing stored changes. A formula is stored as text, as before (ENG-03); no schema, no
`schemaVersion` and no Dexie table changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/formula.test.ts` — `describe('ENG-07 formulas evaluate safely')`: the
  values of §3 items 2–4 and 9–11; missing and wrong values; `reads`, `paths`, branches not
  taken, one call per path; every parse error of item 12 with its `code`, `at` and data; the
  limits at their edges; frozen trees, equal results twice; the reader never called for a
  formula that does not parse.
- `packages/engine/test/purity.test.ts` — `describe('ENG-07 formulas never run code')`: lint
  fails on `eval`, `new Function` and `Function` in the engine.
- Control values from: the arithmetic of each formula, computed with `python3` (`math.floor`,
  `math.ceil`, `min`, `max`; `math.floor(x + 0.5)` for a half going up), not by the new code; the
  positions with Python's `str.index`; the lengths with `len`. Paths and values are made up; the
  only formulas of a game are SPEC §5.3–§5.6's, and only parsed.

#### 8. Checked against the source

Nothing to check: no rules fact is used. The language comes from SPEC §5.6; the formulas parsed
in §3 item 3 come from SPEC §5.3 and §5.4 and are not evaluated.

#### 9. Not in this ticket

- Dice in a formula (SPEC §5.6's roll formulas, `1d10 + @classes.fighter.level`, `2d20kh1`):
  dice notation is ENG-08's. Here a dice term does not parse (`unexpected`).
- What a path means and where its value comes from: `compute()` gives the reader (ENG-11,
  ENG-12, ENG-28); the contextual `@score`, `@self.*`, `@item.*` are paths its reader answers.
  Which entry a key path reads across rulesets (ADR 014 item 2): ENG-11.
- The base-phase rule (a base formula reads only levels, class levels and choices): ENG-12 checks
  a formula's `paths` against it.
- A cycle between formulas and its message: ENG-18, from `paths` and `reads`.
- Showing a formula's result in the breakdown: ENG-17.
- Error texts a person reads, and the formula editor: phase 5.
- A cache of parsed formulas: ENG-23's benchmark decides.

#### 10. Rake check

- **Formulas never run code.** No `eval`, no `new Function`: the tree is walked; lint now refuses
  both names in the engine; functions are found in a `Map`, never on an object.
- **Formulas have a length and a depth limit.** 1,000 characters, depth 32, checked while
  parsing, before the stack can grow.
- **A missing path gives `0` plus a warning, not an exception.** Every failure is a warning with a
  value; `parseFormula` and the `evaluate…` functions never throw.
- **`packages/engine` is pure TypeScript.** The new file imports only `@grimoire/schema`; ENG-01's
  lint and typecheck run on it.
- **The core names no game.** No stat, skill or path name is written in the code; the test's
  paths are made up, and SPEC's game formulas are only parsed.
- **`compute()` is pure.** The walker changes nothing it is given and reads each path once.
- **Licensing.** Test data is made up; no SRD or book text.

#### 11. What came out of it

Measured:
- `formula.test.ts` alone: `Tests 18 passed (18)`, 1.52 s.
- Lint: `Checked 79 files`, 0 errors (77 before; 2 new files).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 16 passed (16)`, `Tests 151 passed (151)`, 3.43 s (before: 15 files, 132
  tests, 2.76 s): 18 new in `formula.test.ts`, 1 new in `purity.test.ts`.
- Build: `apps/web build: Done`.
- The tests bite. Each guard removed on its own, `formula.test.ts` run (18 tests): the depth
  limit, 1 fails; the length limit, 1; `?:` grouped to the right, 1; operators grouped to the
  left, 3; the path checked by `computedPathSchema`, 1; functions found in a `Map` (an object in
  its place), 1; nodes frozen, 1; each path read once, 2; the missing-path warning, 2; only values
  accepted from the reader, 1; the finite check, 2; `-0` as `0`, 1; the warning for a text in
  arithmetic, 2; `&&` and `||` giving a yes/no, 1; `&&` stopping early, 1; a branch not taken not
  read, 2; a text and a number unequal, 1. The two `biome.json` lines removed: `purity.test.ts`
  fails 1 of 5.
- One test did not bite at first: with `?:` grouped to the left,
  `@level > 10 ? 3 : @level > 4 ? 2 : 1` still gave 2, since both groupings give 2 there.
  `@gear.worn ? 0 : 1 ? 2 : 3` was added: 0 grouped to the right, 3 to the left (`python3`).
  With it, the change fails 1 test.
- The never-throws test: its first form, 5,000 texts of random pieces, parsed 0 of them, so the
  walker was never tried. It now builds 5,000 formulas from the language and damages every second
  one by one piece put in or one character taken out. A first generator gave functions a random
  number of values: 1,108 of its 2,500 whole formulas failed, every one with `argumentCount` and
  no other code. With each function's own count, all 2,500 parse; 1,110 of the 2,500 damaged ones
  parse and 1,390 do not. None throws, and every value is a finite number, a yes/no or a text,
  through all three `evaluate…` functions.

Differences from §3:
- Item 12: a blank text (`'   '`) fails at its end, 3, not at 0. The parser reports where a value
  was expected, which for a blank text is its end. An empty text fails at 0.
- Item 12 gained three cases: `1.` and `.5` (`unexpected` `.` at 1 and at 0) and `floor + 1`
  (`unexpected` `+` at 6: a function's name needs its bracket).
- Item 2 gained `@gear.worn ? 0 : 1 ? 2 : 3`, which is 0 (above).

Against the row: as the row says. Beyond it, the parsed formula's `paths` (every path its text
names, for ENG-12 and ENG-18), and the lint check on `eval` and `Function` in the engine.

Found, not fixed:
- A roll formula (SPEC §5.6) mixes dice with formula terms: `1d10 + @classes.fighter.level`. This
  parser refuses a dice term (`unexpected`). Noted on ENG-08 in `BACKLOG.md`.
- SPEC §5.6's base-phase rule (a base formula reads only levels, class levels and choices) needs
  a check against a formula's `paths`. No row names it. Noted on ENG-12 in `BACKLOG.md`.
- A pack's formulas are only text to the schema (ENG-03), and the schema package cannot import
  the engine. A formula past the limits, or one that does not parse, loads and is found only when
  it is evaluated, as a warning. ADR 003 item A6 puts the limits in the import checks. Noted on
  phase 5 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-08 Dice

**Hat:** Dice notation is rolled, in `d` or `к`
**Depends on:** ENG-07 (`parseFormula`, the formula language and its walker)
**Size:** S
**Screen:** No
**SPEC:** §5.6 (roll formulas), §6.5 (`d` and `к`), §4.2 (the dice row); ADR 014 item 11

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/dice.ts` — new. `DICE_LIMITS`; the random source a caller
passes in (`RandomSource`, `randomSourceOf`); a die drawn from it without bias (`DieSource`,
`fairDie`); one term rolled, with what it keeps (`rollDice`).
- `packages/engine/src/formula.ts` — changes: a dice term is a token and a node of the formula
  language; `parseRoll` parses a roll formula; `rollFormula` walks one, rolling each term it
  reaches; `parseFormula` refuses a dice term with its own code.
- `packages/engine/src/index.ts` — changes: exports `dice.ts`.
- `biome/no-math-random.grit` — new: `Math.random` in the engine fails lint.
- `biome.json` — changes: the engine's override runs that plugin.
- `packages/engine/test/dice.test.ts` — new.
- `packages/engine/test/purity.test.ts` — changes: a `describe` for `Math.random`.
- `packages/engine/test/formula.test.ts` — changes: one line, `1d10 + 2` now refused as dice.

#### 2. What is missing now

- `git grep -n -i "dice\|roll" packages/engine/src` finds one line, the comment at the top of
  `index.ts`. Nothing parses or rolls a dice term.
- Measured with `parseFormula` on the SPEC's roll formulas:
  `1d10 + @classes.fighter.level` → `unexpected` `d10` at 1; `2d20kh1` → `unexpected` `d20kh1`
  at 1; `2к6+3` → `unexpected` `к` at 1; `d20` → `unknownName` `d20` at 0.
- The engine can name `Math.random` with no lint error; `crypto` is not in its types
  (`lib: ["ES2022"]`, `types: []`), and `globalThis` is refused (ENG-01).
- `pnpm test`: `Test Files 16 passed (16)`, `Tests 151 passed (151)`, 2.64 s.

#### 3. What it should look like when done

1. `@grimoire/engine` exports `DICE_LIMITS`, `randomSourceOf`, `fairDie`, `rollDice`,
   `parseRoll`, `rollFormula`, and the types `RandomSource`, `DieSource`, `DiceTerm`, `DiceKeep`,
   `RolledDice`, `DiceNode`, `RollNode`, `ParsedRoll`, `DiceRoll`, `RollResult`.
2. A dice term is `[count]d<faces>[kh[n] | kl[n]]`. The letter is `d` or `к` (SPEC §6.5):
   `2к6+3` rolls as `2d6+3`. No count means 1 (`d20`, `к8`). `kh` keeps the highest `n` dice,
   `kl` the lowest; no `n` means 1. Letters are read in either case (`2D6`, `2К6`, `4d6KH3`).
3. `parseRoll` accepts the formula language of ENG-07 with dice terms as values:
   `1d10 + @classes.fighter.level` (paths `['classes.fighter.level']`), `2d20kh1`,
   `-1d4`, `max(1, 1d4 - 3)`, `(2d6) * 2`, `@gear.worn ? 1d6 : 1d8`.
4. Limits, `DICE_LIMITS` = `{ count: { min: 1, max: 999 }, faces: { min: 2, max: 1000 } }`.
   `999d6`, `1d2`, `1d1000`, `37d6`, `3d7` parse. Refused, never thrown, each with `at` (the
   term's start), `term` (its text) and an English message:
   - `diceCount` with `found`, `min`, `max`: `0d6`, `1000d6`;
   - `diceFaces` with `found`, `min`, `max`: `1d1`, `1d0`, `1d1001`;
   - `diceKeep` with `found`, `min` 1, `max` the dice rolled: `2d20kh3`, `2d20kh0`, `2d20kl3`.
5. `parseFormula` refuses a dice term with `diceNotAllowed` and `term`, before any limit:
   `1d10 + 2` at 0, `2 + к6` at 4, `0d6` at 0. Text that is no dice term keeps ENG-07's errors:
   `2d` (`unexpected` `d` at 1), `2к` (`unexpected` `к` at 1), `d` (`unknownName`).
6. `rollFormula(formula, read, die)` takes the text or a `ParsedRoll`, the reader of ENG-07 and a
   die source, a function from a number of faces to a face. It returns `{ value, reads,
   warnings, dice }` and never throws. `value` is a number (a yes/no as 1 or 0). With a die that
   gives 4 then 5, `2d6 + 3` is 12 and `dice` is `[{ at: 0, text: '2d6', count: 2, faces: 6,
   results: [4, 5], kept: [true, true], total: 9 }]`.
7. `kh` and `kl` keep by value; between equal dice the earlier one is kept. `2d20kh1` with 7
   and 15 is 15, `kept` `[false, true]`; `2d20kl1` is 7; `2d20kh1` with 9 and 9 keeps the
   first; `4d6kh3` with 3, 4, 1, 1 is 8, `kept` `[true, true, true, false]`.
8. A term in a branch not taken is not rolled, as a path is not read:
   `@gear.worn ? 1d6 : 1d8` asks the die once, for 6 faces; `0 && 1d6` asks it never.
9. A face that is not a whole number from 1 to the die's faces (`7` or `0` on a d6, `2.5`,
   `NaN`) counts as 0, with one `badFace` warning for the term naming how many dice gave none.
10. A roll formula that does not parse gives `0`, `reads` `[]`, `dice` `[]`, the parse error as
    its one warning, and never calls the reader or the die.
11. `fairDie(random)` draws a whole number below 2^32 and keeps it only below the largest
    multiple of the faces that fits, so every face has exactly as many numbers (python3):
    3 faces keep below 4,294,967,295; 6 and 7 faces below 4,294,967,292; 20 below
    4,294,967,280; 1000 below 4,294,967,000; 2 faces keep every number. A number at or above
    the line, or one that is not a whole number from 0 to 2^32 − 1, is drawn again; after 16
    such draws in a row the die gives 0, so the roll warns (item 9) and never hangs.
12. `randomSourceOf(fill)` serves the numbers `fill` writes into a `Uint32Array`, in order, 256
    at a time: the app passes `(a) => crypto.getRandomValues(a)`.
13. A statistical test proves every face equally likely: `fairDie` over Node's
    `crypto.getRandomValues` through `randomSourceOf`, chi-square against the uniform count,
    below the threshold where p = 10⁻⁹ (scipy `chi2.ppf`, cut to two decimals): d2 37.32,
    d6 50.69, d7 53.34, d20 81.55, d1000 1290.82. The same test, run on a die with a remainder
    bias (an 8-bit number modulo 100), fails it: d100's threshold 207.89.
14. A parsed roll formula, its tree and its `paths` are frozen. The same formula, reader and
    die faces give equal results twice.
15. In `packages/engine/src`, `Math.random` fails lint with the message `ENG-08: …`.
16. The quality gate is green.

#### 4. How to do it

1. `dice.ts`: `DICE_LIMITS`; `RandomSource`, `randomSourceOf`; `DieSource`, `fairDie`;
   `DiceTerm`, `DiceKeep`, `rollDice(term, die)` giving `{ results, kept, total, badFaces }`.
2. `formula.ts`: the node types become generic over a dice node (`FormulaNode` has none,
   `RollNode` has `DiceNode`); the tokenizer reads a dice term before a number or a name; the
   parser takes a mode: plain refuses a term, roll checks it against `DICE_LIMITS`.
   `parseRoll`; the walker takes a dice handler; `rollFormula` rolls through it and records each
   term; `badFace` joins `FormulaWarning`.
3. `index.ts`: export `dice.ts`.
4. `biome/no-math-random.grit` and the engine override in `biome.json`.
5. The tests of §7; ENG-07's `1d10 + 2` line takes the new code.

Technical choices (ADR 002):
- **Its own dice, on ENG-07's parser, not `@dice-roller/rpg-dice-roller`.** SPEC §4.2 names that
  library; this departs from the letter and keeps the intent (dice in the formulas, a fair roll).
  Measured with `npm view` and its package 5.5.1: it depends on `mathjs` (14.9.1, 9,307,013
  bytes unpacked) and `random-js`; its default engine is `nativeMath`, `Math.random()`; its own
  arithmetic goes through `mathjs`'s `evaluate`. Its notation has no `@paths`, no `?:`, no `&&`,
  so SPEC §5.6's `1d10 + @classes.fighter.level` would need the paths written into the text
  first, losing `reads`, and `@gear.worn ? 1d6 : 1d8` could not be written at all. ENG-01's lint
  lets the engine import only `@grimoire/schema`. A dice term is a small addition to a parser
  that already knows the rest.
- **The random source is passed in.** The engine cannot see `crypto` and must not reach the
  environment (ENG-01), so the caller gives the numbers: the app, `crypto.getRandomValues`
  (ADR 014 item 11); a test, Node's same function or a script. Lint refuses `Math.random` in the
  engine, so no roll can fall back to it.
- **A die source between the numbers and the roll.** `rollFormula` asks a `DieSource` for each
  face; `fairDie` makes one from the random numbers. A test scripts exact faces, and SPEC §6.5's
  "I roll myself" mode (phase 2) can give the faces a person typed.
- **No remainder bias:** rejection, as in item 11. The worst die is d997: 966 of 2^32 numbers
  are drawn again, p ≈ 2.25 × 10⁻⁷ per draw; 16 such draws in a row with a working source have
  p ≈ 4.3 × 10⁻¹⁰⁷ (python3). The cap is there for a broken source, which must never hang a
  roll; its 0 shows as a warning, not as a silent face.
- **A bad face is 0 with a warning,** as a missing path is (SPEC §8.2): the roll still has a
  value, and the screen can say what went wrong.
- **The term is checked while parsing,** so a limit is a parse error with its place, like the
  length and depth limits of ENG-07. Raising a limit is one number in `DICE_LIMITS`.
- **Its own error code in a plain formula.** `diceNotAllowed` says what is wrong where ENG-07's
  `unexpected` `d10` did not. This changes one line of ENG-07's test.
- **Types keep the two kinds apart.** A `ParsedFormula` can be rolled (it has no dice); a
  `ParsedRoll` cannot be given to `evaluateFormula`, so no screen evaluates dice by mistake.
- **Letters in either case; `kh` and `kl` only.** SPEC §5.6 names `kh`; `kl` is its mirror.
  Drop, reroll and exploding dice are left until a ticket needs them.
- **The term's text is kept as written** (`2к6`); the screen writes `d` or `к` by language from
  `count` and `faces`, through an i18n key.
- **256 numbers per `fill`.** One call per die would cost a call into the platform per face; 256
  × 4 bytes is far under `getRandomValues`'s 65,536-byte limit.

#### 5. Stored data

Nothing stored changes. A roll formula is stored as text, as any formula (ENG-03); no schema, no
`schemaVersion` and no Dexie table changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/dice.test.ts`:
  - `describe('ENG-08 dice notation is rolled')`: the notation of §3 items 2–5 with every error's
    `code`, `at` and data; the rolls of items 6–10 with a scripted die; frozen trees, equal
    results twice; a `@ts-expect-error` line showing a `ParsedRoll` refused by
    `evaluateFormula`; a seeded run of 2,000 roll formulas, half damaged, that never throws.
  - `describe('ENG-08 every face is equally likely')`: the lines of item 11 with scripted
    numbers; `randomSourceOf` in order across a refill; the chi-square test of item 13.
- `packages/engine/test/purity.test.ts` — `describe('ENG-08 the engine has no randomness of its
  own')`: lint fails on `Math.random` in the engine.
- Control values from: python3 (`2**32 % faces`, the arithmetic of each roll, positions with
  `str.index`), scipy 1.17.1 `chi2.ppf(1 - 1e-9, df)` for the thresholds; never from the new
  code. Paths and values are made up.

#### 8. Checked against the source

Nothing to check: no rules fact is used. The notation is SPEC §5.6's (`1d10 + …`, `2d20kh1`) and
§6.5's (`d` and `к`); the limits and the fairness are ADR 014 item 11's. What advantage or a
critical hit does with dice is fifth edition's (ENG-34).

#### 9. Not in this ticket

- Advantage, disadvantage, critical dice: ENG-34, which can write `2d20kh1` and double a term's
  dice in the tree.
- The roll result the table link sends (who rolled, what for, public or secret, the person's own
  modifiers): ENG-26, built on `RollResult`.
- The average SPEC §5.6 shows next to a roll formula, and a count of dice that grows with level
  (`ceil(@level / 2)d6`): noted on ENG-16, the first ticket that shows a roll formula's number.
- The dice panel, the app's `crypto.getRandomValues`, "I roll myself", the roll log, `1к20` or
  `1d20` by language: phase 2 (SPEC §6.5; ADR 009, ADR 010).
- The honest animated roll and dice skins: the dice phase (ADR 009 item 10, ADR 005 item 11).
- Ability score methods that roll (ADR 010 item 12): ENG-33 stores them, phase 4 rolls them.
- A pack's roll formula checked on import: phase 5's import checks (the note in `BACKLOG.md`).

#### 10. Rake check

- **`packages/engine` is pure TypeScript.** `dice.ts` imports nothing; the numbers come in as an
  argument; lint refuses `Math.random`, and ENG-01's rules still run on the new file.
- **Formulas never run code; they have length and depth limits.** A dice term is a leaf of the
  same walked tree; the limits of ENG-07 hold, and a term has its own.
- **Missing is not broken.** A refused term is a parse error with a code; a bad face is 0 with a
  warning; a broken source cannot hang a roll. Nothing throws.
- **`compute()` is pure.** Rolling is not part of `compute()`; `rollFormula` changes nothing it is
  given, and the same faces give the same result.
- **The core names no game.** No die, stat or rule of a game is written in the code; test paths
  are made up.
- **The dice parser accepts both `d` and `к`.** Item 2.
- **Licensing.** No rules text; the test data is made up.

#### 11. What came out of it

Measured:
- `dice.test.ts` alone: `Tests 23 passed (23)`, 943 ms.
- Lint: `Checked 82 files`, 0 errors (79 before; 3 new files).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 17 passed (17)`, `Tests 175 passed (175)`, 2.97 s (before: 16 files, 151
  tests, 2.64 s): 23 new in `dice.test.ts`, 1 new in `purity.test.ts`; one line of
  `formula.test.ts` changed.
- Build: `apps/web build: Done`.
- `dice.test.ts` run 20 times in a row: 20 passed, 0 failed.
- The chi-square on the secure source, 5 runs each, against its threshold: d2 0.04 to 2.04
  (37.32); d6 1.34 to 7.06 (50.69); d7 3.77 to 11.64 (53.34); d20 9.18 to 22.49 (81.55); d1000
  913.05 to 1,083.92 (1,290.82). The 8-bit biased d100: 3,797.2 to 3,946.5 (threshold 207.89;
  python3's mean for that bias, 3,858.7).
- The never-throws run: 2,000 roll formulas; all 1,000 built ones parse; 464 of the 1,000
  damaged ones parse; 2,229 dice terms rolled, each checked for its count, its faces, what it
  kept and its total.
- The tests bite. Each guard removed or changed on its own, the three test files run (47
  tests): no rejection line, 3 fail; the line off by one (`<=`), 1; no whole-number check on the
  random number, 1; the cap at 15 draws, 1; a face off by one, 6; a refill on every draw, 1; no
  face check, 2; ties keeping the later die, 1; highest and lowest swapped, 4; a total of every
  die, kept or not, 4; dice allowed in a plain formula, 2; no count limit, 1; no faces limit, 3;
  no keep limit, 2; no default count, 3; no default keep, 1; letters in one case only, 3; no `к`,
  5; `keep` not frozen, 1; no `badFace` warning, 2; the lint plugin removed from `biome.json`, 1.
- The lint rule catches `Math.random` written out. `Math['random']` is flagged by
  `useLiteralKeys`, whose fix writes it out; `const { random } = Math` is not caught (measured in
  a scratch directory). The rule guards against a slip, not against code written to hide.

Differences from §3:
- Item 13: the thresholds are cut, not rounded, to two decimals, so d20's 81.559 is 81.55 and
  d100's 207.898 is 207.89 (stricter by less than 0.01).
- Item 4 gained `0d1` (the count is checked before the faces) and terms that start later in the
  text: `1 + 0d6` at 4, `@level + 2d20kl3` at 9. Item 5 gained `D20`. Item 8 gained
  `if(@gear.worn, 2d4, 1d100)`. Item 9 gained `-1` and infinity.

Against the row: as the row says. Beyond it: lint refuses `Math.random` in the engine, and a
plain formula refuses a dice term with its own code.

Found, not fixed:
- SPEC §5.6 shows a roll formula with its average. No function gives it, and a term that keeps
  some dice is not `count × (faces + 1) / 2`: `2d20kh1`'s average is 13.825, not 10.5 (python3).
  A count that grows with level (`ceil(@level / 2)d6`) is not notation either; a term's count is
  digits. Noted on ENG-16 in `BACKLOG.md`.
- The engine cannot see `crypto`. Until the app passes `crypto.getRandomValues`, nothing rolls
  with the secure source outside the tests. Noted on phase 2 in `BACKLOG.md`.
- Phase 5's import checks parse a pack's formulas with `parseFormula`, which refuses dice; a roll
  formula needs `parseRoll`. Added to that note in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-26 The roll record · XS

**Hat:** A roll result has the shape the table link will send
**Where:** `packages/schema/src/roll.ts` — new: `rollRecordSchema`, the shape;
`packages/engine/src/roll.ts` — new: `recordRoll`, which rolls labelled parts into that shape on
ENG-08's `rollFormula`; both packages' `index.ts` export them;
`packages/schema/test/roll.test.ts` and `packages/engine/test/roll.test.ts` — new
**Depends on:** ENG-08 (`rollFormula`, `RollResult`, `DieSource`), ENG-02 (`uuidSchema`,
`entityIdSchema`, `computedPathSchema`)
**Screen:** No

**What it should look like when done:**
1. `@grimoire/schema` exports `rollRecordSchema` and the types `RollRecord`, `RollEntry`,
   `Roller`, `RollVisibility`. A record holds (ADR 005 item 5.6):
   - `id` (a uuid made on the device) and `rolledAt` (an ISO date-time);
   - `by`, who rolled: `role` (`player` or `gm`, the game master), `name`, and `actorId`, the
     rolling character's id, when a character rolled;
   - `label`, what the roll is for, and `path`, the computed number it rolls against, if any;
   - `visibility`: `public`; `secret`, a player's roll seen by that player and the game master
     only; `hidden`, a game master's roll seen by the game master only;
   - `total`, the result;
   - `breakdown`, at least one entry: `label`, `formula` as rolled, `value`, `dice` (each term
     as ENG-08's `DiceRoll`), `sourceId` when an entity gave it, and `own`, true for the
     person's own modifier (ADR 009 item 11, ADR 014 item 12).
2. The schema refuses a record that does not add up, each with an issue at its path: `total`
   not the sum of the entries' values; a term whose `results` or `kept` do not hold `count`
   items, whose face is above its `faces`, whose kept count is not its `keep.count` (all kept
   when it has no `keep`), or whose `total` is not the sum of its kept faces; a term whose
   `text` is not found at `at` in its entry's `formula`; `secret` by the game master; `hidden`
   by a player; an unknown field anywhere.
3. `@grimoire/engine` exports `recordRoll(request, read, die)` and the types `RollPart`,
   `RollRequest`, `RollPartWarning`, `RecordedRoll`. The request holds everything a record
   holds except `total` and `breakdown`, plus `parts` (at least one: the roll as the rules give
   it) and `modifiers` (the person's own, may be none). Each part and modifier is a `label`, a
   roll formula (text or `ParsedRoll`) and an optional `sourceId`. It returns `{ record,
   warnings }`: one breakdown entry per part, then one per modifier with `own: true`, each rolled
   with `rollFormula` in that order; `total` is their sum; each warning names its entry's index.
4. With a die that gives 14, then 3, a made-up Sneak `1d20 + @skills.sneak.total` (7) and a
   modifier Lucky charm `1d4` give `total` 24, entries 21 (`own: false`) and 3 (`own: true`),
   and the record passes `rollRecordSchema`.
5. A part that does not parse, or reads a missing path, gives its value as ENG-08 does, with the
   warning at its entry's index; the record still passes the schema. A value that would take the
   total past a finite number gives 0 with a `notFinite` warning, as ENG-07's does.
   `recordRoll` never throws.
6. The record shares no array or object with the request or the roll, so changing one later
   does not change the other.
7. The quality gate is green.

**Choices (ADR 002):**
- **A Zod schema, not only a type.** A record crosses from one device to another (the table
  link), and phase 2's roll log keeps it, so the receiver checks it as packs and characters are
  checked. The engine builds it, so no component sums a roll (`CLAUDE.md`: every rule lives in
  `engine` or `content`).
- **`gm`, not `dm`.** The core names no game (ADR 004); "DM" is the docs' word for the game
  master of one game.
- **Labels are text as the roller saw it,** not `{ en, ru }`: a person types their own
  modifier's label in one language, and the record shows what was rolled.
- **The record carries no warnings.** They are about the roller's own sheet and are returned
  next to it; a received roll is shown, not debugged.
- **No `schemaVersion` on the record.** Nothing stores or sends it yet; the first table or
  message that does gives it one (phase 2's roll log, the table link).

**Tests:** `packages/schema/test/roll.test.ts` — `describe('ENG-26 the roll record')`: a full
record and a minimal one pass; each refusal of item 2 at its path.
`packages/engine/test/roll.test.ts` — `describe('ENG-26 a roll is recorded')`: items 3–6 with a
scripted die; a seeded run of rolls built from made-up parts and modifiers, each record passing
`rollRecordSchema`. Control numbers: the faces are scripted and the sums written by hand from
them; paths and values are made up.

**What came out of it:**

Measured:
- Before: `git grep -n -i "rollRecord\|roll record\|visibility\|secret" packages/` found
  nothing; no type or schema held who rolled, what for, or who may see it. `pnpm test`:
  `Test Files 17 passed (17)`, `Tests 175 passed (175)`, 2.83 s. Lint: `Checked 82 files`.
- `packages/schema/test/roll.test.ts`: 7 tests. `packages/engine/test/roll.test.ts`: 7 tests.
- Lint: `Checked 86 files`, 0 errors (4 new files).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 19 passed (19)`, `Tests 189 passed (189)`, 2.91 s.
- Build: `apps/web build: Done`.
- The seeded run: 500 requests, 1,768 breakdown entries, 562 warnings; every record passes
  `rollRecordSchema`, and its total is the sum of its entries.
- The tests bite. Each guard removed or changed on its own, the two roll test files run (13
  tests, before item 5's overflow test was added): the record's sum check, 1 fails; the
  visibility pairing, 1; the `results`/`kept` length, 1; a face above the faces, 1; the kept
  count, 2; a term's sum, 1; a term's text at its place, 1; at least one entry, 1; parts marked
  `own`, 3; modifiers before parts, 3; `keep` not copied, 1; `by` not copied, 1; every warning
  at entry 0, 1; the total off by 1, 6; `sourceId` dropped, 2; a parsed formula's text not kept,
  1. The overflow guard removed (with its test, 7 in the engine file): 1 fails.

Differences from §3:
- Item 5 gained the overflow line. Measured before it: two parts of a 308-digit number gave
  `total` `Infinity` with no warning, and `rollRecordSchema` refused the record.
- Item 3: a warning's index is the field `entry`.

Against the row: as the row says, ADR 005 item 5.6 and ADR 014 item 12. Beyond it: the record's
`id` and `rolledAt`, so a log or a link can order rolls and find one twice (Choices).

Found, not fixed:
- `rollRecordSchema` refuses an unknown field and carries no version of its own. Phase 2's roll
  log (SPEC §6.5) stores records, and the table link sends them; each gives them a version.
  Noted on phase 2 in `BACKLOG.md`; the table link's phase has no rows yet, and this ticket's
  Choices name it.

Nothing for the changelog.

---

### ENG-27 The made-up test system

**Hat:** The made-up test system exists as core test data
**Depends on:** ENG-24 (`systemListsOf`, `systemSchemasOf`, `systemEntitySchemaOf`), ENG-05,
ENG-06, ENG-39 (the pack's and the character's schemas and openers), ENG-25
(`loadContentIndex`), ENG-07 (`evaluateNumber`, for the check of item 9)
**Size:** S
**Screen:** No
**SPEC:** §5.3–§5.5, §5.8, §6.1 (what the data exercises); ADR 004 item 4; ADR 014 item 2

---

#### 1. Where the code lives

**Main folder:** `packages/schema/test/tales/` — new. Tales, a small invented game, as test
data that every core test can import.
- `tales/system.ts` — new: Tales' lists, its grant kind `boon`, its entity types `talent` and
  `calling`, its part of a character, its pack and character schemas and openers, and
  `TALES_RULES`, the rules of item 3 that are not entity data.
- `tales/content.ts` — new: `talesCore`, the pack `tales-core`.
- `tales/characters.ts` — new: two characters, `ash` and `brook`.
- `tales/expected.ts` — new: what `compute()` must give for each character, computed by hand
  from Tales' rules, with the arithmetic beside each value.
- `tales/index.ts` — new: exports the four files.
- `packages/engine/test/test-system.test.ts` — new: the data is whole and agrees with itself.
- Changes: `packages/schema/test/system.test.ts`, `pack.test.ts`, `character.test.ts`,
  `migration.test.ts` and `packages/engine/test/content-index.test.ts` import Tales' schemas
  instead of defining their own.

#### 2. What is missing now

- Five test files each define their own made-up system, `tales`, with
  `systemListsOf({ ... })`, measured with `grep -c "systemListsOf({"`: `system.test.ts` 2,
  `character.test.ts` 2, `pack.test.ts` 1, `migration.test.ts` 1, `content-index.test.ts` 1.
  One of the two in `system.test.ts` and in `character.test.ts` is a second system, `deep`,
  made on purpose to differ.
- The five `tales` definitions do not agree:

  | File | Proficiency categories | Levels | Recovery events | Module kinds and types |
  |---|---|---|---|---|
  | `system.test.ts` | `lore`, `craft` | 1, 2, 3 | `scene`, `session` | `boon` with `uses`; `talent`, `calling` |
  | `pack.test.ts` | `lore`, `skill` | 1, 2 | `scene` | `boon` without `uses`; `talent` |
  | `character.test.ts` | `lore` | 1, 2 | `scene` | `talent`; module part `lanternOil`, `path` |
  | `migration.test.ts` | `lore` (one edition) | 1 | `scene` | none |
  | `content-index.test.ts` | `lore` | 1 | `scene` | none |

- No made-up character exists whose numbers are known. `compute()` (ENG-11 onward) has nothing
  to be tested on: no stat with its own modifier formula, no skill tied to a stat, no resource
  with a maximum, no unmade choice, no missing reference, each with a value worked out by hand.
- `pnpm test`: `Test Files 19 passed (19)`, `Tests 189 passed (189)`.

#### 3. What it should look like when done

1. `packages/schema/test/tales/index.ts` exports Tales. Schema tests import it as
   `./tales/index.ts`; engine tests as `../../schema/test/tales/index.ts`.
2. **Tales' lists:** editions `first-age`, `second-age`; proficiency categories `knack` (skills),
   `lore`, `craft`; proficiency levels 1, 2, 3; recovery events `scene`, `session`. Its own grant
   kind `boon` (`boon`: an entity id; `uses`, optional). Its own entity types `talent` (`tier`
   1–3) and `calling` (`key`, `die`). Its part of a character: `level` 1–5, `calling` (an entity
   id), `talents` (entity ids taken outside a calling's grants). System id `tales`, module
   version 1.
3. **Tales' rules** (`TALES_RULES` holds the numbers, the comment above it the words):
   - a stat's modifier is `floor(@score / 2)`, unless the stat has its own `modFormula`;
   - a stat's maximum is 10, unless the stat has its own `defaultMax`; a score above its maximum
     counts as the maximum;
   - a skill's knack level is the highest level its `knack` grants give (no `level` means 1;
     none means 0);
   - a skill's total is its stat's modifier + 2 × its knack level + `skills.<key>.bonus` +
     `skills.all.bonus`;
   - a skill with `passive: true` has a passive value of 5 + its total;
   - a boon gives nothing until it is called on, which is an action of a later phase.
   Stat scores, effects, toggles, overrides, grants, choices, missing references and
   prerequisites follow the core's rules (SPEC §6.1, §8.2).
4. **The pack `tales-core`** (`ruleset` `any`) holds: stats `grit`, `wits` and `nerve` (`nerve`:
   `modFormula` `@score - 3`, `defaultMax` 8, `hasSave` false); skills `climb` twice, one per
   edition (`first-age` on `grit`, `second-age` on `wits`: ADR 014 item 2), `sneak` (`wits`) and
   `steady` (`nerve`, passive); conditions `weary` (levels to 3; `skills.all.bonus` −level) and
   `lost`; callings `warden` and `seeker` (`second-age`); talents `night-warden`, `quick-step`,
   `deep-lungs` and `iron-will` (`second-age`). Between them: every core grant kind and the
   module's `boon`; a grant at a level; a choice from a list and one by type and tag; a talent
   that grants a talent; a toggle; an effect whose value is a formula; two resources and their
   recovery; three prerequisite kinds.
5. **Ash** (`first-age`, level 2, a warden) has made every choice, is `weary` at level 1, and
   has used 1 luck. **Brook** (`second-age`, level 3, a seeker) has left the `knacks` choice unmade,
   has a talent of the character's own (`character:talent/lucky-charm`) with its toggle on, a
   talent with two prerequisites the character does not meet, a talent id no pack has
   (`tales-core:talent/gone-missing`), a `nerve` above its maximum, and an override.
6. **The expected values,** worked out by hand from items 3–5, `tales/expected.ts`:

   | Path | Ash | Brook |
   |---|---|---|
   | `level` | 2 | 3 |
   | `abilities.grit.score` / `.mod` / `.max` | 7 / 3 / 10 | 6 / 3 / 10 |
   | `abilities.wits.score` / `.mod` / `.max` | 5 / 2 / 10 | 8 / 4 / 10 |
   | `abilities.nerve.score` / `.mod` / `.max` | 4 / 1 / 8 | 8 / 5 / 8 |
   | `skills.climb.prof` / `.total` | 1 / 6 | 0 / 4 |
   | `skills.sneak.prof` / `.total` | 1 / 4 | 0 / 9 (the override; 4 without it) |
   | `skills.steady.prof` / `.total` / `.passive` | 0 / 0 / 5 | 0 / 7 / 12 |
   | `resources.<key>.max` | `luck` 2 | `focus` 6 |

   With them: the entities each character has, its unmade choices (Brook:
   `tales-core:calling/seeker#knacks`), its missing ids (Brook:
   `tales-core:talent/gone-missing`) and the entities whose prerequisites it does not meet
   (Brook: `tales-core:talent/iron-will`). They are test data, not goldens (BACKLOG, ENG-27).
7. `tales-core` opens through `openTalesPack`, and both characters through `openTalesCharacter`,
   each to an equal object, `from` `{ schemaVersion: 1, systemSchemaVersion: 1 }`.
   `loadContentIndex('tales', [talesCore])` loads it with no refusal and no warning.
8. Every id a character names (its calling, its talents, its conditions, the ids in its choices,
   the entity of each choice and toggle key) is in the index or in its own entities, except
   exactly its expected missing ids. Every entity in its expected list is found too.
9. The expected values agree with the data: each stat and each skill of the character's edition
   has its paths, and no path names anything else; each modifier is the stat's formula (or
   Tales' default) evaluated with `evaluateNumber` on the expected score; each maximum is the
   stat's `defaultMax` or 10, and each score is at most it; each resource maximum is its grant's
   `uses.max` evaluated on the expected values; each passive value is 5 + the total; each
   override's value is the expected value at its path.
10. The five test files of §2 import Tales' lists and schemas; only `deep`, and the schemas a test
    builds to show a change (a module at version 2), stay local. Their tests keep their meaning;
    where a test's data names `lanternOil` or `path`, it names Tales' `level`, `calling` and
    `talents` instead.
11. The quality gate is green.

#### 4. How to do it

1. `tales/system.ts`: the lists, `boonGrantSchema`, `tales`, `talentSchema`, `callingSchema`,
   `talesEntitySchema`, `talesDataSchema`, `talesPackSchema`, `talesCharacterSchema`,
   `openTalesPack`, `openTalesCharacter`, `TALES_RULES`.
2. `tales/content.ts`, `tales/characters.ts`: plain objects as a file would hold them, each
   checked against the schema's input type with `satisfies`.
3. `tales/expected.ts`: `TalesExpected` and one entry per character, each value with its sum.
4. `packages/engine/test/test-system.test.ts`: §3 items 7–9.
5. The five test files: their `tales` definitions replaced by imports; data that the shared
   lists or module part change, changed to match.

Technical choices (ADR 002):
- **The data lives in `packages/schema/test/tales/`.** It needs only `@grimoire/schema`, and
  engine tests can reach it in the direction dependencies already point (engine → schema).
  A workspace package would make a cycle: `schema`'s tests would need it, and it needs `schema`.
  It is test data: no package exports it, so no build can ship it.
- **TypeScript objects, not JSON files.** `satisfies` checks the shape while typing it; the test
  still opens each one through its opener, as a file would be.
- **Expected values as computed paths to numbers.** The paths are SPEC §5.4's catalogue
  (`abilities.<key>.score`, `skills.<key>.prof`, `resources.<key>.max`) plus `.mod`, `.total`
  and `.passive`. `Computed`'s shape is ENG-11's; a flat list of paths fits any shape.
- **A formula check, not a computation.** Item 9 evaluates one stored formula on hand-written
  inputs, to catch a sum written wrong; it never produces an expected value.
- **The words of Tales' rules sit with its numbers,** in `system.ts`. They are the source the
  hand sums in `expected.ts` cite.

#### 5. Stored data

Nothing stored changes. Test data only: no schema in `src`, no `schemaVersion`, no Dexie table.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/test-system.test.ts` — `describe('ENG-27 made-up test system')`: §3
  items 7–9.
- The five test files of §2 — their own tests, unchanged in what they check.
- Control numbers from: Tales' rules (§3 item 3), applied by hand to the data of items 4–5.

#### 8. Checked against the source

Nothing to check. Tales is invented (ADR 004 item 4); no rule of a real game is used, and its
words are its own. The core's order of work (base scores, then derived values, then overrides)
is SPEC §6.1's.

#### 9. Not in this ticket

- `compute()` and anything that computes a value: ENG-11, ENG-12, ENG-28, ENG-29, ENG-17.
- Tales' derived-value steps as module code: ENG-28 (BACKLOG note).
- The shape of `Computed`, its breakdown and its warnings: ENG-11 onward.
- A formula cycle in the data: ENG-18 adds its own.
- Tracker actions on Ash's `luck`: ENG-30.
- The rule that the core cannot import a module: ENG-31.

#### 10. Rake check

- **Licensing.** Tales is invented; no SRD or book text, names or numbers.
- **The golden tests are the truth.** Tales' values are test data, not goldens; none is changed.
- **Measure, never estimate.** The expected values are worked out by hand from written rules,
  and item 9 checks each formula-made one with the engine's own evaluator.
- **Everything is data; the core names no game.** Tales lives in tests only; no core file in
  `src` changes.
- **Missing is not broken.** Brook carries a missing id, an unmade choice and unmet
  prerequisites, so later tickets must handle them as warnings.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
- Built as §3 says. `pnpm test`: `Test Files 20 passed (20)`, `Tests 198 passed (198)`, 3.49 s
  (was 19 files, 189 tests). `pnpm lint`: 92 files, no error, no warning. `pnpm typecheck`: every
  project `Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- `test-system.test.ts` holds 9 tests: the openers and the content index (1), then four per
  character (ids found, choices and prerequisites, the set of paths, the formula check).
- The checks can fail, measured by changing three expected values on purpose and restoring them:
  Ash's `abilities.grit.mod` 3 → 4 failed with `grit: expected { value: 3, … } to deeply equal
  { value: 4, … }`; Brook's `resources.focus.max` 6 → 5 and `skills.steady.passive` 12 → 11
  failed with `steady: expected 11 to be 12`. 2 of 9 tests failed; restored, 9 of 9 passed.
- `grep -c "systemListsOf({"` now finds 1 in `character.test.ts` and 1 in `system.test.ts` (each
  file's `deep`, the second system made on purpose) and 1 in `tales/system.ts`.
- Differences from the old local systems, each test's meaning kept:
  - `system.test.ts`: the JSON Schema and type tests name `knack` among the categories.
  - `pack.test.ts`, `migration.test.ts`, `content-index.test.ts`: imports only; their data parses
    unchanged against the wider lists.
  - `character.test.ts`: the module part is Tales' `level`, `calling`, `talents`. The refused
    module part is `level: 6` (was `path: 'noon'`); the version 2 step renames `level` to `rank`
    (was `lanternOil` to `oil`); local entity types include `calling`.
- Conditions get a `key` in Tales' data, so `-@conditions.weary.level` can read one. A condition's
  `key` is optional in the core's schema (ENG-03, from the entity base).

Found, not fixed:
- A formula reads a condition by its key (`@conditions.weary.level`; SPEC §5.6 has
  `@conditions.exhaustion.level`), but `ConditionDef` leaves `key` optional, so a condition
  without one cannot be read by any formula. Noted on ENG-11 in `BACKLOG.md`: it builds the
  paths and decides what such a condition gives.

Nothing for the changelog.

---

### ENG-11 Gathering a character's entities

**Hat:** `compute()` gathers every entity a character has, grants included
**Depends on:** ENG-06 (the character's core part), ENG-24 (a module's grant kinds), ENG-25
(`loadContentIndex`, `withKey`), ENG-27 (Tales, Ash and Brook)
**Size:** M
**Screen:** No
**SPEC:** §6.1 steps 1, 2 and 8; §5.5 (grants, choices); §8.2 (missing is not broken); ADR 004
items 1–2; ADR 005 item 3.3; ADR 014 item 2

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/gather.ts` — new: SPEC §6.1 steps 1 and 2. The entities a
character has, its grants with their choices, its proficiencies and resources, its unmade
choices, the entry each key names, its conditions' levels, and the warnings.
- `packages/engine/src/compute.ts` — new: `SystemModule` (what the core asks of a system's
  module), `compute()` and `Computed`.
- `packages/engine/src/index.ts` — changes: exports the two files.
- `packages/engine/src/content-index.ts` — changes: exports `ANY_RULESET` and `shareRuleset`,
  which gathering uses too.
- `packages/engine/test/tales-module.ts` — new: Tales' module, as far as gathering needs it.
- `packages/engine/test/compute.test.ts` — new: `describe('ENG-11 …')`.

#### 2. What is missing now

- No `compute()`: `grep -rn "compute\|pendingChoices\|SystemModule" packages/engine/src` finds
  only the comment in `index.ts` and the word "computed" in `roll.ts` and `formula.ts`.
- Nothing reads `localEntities`: `grep -rn "localEntities" packages/engine/src` finds nothing.
- The core cannot read a character's species, classes or feats: they are in the module's
  `systemData` (ENG-06 §11). Tales' calling and talents are there too.
- An entity whose grants hold a module's kind is not assignable to the open `EntityBase` type:
  `TS2322` for Tales' `boon` (ENG-24 §11).
- `conditions` is a list of ids and levels in the character's trackers. A formula reads
  `@conditions.weary.level` (ENG-27), and nothing gives that path a value. A condition's `key` is
  optional (ENG-03).
- `pnpm test`: `Test Files 20 passed (20)`, `Tests 198 passed (198)`.

#### 3. What it should look like when done

1. `compute(character, index, system)` exists in `@grimoire/engine`. It is pure: frozen inputs
   are not changed, and two calls give equal results. `system` is a `SystemModule` with two
   functions: `level(character)`, the level a grant's `atLevel` is measured against, and
   `entities(character)`, the ids its part of the character names, each with its own level
   when its grants count one (a class's).
2. **What the character has** (`entities`), in this order: each id the module names, then each
   condition in the trackers; after each entity, the entities its grants give, depth first. An
   entity is gathered once, with every place that gave it (`from`: `character` or
   `<entityId>#<grantId>`) and the level its grants are measured at (its root's). A grant
   applies when it has no `atLevel` or its `atLevel` is at most that level.
3. **Lookup:** the character's own entities (`localEntities`) first, then the index. An id found
   in neither gives a `missing` warning naming where it was given, and is skipped.
4. **Grants** (`grants`): every grant that applies, of every kind, a module's included, with its
   `part` and the items chosen for it. `entity` grants give their `fixed` and chosen ids.
   `proficiency` grants give one row per key, fixed and chosen (`proficiencies`). `resource`
   grants give one row each (`resources`). Other kinds (`abilityScore`, a module's own) only
   pass through: their meaning is a later ticket's.
5. **Choices.** A grant with `choose`, or an `abilityScore` grant with `mode: 'distribute'`, is a
   choice. Its items are `choices["<entityId>#<grantId>"]`.
   - None stored, or fewer than `count`: it is in `pendingChoices`, with the items chosen so far
     and its options.
   - More than `count`: the first `count` are used, with a `tooManyChosen` warning.
   - An item not in the list, or one the filter does not find: used, with a `notAnOption`
     warning. Never a block.
   - Options: a list gives its items; a filter gives the entries it finds among those the
     character can use (item 7), each matching every field it names (`type`, a tag in `tags`,
     `category`). A `proficiency` choice takes their keys; any other kind takes their ids.
     Entities the character has, and items already chosen, are not offered.
   - Fewer options than the items still needed: a `fewOptions` warning.
6. **Another edition:** a gathered entity whose `ruleset` is neither `any` nor the character's
   gives an `otherRuleset` warning, with `mixingAllowed` from `allowMixedRulesets`. It is still
   gathered (ADR 005 item 3.3).
7. **Which entry a key names** (`byKey[type][key]`, ADR 014 item 2). The candidates are the
   entries the character can use (its `ruleset`'s and `any`; also the other editions' when
   `allowMixedRulesets` is on) and the entities it has. The pick: one it has in its rules base,
   else one it has, else the rules base's, else the first. Packs come first in load order, own
   entities after. An own entity that repeats a type and key of an earlier entry in one
   ruleset gives a `repeatedKey` warning, as ENG-25 does between packs.
8. **Conditions** (`conditions[key].level`): every key in `byKey.condition`, so a formula can
   read `@conditions.<key>.level`. A condition the character does not have reads 0. One it has
   reads its stored `level`, or 1 without one; above its `maxLevel` (1 when it has none) it
   reads `maxLevel`, with a `conditionLevel` warning. **A condition without a key has no path:**
   it is still gathered, and its effects will apply, but no formula can read it.
9. **Tales** (ENG-27's expected values, written by hand):
   - Ash: entities warden, night-warden, quick-step, weary; no pending choice; no warning.
     Proficiencies `knack` `climb` (warden#climber), `knack` `sneak` (warden#pick-knack),
     `lore` `stars` at level 2 (night-warden#stars). Resource `luck` (warden#luck).
     `byKey.skill.climb` is `tales-core:skill/climb`. Conditions `weary` 1, `lost` 0.
   - Brook: entities seeker, lucky-charm, iron-will, lost; pending `seeker#knacks` with options
     `climb`, `sneak`, `steady`; one warning, `missing` `tales-core:talent/gone-missing` from
     `character`. Resource `focus`; the `boon` grant passes through, and `deep-lungs` is not
     gathered. `byKey.skill.climb` is `tales-core:skill/climb-anew`. Conditions `weary` 0,
     `lost` 1.
10. A module's grant kind keeps its type through `compute()`: `Computed<TalesEntity>`'s grant is
    Tales' grant union, `boon` included (the `TS2322` of §2 is gone).
11. The quality gate is green.

#### 4. How to do it

1. `gather.ts`:
   - The structural views the core reads: `GatherableEntity` (`IndexedEntity` with `tags` and
     `grants`), `GrantView` (`id`, `kind`, `atLevel`, `choose`), `CharacterCore`.
   - `isCoreKind(grant, kind)`: reads a core kind's own fields through the core's `Grant` type.
   - `gather(character, index, level, named)`: the lookup of item 3; a depth-first walk with an
     explicit stack; then the options of pending choices, `byKey`, `conditions`.
2. `compute.ts`: `SystemModule`, `Computed` (the gathered result, for now), `compute()`.
3. `tales-module.ts`: `level` is `systemData.level`; `entities` are the calling, then the talents.
4. `compute.test.ts`: §3 items 1–10, on Ash and Brook and on variants of them opened through
   `openTalesCharacter`.

Technical choices (ADR 002):
- **The core reads entities through structural views.** `GrantView` names only what every grant
  has. Any system's grant union is assignable to it, so a module kind passes through with its
  own type. A core kind is read through the core's `Grant` type; ENG-24 refuses a module kind
  that takes a core kind's name, so the kind's name decides its shape.
- **A module's `choose` has the core's shape.** ENG-32's kinds build it from
  `chooseEntitiesSchema`. The core reports such a choice as pending, but does not decide what
  its items give.
- **The module names the entities, the core walks them.** ENG-06 put species, classes and feats
  in `systemData`; `SystemModule.entities` is the one door to them. Conditions are core trackers,
  so the core names them itself.
- **An entity is gathered once.** Its grants apply once, at the level of the first path that
  reaches it. A loop of grants (A gives B, B gives A) ends there, with no warning.
- **An explicit stack, not recursion.** A long chain of grants in a stranger's pack cannot
  exhaust the call stack.
- **Options are looked up only for a pending choice.** A listed id that is not found then gives
  `missing`; a made choice's options are never looked up.
- **A condition without a key has no path.** Taking a slug as its key would work for some slugs
  only (`gone-missing` is not a path step) and could collide with a real key. Making `key`
  required would refuse stored packs. A formula naming such a condition reads a missing path:
  0, with ENG-07's warning.
- **One `otherRuleset` warning, mixing on or off.** It carries `mixingAllowed`, so the sheet can
  show a mix the person turned on differently from one they did not.
- **`Computed` is the gathered result for now.** ENG-12 onward add values and their breakdown.

#### 5. Stored data

Nothing stored changes. `compute()` reads a character and packs; no schema, no
`schemaVersion`, no Dexie table changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/compute.test.ts` — `describe('ENG-11 gathering a character's entities')`:
  §3 items 1–10.
- Control values from: ENG-27's `tales/expected.ts` (entities, pending choices, missing ids), and
  Tales' data (`tales/content.ts`, `tales/characters.ts`) read by hand for the rest.

#### 8. Checked against the source

Nothing to check. No rule of a real game is used: the order of work is SPEC §6.1's, choices are
SPEC §5.5's, warnings are SPEC §8.2's, and the test data is the made-up Tales.

#### 9. Not in this ticket

- Effects and toggles of the gathered entities (SPEC §6.1 step 3): ENG-12 (scores), ENG-17
  (derived values, toggles, overrides). A toggle whose effect is gone (ENG-06 §9): ENG-17.
- What an `abilityScore` grant and its chosen items give: ENG-12.
- What a module's grant kind gives (Tales' `boon`, fifth edition's `spell` and `item`): its
  module.
- Values, the breakdown, the formula reader: ENG-12 onward. `level` as a path: ENG-28.
- A resource's maximum, and two grants giving one resource key: ENG-29.
- Checking prerequisites against a character (Tales' `unmetPrerequisites`): the phase 2 or 4 row
  in `BACKLOG.md`.
- A choice stored for a grant the character no longer reaches: kept and not used, no warning.

#### 10. Rake check

- **Missing is not broken.** A missing id, an unmade choice, an item not offered, too many items,
  another edition: each is a warning or a pending choice; nothing throws, nothing is blocked.
- **The core names no game.** No type, kind, category, edition or key of any game is written in
  the code; the module supplies what its part names. Tests use the made-up Tales.
- **`compute()` is pure and deterministic.** It reads its arguments and returns a new object; a
  test freezes the inputs and compares two runs.
- **Each system's rules live in its own module.** No `if (system === …)` or `if (ruleset === …)`:
  the character's ruleset is compared only with an entry's, as data.
- **Ids are stable.** Entries are found by id, and by key only for paths.
- **`packages/engine` is pure TypeScript.** The new files import only `@grimoire/schema` and
  each other.
- **Licensing.** Test data is made up; no SRD or book text.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `compute.test.ts` alone: `Tests 16 passed (16)`, 640 ms.
- Lint: `Checked 96 files`, no fixes, no error (92 before; 4 new files).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 21 passed (21)`, `Tests 214 passed (214)`, 3.41 s (before: 20 files,
  198 tests, 3.10 s).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- Line coverage is not measured: no coverage provider is installed. ENG-23 measures the phase's.
- The tests bite. Each guard removed on its own, the 16 tests run each time: `atLevel`, 1 fails;
  own entities looked up, 6; every place that gave an entity, 1; `otherRuleset`, 2; only the first
  `count` items used, 1; `tooManyChosen`, 1; `notAnOption`, 2; `fewOptions`, 1; had entities not
  offered, 1; chosen items not offered, 1; rulesets in filters, 2; had first in `byKey`, 1; the
  rules base in `byKey`, 1; a condition's maximum, 1; a level of 1 when none is stored, 1; a
  condition not had reads 0, 2; `repeatedKey` for own entities, 1; the same type in it, 1;
  `missing` for a pending list's id, 1; a module kind's items not gathered, 6; a filter's
  `category`, 2; its tag, 2; depth-first order, 3; a missing chosen id dropped, 1; a
  distribution pending, 1; a proficiency's `level` kept, 1. An input changed in place: the frozen
  test fails, 1. `ReachedGrant.grant` typed as `GrantView`: `pnpm typecheck` fails with `TS2344`
  on the `expectTypeOf` line.
- One guard did not bite at first: no test had an `abilityScore` grant with `mode:
  'distribute'`, since Tales has none. A test with a character's own calling holding one was
  added; with it, the guard's removal fails 1 test.

Differences from §3: none.

Against the row and the SPEC:
- SPEC §6.1 writes `compute(character, contentIndex, ruleset)`. The third argument is the
  system's module (ADR 004 item 1); the ruleset is the character's own (`ruleset`, ADR 005
  item 3.2).
- Each point of the row's note is done: another edition warns (§3 item 6); the `TS2322` is gone
  (item 10); the module names its part's entities (item 1); own entities join the index (item 3);
  a key names the entry the character has, else the rules base's (item 7); a filter with too few
  entries warns (item 5); conditions have paths, and a keyless condition has a rule (item 8).

Found, not fixed:
- A stat distribution's stored items reach `compute()` unchecked, in `grants[].chosen`; it is
  pending only while nothing is stored. Noted on ENG-12 in `BACKLOG.md`.
- `resources` lists every `resource` grant; two grants may give one key. Noted on ENG-29.
- `SystemModule` has the two functions gathering needs; ENG-28's steps join it. Tales' module is
  `packages/engine/test/tales-module.ts`. Noted on ENG-28.
- A module kind's `choose` must have the core's shape to be typed (`GrantView`). `compute()`
  reports it pending and passes its items through. Noted on ENG-32.
- Tales' `unmetPrerequisites` (ENG-27) wait for the row that checks prerequisites. Added to the
  phases 2 and 4 note.

Nothing for the changelog.

---

### ENG-12 Stat scores in the base phase

**Hat:** Stat scores are computed in the base phase
**Depends on:** ENG-07 (`parseFormula`, `paths`), ENG-11 (`compute()`, `gather`, `byKey`), ENG-27
(Tales, Ash and Brook)
**Size:** S
**Screen:** No
**SPEC:** §6.1 steps 3 and 4; §5.4 (effects, the targets `abilities.<key>.score` and `.max`);
§5.5 (`abilityScore` grants); §5.6 (the base-phase rule); §6.2 (breakdown); Appendix Д (the cap
comes from `defaultMax`)

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/stats.ts` — new: SPEC §6.1 step 4. Each stat's score and
maximum, their breakdown, and what the base phase met.
- `packages/engine/src/effects.ts` — new: SPEC §6.1 step 3. The effects of the entities a
  character has that are switched on; the phase an effect applies in; a target that names a
  stat's score or maximum.
- `packages/engine/src/compute.ts` — changes: `SystemModule` gains `statDefaults` and
  `basePath`; `Computed` gains `values` and `breakdown`; `compute()` runs the base phase.
- `packages/engine/src/gather.ts` — changes: a stored stat distribution is checked against its
  patterns; the views read effects, base scores and toggles; `isCoreKind` and `patternOf` are
  exported.
- `packages/engine/src/index.ts` — changes: exports the two new files.
- `packages/engine/test/tales-module.ts` — changes: Tales' default maximum.
- `packages/engine/test/stats.test.ts` — new: `describe('ENG-12 …')`.
- `packages/engine/test/compute.test.ts` — changes: its two made-up modules and its made-up
  character gain the new fields.

#### 2. What is missing now

- Nothing computes a score: `grep -rn "abilities\|toggles\|effects\|patterns"
  packages/engine/src` finds one line, the comment at the top of `index.ts`.
- `Computed` is `Gathered`: no value, no breakdown (ENG-11 §4).
- A stat distribution's stored items reach `compute()` unchecked, in `grants[].chosen`; it is
  pending only while nothing is stored (ENG-11 §11).
- SPEC §5.6's base-phase rule is checked nowhere (ENG-07 §11).
- `SystemModule` has `level` and `entities` only: no default maximum for a stat, and no way to
  say which paths a base formula may read.
- `pnpm test`: `Test Files 21 passed (21)`, `Tests 214 passed (214)`.

#### 3. What it should look like when done

1. `compute()` gives `values` (computed path → value) and `breakdown` (computed path → its
   steps) for each stat the character has: `abilities.<key>.score` and `abilities.<key>.max`.
   Its stats are the `ability` entries `byKey` names (ENG-11): a pack's and its own, alike.
2. **Score:** the stored base (`abilities.base[key]`), plus each increase an `abilityScore` grant
   gives, in the grants' order, then the base-phase effects on `abilities.<key>.score` in order of
   priority; then at most its maximum.
3. **Maximum:** the stat's own `defaultMax`, else `SystemModule.statDefaults.defaultMax`; then the
   base-phase effects on `abilities.<key>.max` in order of priority.
4. **Grants.** `mode: 'fixed'` gives each of its values. `mode: 'distribute'` uses its first
   pattern with as many numbers as the items stored, and gives the i-th item the i-th number:
   patterns `[[2, 1], [1, 1, 1]]`, items `['wits', 'grit']` give wits +2, grit +1.
   - More items than its longest pattern: the first that many are used, with `tooManyChosen`.
   - An item not in `from`: used, with `notAnOption`.
   - No pattern with as many numbers: it stays pending, with the items so far and the rest of
     `from` as options, and gives nothing.
5. **Effects.** Every effect of every entity the character has; its place is
   `<entityId>#<effectId>`. One applies in the base phase when its toggle is on (the stored value,
   else the toggle's default), it is not `situational`, its phase is `base` (its own, or by
   default for a target that is a stat's score or maximum), and its `when` is true. `mul`, `add`,
   `min`, `max` and a `set` with a number apply, by default in that order (priorities 10, 20, 30,
   40, 50); an effect's own `priority` places it among them; equal priorities keep the gathering
   order.
6. **The base-phase rule** (SPEC §5.6). Every path the text of a `when` or a `value` names (the
   parsed formula's `paths`, taken or not) must be `level` or a path the module's `basePath`
   answers. Otherwise the effect is not applied, with `notInBasePhase` and those paths:
   `@level > 9 ? @skills.climb.total : 1` is refused for `skills.climb.total`.
7. **Formulas.** A formula that does not parse: the effect is not applied, with a `formula`
   warning that carries the parse error. A formula's other warnings are passed on as `formula`
   warnings, and its value is used (`1 / 0` gives 0).
8. **Warnings**, never a block: `noBaseScore` (a stat with no stored base: 0 is used); `noStat`
   (a base score, a grant's value or an effect names a key that is not one of the character's
   stats: not used); `notANumber` (`set` with a yes/no or a text, `append`, `advantage`,
   `disadvantage`, `note` on a stat's score or maximum: not applied).
9. **Breakdown** (SPEC §6.2). A score's steps: `base`, each `grant` (its part, source and
   source's name), each `effect` (its part, source, label — its own, else its entity's name — op
   and value), and `cap` when the maximum lowers it. A maximum's: `default` (of `stat` or
   `system`), then its effects. Each step has `value` and `change`; a path's changes sum to its
   value.
10. **Tales** (ENG-27's expected values): Ash grit 7 / 10, wits 5 / 10, nerve 4 / 8, no warning;
    Brook grit 6 / 10 (the `charm` toggle on), wits 8 / 10, nerve 8 / 8 (base 9, capped), and only
    the `missing` warning ENG-11 gives.
11. Not applied by the base phase, and not warned: a base-phase effect on another target, and an
    effect on a stat's score or maximum whose own phase is `derived` or `final` (§9: ENG-17).
12. The quality gate is green.

#### 4. How to do it

1. `effects.ts`: `statTargetOf`, `phaseOf`, `activeEffects`.
2. `stats.ts`: `computeStats(character, gathered, base)`: the stats from `byKey`; the base scores;
   the grants' increases; the effects, each checked and evaluated in gathering order; then per
   stat its maximum, its score and the cap.
3. `gather.ts`: a distribution's stored items through `tooManyChosen` and `notAnOption`; pending
   while `patternOf` finds no pattern; its options without the items chosen.
4. `compute.ts`: `statDefaults`, `basePath`, `values`, `breakdown`, `ComputeWarning`.
5. `tales-module.ts`: `statDefaults: { defaultMax: TALES_RULES.statMax }`.
6. The tests of §7.

Technical choices (ADR 002):
- **Values are a flat map of computed paths.** The same paths effects target (SPEC §5.4),
  formulas read (§5.6) and overrides name (§5.8). ENG-28 and ENG-17 add theirs to it; the
  reader of a later phase is `values[path]`.
- **The order of ops is Foundry's mode order.** SPEC §6.1 step 4 puts additions before
  `set/max/min` and does not place `mul`. SPEC §5.4 maps `mul`, `add`, `min`, `max`, `set` to
  Foundry's multiply, add, downgrade, upgrade, override, whose mode numbers are 1 to 5 in that
  order (§8). The default priority is 10 × that number, so an effect's own `priority` can fall
  between two.
- **Increases come before effects:** they are the score's source value, as the base is.
- **The cap comes last**, as SPEC §6.1 step 4 orders and Appendix Д says ("the cap of 20 comes
  from `defaultMax`"). An effect that should go above the maximum raises the maximum too (§11).
- **A distribution's pattern is picked by its count of items.** A choice is a list of keys, none
  twice (ENG-06), so it cannot hold a number; the order of its items places the numbers.
- **The base-phase rule reads `paths`, not `reads`** (ENG-07's reason: a branch not taken today
  is taken tomorrow). The core allows `level`; SPEC §5.6's class levels and choices are a
  system's, so the module answers the rest through `basePath`, and `undefined` refuses a path.
- **Only the maximum of a stat's defaults comes now.** The cap needs it. SPEC §5.3's modifier
  formula and save stay with ENG-28 and join `statDefaults` there.
- **A formula that does not parse is not applied.** Its 0 would set or lower a score.
- **A situational effect never changes a number.** SPEC §5.4: it is shown in the roll dialog.
- **Effects are collected in their own file** (SPEC §6.1 step 3), so ENG-17 reuses them.

#### 5. Stored data

Nothing stored changes. `compute()` now reads `abilities.base` and `state.toggles`, which
ENG-06's character schema already has; no schema, no `schemaVersion`, no Dexie table changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/stats.test.ts` — `describe('ENG-12 stat scores in the base phase')`:
  Ash's and Brook's stats; Brook's breakdown; toggles and their default; a distribution made,
  pending, too long, with an item not offered; the order of ops and a priority; the cap and an
  effect on the maximum; `when` and `@level`; the base-phase rule with and without a module's
  `basePath`; formula warnings; `noBaseScore`, `noStat`, `notANumber`, situational and other
  phases; a character's own stat with its own maximum. Every result's breakdown is checked to
  add up to its value.
- `packages/engine/test/compute.test.ts` — ENG-11's tests, their modules given `statDefaults`.
- Control values from: ENG-27's `tales/expected.ts` for Ash and Brook; Tales' rules and data, and
  each variant's data, worked out by hand and checked with `python3`, not by the new code.

#### 8. Checked against the source

No rule of a real game is used: Tales is made up, and the steps are SPEC §6.1's.

One fact from outside, for the order of ops (§4): Foundry's effect modes, read in
`@league-of-foundry-developers/foundry-vtt-types` 13.346.0-beta.20250812191140,
`src/foundry/common/constants.d.mts`, `ACTIVE_EFFECT_MODES`: `CUSTOM` 0, `MULTIPLY` 1, `ADD` 2,
`DOWNGRADE` 3, `UPGRADE` 4, `OVERRIDE` 5. The default priority Foundry gives a change is in its
client code, which is not published; it is not relied on.

#### 9. Not in this ticket

- A stat's modifier, its save, SPEC §5.3's default modifier formula, `level` as a value: ENG-28.
- Effects in the derived and final phases, overrides, a toggle whose effect is gone; a
  base-phase effect on a target that is not a stat's score or maximum; an effect on a stat
  whose own phase is `derived` or `final`: ENG-17.
- A formula cycle: ENG-18. The base-phase rule keeps the base phase free of them.
- What a situational effect shows in the roll dialog: ENG-34 and phase 2.
- Fifth edition's class levels as base paths: its module's `basePath`, with ENG-33's classes.
- Which ability bonus source a mixed character uses (ADR 014 item 1): ENG-35.

#### 10. Rake check

- **The core names no game.** The core names its own `ability` type and the `abilities.` paths
  of SPEC §5.4; the maximum, the base paths and the stats are the module's and the packs'.
  Tests use the made-up Tales.
- **Everything is data.** A character's own stat is computed as a pack's (§7); no stat key is in
  the code.
- **Formulas never run code.** Every formula goes through ENG-07's parser and walker.
- **The base-phase rule** is checked against every path a formula names.
- **Missing is not broken.** A missing base, an unknown stat, a formula that does not parse, an
  effect that gives no number: each is a warning; nothing throws.
- **`compute()` is pure.** ENG-11's frozen-input test now runs the base phase too.
- **A number with no breakdown entry is a bug.** Every value has its steps, and they add up.
- **`packages/engine` is pure TypeScript.** The new files import only `@grimoire/schema` and
  each other.
- **Licensing.** Test data is made up; the Foundry fact is a constant's number, not rules text.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `stats.test.ts` alone: `Tests 14 passed (14)`, 960 ms.
- Lint: `Checked 99 files`, no fixes, no error (96 before; 3 new files).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 22 passed (22)`, `Tests 228 passed (228)`, 3.74 s (before: 21 files,
  214 tests, 3.98 s).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The tests bite. Each guard removed on its own, `stats.test.ts` and `compute.test.ts` run (30
  tests): toggles ignored, 5 fail; a toggle's default, 1; situational applied, 1; the phase, 1;
  `noStat` for an effect, 1; `noBaseScore`, 1; `noStat` for a base, 1; `noStat` for a grant, 2;
  `set` with any value, 1; a formula that does not parse applied, 1; the base-phase check, 1;
  only the first path checked, 1; `when`, 1; formula warnings, 1; an effect's own priority, 1;
  no sort, 1; `add` before `mul`, 1; `max` before `min`, 1; `set` not last, 1; the cap, 3; the
  stat's own maximum, 4; effects on the maximum, 1; grants, 10; always the first pattern, 3;
  pending only when empty, 1; a distribution's `tooManyChosen`, 1; its `notAnOption`, 1; its
  options keeping chosen items, 1; `level` not readable, 2; the module's `basePath` ignored, 1;
  an effect's own label, 1.
- Two guards did not bite at first. An effect's own `label`: no test had one; the cap test's
  `higher` now has one, and the guard's removal fails 1 test. `mod` added to a stat's base-phase
  fields: an effect on `abilities.<key>.mod` is still never applied, so nothing changes; it stays
  untested.

Differences from §3: none.

Against the row and its note:
- The note's two points are done: the base-phase rule is checked against `paths` (§3 item 6), and
  a stored distribution against its patterns (item 4).
- Re-cut: the system's default maximum came here, not with ENG-28, since the cap needs it. ENG-28's
  note in `BACKLOG.md` now says so.
- SPEC §6.1 step 4 names increases "from race, from background, from levels and feats": in the
  core they are all `abilityScore` grants, wherever the module's data puts them.

Found, not fixed:
- The cap comes last (SPEC §6.1 step 4), so an item's mechanics that put a score above a stat's
  maximum must raise the maximum too, or the cap undoes them. SPEC §5.4's catalogue gives a belt
  as `max 21` on the row of both targets. Noted on phase 3 in `BACKLOG.md`: its mechanics' §8
  checks which items do this.
- A distribution's pattern is picked by its count of items, so two patterns of one length with
  different numbers (`[[2, 1], [1, 1]]`) cannot both be chosen; the second is never used. Noted on
  phase 5 in `BACKLOG.md`: the import checks or the editor warn.
- ENG-17 inherits `values`, `breakdown` and `activeEffects`, and the effects ENG-12 leaves (§9).
  Noted on ENG-17 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-28 The module's derived values

**Hat:** `compute()` runs the derived-value steps a system module supplies
**Depends on:** ENG-07 (`evaluateNumber`), ENG-11 (`gather`, `byKey`, `proficiencies`), ENG-12
(`computeStats`, `values`, `breakdown`, `statDefaults`), ENG-27 (Tales, Ash and Brook)
**Size:** S
**Screen:** No
**SPEC:** §6.1 step 5; §5.3 (`modFormula`, `hasSave` and their defaults); §5.6 (`@score`,
`@level`); §6.2 (breakdown); ADR 004 item 1

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/derived.ts` — new: SPEC §6.1 step 5. The character's level
and each stat's modifier, the module's derived values, read from each other path by path, with
their breakdown and what computing them met.
- `packages/engine/src/compute.ts` — changes: `SystemModule` gains the entity type `E` and
  `derive`; `StatDefaults` moves to `derived.ts` and gains `modFormula` and `hasSave`;
  `compute()` runs the derived step after the base phase.
- `packages/engine/src/stats.ts` — changes: `BreakdownStep` gains the kinds `level`, `formula`,
  `path` and `rule`; `STAT_TYPE` is exported.
- `packages/engine/src/index.ts` — changes: exports `derived.ts`.
- `packages/schema/test/tales/system.ts` — changes: `TALES_RULES` gains `hasSave` and
  `knackLevel`, with their words.
- `packages/engine/test/tales-module.ts` — changes: Tales' stat defaults and its derived values.
- `packages/engine/test/derived.test.ts` — new: `describe('ENG-28 …')`.
- `packages/engine/test/stats.test.ts`, `compute.test.ts` — changes: their modules take the new
  fields; ENG-12's first test picks the stats' paths out of `values`, which now holds more.

#### 2. What is missing now

- `compute()` gives Ash 6 paths, measured: `abilities.grit.score`, `abilities.grit.max`,
  `abilities.wits.score`, `abilities.wits.max`, `abilities.nerve.score`, `abilities.nerve.max`.
  No `level`, no modifier, no skill value: ENG-27's expected values have 18 paths for Ash.
- `grep -rn "\.mod\b\|'mod'\|modFormula\|hasSave\|skills\.\|derive" packages/engine/src` finds one
  line, `effects.ts:34`, which only names `statTargetOf`.
- `SystemModule` has `level`, `entities`, `statDefaults.defaultMax` and `basePath`. A module
  cannot give a derived value, and a stat has no default modifier formula or save.
- `level` is read by the base phase (`compute.ts`, `LEVEL_PATH`), but it is not a value
  (BACKLOG, found by ENG-12).
- `pnpm test`: `Test Files 22 passed (22)`, `Tests 228 passed (228)`.

#### 3. What it should look like when done

1. **`level`** is in `values`, the module's `level(character)`, with one breakdown step
   `{ kind: 'level' }`.
2. **Each stat's modifier** `abilities.<key>.mod` is in `values`: the stat's own `modFormula`,
   else `SystemModule.statDefaults.modFormula`, evaluated with `@score` reading the stat's
   computed score. Its breakdown is one step `{ kind: 'formula', formula, of: 'stat' | 'system' }`.
   A formula that does not parse, or meets anything else, gives what `evaluateNumber` gives (0
   for a parse error), with a `modFormula` warning carrying the formula's warning.
3. **A stat's defaults** are `statDefaults` `{ defaultMax, modFormula, hasSave }`. The module's
   steps get each stat the character has as `{ key, entity, hasSave }`, its `hasSave` being its
   own, else the system's.
4. **The module's steps.** `SystemModule.derive({ character, gathered, stats })` gives computed
   path → step. A step gets `read(path)` and returns `{ value, steps }`: the number and its
   breakdown. `compute()` runs every step and puts each path in `values` and `breakdown`.
5. **Path by path.** `read(path)` gives a path's value, computing it first when it is a step's and
   not yet computed, so a step may read any other step's path, in any order. Each path is
   computed once.
6. **Never a crash** (SPEC §8.2):
   - A path nothing gives reads 0, with `missingPath` naming the path and the path that read it.
   - A path read while it is being computed reads 0, with `cycle` naming the path and the path
     that read it (the loop's other paths are ENG-18's, §9).
   - A module step for a path the core gives (`level`, a stat's `score`, `max`, `mod`) is not
     used, with `pathTaken`.
7. **Order of `values`:** `level`; each stat's `score`, `max`, `mod`; then the module's paths in
   its order.
8. **Tales' module** (its rules: `tales/system.ts`):
   - stat defaults: maximum 10, modifier `floor(@score / 2)`, a save unless the stat says
     `hasSave: false`;
   - for each skill `byKey` names: `skills.<key>.prof`, the highest `level` of its `knack`
     grants (none: 1; no grant: 0), with that grant's step; `skills.<key>.bonus` 0;
     `skills.<key>.total`, the stat's modifier + 2 × `prof` + `bonus` + `skills.all.bonus`, a
     `path` step for each; for a skill with `passive: true`, `skills.<key>.passive`, 5 (a `rule`
     step, `passiveBase`) + its total; and `skills.all.bonus` 0.
9. **Tales, worked out by hand** (derived-phase effects and overrides are ENG-17's, so the totals
   below are before them; ENG-27's expected values with them are in brackets):

   | Path | Ash | Brook |
   |---|---|---|
   | `level` | 2 | 3 |
   | `abilities.grit.mod` / `wits` / `nerve` | 3 / 2 / 1 | 3 / 4 / 5 |
   | `skills.climb.prof` / `.total` | 1 / 5 [6] | 0 / 4 [4] |
   | `skills.sneak.prof` / `.total` | 1 / 4 [4] | 0 / 4 [9, the override] |
   | `skills.steady.prof` / `.total` / `.passive` | 0 / 1 [0] / 6 [5] | 0 / 5 [7] / 10 [12] |

   Ash's `level`, mods and `prof`s, and Brook's `level`, mods, `prof`s and climb total, are
   ENG-27's expected values. Neither character gets a warning from this step.
10. Every path's breakdown adds up to its value. `compute()` stays pure: ENG-11's frozen-input
    test runs this step too.
11. The quality gate is green.

#### 4. How to do it

1. `stats.ts`: the four new step kinds; export `STAT_TYPE`.
2. `derived.ts`: `StatDefaults`, `StatOf`, `Derived`, `DerivedStep`, `DeriveInput`,
   `DerivedWarning`; `statsOf(gathered, defaults)`; `computeDerived(...)`: the known values
   (`level`, the base phase's), the core's modifier steps, the module's steps, a memoised
   `valueOf(path, readBy)` with the set of paths in progress; then every path in the order of
   §3 item 7.
3. `compute.ts`: `SystemModule<C, E>` with `derive`; `compute()` calls `computeDerived` and
   joins its warnings.
4. `tales/system.ts`: `TALES_RULES.hasSave` and `.knackLevel`, and their words.
5. `tales-module.ts`: `statDefaults` and `derive`.
6. The tests of §7.

Technical choices (ADR 002):
- **Path by path, not step after step.** A derived value reads others (a total reads a modifier,
  a passive value reads a total), and ENG-17's effects will change inputs such as
  `skills.<key>.bonus` before a total reads them. Computing a path when it is first read gives
  the right order for any module without the module listing one, and the set of paths in
  progress is where ENG-18 finds a loop.
- **The core computes the modifier; the module gives its default.** `modFormula` is a field of
  the core's `ability` type (ENG-03), so every system reads it the same way.
- **`hasSave` is resolved by the core and read by the module.** A save is a system's rule (fifth
  edition's, ENG-13); the core only fills in the default, as it does for the maximum.
- **A step reads numbers.** Every value the core and Tales give is a number, so `read` returns
  one, and a missing path is the core's warning, not each module's.
- **A modifier formula that does not parse gives 0**, as `evaluateNumber` does (ENG-07), with
  the warning. Taking the system's default instead would hide the pack's mistake behind a
  plausible number.
- **A loop reads 0 and warns.** Without the guard, a pack whose two stats read each other's
  modifier would exhaust the call stack. Naming the whole loop is ENG-18's hat.
- **The module declares the paths effects will target** (`skills.<key>.bonus`,
  `skills.all.bonus`) with the value 0, so a total's breakdown names them and ENG-17 has a path
  to change (SPEC §5.4: the target catalogue comes from what the character has).

#### 5. Stored data

Nothing stored changes. `compute()` reads what ENG-12 read; no schema, no `schemaVersion`, no
Dexie table changes. `TALES_RULES` is test data.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/derived.test.ts` — `describe('ENG-28 derived values a system module
  supplies')`: §3 items 1–10 on Ash and Brook and on variants: their values and breakdowns; a
  stat's own formula and the system's; a formula that does not parse; `hasSave`'s default; a
  module step reading another in any order, once each; a missing path; a loop; a taken path.
- `stats.test.ts`, `compute.test.ts` — ENG-11's and ENG-12's tests, unchanged in meaning.
- Control values from: ENG-27's `tales/expected.ts`, and Tales' rules and data worked out by
  hand for the totals before ENG-17's effects (§3 item 9) and for each variant.

#### 8. Checked against the source

Nothing to check. No rule of a real game is used: Tales is made up, and the order of work is
SPEC §6.1's. Fifth edition's defaults (SPEC §5.3: `floor((@score - 10) / 2)`, a save, 20) are
not written here; its module gives them (ENG-13).

#### 9. Not in this ticket

- Derived-phase and final-phase effects, toggles on them, overrides: ENG-17. The totals of §3
  item 9 reach ENG-27's expected values there.
- A formula loop's full message, naming every path of the loop: ENG-18.
- Resource maximums (`resources.<key>.max`): ENG-29.
- Condition levels as values (`conditions.<key>.level`): a formula in this step that reads one
  gets `missingPath` (§11).
- Fifth edition's derived values (proficiency bonus, saves, skills, passives, hit points, armor
  class): ENG-13 to ENG-16, as its module's steps.

#### 10. Rake check

- **The core names no game.** The core names its own `ability` type, the paths `level` and
  `abilities.<key>.mod`, and SPEC §5.6's `@score`. The default formula, the save, the skills'
  paths and Tales' numbers are the module's.
- **Everything is data.** Every stat the character has gets a modifier, a pack's or its own; no
  stat key is written in the code.
- **Formulas never run code.** A modifier formula goes through ENG-07's parser and walker.
- **Missing is not broken.** A missing path, a loop, a formula that does not parse, a taken path:
  each is a warning and a 0 or a path not used; nothing throws.
- **`compute()` is pure.** The steps read the frozen inputs; ENG-11's frozen-input test runs them.
- **A number with no breakdown entry is a bug.** Every new value has its steps, and they add up.
- **Each system's rules live in its own module.** No `if (system === …)`: Tales' rules are in its
  module, in the tests.
- **`packages/engine` is pure TypeScript.** `derived.ts` imports only `@grimoire/schema` and the
  engine's own files.
- **Licensing.** Test data is made up.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `derived.test.ts` alone: `Tests 10 passed (10)`, 911 ms.
- Lint: `Checked 101 files`, no fixes, no error (99 before; 2 new files).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 23 passed (23)`, `Tests 238 passed (238)`, 3.33 s (before: 22 files,
  228 tests, 3.52 s).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- `compute()` now gives Ash 21 paths (was 6): `level`, 3 per stat, `skills.all.bonus`, 3 per
  skill, and steady's passive value.
- The tests bite. Each guard removed or changed on its own, the `derived`, `stats`, `compute` and
  `test-system` tests run (49 tests). In `derived.ts`: a stat's own formula ignored, 6 fail; its
  own `hasSave` ignored, 1; `@score` not read as the stat's score, 26; formula warnings dropped,
  1; no `pathTaken` check, 1; `pathTaken` for the base phase's paths only, 1; results not kept
  (each read computes again), 24; no `missingPath` warning, 1; no `cycle` warning, 1; no loop
  guard (the call stack is exhausted), 1; the module's paths before the core's, 2; `level` with
  an empty breakdown, 24; every formula step `of: 'system'`, 2. In Tales' module: an equal knack
  level takes the last grant, 1; a grant without `level` gives 0, 4; any category counts as a
  knack, 1; every skill passive, 1; a knack step of 1, 3; `skills.all.bonus` not read, 1.
- One mutation was first written wrong (it left the `missingPath` warning in) and passed;
  rewritten, it fails 1 test.

Differences from §3: none.

Against the row and its note:
- Each point of the note is done: `statDefaults` gains `modFormula` and `hasSave` (§3 item 3);
  Tales' derived steps are its module's `derive`, from `TALES_RULES` (item 8); the steps join
  `SystemModule` (item 4); `level` is a value (item 1).
- `TALES_RULES` gains `hasSave` and `knackLevel`. The knack level's default was already a rule in
  words (ENG-27); the save is new: Tales has no rule that gives a save a value, so its default is
  only what the core fills in.
- ENG-12's first test compared all of `values` with the 6 stat paths; it now picks those paths
  out of `values`, which holds 21 for Ash.

Found, not fixed:
- A skill's own `totalFormula` (SPEC §5.3, a core field since ENG-03) is read by no code: a
  module's step computes every total by its own rule. Noted on ENG-13 in `BACKLOG.md`.
- `conditions.<key>.level` is not in `values`: a formula of this step that reads one gets
  `missingPath`. ENG-17's effects are the first to read one (`weary`'s
  `-@conditions.weary.level`). Noted on ENG-17.
- The totals in `derived.test.ts` are before derived effects and overrides (§3 item 9); ENG-17
  makes them ENG-27's, which the test writes beside each one. Noted on ENG-17.
- The `cycle` warning names the path read again and the path that read it; the paths in progress
  are the `computing` set, in the order they began. Noted on ENG-18.

Nothing for the changelog.

---

### ENG-29 Resource maximums · XS

**Hat:** Resource maximums are computed from their formulas
**Where:** `packages/engine/src/derived.ts` — changes: a core step for each resource key the
character has gives `resources.<key>.max`; `compute.ts` — changes: hands `gathered` to
`computeDerived`; `stats.ts` — changes: a `grant` breakdown step may carry its `formula`;
`gather.ts` — changes: `ResourceGiven`'s comment; `packages/engine/test/resources.test.ts` — new;
`derived.test.ts` — changes: Ash's full list of values gains `resources.luck.max`
**Depends on:** ENG-11 (`resources` and `grants`, one row per grant), ENG-28 (`computeDerived`,
its path-by-path reader, `pathTaken`), ENG-27 (Tales: Ash's `luck`, Brook's `focus`)
**Screen:** No

**What it should look like when done:**
1. Each resource key the character has (the `resource` grants gathering gives, ENG-11) gives one
   path `resources.<key>.max` in `values`: its grant's `uses.max`, evaluated with ENG-07's
   `evaluateNumber`, reading every computed path through ENG-28's reader (`@level`, a stat's
   modifier, a module's path, another resource's maximum).
2. Its breakdown is one `grant` step per grant that gives the key, in gathering order: `part`,
   `source`, `label` (the source's name), `formula` (the grant's `uses.max`), `value` (what the
   formula gave), `change` (how much it raised the maximum).
3. **Two grants of one key give one resource.** Its maximum is the highest of their results. The
   first step's `change` is its value; each later step's is what it adds above the highest before
   it, 0 when it is not higher. No warning.
4. A formula that does not parse gives 0. Each formula warning is passed on as a
   `resourceFormula` warning with the key, the part and the formula's own warning. A path nothing
   gives reads 0, with ENG-28's `missingPath` for `resources.<key>.max`; a resource read while it
   is being computed reads 0, with ENG-28's `cycle`.
5. **Order of `values`:** `level`; each stat's `score`, `max`, `mod`; each resource's `max`, in
   the order its key is first given; then the module's paths. A module step for the maximum of a
   key the character has is not used, with `pathTaken`; one for a key it does not have is the
   module's path.
6. **Tales** (ENG-27's expected values): Ash `resources.luck.max` 2 (nerve mod 1 + 1), Brook
   `resources.focus.max` 6 (level 3 × 2); neither gets a new warning. Brook has no
   `resources.breath.max`: its `blessing` boon does not gather Deep Lungs (ENG-11).
7. Every path's breakdown adds up to its value. `compute()` stays pure.
8. The quality gate is green.

**Choices (ADR 002):**
- **The core computes it, not the module.** `resource` is a core grant kind and `uses.max` a core
  formula (ENG-04); the core owns resources as data (ADR 004 item 1). Every system's resources
  are computed alike, and a module's step for the path is refused like any other core path.
- **A key is one resource; two grants give the highest maximum.** The trackers keep the uses
  spent per key (`state.resources`, SPEC §5.8), so a key has one maximum. The highest does not
  depend on the order a module names its entities, and a second source never lowers what the
  first gave. Content that means two sources to add up says so with a derived-phase `add` on
  `resources.<key>.max` (SPEC §5.4, ENG-17). To reverse: change the fold in the one step.
- **No warning for a shared key.** Two sources of one resource is content, not a mistake; the
  breakdown names every grant and which one gave the number.
- **`resources` stays one row per grant**, as ENG-11 gives it, so each grant's label and recovery
  are still there for the trackers and rests (noted on ENG-30 and ENG-21).
- **The maximum is what the formula gives**, below 0 or not whole included: a floor and rounding
  are the formula's to write (`max(1, …)`, `floor(…)`). Noted on ENG-30.
- **A `grant` step may carry its `formula`**, so the sheet can show how a grant's number came out.
  ENG-28's knack steps have none.

**Tests:** `packages/engine/test/resources.test.ts` — `describe('ENG-29 resource maximums')`:
Ash's and Brook's maximums and breakdowns; two and three grants of one key, the highest first,
last and in between; a formula reading a stat, `@level`, a module's path and another resource; a
formula that does not parse, one that is not finite, one reading a missing path, one reading
itself; a module's step for a taken and a free resource path; the order of `values`.
`derived.test.ts` — Ash's full list of values gains `resources.luck.max` 2. Control numbers:
ENG-27's `tales/expected.ts` for Ash and Brook; Tales' rules and each variant's data, worked out
by hand.
**What came out of it:**

Measured:
- Before: `compute()` gave Ash 21 paths and Brook 21, none under `resources.`;
  `grep -rn "resources\." packages/engine/src` found one line, `gather.ts:332`, the gathered row.
  `pnpm test`: `Test Files 23 passed (23)`, `Tests 238 passed (238)`, 3.87 s.
- After: Ash 22 paths, with `resources.luck.max` 2; Brook 22, with `resources.focus.max` 6.
- `resources.test.ts` alone: `Tests 7 passed (7)`, 782 ms.
- Lint: `Checked 102 files`, no fixes, no error (101 before; 1 new file).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 24 passed (24)`, `Tests 245 passed (245)`, 4.08 s.
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The tests bite. Each change made on its own in `derived.ts`, the `resources`, `derived`,
  `compute`, `stats` and `test-system` tests run (56 tests): the last grant wins, 3 fail; the
  first grant wins, 2; the grants add up, 3; each step's change is its value, 3; no `formula` on
  the step, 5; formula warnings dropped, 1; an empty label, 5; resources left out of the order of
  `values`, 8; the formula reads 0 for every path, 7; a module's step may take a resource's
  path, 1.

Differences from §3: none.

Against the row and its note: the note left open what two grants of one key give. One resource,
with the highest of their maximums (Choices).

Found, not fixed:
- A maximum is the formula's number, which can be below 0 or not whole; `Computed.resources`
  keeps one row per grant, each with its own recovery. Noted on ENG-30 and ENG-21 in
  `BACKLOG.md`.
- Two grants of one key give the highest maximum. Whether that fits a fifth-edition resource that
  two classes give is checked by the mechanics that give one. Noted on phase 3 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-17 Derived-phase effects, toggles and overrides

**Hat:** Derived-phase effects, toggles, overrides apply with a breakdown
**Depends on:** ENG-07 (`parseFormula`, `evaluateNumber`), ENG-11 (`gather`, `conditions`), ENG-12
(`activeEffects`, `phaseOf`, the op order, `computeStats`), ENG-28 (`computeDerived`, its
path-by-path reader), ENG-29 (`resources.<key>.max`), ENG-27 (Tales, Ash and Brook)
**Size:** M
**Screen:** No
**SPEC:** §6.1 steps 3, 6 and 7; §5.4 (effects, their phases and targets); §5.6
(`@conditions.<key>.level`); §5.8 (`overrides`, `state.toggles`); §6.2 (breakdown); §8.2

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/phases.ts` — new: SPEC §6.1 steps 6 and 7. The effects left to
each computed path, in phase order, then its override; the stored switches that name nothing; the
targets and overrides that name no value.
- `packages/engine/src/effects.ts` — changes: the op order (`NUMBER_OPS`), working out an
  effect's number (its `when` and `value`) and `EffectWarning` move here from `stats.ts`, so
  both phases share them.
- `packages/engine/src/stats.ts` — changes: uses `effects.ts`'s evaluation; `BreakdownStep` gains
  the kinds `override` and `condition`; the loop that applies sorted effects is exported.
- `packages/engine/src/derived.ts` — changes: the base phase's values become steps, so effects and
  overrides reach them; `conditions.<key>.level` is a core value; `computeDerived` takes the
  `finish` that phases give.
- `packages/engine/src/compute.ts` — changes: runs the phases; `ComputeWarning` gains theirs.
- `packages/engine/src/gather.ts` — changes: `CharacterCore` reads `overrides`.
- `packages/engine/src/index.ts` — changes: exports `phases.ts`.
- `packages/engine/test/phases.test.ts` — new: `describe('ENG-17 …')`.
- `packages/engine/test/derived.test.ts` — changes: its totals become ENG-27's, written beside
  each one.
- `packages/engine/test/stats.test.ts`, `compute.test.ts` — changes: the effects ENG-12 left now
  apply; a variant no longer carries a switch for a talent it drops; the made-up card player has
  `overrides`.

#### 2. What is missing now

Measured with `compute()` on ENG-27's characters:
- Ash: `skills.climb.total` 5, `skills.sneak.total` 4, `skills.steady.total` 1,
  `skills.steady.passive` 6, `skills.all.bonus` 0, `skills.climb.bonus` 0, `skills.sneak.bonus` 0.
  ENG-27 expects 6, 4, 0 and 5: `nimble`, `shadow` and `weary`'s `tired` are not applied.
- Brook: `skills.sneak.total` 4, `skills.steady.total` 5, `skills.steady.passive` 10. ENG-27
  expects 9 (the override), 7 and 12: `will` and the override are not applied.
- 22 paths each; none starts with `conditions.`. `weary`'s value `-@conditions.weary.level` has no
  path to read.
- `grep -rn "overrides" packages/engine/src` finds nothing: `CharacterCore` does not read them.
- A stored switch for an effect the character does not have gives no warning (ENG-06 §9).
- `pnpm test`: `Test Files 24 passed (24)`, `Tests 245 passed (245)`.

#### 3. What it should look like when done

1. **Every computed path but `level` is finished when it is computed** (SPEC §6.1 steps 6–7):
   its own steps (the base phase's for a stat's score and maximum, the core's or the module's step
   for the rest), then the effects left to it, then its override. Every reader of the path,
   another step or an effect's formula, gets the finished value.
2. **The effects left to a path:** every effect `activeEffects` gives (its toggle on, not
   situational; ENG-12) whose `target` is the path, but a base-phase effect on a stat's score or
   maximum, which is the base phase's (ENG-12). A phase is the effect's own, else ENG-12's
   default (`base` for a stat's score or maximum, `derived` for every other target).
3. **Order:** by phase, `base`, `derived`, `final`; then by priority (ENG-12's: `mul` 10, `add` 20,
   `min` 30, `max` 40, `set` 50, or the effect's own); then in gathering order.
4. **Formulas.** A `derived` or `final` effect's `when` and `value` read any computed path,
   computing it first (ENG-28's reader): Ash's `nimble` reads `@abilities.wits.mod`. A `base`
   effect on another target keeps the base-phase rule (SPEC §5.6, ENG-12): a formula that names a
   path but `level` and the module's `basePath` is not applied, with `notInBasePhase`. A formula
   that does not parse: not applied, with a `formula` warning. Its other warnings are passed on as
   `formula` warnings, and its value is used. A path nothing gives reads 0 with ENG-28's
   `missingPath`; a loop reads 0 with ENG-28's `cycle`.
5. **Ops**, as ENG-12: `mul`, `add`, `min`, `max` and a `set` with a number apply. Another op (a
   `set` with a yes/no or a text, `append`, `advantage`, `disadvantage`, `note`) on a computed
   path is not applied, with `notANumber`; on a path that is not computed it gives no warning: it
   names a list or a roll, which its own ticket reads (§9).
6. **An override** (`overrides`, SPEC §5.8) of a computed path replaces its value after every
   effect, with a breakdown step `{ kind: 'override', value, change, note? }`: `change` is the
   value less the value before it, `note` the stored note. The screen calls the kind "Manual
   edit" (phase 2). A stat's maximum does not cap it. An override whose value is a yes/no or a
   text, on a number path, is not applied, with `overrideNotANumber`.
7. **`conditions.<key>.level`** is a value for each condition key `byKey` names: gathering's level
   (ENG-11), 0 when the character does not have it. A level above 0 has one step
   `{ kind: 'condition', source, label }`, the condition's id and name; a 0 has none.
8. **`level` takes no effect and no override:** gathering and the base phase have read it already
   (ENG-11, ENG-12). One aimed at it is not applied, with `fixedPath`, `by` the effect's part or
   `override`.
9. **Warnings, never a block** (SPEC §8.2):
   - `noTarget`: an effect of a number op whose target no computed path is (a typo, or a value
     the character does not have); not applied.
   - `overrideNoPath`: an override of a path that is not computed; not applied.
   - `toggleGone`: a stored switch whose `<entityId>#<effectId>` names no effect with a toggle of
     an entity the character has (ENG-06 §9); not used.
10. **Order of `values`:** `level`; each stat's `score`, `max`, `mod`; each resource's `max`; each
    condition's `level`; then the module's paths. A module step for a condition's level is not
    used, with ENG-28's `pathTaken`.
11. **Tales:** `compute()` gives every value of ENG-27's `expected.ts`: Ash `skills.climb.total`
    6, `skills.sneak.total` 4, `skills.steady.total` 0, `skills.steady.passive` 5; Brook
    `skills.sneak.total` 9 (the override), `skills.steady.total` 7, `skills.steady.passive` 12;
    and the rest as before. Besides: Ash `skills.all.bonus` -1, `skills.climb.bonus` 2,
    `skills.sneak.bonus` 1, `conditions.weary.level` 1, `conditions.lost.level` 0; Brook
    `skills.steady.bonus` 2, `conditions.weary.level` 0, `conditions.lost.level` 1. Ash gets no
    warning; Brook only ENG-11's `missing`.
12. Every path's breakdown adds up to its value. `compute()` stays pure: ENG-11's frozen-input test
    runs the phases too.
13. The quality gate is green.

#### 4. How to do it

1. `effects.ts`: `NUMBER_OPS`, `NumberOp`, `numberChangeOf`, `applied`; `EffectWarning`;
   `effectNumber(active, reader, warn)`, ENG-12's checks in ENG-12's order.
2. `stats.ts`: the base phase calls `effectNumber`; `StatWarning` takes `EffectWarning`;
   `applyEffects(steps, total, sorted)` is the loop `withEffects` ran; the two new step kinds.
3. `gather.ts`: `CharacterCore.overrides`.
4. `phases.ts`: `phasesOf(character, gathered, basePhase)` gives `finish(path, own, read)` and
   `end()`: the effects by target, the overrides by path, `fixedPath` and `toggleGone` at the
   start; each path's effects worked out, sorted and applied, then its override, when it is
   finished; `noTarget` and `overrideNoPath` for what no path finished.
5. `derived.ts`: base paths as steps; `conditions.<key>.level`; `finish` called inside the reader,
   while the path is still in progress, so a loop through an effect is caught.
6. `compute.ts`: `phasesOf`, `finish`, the warnings.
7. The tests of §7.

Technical choices (ADR 002):
- **A path is finished when it is computed**, not in a pass after every step. A total reads its
  bonus; ENG-28's reader computes a path when it is first read, so the bonus's effects and its
  override are applied there, and no reader sees an unfinished value (BACKLOG note, found by
  ENG-28).
- **A `base` effect on a target other than a stat's score or maximum applies first**, under the
  base-phase rule. The phases are an order; the rule keeps its formula from reading what the base
  phase does not know. Refusing it would drop content that only asked to come early.
- **`final` effects come after `derived` ones and before the override.** SPEC §6.1 step 7 makes
  overrides the final phase; an effect that asks for `final` is placed last among effects, and the
  override still wins (`CLAUDE.md`, "Manual overrides always win").
- **The cap stays the base phase's** (SPEC §6.1 step 4). A derived or final effect or an override
  on a stat's score is not capped; one on its maximum changes the maximum, not the score already
  capped. Content that raises the cap does it in the base phase, that target's default.
- **`level` is fixed.** Grants' `atLevel` and base-phase formulas read the module's level before any
  effect; letting `@level` read another number later would give two levels in one character.
- **Another op on a path that is not computed gives no warning.** `append` on `defenses.resist` and
  `advantage` on `roll.init` are content for lists and rolls (SPEC §5.4), which are not number
  paths. On a number path they cannot apply, so they warn, as ENG-12's do.
- **A number op on a target that is not computed warns (`noTarget`).** SPEC §5.4 builds the target
  catalogue from what the character has; an effect outside it changes nothing, and a typo must
  not pass silently.
- **An override that is not a number warns.** Every value is a number (ENG-28); a later ticket that
  computes a path of text (a skill's stat, SPEC §5.4) reads such overrides.
- **Condition levels are the core's values.** SPEC §5.6 names `@conditions.<key>.level` in the core's
  formula language, and ENG-11 gathers the levels.
- **The phases plug into the reader.** `computeDerived` takes a `finish` function, so `derived.ts`
  stays the walk and `phases.ts` holds steps 6 and 7; `derived.ts` alone still runs with none.
- **One evaluation of an effect.** The formula rules (parse, base-phase check, `when`, warnings)
  move to `effects.ts`, used by both phases, so they cannot drift apart.

#### 5. Stored data

Nothing stored changes. `compute()` now reads `overrides`, which ENG-06's character schema has, and
reads `state.toggles` for the switch check; no schema, no `schemaVersion`, no Dexie table changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/phases.test.ts` — `describe('ENG-17 derived-phase effects, toggles and
  overrides')`: §3 items 1–12 on Ash and Brook and on variants: ENG-27's values and the
  breakdowns; the order of phases and priorities; a derived effect and an override on a stat's
  score and maximum; formulas reading module paths, conditions, missing paths and loops; a base
  effect on another target, allowed and refused; formula warnings and `when`; each op on a
  computed path and on one that is not; toggles on, off and by default; `toggleGone` for each way
  a switch names nothing; overrides that are not numbers, of a missing path, of `level`; the order
  of `values`.
- `derived.test.ts` — Ash's full list of values and the breakdowns become ENG-27's, with ENG-28's
  totals before the effects written beside them.
- `stats.test.ts`, `compute.test.ts` — ENG-11's and ENG-12's tests: the effects ENG-12 left out
  now apply (written beside the values that change).
- Control values from: ENG-27's `tales/expected.ts` for Ash and Brook; Tales' rules and each
  variant's data, worked out by hand and checked with `python3`, not by the new code.

#### 8. Checked against the source

Nothing to check. No rule of a real game is used: Tales is made up, and the phases are SPEC §6.1's.
The op order is ENG-12's (its §8 read Foundry's mode numbers).

#### 9. Not in this ticket

- Naming every path of a loop: ENG-18.
- Lists: `append` on `ac.formulas`, `defenses.*`, `prof.*` (SPEC §5.4): fifth edition's tickets
  that compute them (ENG-13, ENG-14).
- `advantage` and `disadvantage` on `roll.*`, and what a situational effect shows: ENG-34 and
  phase 2. A `note` effect on the sheet: phase 2.
- A path of text (`skills.<key>.ability` by `set`): ENG-13 decides how a skill's stat is chosen.
- Switching a toggle, making or removing an override, the words "Manual edit": phase 2.
- Fifth edition's derived values and its effects' targets: ENG-13 to ENG-16.

#### 10. Rake check

- **Manual overrides always win.** The override is the last step of its path, after every phase,
  never capped; the breakdown names it with its own kind.
- **`compute()` is pure.** The phases read the frozen inputs; ENG-11's frozen-input test runs them.
- **A number with no breakdown entry is a bug.** Each effect and each override is a step; every
  path's steps add up to its value, in every test.
- **Formulas never run code.** Every effect formula goes through ENG-07's parser and walker.
- **Missing is not broken.** A target or an override path not computed, a switch for nothing, a
  value that is not a number, a missing path, a loop: each is a warning; nothing throws.
- **The core names no game.** The core names SPEC §5.6's `level` and `conditions.<key>.level`
  and its own `abilities.` paths; every other path is the module's or a pack's.
- **Everything is data.** No stat, skill or condition key is in the code.
- **`packages/engine` is pure TypeScript.** `phases.ts` imports only `@grimoire/schema` and the
  engine's own files.
- **Licensing.** Test data is made up.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- Before: `compute()` gave Ash and Brook 22 paths each, none under `conditions.`; Ash
  `skills.climb.total` 5, `skills.steady.total` 1, `skills.steady.passive` 6; Brook
  `skills.sneak.total` 4, `skills.steady.total` 5, `skills.steady.passive` 10. `pnpm test`:
  `Test Files 24 passed (24)`, `Tests 245 passed (245)`, 4.17 s.
- After: 24 paths each. Ash `skills.all.bonus` -1, `skills.climb.bonus` 2, `skills.climb.total` 6,
  `skills.sneak.bonus` 1, `skills.sneak.total` 4, `skills.steady.total` 0, `skills.steady.passive`
  5, `conditions.weary.level` 1, `conditions.lost.level` 0, no warning. Brook `skills.sneak.total`
  9, `skills.steady.bonus` 2, `skills.steady.total` 7, `skills.steady.passive` 12,
  `conditions.weary.level` 0, `conditions.lost.level` 1, only `missing`. Every value of ENG-27's
  `expected.ts` is met for both.
- `phases.test.ts` alone: `Tests 14 passed (14)`, 889 ms.
- Lint: `Checked 104 files`, no fixes, no error (102 before; 2 new files).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 25 passed (25)`, `Tests 259 passed (259)`, 4.32 s.
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The tests bite. Each change made on its own, the 11 engine test files run (141 tests): a stored
  switch never checked, 1 fails; base-phase effects on a stat applied again by the phases, 11;
  effects on `level` let through, 1; an override of `level` let through, 1; a base effect
  reading through the derived reader, 1; priority before phase, 1; no sort, 1; overrides not
  applied, 5; an override that is not a number applied, 1; its note dropped, 2; `noTarget` for
  every op, 1; no `noTarget`, 1; no `overrideNoPath`, 1; the phases doing nothing, 20; `finish`
  run after the path leaves the set in progress, 1; a step for a level of 0, 1; no condition
  levels, 39; the base phase's values filled in before the walk (so effects miss them), 2; the
  base-phase rule not checked, 2; `when` ignored, 2; a formula that does not parse applied, 2.
- One mutation was first written wrong (it broke the file, so no test ran); rewritten, it fails 1
  test.

Differences from §3: none.

Against the row and its note:
- Each point of the note is done: `values` and `breakdown` take the phases (§3 item 1);
  `activeEffects` is reused (item 2); a manual edit is its own step (item 6); a base-phase effect
  on another target applies first, and a derived or final one on a stat's score or maximum
  applies after the cap (items 2–4); a path's effects apply in ENG-28's `valueAt`, before any
  reader (item 1); `conditions.<key>.level` is a value (item 7); `derived.test.ts`'s totals are
  ENG-27's, with the totals before the effects written beside them.
- ENG-06 §9's two warnings are here: `toggleGone` and `overrideNoPath`.
- Re-cut inside the engine: the evaluation of one effect moved from `stats.ts` to `effects.ts`,
  with `NUMBER_OPS`, `NumberOp` and `EffectWarning`; `NumberOp` is still exported by the package.
- Tests of earlier tickets that changed, each with the reason written beside it: ENG-12's `odd`
  test (its derived `later` effect now applies: wits 11); ENG-28's knack test (climb total 10)
  and missing-path test (swim total -1, weary's -1); ENG-29's `knack` maximum (6) and the order of
  `values` (the conditions come before the module's paths). Two variants built from Brook drop
  its stored switch with its talent, so they get no `toggleGone`.

Found, not fixed:
- An effect whose op gives no number, on a path that is not a number value (`append` on
  `ac.formulas`, `advantage` on `roll.init`, a `set` with a text on `skills.<key>.ability`), is
  left alone by the phases, with no warning. Noted on ENG-13, ENG-14 and ENG-34 in `BACKLOG.md`:
  the ticket that computes such a list, roll or text reads its effects through `activeEffects`.
- A stored switch stays after its entity is removed, and warns `toggleGone` on every compute; an
  override of a number path that holds a yes/no or a text never applies. Noted on phase 2 in
  `BACKLOG.md`: removing an entity on the sheet drops its switches, and the override editor
  stores a number for a number path.

Nothing for the changelog.

---

### ENG-18 A formula loop names its paths

**Hat:** A formula cycle stops with a message naming the paths
**Depends on:** ENG-28 (`computeDerived`, its path-by-path reader, the `cycle` warning), ENG-17
(`phasesOf`, effects read inside the reader), ENG-29 (`resources.<key>.max`), ENG-27 (Tales, Ash)
**Size:** S
**Screen:** No
**SPEC:** §5.6 (formulas, loops); §8.2 (missing is not broken); §12 stage 1, the last line of its
"Готово, когда" list

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/derived.ts` — changes: the paths in progress keep their order
and the formula that read each; a `cycle` warning carries the whole loop, and its message names
every path of it.
- `packages/engine/src/phases.ts` — changes: an effect's formulas read through a reader that names
  the effect's part.
- `packages/engine/src/compute.ts` — changes: `SystemModule.derive`'s comment says how a step names
  the part whose formula it reads.
- `packages/engine/test/cycle.test.ts` — new: `describe('ENG-18 …')`.
- `packages/engine/test/derived.test.ts`, `phases.test.ts`, `resources.test.ts` — changes: their
  `cycle` warnings carry the loop.

#### 2. What is missing now

Measured with `compute()` on ENG-28's and ENG-17's loop tests:
- Two stats whose modifiers read each other (`luck`: `@abilities.hope.mod + 1`, `hope`:
  `@abilities.luck.mod + 1`) give one warning:
  `@abilities.luck.mod is read for abilities.hope.mod while it is being computed; 0 is used.`
  Its data is `{ code: 'cycle', path, for }`: two paths.
- A loop through an effect (`echo#back` on `skills.climb.bonus` reads `@skills.climb.total`, whose
  step reads `skills.climb.bonus`) gives:
  `@skills.climb.bonus is read for skills.climb.total while it is being computed; 0 is used.`
  The effect that closes the loop is not named, so the message points at the module's step for
  `skills.climb.bonus`, which reads nothing.
- A loop of three or more paths names only the last two; the rest is lost. `computing` in
  `derived.ts` is a `Set` of paths, with no record of what read each one.
- `pnpm test`: `Test Files 25 passed (25)`, `Tests 259 passed (259)`.

#### 3. What it should look like when done

1. **A `cycle` warning names its whole loop.** Besides `path` (the path read again) and `for` (the
   path whose computing read it), it carries `loop`: every path from `path`, in the order each began
   to be computed, back to `path`. The first and the last entry are `path`, as ENG-25's
   `dependencyLoop` names a loop of packs.
2. **Each entry names what read it.** An entry is `{ path, by? }`. `by` is the part
   (`<entityId>#<id>`) whose formula read the path: an effect on the entry before it (ENG-17), or a
   `resource` grant of it (ENG-29). With no `by`, the entry before it read it in its own step (the
   core's modifier formula, the module's step). The first entry has no `by`: what began it is not
   on the loop.
3. **Only the loop.** A path in progress before the loop began (it read into the loop from outside)
   is not in `loop`. A path that finished is not either: two loops through one path give two
   warnings, each naming its own.
4. **The message names every path:**
   `@<path> is read for <for> while it is being computed; 0 is used. The loop: @<a> → @<b> → … → @<a>.`
   An entry with `by` is written `@<path> (read by "<by>")`.
5. **What a loop does to the values does not change** (ENG-28): the path read again reads 0 there,
   each path is computed once, nothing throws.
6. **A module's step can name a part.** A step gets `readBy(part)` beside `read`: a reader whose
   reads name that part in a loop, for a step that evaluates a pack's formula. A step that does not
   use it works as before.
7. **Worked out by hand** on Ash with a stat of its own, `fate` (`@resources.charm.max + 1`), and a
   talent `knot` with a resource `charm` (`@skills.climb.total`) and an effect `pull` on
   `skills.climb.bonus` (`add @abilities.fate.mod`): one warning, `path` `abilities.fate.mod`,
   `for` `skills.climb.bonus`, `loop` `abilities.fate.mod` → `resources.charm.max` →
   `skills.climb.total` (by `knot#charm`) → `skills.climb.bonus` → `abilities.fate.mod` (by
   `knot#pull`). Values: `skills.climb.bonus` 2 (`nimble` 2, `pull` 0), `skills.climb.total` 6,
   `resources.charm.max` 6, `abilities.fate.mod` 7.
8. Ash and Brook, with no loop, get no `cycle` warning. Every breakdown still adds up to its value.
9. The quality gate is green.

#### 4. How to do it

1. `derived.ts`: `LoopLink { path; by? }`; `PartReader = (by: EntityPartId) => ValueReader`;
   `DerivedStep` and `Finish` get the part reader; the `cycle` warning gains `loop`.
2. `derived.ts`: `computing` becomes a `Map` from path to its link, in insertion order; `valueAt`
   takes the reading part; on a path read again, the loop is the links from that path on, then the
   read that closed it. The resource step reads each grant's formula through `readBy(part)`.
3. `phases.ts`: `finish` reads each derived or final effect through `readBy(active.part)`.
4. `compute.ts`: the `derive` comment.
5. The tests of §7.

Technical choices (ADR 002):
- **The loop is found while computing, from the paths in progress.** ENG-07 named its `paths` for
  this; ENG-28 then made the reader compute a path when it is first read, and a module's step is
  code, whose reads are known only as it makes them. The paths in progress see every read, a
  formula's and a step's alike, so the loop is exactly the reads that happened.
- **A loop on a branch a formula does not take today is not warned.** It changes no value; the day
  the branch is taken, it warns. Finding it before then is the editor's (§9).
- **`by` names an effect or a grant, not a stat.** A modifier formula belongs to its stat, which its
  path already names (`abilities.<key>.mod`). An effect's formula belongs to another entity, and a
  resource's to one of its grants: without `by` a person would look for the loop in the path's own
  step and not find it.
- **`path` and `for` stay.** They are the read that got 0, which is what changed a value; `loop` is
  why. A screen that showed ENG-28's two keeps working.
- **The part reader is an argument, not a field of the read.** `ValueReader` stays one path in, one
  number out, so every formula call keeps its reader; a step or an effect that names its part asks
  for a reader that carries it.

#### 5. Stored data

Nothing stored changes. A warning is computed, never stored; no schema, no `schemaVersion`, no Dexie
table changes.

#### 6. What a person will see

Not a screen. The warning's data is for the sheet (phase 2); its message is for logs.

#### 7. Tests

- `packages/engine/test/cycle.test.ts` — `describe('ENG-18 a formula loop names its paths')`: §3
  items 1–8: the loop of item 7 through a modifier, a resource grant, a module step and an effect,
  its values and its exact message; a loop read into from a path outside it; two loops through one
  path; a module step that reads through `readBy`; a path that reads itself; Ash and Brook with no
  `cycle`.
- `derived.test.ts`, `phases.test.ts`, `resources.test.ts` — ENG-28's, ENG-17's and ENG-29's loop
  tests: the same values and warnings, each with its `loop`.
- Control values from: Tales' rules and each variant's data, worked out by hand (§3 item 7) and
  checked with `python3`, not by the new code.

#### 8. Checked against the source

Nothing to check. No rule of a real game is used: Tales is made up; what a loop does is SPEC §5.6's
and §8.2's.

#### 9. Not in this ticket

- A loop on a branch a formula does not take today (§4): the homebrew editor's checks and its
  live preview (phase 5, SPEC §8.3). Noted on phase 5 in `BACKLOG.md`.
- Showing the warning on the sheet: phase 2.
- Base-phase formulas: they read only levels and what the system allows (SPEC §5.6, ENG-12), so no
  loop can pass through them.
- A loop of grants (an entity that grants itself): ENG-11 gathers each entity once.
- A loop of pack dependencies: ENG-25's `dependencyLoop`.

#### 10. Rake check

- **Missing is not broken.** A loop still reads 0 and warns; nothing throws (§3 item 5).
- **`compute()` is pure and deterministic.** The in-progress list lives inside one call; the order
  of `values` fixes the order of the reads, so the same character gives the same loop.
- **A number with no breakdown entry is a bug.** No value or step changes; every test checks that
  each breakdown adds up.
- **Formulas never run code.** Every formula still goes through ENG-07's parser and walker.
- **The core names no game.** The loop names paths and parts; no stat, skill or resource key is in
  the code.
- **`packages/engine` is pure TypeScript.** No new import.
- **Licensing.** Test data is made up.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- Before: the two loop messages of §2; `pnpm test`: `Test Files 25 passed (25)`,
  `Tests 259 passed (259)`, 3.54 s.
- After, the same two loops:
  - `@abilities.luck.mod is read for abilities.hope.mod while it is being computed; 0 is used. The
    loop: @abilities.luck.mod → @abilities.hope.mod → @abilities.luck.mod.`
  - `@skills.climb.bonus is read for skills.climb.total while it is being computed; 0 is used. The
    loop: @skills.climb.bonus → @skills.climb.total (read by "character:talent/echo#back") →
    @skills.climb.bonus.`
- §3 item 7's loop gives one warning with the five entries of §3 and the values 2, 6, 6 and 7.
- `cycle.test.ts` alone: `Tests 5 passed (5)`, 490 ms.
- Lint: `Checked 105 files`, no fixes, no error (104 before; 1 new file).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Test: `Test Files 26 passed (26)`, `Tests 264 passed (264)`, 3.37 s.
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The tests bite. Each change made on its own, the engine's tests run (146 tests): the loop starts
  at the outermost path in progress, 7 fail; its first entry keeps what began it, 1; a finished
  path stays in progress, 2; the part reader drops the part, 4; a resource grant reads with no
  part, 2; an effect reads with no part, 2; a link never keeps its part, 4; the closing read loses
  its part, 3; the message without the loop, 2; the message without the parts, 1.
- Two mutations were first written with the wrong indentation and did not apply; rewritten, they
  fail 1 and 3 tests.

Differences from §3: none.

Against the row and its note:
- Each point of the note is done: `computing` keeps the paths in progress in the order they began
  (a `Map`, §4 step 2); the warning names the whole loop (§3 item 1); an effect's formula is named
  by its part (§3 item 2). A resource grant's formula is named too, by the same reader.
- ENG-07 §9 said the loop would be found from `paths` and `reads`. ENG-28's reader made the paths
  in progress the place to find it; §4 says why.
- Tests of earlier tickets that changed: ENG-28's loop test, ENG-17's loop through an effect,
  ENG-29's resource loop gain their `loop`; values and the other warnings are as before. ENG-28's
  counting wrapper passes `readBy` on to the step it wraps.

Found, not fixed:
- A loop on a branch a formula does not take today gives no warning (§4). Noted on phase 5 in
  `BACKLOG.md`.
- `missingPath` names the path whose computing read the missing one, not the effect or grant whose
  formula did; a typo in an effect's formula points at the module's step for its target. `valueAt`
  knows the part since this ticket. Noted on phase 5 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-30 Tracker actions and their log entries

**Hat:** Tracker actions return a log entry that undoes them
**Depends on:** ENG-06 (the trackers: `state.resources`, `state.conditions`, `state.toggles`),
ENG-26 (`rollerSchema`: who), ENG-29 (`resources.<key>.max`), ENG-17 (toggles), ENG-11
(conditions, `maxLevelOf`), ENG-27 (Tales: Ash, Brook)
**Size:** S
**Screen:** No
**SPEC:** §6.4, as ADR 014 item 10 widens it; §5.8 `state`

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/trackers.ts` — new: the core's tracker actions.
- `packages/engine/src/log.ts` — new: `applyEntry`, `reverseEntry`, the path and JSON helpers.
- `packages/schema/src/log.ts` — new: `logEntrySchema`, the shape the table link will send.
- `packages/schema/src/index.ts`, `packages/engine/src/index.ts` — export the new files.
- `packages/engine/src/gather.ts` — changes: `CONDITION_TYPE` and `maxLevelOf` are exported, so
  the condition actions use gathering's rule, not a copy.
- `packages/schema/test/log.test.ts`, `packages/engine/test/trackers.test.ts` — new.

#### 2. What is missing now

- `grep -rn "logEntry\|LogEntry\|useResource\|applyEntry\|undo" packages --include=*.ts` finds
  nothing.
- No function changes a character. The trackers of ENG-06 are only read (`compute()` reads
  conditions and toggles; nothing reads `state.resources`).
- `pnpm test`: `Test Files 26 passed (26)`, `Tests 264 passed (264)`, 3.74 s.

#### 3. What it should look like when done

The control character is ENG-27's Ash: luck max 2 with 1 used, Weary at level 1, `glow` off.
Brook: focus max 6 with none used, Lost, `charm` on. `stamp` is
`{ id, at, by: { role: 'player', name: 'Wren' } }`.

**The log entry**
1. `logEntrySchema` (`@grimoire/schema`) is a strict object: `id` (uuid), `at` (UTC date and
   time), `by` (`rollerSchema`: role and name), `action` (a key), `subject` (what changed: a
   resource key, a condition id, a toggle's part id), `label` (optional, the name of what
   changed), `changes` (at least one).
2. A change is `{ path, before?, after? }`. `path` is the field names from the character's root,
   at least one: `['state', 'resources', 'luck']`. `before` and `after` are JSON values; a missing
   one means the field is absent.
3. The schema refuses: no changes; an empty path; an empty step; a step `__proto__`,
   `constructor` or `prototype`; one path twice; a path inside another; a value that is not
   JSON (`NaN`, a function); an unknown field; a bad `id` or `at`.

**Applying and reversing**
4. `applyEntry(character, entry)` gives `{ ok: true, character }` with every path set to its
   `after` value (removed when there is none). It first checks that every path holds its
   `before` value; if one does not, it gives `{ ok: false, code: 'changed', path, expected,
   found }` and changes nothing.
5. `reverseEntry(character, entry)` does the same from `after` to `before`.
6. A path through a value that is not an object, or through a field that is not there, or with
   an unsafe step, gives `{ ok: false, code: 'badPath', path }`. `Object.prototype` never
   changes.
7. An entry not applied yet is a pending change. Its `after` edited, it applies with the edited
   value: Brook's focus entry `after: 2` edited to `3` applies as 3.
8. Neither function changes what it is given. The result shares the parts it did not change.

**Resources**
9. `resourceUses(character, computed, key)` gives `{ max, spent, left }`, or `undefined` when no
   grant gives the key. `left` is `floor(max) - spent`, never below 0. Ash's luck:
   `{ max: 2, spent: 1, left: 1 }`. Brook's focus: `{ max: 6, spent: 0, left: 6 }`.
10. `useResource(character, computed, { key, count }, stamp)`:
    - Ash, luck, 1: luck 2; the entry's `action` `useResource`, `subject` `luck`, `label`
      `{ en: 'Luck' }`, `changes` `[{ path: ['state', 'resources', 'luck'], before: 1, after: 2 }]`.
    - Ash after that, luck, 1: `{ ok: false, code: 'notEnough', left: 0, count: 1 }`.
    - Brook, focus, 2: the change has no `before` and `after: 2`. Brook, focus, 7: `notEnough`,
      `left: 6`.
    - A count of 0, -1 or 1.5: `badCount`. Brook's `breath` (no grant gives it, ENG-29):
      `noResource`.
    - A maximum that is not whole or below 0 (a talent's grant with `2.5` or `-1`): `left` 2 and 0.
11. `regainResource(character, computed, { key, amount }, stamp)`, `amount` a whole number from 1
    or `all`:
    - Ash, luck, 1: `before: 1, after: 0`. Ash, luck, `all`: the same. Ash, luck, 5: `after: 0`
      (never below 0).
    - Brook, focus, 1: `{ ok: false, code: 'unchanged' }`.
    - A key no grant gives, with uses stored (`state.resources.old: 2`): regains, with no `label`.
    - An amount of 0 or 1.5: `badCount`.

**Conditions**
12. `setCondition(character, index, { id, level? }, stamp)`, `level` 1 when not given:
    - Ash, Weary, 2: `changes` `[{ path: ['state', 'conditions'], before: [{ id: weary, level: 1 }],
      after: [{ id: weary, level: 2 }] }]`, `label` `{ en: 'Weary' }`. Computed after it:
      `skills.sneak.total` 3 (wits 2 + 2 × 1 + `shadow` 1 - 2).
    - Ash, Lost: appended as `{ id: lost }`, with no `level`, since Lost has no levels.
    - Ash, Weary, 4: `{ code: 'badLevel', level: 4, max: 3 }`. Ash, Lost, 2: `badLevel`, `max: 1`.
      Levels 0 and 1.5: `badLevel`.
    - Ash, Weary, 1: `unchanged`.
    - An id no pack has: `missing`. A talent's id: `notACondition`.
13. `removeCondition(character, index, { id }, stamp)`:
    - Ash, Weary: `after: []`. Computed after it: `skills.sneak.total` 5 (2 + 2 + 1).
    - Ash, Lost: `unchanged`.
    - A stored condition whose entry no pack has any more: removed, with no `label`.

**Toggles**
14. `setToggle(character, computed, { part, on }, stamp)`:
    - Ash, `tales-core:talent/night-warden#glow`, on: `changes`
      `[{ path: ['state', 'toggles', '<part>'], after: true }]`, `label` `{ en: 'Glowing' }`.
      Computed after it: `abilities.grit.score` 8 (6 + 1 + 1), `skills.climb.total` 7
      (4 + 2 × 1 + 2 - 1).
    - Ash, `glow`, off: `unchanged` (its default is off).
    - Brook, `character:talent/lucky-charm#charm`, off: `before: true, after: false`, `label`
      `{ en: 'Held' }`.
    - Ash, `night-warden#shadow` (no toggle): `noToggle`. Brook, `night-warden#glow` (Brook has
      no Night Warden): `noToggle`.

**Every action**
15. A refusal changes nothing and carries a `code`, its data, and an English `message` for logs.
16. Each entry an action gives parses with `logEntrySchema`, and carries `stamp`'s `id`, `at`, `by`.
17. `reverseEntry` on the character an action gave, with that action's entry, gives back a
    character equal to the one before, for every action in items 10–14.
18. Two changes in order, then the first reversed: Ash uses 1 luck (1 → 2), regains all (2 → 0),
    then reverses the use: `{ code: 'changed', path: ['state', 'resources', 'luck'], expected: 2,
    found: 0 }`.
19. Deep-frozen inputs: no action and neither function throws, and each input equals its copy
    after the call.
20. The quality gate is green.

#### 4. How to do it

1. `packages/schema/src/log.ts`: `docPathSchema`, `logChangeSchema`, `logEntrySchema`, their
   types.
2. `packages/engine/src/log.ts`: `readAt`, `sameJson`, `copyJson`, `applyEntry`, `reverseEntry`.
   Applying is two passes: check every `before`, then write every `after` by copying the objects
   on the path.
3. `packages/engine/src/gather.ts`: export `CONDITION_TYPE` and `maxLevelOf`.
4. `packages/engine/src/trackers.ts`: `LogStamp`, `TrackedCharacter`, `TrackerRefusal`,
   `ActionResult`, `resourceUses`, then the five actions. Each builds its entry from the values it
   read, then applies it with `applyEntry`, so an action is its entry applied.
5. Tests, then the gate.

Technical choices (ADR 002):
- **A path is a list of field names, not a dotted text.** A toggle's part id holds `:`, `/` and
  `#`; a list needs no escaping.
- **A list is changed whole.** The conditions are one value, before and after. A path never
  points into a list, so reversing gives back the same order, and two changes to one list in the
  wrong order are refused as `changed`, never merged.
- **Values, not differences.** ADR 014 item 10 names before and after values. A pending entry
  whose `before` no longer holds is refused, never applied over a newer value. Merging is the
  table link's.
- **The caller gives `id`, `at` and `by`.** The engine has no clock and no random source
  (ENG-01, ENG-08), as `recordRoll` (ENG-26).
- **`by` is ENG-26's `rollerSchema`.** A roll and a change name their author the same way: a
  player or the game master, and a name.
- **No words in the entry.** `action` and `subject` are keys; `label` is the entry's own name in
  each language it has. The screen makes the sentence from i18n keys.
- **Spending what is not there is refused; regaining past full is not.** A resource's uses left
  are `floor(max) - spent`, never below 0 (ENG-29 left this to ENG-30). Regaining lowers the
  uses spent to no less than 0.
- **An action that would change nothing is refused (`unchanged`),** so the history never holds an
  empty entry.
- **A condition's level is stored only when it has levels.** `maxLevelOf` (ENG-11) gives 1 for a
  condition without levels.
- **A toggle is set, not flipped.** The screen sends the state it shows next; a set is the same
  whoever applies it, and a flip in a pending entry would not be.
- **Applying does not check the character against its system's schema.** The engine cannot know a
  module's schema. An edited `after` is checked when the character is saved, by the system's
  opener (phase 2).

#### 5. Stored data

Nothing stored changes. `logEntrySchema` is a new shape, not stored yet: a Dexie table for it is
phase 2's, and it gets a version then (as `rollRecordSchema`, ENG-26).

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/schema/test/log.test.ts` — `describe('ENG-30 log entry')`: §3 items 1–3.
- `packages/engine/test/trackers.test.ts` — `describe('ENG-30 tracker actions')`: §3 items 4–19.
- Control numbers from: ENG-27's `tales/expected.ts` (Ash, Brook) and Tales' rules in
  `tales/system.ts`, worked out by hand. The values after a change are worked out by hand in §3.

#### 8. Checked against the source

Nothing to check. The actions are the core's, on Tales; no rule of a real game is used. Fifth
edition's damage, healing, slots and concentration are ENG-20, and its rests ENG-21.

#### 9. Not in this ticket

- Fifth edition's actions (damage, healing, temporary hit points, slots, concentration): ENG-20.
- Rests, and which grant's recovery a key given twice follows: ENG-21.
- Level-up as a log entry: ENG-36.
- Storing entries, the history in "⋯", undo on the screen, `rev` and `updatedAt`: phase 2.
- Sending entries, the DM's grouped review and approval, merging a pending entry onto a newer
  character: the table link's phase.
- Dropping the stored switches of a removed entity: phase 2 (ENG-17's note).

#### 10. Rake check

- **Engine is pure.** No clock, no random id, no global: the caller gives `id`, `at`, `by`.
  Nothing passed in is changed; the frozen-input test proves it.
- **Everything is data; the core names no game.** Resources, conditions and toggles are the
  core's trackers; the actions read their keys, levels and labels from the content.
- **Missing is not broken.** A missing condition or resource is a refusal with a code, never a
  throw; a stored condition with no entry can still be removed, and uses of a key no grant gives
  can still be regained.
- **Ids are stable.** Entries name conditions and toggles by id and part id.
- **No user-facing string in the engine.** Messages are English for logs; the screen uses `code`.
- **A stored-shape change needs a migration.** None changes (§5).
- **Licensing.** Tales is invented; no rules text.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- Before: `grep -rn "logEntry\|LogEntry\|useResource\|applyEntry\|undo" packages --include=*.ts`
  found nothing. `pnpm test`: `Test Files 26 passed (26)`, `Tests 264 passed (264)`, 3.74 s.
- After: `pnpm test`: `Test Files 28 passed (28)`, `Tests 279 passed (279)`, 3.92 s.
- The two new files alone: `Tests 15 passed (15)`, 616 ms. `log.test.ts` holds 3 tests,
  `trackers.test.ts` 12.
- Lint: `Checked 110 files`, no fixes, no error (5 new files).
- Typecheck: `Scope: 5 of 6 workspace projects`, all 5 `Done`.
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The tests catch mistakes. Each change made on its own in the code, then the two new test files
  run (15 tests): applying skips the `before` check, 2 fail; `readAt` lets `__proto__`,
  `constructor`, `prototype` through, 1; writing changes the object in place, 10; comparing counts
  the order of fields, 1; uses left round up, 2; uses left go below 0, 2; one use more than left
  is allowed, 1; regaining goes below 0, 1; a level is stored for a condition without levels, 1;
  no `unchanged` refusal, 1; a toggle's default is read the wrong way round, 3; a level above the
  maximum is allowed, 1; a condition already had is added again, 1; the label is dropped, 5; the
  schema lets one path sit inside another, 2; the schema lets an unsafe step through, 1. Each was
  undone, and the files compared equal to their copies.
- Two of those changes first passed every test: comparing by the order of fields, and the unsafe
  steps (`readAt` was safe through `Object.hasOwn` alone except for a last step `__proto__`). Two
  tests were added for them: an entry whose list items have their fields in another order, and the
  path `['state', '__proto__']`.

Differences from §3:
- A `notEnough` refusal also carries `key`, and a `badLevel` refusal `id`, so a refusal names
  what it is about.
- §3 item 4 gained a test that values compare as JSON, with fields in any order (above).

Against the row and its notes: the ENG-29 note left open what spending does with a maximum below 0
or not whole. Uses left are `floor(max) - spent`, never below 0 (§4). The ADR 014 item 10 note's
"label" is the entry's `action` and `subject` keys plus the optional `label`, the name in each
language the content has.

Found, not fixed:
- A key may be any camelCase word, so `constructor`, `toString` or `valueOf` pass
  `entityKeySchema`, and a record read by such a key gets what every object has. Measured: a
  Tales stat of Ash's own keyed `constructor`, with no base score, computes
  `abilities.constructor.score` as the text `"0function Object() { [native code] }"`, with no
  `noBaseScore` warning. New row ENG-40 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-40 Keys every object has · XS

**Hat:** A content key never reads a field every object has
**Where:** `packages/schema/src/ids.ts` — changes: `entityKeySchema` refuses the names every
object has, listed in a new `RESERVED_KEYS`; `packages/schema/test/keys.test.ts` — new
**Depends on:** ENG-02 (`entityKeySchema`), ENG-30 (`UNSAFE_PATH_STEPS`, the measurement in its
§11), ENG-27 (Tales: Ash)
**Screen:** No

**What it should look like when done:**
1. `RESERVED_KEYS` (`@grimoire/schema`) lists 8 names: the 7 camelCase names `Object.prototype`
   has (`constructor`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`,
   `toLocaleString`, `toString`, `valueOf`), and `prototype`. The test measures the 7 from
   `Object.getOwnPropertyNames(Object.prototype)` at run time.
2. `entityKeySchema` refuses each of the 8, with one issue whose message is `Is the name of a
   field every object has; a key never is.` It still takes `str`, `san`, `sleightOfHand`, `d20`,
   and a longer word holding one of the names: `toStrings`, `myConstructor`, `prototypes`,
   `valueOfGold`. A key it refused before (`Str`, `1st`, `''`) still gives one issue.
3. Every place that takes a key refuses them, at the key's own path: an entity's `key` (`key`);
   a character's `abilities.base.toString`, `state.resources.constructor`, `notes.valueOf`.
4. The pack's JSON Schema (`packJsonSchemaOf`) refuses a Tales pack with a stat keyed `toString`,
   as Zod does; the same stat keyed `tough` passes both.
5. ENG-30's measurement: Ash with a stat of its own keyed `constructor` and no base score no
   longer opens. `openTalesCharacter` refuses it at `localEntities.0.key`. Before, it opened, and
   `compute()` gave `abilities.constructor.score` the text `"0function Object() { [native code]
   }"`, with no `noBaseScore` warning.
6. Every step of `UNSAFE_PATH_STEPS` (ENG-30) is refused as a key, so a resource's key is always
   a step a log entry's path may take: `useResource` never refuses a key the schema took with
   `badPath`.
7. The quality gate is green.

**Choices (ADR 002):**
- **The schema refuses the names; the readers do not change.** One place covers every record
  read by a key: today the base phase's `abilities.base[key]` (`stats.ts`), later a module's or a
  screen's. A pack's author is told at import, at the key, instead of getting a stat that
  computes a text. Reading with `Object.hasOwn` would fix one reader and leave each new one to
  remember.
- **`prototype` is refused too,** though a plain object lacks it: ENG-30's log entry refuses the
  step, so a resource keyed `prototype` could never be spent.
- **The list is written out, and the test measures it.** The JSON Schema needs a fixed pattern;
  the test compares the list with the runtime's `Object.prototype`, so a name the language adds
  fails the test.
- **A second pattern, with a lookahead:** `^(?!(?:constructor|…)$)`. The exported JSON Schema
  carries the check, as it carries ENG-05's, and the issue's message says why the key is refused.
- **Entity type names and computed paths keep the plain camelCase step.** No record is read by a
  type or a path from content today: the engine reads paths through `Map`s (§11). An entity id
  embeds the type's pattern in a template literal, where a lookahead ending in `$` would not hold.
- **Nothing stored changes.** Dexie has no table yet (`apps/web/src/db/db.ts`: `stores({})`), so
  no saved character or pack holds such a key, and no migration is needed.

**Tests:** `packages/schema/test/keys.test.ts` — `describe('ENG-40 a key is never a field every
object has')`: items 1–6. Control: the runtime's `Object.prototype` names; ENG-27's Ash; ENG-30
§11's measurement.
**What came out of it:**

Measured:
- Before: `entityKeySchema` took `constructor`, `hasOwnProperty`, `isPrototypeOf`,
  `propertyIsEnumerable`, `toLocaleString`, `toString`, `valueOf` and `prototype`. Ash with a
  stat of its own keyed `constructor` opened through `openTalesCharacter`, and `compute()` gave
  `abilities.constructor.score` `"0function Object() { [native code] }"`, with no `noBaseScore`
  warning: ENG-30's measurement, repeated. A Tales pack with a stat keyed `constructor` parsed.
  `pnpm test`: `Test Files 28 passed (28)`, `Tests 279 passed (279)`, 4.27 s.
- `Object.getOwnPropertyNames(Object.prototype)` gave 12 names; 7 are camelCase. The other 5
  (`__proto__`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`)
  were already refused by the camelCase pattern.
- After: `pnpm test`: `Test Files 29 passed (29)`, `Tests 285 passed (285)`, 4.44 s.
  `keys.test.ts` alone: `Tests 6 passed (6)`, 1.06 s.
- Lint: `Checked 111 files`, no error. Typecheck: `Scope: 5 of 6 workspace projects`, all 5
  `Done`. Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The tests catch mistakes. Each change made on its own, then `keys.test.ts` run: no second
  pattern, 5 of 6 fail; the pattern without its closing `$` (so `toStrings` is refused too), 2;
  `prototype` left out of the list, 2. Each was undone, and `ids.ts` compared equal to its copy.

Differences from §3: none.

Found, not fixed:
- A computed path takes any camelCase step (`computedPathSchema`), so an override's path or an
  effect's target may be one step such as `toString`. `compute()` handles it: Ash with an
  override of `toString` opens, and gets `overrideNoPath`. But `Computed.values` and
  `Computed.breakdown` are plain objects: `values['toString']` and `breakdown['toString']` give
  a function, not `undefined`. Nothing reads them by a stored path today. New note for phase 2
  in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-31 The fifth-edition package · XS

**Hat:** The fifth-edition module is a package the core cannot import
**Where:** `packages/system-5e/` — new: `package.json`, `tsconfig.json`, `src/index.ts`,
`test/tsconfig.json`, `test/system.test.ts`; `biome.json` — the engine's import list gains a
second pattern, and a new override covers `packages/schema/src/**`;
`packages/engine/test/purity.test.ts` — a sample can sit in any package; `CLAUDE.md` — the
layout, the dependency line, the golden-test path, the module invariant; `pnpm-lock.yaml`
**Depends on:** ENG-01 (the import rule and its test), ENG-24 (`systemIdSchema`), ADR 004 item 2
**Screen:** No

**What it should look like when done:**
1. A workspace package `@grimoire/system-5e` lives in `packages/system-5e`. It depends on
   `@grimoire/schema` and `@grimoire/engine`, never the other way. Its `tsconfig.json` is the
   engine's: `lib: ["ES2022"]`, `types: []`.
2. It exports `FIFTH_EDITION_SYSTEM = '5e'`, the `system` id its packs and characters name.
   The id passes the core's `systemIdSchema`.
3. Names (`CLAUDE.md`: no "D&D" in names, "5E compatible" is the only phrase for fifth edition):
   `system-5e` and `5e` hold no "D&D" or "dnd"; ADR 004's example `dnd5e` is not used. Every
   system module is a `packages/system-<id>` package named `@grimoire/system-<id>`, so one lint
   pattern covers every module to come.
4. `pnpm lint` fails when a file in `packages/schema/src` or `packages/engine/src` imports a module:
   by name (`@grimoire/system-5e`, a path inside it, a later `@grimoire/system-<id>`), by
   `import type`, `export … from` or a dynamic `import()`, or by a relative path that climbs into
   `packages/system-<id>/`. The message starts with `ENG-31`.
5. The engine keeps every ENG-01 refusal: `react`, `dexie`, `../../../apps/…` still fail with
   the `ENG-01` message (a second override replaces the engine's list, measured, so the pattern
   joins the engine's own list).
6. Its own files stay allowed in the core: `./system.ts` and a file named `./system-lists.ts`.
7. `CLAUDE.md`'s layout lists the package, its dependency line reads
   `schema ← engine ← system-5e ← content, pdf, foundry ← apps/web`, and its golden-test path
   is `packages/system-5e/test/golden/`.
8. The quality gate is green; CI runs the same lint (SETUP-03), so CI fails in each case of
   item 4.

**Tests:** `packages/engine/test/purity.test.ts` — `describe('ENG-31 the core cannot import a
system module')`: one sample linted as a file of `packages/schema/src` and of
`packages/engine/src`; the ENG-01 tests unchanged. `packages/system-5e/test/system.test.ts` —
`describe('ENG-31 the fifth-edition module')`: the id. Control numbers: the line numbers of the
refused lines in the sample, written by hand.
**What came out of it:**

Measured, with the package in place and the old `biome.json`:
- A file in `packages/schema/src` and one in `packages/engine/src`, each importing
  `../../system-5e/src/index.ts`: lint `Checked 2 files`, no error; the engine's `tsc` exit 0.
  The climb ENG-01 found was open.

After:
- The same two files: lint `Found 2 errors`, each `× ENG-31: the core knows no game …`.
- Lint: `Checked 116 files`, 0 errors (111 before).
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done` (5 before).
- Test: `Test Files 30 passed (30)`, `Tests 288 passed (288)`, 4.66 s (before: 29 files,
  285 tests). The two changed files alone: 9 passed.
- The module's `tsconfig.json` refuses `document` (TS2584) and `process` (TS2591), exit 1.
- The tests bite. Each guard removed on its own, 8 tests in `purity.test.ts` each time: the
  `packages/schema/src/**` override, 1 fails; the engine's ENG-31 pattern, 1; `**/system-*/**`,
  2; `@grimoire/system-*`, 2; the pattern moved into one override for both packages instead of
  the engine's own list, 1. In a scratch copy, that shared override placed after the engine's
  replaced the engine's whole list: `react` and `../../../apps/…` passed lint.

Differences from §3:
- `@grimoire/system-*/**` was dropped from the pattern: `**/system-*/**` already refuses a path
  inside a module by name. Removed, the 8 tests still pass; item 4 holds without it.

Technical choices (ADR 002):
- **The id is `5e`, the package `@grimoire/system-5e`.** ADR 004 item 3's example `dnd5e` is
  "D&D" in letters, and `CLAUDE.md` allows no "D&D" in names; a pack file carries its `system`
  id to whoever it is shared with. `5e` follows the one allowed phrase, "5E compatible". ADR 004
  is left as written; `CLAUDE.md`'s layout names the id.
- **`packages/system-<id>` for every module.** One pattern then covers every module to come,
  with no list to keep. A core file named `system-<x>.ts` stays allowed (`./system-lists.ts`
  in the test); a core folder named `system-<x>/` would be refused.
- **Lint, the ENG-01 way (ADR 004 item 2).** A Biome override replaces the rule's whole list for
  a file, so the engine's override carries the ENG-31 pattern as a second entry; `schema`, which
  had no import rule, gets an override with the pattern alone. An import the engine's ENG-01
  list also refuses (`@grimoire/system-5e`) reports both messages.
- **A bare folder (`../../system-5e`) is left to typecheck.** The pattern does not match it, but
  the package has no `index.ts` at its root, so `tsc` refuses it: `TS2307: Cannot find module
  '../../system-5e'`, measured.
- **`apps/web` does not depend on the module yet.** The first code that uses the module adds it.
- **`CLAUDE.md`'s engine line drops rests:** ADR 004 item 1 gives a module its actions, rests
  among them; the module's line names them.

Found, not fixed:
- Lint does not hold the module's code to the engine's purity rules. A file in
  `packages/system-5e/src` importing `dexie` and using `Math.random()` and `globalThis` gives one
  lint error, `noGlobalEval` for its `eval`, from Biome's recommended set. New row ENG-41, before
  ENG-32 writes code there.
- A core file can still climb into another sibling package: `export * from
  '../../content/src/index.ts'` in `packages/schema/src` or `packages/engine/src` passes lint,
  measured. `content` holds nothing today; once it imports the module, that climb reaches the
  module with no error. New note for phase 3 in `BACKLOG.md`.
- SPEC §4 (layout, dependency line), §6.3 (`packages/engine/src/rulesets/`) and Appendix A
  (`packages/engine/test/golden`) still name the engine. The SPEC is not edited; `CLAUDE.md`
  says it wins.

Nothing for the changelog.

---

### ENG-41 The module's purity lint · XS

**Hat:** Lint holds the fifth-edition module to the engine's purity rules
**Where:** `biome.json` — the engine's denied globals and its `Math.random` plugin cover
`packages/system-*/src/**` too, and a new override gives the modules their own import list;
`biome/no-math-random.grit` and the ENG-01 global messages name the modules;
`packages/engine/test/purity.test.ts` — a sample can sit in `packages/system-5e/src`;
`packages/system-5e/src/index.ts` — the ticket's comment
**Depends on:** ENG-01 (the engine's rules and their test), ENG-31 (the package), ADR 004 item 1
("compute steps (pure TypeScript)")
**Screen:** No

**What it should look like when done:**
1. Today a 10-line file in `packages/system-5e/src` importing `dexie`, `react` and
   `../../../apps/…`, and using `Math.random()`, `globalThis`, `document`, `fetch`, `eval` and
   `new Function`, gives lint `Found 1 error`: `noGlobalEval` on the `eval` line (measured).
   After: every one of those lines is refused.
2. `pnpm lint` fails when a file in `packages/system-<id>/src` imports anything but its own
   files (`./…`, `../…`), `@grimoire/schema`, `@grimoire/engine` and `zod`: a UI, storage,
   network or any other library, another `@grimoire/…` package (`@grimoire/content`,
   `@grimoire/web`, another module), a path into `apps/` or `node_modules/`; by `import`,
   `import type`, `export … from` or a dynamic `import()`. The message starts with `ENG-41`.
3. The same file fails lint on every global the engine refuses (`globalThis`, `self`, the DOM,
   storage and network names: `ENG-01`; `eval`, `Function`: `ENG-07`) and on `Math.random`
   (`ENG-08`). One list in `biome.json` serves the engine and the modules; its messages name
   both.
4. A module file importing `@grimoire/schema`, `@grimoire/engine`, `zod`, `./rulesets/2024.ts`
   and `../shared.ts` and using `Math.max` passes lint.
5. The engine keeps every ENG-01, ENG-07, ENG-08 and ENG-31 refusal: the existing tests in
   `purity.test.ts` pass with only the reworded messages changed.
6. The quality gate is green; CI runs the same lint (SETUP-03).

**Tests:** `packages/engine/test/purity.test.ts` — `describe('ENG-41 a system module is held to
the engine's purity rules')`: an import sample, the engine's globals sample, `eval`/`Function`,
`Math.random` and an allowed sample, each linted as `packages/system-5e/src/Sample.ts`. Control
numbers: the line numbers of the refused lines in each sample, written by hand.
**What came out of it:**

Measured before, a 10-line file in `packages/system-5e/src` (`dexie`, `react`,
`../../../apps/…`, `Math.random()`, `globalThis`, `document`, `fetch`, `eval`, `new Function`):
lint `Found 1 error`, `noGlobalEval` on line 9.

After:
- The same file: `Found 10 errors`; every line but the plain `export` (line 4) is refused,
  `eval` twice (`noGlobalEval` and the ENG-07 message).
- Lint: `Checked 116 files`, 0 errors.
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 30 passed (30)`, `Tests 292 passed (292)`, 3.91 s (before: 30 files, 288
  tests). `purity.test.ts` alone: 12 passed.
- The tests bite. Each guard removed on its own, 12 tests in `purity.test.ts` each time: the
  module's import override, 1 fails; `packages/system-*/src/**` dropped from the shared
  globals override, 2; the `Math.random` plugin dropped from it, 2; each entry of the module's
  list (`!zod`, `!@grimoire/engine`, `!@grimoire/schema`, `!./**`, `!../**`, `**/apps/**`,
  `**/node_modules/**`), 1 each.

Differences from §3: none. The test for the globals counts the rule's lines and the message
text, not the message as a title: Biome prints `noRestrictedGlobals`' own message as a note
under "Do not use the global variable …", in both reporters.

Technical choices (ADR 002):
- **`packages/system-*/src/**`, not `packages/system-5e/src/**`.** Every module to come is held
  to the same rules with no edit, as ENG-31's one pattern refuses every module in the core.
- **One list of denied globals for the engine and the modules.** The engine's override was split:
  its imports stay its own; its globals and the `Math.random` plugin moved to an override that
  includes both folders. Biome merges overrides that set different rules (measured: the ENG-01
  import tests still pass). The ENG-01 and ENG-08 messages now name "the engine and the system
  modules"; the ENG-08 test's text changed with it. Reversing it: copy the globals list back into
  the engine's override and into the module's.
- **The module's own import list**, since a list replaces the engine's for a file (ENG-31 §11):
  the engine's entries plus `!@grimoire/engine` and `!zod` (`zod` for ENG-32's schemas; the
  package does not depend on it yet). Every other `@grimoire/…` package is refused by `**`,
  another module included, so the module never imports `content`, `pdf`, `foundry` or the app.
- **The tests sit in `packages/engine/test/purity.test.ts`**, beside ENG-01's and ENG-31's: they
  test `biome.json`, and that file already copies it into a scratch folder where a sample can sit
  in any package.

Found, not fixed:
- A module file may climb into a sibling package: `export * from '../../content/src/index.ts'`,
  `'../../system-tales/src/index.ts'` and `'../../engine/src/compute.ts'` in
  `packages/system-5e/src` pass lint, measured; `!../**` allows them. The engine has the same
  gap (ENG-31). Added to the phase 3 note in `BACKLOG.md`.
- No test holds the module's `tsconfig.json` to the language alone, as ENG-01's typecheck test
  holds the engine's. `pnpm typecheck` refuses `document` in the module only while its
  `lib: ["ES2022"]` and `types: []` stay. New row ENG-42.

Nothing for the changelog.

### ENG-42 The module's typecheck test · XS

**Hat:** A test holds the module's tsconfig to the language alone
**Where:** `packages/engine/test/purity.test.ts` — ENG-01's typecheck test runs on every
`packages/system-*` module too; `packages/system-5e/tsconfig.json` — the ticket's comment
**Depends on:** ENG-01 (the engine's typecheck test), ENG-31 (the package and its tsconfig)
**Screen:** No

**What it should look like when done:**
1. Today a 6-line file in `packages/system-5e/src` naming `document`, `window`, `process`,
   `fetch`, `localStorage` and `Math.max` fails `tsc -p packages/system-5e/tsconfig.json` on
   lines 1–5 (TS2584, TS2304, TS2591, TS2304, TS2304), exit 1 (measured). But with
   `"lib": ["ES2022", "DOM"]` in that tsconfig, the gate stays green: typecheck `Done`,
   `Tests 292 passed (292)` (measured). After: that change fails `pnpm test`.
2. A test types the same 6-line sample as `packages/<module>/src/Sample.ts` with the module's own
   `tsconfig.json`, for each `packages/system-*` folder, and expects errors on lines 1–5 and none
   on line 6.
3. The test fails if no `packages/system-*` folder is found, or if `system-5e` is missing.
4. ENG-01's engine typecheck test keeps its sample and its expected lines.
5. The quality gate is green.

**Tests:** `packages/engine/test/purity.test.ts` — `describe('ENG-42 a system module's code sees
the language alone')`. Control numbers: the line numbers of the sample's lines that name
something outside ES2022, written by hand.
**What came out of it:**

Measured before: §3 item 1. The 6-line sample fails `tsc` on lines 1–5, exit 1; with
`"lib": ["ES2022", "DOM"]` in the module's tsconfig, typecheck `Done` and `Tests 292 passed
(292)`.

After:
- Lint: `Checked 116 files`, no errors.
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 30 passed (30)`, `Tests 294 passed (294)`, 4.71 s (before: 30 files, 292
  tests). `purity.test.ts` alone: 14 passed (before: 12).
- The test bites. Each break on its own, then reverted:
  - `"lib": ["ES2022", "DOM"]` in `packages/system-5e/tsconfig.json`: the ENG-42 typecheck test
    fails, `expected [ 3 ] to deeply equal [ 1, 2, 3, 4, 5 ]` (only `process` is refused).
  - `"types": ["node"]`, with `@types/node` linked into the module's `node_modules/@types`: it
    fails, `expected [ 1, 2 ]` (Node's types let `process`, `fetch` and `localStorage` through).
  - The folder filter matching nothing: "finds the modules" fails; 13 tests run.

Differences from §3: none.

Technical choices (ADR 002):
- **Every `packages/system-*` folder, read from disk**, not `system-5e` by name. A module to come
  is held with no edit, as ENG-41's lint pattern holds it. A module folder with no
  `tsconfig.json` stops the whole test file as it loads (`cpSync` throws), which is wanted: every
  module has its own.
- **The module's own `node_modules` is linked in**, as the engine's is: a type package the module
  installs would really load (the second break shows it).
- **One sample for the engine and the modules.** ENG-01's test reads it from the shared constant;
  its expected lines did not change.
- **The test sits in `packages/engine/test/purity.test.ts`**, beside ENG-01's, as ENG-41's did:
  that file already copies the configs into a scratch folder where a sample can sit in any
  package.

Found, not fixed: nothing.

Nothing for the changelog.

---

### ENG-32 The fifth-edition entity types

**Hat:** The fifth-edition entity types have Zod schemas
**Depends on:** ENG-24 (the three steps a module takes), ENG-04 (`grantBaseSchema`,
`chooseEntitiesSchema`), ENG-11 (`GrantView`), ENG-31 and ENG-41 (the package and its lint)
**Size:** M
**Screen:** No
**SPEC:** §5.2 (`EntityType`, `Ruleset`), §5.3, §5.5; ADR 004 items 1, 3; ADR 014 items 5–7

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/entity-types.ts` — new. Fifth edition's 15 entity types
and its union by `type`.
- `packages/system-5e/src/system.ts` — new: fifth edition's lists, its grant kinds `spell` and
  `item`, and its schemas from ENG-24's `systemSchemasOf`.
- `packages/system-5e/src/index.ts` — changes: exports both files.
- `packages/system-5e/package.json` — changes: depends on `zod`; `pnpm-lock.yaml` with it.
- `packages/schema/src/grant.ts` — changes: `withFixedOrChoose` is exported, and the core's
  `entity` and `proficiency` kinds use it.
- `packages/schema/src/entity-base.ts` — changes: `listWithUnique` also takes a number field.
- `packages/system-5e/test/entity-types.test.ts` — new.

#### 2. What is missing now

- The module exports one constant: `grep -n "export" packages/system-5e/src/index.ts` prints
  `export const FIFTH_EDITION_SYSTEM = '5e';` and nothing else.
- No fifth-edition type exists. `grep -rn "'spell'\|'class'\|'species'" packages/*/src` finds
  only comments in `packages/schema/src/grant.ts`.
- No system lists `2014` and `2024`: the core's `rulesetIdSchema` takes any kebab-case id.
- `packages/system-5e/package.json` has no `zod`, which ENG-41's lint already allows.
- `pnpm test`: `Test Files 30 passed (30)`, `Tests 294 passed (294)`.

#### 3. What it should look like when done

1. `@grimoire/system-5e` exports `fifthEditionLists`, `fifthEdition` (ENG-24's
   `systemSchemasOf` result), `spellGrantSchema`, `itemGrantSchema`, a `…DefSchema` and a type for
   each of its 15 types, `spellcastingDefSchema`, `fifthEditionEntitySchema` and the type
   `FifthEditionEntity`, and the numbers `MAX_LEVEL` (20) and `MAX_SPELL_LEVEL` (9).
2. **The lists** (SPEC §5.2, §5.3, §5.5): editions `2014`, `2024`; proficiency categories
   `skill`, `save`, `armor`, `weapon`, `tool`, `language`; proficiency levels `0.5`, `1`, `2`;
   recovery events `short`, `long`, `dawn`, `turn`, `manual`. `2020` is refused on `ruleset`,
   `feat` on a proficiency's `category`, `3` on its `level`, `scene` on a recovery's `on`.
3. **The `spell` grant** takes `fixed?` (entity ids), `choose?` (the core's
   `chooseEntitiesSchema`), `ability?` (a stat key), `alwaysPrepared?` and `uses?` (the system's
   `usesDefSchema`: a granted spell's own uses, cast with no slot, ADR 014 item 7). It needs
   `fixed`, `choose` or both. `ability: 'choice'` passes only as a stat named `choice`.
4. **The `item` grant** takes `fixed?` (a list of `{ id, qty }`, `qty` a whole number from 1, no
   id twice) and `choose?`. It needs `fixed`, `choose` or both.
5. **The union** picks by `type` among 18 types, in this order: the core's `ability`, `skill`,
   `condition`; then `species`, `lineage`, `class`, `subclass`, `background`, `feat`,
   `feature`, `spell`, `item`, `language`, `damageType`, `weaponProperty`, `weaponMastery`,
   `toolKind`, `rule`. `monster` is refused on `type`.
6. **Each type's fields** are SPEC §5.3's, with the changes of §4. Every object is strict;
   parsing adds nothing, so a valid entity parses to an equal object.
7. **What grants already say is not a field** (§4 table): `ClassDef.levels[].features`,
   `SubclassDef.levels`, `SubclassDef.alwaysPrepared`, `SpeciesDef.traits`, `SpeciesDef.lineages`,
   `BackgroundDef.abilityOptions`, `originFeat` and `feature`, `FeatureDef.origin` and
   `FeatureDef.uses` are each refused as unknown fields.
8. **A `rule` has a topic** (ADR 014 item 5): `topic` (a key) is needed, `icon` (a key) is
   optional.
9. **A spell's scaling fits its level** (ADR 014 item 6): `scaling` needs `kind` and `formula`;
   `kind: 'cantrip'` only on a level-0 spell, `kind: 'slot'` only on level 1 to 9. Each wrong pair
   is refused on `scaling.kind`.
10. **Numbers the rules bound** (§8): a class's `hitDie` is 6, 8, 10 or 12; a level is 1 to 20; a
    spell's level is 0 to 9; a level column has 20 numbers.
11. **Checks that catch a wrong entry**, each refused on the path named: a `distance` range
    without `distance`, or another range with it (`range.distance`); a `timed` duration without
    `value` and `unit`, or another duration with them (`duration`); `mCost` or `mConsumed`
    without `m` (`components`); a `weapon` block on an item that is not a weapon, or a weapon
    without one (`weapon`); the same for `armor` (`armor`); a long range below the normal one
    (`weapon.range.long`); a class level given twice (`levels.<n>.level`); a multiclass grant whose
    id is one of the class's own grants (`multiclass.grants.<n>.id`); an empty `speed`; a spell
    list with neither `classKey` nor `tag`; an empty `multiclass`.
12. **Keys other entities name are needed:** `class`, `subclass`, `language`, `damageType`,
    `weaponProperty`, `weaponMastery`, `toolKind` refuse an entity without `key`.
13. **The core reads fifth edition's entities.** `FifthEditionEntity` is assignable to the
    engine's `GatherableEntity` (`pnpm typecheck`). A feat whose `spell` grant chooses from a
    filter is pending in `compute()` with the spells the filter finds as options; once chosen, its
    items pass through in `grants[].chosen` and no spell is gathered (ENG-11's note).
14. `z.toJSONSchema(fifthEditionEntitySchema)` runs and gives 18 options, each with
    `additionalProperties: false` and `ruleset` as an `enum` of `2014`, `2024`, `any`.
15. The quality gate is green.

#### 4. How to do it

1. `grant.ts`: `withFixedOrChoose(grant)` adds the refinement and its JSON Schema that the core's
   `entity` and `proficiency` kinds have today; both use it. `entity-base.ts`: `listWithUnique`'s
   field may hold a number.
2. `system.ts`: `fifthEditionLists = systemListsOf({...})`; the two grant kinds as
   `grantBaseSchema.safeExtend` with `withFixedOrChoose`; `fifthEdition =
   systemSchemasOf(fifthEditionLists, [spellGrantSchema, itemGrantSchema])`.
3. `entity-types.ts`: each type is `fifthEdition.entityBaseSchema.safeExtend({ type, … })`;
   the checks of §3 item 11 are `refine`s; `fifthEditionEntitySchema =
   systemEntitySchemaOf(fifthEdition, [...])`.
4. The tests of §7. Test entities are made up (`hb-test`), so they hold no rules fact.

**What grants already say is not a field.** The core gathers what an entity gives only from its
`grants` (ENG-11), and ENG-04 made SPEC §5.5's `feature` and `feat` kinds one `entity` kind. A
field listing the same entities would be read by no code, or by a second path that could disagree
with the grants and give a wrong number with no error. Each such SPEC field is written as a grant:

| SPEC §5.3 field | Written as |
|---|---|
| `ClassDef.levels[].features` | `entity` grants of the class, with `atLevel` |
| `SubclassDef.levels[].features` | `entity` grants of the subclass, with `atLevel` |
| `SubclassDef.alwaysPrepared` | `spell` grants with `alwaysPrepared: true` and `atLevel` |
| `SpeciesDef.traits` | an `entity` grant, `fixed` |
| `SpeciesDef.lineages` | an `entity` grant that chooses one of the lineage ids |
| `BackgroundDef.abilityOptions` | an `abilityScore` grant, `mode: 'distribute'` |
| `BackgroundDef.originFeat`, `.feature` | an `entity` grant, `fixed` |
| `FeatureDef.origin` | the grant that gives the feature (`HadEntity.from`), its `atLevel` |
| `FeatureDef.uses` | a `resource` grant, whose maximum ENG-29 computes |

Adding a field later needs no migration; removing one would. Measured, `FeatureDef.origin` also
cannot hold the SRD: one trait belongs to several species (§8).

Technical choices (ADR 002):
- **Fields the SRD leaves empty are optional**, measured in §8: a species' `creatureType` (no
  2014 race has one); a lineage's `size`, `speed`, `creatureType` (no 2014 subrace or 2024
  subspecies has them; SPEC calls the lineage "the same shape"); a class's `primaryAbilities`
  (no 2014 class has them); a weapon's `damage` (the Net has none); each part of `multiclass`
  (2014 sorcerer and wizard, 2024 monk, sorcerer and wizard give no proficiencies), which needs
  at least one part.
- **A material's cost is `{ amount, unit }`**, an item's `cost` shape, not SPEC's bare number:
  measured, the SRDs price materials in `gp` and in `cp` (§8).
- **A list that may be empty is absent instead**: a weapon's `properties` is optional and holds
  one or more; the morningstar has none, so `[]` and a missing field would say the same.
- **`ability: 'choice'` is not taken.** It does not say among which stats; the 2024 SRD's three
  such entries name three (§8). A choice there is a second choice in one grant, which `choices`
  keys by grant. The wider form joins with the import (phase 3); widening needs no migration.
- **A level column has 20 numbers**, index 0 for level 1, so a third-caster subclass from level
  3 writes zeros, and nothing is guessed. A slot table row holds the slots of levels 1 to 9; a
  pact magic row has slots at one level only (§8: warlock 5 has 2 of level 3, 0 of the others).
- **No `rulesets/` file:** both editions share every shape. `ruleset` on an entity is data.
- **Open keys stay keys** where SPEC writes `string`: a school, a size, a creature type, a
  rarity, a damage type, a weapon property or mastery, an area's shape, a feat's category, a
  rule's topic and icon. Homebrew adds its own; the SRD's values are the import's.
- **The JSON Schema loses the `refine` checks**, as ENG-04's did before ENG-05. ENG-38 publishes
  the file and adds them (its note).

#### 5. Stored data

Nothing stored changes. No fifth-edition pack or character is stored yet; the core's open
schemas are unchanged.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/entity-types.test.ts` — `describe('ENG-32 fifth-edition entity
  types')`: every type parses to an equal object; the lists; both grant kinds; the type list;
  each change of §4 refused; the topic; scaling by level; the bounds; each check of §3 item 11;
  needed keys; the core's view and a pending `spell` choice through `compute()`; the inferred
  types; the JSON Schema export.
- Control values from: SPEC §5.2–§5.5 field lists; the bounds measured in §8; ADR 014 items 5–7.
  Test entities are made up and hold no rules fact.

#### 8. Checked against the source

Source: 5e-bits/5e-srd-api at commit `e6edf9a` (the one ENG-02 measured),
`packages/5e-database/src/{2014,2024}/en/`, read with `jq`. Both data sets are SRD 5.1 and
SRD 5.2.1 (CC-BY-4.0).
- **Hit dice.** `5e-SRD-Classes.json`, `hit_die`: 2014 and 2024 alike, barbarian 12; bard,
  cleric, druid, monk, rogue, warlock 8; fighter, paladin, ranger 10; sorcerer, wizard 6. The set
  is {6, 8, 10, 12}.
- **Levels.** `5e-SRD-Levels.json`, `level`: 1 to 20 in both.
- **Spell levels.** `5e-SRD-Spells.json`, `level`: 0 to 9 in both. SRD 5.1 (`5e-SRD-Rules.json`):
  "A cantrip is a spell that can be cast at will, without using a spell slot and without being
  prepared in advance." Fire Bolt grows "when you reach 5th level" (2014) and "when you reach
  levels 5 … 11 … and 17" (2024); Fireball "for each slot level above 3rd" (2014), "for each spell
  slot level above 3" (2024). So `cantrip` scaling reads the character's level, `slot` the slot.
- **Casting times.** 2014: `1 action`, `1 bonus action`, `1 reaction`, `1 minute`, `10 minutes`,
  `1 hour`, `8 hours`, `12 hours`, `24 hours`. 2024 adds a text after a reaction or bonus action
  ("Reaction, which you take when …"), and Plant Growth's "Action (Overgrowth) or 8 hours
  (Enrichment)". Units: action, bonus, reaction, minute, hour; values whole. The text goes in
  `note`.
- **Ranges.** `Self`, `Touch`, `Sight`, `Special`, `Unlimited`, and distances in feet and miles
  (`1 mile`, `500 miles`). A distance is stored in feet (SPEC §7.5).
- **Durations.** `Instantaneous`, `Until dispelled`, `Special`, and `round`, `minute`, `hour`,
  `day` with whole numbers (`1 round` … `30 days`). 2024 also has "Until dispelled or triggered"
  (2 spells): see §11.
- **Coins.** Equipment costs use `cp`, `sp`, `gp`; SRD 5.1's rules add "The electrum piece (ep)
  and the platinum piece (pp)". Material costs: 2014, 55 in `gp`; 2024, 60 in `GP` and 1 in `CP`
  ("worth 1+ CP").
- **Armor and weapons.** 2014 `armor_category`: Light 3, Medium 5, Heavy 4, Shield 1; Medium caps
  Dexterity at 2, Heavy adds none (`dexCap` 0), Light has no cap (`null`). `weapon_category` and
  `weapon_range`: Simple and Martial, Melee and Ranged. One weapon has no `damage`: `net` (2014).
  The morningstar's `properties` is `[]` (2014). In both, no long range is below its normal range.
- **Species.** 2014 races: `size`, `speed`, no creature type (0 of 9). 2024 species: `type`
  Humanoid in all 9; the tiefling chooses Small or Medium. No 2014 subrace or 2024 subspecies has
  a size or speed. 2014 traits with more than one race: `darkvision` (dwarf, elf, gnome,
  half-elf, half-orc, tiefling), `fey-ancestry` (elf, half-elf); 2024, 40 traits, among them
  `darkvision-60` (dragonborn, elf, gnome, tiefling).
- **Classes.** 2014 classes have no `primary_ability`; 2024 classes have one. Every class has
  2 saving throws. Warlock 5 (2014): `spell_slots_level_3: 2`, every other slot level 0.
  Multiclassing: sorcerer and wizard (both), monk (2024) give no proficiencies; the fighter's
  prerequisite is "Strength 13 or Dexterity 13" (`prerequisite_options`, `choose: 1`), which the
  core's `formula` prerequisite holds.
- **A spell grant's stat.** 2024 `elven-lineage`, `gnomish-lineage`, `magic-initiate`:
  "Intelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with
  this trait (choose the ability when you select the lineage)."

#### 9. Not in this ticket

- The fifth-edition pack schema, its `systemSchemaVersion` and its JSON Schema file: ENG-33 sets
  the version, ENG-38 the file.
- The fifth-edition part of the character (a species' size, a class's level and subclass, which
  lineage): ENG-33. A lineage is now an `entity` grant's choice (noted on ENG-33).
- What a `spell` or `item` grant gives a character, and where a granted spell's spent uses are
  kept: ENG-15, ENG-20. Which class's grants apply to a later class in a multiclass: ENG-13.
- Reading the class table (`@classes.<key>.table.<column>`), the spell slots, the defaults of a
  stat: ENG-13 to ENG-16.
- The SRD's entities, their import and its mapping: ENG-09, ENG-10 (fixtures), phase 3 (import).
- Names on screen for the open keys of §4: phase 2 and 3 (§11).

#### 10. Rake check

- **Each system's rules live in its own module.** Every type, list and kind is in
  `packages/system-5e`; the core gains one helper and one wider type, and names no game.
- **No `if (ruleset === …)`.** Both editions share every shape; no rule of one edition is coded.
- **Everything is data.** No stat, skill, class or spell is named in code; stats in a spell grant,
  a class's saves and a spell's save are keys, so `san` works like `str`.
- **Formulas never run code.** Scaling, uses, prepared counts and damage are text here.
- **Missing is not broken.** A schema checks shape; an id or key naming nothing is valid here.
- **Stored units are feet and pounds.** Speeds, ranges and areas are feet; weight is pounds.
- **Ids are stable; a stored-shape change needs a migration.** Nothing is stored yet; the core's
  open schemas parse what they parsed before (ENG-04's tests pass unchanged).
- **Licensing.** Test entities are made up. §8 quotes the SRDs (CC-BY-4.0); no other text.
- **No "D&D" in names.** Every name is "fifth edition" or `5e`.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `entity-types.test.ts` alone: `Tests 13 passed (13)`, 883 ms.
- Lint: `Checked 119 files`, no errors (116 before; 3 new files).
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 31 passed (31)`, `Tests 307 passed (307)`, 4.70 s (before: 30 files, 294
  tests).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The core's JSON Schema did not change with `withFixedOrChoose`: `z.toJSONSchema` of
  `entityBaseSchema`, `grantSchema`, `prerequisiteSchema`, `coreEntitySchema`, `usesDefSchema`,
  the three core types and `effectSchema`, written to one file before and after: 122,975 bytes
  each, `cmp` finds no difference. ENG-04's tests pass unchanged.
- The tests bite. Each guard removed on its own, 13 tests run each time: scaling by level, 1
  fails; a range's distance, 1; a timed duration, 1; a material's parts, 1; the item blocks, 1;
  the long range, 1; a class level twice, 1; a multiclass grant's id, 1; at least one speed, 1; a
  spell list's field, 1; a part of `multiclass`, 1; the hit dice, 1; the level bound, 1; a
  column's length, 1; a slot row's length, 1; the spell level bound, 1; `toolKind`'s key, 1; the
  class's key, 1; the rule's topic, 1; weapon properties not empty, 1; a lineage's optional size
  and speed, 2; an optional creature type, 1; the proficiency levels, 1; the recovery events, 1;
  the editions, 2; fixed-or-choose on the `spell` grant, 1, and on the `item` grant, 1; a
  quantity from 1, 1; an item id once, 1; the system's recovery events in a spell grant's uses,
  1; the module's grant kinds dropped, 4; `withFixedOrChoose`'s check, 2. `hitDie` as any whole
  number: `pnpm typecheck` fails with `TS2344` on the `expectTypeOf` line.
- The JSON Schema, checked with ajv (`Ajv2020`) on `z.toJSONSchema(fifthEditionEntitySchema, {
  io: 'input' })`: the 21 test entities pass. It keeps the unknown fields, at least one speed, a
  spell list's field, a part of `multiclass`, and fixed-or-choose. It loses 10 checks: a range's
  distance by its kind, a duration's value and unit by its kind, a material's cost and use by
  `m`, the `weapon` block by category, the `armor` block by category, a long range below the
  normal one, a class level twice, a multiclass grant id that is the class's own, scaling by
  level, an item grant's id twice. Noted on ENG-38.

Differences from §3: none.

Against the row and the SPEC:
- Each point of the row's note is done: the `spell` and `item` kinds on `grantBaseSchema`,
  `chooseEntitiesSchema` and the system's `usesDefSchema` (§3 items 3–4); a rule's topic (item 8);
  a spell's scaling (item 9); a granted spell's own uses (item 3); a kind's `choose` read by
  `compute()`, pending, then passed through (item 13).
- ADR 014 item 6 says ENG-32 keeps `scaling` "required wherever a spell's damage grows". A schema
  cannot see that damage grows; `scaling` is the one field that says it, its `formula` is needed,
  and its kind must fit the level. ENG-09 and ENG-10 write it on each fixture spell that grows.
- SPEC §5.3 departs in the ways §4 lists: the fields that list given entities are grants; fields
  the SRD leaves empty are optional; a material's cost has a unit; `'choice'` is not taken.

Found, not fixed:
- The JSON Schema loses 10 of the module's checks (above). Noted on ENG-38.
- SRD values these schemas cannot hold yet, measured at `e6edf9a`: 2014's `mounts-and-vehicles`
  equipment (40 entries) has no `ItemDef.category`; 2024's "Until dispelled or triggered" (2
  spells) has no place for "or triggered"; 2024's three spell grants that choose their stat among
  three (§8). New note for phase 3 in `BACKLOG.md`.
- A class's own `grants` apply whether it is the first class or a later one; the SRD data keeps a
  later class's proficiencies apart (`multi_classing.proficiencies`, §8). Noted on ENG-13.
- A lineage is an `entity` grant's choice and a background's feat an `entity` grant, both kept in
  `choices`; SPEC §5.8's `species.lineage` and `feats[].via` would be a second place. Noted on
  ENG-33.
- A `spell` grant's `uses` have no key, so its spent count needs one. Noted on ENG-20.
- Keys with no entity type to give their name on screen: a spell's `school`, a species' `size`
  and `creatureType`, an item's `rarity`, an area's `shape`, a feat's `category`, a rule's `topic`
  and `icon`. New note for phases 2–3 in `BACKLOG.md`.
- ENG-09 and ENG-10 write SPEC §5.3's given-entity fields as grants. Added to their note.

Nothing for the changelog.

---

### ENG-33 The fifth-edition character

**Hat:** The fifth-edition part of the character document has a schema
**Depends on:** ENG-06 (`characterSchemaOf`, `systemData`, the migration frame), ENG-39 (the
module's version on a pack), ENG-32 (the entity union), ENG-26 (`rollRecordSchema`)
**Size:** S
**Screen:** No
**SPEC:** §5.8, §8.4; ADR 004 and its §5.8 row; ADR 009 item 5; ADR 010 items 7, 12; ADR 013
items 9, 10; ADR 014 items 1, 8

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/character.ts` — new. Fifth edition's part of a character
(`systemData`), its house rules, its character schema and opener.
- `packages/system-5e/src/pack.ts` — new: the fifth-edition pack schema and opener.
- `packages/system-5e/src/system.ts` — changes: `FIFTH_EDITION_SYSTEM` (moved from `index.ts`),
  `FIFTH_EDITION_SCHEMA_VERSION`, `HIT_DIE_SIZES`, `COINS`.
- `packages/system-5e/src/entity-types.ts` — changes: a class's `hitDie` reads `HIT_DIE_SIZES`, a
  cost's `unit` reads `COINS`; `levelSchema` is exported.
- `packages/system-5e/src/index.ts` — changes: exports the two new files.
- `packages/system-5e/test/character.test.ts` — new.

#### 2. What is missing now

- The module has no character and no pack: `grep -rn "characterSchemaOf\|packSchemaOf\|systemData"
  packages/system-5e/src` prints nothing.
- No fifth-edition field of SPEC §5.8 has a schema: house rules, the score method, species,
  background, classes, feats, spells, inventory, coins, hit points, hit dice, slots, death saves,
  concentration, inspiration. ADR 014 item 8's fields (XP or milestone, inspiration as a count with
  a maximum, the method's key and rolls, the ability bonus source, which feats may be taken) have
  no place either.
- The module has no version of its stored shape, for its characters or its packs (ENG-39 §9).
- `pnpm test`: `Test Files 31 passed (31)`, `Tests 307 passed (307)`.

#### 3. What it should look like when done

1. `@grimoire/system-5e` exports `FIFTH_EDITION_SCHEMA_VERSION` (`1`),
   `FIFTH_EDITION_CHARACTER_MIGRATIONS` and `FIFTH_EDITION_PACK_MIGRATIONS` (both empty),
   `HIT_DIE_SIZES` (`[6, 8, 10, 12]`), `COINS` (`['cp', 'sp', 'ep', 'gp', 'pp']`), `DEATH_SAVES`
   (`3`), `levelSchema`, `houseRulesSchema`, `fifthEditionDataSchema`,
   `fifthEditionCharacterSchema`, `openFifthEditionCharacter`, `fifthEditionPackSchema`,
   `openFifthEditionPack`, and the types `HouseRules`, `FifthEditionData`, `FifthEditionCharacter`,
   `FifthEditionPack`.
2. A fifth-edition character is ENG-06's core part with `system: '5e'`, `systemSchemaVersion: 1`,
   a `ruleset` of `2014` or `2024`, ENG-32's entities in `localEntities`, and this `systemData`.
   Every field is required but `species`, `background` and those marked `?`:
   - `houseRules` (SPEC §8.4, ADR 013 item 9, ADR 009 item 5): `hitPointMethods` — the ways a
     level's hit points may be taken, of `roll`, `avg`, `max`, at least one, none twice;
     `abilityMax` — a whole number from 1; `feats` — `none`, `own`, `ownAndOtherOptional` or `all`;
     `multiclass` — true or false; `encumbrance` — `none`, `simple` or `variant`;
     `skillAbilitySwap` — true or false; `inspirationMax` — a whole number from 1.
   - `abilities`: `method` — a key; `rolls?` — ENG-26 roll records, at least one; `bonusSource` —
     `species`, `background` or `both`.
   - `advancement`: `mode` — `xp` or `milestone`; `xp` — a whole number from 0.
   - `species?`: `{ id, size? }`, `size` a key. `background?`: `{ id }`.
   - `classes`: `{ id, subclass?, level, hp }` in the order taken, no id twice; `level` 1 to 20;
     `hp` one entry per level, each a whole number from 1 to 12, `avg` or `max`; the levels add up
     to 20 at most.
   - `feats`: `{ id, replaces? }`, no id twice and no `replaces` twice; `replaces` is an
     `<entityId>#<grantId>`.
   - `spells`: a class or subclass id → `{ known?, prepared? }`, at least one of the two, each a
     list of spell ids with at least one and none twice.
   - `inventory`: `{ uid, itemId?, custom?, qty, equipped, attuned, container?, note? }`; `uid` a
     lowercase UUID, none twice; exactly one of `itemId` and `custom` (`{ name, weight? }`); `qty`
     a whole number from 0; `container` another row's `uid`, never the row's own, and no loop.
   - `currency`: `cp`, `sp`, `ep`, `gp`, `pp`, each a whole number from 0, all five.
   - `state`: `hp` — `{ current, temp }`, whole numbers from 0; `hitDiceSpent` — `d6`, `d8`, `d10`,
     `d12` → a whole number from 0; `slotsSpent` — `1` to `9` → a whole number from 0;
     `pactSlotsSpent` — a whole number from 0; `deathSaves` — `{ success, failure }`, each 0 to 3;
     `concentration?` — a spell id; `inspiration` — a whole number from 0, at most
     `houseRules.inspirationMax`.
3. Refused, each on its own path: a 2014 rules base written `any` (`ruleset`); `systemSchemaVersion:
   2`; an empty `hitPointMethods` and `roll` twice (`systemData.houseRules.hitPointMethods`);
   `feats: 'some'`; a bonus source `race`; empty `rolls`; a class twice (`classes.1.id`); level 0
   and 21 (`classes.0.level`); `hp` one entry short, an entry of 0 or 13, `'roll'` as an entry
   (`classes.0.hp`, `classes.0.hp.<n>`); levels adding up to 21 (`classes`); a feat twice
   (`feats.1.id`); `replaces` twice (`feats.1.replaces`); a `replaces` with no `#<grantId>`; a
   spell entry with neither list, an empty list, a spell twice (`spells.<id>.known.1`); a row with
   both or neither of `itemId` and `custom` (`inventory.<n>`); a `uid` twice (`inventory.1.uid`); a
   `container` that is no row, the row itself, or a loop of two (`inventory.<n>.container`); a
   missing coin (`currency.ep`); an unknown coin; hit dice `d20` and a slot level `10` (as unknown
   keys); `hp.current` −1; a death save count 4 (`state.deathSaves.failure`); inspiration 4 with a
   maximum of 3 (`state.inspiration`); any unknown field.
4. A fifth-edition pack is ENG-05's pack with `system: '5e'`, `systemSchemaVersion: 1`, ENG-32's
   entity union, and a `ruleset` of `2014`, `2024` or `any`. Refused: `systemSchemaVersion: 2`, an
   entity of a type the module lacks.
5. Both open through the migration frame with two chains (ENG-06, ENG-39): a current file opens
   with `from: { schemaVersion: 1, systemSchemaVersion: 1 }`; `systemSchemaVersion: 2` is refused as
   `newer` with `current: 1`.
6. The core reads it. `FifthEditionCharacter` is assignable to the engine's
   `CharacterCore<FifthEditionEntity>` (`pnpm typecheck`). `compute()`, with a module made in the
   test that reads `systemData`, gathers the species, the background, each class at its own level
   and the feats, with no warning.
7. Inferred types: `ruleset` is `'2014' | '2024'`; `systemSchemaVersion` is `1`; an `hp` entry is
   `number | 'avg' | 'max'`; `currency` is `Record<'cp' | 'sp' | 'ep' | 'gp' | 'pp', number>`.
8. ENG-32's tests pass unchanged, with `hitDie` and a cost's `unit` read from `HIT_DIE_SIZES` and
   `COINS`.
9. The quality gate is green.

#### 4. How to do it

1. `system.ts`: `FIFTH_EDITION_SYSTEM` (moved), `FIFTH_EDITION_SCHEMA_VERSION`, `HIT_DIE_SIZES`,
   `COINS`. `index.ts` keeps its ENG-31 comment and re-exports.
2. `entity-types.ts`: `z.literal(HIT_DIE_SIZES)`, `z.enum(COINS)`; `export const levelSchema`.
3. `character.ts`: the house rules, each part of `systemData`, the data schema with its checks
   across fields, the character schema, its opener with the module's (empty) steps.
4. `pack.ts`: `packSchemaOf` with the module's version and union; `packOpenerOf` with its own
   (empty) steps.
5. The tests of §7.

Technical choices (ADR 002):
- **What a grant gives is kept in `choices`, not in a field** (ENG-32 §11). A lineage is an
  `entity` grant's choice, so SPEC §5.8's `species.lineage` is left out. A feat a background, a
  species or a class gives is a grant (`via` `origin`, `species`, `class`). `feats` keeps the feats
  no grant gives: one taken in place of an ability score improvement, and one given by hand.
- **A feat in place of an improvement names the grant it stands in for** (`replaces`,
  `<entityId>#<grantId>`), where SPEC has `via: 'asi'` and `atLevel`. A 2024 class gives one
  Ability Score Improvement feature at several levels (§8), so only the grant names one slot; the
  grant has the level. A feat with no `replaces` is SPEC's `bonus` or `custom`. dnd5e keeps this
  choice on the class's advancement the same way (§8).
- **`species.size` is the size chosen** from the species' list (ENG-32 keeps the list on the
  species). A species with one size needs none.
- **A level's hit points are a number, `avg` or `max`**, dnd5e's three values (§8). SPEC has
  `number | 'avg'`; `max` is the first class's first level, and the house rule `max`. A number is
  at most 12, the largest hit die; whether it fits the class's own die needs the pack, which a
  schema does not read: ENG-14 warns.
- **`classes` is in the order taken.** The first is the first class: its saving throws (ENG-13's
  note) and its first level's hit points.
- **House rules are the module's** (ENG-06 §4) and required: a default changed later never changes
  a saved character. SPEC §8.4's list, with three changes. The method list holds any of SPEC's
  three ways, so a table allowing two needs no new value. `feats` is one scale: SPEC §8.4's "feats
  allowed (2014)" is `none`, ADR 013 item 9's three options are the rest. The point-buy budget is
  left out: ADR 010 item 12 makes a score method data, with "a pool the scores are taken from", so
  the budget is that method's (phase 4); a field added then needs no migration, a field removed
  would. Their default values are the rulesets' (§9).
- **The ability bonus source says `species`**, where ADR 014 item 1 writes `race`: it chooses
  between the `species` field and the `background` field, and the 2014 race is the `species` type
  (SPEC §6.3's first row). The screen says "race" for 2014 through i18n.
- **The method's rolls are ENG-26 roll records**: one shape for a roll, the one the table link
  sends, so a DM can see what was rolled.
- **XP stays in milestone mode.** `{ mode, xp }`, so switching back loses nothing.
- **Required booleans and counts** (`equipped`, `attuned`, `pactSlotsSpent`): one spelling per
  state (ENG-06 §4). **Spent counts are records from 0**, as ENG-06's `state.resources`.
- **A list that may be empty is absent instead** where a record holds it (`spells`), as
  `choices` does (ENG-06 §4). Lists that grow and shrink in play (`classes`, `feats`, `inventory`)
  may be empty, as ENG-06's `overrides` and `localEntities`.
- **Checks across fields are made where both fields are in the file**: inspiration under its
  maximum, a container that exists, the levels' total. A reference into a pack (a spell, a class,
  a size the species lacks) is not checked: missing is not broken.
- **The pack's schema is here; its JSON Schema file is ENG-38's.** Both files take the module's one
  version, each with its own steps (ENG-39 §4).
- **`FIFTH_EDITION_SYSTEM` moves to `system.ts`**: `character.ts` and `pack.ts` need it, and
  importing `index.ts` from them would be a loop.

#### 5. Stored data

A fifth-edition character and a fifth-edition pack get their first stored shape:
`systemSchemaVersion: 1`, with no steps. Nothing is stored yet: the Dexie database has no tables
(SETUP-06), `packages/content` builds no pack, and no screen makes a character. So nothing
migrates. The core's shapes do not change.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/character.test.ts` — `describe('ENG-33 fifth-edition character')`: a
  full character round trips; required and optional fields; empty lists; each refusal of §3 item
  3; the core reads it through `compute()`; the inferred types (`expectTypeOf`, checked by
  `pnpm typecheck`). `describe('ENG-33 fifth-edition files open through both chains')`: a current
  character and pack, a newer one, a pack refused.
- Control values from: SPEC §5.8, §8.4; ADR 014 item 8; the bounds in §8. Test content is made up
  (`hb-test`) and holds no rules fact.

#### 8. Checked against the source

Sources: 5e-bits/5e-srd-api at `e6edf9a`, `packages/5e-database/src/{2014,2024}/en/` (as ENG-32),
read with `jq`; foundryvtt/dnd5e at `7bfb3f1` (2026-10-01), `module/`. SRD 5.1 and 5.2.1 are
CC-BY-4.0. The 2024 rules chapters are not in the data set, and the SRD 5.2.1 PDF's host is
refused by this environment's network, so 2024 facts come from dnd5e, which checks both editions.
- **Death saves.** SRD 5.1 (`5e-SRD-Rules.json`, Death Saving Throws): "On your third success, you
  become stable … On your third failure, you die." dnd5e
  (`data/actor/templates/attributes.mjs`, `applyDeathSaveResult`): successes and failures are
  clamped to 0–3, one function for both editions. So each count is 0 to 3.
- **Levels.** dnd5e `config.mjs`: `DND5E.maxLevel = 20`; `data/item/class.mjs` caps a class's
  levels and the character's level (the sum of its classes) at it, for both editions. ENG-32 §8:
  class levels 1 to 20 in both SRDs.
- **Hit points per level.** dnd5e `documents/advancement/hit-points.mjs`: a level's value is
  `"max"` (the die's value), `"avg"` (`hitDieValue / 2 + 1`) or a number; level 1 of the original
  class is `"max"`. One advancement for both editions.
- **Ability score improvements.** 2014 (`5e-SRD-Features.json`): one feature per class per level,
  each its own id (`barbarian-ability-score-improvement-1` at level 4 to `-5` at 19): "you can
  increase one ability score of your choice by 2, or you can increase two ability scores of your
  choice by 1." 2014 feats: `grappler` only. 2024: one feature per class, given again at later
  levels ("You gain the Ability Score Improvement feat (see "Feats") or another feat of your choice
  for which you qualify. You gain this feature again at Barbarian levels 8, 12, and 16."). 2024
  feats that say "You can take this feat more than once": `ability-score-improvement`,
  `magic-initiate`, `skilled`. The 2024 backgrounds `acolyte` and `sage` give `magic-initiate`;
  the human's `versatile`: "You gain an Origin feat of your choice". dnd5e (`data/advancement/ability-score-improvement-data.mjs`): a class's improvement
  is filled with `type: "asi"` or `type: "feat"`; `documents/advancement/ability-score-improvement.mjs`
  allows the feat in 2014 only with the `allowFeats` setting, always in 2024.
- **Hit dice, coins, spell levels, pact slots, a species' sizes:** ENG-32 §8 (hit dice 6, 8, 10,
  12; `cp`, `sp`, `ep`, `gp`, `pp`; spell levels 0 to 9; a warlock's slots at one level; the 2024
  tiefling chooses Small or Medium).
- **Inspiration:** not checked here. The count and its maximum are ADR 014 item 8's shape; the
  SRD's text and the default maximum are ENG-19's §8.

#### 9. Not in this ticket

- The default values of the house rules (SPEC §8.4 "by the SRD"), inspiration's default maximum
  of 3 among them: ENG-19, the ruleset files.
- Fifth edition's `SystemModule` (its level, the entities it names, `derive`), and what a feat's
  `replaces` does to the grant: ENG-13.
- Hit points from `classes[].hp`, a size from `species.size`: ENG-14.
- The counts of known and prepared spells: ENG-15. The ability bonus source applied: ENG-35.
- The actions that change `state` (damage, slots, death saves, concentration, inspiration, rests):
  ENG-20, ENG-21. Level-up writing `classes`: ENG-36.
- Score methods as data, the point-buy budget, rolling: phase 4 (ADR 010 item 12).
- The pack's published JSON Schema: ENG-38.
- An entity given twice, such as a repeatable feat taken twice: §11.

#### 10. Rake check

- **A stored-shape change needs a migration.** The module's version is counted against its two
  lists of steps when each opener is built (ENG-06's frame). Nothing is stored yet (§5).
- **Each system's rules live in its own module; the core names no game.** Every field is in
  `packages/system-5e`; no core file changes.
- **Everything is data.** Stats are keys (`abilities.base`, `abilityMax` caps any stat); no
  ability or skill is named. Hit dice, coins and spell levels are module lists, each in one place.
- **No `if (ruleset === …)`.** Both editions share the shape; a house rule's default per edition
  is ENG-19's.
- **Missing is not broken.** An id naming nothing in a pack is valid here; only facts inside the
  file are checked.
- **Manual overrides always win.** Not touched: they are the core's `overrides`.
- **Stored units are feet and pounds.** A custom item's `weight` is pounds.
- **Licensing.** Test content is made up. §8 quotes the SRDs (CC-BY-4.0) and names dnd5e files.
- **No "D&D" in names.** Every name is "fifth edition" or `5e`.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `character.test.ts` alone: `Tests 13 passed (13)`, 1.19 s.
- Lint: `Checked 122 files`, no errors (119 before; 3 new files).
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 32 passed (32)`, `Tests 320 passed (320)`, 6.71 s (before: 31 files, 307
  tests). ENG-32's 13 tests pass unchanged with `hitDie` and a cost's `unit` read from
  `HIT_DIE_SIZES` and `COINS`.
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The tests bite. Each guard removed on its own, the new file run (13 tests): one hit points entry
  per level, 1 fails; the levels' total, 1; a grant replaced once, 1; a spell entry's one list, 1;
  `itemId` or `custom`, 1; a container that is a row, 1; no container loop, 1; inspiration under
  its maximum, 1; death saves up to 3, 1; a hit points number up to 12, 1; `equipped` required, 1;
  the hit dice keys, 1; the slot level keys, 1; all five coins, 1; at least one roll, 1; a hit
  point method once, 1. The character schema built with version 2: the file does not load (`The
  schema's "systemSchemaVersion" is 2, but its migrations lead to version 1.`). An `hp` entry as
  any text, and the bonus source as any key: `pnpm typecheck` fails with `TS2344` on the
  `expectTypeOf` line of each.
- The coins guard first had no failing test: the test wrote `ep: undefined`, which a full and a
  partial record both refuse. Measured with a probe test: a partial record takes a missing key and
  refuses a key that holds `undefined`. The test now leaves the key out.

Differences from §3:
- A spell twice is refused on its list (`spells.<id>.prepared`), not on its item: the list is the
  core's `uniqueList`, which reports there.
- `d20` is refused on its key (`state.hitDiceSpent.d20`); a slot level `0` or `10`, and an unknown
  coin, on the record (`state.slotsSpent`, `currency`). Zod reports a key outside a pattern on the
  key, and a key outside a list on the record.
- Two refusals carry a second path, also true: an inspiration maximum of 0 puts the count of 2
  above it (`state.inspiration`); one class at level 21 also takes the total above 20
  (`classes`).
- The tests also refuse SPEC's `species.lineage` and `feats[].via`, an unknown tracker
  (`exhaustion`, which is a core condition), a `uid` that is not a UUID, a `qty` of −1, and a
  custom name that is a space.

Against the row and the SPEC:
- Each point of the row's note is done: XP or milestone (`advancement`); inspiration as a count
  with `houseRules.inspirationMax`; the method's key and rolls; the bonus source; which feats may be
  taken (`houseRules.feats`); the module's one version on its packs, each with its own steps; a
  lineage and a background's feat left to `choices`; the species' size (`species.size`).
- SPEC §5.8 and §8.4 depart in the ways §4 lists: no `species.lineage`; `feats` is
  `{ id, replaces? }`; `hp` takes `max`; the house rules have no point-buy budget, and `feats` is
  one scale; `equipped`, `attuned` and `pactSlotsSpent` are required; the method is a key with its
  rolls; the bonus source says `species`.
- `FIFTH_EDITION_SYSTEM` moved from `index.ts` to `system.ts`; its name and value did not change.

Found, not fixed:
- An entity two grants give is gathered once, with one choice per grant (ENG-11): wrong for a feat
  taken twice. 2024 has three such feats, and Magic Initiate can come twice at level 1 (§8). No
  golden test of phase 1 takes a feat twice (SPEC §6.7: B has Alert and Savage Attacker, B4 one
  improvement). New note for phase 3 in `BACKLOG.md`.
- No row computes the character's size from `species.size`. Noted on ENG-14, with the hit points
  entries.
- How a feat's `replaces` leaves its grant out, and what the module names from `systemData`.
  Noted on ENG-13.
- The house rules' defaults are each ruleset's. Noted on ENG-19, with where 2024 rules text can
  and cannot be read from this environment (§8).
- The point-buy budget is the point-buy method's. New note for phase 4.
- The trackers' bounds the actions must keep. Noted on ENG-20. The bonus source's field. Noted on
  ENG-35. The pack ENG-38 publishes. Noted on ENG-38.

Nothing for the changelog.

---

### ENG-38 The published pack schema

**Hat:** The fifth-edition pack's JSON Schema is published as a file
**Depends on:** ENG-05 (`packJsonSchemaOf`), ENG-32 (the entity union, the 10 lost checks in its
§11), ENG-33 (`fifthEditionPackSchema`), SETUP-07 (the service worker), SETUP-08 (the deploy)
**Size:** S (re-cut from XS: §11)
**Screen:** No
**SPEC:** §5.7 (the published `/schema/pack.schema.json`); ADR 004 item 3

---

#### 1. Where the code lives

**Main file:** `apps/web/public/schema/5e/pack.schema.json` — new, written by its test.
- `apps/web/test/pack-schema.test.ts` — new: the file equals the module's JSON Schema.
- `apps/web/e2e/pack-schema.spec.ts` — new: the built app serves the file.
- `apps/web/e2e/service-worker.ts` — new: `waitForServiceWorker`, moved out of `pwa.spec.ts`.
- `apps/web/vite.config.ts` — changes: the service worker leaves `schema/` to the server.
- `apps/web/package.json` — changes: `@grimoire/system-5e` as a dev dependency; the lockfile.
- `packages/schema/src/pack.ts` — changes: `packJsonSchemaOf` takes a module's lines for the
  description and writes shared parts once, in `$defs`.
- `packages/system-5e/src/entity-types.ts` — changes: a JSON Schema form beside 5 refinements.
- `packages/system-5e/src/pack.ts` — changes: `fifthEditionPackJsonSchema`,
  `FIFTH_EDITION_CHECKS_LEFT_OUT`.
- `packages/system-5e/package.json` — changes: `ajv`, `ajv-formats` as dev dependencies.
- `packages/system-5e/test/entities.ts` — new: ENG-32's made-up entities, moved out of its test.
- `packages/system-5e/test/pack-json-schema.test.ts` — new.
- `biome.json` — changes: the written file is left out of formatting.
- `docs/RUNNING.md` — changes: how the file is rewritten.

#### 2. What is missing now

- `ls apps/web/public` prints `favicon.svg`. No schema file is built or served.
- `packJsonSchemaOf(fifthEditionPackSchema)`, written with 2-space indentation: 1,267,489 bytes,
  32,192 lines. Every shared part is written again where it is used. Without indentation:
  355,972 bytes.
- The JSON Schema loses 10 of the module's checks (ENG-32 §11). Its `description` names the core's
  3 lines only.
- The built `apps/web/dist/sw.js` holds `NavigationRoute(e.createHandlerBoundToURL("index.html")`
  with no denylist: every page address under `/MythWeld/` that the service worker controls is
  answered with the app's `index.html`.
- `pnpm test`: `Test Files 32 passed (32)`, `Tests 320 passed (320)`.

#### 3. What it should look like when done

1. `@grimoire/system-5e` exports `fifthEditionPackJsonSchema()` and `FIFTH_EDITION_CHECKS_LEFT_OUT`.
   `packJsonSchemaOf(packSchema, checksLeftOut?)` puts a module's lines after the core's 3 in
   `description`. Called with no lines, its `description` is ENG-05's, word for word.
2. `apps/web/public/schema/5e/pack.schema.json` is `fifthEditionPackJsonSchema()` as JSON, 2-space
   indentation, one final newline. `apps/web/test/pack-schema.test.ts` fails when the file and the
   schemas differ; run with `--update`, it rewrites the file.
3. The built app serves the file at `/MythWeld/schema/5e/pack.schema.json`, with a `content-type`
   of `application/json`, equal to the committed file. With the service worker in control, a
   page opened at that address gets the file, not the app (`pnpm e2e`).
4. Shared parts are written once, in `$defs`: the file is under 100,000 bytes.
5. Ajv (`Ajv2020`, strict but for `strictRequired`, with formats) accepts a pack holding ENG-32's
   21 made-up entities. In the JSON Schema alone, it refuses 6 of the 10 lost checks, each both
   ways where there are two: a range's `distance` by its kind; a duration's `value` and `unit` by
   its kind; `mCost` or `mConsumed` without `m`; the `weapon` block by category; the `armor` block
   by category; a spell's scaling by its level.
6. The other 4 are lines in the file's `description`, each refused by Zod and accepted by Ajv in
   the test: a long range below the normal one; a class level given twice; a multiclass grant id
   given twice or one of the class's own; an item grant's item given twice.
7. ENG-05's and ENG-40's tests pass unchanged on the made-up system's pack, now with `$defs`.
8. The file holds only ASCII bytes and no text from a book.
9. The quality gate is green, and `pnpm e2e`.

#### 4. How to do it

1. `packages/schema/src/pack.ts`: `packJsonSchemaOf(packSchema, checksLeftOut = [])`;
   `reused: 'ref'`; the id override writes the type's pattern next to a `$ref` as well.
2. `entity-types.ts`: a `.meta()` beside the range, duration, components, spell and item checks:
   `if`/`then`/`else` on the kind, category or level; `dependentRequired` for the material;
   `properties: { field: false }` for a field no other kind has.
3. `packages/system-5e/src/pack.ts`: the 4 lines and `fifthEditionPackJsonSchema()`.
4. ENG-32's test entities move to `test/entities.ts`; its test imports them.
5. `apps/web`: the dev dependency, the test that writes the file, `navigateFallbackDenylist`, the
   e2e spec. `biome.json` leaves the file out.
6. `docs/RUNNING.md`: one line on rewriting the file.
7. The tests of §7.

Technical choices (ADR 002):
- **One file per system, under `schema/<system id>/`.** SPEC §5.7 names `/schema/pack.schema.json`,
  written before ADR 004. A pack names one system (ADR 004 item 3), so each system has its own pack
  schema. The address a person puts in their editor stays the same when a second system comes.
- **The file is committed, and a test keeps it in step** (`toMatchFileSnapshot`). A change to the
  published schema shows in the commit that makes it, and the build needs no new step. In CI the
  test only compares; it never writes.
- **Shared parts once, in `$defs`** (`reused: 'ref'`), for every system's pack: 16 times smaller
  (§11). The names are Zod's own (`__schema0` …); no core schema has an id.
- **The service worker leaves `schema/` to the server.** Its navigation fallback would answer the
  file's address with the app.
- **Not precached.** The file is for editors and validators, not for the app offline; Workbox's
  list (`js`, `css`, `html`, `ico`, `png`, `svg`) already leaves `.json` out.
- **Biome leaves the file alone.** `JSON.stringify` writes it; a formatter that rewrites it would
  make the test fail.
- **`apps/web` takes the module as a dev dependency:** only its test reads it today.
- **Ajv in the module's tests**, as in the core's (ENG-05).

#### 5. Stored data

Nothing stored changes. The JSON Schema describes the stored pack; the Zod schemas parse what they
parsed before (the new forms are metadata).

#### 6. What a person will see

Not a screen. A person who writes a pack by hand can point an editor or a validator at
`https://<site>/MythWeld/schema/5e/pack.schema.json`.

#### 7. Tests

- `packages/system-5e/test/pack-json-schema.test.ts` — `describe('ENG-38 fifth-edition pack JSON
  Schema')`: §3 items 1, 4–6, 8.
- `apps/web/test/pack-schema.test.ts` — `describe('ENG-38 published pack schema')`: §3 item 2.
- `apps/web/e2e/pack-schema.spec.ts` — `ENG-38`: §3 item 3.
- `packages/schema/test/pack.test.ts`, `keys.test.ts` — unchanged: §3 item 7.
- Control values from: ENG-32 §11's list of the 10 lost checks; ENG-32's made-up entities
  (`hb-test`); the byte counts of §2.

#### 8. Checked against the source

Nothing to check: no rules fact. Each JSON Schema form says what a Zod check of ENG-32 already
says; Ajv proves each one in the test.

#### 9. Not in this ticket

- A published file for the locale overlay's JSON Schema: SPEC §5.7 publishes the pack's only.
- A `$schema` field inside a pack, so that an editor finds the file without a setting: §11.
- A check of the file on the public site in CI's `deploy` job: GitHub Pages serves every file of
  `dist`, and the e2e test checks the build.
- Readable names in `$defs`: no core schema has an id.

#### 10. Rake check

- **The core names no game.** `packJsonSchemaOf` takes the module's lines as data; the `5e` path
  is the app's. No core file imports the module.
- **The module is pure TypeScript.** It returns the JSON Schema; the app's test writes the file.
- **Licensing; no rules text.** The test entities are made up (`hb-test`); the file holds the
  schema only (§3 item 8).
- **No "D&D".** The file's title is `Content pack`; its path says `5e`.
- **No external requests.** The app serves the file from its own host and fetches nothing.
- **Nothing invisible.** The file is checked to be ASCII (§3 item 8).
- **A stored-shape change needs a migration.** No stored shape changes (§5).

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `pack-json-schema.test.ts` alone: `Tests 4 passed (4)`, 1.01 s. `pack-schema.test.ts` alone, with
  `CI=true`: `Tests 1 passed (1)`, 444 ms.
- Lint: `Checked 127 files`, no errors (122 before; 5 new files; the written file is left out).
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 34 passed (34)`, `Tests 325 passed (325)`, 5.56 s (before: 32 files, 320
  tests), with and without `CI=true`. ENG-05's and ENG-40's 23 tests pass unchanged with `$defs`;
  ENG-32's 13 pass unchanged with the entities moved to `test/entities.ts`.
- Build: `apps/web build: Done`; `apps/web/dist/schema/5e/pack.schema.json` is 77,634 bytes.
- E2E: `12 passed (9.9s)` (before: 10). The new spec before the service worker change: the
  server alone gave the file, and with the worker in control the address answered
  `text/html;charset=utf-8`, the app. After: both pass; `dist/sw.js` holds
  `denylist:[/^\/MythWeld\/schema\//]`.
- The file: 77,634 bytes, 3,299 lines, 125 `$defs`, printable ASCII and line breaks only. The same
  schema written inline: 1,271,117 bytes, 16.4 times more. Its one `description` is the root's;
  `grep -c "hb-test\|Lantern"` on it gives 0.
- With `CI=true` and no file, the app's test fails (`Snapshot … mismatched`) and writes nothing.
  With `--update` it writes the file; a later change to the schemas (the title moved, below) made
  it fail again until rewritten.
- The tests catch mistakes. Each guard removed on its own, the three JSON Schema test files run
  (27 tests): the range form, 1 fails; the duration form, 1; the material form, 1; the item blocks
  form, 1; the spell's `slot` branch, 1; the pattern beside a `$ref`, 1 (ENG-05's `carries 8
  checks`); `reused: 'ref'`, 1; the module's lines, 2.
- The lockfile: 10 lines added, 0 removed (`ajv`, `ajv-formats` in the module; the module in
  `apps/web`).

Differences from §3 and §4:
- §4 item 2 named `if`/`then`/`else`. Biome's recommended `noThenProperty` refuses an object with
  a `then` key, and no file in the code silences a lint rule. The forms are `anyOf` of two
  branches (the value and what it needs; any other value and none of it), which refuse the same
  packs, measured by the 14 cases of the test.
- The id's pattern beside a `$ref` carries `type: 'string'`: Ajv's strict mode refuses a `pattern`
  there without one (`missing type "string" for keyword "pattern"`, `strictTypes`).
- The file starts with `$schema`, `title` and `description`, where a person opening it reads
  first; Zod's output puts them after `$defs`.
- `waitForServiceWorker` moved out of `pwa.spec.ts` so the new spec shares it; its body did not
  change.
- Re-cut from XS to S: the row's note asked for 10 checks, and the service worker had to be
  measured and changed.

Notes:
- The public site was not fetched: this container cannot reach its host (`docs/RUNNING.md`). CI's
  deploy publishes `apps/web/dist`, which holds the file.
- The `$defs` names are numbered in the order Zod meets the parts, so a new shared part renumbers
  the later ones and rewrites their `$ref` lines in the file. Readable, steady names need an `id`
  on the core's schemas.

Found, not fixed:
- A pack refuses `$schema`, so a pack file cannot name the published schema: Zod gives
  `unrecognized_keys` and Ajv `additionalProperty`, measured. New note for phase 5 in
  `BACKLOG.md`.

Changelog: one line. The public link serves the file.

---

### ENG-09 The 2014 fixtures

**Hat:** 2014 fixtures: every SRD entity golden A or C needs
**Depends on:** ENG-32 (the entity types), ENG-33 (the character, the pack), ENG-25
(`loadContentIndex`), ENG-11 and ENG-12 (gathering, stat scores), ENG-07 (`parseFormula`,
`parseRoll`)
**Size:** M
**Screen:** No
**SPEC:** §6.7 goldens A and C (the 2014 column), §5.1, §5.3, §5.5; ADR 016

---

#### 1. Where the code lives

**Main folder:** `packages/system-5e/test/golden/` — new. The golden tests' 2014 data (SPEC §6.7,
`CLAUDE.md`'s doc map).
- `golden/srd-2014.ts` — new: `srd2014`, the pack `srd-2014` as a file would hold it, with every
  SRD 5.1 entity goldens A and C need.
- `golden/characters-2014.ts` — new: `goldenA` and `goldenC2014`, the two characters.
- `golden/index.ts` — new: exports both files.
- `golden/fixtures-2014.test.ts` — new: the data is whole, agrees with itself, and gives what
  golden A says it gives.
- `docs/adr/016-golden-a-is-a-hill-dwarf.md` — new: the owner's answer on the dwarf (§8).

#### 2. What is missing now

- `ls packages/system-5e/test/golden` prints `No such file or directory`.
- No entity of a real book exists in the repository. `grep -rln "srd-2014:" packages --include=*.ts`
  finds one file, `packages/schema/test/entity-base.test.ts`, where `srd-2014:damageType/fire` is
  an id in a parse test.
- Golden A names a mountain dwarf; SRD 5.1 has none (§8). Its numbers are the hill dwarf's.
- `pnpm test`: `Test Files 34 passed (34)`, `Tests 325 passed (325)`.

#### 3. What it should look like when done

1. **The pack** `srd-2014` (`ruleset` `2014`, `system` `5e`, `systemSchemaVersion` 1, license
   CC-BY-4.0, `redistributable: true`) holds, every entity `ruleset: '2014'`, ids
   `srd-2014:<type>/<5e-database slug>` (SPEC §5.1):
   - the 6 stats and the 18 skills of SRD 5.1; Perception alone is `passive`;
   - the 16 languages;
   - the dwarf, the hill dwarf (a `lineage`) and their six traits;
   - the Acolyte and its feature Shelter of the Faithful;
   - the cleric, its three level-1 features, the Life domain and its two level-1 features;
   - the wizard and the paladin;
   - Bless and Cure Wounds; chain mail, the shield, the warhammer; the damage type bludgeoning and
     the weapon property versatile.
   65 entities. Every value in them is §8's.
2. **What each source gives is in its grants** (ENG-32 §4), with the grant ids each choice is kept
   under: the dwarf's `ability-scores` (+2 `con`), `traits`, `languages` (`common`, `dwarvish`)
   and `subrace` (one of `hill-dwarf`); the hill dwarf's `ability-scores` (+1 `wis`) and `traits`;
   Dwarven Combat Training's `weapons`; Tool Proficiency's `tools` (one of three); the Acolyte's
   `skills` (`insight`, `religion`), `languages` (two, any language) and `feature`; the cleric's
   `features-1` (at level 1), `armor`, `weapons`, `skills` (two of five); the Life domain's
   `features-1` and `domain-spells-1` (Bless and Cure Wounds, always prepared, at level 1); Bonus
   Proficiency's `armor` (`heavy`); the wizard's and the paladin's `armor`, `weapons`, `skills`;
   each class's `multiclass` (its prerequisites; its proficiencies as `multiclass-…` grants).
3. **Mechanics only where a golden value reads them:** Dwarven Toughness adds `@level` to
   `hp.max.bonus` (SPEC §5.4's own example); the shield adds 2 to `ac.bonus` when `@equipped`
   (SPEC §5.3's own example). Every other feature is its name only; its mechanics are phase 3's
   (SPEC §6.8).
4. **Golden A** is SPEC §6.7's character with ADR 016's hill dwarf: base scores 13, 10, 14, 8, 15,
   12; the dwarf with the hill dwarf chosen; the Acolyte; cleric 1 with the Life domain, hit points
   `max`; Medicine and Persuasion chosen; chain mail, a shield and a warhammer, equipped. Its tool
   and two languages are test data (mason's tools; Celestial, Elvish).
5. **Golden C (2014)** is wizard 3, then paladin 3, with no species and no background; scores
   that meet both classes' prerequisites (test data); the wizard's two skills chosen.
6. **The test, through the code a file goes through:**
   - the pack opens through `openFifthEditionPack` to an equal object, `from` `{ schemaVersion: 1,
     systemSchemaVersion: 1 }`; `loadContentIndex('5e', [srd2014])` loads it with no refusal and
     no warning;
   - every entity id a grant names, and every id a character names (species, background, class,
     subclass, item, a chosen entity), is in the pack;
   - every stat, skill and language key the pack names is a stat, skill or language of the pack;
     every damage type and weapon property a weapon names is one of the pack's;
   - every formula parses: `preparedCount` and effect values with `parseFormula`, weapon damage
     with `parseRoll`;
   - the counts §8 measured: 6 stats, 18 skills, 16 languages;
   - both characters open through `openFifthEditionCharacter`, each to an equal object.
7. **Through `compute()`**, with a module made in the test that only names what `systemData` names
   (as ENG-33's test):
   - golden A gathers 17 entities, the dwarf's and the hill dwarf's traits, the Acolyte's feature,
     the cleric's and the Life domain's features, with no warning and no pending choice;
   - golden A's proficiencies are the ones SPEC §6.7 names with their sources: skills Insight and
     Religion from the Acolyte, Medicine and Persuasion from the cleric; heavy armor from the Life
     domain; the warhammer from the dwarf;
   - golden A's scores are SPEC §6.7's: STR 13, DEX 10, CON 16, INT 8, WIS 16, CHA 12, each with
     its grant steps (the dwarf's +2, the hill dwarf's +1);
   - golden C is level 6, gathers the two classes with no warning, and its one pending choice is
     the paladin's `skills`: a first-class grant ENG-13 leaves out of a later class (its note).
8. ADR 016 records the owner's answer. No golden value changes.
9. The quality gate is green.

#### 4. How to do it

1. `srd-2014.ts`: the pack as one object, `satisfies z.input<typeof fifthEditionPackSchema>`,
   entities grouped by source with a comment naming each group's §8 source.
2. `characters-2014.ts`: both characters, `satisfies z.input<typeof fifthEditionCharacterSchema>`.
3. `fixtures-2014.test.ts`: the checks of §3 items 6–7.

Technical choices (ADR 002):
- **Whole at golden A's level, numbers only for golden C.** Golden A is a full level-1 sheet
  (hit points, armor class, speed, attacks, spells), so each of its sources gives everything SRD
  5.1 gives at level 1, choices included. Golden C checks the caster level, the slots and the
  proficiency bonus, so the wizard and the paladin carry what every character taking them gets
  (hit die, saves, subclass level, first-level proficiencies, spellcasting, multiclass) and no
  features: no golden C value reads one. Higher levels' features, starting equipment and the
  subclasses golden C never chooses are the import's (§9).
- **Proficiency keys are what an item says.** Armor: the armor groups `light`, `medium`, `heavy`,
  and `shield`. Weapons: the groups `simple`, `martial`, or a weapon's own `key` (`warhammer`).
  Tools: the tool's key (`masonsTools`). So ENG-14 and ENG-16 compare a proficiency with an item's
  `armor.group`, `weapon.group`, `category` or `key`, with no table between. ENG-32's made-up
  class already writes `fixed: ['light']`.
- **A key is the 5e-database slug in camelCase** (`animal-handling` → `animalHandling`,
  `crossbow-light` → `crossbowLight`); the id keeps the slug (SPEC §5.1).
- **Saves are `ClassDef.saves` only**, not also `save` proficiency grants: ENG-13 reads the first
  class's `saves` (its note), and a second place could disagree.
- **A slot row lists levels 1 to the last with slots** (`[4, 3]`); a level with none at all is
  `[]`. The schema allows any length to 9; a missing level has 0.
- **The pack id is `srd-2014`**, the import's (SPEC §5.7), so the goldens can run on the imported
  pack in phase 3 with the same ids. The data is test data: no package exports it and no build
  holds it.
- **`license.attribution` is left out.** SPEC Appendix В marks the attribution text
  `[ПРОВЕРИТЬ]` against the SRD PDF's legal page, which this environment cannot reach (§8). The
  import writes it.
- **The characters' house rules are test data**, not the editions' defaults (ENG-19 writes those).
- **Golden A's spell lists are empty.** No golden value names a chosen spell: the counts (prepared
  4, cantrips 3, slots 2) come from the class's data.

#### 5. Stored data

Nothing stored changes. Test data only; no schema changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/golden/fixtures-2014.test.ts` — `describe('ENG-09 2014 fixtures')`:
  §3 items 6–7.
- Control values from: SPEC §6.7 golden A (scores, proficiencies and their sources, with ADR
  016); the counts in §8. Test data: the tool, the languages, golden C's scores and skills.

#### 8. Checked against the source

Source: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214` (the commit ENG-02
measured; still its `HEAD` on 2026-10-02), `packages/5e-database/src/2014/en/`, read with `jq`.
The data set is SRD 5.1 (CC-BY-4.0).

**The dwarf** (the backlog's check, shown to the owner before the fixture was written):
- `5e-SRD-Subraces.json`: four subraces, `hill-dwarf`, `high-elf`, `lightfoot-halfling`,
  `rock-gnome`. No mountain dwarf; `grep -i mountain` over both editions' files finds only
  terrain.
- `dwarf` (`5e-SRD-Races.json`): speed 25, size Medium, +2 `con`; languages `common`, `dwarvish`;
  traits `darkvision`, `dwarven-resilience`, `stonecunning`, `dwarven-combat-training`,
  `tool-proficiency`; subraces `hill-dwarf`.
- `hill-dwarf`: +1 `wis`; trait `dwarven-toughness`: "Your hit point maximum increases by 1, and
  it increases by 1 every time you gain a level."
- 2024 (`src/2024/en/5e-SRD-Species.json`): `dwarf` has speed 30, traits `darkvision-120`,
  `dwarven-resilience`, `dwarven-toughness`, `stonecunning`, and `subspecies: []`.
- So golden A's +2 CON, +1 WIS, speed 25 and hit points 8 + 3 + 1 are the dwarf's and the hill
  dwarf's. The mountain dwarf is not openly licensed and cannot enter the repository. **The owner
  answered on 2026-10-02: golden A's character is the hill dwarf** (ADR 016). No value changes.

**Golden A's other sources:**
- Traits: Dwarven Combat Training gives `battleaxes`, `handaxes`, `light-hammers`, `warhammers`;
  Tool Proficiency chooses 1 of `smiths-tools`, `brewers-supplies`, `masons-tools`.
- `acolyte` (`5e-SRD-Backgrounds.json`): `skill-insight`, `skill-religion`; languages: choose 2
  from the whole language list (`resource_list_url: /api/2014/languages`); feature "Shelter of
  the Faithful" (no index of its own: its slug is its name's).
- `cleric` (`5e-SRD-Classes.json`): hit die 8; saves `wis`, `cha`; `light-armor`, `medium-armor`,
  `shields`, `simple-weapons`; choose 2 of History, Insight, Medicine, Persuasion, Religion;
  multiclass: Wisdom 13, `light-armor`, `medium-armor`, `shields`; spellcasting `wis` from level
  1; subclass `life`. Its spellcasting text: "a number of cleric spells equal to your Wisdom
  modifier + your cleric level (minimum of one spell)"; ritual casting with the spell prepared.
- `5e-SRD-Levels.json`, `cleric-1`: features `spellcasting-cleric`, `divine-domain`,
  `domain-spells-1`; cantrips 3; slots `[2]`. `life-1`: `bonus-proficiency` ("proficiency with
  heavy armor"), `disciple-of-life`. Divine Domain at level 1, so the cleric's subclass level is 1.
- `life` (`5e-SRD-Subclasses.json`): at `cleric-1`, `bless` and `cure-wounds`; "Once you gain a
  domain spell, you always have it prepared" (`domain-spells-1`).
- `bless`: level 1, enchantment, 1 action, 30 feet, V S M ("A sprinkling of holy water."), up to
  1 minute, concentration, not a ritual, classes cleric, paladin. `cure-wounds`: level 1,
  evocation, 1 action, Touch, V S, Instantaneous, classes bard, cleric, druid, paladin, ranger;
  its healing grows by 1d8 per slot level above 1st. Neither has damage, so neither has
  `scaling` (ADR 014 item 6 asks it where damage grows; §11).
- `5e-SRD-Equipment.json`: `chain-mail` Heavy, AC 16 with no Dexterity, Strength 13, stealth
  disadvantage, 55 lb, 75 gp. `shield` AC +2, 6 lb, 10 gp. `warhammer` Martial Melee, 1d8
  bludgeoning, versatile 1d10, 2 lb, 15 gp.
- `5e-SRD-Ability-Scores.json`: `str`, `dex`, `con`, `int`, `wis`, `cha` in that order, with
  their names. `5e-SRD-Skills.json`: 18 skills, each with its stat. `5e-SRD-Languages.json`: 16
  languages, 8 Standard and 8 Exotic.
- Passive Perception: SRD 5.1's rules (`5e-SRD-Rules.json`, Passive Checks; Hiding) compare a
  check with "the passive Wisdom (Perception) score"; no other passive skill is named.

**Golden C's classes:**
- `wizard`: hit die 6; saves `int`, `wis`; `daggers`, `darts`, `slings`, `quarterstaffs`,
  `crossbows-light`; choose 2 of Arcana, History, Insight, Investigation, Medicine, Religion;
  multiclass: Intelligence 13, no proficiencies; spellcasting `int` from level 1; Arcane
  Tradition at level 2. "Intelligence modifier + your wizard level (minimum of one spell)";
  rituals from the spellbook.
- `paladin`: hit die 10; saves `wis`, `cha`; `all-armor`, `shields`, `simple-weapons`,
  `martial-weapons`; choose 2 of Athletics, Insight, Intimidation, Medicine, Persuasion,
  Religion; multiclass: Strength 13 and Charisma 13, `light-armor`, `medium-armor`, `shields`,
  `simple-weapons`, `martial-weapons`; spellcasting `cha` from level 2; Sacred Oath at level 3.
  "Charisma modifier + half your paladin level, rounded down (minimum of one spell)"; no ritual
  casting section.
- Slots, levels 1 to 20: the cleric's and the wizard's rows are equal, measured row by row (from
  `[2]` at level 1 to `[4, 3, 3, 3, 3, 2, 2, 1, 1]` at 20), and so are their cantrips (3 to level
  3, 4 to level 9, 5 from level 10). The paladin's: none at level 1, `[2]` at 2, to `[4, 3, 3, 3,
  2]` at 19 and 20.

**Not reachable here:** the SRD 5.1 PDF (`media.wizards.com` is refused by this environment's
network, measured), so SPEC Appendix В's attribution text stays `[ПРОВЕРИТЬ]` (§4).

#### 9. Not in this ticket

- The 2024 entities of goldens B, B4, C and D: ENG-10.
- Fifth edition's module (its level, the entities it names, its stat defaults, `derive`) and the
  golden values it computes: ENG-13 to ENG-16, ENG-19. This ticket's test module only gathers.
- How a later class leaves out the first class's grants (golden C's paladin `skills`): ENG-13.
- The multiclass spell slot table and the rounding: ENG-15, ENG-19.
- Features above golden A's level, the wizard's and the paladin's features, the subclasses golden
  C never chooses, starting equipment, and every feature's mechanics but the two of §3 item 3:
  the import and its mechanics (phase 3, SPEC §6.8).
- The editions' house rule defaults: ENG-19.

#### 10. Rake check

- **The golden tests are the truth.** No expected value changes; golden A's scores are checked as
  SPEC §6.7 writes them. The dwarf was the owner's call (ADR 016).
- **`[ПРОВЕРИТЬ]` and measure, never estimate.** Every rules value is §8's, read from 5e-database
  with `jq`, not from memory.
- **Licensing.** Only SRD 5.1 (CC-BY-4.0) data; no mountain dwarf. Text is limited to names and
  one material component, from the SRD.
- **Everything is data.** No stat or skill is named in code; the fixture is data under `test/`.
- **Each system's rules live in its own module.** The fixture is in the fifth-edition module's
  tests; no core file changes.
- **Formulas never run code.** Every formula is parsed by ENG-07's parser in the test.
- **Stored units are feet and pounds.** Speed 25, range 30, weights 55, 6, 2.
- **No "D&D" in names.** The pack's title is "SRD 5.1".

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `fixtures-2014.test.ts` alone: `Tests 10 passed (10)`, 1.31 s.
- Lint: `Checked 131 files`, no errors (127 before; 4 new files).
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 35 passed (35)`, `Tests 335 passed (335)`, 7.35 s (before: 34 files, 325
  tests).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The pack holds 66 entities: 6 stats, 18 skills, 16 languages, 1 species, 1 lineage, 12
  features, 1 background, 3 classes, 1 subclass, 2 spells, 3 items, 1 damage type, 1 weapon
  property. Its grants name 15 entity ids and its entities 60 stat, skill, language, class,
  damage type and property keys; it holds 5 formulas and 2 roll formulas. Each count was worked
  out by hand before the run, and the run agreed.
- Through `compute()`: golden A gathers 17 entities with no warning and no pending choice; its
  scores are 13, 10, 16, 8, 16, 12 (CON 14 + 2 from the dwarf, WIS 15 + 1 from the hill dwarf);
  `hp.max.bonus` is 1 (Dwarven Toughness at level 1); its 18 proficiencies come from the sources
  SPEC §6.7 names. Golden C (2014) is level 6, gathers its two classes with no warning, and has one
  pending choice, `srd-2014:class/paladin#skills`.
- The tests bite. Five breaks, each on its own and restored (`cmp` equal after): the hill dwarf's
  +1 WIS made +2, 1 test fails (the scores); Stonecunning removed, 4 fail; `medicine` in the
  cleric's list written `medecine`, 2 (the keys, and golden A's choice is no longer an option);
  the cleric's prepared count made a formula that does not parse, 1; heavy armor given by the
  cleric too, 1 (the sources).
- The dwarf: the owner answered on 2026-10-02, hill dwarf. ADR 016 records it; no golden value
  changed.

Differences from §3:
- 66 entities, not 65: §3 miscounted. The test counts each type.
- The test module gives one value, `hp.max.bonus` from 0. Without it the core warns `noTarget` for
  Dwarven Toughness (measured: the first run failed on that warning), because no step gives the
  path. With it, the test also shows the trait's +1 of SPEC §6.7's 12 = 8 + 3 + 1. ENG-14 gives
  the module's hit points.
- The comments quote no SPEC text in Russian: the language rule.

Found, not fixed:
- A spell's healing has no field. Cure Wounds heals 1d8 + the modifier, 1d8 more per slot level
  above 1st (5e-database `heal_at_slot_level`); `damage` and `scaling` hold damage only, so the
  fixture writes neither. Noted on ENG-16 (ADR 014 item 6's spell dice).
- A spellcasting class has no level it starts at. In 2014 the paladin and the ranger cast from
  level 2; in 2024 from level 1 (5e-database `spellcasting.level`, measured). The paladin's slot
  row at level 1 is empty, but its prepared count, `max(1, …)` as the SRD writes it, gives 1 at
  paladin level 1. Noted on ENG-15.
- No code gives `@equipped`: `grep -rn equipped packages/engine/src` finds nothing. The shield's
  effect reads it (SPEC §5.3's example); an item's own effects need it per item (SPEC §5.6).
  Noted on ENG-14, with the proficiency keys of §4 that ENG-14 and ENG-16 compare with items.
- ENG-10 follows this ticket's conventions (§4). Noted on ENG-10.

Nothing for the changelog.

---

### ENG-10 The 2024 fixtures

**Hat:** 2024 fixtures: every SRD entity golden B, B4, C or D needs
**Depends on:** ENG-09 (its conventions, its test's checks), ENG-32 (the entity types), ENG-33
(the character, the pack), ENG-25 (`loadContentIndex`), ENG-11, ENG-12, ENG-17 and ENG-29
(gathering, stat scores, effects, resource maximums), ENG-07 (`parseFormula`, `parseRoll`)
**Size:** M
**Screen:** No
**SPEC:** §6.7 goldens B, B4, D and C (the 2024 column), §5.1, §5.3, §5.4, §5.5; §6.3's
exhaustion row

---

#### 1. Where the code lives

**Main folder:** `packages/system-5e/test/golden/` — changes. The golden tests' 2024 data.
- `golden/srd-2024.ts` — new: `srd2024`, the pack `srd-2024` as a file would hold it, with every
  SRD 5.2.1 entity goldens B, B4, C and D need.
- `golden/characters-2024.ts` — new: `goldenB`, `goldenB4`, `goldenC2024` and `goldenD`.
- `golden/character-parts.ts` — new: the house rules and untouched trackers both editions'
  characters share, moved out of `characters-2014.ts`.
- `golden/checks.ts` — new: ENG-09's checks of a pack and a character, moved out of
  `fixtures-2014.test.ts` so both editions' tests run them, and the test module that gathers.
- `golden/fixtures-2024.test.ts` — new: the data is whole, agrees with itself, and gives what
  goldens B, B4, C and D say it gives.
- `golden/characters-2014.ts`, `golden/fixtures-2014.test.ts` — change: they import the moved
  parts. No value and no expectation changes.
- `golden/index.ts` — changes: exports the 2024 files.

#### 2. What is missing now

- `ls packages/system-5e/test/golden` prints `characters-2014.ts fixtures-2014.test.ts index.ts
  srd-2014.ts`: no 2024 data.
- `grep -rln "srd-2024:" packages --include=*.ts` finds one file,
  `packages/schema/test/entity-base.test.ts`, where `srd-2024:feat/alert` is an id in a parse
  test.
- `pnpm test`: `Test Files 35 passed (35)`, `Tests 335 passed (335)`.

#### 3. What it should look like when done

1. **The pack** `srd-2024` (`ruleset` `2024`, `system` `5e`, `systemSchemaVersion` 1, license
   CC-BY-4.0, `redistributable: true`) holds, every entity `ruleset: '2024'`, ids
   `srd-2024:<type>/<5e-database slug>`:
   - the 6 stats and the 18 skills of SRD 5.2.1; Perception alone is `passive`;
   - the human and its three traits;
   - the Soldier; the feats Alert, Savage Attacker and Defense;
   - the fighter, its features of levels 1 to 4, the Champion and its two level-3 features;
   - the wizard and the paladin;
   - the condition exhaustion;
   - chain mail and the greatsword; the damage type slashing, the weapon properties heavy and
     two-handed, the weapon mastery graze.
   52 entities. Every value in them is §8's.
2. **What each source gives is in its grants** (ENG-32 §4), with the grant ids each choice is kept
   under: the human's `traits`; Skillful's `skills` (one of any skill); Versatile's `feat` (one
   origin feat); the Soldier's `ability-scores` (+2/+1 or +1/+1/+1 among `str`, `dex`, `con`),
   `feat` (Savage Attacker), `skills` (`athletics`, `intimidation`) and `tools` (one gaming
   set); the fighter's `features-1` to `features-4` (each at its level), `ability-scores-4` (at
   level 4: +2 to one stat or +1 to two), `armor`, `weapons`, `skills` (two of eight); Fighting
   Style's `feat` (one fighting style feat); Second Wind's `uses`; the Champion's `features-3`;
   each class's `multiclass` (its prerequisites; its proficiencies as `multiclass-…` grants).
3. **Mechanics only where a golden value reads them,** each as SPEC §5.4's catalogue writes it:
   - Alert: `init.bonus` add `@prof`;
   - Defense: `ac.bonus` add 1 when `@armor.worn`;
   - Second Wind: the resource `secondWind`, its maximum
     `@classes.fighter.table.secondWindUses`, one use back on a short rest, all on a long rest;
   - the fighter's table: `secondWindUses` and `weaponMastery`, levels 1 to 20;
   - Improved Critical: `crit.range` min 19;
   - Remarkable Athlete: `advantage` on `roll.init` and on `roll.skill.athletics`;
   - exhaustion: `maxLevel` 6, `d20.all.bonus` add `-2 * @conditions.exhaustion.level`,
     `speed.all.bonus` add `-5 * @conditions.exhaustion.level`.
   Every other feature is its name only; its mechanics are phase 3's (SPEC §6.8).
4. **Golden B** is SPEC §6.7's character: base scores 15, 13, 14, 8, 12, 10; the human, size
   Medium; the Soldier with +2 STR and +1 CON; Insight from Skillful; Alert from Versatile;
   fighter 1, hit points `max`; Perception and Survival; Defense; chain mail and a greatsword,
   equipped. Its gaming set is test data (playing cards).
5. **Golden B4** is golden B at fighter 4: the Champion; +2 STR at level 4; hit points `max`,
   then `avg` three times.
6. **Golden D** is golden B with exhaustion at level 2.
7. **Golden C (2024)** is wizard 3, then paladin 3, on the 2024 classes, with no species and no
   background; the scores and the wizard's skills are golden C (2014)'s test data.
8. **The test, through the code a file goes through** (ENG-09's checks, run on both editions):
   - the pack opens through `openFifthEditionPack` to an equal object; `loadContentIndex('5e',
     [srd2024])` loads it with no refusal and no warning;
   - every entity id a grant names, and every id a character names, is in the pack;
   - every stat, skill, language, class, damage type, weapon property and weapon mastery key the
     pack names is one of the pack's;
   - every formula parses: effects, `when`, resource maximums and recoveries, a `formula`
     prerequisite, with `parseFormula`; weapon damage with `parseRoll`;
   - the counts §8 measured: 6 stats, 18 skills;
   - the four characters open through `openFifthEditionCharacter`, each to an equal object.
9. **Through `compute()`**, with ENG-09's test module, which gives, besides what `systemData`
   names, the paths the fixture's mechanics read or change that only the module will give
   (ENG-13, ENG-14, ENG-16): each target from where it starts, `prof` +2, `armor.worn`, and a
   class's table column at its level, read from the class:
   - golden B gathers 12 entities with no warning and no pending choice; its proficiencies are
     SPEC §6.7's with their sources; its scores are STR 17, DEX 13, CON 15, INT 8, WIS 12, CHA 10,
     with the Soldier's +2 and +1; Alert gives `init.bonus` 2, Defense `ac.bonus` 1; Second Wind's
     maximum is 2;
   - golden B4 is level 4, gathers the Champion's two features with no warning and no pending
     choice; STR 19 (15, +2 Soldier, +2 at level 4); `crit.range` 19; Second Wind's maximum 3;
     `weaponMastery` 4;
   - golden D has exhaustion at level 2: `d20.all.bonus` −4, `speed.all.bonus` −10;
   - golden C (2024) is level 6, gathers the two classes with no warning, and its one pending
     choice is the paladin's `skills` (ENG-13's note).
10. ENG-09's test passes unchanged: 10 tests, the same expectations.
11. The quality gate is green.

#### 4. How to do it

1. `checks.ts`: ENG-09's helpers, moved as they are, and widened where 2024 needs it: a weapon's
   `mastery` is a key the pack must have; a `formula` prerequisite and a recovery amount are
   formulas. The test module is `gatheringModule(values)`: what `systemData` names, the class
   table's columns at each class's level, and `values`. None of this changes a 2014 count.
2. `character-parts.ts`: ENG-09's `houseRules`, `untouched`, `rested`, moved.
3. `srd-2024.ts`: the pack as one object, `satisfies z.input<typeof fifthEditionPackSchema>`,
   entities grouped by source with a comment naming each group's §8 source.
4. `characters-2024.ts`: the four characters, `satisfies z.input<typeof
   fifthEditionCharacterSchema>`.
5. `fixtures-2024.test.ts`: the checks of §3 items 8–9.

ENG-09 §4's conventions hold (the backlog's note): keys are 5e-database slugs in camelCase, ids
keep the slug; proficiency keys are what an item names; saves are `ClassDef.saves` only; a slot
row lists levels 1 to the last with slots; golden C's 2024 column is its own character; the
attribution text is left to the import; house rules are test data; spell lists are empty.

Technical choices (ADR 002):
- **Whole at the goldens' levels.** Golden B4 is fighter 4, so the fighter gives every feature
  and choice of levels 1 to 4, and the Champion its level-3 features. Golden C's 2024 classes, as
  ENG-09's, carry no features.
- **A table column is the class's `levels`** (SPEC §5.3), keyed by 5e-database's
  `class_specific` name in camelCase: `secondWindUses`, `weaponMastery`, as SPEC §5.3 and §5.6
  name them. All 20 rows, as the slot tables have.
- **No `abilityScoreImprovement` flag on a level.** The level-4 improvement is the class's grant
  `ability-scores-4` (ENG-33 §4: a feat in place of it names that grant); a flag would be a second
  place saying it.
- **The 2024 improvement is a stat distribution on the class,** not the feat Ability Score
  Improvement: an entity is gathered once, so a feat given again at level 6 would not give again
  (the backlog's phase 3 note by ENG-33). Its patterns are the feat's: `[[2], [1, 1]]`.
- **"Any skill" and "an origin feat" are filters**, `{ type: 'skill' }` and `{ type: 'feat',
  category: 'origin' }`, as ENG-09's Acolyte chooses any language: a homebrew skill or feat is
  offered too. A feat's category is 5e-database's `type` in camelCase: `origin`,
  `fightingStyle`.
- **Exhaustion slows by `speed.all.bonus`.** dnd5e takes 5 feet per level from every speed the
  creature has, never below 0 (§8). SPEC §5.4's catalogue has `speed.<kind>.bonus`; one effect per
  kind would name speeds the character lacks. `speed.all.bonus` is the catalogue's own form
  (`saves.all.bonus`, `skills.all.bonus`, `d20.all.bonus`, `speed.all.mul`); ENG-14 gives it.
- **The fighter's multiclass prerequisite is a `formula`**, "Strength 13 or Dexterity 13", as
  ENG-32 §8 found the core's `formula` prerequisite holds it.
- **No languages.** No 2024 species or background in 5e-database gives one, and no golden value
  reads one (§9).
- **No prerequisite on Defense.** Its prerequisite is any Fighting Style feature (5e-database
  `feature_named`); an `entity` prerequisite names one feature, and the paladin's is another.
  Fighting Style's own choice is the only way to it here (§11).
- **A melee weapon has no range**, as ENG-09's warhammer: 5e-database's `range.normal: 5` is the
  reach, and the schema's range is a ranged weapon's.

#### 5. Stored data

Nothing stored changes. Test data only; no schema changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/golden/fixtures-2024.test.ts` — `describe('ENG-10 2024 fixtures')`:
  §3 items 8–9.
- `packages/system-5e/test/golden/fixtures-2014.test.ts` — `describe('ENG-09 2014 fixtures')`:
  unchanged expectations, its helpers from `checks.ts`.
- Control values from: SPEC §6.7 goldens B, B4, D and C (scores, proficiencies and their
  sources, the mechanics' numbers); the counts and columns in §8. Test data: the gaming set, golden
  B's size, golden C's scores and skills, the stand-ins of §3 item 9.

#### 8. Checked against the source

Sources: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214` (still its `HEAD` on
2026-10-02), `packages/5e-database/src/2024/en/`, read with `jq`; foundryvtt/dnd5e at `7bfb3f1`
(still its `HEAD` on 2026-10-02), `packs/_source/{origins24,classes24,feats24,content24}` and
`module/`, where 5e-database is silent or disagrees (ENG-33 §8: the 2024 rules chapters are not
in 5e-database, and the SRD 5.2.1 PDF's host is refused here). Both data sets are SRD 5.2.1
(CC-BY-4.0).

**The goldens' values agree with the sources** (checked before writing, ADR 007): B's scores
15 + 2, 14 + 1; hit points 10 + 2; Athletics 3 + 2; initiative 1 + 2; AC 16 + 1; Second Wind 2.
B4's STR 17 + 2; hit points 12 + 3 × (6 + 2), 6 being dnd5e's `avg` of a d10 (`10 / 2 + 1`,
ENG-33 §8); Second Wind 3 and weapon mastery 4 at fighter 4; proficiency +2 at levels 1 to 4
(`prof_bonus`). D's −2 × 2 to every d20 test and 30 − 5 × 2 feet. C's caster level 3 + ⌈3/2⌉ = 5
and the full caster's row at level 5, `[4, 3, 2]`. No golden value looks wrong; nothing stops.

**Stats and skills:** `5e-SRD-Ability-Scores.json`: `str`, `dex`, `con`, `int`, `wis`, `cha`, with
their names, as in 2014. `5e-SRD-Skills.json`: the same 18 skills on the same stats as 2014.
Passive Perception: the rules glossary (dnd5e `content24/appendices/rules-glossary.yml`) has one
passive score, "Passive Perception"; 5e-database names no other.

**The human:**
- `human` (`5e-SRD-Species.json`): type Humanoid, speed 30, traits `resourceful`, `skillful`,
  `versatile`; size `Medium`. dnd5e (`origins24/species/human.yml`) quotes the SRD: "Medium
  (about 4–7 feet tall) or Small (about 2–4 feet tall), chosen when you select this species",
  and its `Size` advancement offers `sm`, `med`. The fixture follows the SRD's text: Medium or
  Small (§11).
- `5e-SRD-Traits.json`: Resourceful "You gain Heroic Inspiration whenever you finish a Long
  Rest."; Skillful: one skill of the 18 ("Choose any skill."; dnd5e `skills:*`); Versatile "You
  gain an Origin feat of your choice" (dnd5e: one feat, restricted to `subtype: origin`).

**The Soldier** (`5e-SRD-Backgrounds.json`): ability scores `str`, `dex`, `con`; feat
`savage-attacker`; `skill-athletics`, `skill-intimidation`; one of `tool-dice`,
`tool-dragonchess`, `tool-playing-cards`, `tool-three-dragon-ante` (each `reference` is the
equipment `dice`, `dragonchess`, `playing-cards`, `three-dragon-ante`). The increases: dnd5e
(`origins24/backgrounds/soldier.yml`, `AbilityScoreImprovement`, `points: 3`, `cap: 2`, `int`,
`wis`, `cha` locked): "increase one of them by 2 and a different one by 1, or increase all three
by 1. None of these increases can raise a score above 20." No language: the background has
none in 5e-database; dnd5e adds a "Choose Languages" step to each background, whose hint is the
creation rule "Common plus two languages you roll or choose from the Standard Languages table".

**The feats** (`5e-SRD-Feats.json`): `alert`, `savage-attacker` of type `origin`; `defense` of
type `fighting-style`, prerequisite `feature_named: "Fighting Style"`.
- Alert: "When you roll Initiative, you can add your Proficiency Bonus to the roll." — SPEC
  §5.4's own example, `init.bonus` `+@prof`.
- Defense: "While you're wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor
  Class." — SPEC §5.4's own example, `ac.bonus` `+1` when `@armor.worn`.
- Savage Attacker: rerolls weapon damage once per turn; no golden value reads it.

**The fighter** (`5e-SRD-Classes.json`, `-Levels.json`, `-Features.json`):
- hit die 10; primary ability `str` or `dex`; saves `str`, `con`; `all-armor`, `shields`,
  `simple-weapons`, `martial-weapons`; choose 2 of Acrobatics, Animal Handling, Athletics,
  History, Insight, Intimidation, Perception, Survival; multiclass: `str` 13 or `dex` 13
  (`prerequisite_options`, `choose: 1`), `light-armor`, `medium-armor`, `shields`,
  `martial-weapons`; subclass `champion`.
- Levels: `fighter-fighting-style`, `fighter-second-wind`, `fighter-weapon-mastery` at 1;
  `fighter-action-surge`, `fighter-tactical-mind` at 2; `fighter-subclass` at 3, so the subclass
  level is 3; `fighter-ability-score-improvement` at 4 ("You gain this feature again at Fighter
  levels 6, 8, 12, 14, and 16"). `class_specific` per level: `second_wind_uses` 2 at levels 1–3,
  3 at 4–9, 4 at 10–20; `weapon_mastery` 3 at 1–3, 4 at 4–9, 5 at 10–15, 6 at 16–20.
- Fighting Style: "gain a Fighting Style feat of your choice". Second Wind: "You can use this
  feature twice. You regain one expended use when you finish a Short Rest, and you regain all
  expended uses when you finish a Long Rest", more uses by the Second Wind column. Weapon
  Mastery: three kinds of weapons, more by the Weapon Mastery column (§11).
- The improvement: dnd5e (`classes24/fighter/fighter.yml`) has one `AbilityScoreImprovement`
  advancement per level, `points: 2`, `cap: 2`, no stat locked; the feat Ability Score
  Improvement (`feats24/general-feats/ability-score-improvement.yml`) the same. 5e-database:
  "Increase one ability score of your choice by 2, or increase two ability scores of your choice
  by 1. This feat can't increase an ability score above 20."
- `champion` (`5e-SRD-Subclasses.json`, `-Levels.json`): `champion-improved-critical` and
  `champion-remarkable-athlete` at fighter 3. Improved Critical: "can score a Critical Hit on a
  roll of 19 or 20 on the d20" — SPEC §5.4's `crit.range` `min 19`. Remarkable Athlete: "you have
  Advantage on Initiative rolls and Strength (Athletics) checks" — SPEC §5.4's `advantage` on
  `roll.init` and `roll.skill.athletics`.

**Golden C's 2024 classes:**
- `wizard`: hit die 6; primary ability `int`; saves `int`, `wis`; `simple-weapons`; choose 2 of
  Arcana, History, Insight, Investigation, Medicine, Religion; multiclass `int` 13, no
  proficiencies; spellcasting `int` from level 1; `wizard-subclass` at 3. Per level: cantrips
  3, 3, 3, then 4 to level 9, 5 from 10; prepared spells 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16,
  16, 17, 17, 18, 18, 19, 20, 21, 22; slots measured equal, row by row, to ENG-09's full caster
  rows.
- `paladin`: hit die 10; primary abilities `str` and `cha`; saves `wis`, `cha`; `all-armor`,
  `shields`, `simple-weapons`, `martial-weapons`; choose 2 of Athletics, Insight, Intimidation,
  Medicine, Persuasion, Religion; multiclass `str` 13 and `cha` 13, `light-armor`,
  `medium-armor`, `shields`, `martial-weapons`; spellcasting `cha` from level 1;
  `paladin-subclass` at 3. Cantrips 0 at every level; prepared spells 2, 3, 4, 5, 6, 6, 7, 7, 9,
  9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15; slots `[2]` at levels 1 and 2, then equal to ENG-09's
  2014 paladin rows from level 3 (`[3]`) to 20 (`[4, 3, 3, 3, 2]`).
- Rituals: the glossary's "Ritual": "If you have a spell prepared that has the Ritual tag, you
  can cast that spell as a Ritual." — every caster of 2024, so both classes have `ritual: true`.
  The wizard's Ritual Adept (from the spellbook, unprepared) is a feature, left out as golden C's
  features are.

**Exhaustion** (`5e-SRD-Conditions.json`): "You die if your Exhaustion level is 6."; "When you
make a D20 Test, the roll is reduced by 2 times your Exhaustion level."; "Your Speed is reduced by
a number of feet equal to 5 times your Exhaustion level." dnd5e (`module/config.mjs`):
`levels: 6`, `reduction: { rolls: 2, speed: 5 }`; `prepareMovement`
(`module/data/actor/templates/attributes.mjs`) takes the reduction from every movement type,
`Math.max(0, speeds[type] - reduction)`. SPEC §6.3: one formula in 2024, `d20.all.bonus`
`-2 * @conditions.exhaustion.level` (SPEC §5.4's own example).

**Equipment** (`5e-SRD-Equipment.json`, `-Damage-Types.json`, `-Weapon-Properties.json`,
`-Weapon-Mastery-Properties.json`): `chain-mail` heavy armor, AC 16, no Dexterity (`max_bonus`
0), Strength 13, stealth disadvantage, 55 lb, 75 gp. `greatsword` martial melee, `2d6`
`slashing`, `heavy`, `two-handed`, mastery `graze`, 6 lb, 50 gp, `range.normal` 5 (as the 2014
warhammer's, which ENG-09 left out).

**Not reachable here:** the SRD 5.2.1 PDF (ENG-33 §8), so its attribution text is the import's
(ENG-09 §4).

#### 9. Not in this ticket

- How a character's weapon mastery kinds are chosen and kept: ENG-16 (§11). The count is the
  table's `weaponMastery`.
- The 2024 starting languages (Common and two standard ones): no 2024 species or background
  gives them in 5e-database, and no golden value reads them. A creation step: phase 4, or the
  import if it puts them on backgrounds as dnd5e does.
- Fifth edition's module and the golden values it computes: ENG-13 to ENG-16, ENG-19, ENG-34.
  This ticket's test module gathers, and gives the paths of §3 item 9 as stand-ins.
- How a later class leaves out the first class's grants (golden C's paladin `skills`): ENG-13.
- The multiclass slot table and the rounding: ENG-15, ENG-19.
- Features above golden B4's level, the wizard's and the paladin's features, origin and
  fighting style feats no golden takes, starting equipment, and every feature's mechanics but
  §3 item 3's: the import and its mechanics (phase 3, SPEC §6.8).

#### 10. Rake check

- **The golden tests are the truth.** No expected value changes; each golden number the test
  checks is SPEC §6.7's, and §8 shows each one agrees with the sources.
- **`[ПРОВЕРИТЬ]` and measure, never estimate.** Every rules value is §8's, read with `jq` and
  `grep`, not from memory. SPEC §6.3's exhaustion row is checked in §8.
- **Licensing.** Only SRD 5.2.1 (CC-BY-4.0) data. Text is limited to names and one resource label.
- **Everything is data.** No stat, skill or class is named in code; the fixture is data under
  `test/`. The test module's stand-ins are test code.
- **Each system's rules live in its own module.** The fixture is in the fifth-edition module's
  tests; no core file changes.
- **Formulas never run code.** Every formula is parsed by ENG-07's parser in the test.
- **Stored units are feet and pounds.** Speed 30, exhaustion 5 feet a level, weights 55 and 6.
- **No "D&D" in names.** The pack's title is "SRD 5.2.1".

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `fixtures-2024.test.ts` alone: `Tests 14 passed (14)`, 736 ms.
- Lint: `Checked 136 files`, no errors (131 before; 5 new files).
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 36 passed (36)`, `Tests 349 passed (349)`, 5.43 s (before: 35 files, 335
  tests).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The pack holds 52 entities: 6 stats, 18 skills, 1 species, 12 features, 1 background, 3 feats,
  3 classes, 1 subclass, 1 condition, 2 items, 1 damage type, 2 weapon properties, 1 weapon
  mastery. Its grants name 13 entity ids and its entities 67 stat, skill, class, damage type,
  property and mastery keys; it holds 7 formulas and 1 roll formula. Each count was worked out by
  hand before the run, and the first run agreed.
- Through `compute()`: golden B gathers 12 entities with no warning and no pending choice; its
  scores are 17, 13, 15, 8, 12, 10 (STR 15 + 2, CON 14 + 1, both the Soldier's); its 12
  proficiencies come from the sources SPEC §6.7 names; Alert gives `init.bonus` 2, Defense
  `ac.bonus` 1, Second Wind a maximum of 2, recovered 1 on a short rest and all on a long one.
  Golden B4 gathers 19 entities, level 4, no warning, no pending choice: STR 19 (15, +2 Soldier,
  +2 `ability-scores-4`), `crit.range` 19, Second Wind 3, `weaponMastery` 4. Golden D gathers
  B's 12 and exhaustion at level 2: `d20.all.bonus` −4, `speed.all.bonus` −10 (golden B: 0 and
  0). Golden C (2024) is level 6, gathers its two classes with no warning, and has one pending
  choice, `srd-2024:class/paladin#skills`.
- The tests bite. Eight breaks, each on its own and restored (`cmp` equal after): the Soldier's
  `[2, 1]` written `[1, 2]`, 2 tests fail (B's and B4's scores); Improved Critical `max` for
  `min`, 1; the Second Wind column at level 4 made 2, 1; exhaustion's `-2` made `-1`, 2; Defense's
  `when` misspelled `@armor.wron`, 6 (the missing path warns in every character that has it);
  the greatsword's mastery `graz`, 1; Tactical Mind removed, 4; Perception left out of the
  fighter's list, 4.
- ENG-09's test: its `describe` block is byte-equal before and after (`diff`), `Tests 10 passed
  (10)` with its helpers from `checks.ts`.

Differences from §3 and §4:
- `gatheringModule` takes the content index too (`gatheringModule(index, values)`): it reads each
  class's table from the class.
- The fighter's table is written as 20 literal rows, as 5e-database lists them; a first draft
  built it from two columns with a fallback that could hide a missing row.
- Golden C's test module gives no stand-ins: nothing of golden C reads one.

Found, not fixed:
- Which kinds of weapons a character uses the mastery of has no place: no grant kind holds it
  (ENG-32's proficiency categories have no mastery), and the person may change one kind after a
  long rest (5e-database). The count is the table's `weaponMastery`. Noted on ENG-16.
- Exhaustion changes `speed.all.bonus`, a path SPEC §5.4's catalogue does not list (§4). Noted on
  ENG-14, with dnd5e's floor at 0.
- The fixture's mechanics read or change values only the module gives: `prof` (Alert),
  `armor.worn` (Defense), `classes.fighter.table.secondWindUses` (Second Wind), `init.bonus`,
  `ac.bonus`, `crit.range` from 20, `d20.all.bonus` in every d20 test (golden D). The test gives
  them as stand-ins. Noted on ENG-13, ENG-14 and ENG-16.
- 5e-database at `e6edf9a` gives the 2024 human one size, `Medium`, where the SRD's text, as
  dnd5e quotes it, is Medium or Small; its `feature_named` prerequisite (the four fighting style
  feats: "Fighting Style"; Boon of Spell Recall: "Spellcasting") has no prerequisite kind, since
  `entity` names one entity; and no 2024 species or background gives a language. New note for
  phase 3 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-13 Check bonuses

**Hat:** Check bonuses are computed: modifiers, proficiency, saves, skills, passives
**Depends on:** ENG-28 (`derive`, `statDefaults`), ENG-11 (`gather`), ENG-17 (effects on a path),
ENG-29 (a resource maximum reads a class table), ENG-33 (`systemData`), ENG-09 and ENG-10 (the
golden fixtures)
**Size:** M
**Screen:** No
**SPEC:** §6.1 step 5 (modifiers, the proficiency bonus by total level, saves, skills at 0, ½, 1
or 2, passive values); §5.3 (`AbilityDef`'s defaults, `SkillDef.totalFormula`, `ClassDef.saves`,
`multiclass`, `levels[].table`); §5.4's targets `abilities.<key>.saveBonus`, `saves.all.bonus`,
`skills.<key>.prof`, `skills.<key>.bonus`, `skills.all.bonus`, `checks.<ability>.bonus`,
`d20.all.bonus`; §5.6 (`@prof`, `@classes.<key>.level`, `@classes.<key>.table.<column>`); §6.2;
§6.7 goldens A, B, B4, C and D (their check lines); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/module.ts` — new: `fifthEditionModule`, fifth edition's
`SystemModule`. The level and the entities `systemData` names, the stat defaults, the grants a
later class and a replacing feat leave out, each class's level and table columns, and the
derived steps.
- `packages/system-5e/src/checks.ts` — new: `proficiencyBonus(level)` and the check steps:
  `prof`, `d20.all.bonus`, ability checks, saves, skills, passive values.
- `packages/system-5e/src/index.ts` — changes: exports both.
- `packages/engine/src/compute.ts` — changes: `SystemModule` gains `grantsOf`; `basePath` also
  gets what was gathered.
- `packages/engine/src/gather.ts` — changes: an entity's grants are read through the module's
  `grantsOf`.
- `packages/engine/src/derived.ts` — changes: a step may return the warnings of a formula it
  evaluated; each becomes a `stepFormula` warning naming the path.
- `packages/engine/src/stats.ts` — changes: `BreakdownStep` gains the kind `entity`; a `formula`
  step may be a skill's own (`of: 'skill'`).
- `packages/engine/test/compute.test.ts`, `derived.test.ts`, `stats.test.ts` — change: an
  `ENG-13` block each, on Tales.
- `packages/system-5e/test/module.test.ts` — new: the module on the goldens and on made-up
  variants of them.
- `packages/system-5e/test/golden/golden-values.test.ts` — new: SPEC §6.7's check lines of goldens
  A, B, B4, C and D. ENG-14 onward add their lines here.
- `packages/system-5e/test/golden/checks.ts` — changes: the test module is the real module, with
  stand-ins only for what ENG-14 and ENG-16 give.
- `packages/system-5e/test/golden/fixtures-2014.test.ts`, `fixtures-2024.test.ts` — change: they
  use it; golden C has no pending choice.
- `docs/tickets/BACKLOG.md` — the split-off row ENG-43 (§4).

#### 2. What is missing now

Measured on `main` at `8347047`:
- `grep -rn "SystemModule" packages/system-5e/src` finds nothing: fifth edition has no module.
  Only the golden tests make one (`gatheringModule`, `test/golden/checks.ts`), with the stat
  defaults `modFormula: '0'` and `hasSave: false`.
- With it, golden A gets 20 paths: `level`, 3 per stat, and the stand-in `hp.max.bonus`. Each
  modifier is 0. No `prof`, no save, skill, ability check or passive path.
- Golden C (2014) has one pending choice, `srd-2014:class/paladin#skills`, and 13 proficiencies:
  6 are the paladin's own (`light`, `medium`, `heavy`, `shield`, `simple`, `martial`), heavy armor
  among them. A later class gives every grant a first class gives.
- `@prof`, `@classes.fighter.table.secondWindUses` and `d20.all.bonus` are the golden test's
  stand-ins (ENG-10 §11).
- `grep -rn "totalFormula" packages/*/src` finds only the schema: a skill's own formula is read
  by no code. `feats[].replaces` (ENG-33) is read only by its schema.
- `pnpm test`: `Test Files 36 passed (36)`, `Tests 349 passed (349)`.

#### 3. What it should look like when done

1. **`fifthEditionModule`** is fifth edition's `SystemModule`:
   - `level`: the sum of `systemData.classes[].level` (0 with no class);
   - `entities`: the species, the background, each class at its own level followed by its
     subclass at that level, then each of `feats` (ENG-33's order);
   - `statDefaults`: SPEC §5.3's, `{ defaultMax: 20, modFormula: 'floor((@score - 10) / 2)',
     hasSave: true }`;
   - `basePath`: `classes.<key>.level` for each class the character has, so a base-phase formula
     reads a class level (SPEC §5.6); any other path is refused, as before.
2. **What a class gives as a later class** (`grantsOf`, §8): a class that is not the first in
   `systemData.classes` gives its own grants except its starting proficiencies and items (a
   `proficiency` or `item` grant without `atLevel`, or at level 1), and its `multiclass.grants`.
   Golden C, both editions, has no pending choice; the paladin gives `light`, `medium`, `shield`
   and, in 2014, `simple`, `martial`, in 2024 `martial`, each from a `multiclass-…` grant. No
   heavy armor.
3. **A feat taken in place of a grant**: a grant whose part a feat's `replaces` names is not given,
   whatever its entity. Golden B4 with a feat replacing `srd-2024:class/fighter#ability-scores-4`
   has STR 17, no pending choice, and the stored choice of that grant is not used.
4. **The core's part** (game-free):
   - `SystemModule.grantsOf?(character, entity)` gives the grants an entity gives this character;
     without it, its own `grants`. `gather` reads every visited entity's grants through it: what
     it leaves out gives nothing, is never pending, and its stored choice is not read; what it
     adds is gathered under `<entityId>#<grantId>` as an own grant is.
   - `basePath(character, path, gathered)`: the third argument is new.
   - A step may return `warnings` (formula warnings) with its number; each becomes `{ code:
     'stepFormula', path, warning }`.
   - `BreakdownStep` gains `{ kind: 'entity', source, label }`: a number an entity gives by one of
     its own fields, not by a grant or an effect (a class's saves, its table). A `formula` step's
     `of` may be `'skill'`.
5. **The paths** the module gives, in this order, each with its breakdown:
   - `classes.<key>.level`: the class's stored level (a `base` step);
   - `classes.<key>.table.<column>`: each number column of the class's `levels` row at its level
     (an `entity` step naming the class). A text column is not a value;
   - `prof`: the proficiency bonus by the character's level, +2 at levels 1 to 4 and 1 more every 4
     levels (§8): a `rule` step, `proficiencyBonus`. Level 0 gives +2;
   - `d20.all.bonus`, `saves.all.bonus`, `skills.all.bonus`: 0, targets for effects;
   - for each stat, its check, then its save: `checks.<key>.bonus` 0; `checks.<key>.total` = its
     modifier + `checks.<key>.bonus` + `d20.all.bonus`; then, when it has a save,
     `abilities.<key>.saveProf`, its proficiency level; `abilities.<key>.saveBonus` 0;
     `abilities.<key>.save` = its modifier + ⌊saveProf × prof⌋ + `abilities.<key>.saveBonus` +
     `saves.all.bonus` + `d20.all.bonus`. A stat with `hasSave: false` has none of the three;
   - for each skill: `skills.<key>.prof`, its proficiency level; `skills.<key>.bonus` 0;
     `skills.<key>.total` = its stat's modifier + ⌊prof × `prof`⌋ + `skills.<key>.bonus` +
     `skills.all.bonus` + `checks.<stat>.bonus` + `d20.all.bonus`; a skill with `passive: true`,
     `skills.<key>.passive` = 10 + its total.
6. **A proficiency level** is the highest its sources give, with that source as its one step (the
   first source of the highest, as Tales' knack): a `save` or `skill` proficiency grant, its
   `level` or 1; for a save, also the first class's `saves`, 1, an `entity` step naming the class.
   None: 0, with no step.
7. **A total's steps** are a `path` step for each part. The proficiency part is a `path` step
   naming `prof`: its `value` the bonus, its `change` what it adds (SPEC §6.2's "+2 ×2").
8. **A skill's own `totalFormula`** (SPEC §5.3) is its total: one `formula` step `of: 'skill'`,
   read with `@`-paths as any formula; its passive value is 10 + that. A formula that does not
   parse gives 0 and a `stepFormula` warning.
9. **Goldens** (SPEC §6.7), with ENG-14's and ENG-16's stand-ins only:

   | Golden | Line | Expected |
   |---|---|---|
   | A | modifiers STR to CHA | +1, +0, +3, −1, +3, +1 |
   | A | saves | STR +1, DEX +0, CON +3, INT −1, WIS +5, CHA +3 |
   | A | skills | Insight +5, Medicine +5, Persuasion +3, Religion +1, Perception +3 |
   | A | passive Perception | 13 |
   | B | modifiers STR to CHA | +3, +1, +2, −1, +1, +0 |
   | B | saves | STR +5, CON +4 |
   | B | skills | Athletics +5, Intimidation +2, Perception +3, Survival +3, Insight +3 |
   | B | passive Perception | 13 |
   | B4 | STR, Athletics | 19 (+4), +6 |
   | C, 2014 and 2024 | proficiency bonus | +3 |
   | D | Athletics, STR save | +1, +1 |

   Every golden's breakdowns add up to their values, and none of them gets a warning.
10. **What the goldens read through the real module now:** Alert's `@prof` (golden B's
    `init.bonus` 2), Second Wind's `@classes.fighter.table.secondWindUses` (2 at fighter 1, 3 at
    4), `classes.fighter.table.weaponMastery` (4 at fighter 4), exhaustion's `d20.all.bonus` (−4
    at level 2). The stand-ins left are `hp.max.bonus`, `init.bonus`, `ac.bonus`, `armor.worn`,
    `speed.all.bonus` (ENG-14) and `crit.range` (ENG-16); the test fails if the module gives one.
11. **Made-up variants, worked out by hand** (§7): expertise and half proficiency at proficiency
    +3, a `save` grant, the five bonus targets, a stat of the pack's own with no save, a skill of
    its own with a formula, golden B with no class, a base-phase formula reading a class level.
12. `compute()` stays pure: frozen inputs give equal results.
13. The quality gate is green.

#### 4. How to do it

1. **Re-cut first.** SPEC §5.4's text target `skills.<key>.ability` (a `set` with a stat's key,
   ENG-17 §9) moves to a new row, **ENG-43 An effect sets the stat a skill uses** (S), after
   ENG-13 in `BACKLOG.md`. It needs its own reading of `set` effects with a text value and its
   own warnings; with it, this ticket is more than M. ENG-17's note names ENG-43 for it.
2. `stats.ts`: the `entity` step kind; `of: 'skill'`.
3. `derived.ts`: `Derived.warnings`; `stepFormula`; `computeDerived` passes a step's warnings on
   before `finish`.
4. `gather.ts`: a `grantsOf` argument, its own `grants` by default. `compute.ts`:
   `SystemModule.grantsOf`, passed to `gather`; `basePath` gets `gathered`.
5. `checks.ts`: `proficiencyBonus`, `PASSIVE_BASE`, `checkSteps({ character, gathered, stats })`.
6. `module.ts`: `fifthEditionModule`; the class paths; `derive` joins them with `checkSteps`.
7. Tests (§7), then `checks.ts` of the golden tests and the two fixture tests.

Technical choices (ADR 002):
- **A later class leaves out its own grants by kind, not by a list in the data.** The SRD's
  rule (§8) is that a later class gives "only some of the new class's starting proficiencies"
  and no starting equipment; the starting ones are exactly a class's own `proficiency` and
  `item` grants at level 1, and what it gives instead is `multiclass.grants` (ENG-32). A list of
  grant ids on the class would be a second place saying the same, and a homebrew class would
  have to repeat it. A proficiency a class gives at a later level is a feature's, so it stays.
- **The core asks the module for each entity's grants** (`grantsOf`), instead of learning what a
  later class is. One hook covers both rules of this ticket (a later class, a feat's `replaces`),
  and the core names no game. It is called once per entity gathered.
- **A feat's `replaces` drops the grant whatever it is.** ENG-33 made it name the grant; the
  schema already refuses a grant replaced twice. Which grants may be replaced is the level-up
  wizard's choice to offer (phase 4).
- **Saves come from the first class's `saves` field** (ENG-09 §4), as an `entity` step naming
  the class: the field is not a grant, and making one up would need a grant id the class could
  also use. The new step kind serves ENG-14's hit die and armor too.
- **A proficiency level is the highest, never a sum**: "your proficiency bonus can't be added to
  a single die roll or other number more than once" (§8). Half a bonus rounds down (§8); a rule
  that rounds up is a mechanic's (§9).
- **`d20.all.bonus` goes into every check, save and skill total, and so into passive values.**
  dnd5e adds its exhaustion reduction to the passive score too (§8). Golden D's passive Perception
  is therefore 9; SPEC §6.7 does not state it, so it is not a golden value.
- **`checks.<stat>.bonus` goes into the stat's skills too**: a skill check is an ability check
  (§8), as dnd5e adds an ability's check bonus to its skills.
- **Totals read every part, even a 0**, as Tales' do (ENG-28): the breakdown names each path an
  effect may change, and the screen hides what adds nothing.
- **A skill's own `totalFormula` is the module's to read**, in its skill step: the core gives no
  skill total, and what a total adds up is each system's. It replaces the whole total, as its name
  says; it reads `@prof`, `@d20.all.bonus` and the rest only if it names them. Effects on
  `skills.<key>.total` still apply after it.
- **The proficiency bonus is a function, not a table**: `2 + ⌊(level − 1) / 4⌋`, tested against
  the 20 values of both editions' tables (§8). Level 0, a character not yet given a class, takes
  +2: the 2024 table's first row is "Up to 4".
- **The class paths are the module's.** `classes.<key>.level` is read from `systemData`, a table
  column from the class's `levels` (ENG-10 §4); the class is found among the gathered entities, so
  a class no pack has gives no path, and a formula reading it warns `missingPath`.
- **The golden tests' module is the real one.** Stand-ins stay only for paths a later ticket
  gives, and the helper refuses a stand-in the module gives, so each ticket removes its own.

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table changes. `replaces` and
`totalFormula` were stored already; they are now read.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/compute.test.ts` — `describe('ENG-13 a module's rule for grants')`: on
  Ash, a module that leaves out the warden's `pick-knack` and adds a knack grant: what is left
  out gives nothing, is not pending and its choice is unused; what is added is gathered under its
  part; a dropped `entity` grant gathers nothing; `grantsOf` is called once per entity.
- `packages/engine/test/derived.test.ts` — `describe('ENG-13 a step's formula warnings')`: a step
  returning a formula's warnings gives `stepFormula` naming its path; finish still applies.
- `packages/engine/test/stats.test.ts` — `describe('ENG-13 …')`: `basePath` gets what was
  gathered.
- `packages/system-5e/test/module.test.ts` — `describe('ENG-13 fifth edition's module')`: §3
  items 1–8, 11, 12: the level, the entities, the defaults (the modifier of every score 1 to 30
  against the SRD table), `proficiencyBonus` at levels 0 to 20, golden C's grants and saves,
  `replaces`, the class paths, the variants, breakdowns, purity.
- `packages/system-5e/test/golden/golden-values.test.ts` — `describe('ENG-13 goldens: check
  bonuses')`: §3 item 9.
- `fixtures-2014.test.ts`, `fixtures-2024.test.ts` — their checks, on the real module; golden C's
  pending choices are none.
- Control numbers from: SPEC §6.7 (item 9); §8's tables (proficiency bonus, modifiers); the
  variants worked out by hand from their data, never copied from a run.

#### 8. Checked against the source

Sources: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214` (its `HEAD` on
2026-10-02), `packages/5e-database/src/{2014,2024}/en/`, read with `jq`; foundryvtt/dnd5e at
`7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (its `HEAD` on 2026-10-02): `module/` and
`packs/_source/{rules,content24}`, which quote SRD 5.1 and SRD 5.2.1 (CC-BY-4.0).

**The proficiency bonus.** `5e-SRD-Levels.json`, every class's rows, both editions: +2 at levels 1
to 4, +3 at 5 to 8, +4 at 9 to 12, +5 at 13 to 16, +6 at 17 to 20 (measured: each level has one
value across the 12 classes). SRD 5.2.1 (`content24/chapter-1/d20-tests.yml`): "Up to 4 +2, 5–8
+3, …"; both editions (`rules/chapter-6-customization-options.yml`, `content24/chapter-2/
character-creation.yml`): it is "based on your total character level … a level 3 Fighter / level
2 Rogue … +3". dnd5e: `Proficiency.calculateMod(level)` = `Math.floor((level + 7) / 4)` on the
sum of class levels (`character.mjs`), equal for 1 to 20. SRD 5.1 (`5e-SRD-Rules.json`,
Proficiency Bonus): "can't be added to a single die roll or other number more than once";
multiplied or divided "only once". So a proficiency level is the highest, not a sum.

**Modifiers and the maximum.** SRD 5.1 (Ability Scores and Modifiers): "subtract 10 from the
ability score and then divide the total by 2 (round down)", with the table from 1 (−5) to 30
(+10). SRD 5.2.1 (`content24/chapter-1/playing-the-game.yml`): the same table, and "Whenever you
divide or multiply a number in the game, round down … Some rules make an exception and tell you
to round up." dnd5e: `Math.floor((a.value - 10) / 2)`; `maxAbilityScore = 20`. SPEC §5.3's
defaults agree: `floor((@score - 10) / 2)`, a save, 20.

**Saves.** SRD 5.1 (Saving Throws): "roll a d20 and add the appropriate ability modifier … Each
class gives proficiency in at least two saving throws". SRD 5.2.1 (`d20-tests.yml`): "Each class
gives proficiency in at least two saving throws". dnd5e (`common.mjs`, `prepareAbilities`): save
= modifier + its bonuses + the roll reduction + the proficiency's `flat`.

**Multiclassing.** SRD 5.1 (`rules/chapter-6-customization-options.yml`): "When you gain your
first level in a class other than your initial class, you gain only some of new class's starting
proficiencies, as shown in the Multiclassing Proficiencies table", and "You don't, however,
receive the class's starting equipment". SRD 5.2.1 (`character-creation.yml`): the same first
sentence, "as detailed in each class's description"; each class's "As a Multiclass Character"
(`content24/chapter-3/*.yml`) lists what it gives: the fighter and the paladin "Hit Point Die,
proficiency with Martial weapons, and training with Light and Medium armor and Shields", the
wizard "the Hit Point Die", the bard one skill, one instrument and light armor; none lists saving
throws. 5e-database `multi_classing` agrees for 2014 (the paladin: `light-armor`, `medium-armor`,
`shields`, `simple-weapons`, `martial-weapons`; the bard, the ranger and the rogue choose one
skill). Golden C's fixtures carry these (ENG-09, ENG-10).

**Skills, checks and passive values.** SRD 5.1 (Skills): "proficiency in a skill means an
individual can add his or her proficiency bonus to ability checks that involve that skill" — a
skill check is an ability check. (Passive Checks): "10 + all modifiers that normally apply to the
check. If the character has advantage on the check, add 5. For disadvantage, subtract 5." SRD
5.2.1 (`content24/appendices/rules-glossary.yml`, Passive Perception): "10 plus the creature's
Wisdom (Perception) check bonus. If the creature has Advantage on such checks, increase the score
by 5"; (`character-creation.yml`): "Include all modifiers that apply to your Wisdom (Perception)
checks". dnd5e (`creature.mjs`, `prepareSkill`): total = modifier + bonus (the skill's, every
check's, its ability's check bonus, every skill's) + `conditionRollReduction` + the
proficiency's `flat`; passive = 10 + modifier + bonus + `flat` + … + advantage × 5 +
`conditionRollReduction`. Half proficiency: `Proficiency.flat` rounds down unless a rule says up
(2014's Remarkable Athlete: "half your proficiency bonus (round up)").

**Exhaustion in d20 tests.** SRD 5.2.1 (rules glossary): "When you make a D20 Test, the roll is
reduced by 2 times your Exhaustion level"; "D20 Tests encompass … ability checks, attack rolls,
and saving throws". dnd5e: `conditionRollReduction` (exhaustion's `-levels × 2`) is in every
check, save, skill and passive.

**The goldens' check lines agree with these** (worked out before the test was written): A's
modifiers from 13, 10, 16, 8, 16, 12; its saves and skills +2 where proficient (the cleric's WIS
and CHA saves; Insight and Religion from the Acolyte, Medicine and Persuasion from the cleric);
passive 10 + 3. B's modifiers from 17, 13, 15, 8, 12, 10; STR and CON saves +2; its five skills
+2; passive 10 + 3. B4: STR 19 → +4, Athletics 4 + 2. C: level 6 → +3. D: 5 − 4 and 5 − 4. No
golden value looks wrong; nothing stops.

#### 9. Not in this ticket

- An effect that sets a skill's stat (`skills.<key>.ability`): ENG-43 (§4).
- Advantage and disadvantage (Remarkable Athlete's Athletics, the passive's ±5): ENG-34.
- Initiative, armor class, hit points, speed (and Alert's `init.bonus` as a path): ENG-14. Spell
  save DC and attack: ENG-15. Attacks: ENG-16.
- A half proficiency that rounds up (2014's Remarkable Athlete) and an ability check that takes
  half a proficiency (2014's Jack of All Trades): their mechanics, phase 3.
- The house rule `abilityMax` and the editions' defaults: ENG-19.
- Exhaustion in 2014 (levels with their own effects): ENG-19.

#### 10. Rake check

- **The golden tests are the truth.** Each expected value is SPEC §6.7's; §8 shows each agrees
  with the sources. Golden D's passive Perception is not a golden value and is marked so.
- **`packages/engine` is pure; the core names no game.** The core gains a hook, a warning code and
  a step kind, none naming a game; `grantsOf` is tested on Tales.
- **Everything is data.** No stat or skill key is in the code: saves are each stat with a save,
  skills each skill in `byKey`; a pack's own stat gets a check and a save as `str` does.
- **`compute()` is pure.** The module reads its arguments only; the purity test runs it frozen.
- **A number with no breakdown entry is a bug.** Every path has its steps, and they add up.
- **Manual overrides always win.** The module's paths are finished by ENG-17's phases.
- **Each system's rules live in its own module.** The multiclass rule, the saves and the bonus are
  in `packages/system-5e`; no `if (ruleset === …)`: the two editions share each rule here (§8).
- **Formulas never run code.** `totalFormula` goes through ENG-07's evaluator.
- **Missing is not broken.** A class no pack has, a skill on a stat the character lacks, a
  formula that does not parse: a warning and 0, never a throw.
- **Licensing.** Variants are made up (`hb-test`); §8 quotes the SRDs (CC-BY-4.0) only.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `module.test.ts` alone: `Tests 14 passed (14)`, 882 ms. `golden-values.test.ts` alone: `Tests 6
  passed (6)`, 671 ms.
- Lint: `Checked 140 files`, no fixes, no error (136 before; 4 new files).
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 38 passed (38)`, `Tests 373 passed (373)`, 5.63 s (before: 36 files, 349
  tests).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- Golden A has 115 paths (was 20): `level`; 6 per stat (`score`, `max`, `mod`, `saveProf`,
  `saveBonus`, `save`); 2 per stat (`checks.<key>.bonus`, `.total`); `prof`, `d20.all.bonus`,
  `saves.all.bonus`, `skills.all.bonus`; 3 per skill and Perception's passive value;
  `classes.cleric.level`; the 6 stand-ins.
- Every line of §3 item 9 is met. Every golden (A, B, B4, C in both editions, D) computes with no
  warning, and each of its breakdowns adds up to its value.
- Golden C (2014) has 12 proficiencies (was 13): the wizard's 7, and the paladin's 5 from its
  `multiclass-armor` and `multiclass-weapons`; no heavy armor. Golden C has no pending choice in
  either edition.
- The tests bite. 32 breaks, each on its own and restored, the `engine` and `system-5e` tests run
  (22 files, 244 tests; 245 for the last three). In `module.ts`: a later class keeps its starting
  grants, 4 fail; gets no multiclass grants, 2; every class counted later, 7; `atLevel` ignored, 1;
  items not starting, 1; `replaces` ignored, 1; a text column kept, 1; a class level with no step,
  2; the base path refused, 1; the modifier rounded, 11; no save by default, 9. In `checks.ts`:
  the last class's saves, 2; levels summed, 1; an equal level keeps the last, 1; half rounded up,
  1; a grant's level 0 by default, 6; no `d20.all.bonus` in skills, 2, in saves, 1, in checks, 1;
  no check bonus in skills, 1; no save bonus, 1; no `saves.all.bonus`, 1; `hasSave` ignored, 1;
  passive base 5, 5; every skill passive, 1; `totalFormula` ignored, 1; its warnings dropped, 1;
  the bonus as dnd5e's `⌊(level + 7) / 4⌋` (level 0 gives +1), 2; `prof` with no step, 1. In the
  core: `grantsOf` not used, 7; a step's warnings dropped, 2; `basePath` given no entities, 2.
- Three breaks first went unnoticed: the base path break was written so it changed nothing
  (rewritten, 1 fails); no test looked at exhaustion in an ability check, or at a skill that is not
  passive. The golden D test of `module.test.ts` was added for them; each now fails 1.

Differences from §3 and §4:
- No value differs. §3 item 5 was reworded to say each stat's check comes before its save.
- `grantsOf` returns the system's own grant type, so a Tales module typed with the core's default
  entity type no longer fits `compute` on Tales' index (`TS2345`). Four test annotations in
  `compute.test.ts` and `stats.test.ts` now name `TalesEntity`; no test changed in meaning.
- The stand-ins carry a `rule` step, `standIn`: the "every breakdown adds up" check found
  `armor.worn` 1 and `crit.range` 20 with no step.
- One expected value of this ticket's own test was first written wrong: Brook's gathered
  entities without `iron-will`. It was corrected from ENG-27's `tales/expected.ts`, not from the
  run.
- Golden D's passive Perception, 9, is the sources' reading (§4, §8); SPEC §6.7 does not state it,
  and the test says so.

Against the row and its notes:
- Each point of the backlog's note is done: the defaults are SPEC §5.3's (§3 item 1); saves read
  `StatOf.hasSave` (item 5); the values are `derive`'s steps; `totalFormula` is read by the
  module's skill step (item 8); a later class gives its `multiclass.grants` in place of its
  starting ones, and only the first class's `saves` count (items 2, 6), so golden C has no pending
  choice; the module names what ENG-33 says from `systemData`; a feat's `replaces` leaves its grant
  out (item 3); `@prof`, the class table and `d20.all.bonus` are the module's, their stand-ins gone
  (item 10).
- The golden lines this ticket makes true are on in `golden-values.test.ts` (§3 item 9).
- ENG-17's note: the text target `skills.<key>.ability` moved to ENG-43 (§4 item 1).

Found, not fixed:
- `statDefaults` is one value for every character, so the house rule `abilityMax` (ENG-33) is read
  by no code. Noted on ENG-19.
- A passive value is 5 higher with advantage on its check and 5 lower with disadvantage (SRD 5.1
  Passive Checks; SRD 5.2.1 Passive Perception; dnd5e `advantageMode × 5`). Noted on ENG-34.
- A half proficiency that rounds up (2014's Remarkable Athlete: "round up") and half a
  proficiency on any ability check (2014's Jack of All Trades): `skills.<key>.prof` 0.5 rounds
  down, and an ability check has no proficiency level. Noted for phase 3's mechanics.
- A feat's `replaces` naming a grant the character does not reach gives no warning: the module
  has no warning of its own but `stepFormula`. Noted for phase 4, whose level-up wizard writes it.
- dnd5e's initiative adds the Dexterity check bonus and the roll reduction (`attributes.mjs`,
  `prepareInitiative`): golden D's initiative −1 needs `d20.all.bonus`. Noted on ENG-14.

Nothing for the changelog.

---

### ENG-43 An effect sets the stat a skill uses

**Hat:** An effect sets the stat a skill uses
**Depends on:** ENG-13 (`checkSteps`, `fifthEditionModule`), ENG-17 (`phasesOf`, `activeEffects`,
`effectNumber`), ENG-18 (a loop names its paths), ENG-28 (`computeDerived`)
**Size:** S
**Screen:** No
**SPEC:** §5.4 (the target `skills.<key>.ability`, `set`, phase `derived`); §5.8 (`overrides`, a
value that may be a text); §6.1 steps 5–7; §8.2 (warnings, never a block); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/phases.ts` — changes: `finishKey`, the effects and the
override of a path whose value is a key.
- `packages/engine/src/effects.ts` — changes: `effectKey`; the formula checks `effectNumber` runs
  are shared with it; two warning codes.
- `packages/engine/src/derived.ts` — changes: key paths, read by a step through `readKey`, finished
  when first read, each in a loop as a number path is.
- `packages/engine/src/stats.ts` — changes: `KeyStep`.
- `packages/engine/src/compute.ts` — changes: `SystemModule.keys`; `Computed.keys`.
- `packages/system-5e/src/checks.ts` — changes: `skillKeys`; a skill's total reads its stat from
  `skills.<key>.ability`.
- `packages/system-5e/src/module.ts` — changes: `keys`.
- `packages/engine/test/tales-module.ts` — changes: Tales' skills read their stat the same way.
- `packages/schema/test/tales/system.ts` — changes: one line of Tales' rules says so.
- `packages/engine/test/phases.test.ts`, `cycle.test.ts`, `derived.test.ts` — change: an `ENG-43`
  block each, on Tales.
- `packages/system-5e/test/module.test.ts` — changes: an `ENG-43` block on golden B and made-up
  feats.

#### 2. What is missing now

Measured on `main` at `36f1450`, golden B (2024) with a made-up feat whose effects are `set
skills.athletics.ability 'dex'`, `add skills.athletics.ability 1` and `set skills.athletics.ability
'luck'`, and an override of `skills.athletics.ability` to `'con'`:
- `skills.athletics.total` is 5, with the step `abilities.str.mod` 3 and `checks.str.bonus`: the
  `set 'dex'` is not read.
- `values['skills.athletics.ability']` is `undefined`: no code gives a skill's stat.
- The warnings are two: `"character:feat/nimble#add" changes skills.athletics.ability, which the
  character has no value for; it is not applied.` and `The override of skills.athletics.ability
  names no value the character has; it is not applied.` The `set 'luck'`, a stat the character does
  not have, gives none.
- `pnpm test`: `Test Files 38 passed (38)`, `Tests 373 passed (373)`.

#### 3. What it should look like when done

1. **A key path** is a computed path whose value is a key, not a number (SPEC §5.4
   `skills.<key>.ability`). A module gives each one with `SystemModule.keys(input)`: its own key,
   the steps that gave it, and the keys it may take. `Computed.keys[path]` is `{ key, steps }`; the
   key is the last step's. `values` and `breakdown` stay numbers only.
2. **A key step** is `{ kind: 'entity', source, label, key }` (a key an entity gives by its own
   field), `{ kind: 'effect', part, source, label, key }` or `{ kind: 'override', key, note? }`.
3. **The effects on a key path** are the ones ENG-17 leaves to a number path: active, by phase
   (`base`, `derived`, `final`), then priority (`set`'s 50, or the effect's own), then gathering
   order. A `when` is read as for a number (a `base` effect under the base-phase rule). Each `set`
   whose value is one of the path's keys applies and is a step; the last one applied is the key.
4. **Warnings, never a block** (SPEC §8.2):
   - `notAKey`: an effect on a key path whose op is not a `set` with a text (`add`, a `set` with a
     number, `advantage`, …); not applied.
   - `unknownKey`: a `set` with a text that is not one of the path's keys; not applied, the path's
     keys named.
   - `overrideNotAKey`: an override of a key path whose value is not one of its keys; not applied.
   - A key path is finished, so neither `noTarget` nor `overrideNoPath` names it.
5. **An override** of a key path whose value is one of its keys wins over every effect: a step
   `{ kind: 'override', key, note? }`.
6. **A step reads a key path** with its third argument, `readKey(path)`: the finished key, or
   `undefined` for a path no module gives as a key. A key path is finished when first read, and a
   loop through it is caught and named as ENG-18's are; a key read in a loop is its own key.
   A path a module gives both as a number and as a key is a number, with `pathTaken`.
7. **Fifth edition:** every skill has `skills.<key>.ability`: its own `ability` (an `entity` step
   naming the skill), its keys the stats the character has. A skill's total reads that stat's
   modifier and that stat's `checks.<stat>.bonus` (§8). A skill with its own `totalFormula` has the
   key path too; its total is its formula's.
8. **Golden B (2024) with a made-up feat** (§7, worked out by hand; STR +3, DEX +1, CON +2,
   INT −1, WIS +1, CHA +0, proficiency +2):

   | Effect of the feat | Path | Expected |
   |---|---|---|
   | `set skills.athletics.ability 'dex'`; `checks.dex.bonus +1`, `checks.str.bonus +2` | `skills.athletics.total` | 4 = DEX 1 + 2 + `checks.dex.bonus` 1 |
   | `checks.str.bonus +2` | `checks.str.total` | 5 |
   | `set skills.perception.ability 'int'` when `@level >= 1` | `skills.perception.total`, `.passive` | 1, 11 |
   | `set … 'cha'` and `set … 'str'` priority 60, on Stealth | `skills.stealth.total` | 5 = STR 3 + `checks.str.bonus` 2; keys `dex`, `cha`, `str` |
   | `set skills.insight.ability 'cha'` when `@level >= 2` | `skills.insight.total` | 3 (WIS: not applied) |
   | `set skills.survival.ability 'con'`, a toggle off by default | `skills.survival.total` | 3 (WIS); 4 (CON) with it switched on |

   No warning. With an override of `skills.athletics.ability` to `'cha'` besides: Athletics 2,
   its key steps `str`, `dex`, `cha`.
9. **Golden B with wrong content:** `add 1`, `set 2` and `advantage` on `skills.insight.ability`
   each warn `notAKey`; `set 'luck'` on `skills.survival.ability` warns `unknownKey`; an override
   of `skills.intimidation.ability` to `'str'` gives Intimidation 5 (STR 3 + 2); overrides of
   `skills.insight.ability` to `'luck'` and of `skills.survival.ability` to `3` warn
   `overrideNotAKey`. Insight and Survival stay 3. A number op on `skills.flying.ability`, a skill
   the character lacks, still warns `noTarget`.
10. **Tales** (core tests): Ash's climb on wits is 5 (wits 2 + 2 + 2 − 1); steady on grit is 2,
    passive 7; sneak with a `derived` `set 'grit'` of priority 90 and a `final` `set 'nerve'` is 3
    (nerve 1 + 2 + 1 − 1); an override of climb to nerve gives 4 over the wits effect. A `set` on
    climb whose `when` reads `@skills.climb.total` is a loop: `@skills.climb.total →
    @skills.climb.ability → @skills.climb.total`, not applied, climb 6. ENG-27's expected values
    are unchanged.
11. Every golden (A, B, B4, C in both editions, D) computes as before, with no warning; each has
    one key per skill, its own stat.
12. `compute()` stays pure: frozen inputs give equal results.
13. The quality gate is green.

#### 4. How to do it

1. `stats.ts`: `KeyStep`.
2. `effects.ts`: the parsing, the base-phase rule and `when` move out of `effectNumber` into one
   function both use; `effectKey(active, reader, keys, warn)`; `notAKey`, `unknownKey`.
3. `phases.ts`: `finishKey(path, own, keys, readBy)`; `overrideNotAKey`.
4. `derived.ts`: `KeyPath`, `ComputedKey`, `KeyReader`; `DerivedStep` gets `readKey`;
   `computeDerived` takes `keys` and `finishKey`, gives `keys`; the loop check is shared by both
   readers.
5. `compute.ts`: `SystemModule.keys`; `Computed.keys`.
6. Tales' module and its rules line; the fifth-edition module's `skillKeys` and skill totals.
7. The tests of §7.

Technical choices (ADR 002):
- **A key is a computed value of its own kind, kept apart from numbers.** `values` is what formulas
  read, and every one is a number (ENG-28); a breakdown's changes add up to its value (SPEC §6.2).
  A stat's key has neither, so it gets `Computed.keys`, with steps that name who chose it. The
  screen reads the key there (phase 2), and the stat's step in the total names the modifier used.
- **The core finishes a key path, not the module.** ENG-17's order (phase, priority, gathering),
  `when`, toggles and the base-phase rule are written once, in `effects.ts` and `phases.ts`; a
  module reading `activeEffects` itself would write them again, and the end-of-compute warnings
  (`noTarget`, `overrideNoPath`) would still name the path. The backlog note asked for the
  warnings; they are the core's, and game-free: "one of its keys", the keys given by the module.
- **An override of a key path is read here.** "Manual overrides always win" holds for every
  computed path; ENG-17 §4 left an override of a text to the ticket that computes one. Without it,
  an override of a skill's stat would warn that the path does not exist.
- **A `set` naming a key the path lacks is not applied, and warns.** Missing is not broken (SPEC
  §8.2): the skill keeps the stat it had. The module's keys for a skill are the stats the
  character has, so a pack's own stat (`san`) can be named as `str` can.
- **The skill's own stat is not checked against the keys.** A skill on a stat the character lacks
  reads its modifier with `missingPath` (ENG-13 §10); that stays.
- **A key path is finished when first read**, as a number is (ENG-17): its `when` may read a
  derived number, and a loop through it is caught by ENG-18's check, which both readers share.
- **The stat's check bonus follows the stat** (§8): a skill check with DEX is a DEX check.
- **Tales' skills read their stat the same way**, so the core's tests run on the made-up system
  (ADR 004 item 4). No Tales value changes: its content sets no stat.

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table changes. An effect's `set`
with a text and an override with a text were stored already (ENG-04, ENG-06); they are now read.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/phases.test.ts` — `describe('ENG-43 a key path …')`: §3 items 3–5 and 10
  on Ash: the order, `when`, a toggle, `final`, the override, each warning, `noTarget` kept.
- `packages/engine/test/cycle.test.ts` — `describe('ENG-43 …')`: a loop through a key path, named.
- `packages/engine/test/derived.test.ts` — `describe('ENG-43 …')`: `readKey` without phases; a path
  given both as a number and as a key; a key read for a path no module gives.
- `packages/system-5e/test/module.test.ts` — `describe('ENG-43 …')`: §3 items 7–9, 11, 12.
- Control numbers from: SPEC §6.7 golden B's modifiers (ENG-13 §3 item 9); ENG-27's
  `tales/expected.ts`; the variants worked out by hand from their data, never copied from a run.

#### 8. Checked against the source

Sources: foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (ENG-13's), `module/` and
`packs/_source/{rules,content24}`, which quote SRD 5.1 and SRD 5.2.1 (CC-BY-4.0).

**A skill used with another stat.** SRD 5.1 (`rules/chapter-7-using-ability-scores.yml`, "Variant:
Skills with Different Abilities"): "Normally, your proficiency in a skill applies only to a specific
kind of ability check … In such cases, the GM might ask for a check using an unusual combination of
ability and skill … a Constitution (Athletics) check. So if you're proficient in Athletics, you
apply your proficiency bonus to the Constitution check just as you would normally do for a Strength
(Athletics) check." SRD 5.2.1 (`content24/chapter-1/d20-tests.yml`): the Skills table "notes … the
ability check the skill most often applies to"; "if a rule refers to a Strength (Acrobatics or
Athletics) check, you can add your Proficiency Bonus to the check if you have proficiency in the
Acrobatics or Athletics skill." So the proficiency stays the skill's; the modifier is the stat's.

**How dnd5e computes it.** `module/data/shared/roll-config-field.mjs`: a skill's `ability` is a
stored `StringField`, so an active effect overrides it as any field. `module/data/actor/templates/
creature.mjs`, `prepareSkill`: `ability ??= skillData.ability; const abilityData =
this.abilities[ability]`; the ability's check bonus is that ability's (`checkBonusAbl =
simplifyBonus(abilityData?.check?.roll?.bonus, …)`); `skillData.mod = abilityData?.mod ?? 0`. So
the stat's modifier and its check bonus follow the skill's stat; the proficiency does not change.

Nothing in the goldens sets a skill's stat; no golden value changes.

#### 9. Not in this ticket

- A formula reading a key (`@skills.athletics.ability`): SPEC §5.6 names no such read; it reads 0
  with `missingPath`, as any path not a number.
- Choosing a stat for one roll (the GM's call in the variant above): the roll dialog, phase 2.
- An effect of a text on a skill the character lacks (`set` on `skills.flying.ability`): no
  warning, as ENG-17 left every op but a number's on a path that is not computed.
- Other paths of text or lists (`ac.formulas`, `defenses.*`, `roll.*`): ENG-14, ENG-34.

#### 10. Rake check

- **`packages/engine` is pure; the core names no game.** A key path, its steps and its warnings
  name no stat or skill; the module gives the paths and their keys. Tested on Tales.
- **Everything is data.** No stat key in the code: a skill's keys are the stats the character has.
- **`compute()` is pure.** Key paths are computed from the arguments only; the purity test covers
  `keys`.
- **A number with no breakdown entry is a bug.** A skill's total keeps its steps; its stat's step
  names the modifier it read. A key has its own steps.
- **Manual overrides always win.** An override of a key path is the last step.
- **Each system's rules live in its own module.** Which paths are keys, and which keys they take,
  is the module's; no `if (ruleset === …)`: both editions share the rule (§8).
- **Formulas never run code.** A key's `when` goes through ENG-07's evaluator.
- **Missing is not broken.** A key no stat has, an op that sets no key, an override of a wrong key:
  a warning, never a throw; the skill keeps its stat.
- **Licensing.** The feats are made up (`character:`); §8 quotes the SRDs (CC-BY-4.0) only.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `module.test.ts` alone: `Tests 18 passed (18)`, 1.21 s (14 before). `phases.test.ts` alone:
  `Tests 17 passed (17)`, 740 ms. `packages/engine`: `Test Files 14 passed (14)`, `Tests 176
  passed (176)` (170 before).
- Lint: `Checked 140 files`, no fixes, no error. No new file.
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 38 passed (38)`, `Tests 383 passed (383)`, 6.26 s (before: 38 files, 373
  tests).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- Every line of §3 items 8 to 10 is met. Golden B with the made-up feat: Athletics 4 (was 5,
  §2), `checks.str.total` 5, Perception 1 and passive 11, Stealth 5, Insight 3, Survival 3 (4
  switched on); with the override, Athletics 2. Each golden (A, B, B4, C in both editions, D) has
  18 keys, each its skill's own stat, and no warning.
- The tests bite. 20 breaks, each on its own and restored, the `engine` and `system-5e` tests run
  (255 tests). In the module: a total that ignores its key, 2 fail; the check bonus of the skill's
  own stat, 1; no `keys`, 4; a skill's keys only its own stat, 3. In the core: the `set`s not
  sorted, 2; priority ignored, 2; an effect's own priority ignored, 1; the override ignored, 3;
  its note dropped, 2; a key path not marked finished, 3; a key no stat has applied, 2; `when`
  ignored, 4; a `set` with a number taken for a key, 2; every key effect held to the base-phase
  rule, 4; no loop check for a key, 1; a key path not marked in progress, 2; a key and a number
  on one path not refused, 1; `Computed.keys` empty, 10; `readKey` giving nothing, 7. Tales'
  total ignoring its key, 3.

Differences from §3 and §4:
- No value differs. The size held at S: one core change (`keys`, `finishKey`, `readKey`) served
  both the module and its warnings.
- The backlog note asked the row to add the module's warnings for a skill's stat. They are the
  core's (`notAKey`, `unknownKey`, `overrideNotAKey`), game-free, with the module giving the keys
  (§4): a module reading `activeEffects` itself would have written ENG-17's order and `when` a
  second time, and `noTarget` and `overrideNoPath` would still have named the path.
- This ticket also reads an override of a key path (§3 item 5), which the row did not name;
  ENG-17 §4 left an override of a text to the ticket that computes a text.
- `effectNumber` now shares its formula checks with `effectKey` (`applies`); its warnings and
  their order are as before, and every ENG-12 and ENG-17 test passes unchanged.
- `DerivedStep` takes a third argument, so ENG-28's test helper `counted` (`derived.test.ts`)
  passes it on (`TS2554` before); no test changed in meaning.
- `computeDerived` without phases keeps a key path's own key; no test reads that default, as none
  reads ENG-28's default `finish`: `compute()` always passes the phases.

Found, not fixed:
- The sheet must read a skill's stat from `Computed.keys['skills.<key>.ability']`, not from the
  skill's own `ability`, and an override of it is a stat's key, a text. Noted on phase 2 in
  `BACKLOG.md`.
- A list or a roll target (`ac.formulas`, `defenses.*`, `roll.*`) can take the same road as a key
  path: given by the module, finished by the core with its own warnings. Noted on ENG-14 and
  ENG-34 in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-14 Combat numbers

**Hat:** Combat numbers are computed: hit points, armor class, initiative, speed
**Depends on:** ENG-13 (`fifthEditionModule`, `checks.<stat>.total`), ENG-17 (effects on a path),
ENG-11 (`gather`), ENG-09 and ENG-10 (the golden fixtures)
**Size:** M
**Screen:** No
**SPEC:** §6.1 step 5 (hit point maximum, AC from formula candidates, initiative, speed); §5.3
(`ClassDef.hitDie`, `SpeciesDef.speed`, `ItemDef.armor`, the shield's effect and "item effects
apply only when `@equipped`"); §5.4's targets `init.bonus`, `ac.bonus`, `ac.formulas`,
`hp.max.bonus`, `speed.<kind>`, `speed.<kind>.bonus`, `speed.all.mul`; §5.6 (`@armor.worn`,
`@shield`, `@equipped`, `@attuned`); §5.8 (`classes[].hp`, `inventory`); §6.7 goldens A, B, B4
and D (their combat lines); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/combat.ts` — new: `combatSteps`, the hit points, armor
class, initiative and speed steps, and `hitPointsOf(die, entry)`.
- `packages/system-5e/src/module.ts` — changes: `entities` names each equipped item with its own
  paths; `derive` adds `combatSteps`.
- `packages/system-5e/src/system.ts` — changes: `SPEED_KINDS`, the five kinds of speed, which
  `entity-types.ts`'s speed schema now reads.
- `packages/engine/src/gather.ts` — changes: `NamedEntity.paths` and `HadEntity.paths`, an
  entity's own paths.
- `packages/engine/src/effects.ts` — changes: `ActiveEffect.paths`, read before any computed
  path by a number, a key (ENG-43's `effectKey`) and an append alike; `appendedNumbers`, the
  numbers `append` effects give a list of formulas; the warning `notAppended`.
- `packages/engine/src/derived.ts` — changes: a step may return `ruleWarnings` (warned
  `stepRule`) and `effectWarnings` (warned as they are).
- `packages/engine/src/stats.ts` — changes: an `effect` step's `op` may be `append`.
- `packages/engine/test/phases.test.ts` — changes: two `ENG-14` blocks, on Tales.
  `packages/engine/test/derived.test.ts` — changes: an `ENG-14` block.
- `packages/engine/src/compute.ts` — changes: the doc of `SystemModule.entities`.
- `packages/system-5e/test/combat.test.ts` — new: the steps on the goldens and on made-up
  variants of them.
- `packages/system-5e/test/golden/golden-values.test.ts` — changes: the ENG-14 lines.
- `packages/system-5e/test/golden/checks.ts` — changes: five stand-ins go; `crit.range` stays.
- `packages/system-5e/test/golden/fixtures-2014.test.ts`, `fixtures-2024.test.ts`,
  `packages/system-5e/test/module.test.ts` — change: the equipped items are gathered.
- `docs/tickets/BACKLOG.md` — the re-cut rows ENG-44 to ENG-48 (§4).

#### 2. What is missing now

Measured on `main` at `36f1450`:
- `grep -rn "hp.max\|ac\.\|init\.\|speed\." packages/engine/src packages/system-5e/src` finds
  two lines of `entity-types.ts`, a schema's message and a comment: no step gives hit points,
  armor class, initiative or speed.
- `hp.max.bonus`, `init.bonus`, `ac.bonus`, `armor.worn` and `speed.all.bonus` are the golden
  test's stand-ins (`STAND_INS`, `test/golden/checks.ts`); `armor.worn` is 1 whatever is worn.
- `grep -rn equipped packages/engine/src packages/system-5e/src` finds only the inventory schema:
  no code gathers an inventory item, so the shield's effect (`ac.bonus` +2 when `@equipped`) is
  never read. Golden A gathers 17 entities, none of them its three items.
- An `append` effect is left alone by the phases with no warning (ENG-17 §3 item 5); no code reads
  `ac.formulas`.
- `pnpm test`: `Test Files 38 passed (38)`, `Tests 373 passed (373)`.

#### 3. What it should look like when done

1. **Equipped items are gathered.** `fifthEditionModule.entities` names, after the feats, each
   inventory row that is `equipped` and has an `itemId`, in inventory order, with its own paths
   `{ equipped: 1, attuned: 1 or 0 }`. A row not equipped is not named, so its effects and grants
   do not apply (SPEC §5.3: item effects apply only when equipped).
2. **An entity's own paths** (the core, game-free): `NamedEntity.paths` is kept on the gathered
   entity (`HadEntity.paths`; the first naming's when named twice). Its own effects read them before
   any computed path, in every phase; the base-phase rule allows them. Another entity's formula
   reading `@equipped` gets `missingPath`, as before.
3. **A step's own warnings** (the core): a step may return `ruleWarnings` (`{ rule, data?,
   message }`), each warned `{ code: 'stepRule', path, rule, data? }`, and `effectWarnings`,
   warned as they are.
4. **Appended numbers** (the core): `appendedNumbers(effects, target, readerOf, warn)` gives, for
   each active effect on `target` whose op is `append`, its text worked out as a formula, as
   `effectNumber` works one out (`when`, formula warnings, own paths). Any other op that gives no
   number is warned `notAppended`; a number op is left to the phases' `noTarget`. An `effect`
   step's `op` may be `append`.
5. **Hit points**: `hp.max.bonus` 0; `hp.max` = for each class the character has, in order, each
   level's hit points: `max` the class's die, `avg` half the die + 1, a number itself; each level
   adds the Constitution modifier, at least 1 a level; then `hp.max.bonus`. Steps: an `entity`
   step per class (the sum of its levels' hit points), a `path` step `abilities.con.mod` (`change`
   the modifier × the levels), a `rule` step `hitPointsMinimum` when a level is raised to 1, a
   `path` step `hp.max.bonus`. A number above the class's die is warned `stepRule`
   `hitPointsAboveDie`, and the die is used. A class no pack has gives no hit points.
6. **Armor class**:
   - `armor.worn` 1 when the character has an item of the category `armor` (the first, in the order
     gathered), with an `entity` step naming it; else 0. `shield` the same for the category
     `shield`;
   - `ac.bonus` 0, a target for effects (the shield's +2, Defense's +1);
   - `ac.base` the highest of the candidates, the first of equal ones: the worn armor's `baseAC`
     plus the Dexterity modifier (all of it when `dexCap` is `null`, none when it is 0, else at
     most `dexCap`), or 10 + the Dexterity modifier when no armor is worn; then each number
     `appendedNumbers` gives for `ac.formulas`. The chosen candidate's steps are its breakdown;
   - `ac.total` = `ac.base` + `ac.bonus`.
7. **Initiative**: `init.bonus` 0; `init.total` = `checks.dex.total` + `init.bonus`.
8. **Speed**: `speed.all.bonus` 0; `speed.all.mul` 1; for each kind (`walk`, `fly`, `swim`,
   `climb`, `burrow`): `speed.<kind>.bonus` 0 and `speed.<kind>`: the species' speed of that kind,
   or a gathered lineage's own; then + `speed.<kind>.bonus` + `speed.all.bonus`, at least 0; then
   × `speed.all.mul`, rounded down. A kind the character has no speed of is 0 with no step.
9. **Goldens** (SPEC §6.7):

   | Golden | Line | Expected |
   |---|---|---|
   | A | hit points | 12 = 8 + 3 + 1 |
   | A | AC | 18 = chain mail 16 + shield 2 |
   | A | speed, initiative | 25, +0 |
   | B | hit points | 12 |
   | B | initiative | +3 = DEX +1 + Alert +2 |
   | B | AC | 17 = chain mail 16 + Defense 1 |
   | B | speed | 30 |
   | B4 | hit points | 36 = 12 + 3 × (6 + 2) |
   | B4 | initiative | +3 |
   | D | initiative, speed | −1, 20; golden B's +3 and 30 without exhaustion |

   Every golden's breakdowns add up to their values, and none of them gets a warning.
10. **The stand-ins left**: `crit.range` (ENG-16) only; the test fails if the module gives it.
11. **Made-up variants, worked out by hand** (§7): light, medium and heavy armor at DEX +3 and −1,
    no armor; an `ac.formulas` candidate with a `when`; a second armor; a shield not equipped; an
    item effect reading `@attuned`; the minimum of 1 hit point a level; a number above the die; a
    lineage's own speed, a speed bonus of one kind, the floor at 0, the multiplier; a bonus to
    Dexterity checks in initiative.
12. `compute()` stays pure: frozen inputs give equal results.
13. The quality gate is green.

#### 4. How to do it

1. **Re-cut first.** Five rules the sources name (§8) are not this hat, and each changes more
   than the four numbers; they become rows after this one in `BACKLOG.md`, each "found by
   ENG-14":
   - **ENG-44 Equipped items count only as the rules allow** (S): one armor and one shield at a
     time (SRD 5.1, SRD 5.2.1 "One at a Time"), an item that needs attunement only when attuned
     (SPEC §5.3), a magic armor's or shield's `magic.bonus`, and `@armor.group`, a text, which no
     derived value can be (ENG-28 gives numbers).
   - **ENG-45 Heavy armor's Strength requirement slows its wearer** (XS): −10 feet below the
     armor's `strRequirement` (dnd5e `armorSpeedReduction`), which a species trait may ignore
     (dnd5e's flag `ignoreArmorSpeedReduction`).
   - **ENG-46 Armor worn without training has its edition's penalties** (S), after ENG-34 and
     ENG-19: disadvantage on Strength and Dexterity rolls and no spellcasting (both editions);
     in 2024 a shield's AC only with training. The proficiency keys `light`, `medium`, `heavy`,
     `shield` (ENG-09 §4) are compared with `armor.group` and `category`.
   - **ENG-47 The person picks which base AC calculation counts** (S): SPEC §6.1 step 5 lets the
     person pin a candidate, which needs a stored field, so a migration.
   - **ENG-48 The character's size comes from its species** (XS): `species.size`, or the
     species' one size; several and none chosen is pending (found by ENG-33, noted on ENG-14). A
     size is a text, not a combat number.
2. `gather.ts`: `NamedEntity.paths`, `HadEntity.paths`.
3. `effects.ts`: `ActiveEffect.paths`; the formula work of `effectNumber` moves to one function
   that both `effectNumber` and `appendedNumbers` call, reading own paths first; `notAppended`.
4. `stats.ts`: `op: NumberOp | 'append'`. `derived.ts`: `RuleWarning`, `ruleWarnings`,
   `effectWarnings`, `stepRule`.
5. `system.ts`: `SPEED_KINDS`. `combat.ts`: `combatSteps`. `module.ts`: the items, `derive`.
6. Tests (§7), then the golden tests' stand-ins and gathered lists.

Technical choices (ADR 002):
- **Only equipped items are named.** SPEC §5.3 says an item's effects apply only when equipped;
  naming only those makes that rule hold for every effect and grant of an item, with no
  per-effect default the core would have to learn. Their own paths still give `@equipped` 1, so the
  shield's own `when: '@equipped'` (SPEC's example) reads true; `@attuned` is the row's flag.
- **Own paths are the core's, named by the module.** SPEC §5.6 lists `@equipped` and `@attuned`
  as contextual: read per entity, not one value for the character. The core keeps a number per
  path for an entity the module names and reads it before the computed values for that entity's
  effects; it never learns what an item is.
- **The first armor gathered is the one worn**, in inventory order (dnd5e takes `armors[0]`).
  Warning of a second, and leaving a second shield's effect out, is ENG-44's.
- **AC is the best candidate plus `ac.bonus`** (SPEC §5.4 and §6.1): the module's own base is the
  armor's when armor is worn, else 10 + DEX (dnd5e `armored` and `unarmored`, §8); effects add
  candidates to `ac.formulas`, and their own `when` says when they hold (`!@armor.worn` for an
  unarmored one). `ac.base` is a path of its own, so a formula reads it and its breakdown is the
  chosen candidate's.
- **`dexCap` 0 adds no Dexterity, not even a negative one**: "Heavy armor doesn't let you add your
  Dexterity modifier to your Armor Class, but it also doesn't penalize you" (§8); the schema says
  `dexCap` 0 is "none". Any other cap is a maximum: a negative modifier still counts (medium and
  light armor, §8).
- **The rules' stats are named once in the module** (`RULE_STATS`: initiative and AC Dexterity,
  hit points Constitution), as dnd5e's `defaultAbilities` (§8). They are the SRD's rules, which
  live in the module (ADR 004); no list of stats is written. A pack without the stat warns
  `missingPath` and reads 0.
- **Initiative is the Dexterity check's total plus `init.bonus`**: "they make a Dexterity check"
  (§8), so `checks.dex.bonus` and `d20.all.bonus` are in it, as dnd5e adds them.
- **Hit points per class, not per level, in the breakdown**, with the Constitution modifier as
  one step "×levels", as ENG-13 shows the proficiency bonus. The minimum of 1 is dnd5e's
  `getAdjustedTotal` and SRD 5.2.1's "(minimum of 1)"; it gets its own step when it raises a level.
- **A stored number above the die uses the die**, with a warning (ENG-33 §4: the schema bounds it
  by 12, the largest die). The person's data is kept; the sheet shows the warning.
- **All five kinds of speed are paths**, 0 when the character has none of a kind, so an effect
  giving a speed (`speed.fly` `max @speed.walk`) has a path to change. Bonuses apply only to a
  speed the character has (dnd5e: only when the speed is above 0). An effect on `speed.<kind>`
  itself applies after the bonuses (ENG-17's order).
- **The multiplier rounds down**: "Whenever you divide or multiply a number in the game, round
  down" (SRD 5.2.1, §8).
- **A lineage's speed replaces its species' kind by kind**: no SRD lineage has a speed (ENG-32 §8),
  so this is for homebrew; a lineage giving `{ swim: 30 }` keeps the species' walking speed.
- **One function works out an effect's formula** for `effectNumber` and `appendedNumbers`, so
  `when`, the formula warnings and own paths are written once (`effects.ts`'s header rule). Since
  the rebase onto ENG-43 that function is ENG-43's `applies`, and own paths are one reader,
  `withOwnPaths`, which numbers, keys and appends all read through.
- **`ac.formulas` is not a key path.** ENG-43's note offers its key paths to lists; a key path
  holds one key, and `ac.formulas` is a list of formulas whose numbers are compared, so its
  appends are worked out where the AC is computed (`appendedNumbers`).

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table changes. `equipped`,
`attuned`, `classes[].hp` and `ItemDef.armor` were stored already; they are now read.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/phases.test.ts` — `describe("ENG-14 an entity's own paths")`: on
  Tales, a module naming a talent with `{ carried: 1 }`: its derived-phase and base-phase effects
  reading `@carried` apply; with `{ carried: 0 }` they do not; another entity reading it warns;
  a key effect's `when` reads it (ENG-43's `skills.<key>.ability`); the gathered entity keeps its
  paths; an entity named twice keeps the first's.
- `packages/engine/test/derived.test.ts` — `describe("ENG-14 a step's own warnings")`:
  `ruleWarnings` give `stepRule` naming the path; `effectWarnings` pass as they are.
- `packages/engine/test/phases.test.ts` — `describe('ENG-14 appended numbers')`: a formula, a
  number's text, a `when` false, a formula that does not parse, an own path; `advantage`, `note`
  and a `set` with a text warn `notAppended`; `add` is left to `noTarget`.
- `packages/system-5e/test/combat.test.ts` — `describe('ENG-14 combat numbers')`: §3 items 1,
  5–8, 11, 12.
- `packages/system-5e/test/golden/golden-values.test.ts` — `describe('ENG-14 goldens: combat
  numbers')`: §3 item 9.
- Control numbers from: SPEC §6.7 (item 9); §8's sources; the variants worked out by hand from
  their data, never copied from a run.

#### 8. Checked against the source

Sources: foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (ENG-13's), `module/` and
`packs/_source/{rules,content24}`, which quote SRD 5.1 and SRD 5.2.1 (CC-BY-4.0); 5e-bits/
5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
`packages/5e-database/src/{2014,2024}/en/`.

**Hit points.** SRD 5.2.1 (`content24/chapter-2/character-creation.yml`): level 1 "Fighter,
Paladin, or Ranger 10 + Con. modifier", "Bard, Cleric, … 8 + Con. modifier"; gaining a level: "Roll
that die, add your Constitution modifier to the roll, and add the total (minimum of 1) to your Hit
Point maximum. Instead of rolling, you can use the fixed value shown in the Fixed Hit Points by
Class table" (the fighter "6 + Con. modifier"); "When your Constitution modifier increases by 1,
your Hit Point maximum increases by 1 for each level". Multiclassing, both editions
(`rules/chapter-6-customization-options.yml`, `character-creation.yml`): "You gain the hit points
from your new class as described for levels after 1st. You gain the 1st-level hit points for a
class only when you are a 1st-level character." dnd5e (`documents/advancement/hit-points.mjs`):
`valueForLevel` gives `max` the die, `avg` `hitDieValue / 2 + 1`, a number itself;
`getAdjustedTotal(mod)` adds `Math.max(value + mod, 1)` per level; `prepareHitPoints` adds the
bonus. 5e-database: the cleric's and the wizard's dice 8 and 6, the fighter's and the paladin's 10.
SRD 5.1 Dwarven Toughness (`5e-SRD-Traits.json`): "Your hit point maximum increases by 1, and it
increases by 1 every time you gain a level."

**Armor class.** SRD 5.1 (`rules/chapter-5-equipment.yml`): "The armor (and shield) you wear
determines your base Armor Class"; light armor: "you add your Dexterity modifier to the base number
from your armor type"; medium: "you add your Dexterity modifier, to a maximum of +2"; heavy:
"Heavy armor doesn't let you add your Dexterity modifier to your Armor Class, but it also doesn't
penalize you if your Dexterity modifier is negative"; "Wielding a shield increases your Armor Class
by 2. You can benefit from only one shield at a time"; chain mail AC 16, "Str 13". SRD 5.2.1
(`content24/chapter-6/equipment.yml`): "The table's Armor Class column tells you what your base AC
is when you wear a type of armor … your AC is 16 in Chain Mail"; the Shield "+2"; "A creature can
wear only one suit of armor at a time and wield only one Shield at a time"; "You gain the Armor
Class benefit of a Shield only if you have training with it" (ENG-46). The rules glossary (Armor
Class): "Your base AC calculation is 10 plus your Dexterity modifier. If a rule gives you another
base AC calculation, you choose which calculation to use; you can't use more than one."
`character-creation.yml`: "Without armor or a shield, your base Armor Class is 10 plus your
Dexterity modifier." SRD 5.1 has no sentence for the unarmored base; dnd5e (`config.mjs`
`armorClasses`) uses `unarmored` `10 + @abilities.dex.mod`, `armored: false`, for both editions.
dnd5e (`data/actor/templates/attributes.mjs`, `prepareArmorClass`): the first equipped armor and
shield count, a second of either warned; heavy armor clamps DEX to 0, else `Math.min(mod,
armor.dex ?? Infinity)`; a formula is valid only when `armored` matches; the highest result is
the base (`result > ac.base`, so the first of equal ones); `value = base + shield + bonus`.

**Initiative.** SRD 5.1 (`5e-SRD-Rules.json`, Initiative): "every participant makes a Dexterity
check"; "you roll initiative by making a Dexterity check". SRD 5.2.1 (`content24/chapter-1/
combat.yml`): "they make a Dexterity check that determines their place in the Initiative order";
`character-creation.yml`: "Write your Dexterity modifier in the space for Initiative". dnd5e
(`prepareInitiative`): the DEX modifier, the initiative bonus, the DEX check bonus, every check's
bonus and the roll reduction; Alert's +proficiency in 2024 is its effect here (SPEC §5.4).

**Speed.** 5e-database: the 2014 dwarf `speed` 25; the 2024 human 30. SRD 5.2.1 Exhaustion (rules
glossary): "Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level."
dnd5e (`prepareMovement`): every kind `Math.max(0, speed - reduction)`, then, only when above 0,
`Math.max(0, speed + bonus) * multiplier`; heavy armor's `armorSpeedReduction` (10) when its
Strength is above the wearer's, unless `ignoreArmorSpeedReduction` (ENG-45). SRD 5.1 and 5.2.1:
"the armor reduces the wearer's speed by 10 feet unless the wearer has a Strength score equal to or
higher than the listed score" (ENG-45). SRD 5.2.1 (`playing-the-game.yml`): "Whenever you divide or
multiply a number in the game, round down if you end up with a fraction".

**Armor training** (ENG-46). SRD 5.1: "If you wear armor that you lack proficiency with, you have
disadvantage on any ability check, saving throw, or attack roll that involves Strength or
Dexterity, and you can't cast spells." SRD 5.2.1: "If you wear Light, Medium, or Heavy armor and
lack training with it, you have Disadvantage on any D20 Test that involves Strength or Dexterity,
and you can't cast spells."

**The goldens' combat lines agree with these** (worked out before the test was written): A's
hit points 8 (the cleric's d8, `max`) + 3 (CON 16) + 1 (Dwarven Toughness, level 1); AC chain mail
16, no DEX (heavy), + the shield's 2 (equipped); speed the dwarf's 25; initiative DEX 10's +0. B's
10 (the fighter's d10) + 2 (CON 15); initiative DEX 13's +1 + Alert's `@prof` 2; AC 16 + Defense 1
(`@armor.worn` 1); speed the human's 30. B4's 10 + 6 + 6 + 6 (`avg`: 10 / 2 + 1) + 2 × 4 = 36;
initiative +1 + 2 (`prof` +2 at level 4). D's −4 on the DEX check: +1 − 4 + 2 = −1; speed 30 − 10.
No golden value looks wrong; nothing stops.

#### 9. Not in this ticket

- One armor and one shield, attunement, a magic armor's bonus, `@armor.group`: ENG-44.
- Heavy armor's Strength requirement: ENG-45. Armor without training: ENG-46.
- Choosing the base AC calculation by hand: ENG-47. The character's size: ENG-48.
- Advantage on initiative (Remarkable Athlete 2024, golden B4's "with advantage"): ENG-34.
- Hit dice as a tracker, spent and regained: ENG-21. Current hit points and damage: ENG-20.
- 2014 exhaustion's speed (halved at level 2, 0 at level 5): ENG-19.
- Encumbrance's speed: the house rule `encumbrance`, a later phase.

#### 10. Rake check

- **The golden tests are the truth.** Each expected value is SPEC §6.7's; §8 shows each agrees
  with the sources.
- **`packages/engine` is pure; the core names no game.** Own paths, `appendedNumbers`, `stepRule`
  name no game; they are tested on Tales.
- **Everything is data.** No list of stats; the rules' two stats are named once in the module, as
  dnd5e's config does. Armor, shield and speeds are read from the items and species; the shield's
  +2 and Defense's +1 stay their effects.
- **`compute()` is pure.** The module reads its arguments only; the purity test runs it frozen.
- **A number with no breakdown entry is a bug.** Every path has its steps, and they add up:
  `speed.all.mul`'s 1 is a `rule` step.
- **Manual overrides always win.** The new paths are finished by ENG-17's phases.
- **Each system's rules live in its own module.** No `if (ruleset === …)`: both editions share
  each rule here (§8); the 2024 shield rule is ENG-46's, in the ruleset files.
- **Formulas never run code.** `ac.formulas` candidates go through ENG-07's evaluator.
- **Missing is not broken.** A class or item no pack has, a stat a pack lacks, a bad formula: a
  warning and 0, never a throw.
- **Stored units are feet.** Speeds are feet as stored.
- **Licensing.** Variants are made up (`character:`); §8 quotes the SRDs (CC-BY-4.0) only.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `combat.test.ts` alone: `Tests 13 passed (13)`, 902 ms. `golden-values.test.ts` alone: `Tests 10
  passed (10)`, 1.03 s.
- Lint: `Checked 142 files`, no fixes, no error (140 before; 2 new files).
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 39 passed (39)`, `Tests 407 passed (407)`, 7.09 s, after the rebase onto
  ENG-43 (`9fffa99`). Before this ticket, at `36f1450`: 38 files, 373 tests; before the rebase,
  this ticket alone: 39 files, 396 tests.
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`. The published
  pack JSON Schema is unchanged: its test passed with `SPEED_KINDS` in the speed schema.
- Golden A has 131 paths (was 115): the 21 of §3 items 5–8, and five stand-ins fewer. It gathers
  20 entities (was 17): chain mail, the shield and the warhammer.
- Every line of §3 item 9 is met: A 12, 18, 25, +0; B 12, +3, 17, 30; B4 36, +3; D −1, 20, and B
  again without exhaustion. Every golden computes with no warning, and each of its breakdowns adds
  up to its value.
- The tests bite. Before the rebase, 27 breaks, each on its own and restored, the `engine` and
  `system-5e` tests run (268 tests). In `combat.ts`: `avg` without its +1, 4 fail; no minimum of 1 a
  level, 1; a number above the die kept, 1; CON counted once, 3; no `hp.max.bonus`, 2; `dexCap` 0
  taking a negative DEX, 1; `dexCap` `null` adding none, 2; the unarmored base 11, 2; an equal
  candidate winning, 1; no appended candidate, 1; the last armor worn, 1; initiative without
  `init.bonus`, 4; initiative from the DEX modifier, not the check, 2; no floor at 0, 1; the
  multiplier not rounded, 1; the species before a lineage, 1; bonuses given to a speed the character
  lacks, 2; no `speed.all.bonus`, 3; hit points from STR, 5. In `module.ts`: items named unequipped,
  1; `@attuned` always 0, 1. In the core: own paths not read, 9; the base phase refusing them, 2;
  gathering dropping them, 9; no `notAppended`, 2; rule warnings dropped, 2; effect warnings
  dropped, 2.
- One break first failed by a crash, not by its rule (35 tests, `giver.id` on nothing); written
  again so only the rule broke, it fails 2.
- After the rebase onto ENG-43, the core's breaks again on the merged `effects.ts` (279 tests):
  own paths not read, 11; the base phase refusing them, 2; a number not reading them, 9; a key not
  reading them, 1; an append not reading them, 1; no `notAppended`, 2.

Differences from §3 and §4:
- No value differs from §3.
- ENG-43 reached `main` while this ticket was built. Its `applies` and `effectKey` replaced the
  formula function §4 split out; own paths moved into one reader (`withOwnPaths`) used by all
  three, and a key effect reading `@carried` got a test. Its note on `ac.formulas` is answered in
  §4; `BACKLOG.md` keeps both tickets' rows and notes.
- The own-paths tests went into `phases.test.ts`, whose Tales helpers they use, not
  `compute.test.ts`; §1 and §7 say so.
- An `append`'s value is always a text (ENG-04's schema), so `appendedNumbers` reads only texts; §3
  item 4 and §7 were reworded: no yes/no can reach it.
- Two expected warnings of this ticket's own Tales tests were first written wrong. A derived-phase
  formula reading a path no step gives is warned by the derived values (`missingPath` with `for`,
  ENG-28's `valueAt`), not as the effect's formula warning; an `append` on a number path is warned
  `notANumber` by ENG-17's `finish`. The run showed both; the code says the same; no value changed.
- §4's ENG-45 line first said the 2014 dwarf ignores the slowing; 5e-database's dwarf holds only
  `speed: 25`, so it now says a species trait may (dnd5e's flag), and ENG-45's §8 checks.
- A helper of `combat.test.ts` took any text as an item id; typecheck refused it (`TS2322`), and it
  now takes an entity id.

Against the row and its notes:
- Each point of ENG-14's backlog note is done or moved: `@equipped` is read per item, as its own
  path (§3 items 1–2); `hp.max.bonus` is the module's, its stand-in gone; a level's hit points are
  `max`, `avg` or a number, one above the die warned (item 5); Defense reads `@armor.worn` and
  changes `ac.bonus` (B's 17), Alert changes `init.bonus` (B's +3); `speed.all.bonus` goes into
  every speed the character has, never below 0 (item 8); initiative adds `checks.dex.bonus` and
  `d20.all.bonus` (item 7, D's −1). The armor proficiency keys moved to ENG-46's note, the weapon
  keys to ENG-16's; the size is ENG-48.
- ENG-17's note: `ac.formulas` is read through `activeEffects`, and its own target warns
  `notAppended`; the note now names ENG-34 only, with ENG-43's road for lists beside it.
- The golden lines this ticket makes true are on in `golden-values.test.ts` (§3 item 9).

Found, not fixed:
- ENG-44 to ENG-48, the re-cut of §4, each a row with its note.
- Worn armor with `stealthDisadvantage` gives disadvantage on Stealth (SRD 5.1; dnd5e
  `prepareArmorClass`). Noted on ENG-34.
- An effect on `speed.<kind>` applies after the bonuses (ENG-17's order), so `speed.all.bonus`
  does not lower a speed an effect gives a kind the species lacks (`speed.swim` `max 30`); dnd5e
  lowers every speed. An effect reading `@speed.walk` is lowered with it. No row: no source in hand
  gives such a speed yet; phase 3's mechanics meet it first.

Nothing for the changelog.

---

### ENG-15 Spellcasting numbers

**Hat:** Spellcasting numbers are computed, multiclass slots included
**Depends on:** ENG-13 (the module, `prof`, `d20.all.bonus`, the class paths), ENG-28 (`derive`),
ENG-17 (effects on a path), ENG-32 (`SpellcastingDef`, the `spell` grant), ENG-09 and ENG-10 (the
golden fixtures)
**Size:** M
**Screen:** No
**SPEC:** §6.1 step 5 (the spell save DC and attack bonus; slots: one class by its own table,
several by the multiclass table with the ruleset's rounding); §5.3 (`SpellcastingDef`,
`SubclassDef.spellcasting`); §5.4's targets `spell.dc.bonus`, `spell.attack.bonus`; §5.8
(`slotsSpent`, `pactSlotsSpent`); §6.3's rows "Подготовка заклинаний" and "Мультикласс: вклад
паладина и следопыта" (`[ПРОВЕРИТЬ]`, §8); §6.7 golden A's spell lines and golden C; ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/spellcasting.ts` — new: the multiclass table, and the
spellcasting steps: each casting class's save DC, attack bonus and spell counts, the caster level,
the slots, the pact slots, and the two bonus targets.
- `packages/system-5e/src/rulesets/edition-rules.ts` — new: `EditionRules`, what differs between
  the editions (SPEC §6.3). This ticket gives it one field; ENG-19 adds the rest.
- `packages/system-5e/src/rulesets/2014.ts`, `rulesets/2024.ts` — new: each edition's rules.
- `packages/system-5e/src/rulesets/index.ts` — new: the rules of a character's edition.
- `packages/system-5e/src/classes.ts` — new: `classesOf`, moved out of `module.ts`, now with each
  class's subclass.
- `packages/system-5e/src/module.ts` — changes: `derive` adds the spellcasting steps.
- `packages/system-5e/src/checks.ts` — changes: `sumOf` is exported and takes a rule's number as
  a part; the zero step is exported as `zeroStep`.
- `packages/system-5e/src/index.ts` — changes: exports the new files.
- `packages/engine/src/stats.ts` — changes: an `entity` step may carry the `formula` its field
  holds.
- `packages/system-5e/test/spellcasting.test.ts` — new: the steps on the goldens and on made-up
  variants of them.
- `packages/system-5e/test/golden/golden-values.test.ts` — changes: golden A's spell lines and
  golden C.
- `docs/tickets/BACKLOG.md` — the notes of ENG-16 and ENG-19 (§4).

#### 2. What is missing now

Measured on `main` at `36f1450`:
- `grep -rln "spellcasting\|slotsTable\|preparedCount" packages/system-5e/src packages/engine/src`
  finds only `entity-types.ts`, the schema: no code reads a class's spellcasting.
- `grep -rn "spell.dc\|spell.attack" packages --include=*.ts` finds nothing: SPEC §5.4's two
  targets are no path. An effect on them warns `noTarget`.
- `ls packages/system-5e/src/rulesets` fails: no such folder. The editions share every rule the
  module computes so far (ENG-13 §10).
- Golden A has no path for its save DC, attack bonus, prepared count, cantrips or slots; golden C
  none for its caster level or slots.
- The note under the backlog (found by ENG-09): a class has no level it starts casting at. The
  2014 paladin's slot row at level 1 is empty, but its prepared count, `max(1, …)`, gives 1.
- `pnpm test`: `Test Files 38 passed (38)`, `Tests 373 passed (373)`.

#### 3. What it should look like when done

1. **A class casts** when it has `spellcasting`, its own or else its subclass's (SPEC §5.3: a
   subclass may cast, as a homebrew third caster does). It casts **at its level** when the row of
   its `slotsTable` at that level has a slot, or its `cantripsKnown` there is above 0. With neither
   column, it casts from level 1. So the 2014 paladin casts from level 2, the 2024 one from level
   1, as their fixtures' tables say (§8). A class that does not cast at its level gives no
   spellcasting path.
2. **Each casting class** gives, under its class's key (a subclass's spellcasting too):
   - `classes.<key>.spell.dc` = 8 + its stat's modifier + `prof` + `spell.dc.bonus`;
   - `classes.<key>.spell.attack` = its stat's modifier + `prof` + `spell.attack.bonus` +
     `d20.all.bonus` (a spell attack is a d20 test, §8);
   - `classes.<key>.spell.prepared`: its `preparedCount` at its level, a formula's value or the
     column's number;
   - `classes.<key>.spell.cantrips`: its `cantripsKnown` at its level;
   - `classes.<key>.spell.known`: its `spellsKnown` at its level.
   A count is given only when the class has its field.
3. **The bonus targets** `spell.dc.bonus` and `spell.attack.bonus` are 0 for every character,
   targets for effects (SPEC §5.4).
4. **The caster level**, `spell.casterLevel`, when a class casts by slots (`full`, `half`,
   `third`): each such class's share of its levels: all of a full caster's; half a half caster's,
   rounded down in 2014 and up in 2024; a third of a third caster's, rounded down in both (§8).
   A class alone in casting by slots counts its levels divided, rounded up, once its share is
   above 0 (dnd5e, §8): with it, the multiclass table gives the SRD paladin's own table at every
   level, in both editions. The 2014/2024 rounding is in the edition files, `rulesets/2014.ts` and
   `rulesets/2024.ts`, and nowhere else.
5. **The slots**, `spell.slots.level1` to `spell.slots.level9`, when a class casts by slots:
   - one such class: its own `slotsTable` row at its level; a class without a `slotsTable` takes
     the multiclass table's row at `spell.casterLevel`;
   - several: the multiclass table's row at `spell.casterLevel` (SRD 5.1 and SRD 5.2.1 give one
     table, measured equal, §8).
   A level with no slot is 0.
6. **The pact slots**, `spell.pact.level` and `spell.pact.slots`, when a class casts by `pact`:
   its row at its level holds its slots at one spell level; the highest level with a slot is the
   pact level, its count the slots. Pact slots never join the caster level (§8). With two pact
   classes, the first taken gives them (§4).
7. **Breakdowns.** A total names each part as a `path` step; the DC's 8 is a `rule` step,
   `spellDcBase`. A count or a slot from a class's own table is an `entity` step naming the class
   or subclass whose `spellcasting` it is; a count from a formula is that step with its `formula`.
   A share of the caster level is a `path` step on `classes.<key>.level` (its `value` the level,
   its `change` the share). A slot from the multiclass table is a `path` step on
   `spell.casterLevel` (its `value` the caster level, its `change` the slots). A slot level, a pact
   level or a pact slot count of 0 has no step; a spell count always has its one step. A prepared
   count's formula that does not parse gives 0 and a `stepFormula` warning.
8. **Goldens** (SPEC §6.7):

   | Golden | Line | Expected |
   |---|---|---|
   | A | spell save DC / attack bonus | 13 / +5 |
   | A | spells | prepared 4; Bless and Cure Wounds always prepared; 2 slots of level 1; 3 cantrips |
   | C, 2014 | caster level; slots | 3 + ⌊3/2⌋ = 4; level 1: 4, level 2: 3 |
   | C, 2024 | caster level; slots | 3 + ⌈3/2⌉ = 5; level 1: 4, level 2: 3, level 3: 2 |

   Golden A's always-prepared spells are the Life domain's `domain-spells-1` grant, reached with
   `alwaysPrepared` (ENG-11 gathers it); the prepared count does not include them (§8). Every
   golden's breakdowns add up to their values, and none of them gets a warning.
9. **Made-up variants, worked out by hand** (§7): golden C's per-class numbers in both editions; a
   2014 and a 2024 paladin at level 1 beside a wizard; a class without a `slotsTable`, alone, at
   levels 1 and 5, in both editions; two half casters, each rounded on its own; a class that
   starts casting with its cantrips; a subclass that casts; a pact caster alone and beside a
   wizard; effects on the bonus targets, a slot and `d20.all.bonus`; a class casting by a stat the
   character lacks; a prepared formula that does not parse; golden B, which casts nothing.
10. `compute()` stays pure: frozen inputs give equal results.
11. The quality gate is green.

#### 4. How to do it

1. `stats.ts`: the `entity` step's optional `formula`.
2. `rulesets/`: `EditionRules` with `halfCasterRounding: 'down' | 'up'`; `RULES_2014`,
   `RULES_2024`; `rulesOf(character)`, a lookup by the character's edition.
3. `classes.ts`: `classesOf(character, gathered)` from `module.ts`, each entry with the gathered
   subclass its `systemData` names.
4. `checks.ts`: export `sumOf`; a part may be `{ rule, value }`.
5. `spellcasting.ts`: `MULTICLASS_SLOTS`, `SPELL_DC_BASE`, `spellcastingSteps(input)`.
6. `module.ts`: `derive` joins the class, check and spellcasting steps.
7. Tests (§7). Then the backlog notes: ENG-19's says the multiclass rounding and golden C closed
   in ENG-15; ENG-16's names SPEC §5.4's second spell target, `attack.spell.bonus` (below).

Technical choices (ADR 002):
- **The 2014/2024 rounding is a field of the edition files** (`halfCasterRounding`), read through
  `rulesOf(character)`, a lookup by edition: no `if (ruleset === …)`. This ticket makes the files
  with the one difference it needs; ENG-19's row, "the ruleset files hold every 2014/2024 rules
  difference", adds the others. The third caster's rounding is not a difference (§8), so it stays
  in `spellcasting.ts`.
- **When a class starts casting is read from its tables**, not from a new field: the first level
  whose slot row has a slot or whose cantrips are above 0. 5e-database's `spellcasting.level` (2
  for the 2014 paladin and ranger, 1 for every other caster, §8) agrees with the tables of every
  SRD class; a new field would say the same twice and change the stored shape.
- **One casting class uses its own table** (SPEC §6.1 step 5, and both SRDs: "If you multiclass
  but have the Spellcasting feature from only one class, follow the rules for that class"). A
  class without a `slotsTable` takes the multiclass row at `spell.casterLevel`. Classes that do
  not cast at their level do not count, so a 2014 paladin 1 beside a wizard leaves the wizard
  alone.
- **A lone class's caster level is dnd5e's**: its levels divided, rounded up, once its share is
  above 0 (`computeProgression`, §8). A homebrew half or third caster without a table then gets
  the slots the SRD's own tables give (a 2014 half caster 5: row 3, 4 and 2 slots, as the 2014
  paladin 5; not row 2's 3), and the caster level a lone class shows agrees with its slots. The
  test checks it against both fixture paladins' tables at all 20 levels.
- **Each class's share is rounded on its own**, then the shares add up, as dnd5e's
  `computeProgression` does (§8). The SRDs' "half your levels … in the Paladin and Ranger classes"
  does not say; no golden has two half casters.
- **The multiclass table is one constant**: both SRDs print the same table, equal to the full
  caster table (§8). A table that differed by edition would move into the edition files.
- **Pact magic is its own pool**: SRD 5.1 and SRD 5.2.1 leave the warlock out of the caster level
  and let pact slots and spellcasting slots cast each other's spells (§8). `pactSlotsSpent` is one
  number (ENG-33), so the pool is one: the first pact class taken gives it. No SRD has two pact
  classes.
- **Per-class numbers sit under `classes.<key>.spell`**, beside ENG-13's `classes.<key>.level`
  and `.table`: a multiclass caster has a DC and attack per class ("you use the spellcasting
  ability of that class", §8). The character's numbers sit under `spell.`, beside SPEC §5.4's
  `spell.dc.bonus`. A path's steps start with a letter (`computedPathSchema`), so the slot levels
  are `level1` to `level9`; `slotsSpent`'s key `"1"` is `spell.slots.level1`.
- **SPEC §5.4 has two targets for a spell attack**: `spell.attack.bonus` (with `spell.dc.bonus`)
  and `attack.spell.bonus` (with the weapon attacks). This ticket's attack bonus adds the first;
  ENG-16, which computes attacks, decides how a spell's attack reads the second. Noted there.
- **Spell attack reads `d20.all.bonus`; the DC does not**: an attack roll is a d20 test, a DC is
  not a roll (§8; dnd5e adds the roll reduction to the attack, not the DC).
- **The bonus targets are given to every character**, as ENG-13's `saves.all.bonus` is; the other
  paths only to a character with a class that casts, so a fighter's sheet has none.
- **A prepared count's formula is read with `read`**, as ENG-13's `totalFormula`: it is a field of
  the class, not a grant's part. Its warnings become `stepFormula`.
- **What a `spell` grant gives is already gathered**: ENG-11 reaches the grant with its `fixed`
  and `chosen` spells and its `alwaysPrepared` in `Computed.grants`. No list is built twice.

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table changes. `spellcasting` was
stored already; it is now read.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/spellcasting.test.ts` — `describe('ENG-15 spellcasting')`: §3 items
  1–7, 9, 10: the multiclass table, the editions' rounding, golden A's and golden C's paths and
  breakdowns, the variants, purity.
- `packages/system-5e/test/golden/golden-values.test.ts` — `describe('ENG-15 goldens:
  spellcasting')`: §3 item 8; the "no warning, breakdowns add up" check covers the new paths.
- Control numbers from: SPEC §6.7 (item 8); the multiclass tables of both SRDs (§8); the variants
  worked out by hand from their data, never copied from a run.

#### 8. Checked against the source

Sources: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
`packages/5e-database/src/{2014,2024}/en/`, read with `jq`; foundryvtt/dnd5e at
`7bfb3f1c03e107bf65942151ef08d50ddb01ba8a`: `module/` and `packs/_source/{rules,content24}`, which
quote SRD 5.1 and SRD 5.2.1 (CC-BY-4.0). The same commits as ENG-13 §8.

**Save DC and attack bonus.** SRD 5.1, each caster's Spellcasting Ability (`5e-SRD-Classes.json`,
`spellcasting.info`; the cleric's): "Spell save DC = 8 + your proficiency bonus + your Wisdom
modifier. Spell attack modifier = your proficiency bonus + your Wisdom modifier", the paladin's
with Charisma, the wizard's with Intelligence. SRD 5.2.1 (`content24/chapter-7/spells.yml`): "Spell
save DC = 8 + your spellcasting ability modifier + your Proficiency Bonus"; "Spell attack modifier
= your spellcasting ability + your Proficiency Bonus". Multiclassing, both editions: "Each spell
you … prepare is associated with one of your classes, and you use the spellcasting ability of that
class when you cast the spell." dnd5e (`data/actor/templates/common.mjs`): `abl.dc = 8 + abl.mod +
prof + dcBonus` (`bonuses.spell.dc`); `abl.attack.value = abl.mod + prof + abl.attack.bonus +
rollReduction`. SRD 5.2.1 (rules glossary, D20 Test): "D20 Tests encompass … ability checks,
attack rolls, and saving throws"; a DC is not one. So the attack reads `d20.all.bonus`, the DC
does not.

**SPEC §6.3, "Подготовка заклинаний" (`[ПРОВЕРИТЬ]`).** 5e-database's level-1 rows: 2014, the
bard, ranger, sorcerer and warlock have `spells_known`; the cleric, druid, paladin and wizard
prepare by a formula (`spellcasting.info`: the cleric "equal to your Wisdom modifier + your cleric
level (minimum of one spell)", the wizard "your Intelligence modifier + your wizard level (minimum
of one spell)", the paladin "your Charisma modifier + half your paladin level, rounded down
(minimum of one spell)"). 2024: every caster has `prepared_spells`, a column. The SPEC row agrees;
both are data (`preparation`, `preparedCount`, `spellsKnown`), so no edition code reads them.

**When a class starts casting.** 5e-database `spellcasting.level`: 2014, the paladin and the
ranger 2, every other caster 1; 2024, every caster 1. 2014 `paladin-1`: every `spell_slots_level_N`
is 0; `paladin-3`: `spell_slots_level_1` 3. 2024 `paladin-1`: 2 slots of level 1, 0 cantrips,
`prepared_spells` 2. The fixtures hold these rows (ENG-09, ENG-10).

**Always prepared.** SRD 5.1 (`5e-SRD-Features.json`, `domain-spells-1`): "Once you gain a domain
spell, you always have it prepared, and it doesn't count against the number of spells you can
prepare each day." `5e-SRD-Subclasses.json`, `life`: `bless` and `cure-wounds` at `cleric-1`. SRD
5.2.1 (the cleric's Spellcasting, `5e-SRD-Classes.json`): "If another Cleric feature gives you
spells that you always have prepared, those spells don't count against the number of spells you
can prepare with this feature".

**SPEC §6.3, "Мультикласс: вклад паладина и следопыта" (`[ПРОВЕРИТЬ]`).** SRD 5.1
(`rules/chapter-6-customization-options.yml`): "Once you have the Spellcasting feature from more
than one class, use the rules below. If you multiclass but have the Spellcasting feature from only
one class, you follow the rules as described in that class"; "adding together all your levels in
the bard, cleric, druid, sorcerer, and wizard classes, and half your levels (rounded down) in the
paladin and ranger classes. Use this total to determine your spell slots by consulting the
Multiclass Spellcaster table." SRD 5.2.1 (`content24/chapter-2/character-creation.yml`): the same
first two sentences; "All your levels in the Bard, Cleric, Druid, Sorcerer, and Wizard classes /
Half your levels (round up) in the Paladin and Ranger classes". The SPEC row agrees: down in 2014,
up in 2024. dnd5e (`config.mjs`): `half: { divisor: 2, roundUp: true }`; `settings.mjs`,
`applyLegacyRules`: "Set half-casters to round down." `data/spellcasting/spellcasting-model.mjs`,
`computeProgression`: each class's levels are divided and rounded on their own, then added; a
lone class with a divisor above 1 takes `Math.ceil(levels / divisor)` once it has any (`count`,
`documents/actor/actor.mjs` `_prepareSpellcasting`: the classes with that kind of spellcasting).
Measured with this ticket's `casterShare`: a lone half caster's share at levels 1 to 20, read in
the multiclass table, gives the 2014 paladin's table (no slot at level 1) and the 2024 paladin's
table, row for row.

**Third casters.** Neither SRD has one: no subclass in `5e-SRD-Subclasses.json` (2014 or 2024)
has `spellcasting`, and neither multiclass rule names one. dnd5e: `third: { divisor: 3 }`, no
`roundUp`, and `applyLegacyRules` changes only `half`; so a third rounds down in both editions.

**The multiclass table.** Both SRDs' "Multiclass Spellcaster: Spell Slots per Spell Level", read
from the two files above: 20 rows each, measured equal to each other, to dnd5e's
`SPELL_SLOT_TABLE`, and to the fixtures' cleric and wizard tables (`FULL_CASTER_SLOTS`,
`WIZARD_SLOTS`). Row 4: 4, 3; row 5: 4, 3, 2.

**Pact magic.** 5e-database 2014 warlock rows: one slot level per row (`warlock-1` 1 of level 1,
`warlock-3` 2 of level 2, `warlock-5` 2 of level 3, `warlock-11` 3 of level 5, `warlock-17` 4 of
level 5). Neither SRD's caster level counts the warlock; both: "you can use the spell slots you
gain from Pact Magic to cast spells you … have prepared from classes with the Spellcasting
feature, and you can use the spell slots you gain from the Spellcasting feature to cast Warlock
spells". dnd5e: `pactCastingProgression`, one level per row, a pool of its own.

**The goldens' spell lines agree with these** (worked out before the tests were written): A:
WIS 16 → +3, level 1 → +2; DC 8 + 3 + 2 = 13; attack 3 + 2 = 5; prepared max(1, 3 + 1) = 4;
cleric row 1: 2 slots of level 1, 3 cantrips; Bless and Cure Wounds from the Life domain at
cleric 1. C: wizard 3 is a full caster's 3; paladin 3 gives ⌊1.5⌋ = 1 in 2014, ⌈1.5⌉ = 2 in 2024;
the multiclass table's row 4 is 4, 3 and row 5 is 4, 3, 2. No golden value looks wrong; nothing
stops.

#### 9. Not in this ticket

- A spell's dice, its attack as an attack, and `attack.spell.bonus`: ENG-16.
- Spending a slot, casting through a grant's `uses`, concentration: ENG-20. Slots back on a rest:
  ENG-21.
- The spells a person picks (`systemData.spells`): the sheet (phase 2) and the wizard (phase 4).
  Whether more are prepared than the count allows is not checked here (§11).
- The DC of a spell a feat or species gives with its own `ability`: §11.
- A wizard's spellbook size (six at level 1, two more a level): it is no column of either SRD's
  table; phase 4's level-up wizard.
- Every other 2014/2024 difference in the edition files: ENG-19.

#### 10. Rake check

- **The golden tests are the truth.** Each expected value is SPEC §6.7's; §8 shows each agrees
  with the sources.
- **`packages/engine` is pure; the core names no game.** The core gains one optional field on a
  step kind, naming no game.
- **Each system's rules live in its own module; no `if (ruleset === …)`.** Every rule is in
  `packages/system-5e`; the one rounding that differs is a field of `rulesets/2014.ts` and
  `rulesets/2024.ts`, read by a lookup.
- **Everything is data.** No class, stat or spell is named in code: a class casts by its own
  `spellcasting`, with any stat key; a pack's `san` caster works as a `wis` one.
- **`compute()` is pure.** The steps read their arguments only; the purity test runs it frozen.
- **A number with no breakdown entry is a bug.** Every path has its steps, and they add up.
- **Manual overrides always win.** The new paths are finished by ENG-17's phases.
- **Formulas never run code.** `preparedCount` goes through ENG-07's evaluator.
- **Missing is not broken.** A stat the character lacks reads 0 with `missingPath`; a formula that
  does not parse gives 0 with `stepFormula`; never a throw.
- **Licensing.** Variants are made up (`character:`); §8 quotes the SRDs (CC-BY-4.0) only.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- Measured on `main` with ENG-43 and ENG-14 in (`d2d44ee`), which reached `main` while this
  ticket was built; the ticket was rebased onto them (below).
- `spellcasting.test.ts` alone: `Tests 15 passed (15)`, 797 ms. `golden-values.test.ts` alone:
  `Tests 12 passed (12)`, 905 ms.
- Lint: `Checked 149 files`, no fixes, no error (142 before; 7 new files).
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 40 passed (40)`, `Tests 424 passed (424)`, 6.10 s (before, at `d2d44ee`: 39
  files, 407 tests).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- Golden A has 147 paths, 16 of them spellcasting: the two bonus targets, the cleric's `dc`,
  `attack`, `prepared`, `cantrips`, `spell.casterLevel`, and the 9 slot levels. Golden B has 2
  (the bonus targets). Golden C has 19 in each edition. No golden gets a warning.
- Every line of §3 item 8 is met, and each golden's breakdowns add up to their values.
- The tests bite. 36 breaks, each on its own and restored, the `system-5e` tests run (10 files,
  113 tests). In `spellcasting.ts`: pact joins the caster level, 1 fails; the rounding map
  swapped, 7; a third rounded up, 1; every class casts, 3; a class with no column never casts, 3; cantrips
  ignored, 1; a lone class's own table ignored, 3; the first class's table for several, 3; the
  subclass ignored, 1; the subclass first, 3; the DC's base 7, 9; the DC reads `d20.all.bonus`, 2;
  the DC without its bonus, 2; without `prof`, 9; the attack without `d20.all.bonus`, 2; without
  its bonus, 2; no prepared count, 5; no known count, 1; a column read one level off, 3; a
  formula's warnings dropped, 1; its text dropped, 1; the multiclass row one off, 6; a class's own
  row one off, 5; the pact level one off, 1; the pact slots read one off, 1; no pact, 1; no bonus
  targets, 20; a slot of 0 given a step, 1 (own table) and 1 (multiclass); the share taken as the
  level, 5; the lone rule ignored, 2; the lone rule without its "share above 0", 3. In
  `rulesets/`: 2014 rounding up, 6; 2024 rounding down, 6; `rulesOf` always 2014, 5. In
  `classes.ts`: no subclass found, 1.

Differences from §3 and §4:
- The lone-caster rule came after the first green run. The first version gave a lone class without
  a `slotsTable` the multiclass row at its plain share: a 2014 half caster 5 got row 2, 3 slots,
  where the 2014 paladin 5's own table has 4 and 2. dnd5e's lone count (§8) gives the SRD tables;
  §3 item 4, §4 and §8 were rewritten, and a test checks both fixture paladins at 20 levels.
- §3 item 7's "a 0 has no step" was narrowed to slot levels and pact numbers: a spell count keeps
  its step, so a prepared count of 0 from a formula still shows the formula.
- A class with neither column casts from level 1 even when its share is 0: a 2014 homebrew half
  caster at level 1 has its DC and attack and no slot. The 2014 paladin, whose table says when it
  starts, has no spellcasting path at level 1.
- ENG-13's test listing golden C's `classes.` paths now leaves out the `.spell.` paths this ticket
  adds. No expected value of it changed.
- `checks.ts`: `sumOf` and the zero step (`zeroStep`) are exported for the spellcasting steps;
  ENG-13's private `Part` is exported as `TotalPart`. `classesOf` moved to `classes.ts`.
- ENG-43 and ENG-14 reached `main` while this ticket was built. The rebase kept both: `derive`
  joins the class, check, combat and spellcasting steps, and `keys` stays ENG-43's; ENG-15's
  golden lines sit in their own `describe`, after ENG-14's. ENG-14 had taken the ids ENG-44 to
  ENG-48, so the row this ticket adds is ENG-49. No expected value changed; the gate and the 36
  breaks were run again on the result.

Against the row and its note:
- The note (found by ENG-09): a class starts casting at the first level its tables give a slot or
  a cantrip (§3 item 1), so the 2014 paladin 1 has no prepared count and its `max(1, …)` is never
  shown; beside a wizard it adds nothing, and the wizard reads its own table.
- Golden A's spell line and golden C's two columns are on in `golden-values.test.ts`. Golden C is
  whole: its proficiency bonus was ENG-13's.
- The multiclass rounding sits in one place, `rulesets/2014.ts` and `rulesets/2024.ts`; ENG-19's
  note says so.

Found, not fixed:
- A `spell` grant's `fixed` spell that no pack has gives no warning. Measured on golden A with a
  made-up feat: `srd-2014:spell/nothing` in `fixed`, no warning; `srd-2014:spell/missing` chosen,
  `missing` twice (as chosen, then among the options) and `fewOptions`. Gathering looks up only an
  `entity` grant's `fixed` ids, so an `item` grant's are not looked up either. New row ENG-49.
- Spells the person prepares (`systemData.spells`) above `classes.<key>.spell.prepared` give no
  warning. Noted for phase 2's Spells tab, where the person prepares them.
- A spell a feat or a species gives with its own `ability` (`spell` grant) has no DC or attack
  path. Noted on ENG-16, with SPEC §5.4's second target `attack.spell.bonus`.
- Two pact classes: the first taken gives the pool. Neither SRD has two, and neither says what
  they give; not a row.

Nothing for the changelog.

---

### ENG-48 The character's size

**Hat:** The character's size comes from its species
**Depends on:** ENG-43 (key paths: `SystemModule.keys`, `finishKey`, `readKey`), ENG-33
(`species.size`), ENG-32 (a species' and a lineage's `size` lists), ENG-09 and ENG-10 (the
golden fixtures)
**Size:** S (the row said XS; §11)
**Screen:** No
**SPEC:** §5.3 (`SpeciesDef.size`, "options to choose from"); §5.8 (`species.size`); §6.1 step 2
("the list of choices not made") and step 8 (`pendingChoices[]`); §8.2 (missing is not broken);
ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/size.ts` — new: `SIZE_PATH`, `sizeKeys`, the size key
path.
- `packages/system-5e/src/module.ts` — changes: `keys` gives the skills' stats and the size.
- `packages/system-5e/src/index.ts` — changes: exports `size.ts`.
- `packages/engine/src/derived.ts` — changes: a `KeyPath` may have no `key` and may carry
  `ruleWarnings`; `PendingKey`; `computeDerived` gives `pendingKeys`.
- `packages/engine/src/phases.ts` — changes: `finishKey` gives no key when the path has none of
  its own and no effect or override sets one.
- `packages/engine/src/compute.ts` — changes: `Computed.pendingKeys`; the doc of
  `SystemModule.keys`.
- `packages/engine/test/derived.test.ts`, `phases.test.ts`, `cycle.test.ts` — change: an
  `ENG-48` block each, on Tales.
- `packages/system-5e/test/size.test.ts` — new: the size on the goldens and made-up variants.
- `packages/system-5e/test/module.test.ts` — changes: ENG-43's golden test lists the skills' key
  paths among the others.

#### 2. What is missing now

Measured on `main` at `c79449b`:
- `grep -rn size packages/engine/src packages/system-5e/src`, hit dice and spell areas left out,
  finds only the schemas: `character.ts` lines 209–210 (`species.size`) and `entity-types.ts`
  lines 52, 55 and 64 (the species' and lineage's lists). No code reads a size.
- Golden A (the 2014 dwarf, one size), golden B (the 2024 human, `size: 'medium'` stored) and
  golden B with no size stored: `values.size` and `keys.size` are `undefined`, `pendingChoices`
  has 0 entries, and there are 0 warnings in each.
- A key path must have a key (`KeyPath.key: string`, ENG-43), so a size not yet chosen has no
  shape; `pendingChoices` holds only grants' choices (`PendingChoice.grant`).
- `pnpm test`: `Test Files 40 passed (40)`, `Tests 424 passed (424)`.

#### 3. What it should look like when done

1. **A key path with no key of its own** (the core, game-free): `KeyPath.key` is optional. Without
   it, the path is a choice not yet made: `Computed.pendingKeys` lists it as `{ path, options }`,
   its options its `keys`, in the module's order. `readKey` gives `undefined` for it, and
   `Computed.keys` has no entry for it, until an effect's `set` or an override names one of its
   keys; then it has that key and is still listed as pending.
2. **A key path's own warnings** (the core): `KeyPath.ruleWarnings`, each warned once as
   `{ code: 'stepRule', path, rule, data? }` when the path is finished.
3. **A loop** through a key path with no key of its own gives no key there; its message says "no
   key is used".
4. **The size** (fifth edition): the key path `size`. Its sizes are a gathered lineage's own
   `size`, else the character's species' (`systemData.species.id`), as ENG-14 takes a speed. Its
   key is the one size when there is one, else the stored `species.size`; its step is `{ kind:
   'entity', source, label, key }`, naming the species or lineage. Its keys are those sizes.
   - several sizes and none stored: no key; pending, the sizes as options;
   - a stored size not among them: warned `stepRule` `sizeNotOffered` with `{ size, from }`, and
     not used: the one size, or pending;
   - no species gathered: no `size` path, nothing pending.
5. **Goldens and variants**, from the fixtures' data (§7):

   | Character | `keys.size` | `pendingKeys` | Warnings |
   |---|---|---|---|
   | A (dwarf: medium) | medium, step Dwarf | none | none |
   | B, B4, D (human: medium, small; medium stored) | medium, step Human | none | none |
   | C 2014, C 2024 (no species) | none | none | none |
   | B, `small` stored | small, step Human | none | none |
   | B, none stored | none | `size`: medium, small | none |
   | B, `large` stored | none | `size`: medium, small | `sizeNotOffered` large, human |
   | A, `small` stored | medium | none | `sizeNotOffered` small, dwarf |
   | C 2024 + a made-up species (medium, small) with a lineage (small, tiny), `tiny` stored | tiny, step the lineage | none | none |
   | the same, none stored | none | `size`: small, tiny | none |
   | the same, `medium` stored | none | `size`: small, tiny | `sizeNotOffered` medium, the lineage |
   | B + a made-up feat: `set 'small'`, `set 'large'`, `add 1` | small, steps Human, the feat | none | `unknownKey` large; `notAKey` add |
   | the same, none stored | small, step the feat | `size`: medium, small | the same two |
   | the same, `small` stored, override `medium` | medium, steps Human, the feat, override | none | the same two |
   | the same, `medium` stored, override `large` | small | none | the two, and `overrideNotAKey` |

   Golden B with none stored keeps its walking speed 30 and AC 17.
6. **Tales** (core tests), with a test module adding `tally.pose` (keys `bold`, `wary`, no key):
   no key, pending, no warning; a talent's `set 'wary'` gives it wary, still pending, and its
   `set 'calm'` warns `unknownKey`; an override `bold` wins over it; an override `calm` warns
   `overrideNotAKey`. A `ruleWarnings` entry is warned once though two steps read the path. Ash's
   own key paths (its skills') are not pending.
7. Every other value of every golden is unchanged; ENG-43's 18 skill keys per golden stay.
8. `compute()` stays pure: frozen inputs give equal results.
9. The quality gate is green.

#### 4. How to do it

1. `derived.ts`: `KeyPath.key?`, `KeyPath.ruleWarnings?`, `PendingKey`, `FinishKey` may give
   `undefined`; `keyAt` keeps a finished path with no key, warns its rule warnings, names "no key"
   in a loop; `computeDerived` lists `pendingKeys`.
2. `phases.ts`: `finishKey` starts from no key when the path has none.
3. `compute.ts`: `Computed.pendingKeys`.
4. `size.ts`: `sizeKeys`. `module.ts`: `keys` joins `skillKeys` and `sizeKeys`.
5. The tests of §7; ENG-43's golden test reads only the `skills.` key paths.

Technical choices (ADR 002):
- **The size is a key path.** A size is a key, and ENG-28's derived values are numbers (the
  row's note); ENG-43 made key paths for such values, with steps, effects and overrides. So the
  sheet reads `Computed.keys.size` with a breakdown of who gave it, and an effect or an override
  can change it, with ENG-43's warnings, at no new cost.
- **A size not chosen is a key path with no key, made pending by the core.** SPEC §8.2: an unmade
  choice is pending, not an error. The core cannot know a module's choices; a key path with no own
  key is game-free and says it. The options are its keys, which the module gives already.
- **A second list, `pendingKeys`, beside `pendingChoices`.** A grant's choice is answered in
  `choices[part]` and its entry carries the grant; this one is answered in the module's part of the
  character (`species.size`) and has no grant. One list of two shapes would make every reader of
  `pendingChoices` tell them apart; SPEC §6.1 step 8's `pendingChoices[]` is now both lists.
- **Still pending when an effect or an override gives a key.** A grant's choice stays pending
  whatever the effects do; the stored choice is what the wizard asks for.
- **A stored size the species lacks warns and is not used.** ENG-33 left it to compute ("missing is
  not broken"): a species changed after its size was stored keeps a stale size. The warning names
  it; the size is what the species gives. The warning needs a key path's own warnings, the
  `ruleWarnings` a number's step has had since ENG-14.
- **The keys are the species' sizes.** No entity type lists every size (ENG-32's note for phases
  2–3); a list in code would make an open key closed. §11 notes what this leaves out.
- **A lineage's own sizes first**, as ENG-14 takes a lineage's own speed: SPEC gives the lineage
  the species' shape, and ENG-32 made its `size` optional. No SRD lineage has one (ENG-32 §8).
- **One rule in both editions** (§8): no `rulesets/` change.

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table changes. `species.size` was
stored already (ENG-33); it is now read.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/derived.test.ts` — `describe('ENG-48 a key path with no key of its
  own')`: §3 items 1 and 2, `readKey`, `pendingKeys`, a rule warning warned once; none pending on
  Ash.
- `packages/engine/test/phases.test.ts` — `describe('ENG-48 …')`: §3 item 6, effects and
  overrides.
- `packages/engine/test/cycle.test.ts` — `describe('ENG-48 …')`: §3 item 3.
- `packages/system-5e/test/size.test.ts` — `describe('ENG-48 the size comes from the species')`:
  §3 items 4, 5, 8.
- Control values from: the fixtures' sizes (`srd-2014.ts`: the dwarf `['medium']`;
  `srd-2024.ts`: the human `['medium', 'small']`; golden B's stored `'medium'`), ENG-09 §8 and
  ENG-10 §8; the made-up entities' own lists. Each expected value was read from that data by hand,
  never copied from a run.

#### 8. Checked against the source

Source: foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (ENG-13's), read on
2026-10-02. Its `packs/_source/races/` and `packs/_source/origins24/species/` carry
`license: CC-BY-4.0` with `rules: '2014'` and `'2024'`: they quote SRD 5.1 and SRD 5.2.1.

**One size, or a choice made with the species.**
- SRD 5.1, the dwarf (`races/dwarf/hill-dwarf.yml`): "Size. Dwarves stand between 4 and 5 feet tall
  and average about 150 pounds. Your size is Medium." Its `Size` advancement offers `med` only.
- SRD 5.2.1, the human (`origins24/species/human.yml`): "Size: Medium (about 4–7 feet tall) or
  Small (about 2–4 feet tall), chosen when you select this species"; its `Size` advancement offers
  `sm`, `med`. The tiefling (`tiefling-infernal.yml`) says the same with "about 3–4 feet tall".
- The dwarf (`origins24/species/dwarf.yml`) and the goliath (`goliath.yml`) of 2024 offer `med`
  only.
- No subrace or subspecies has a size (ENG-32 §8, measured in 5e-database).

**How dnd5e keeps it.** `module/documents/advancement/size.mjs`: the advancement's `apply` writes
the actor's `system.traits.size` from the chosen size (`data.size`), else the advancement's first
size, else `med`; `reverse` sets it back to `med`. The same advancement serves both editions. So
the size is the species' one size, or the person's choice among its sizes. dnd5e falls back to the
first size when none is chosen; SPEC §8.2 makes an unmade choice pending instead (§3 item 4).

**A size an effect changes.** SRD 5.2.1, the goliath's Large Form (`goliath.yml`): "Starting at
character level 5, you can change your size to Large as a Bonus Action". No golden has it (§11).

No golden value names a size (SPEC §6.7); no golden value changes.

#### 9. Not in this ticket

- What a size changes: carrying capacity, a grapple's limit, space. No phase 1 golden reads one.
- The screen that asks for the size, and its name on screen (ENG-32's note for phases 2–3).
- An effect that makes the character one size larger or smaller (Enlarge/Reduce): a `set` names a
  size, not a step.
- A formula reading the size (`@size`): SPEC §5.6 names no such read; it reads 0 with
  `missingPath`, as ENG-43's key paths do.

#### 10. Rake check

- **`packages/engine` is pure; the core names no game.** A key path with no key, `pendingKeys` and
  a key path's own warnings name no size or species; tested on Tales.
- **Everything is data.** No size is written in code: the sizes come from the species' and the
  lineage's lists.
- **`compute()` is pure.** `sizeKeys` reads its arguments only; a frozen character and index give
  equal results.
- **A number with no breakdown entry is a bug.** The size is a key, with its own steps.
- **Manual overrides always win.** An override naming one of the sizes is the last step.
- **Each system's rules live in its own module.** The size, its rule and its warning are the
  module's; no `if (ruleset === …)`: both editions share the rule (§8).
- **Missing is not broken.** A size not chosen is pending; a stale size warns; a missing species
  gives no size and no throw.
- **Licensing.** The species, lineage and feat in the tests are made up (`character:`); §8 quotes
  SRD 5.1 and SRD 5.2.1 (CC-BY-4.0) only.

#### 11. What came out of it

Measured:
- `size.test.ts` alone: `Tests 7 passed (7)`. `packages/engine` alone: `Test Files 14 passed
  (14)`, `Tests 188 passed (188)` (5 new).
- Lint: `Checked 151 files`, no fixes, no error. Typecheck: `Scope: 6 of 7 workspace projects`,
  all 6 `Done`.
- Test: `Test Files 41 passed (41)`, `Tests 436 passed (436)`, 7.33 s (before: 40 files, 424
  tests).
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- Every row of §3 item 5 is met. Goldens A, B, B4 and D: `keys.size` medium, with the Dwarf or
  the Human as its step; C has no size; no golden has a pending size or a warning.
- The tests bite. 14 breaks, each on its own and restored, the `engine` and `system-5e` tests run.
  In the module: the stored size ignored, 5 fail; the first size taken when there are several, 5;
  no lineage first, 1; no `sizeNotOffered`, 2; the keys only its own key, 5; no `entity` step, 5;
  no size from the module, 6. In the core: no `pendingKeys`, 8; every key path pending, 10;
  `pendingKeys` not passed to `Computed`, 8; no rule warnings, 3; a finished path with no key not
  kept (warned twice), 1; the loop's "no key" text, 1; effects ignored on a path with no own key, 4.

Differences from §3 and from the row:
- The row was XS. Making a size not chosen pending needed a core change (§3 items 1–3), the
  rules check of §8 and a stale-size warning, so the template's full form and size S. The size
  column of the row now says S.
- The row's note said "pending". The core's `pendingChoices` holds only grants' choices, so the
  size is in a second list, `Computed.pendingKeys` (§4).
- ENG-43's test that every golden's key paths are its 18 skills' now filters the `skills.` paths:
  the size is a key path too. Its expected values did not change.

Found, not fixed:
- The size's keys are the species' own sizes, so an effect or an override naming another warns and
  is not applied. SRD 5.2.1's goliath can "change your size to Large" (§8). Added to the note for
  phases 2–3 on keys with no entity type in `BACKLOG.md`: a size type would give every size.
- The sheet and the wizard read `Computed.pendingKeys` beside `pendingChoices`, and answer a size
  in `species.size`, not in `choices`; the size shown is `Computed.keys.size`. New note for phase 2
  in `BACKLOG.md`.

Nothing for the changelog.

---

### ENG-44 Equipped items count only as the rules allow

**Hat:** Equipped items count only as the rules allow
**Depends on:** ENG-14 (`combatSteps`, the equipped items named with their own paths), ENG-11
(`gather`), ENG-17 (`activeEffects`)
**Size:** S
**Screen:** No
**SPEC:** §5.3 (`ItemDef.magic`: `attunement`, `bonus`; "item effects by default apply only when
`@equipped`, and `@attuned` if attunement is needed"); §5.6 (`@armor.worn`, `@armor.group`,
`@shield`, `@equipped`, `@attuned`); §6.1 steps 1 and 3 (equipped and attuned items); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/equipment.ts` — new: `equipmentOf`, what the character's
equipped items count as, and `needsAttunement`. `EQUIPPED_PATH` and `ATTUNED_PATH` move here from
`combat.ts`.
- `packages/system-5e/src/module.ts` — changes: `entities` names what `equipmentOf` names.
- `packages/system-5e/src/combat.ts` — changes: `armor.worn` and `shield` from `equipmentOf`, each
  warning of a second; `armor.<group>`; `ac.bonus` starts at the worn armor's and shield's
  `magic.bonus`.
- `packages/system-5e/src/system.ts` — changes: `ARMOR_GROUPS`, which `entity-types.ts`'s armor
  schema now reads.
- `packages/engine/src/gather.ts` — changes: `EntityFinder`, `finderOf`; `NamedEntity.dormant` and
  `HadEntity.dormant`: a dormant entity's grants give nothing.
- `packages/engine/src/effects.ts` — changes: `activeEffects` leaves out a dormant entity's effects
  that have no `when` of their own.
- `packages/engine/src/compute.ts`, `derived.ts` — change: `SystemModule.entities` and
  `DeriveInput` get `find`.
- `packages/engine/test/phases.test.ts` — changes: an `ENG-44` block, on Tales.
- `packages/engine/test/compute.test.ts` — changes: an `ENG-44` block, `find`.
- `packages/system-5e/test/equipment.test.ts` — new: §3 items 1–6 on golden B and made-up items.
- `packages/system-5e/test/combat.test.ts`, `module.test.ts` — change: a second armor is warned;
  `entities` takes `find`.

#### 2. What is missing now

Measured on `main` at `c79449b`, with a scratch test (deleted): golden B (2024) with its own items,
equipped in this order: plate armor +1 (heavy, base 18, `magic.bonus` 1), the SRD's chain mail, two
shields of different ids (each `ac.bonus` +2 `when: '@equipped'`), and a charm that needs
attunement, not attuned (`ac.bonus` +1, no `when`):
- `ac.base` 18, `ac.bonus` 6, `ac.total` 24. The `ac.bonus` steps: Defense 1, the first shield 2,
  the second shield 2, the charm 1.
- `warnings`: `[]`. Every item is gathered, chain mail and the second shield included.
- The plate's `magic.bonus` adds nothing: `grep -rn "magic" packages/system-5e/src/combat.ts`
  finds nothing.
- `armor.group` has no value, and no path names the worn armor's group.
- `pnpm test`: `Test Files 40 passed (40)`, `Tests 424 passed (424)`.

#### 3. What it should look like when done

1. **One armor, one shield.** Of the equipped inventory rows, in inventory order, the first whose
   item is of the category `armor` is the armor worn, and the first of the category `shield` the
   shield. Another equipped armor or shield counts for nothing: it is not named, so its effects
   and grants do not apply, and its `magic.bonus` is not read. Each is warned `stepRule` on
   `armor.worn` (or `shield`), rule `oneAtATime`, data `{ item, worn }`. The same item id in two
   rows is two: the second is warned.
2. **Attunement.** An item needs attunement when its `magic.attunement` is `true` or a text (SPEC
   §5.3). Equipped and not attuned, it gives only its nonmagical benefits (§8): it is named
   **dormant**, so its grants give nothing, and of its effects only those with a `when` of their
   own apply (SPEC §5.3's shield writes `when: '@equipped'`); `@attuned` reads 0. An armor or a
   shield that is dormant is still the one worn: its base AC counts, and it takes the one place.
   Attuned, or needing no attunement, an item is named as ENG-14 names it.
3. **Dormant, in the core** (game-free): `NamedEntity.dormant` is kept on the gathered entity
   (`HadEntity.dormant`, the first naming's). A dormant entity's grants are not reached: no
   proficiency, resource, entity or pending choice from them. `activeEffects` leaves out each of
   its effects with no `when`; one with a `when` applies as any other.
4. **The module looks up ids** (the core): `SystemModule.entities(character, find)` and
   `DeriveInput.find`, where `find(id)` gives the entity the character's id names, its own entities
   first, then its packs, as gathering looks them up; `undefined` when none has it.
5. **A magic bonus.** `ac.bonus` starts at the worn armor's `magic.bonus` plus the worn shield's,
   each only when its magic works (it needs no attunement, or is attuned), each an `entity` step
   naming the item; then effects change it, as before.
6. **The worn armor's group**: `armor.light`, `armor.medium`, `armor.heavy`: 1, with an `entity`
   step naming the armor, when the worn armor is of that group; else 0, with no step.
7. **Golden values do not move.** Every golden line ENG-13, ENG-14 and ENG-15 turned on still
   passes; golden A gives `armor.heavy` 1 (chain mail), golden B 1, and none of them a warning.
8. **The §2 character, after**: `ac.base` 18 (plate), `ac.bonus` 4 = the plate's `magic.bonus` 1 +
   Defense 1 + the first shield 2; `ac.total` 22. Warnings: `oneAtATime` for chain mail on
   `armor.worn` and for the second shield on `shield`. The charm is gathered dormant and adds
   nothing.
9. `compute()` stays pure: frozen inputs give equal results.
10. The quality gate is green.

#### 4. How to do it

1. `gather.ts`: `EntityFinder<E>`, `finderOf(character, index)`; gathering looks ids up through it.
   `NamedEntity.dormant`, `HadEntity.dormant`, the walk skips a dormant entity's grants.
2. `effects.ts`: `activeEffects` skips a dormant entity's effect that has no `when`.
3. `compute.ts`, `derived.ts`: `entities(character, find)`, `DeriveInput.find`.
4. `system.ts`: `ARMOR_GROUPS`. `equipment.ts`: `equipmentOf`, `needsAttunement`, the two own
   paths. `module.ts`: `entities` names `equipmentOf(...).named`.
5. `combat.ts`: `armor.worn` and `shield` from `equipmentOf`, with the `oneAtATime` warnings;
   `armor.<group>`; `ac.bonus`'s own step; `ac.base` reads the worn armor from `equipmentOf`.
6. Tests (§7).

Technical choices (ADR 002):
- **A second armor or shield is not named.** SRD 5.2.1: "A creature can wear only one suit of
  armor at a time and wield only one Shield at a time"; SRD 5.1: "You can benefit from only one
  shield at a time" (§8). Not worn, it is as an item not equipped, whose effects never apply (SPEC
  §5.3, ENG-14). dnd5e warns and takes the first, but still applies a second armor's effects; its
  shield's AC is a field, so a second shield's never adds. Here a shield's +2 is an effect, so
  leaving the second out is how "only one" holds. Inventory order decides, as ENG-14's "first
  gathered" did.
- **The decision is made once**, by `equipmentOf(character, find)`, called by `entities` (what is
  named) and by the combat steps (what is worn, what is warned). Both read the same `find`, so they
  agree. A second armor is never gathered, so the combat steps need `find` to name it in its
  warning: hence `DeriveInput.find`. Gathering looks ids up the same way, through `finderOf`.
- **Dormant, not unnamed**, for an item not attuned: SRD 5.1 and 5.2.1 give it "only its
  nonmagical benefits ... a magic shield that requires attunement provides the benefits of a
  normal shield" (§8). Unnamed, it would lose its base AC and its shield's +2. dnd5e suppresses
  every effect of such an item but still counts its armor; here the shield's +2 is an effect, so
  "an effect with its own `when` still applies" is what keeps it, as SPEC §5.3 says: effects apply
  only when attuned **by default**. A pack writes a magic item's nonmagical effect with a `when`
  (`@equipped`, as SPEC's shield does) and its magical ones without. Its grants are magical
  properties (a staff's spells, a wand's charges), so a dormant entity's grants give nothing.
- **`dormant` is the core's word, set by the module.** The core does not learn what attunement is;
  it learns that a module may name an entity the character has in part. Tales tests it.
- **A magic bonus adds to `ac.bonus`, not to the armor's base.** SRD 5.1 and 5.2.1: "You have a +1
  bonus to AC while wearing this armor"; the shield's, "in addition to the Shield's normal bonus to
  AC" (§8). A bonus while worn, whichever base AC counts. dnd5e adds the armor's to its base
  value, which counts only when the armored base wins; no SRD content tells the two apart.
- **`@armor.group` is three numbers.** A derived value is a number (ENG-28), and a formula reads a
  computed path as a number, so a text path would need every step reader to give texts. `@armor.heavy`
  says what `@armor.group == 'heavy'` would (SRD 5.1 and 5.2.1 Fast Movement: "while you aren't
  wearing Heavy armor", §8): a pack writes `!@armor.heavy`. The groups are the schema's
  (`ARMOR_GROUPS`), not a list written twice. This departs from SPEC §5.6's letter, not its use.
- **An item no pack has, or an id that is not an item, is named as before**, so gathering warns
  `missing` for the one and nothing changes for the other. Neither can be armor.

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table changes. `equipped`,
`attuned` and `ItemDef.magic` were stored already; `magic.attunement` and `magic.bonus` are now
read. The armor schema's groups come from `ARMOR_GROUPS`, the same three values; the published
pack JSON Schema does not change.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/phases.test.ts` — `describe('ENG-44 a dormant entity')`: on Tales, a module
  naming a talent dormant: its effect without `when` does not apply, its effect with a `when`
  reading its own path does, its toggled effect without `when` does not even when switched on; its
  grants give no entity, proficiency, resource or pending choice; the gathered entity has
  `dormant: true`; named twice, the first naming's flag is kept.
- `packages/engine/test/compute.test.ts` — `describe('ENG-44 the module looks up ids')`: `find`
  gives a pack's entity, the character's own one, and `undefined` for an id none has; `entities`,
  `derive` and `keys` get the same.
- `packages/system-5e/test/equipment.test.ts` — `describe('ENG-44 equipped items')`: §3 items 1,
  2, 5, 6, 8, 9; `equipmentOf` directly on rows not equipped, a missing item, a non-item id.
- `packages/system-5e/test/combat.test.ts` — the ENG-14 test of the first armor now expects the
  second's warning; `module.test.ts` — `entities` with `find`.
- `packages/system-5e/test/golden/golden-values.test.ts` — unchanged; it must still pass (§3 item 7).
- Control numbers from: §8's sources; the made-up items' values worked out by hand from their data,
  never copied from a run.

#### 8. Checked against the source

Sources: foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (ENG-13's), `module/` and
`packs/_source/{rules,content24}`, which quote SRD 5.1 and SRD 5.2.1 (CC-BY-4.0); 5e-bits/
5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
`packages/5e-database/src/{2014,2024}/en/5e-SRD-Magic-Items.json`.

**One at a time.** SRD 5.1 (`rules/chapter-5-equipment.yml`, quoted in ENG-14 §8): "Wielding a
shield increases your Armor Class by 2. You can benefit from only one shield at a time." SRD 5.2.1
(`content24/chapter-6/equipment.yml`, ENG-14 §8): "A creature can wear only one suit of armor at a
time and wield only one Shield at a time." dnd5e (`data/actor/templates/attributes.mjs`,
`prepareArmorClass`): equipped armors and shields are gathered in item order; more than one of
either pushes the warning `DND5E.WarnMultipleArmor` or `DND5E.WarnMultipleShields`, and
`armors[0]`, `shields[0]` count.

**Attunement.** SRD 5.1 (`rules/appendix-e-rules.yml`, the page "Attunement"): "Without becoming
attuned to an item that requires attunement, a creature gains only its nonmagical benefits, unless
its description states otherwise. For example, a magic shield that requires attunement provides the
benefits of a normal shield to a creature not attuned to it, but none of its magical properties."
SRD 5.2.1 (`content24/chapter-6/magic-items.yml`): "Without becoming attuned to an item that
requires Attunement, you gain only its nonmagical benefits unless its description states otherwise.
For example, a magic Shield that requires Attunement provides the benefits of a normal Shield if you
aren't attuned to it, but none of its magical properties." Both: "no more than three magic items
at a time" (§9). dnd5e (`documents/item.mjs`, `areEffectsSuppressed`): an item's effects are
suppressed when it is not equipped, or `!attuned && attunement === "required"`; its armor still
counts in `prepareArmorClass`, which reads only `equipped`.

**A magic bonus.** 5e-database 2014 `armor-1`: "You have a +1 bonus to AC while wearing this
armor."; 2024 `armor-1`: "You have a +1 bonus to Armor Class while wearing this armor.",
`attunement: false`; 2024 `shield-1`: "While holding this Shield, you have a +1 bonus to Armor
Class, in addition to the Shield's normal bonus to AC.", `attunement: false`. The 2014 file has no
+1 shield. dnd5e (`data/item/equipment.mjs`, `prepareDerivedData`): `armor.value += magicalBonus`
when `magicAvailable`, which is `attuned || attunement !== "required"` and the item magical
(`templates/equippable-item.mjs`).

**Armor group.** 5e-database `5e-SRD-Features.json`: 2014 `fast-movement` "Starting at 5th
level, your speed increases by 10 feet while you aren't wearing heavy armor."; 2024
`barbarian-fast-movement` "Your speed increases by 10 feet while you aren't wearing Heavy armor.";
2024 `ranger-roving` "Your Speed increases by 10 feet while you aren't wearing Heavy armor." The
2014 Rage: "you gain the following benefits if you aren't wearing heavy armor". Each asks one
group, as a yes or no.

No golden value is touched; nothing stops.

#### 9. Not in this ticket

- No more than three attuned items, and one copy of an item (§8): SPEC §13.2 holds "attunement
  slots (3 items) with a reminder" as an idea, not a stage; no row.
- Who may attune (`magic.attunement` as a text, "by a cleric"): a prerequisite, which warns and
  never blocks; the text is shown, not checked.
- A weapon's `magic.bonus` to attack and damage: ENG-16, which reads `needsAttunement` from here.
- Heavy armor's Strength requirement: ENG-45. Armor without training: ENG-46. Stealth
  disadvantage: ENG-34. Choosing the base AC calculation: ENG-47.
- A consumable that works unequipped (dnd5e: potions): a later phase's mechanics meet it first.

#### 10. Rake check

- **The golden tests are the truth.** No expected value changes; §3 item 7 runs them all.
- **`packages/engine` is pure; the core names no game.** `dormant` and `find` name no item and no
  attunement; they are tested on Tales.
- **Everything is data.** Armor groups are `ARMOR_GROUPS`, which the schema reads; categories,
  attunement and bonuses are read from each item.
- **`compute()` is pure.** `find` reads the index and the character only; the purity test runs it
  frozen.
- **A number with no breakdown entry is a bug.** Each magic bonus is an `entity` step of
  `ac.bonus`; each `armor.<group>` names its armor.
- **Manual overrides always win.** The new paths are finished by ENG-17's phases.
- **Each system's rules live in its own module.** Both editions share each rule (§8); no
  `if (ruleset === …)`.
- **Missing is not broken.** A missing item is still named and warned `missing`; a second armor is
  a warning, never a throw.
- **Licensing.** The test items are made up (`character:`); §8 quotes the SRDs (CC-BY-4.0) only.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `equipment.test.ts` alone: `Tests 8 passed (8)`, 721 ms.
- Lint: `Checked 153 files`, no fixes, no error, after the rebase onto ENG-48 (`108c755`). This
  ticket alone, on `c79449b`: 151 files, 149 before it.
- Typecheck: `Scope: 6 of 7 workspace projects`, all 6 `Done`.
- Test: `Test Files 42 passed (42)`, `Tests 449 passed (449)`, 6.36 s, after the rebase. This
  ticket alone, on `c79449b`: 41 files, 437 tests (424 before it). New: 4 in `phases.test.ts`, 1 in
  `compute.test.ts`, 8 in `equipment.test.ts`.
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`. The published
  pack JSON Schema test passed with `ARMOR_GROUPS` in the armor schema.
- §3 item 8, the §2 character after: `ac.base` 18, `ac.bonus` 4 (the plate's 1, Defense 1, the
  first shield 2), `ac.total` 22; two `oneAtATime` warnings, chain mail on `armor.worn` and the
  second shield on `shield`; the charm gathered dormant. Before: 18, 6, 24, no warning.
- Golden A has 150 paths (was 147 at `c79449b`): `armor.light`, `armor.medium`, `armor.heavy`. It
  gathers 20 entities, as before, and gives no warning. Every golden line still passes, none
  changed (§3 item 7).
- The tests bite. 14 breaks, each on its own and restored, the `engine` and `system-5e` tests run
  (308 tests before the rebase; the same breaks after it, of 321, fail as many, but `derive` 18
  and the finder 93). In `equipment.ts`: a second armor named, 2 fail; never dormant, 2; a text attunement
  read as none, 2; the `attuned` flag ignored, 2. In `combat.ts`: no `oneAtATime` warning, 2; a
  magic bonus without attunement, 2; no magic bonus, 3; groups always 0, 2. In the core: a dormant
  entity's grants reached, 2; `dormant` not kept, 5; its effects applied, 5; all its effects left
  out, `when` or not, 4; `derive` given a `find` that finds nothing, 17; the finder skipping the
  character's own entities, 87.

Differences from §3 and §4:
- No value differs from §3. Every expected value of the new tests was worked out by hand before
  the first run, and the first run passed.
- §7's `compute.test.ts` line first said "the character's own one over a pack's of the same id":
  an own entity's id starts with `character:` (`packages/schema/src/character.ts`), so no pack
  shares one; the test finds a pack's, an own one and none, through `entities`, `derive` and `keys`.
- The purity check of §3 item 9 is its own test in `equipment.test.ts` (dormant and extra items
  frozen), beside ENG-14's on golden A.
- `ENG-14`'s test "takes the first armor gathered as the one worn" keeps its values; its second
  armor is now also warned, which `equipment.test.ts` checks.
- ENG-48 reached `main` while this ticket was built. The rebase met two places both changed:
  `module.ts`'s imports and header comment (both kept), and the end of this archive (ENG-48's
  ticket first, this one after it). ENG-48's `sizeKeys` reads `DeriveInput`, which now has `find`;
  nothing else of it changed.

Against the row and its note:
- One armor and one shield: §3 item 1. An item that needs attunement: §3 items 2–3, with the SRD's
  "only its nonmagical benefits" (§8), not "counts for nothing" as the note put it: an unattuned
  magic shield keeps its normal +2. `magic.bonus`: §3 item 5. `@armor.group`: §3 item 6, as
  three numbers (§4).

Found, not fixed:
- No more than three attuned items, one copy of an item (both SRDs): SPEC §13.2 holds it as an
  idea; no row (§9).
- ENG-16, ENG-45 and ENG-46 read the worn armor or an item's attunement; their notes now point
  at `equipmentOf` and `needsAttunement`.

Nothing for the changelog.

---

### ENG-45 Heavy armor's Strength requirement slows its wearer

**Hat:** Armor's Strength requirement slows its wearer
**Depends on:** ENG-14 (`combatSteps`, `speed.<kind>`), ENG-44 (`equipmentOf`, the armor worn),
ENG-17 (effects on a module's path)
**Size:** S (re-cut from XS: §11)
**Screen:** No
**SPEC:** §5.3 (`ItemDef.armor.strRequirement`); §5.4 (`speed.*`); §6.1 step 5

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/combat.ts` — changes: the step `speed.armorReduction`, and
each kind of speed takes it away.
- `packages/system-5e/test/golden/srd-2014.ts` — changes: the SRD 5.1 dwarf gets its effect on
  `speed.armorReduction`.
- `packages/system-5e/test/combat.test.ts` — changes: an `ENG-45` block; ENG-14's speed breakdown
  of golden D gains the new step.

#### 2. What is missing now

Measured on `main` at `d88b0b9`, with a scratch test (deleted):
- Golden B (2024 human, chain mail with `strRequirement` 13) with base STR 10: STR score 12,
  `speed.walk` 30. Its breakdown: the human 30, `speed.walk.bonus` 0, `speed.all.bonus` 0,
  `speed.all.mul` 1. No step names the armor.
- Golden A (2014 dwarf, chain mail) with base STR 12: STR 12, `speed.walk` 25;
  `speed.armorReduction` has no value.
- `grep -rn strRequirement packages/*/src`: only the schema (`entity-types.ts:304`). No code reads
  it.
- `pnpm test`: `Test Files 42 passed (42)`, `Tests 449 passed (449)`.

#### 3. What it should look like when done

1. **The reduction.** `speed.armorReduction` is 10 when the armor worn (`equipmentOf(...).armor`,
   ENG-44) has a `strRequirement` above the wearer's Strength score (`abilities.str.score`, the
   stat named by `RULE_STATS.armorStrength`); else 0. Its breakdown when 10: the armor (its
   requirement, change 0), the score (change 0), the rule `armorStrength` (10). When 0: no steps.
2. **Every kind of speed** the character has takes it away, as a `path` step right after the
   speed's source. Golden B with STR 12: `speed.walk` 20; the breakdown is the human 30,
   `speed.armorReduction` −10, the two bonuses 0, the multiplier. A lineage's swim 20 becomes 10.
   A kind the character lacks stays 0 with no steps.
3. **Equal is enough.** Golden B with STR 13: `speed.armorReduction` 0, `speed.walk` 30.
4. **The finished score counts.** Golden B with STR 12 and a base-phase effect `max 13` on
   `abilities.str.score`: 0.
5. **Only the armor worn.** Armor with no requirement (a made-up leather), chain mail in the
   inventory but not equipped, or chain mail equipped after a leather that is worn (it counts for
   nothing, ENG-44): 0.
6. **A trait ignores it with an effect.** The SRD 5.1 dwarf's effect `set 0` on
   `speed.armorReduction`: golden A with STR 12 keeps `speed.walk` 25; the reduction's breakdown is
   the three steps of item 1, then the dwarf's effect, change −10.
7. **No golden value moves:** golden A 25 (STR 13, chain mail 13), B 30 (STR 17), B4 30 (STR 19),
   D 20 (STR 17).
8. `compute()` stays pure (ENG-14's frozen-input test).
9. The quality gate is green.

#### 4. How to do it

1. **Re-size.** The row's note sends §8 to this ticket, so by `TEMPLATE.md` it is not XS: the full
   form, and the row is S.
2. `combat.ts`: `RULE_STATS.armorStrength` `'str'`; `ARMOR_SPEED_REDUCTION` 10 (feet, both
   editions, §8); `ARMOR_REDUCTION_PATH` `'speed.armorReduction'`.
3. A step `armorReduction(armor)` for `ARMOR_REDUCTION_PATH`: 0 with no steps without a worn armor
   or a requirement; reads the score only then; 10 with item 1's steps when the requirement is
   above it.
4. `speedOf` reads the path and adds `{ kind: 'path', path, value, change: -value }` after the
   source step, before the bonuses. The floor at 0 and the multiplier stay as ENG-14 made them.
5. The dwarf in `srd-2014.ts` gets `effects: [{ id: 'heavy-armor', target: 'speed.armorReduction',
   op: 'set', value: 0 }]`, with a comment naming its source (§8).
6. Tests (§7). ENG-14's expected speed breakdown of golden D gains the new step (value 0).

#### 5. Stored data

Nothing stored changes. `strRequirement` is in the item schema since ENG-32. The dwarf's effect is
test data in a fixture pack, in the existing effect shape.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/combat.test.ts` — `describe("ENG-45 heavy armor's Strength
  requirement")`: §3 items 1–6, on goldens A and B with STR changed, and made-up items, a lineage
  and a feat. Every breakdown adds up to its value (the file's `computed` helper).
- `packages/system-5e/test/combat.test.ts` — ENG-14's golden D speed breakdown with the new step.
- `packages/system-5e/test/golden/golden-values.test.ts` — unchanged: §3 item 7.
- Control numbers from: SRD 5.1 and SRD 5.2.1 (10 feet; "equal to or higher", §8); chain mail's
  Str 13 (both fixtures, from 5e-database); the goldens' scores (ENG-13: B's STR 17 = 15 + 2, the
  Soldier's +2 chosen on STR; A's 13).

#### 8. Checked against the source

Sources: foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (ENG-13's), `module/` and
`packs/_source/{rules,races,content24,equipment24}`, which quote SRD 5.1 and SRD 5.2.1
(CC-BY-4.0); 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
`packages/5e-database/src/{2014,2024}/en/`.

**The rule, both editions.** SRD 5.1 (`rules/chapter-5-equipment.yml`, Armor, Heavy Armor): "If
the Armor table shows “Str 13” or “Str 15” in the Strength column for an armor type, the armor
reduces the wearer's speed by 10 feet unless the wearer has a Strength score equal to or higher than
the listed score." SRD 5.2.1 (`content24/chapter-6/equipment.yml`, Armor, Strength): "If the table
shows a Strength score in the Strength column for an armor type, that armor reduces the wearer’s
speed by 10 feet unless the wearer has a Strength score equal to or higher than the listed score."
The same rule and the same 10 feet: no ruleset difference, so nothing goes in `rulesets/`.

**dnd5e** (`module/data/actor/templates/attributes.mjs`, `prepareMovement`): when the equipped
armor's `system.strength` is above `abilities.str.value`, and the actor's flag
`ignoreArmorSpeedReduction` is not set, `reduction += CONFIG.DND5E.armorSpeedReduction`
(`config.mjs`: `10`, "in feet"); every movement type then is `Math.max(0, speeds[type] -
reduction)` before its bonus and multiplier. The flag is a "Racial Traits" character flag
(`config.mjs`); no file in dnd5e's `packs/_source` sets it (grep: none).

**Which speeds.** The SRDs say "speed". dnd5e takes the reduction from every movement type, as
ENG-14's `speed.all.bonus` does for exhaustion; this ticket does the same.

**A species that ignores it.** SRD 5.1, the dwarf's traits (dnd5e `races/dwarf/hill-dwarf.yml`, its
description): "Speed. Your base walking speed is 25 feet. Your speed is not reduced by wearing heavy
armor." 5e-database's 2014 dwarf (`5e-SRD-Races.json`) holds `speed: 25` and five traits, none of
them this one; a search of its 2014 files for "not reduced" or "isn't reduced" finds two: Damage
Resistance (`5e-SRD-Rules.json`) and the Boots of Striding and Springing. So the 2014 dwarf's effect is written from SRD 5.1's text, as
dnd5e quotes it. SRD 5.2.1 (`content24/chapter-4/character-species.yml`): the dwarf's "Speed: 30
feet", and no species trait there speaks of armor and speed.

**An item that ignores it.** Boots of Striding and Springing, SRD 5.1 (`5e-SRD-Magic-Items.json`):
"your speed isn't reduced if you are encumbered or wearing heavy armor"; SRD 5.2.1 (dnd5e
`equipment24/equipment/boots-of-striding-and-springing.yml`): "your Speed isn’t reduced by you
carrying weight in excess of your carrying capacity or wearing Heavy Armor." The same `set 0`, as
an item's effect; no golden has them, so no fixture does.

**The variant.** SRD 5.1 (`5e-SRD-Rules.json`, Variant: Encumbrance): "When you use this variant,
ignore the Strength column of the Armor table." That is the house rule `encumbrance: 'variant'`
(`houseRulesSchema`), which no code reads yet (§9, §11).

**The goldens agree** (worked out before the test was written): A's STR 13 meets chain mail's 13;
B's 17 and B4's 19 are above it; D is B. No golden value changes; nothing stops.

#### 9. Not in this ticket

- Armor worn without training: ENG-46. Stealth disadvantage in armor: ENG-34.
- Encumbrance, and its variant that ignores the Strength column: the house rule `encumbrance`, a
  later phase (ENG-14 §9).
- The Boots of Striding and Springing as a pack entity: SRD import, phase 3.
- 2014 exhaustion's speed: ENG-19.

#### 10. Rake check

- **Everything is data.** The stat is the module's `RULE_STATS.armorStrength`, as ENG-14 names DEX
  and CON; the dwarf ignores the reduction by an effect in its pack, not by a check of its id.
- **The engine is pure; the core names no game.** Only `packages/system-5e` and its tests change.
- **`compute()` is pure.** The step reads only its input and `read`; ENG-14's frozen-input test
  runs.
- **A number with no breakdown is a bug.** `speed.armorReduction` has its steps; each speed names
  it.
- **Manual overrides win.** The path is finished by the core like any other, override last.
- **No scattered ruleset checks.** One rule in both editions (§8); no `if (ruleset …)`.
- **Missing is not broken.** An armor no pack has is no armor worn (ENG-44): 0, and gathering warns.
- **Stored units are feet.** 10 is feet.
- **Golden values.** None changes (§3 item 7).
- **No rules text without an open license.** The comment and §8 quote SRD 5.1 and 5.2.1 only.

#### 11. What came out of it

The gate, measured:
- `pnpm lint`: `Checked 153 files in 200ms. No fixes applied.`
- `pnpm typecheck`: 6 projects `Done`, the module's tests included.
- `pnpm test`: `Test Files 42 passed (42)`, `Tests 455 passed (455)`, 6.10 s. Before: 449; the
  6 new are the `ENG-45` block.

The values, from the tests:
- Golden B with STR 12 in chain mail (Str 13): `speed.armorReduction` 10, `speed.walk` 20
  (30 before). With the made-up lineage's walk 35 and swim 20: 25 and 10; fly 0, no steps.
- Golden B with STR 13: 0 and 30. With STR 12 and a `max 13` on the score: 0 and 30.
- Leather (no requirement), chain mail not equipped, chain mail after the worn leather: 0 and 30.
- Golden A with STR 12: `speed.walk` 25; the reduction's breakdown is chain mail 13, STR 12, the
  rule 10, then the dwarf's `set 0`, change −10.
- The goldens: `speed.armorReduction` 0 for A, B, B4 and D; their golden values did not move.

The tests were checked to fail, each change undone after:
- `score >= needs` made `score > needs`: 2 tests fail (equal STR, the raised STR).
- `change: 0 - reduction` made `-reduction`: ENG-14's golden D breakdown fails (a change of −0).
- The dwarf's effect taken out of the fixture: the dwarf's test fails.

Differences from §3: none.

Against the row and its note:
- The row is XS. Its note sends §8 here, so by `TEMPLATE.md` the ticket is not XS: the full form,
  and the row is now S.
- The note said a species trait may ignore the slowing by dnd5e's flag. Here it is an effect on
  the module's path `speed.armorReduction`, so a trait, an item or a homebrew entry does it as
  data, and the breakdown names it. dnd5e's flag is set by no file in its packs; the SRD 5.1
  dwarf's text is the source (§8).
- The reduction comes before the bonuses, and ENG-14's one floor at 0 stays. dnd5e also floors
  right after the reduction. The two differ only when the reduction is above a speed and a bonus
  is added; no SRD species' speed is that low (5e-database: 25 to 35, both editions).

Found, not fixed:
- SRD 5.1's variant encumbrance ignores the Strength column of the Armor table; the house rule
  `encumbrance: 'variant'` is read by no code. A phase 4 note in `BACKLOG.md`.

Changelog: nothing. No screen shows a speed yet.

---

### ENG-47 The person picks the base AC calculation

**Hat:** The person picks which base AC calculation counts
**Depends on:** ENG-14 (`ac.base`, the highest candidate; `appendedNumbers`), ENG-33
(`systemData`, `FIFTH_EDITION_CHARACTER_MIGRATIONS`), ENG-39 (one module version for packs and
characters), ENG-38 (the published pack JSON Schema), ENG-09 and ENG-10 (the golden fixtures)
**Size:** S
**Screen:** No
**SPEC:** §6.1 step 5 (AC: the formula candidates, then the best one or the one the person pins);
§5.4 (`ac.formulas`, an `append` of a candidate); §5.8 (the character document, migrations);
§8.2 (missing is not broken); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/combat.ts` — changes: `armorClassBase` takes the pinned
candidate, when it applies, over the highest.
- `packages/system-5e/src/system.ts` — changes: `FIFTH_EDITION_SCHEMA_VERSION` 2;
  `EQUIPMENT_AC_CALC`, the key of the module's own candidate.
- `packages/system-5e/src/character.ts` — changes: `systemData.acCalc`; the character's step from
  version 1 to 2.
- `packages/system-5e/src/pack.ts` — changes: the pack's step from version 1 to 2.
- `packages/system-5e/test/combat.test.ts` — changes: an `ENG-47` block.
- `packages/system-5e/test/character.test.ts` — changes: an `ENG-47` block; ENG-33's version
  literals say 2, and its full character has `acCalc`.
- `packages/system-5e/test/golden/characters-2014.ts`, `characters-2024.ts`, `srd-2014.ts`,
  `srd-2024.ts`, `fixtures-2014.test.ts`, `fixtures-2024.test.ts` — change: written as files of
  version 2.
- `apps/web/public/schema/5e/pack.schema.json` — rewritten by its test: `systemSchemaVersion` 2.
- `docs/tickets/BACKLOG.md` — a note for phase 2 (§11). `docs/CHANGELOG.md` — one line.

#### 2. What is missing now

Measured on `main` at `d88b0b9`:
- `grep -rn "acCalc\|pinned" packages/system-5e/src packages/engine/src` finds nothing: no code
  reads a pinned calculation.
- Golden B with a stored pin, `systemData.acCalc: 'equipment'`, is refused:
  `unrecognized_keys`, path `systemData`, `Unrecognized key: "acCalc"`.
- Golden B without armor, with a made-up feat appending `10 + @abilities.dex.mod +
  @abilities.con.mod` when `!@armor.worn`: `ac.base` 13, its one step the feat's `append`. Its
  10 + DEX (11) cannot be chosen.
- `pnpm test`: `Test Files 42 passed (42)`, `Tests 449 passed (449)`.

#### 3. What it should look like when done

1. **The stored pin.** `systemData.acCalc` is optional: `equipment` (the module's own
   calculation) or the part id of an `ac.formulas` effect (`<entityId>#<effectId>`). Without it,
   no calculation is pinned. Another key (`armored`) or an entity id without a part is refused at
   `systemData.acCalc`.
2. **The base AC.** `ac.base` is the pinned candidate when it is one that applies now; else the
   highest, the first of equal ones, as ENG-14 gives it. A pinned candidate's breakdown is a
   `rule` step `acCalcChosen` (value 0, change 0), then its own steps. A pin that applies nowhere
   (its entity not had, its `when` false, its switch off, a part nothing has) is warned once,
   `stepRule` `acCalcNotApplying` with `{ calc }`, and the highest counts, with no `acCalcChosen`.
3. **Made-up variants of golden B** (DEX +1, CON +2, chain mail 16, Defense +1 in armor), with
   `guarded` (`10 + @abilities.dex.mod + @abilities.con.mod` when `!@armor.worn`), `plated`
   (`13 + @abilities.dex.mod`), `plain` (`10 + @abilities.dex.mod`) and `stance` (`12 +
   @abilities.dex.mod`, switched off by default):

   | Worn | Feats | `acCalc` | `ac.base` | `ac.total` | Warning |
   |---|---|---|---|---|---|
   | nothing | guarded, plated | none | 14 (plated) | 14 | none |
   | nothing | guarded, plated | `equipment` | 11 (10 + 1) | 11 | none |
   | nothing | guarded, plated | guarded's | 13 | 13 | none |
   | nothing | guarded, plated | plated's | 14 | 14 | none |
   | chain mail | guarded, plated | none | 16 | 17 | none |
   | chain mail | guarded, plated | plated's | 14 | 15 | none |
   | chain mail | guarded, plated | `equipment` | 16 | 17 | none |
   | chain mail | guarded, plated | guarded's | 16 | 17 | `acCalcNotApplying` guarded's |
   | chain mail | guarded, plated | `character:feat/gone#plates` | 16 | 17 | `acCalcNotApplying` it |
   | nothing | plain | none | 11 (10 + 1, the module's) | 11 | none |
   | nothing | plain | plain's | 11 (plain's step) | 11 | none |
   | nothing | stance, off | stance's | 11 | 11 | `acCalcNotApplying` stance's |
   | nothing | stance, switched on | stance's | 13 | 13 | none |

   Every breakdown adds up to its value.
4. **An override still wins:** chain mail, plated pinned, an override of `ac.base` 20: `ac.base`
   20, `ac.total` 21.
5. **Goldens:** none pins; every golden value is unchanged, with no warning.
6. **The version.** `FIFTH_EDITION_SCHEMA_VERSION` is 2, with one character step and one pack
   step. A character and a pack of version 1 open: `from` `{ schemaVersion: 1,
   systemSchemaVersion: 1 }`, the value the file with `systemSchemaVersion` 2. Version 3 is
   refused, `newer`, `current` 2. Each step leaves its frozen argument as it was.
7. **The published pack schema** (`apps/web/public/schema/5e/pack.schema.json`) has
   `systemSchemaVersion` `const` 2; no other line changes.
8. `compute()` stays pure: frozen inputs with a pin give equal results.
9. The quality gate is green, `pnpm e2e` included (a file in `apps/web` changes).

#### 4. How to do it

1. `system.ts`: `EQUIPMENT_AC_CALC`; the version 2.
2. `character.ts`: `acCalc`; the step 1 → 2. `pack.ts`: its step 1 → 2.
3. `combat.ts`: the candidates keep their keys; the pinned one counts when it applies; the step
   and the warning of §3 item 2.
4. The golden files and ENG-33's tests say 2; the published file is rewritten with its test's
   `--update` (`docs/RUNNING.md`).
5. The tests of §7.

Technical choices (ADR 002):
- **The pin is a field of the module's part, `systemData.acCalc`.** AC is fifth edition's, so the
  core's part stays as it is. It is the rules' own choice ("you choose which calculation to use",
  §8), as the size is (`species.size`, ENG-48), so it is stored where the module reads it. An
  override (SPEC §6.1 step 7) is a manual edit over the rules, labelled so, and gives a number
  with no breakdown of its own; a toggle switches an effect off, and the module's own
  calculation is no effect.
- **Optional, with no value for "none".** Absent is the one spelling of "no pin", as `species.size`
  and `concentration` are absent until chosen. A required field would need a made-up value for it.
- **A candidate's key is stable.** The module's own is `equipment`: the worn armor's, else 10 +
  DEX, one calculation, so a pin on it holds when armor comes off or goes on. An effect's is its
  part id, stable as ids are (SPEC §5.1). The stored value takes that literal or a part id;
  widening it later needs no migration.
- **A pin that does not apply warns, and the highest counts.** Missing is not broken (SPEC §8.2):
  the choice stays stored; armor put on over Unarmored Defense gives the armor's AC and the
  warning, not 0.
- **A pin breaks a tie too**: of two equal candidates, the pinned one's steps are the breakdown.
- **`acCalcChosen` is a step of 0.** The breakdown says the person chose this calculation, so a
  lower AC than the highest is explained on the sheet; the steps still add up.
- **One rule in both editions** (§8): no `rulesets/` change.
- **The version.** ENG-39 gives the module one version for its packs and its characters, so the
  bump has a pack step, which returns the pack as it is (ENG-39 §4), and the character step
  returns the file as it is: a version 1 character pinned nothing. The golden fixtures are written
  as current files, so they say 2; the published JSON Schema carries the version, so its file is
  rewritten.

#### 5. Stored data

The character's stored shape changes: `systemData.acCalc`, optional.
`FIFTH_EDITION_SCHEMA_VERSION` 1 → 2. `FIFTH_EDITION_CHARACTER_MIGRATIONS` gains the step 1 → 2,
which returns the character as it is (a version 1 character pinned nothing).
`FIFTH_EDITION_PACK_MIGRATIONS` gains the step 1 → 2, which returns the pack as it is (a pack's
shape does not change). Their test: `character.test.ts`, `describe('ENG-47 …')` (§3 item 6). No
Dexie table changes. No saved data is rewritten: the steps change nothing but the version.

#### 6. What a person will see

Not a screen. The published pack JSON Schema asks for `systemSchemaVersion` 2.

#### 7. Tests

- `packages/system-5e/test/combat.test.ts` — `describe('ENG-47 the base AC calculation the
  person picks')`: §3 items 2–5, 8.
- `packages/system-5e/test/character.test.ts` — `describe('ENG-47 the pinned AC calculation is
  stored')`: §3 items 1 and 6.
- `apps/web/test/pack-schema.test.ts` (ENG-38's, unchanged): §3 item 7.
- Control numbers from: golden B's data (ENG-14 §7: DEX 13, CON 15, chain mail 16, Defense +1)
  and the made-up feats' formulas, worked out by hand in §3, never copied from a run.

#### 8. Checked against the source

Sources: foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (ENG-13's), read on
2026-10-02: `packs/_source/content24/` and `classes24/`, `spells24/` (`rules: '2024'`,
`license: CC-BY-4.0` where the file carries it) quote SRD 5.2.1; `packs/_source/rules/`,
`classfeatures/`, `spells/` (`rules: '2014'`) quote SRD 5.1.

**SRD 5.2.1.** The rules glossary, Armor Class (`content24/appendices/rules-glossary.yml`): "Your
base AC calculation is 10 plus your Dexterity modifier. If a rule gives you another base AC
calculation, you choose which calculation to use; you can't use more than one." Armor
(`content24/chapter-6/equipment.yml`): "The table's Armor Class column tells you what your base
AC is when you wear a type of armor". The barbarian's Unarmored Defense
(`classes24/barbarian/class-features/unarmored-defense.yml`): "While you aren't wearing any armor,
your base Armor Class equals 10 plus your Dexterity and Constitution modifiers." Mage Armor
(`spells24/1st-level/mage-armor.yml`): "the target's base AC becomes 13 plus its Dexterity
modifier".

**SRD 5.1.** Armor (`rules/chapter-5-equipment.yml`): "The armor (and shield) you wear determines
your base Armor Class." Unarmored Defense (`classfeatures/barbarian/barbarian-features/
unarmored-defense-barbarian.yml`): "While you are not wearing any armor, your Armor Class equals
10 + your Dexterity modifier + your Constitution modifier." Draconic Resilience
(`classfeatures/sorcerer/draconic-bloodline-features/draconic-resilience.yml`): "When you aren't
wearing armor, your AC equals 13 + your Dexterity modifier." Mage Armor
(`spells/1st-level/mage-armor.yml`): "The target's base AC becomes 13 + its Dexterity modifier."
SRD 5.1 has no sentence on two such calculations at once. SPEC §6.1 step 5 takes the best or the
pinned one in both editions and notes that 2024 writes it as a rule; a source that is silent does
not disagree, so nothing stops, and the rule is one for both editions.

**dnd5e.** `module/data/actor/templates/attributes.mjs`, `prepareArmorClass`: the person keeps a
set of calculations, `attributes.ac.calcs` (by default `unarmored` and `armored`); each feature
above adds its own by an effect on `ac.calc` (`unarmoredBarb`, `mage`); of those that are valid
(`armored` matching the armor worn), the highest counts (`result > ac.base`, so the first of equal
ones); `calc` is not stored (`persisted: false`). `_migrateArmorClass` turns an old stored single
`calc` into that set. SPEC's one pin differs from dnd5e's set; SPEC is followed. Both keep one
calculation, never a sum of two.

No golden pins a calculation (SPEC §6.7); no golden value changes.

#### 9. Not in this ticket

- The sheet's control that pins a calculation, and the list of candidates it shows: phase 2
  (§11).
- Unarmored Defense, Mage Armor, Draconic Resilience as mechanics: phase 3.
- A shield's AC without training (2024): ENG-46.

#### 10. Rake check

- **The golden tests are the truth.** No golden pins; no expected value changes. The goldens'
  files change only their `systemSchemaVersion`.
- **A stored-shape change needs a migration.** The version is 2, with a step for characters and
  one for packs, each tested.
- **Everything is data.** The candidates are the armor worn and the effects' formulas; the only
  name written is the module's own calculation's key, once, in `system.ts`.
- **`compute()` is pure.** The step reads the character it is given; the purity test runs it
  frozen with a pin.
- **A number with no breakdown entry is a bug.** The pinned candidate's steps are the breakdown,
  with `acCalcChosen` naming the choice.
- **Manual overrides always win.** An override of `ac.base` replaces the pinned value (§3 item 4).
- **Each system's rules live in its own module.** The pin is the module's field and step; no
  `if (ruleset === …)`.
- **Ids are stable.** A pin names a part id, never a name.
- **Missing is not broken.** A pin that does not apply warns, and the highest counts.
- **Licensing.** The feats in the tests are made up (`character:`); §8 quotes SRD 5.1 and SRD
  5.2.1 (CC-BY-4.0) only.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `combat.test.ts` alone: `Tests 26 passed (26)`, 1.21 s (7 new). `character.test.ts` alone:
  `Tests 16 passed (16)`, 903 ms (3 new).
- Lint: `Checked 153 files`, no fixes, no error. Typecheck: all 6 projects `Done`.
- Test: `Test Files 42 passed (42)`, `Tests 465 passed (465)`, 6.60 s, after the rebase onto
  ENG-45 (`c80a260`: 42 files, 455 tests, measured there). Before the rebase, this ticket on
  `d88b0b9`: 459 tests (449 before it).
- Build: `apps/web build: Done`. `pnpm e2e`: `12 passed (9.3s)`, run with
  `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, as
  `docs/RUNNING.md` says for this container; without it, 11 of 12 failed at the browser's launch
  (`Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243/…`).
- The published pack schema: one line changed, `"const": 1` → `"const": 2` under
  `systemSchemaVersion`, written by `pnpm vitest run apps/web/test/pack-schema.test.ts --update`;
  before the rewrite its test failed (`Snapshot … mismatched`).
- Every row of §3 item 3 is met, and items 4–8. No golden pins; the golden tests pass unchanged
  (`test/golden`: 3 files, 36 tests).
- The tests bite. 10 breaks, each on its own and restored, the `system-5e` and `apps/web` unit
  tests run (162 tests, after the rebase): the pin ignored, 5 fail; no `acCalcChosen` step, 4; no
  `acCalcNotApplying`, 1; the module's own candidate under another key, 1; an equal later
  candidate winning, 2; any text taken as a pin, 1; the pin required, 65; a character step that
  pins the module's own, 1; a pack step that changes the pack, 1; no character step, 13 test files
  fail to load (the opener's count of steps throws, ENG-39). Before the rebase (156 tests) the
  same, but the pin required: 59.

Differences from §3 and §4:
- No value differs from §3.
- The golden test of §3 item 5 first read `golden.systemData.acCalc`; typecheck refused it
  (`TS2339`: a golden's own type has no such field), so it reads the opened character's.
- ENG-45 reached `main` while this ticket was built. Its speed steps and its dwarf effect in
  `srd-2014.ts` sit beside this ticket's changes; `combat.ts`'s header, the two test blocks, the
  backlog rows and this archive were joined by hand. No value of either ticket changed.

Against the row and its note:
- The row's note is done: the best candidate, or the pinned one (SPEC §6.1 step 5, SRD 5.2.1 "you
  choose which calculation to use"); the pin is a stored field, with the version bump and a step
  for characters and one for packs.

Found, not fixed:
- The sheet's control that pins a calculation needs the candidates: each one's key, name and
  value. `Computed` gives only the chosen one's breakdown (an `append` step names its part). A pin
  whose entity is removed stays stored and warns `acCalcNotApplying` on every compute, as a
  switch does (`toggleGone`, ENG-17). New note for phase 2 in `BACKLOG.md`.
- dnd5e keeps a set of calculations the person turns on, not one pin (§8). No row: SPEC §6.1
  step 5 is followed, and both keep one calculation.

Changelog: "The published fifth-edition pack JSON Schema asks for `systemSchemaVersion` 2."

---

### ENG-16 Weapon attacks

**Hat:** Weapon attacks are computed, weapon mastery included
**Depends on:** ENG-13 (`prof`, `d20.all.bonus`, `sumOf`, a proficiency's sources), ENG-17
(effects and overrides on any path), ENG-44 (`equipmentOf`, an item's magic working), ENG-15
(`rulesets/`, `rulesOf`), ENG-09 and ENG-10 (the golden fixtures)
**Size:** M (the row said S; it is narrowed, §11)
**Screen:** No
**SPEC:** §5.3 (`ItemDef.weapon`, `magic.bonus`); §5.4 (`attack.<…>.bonus`, `damage.<…>.bonus`,
`crit.range`); §5.5 (proficiency grants and choices); §6.1 step 5 ("attacks"); §6.3 (weapon
mastery, 2024 only); §6.5 (the critical range); §6.7 goldens A, B, B4, D; ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/attacks.ts` — new: `attackSteps(input)`, the attack
paths, `CRITICAL_FACE`, `ATTACK_STATS`, `FINESSE`.
- `packages/system-5e/src/equipment.ts` — changes: `Equipment.weapons`, each equipped weapon once,
  with whether its magic works.
- `packages/system-5e/src/checks.ts` — changes: the sources of a proficiency (`proficiencySources`)
  and `levelOf` are exported, so attacks read them as skills do.
- `packages/system-5e/src/system.ts` — changes: the proficiency category `mastery`.
- `packages/system-5e/src/rulesets/{edition-rules,2014,2024}.ts` — changes: `fixedDamageModifier`.
- `packages/system-5e/src/module.ts`, `index.ts` — change: `derive` joins the attack steps; export.
- `packages/engine/src/formula.ts` — changes: `diceOf(roll)`, the dice terms of a parsed roll.
- `packages/system-5e/test/golden/srd-2024.ts`, `characters-2024.ts` — change: the fighter's Weapon
  Mastery grants; three weapons, Reach and Cleave; golden B's and B4's chosen kinds.
- `packages/system-5e/test/golden/checks.ts` — changes: `STAND_INS` and `standingIn` are removed
  (the last stand-in was `crit.range`); every test computes with `fifthEditionModule`.
- `packages/system-5e/test/golden/golden-values.test.ts` — changes: the ENG-16 lines.
- `packages/system-5e/test/attacks.test.ts` — new.
- `apps/web/public/schema/5e/pack.schema.json` — changes: the category `mastery` (ENG-38's file).

#### 2. What is missing now

Measured on `main` at `d88b0b9`:
- `grep -rn "attack\|crit\|mastery" packages/system-5e/src` finds only `spell.attack.bonus`,
  `classes.<key>.spell.attack` (ENG-15) and the schema's `weapon.mastery`. No code reads a weapon.
- Golden A and golden B computed with `fifthEditionModule` (no stand-ins): the paths matching
  `attack|crit|damage|mastery` are `spell.attack.bonus`, `classes.cleric.spell.attack` (A) and
  `spell.attack.bonus` (B); `values['crit.range']` is `undefined`. The tests give `crit.range` 20
  as the last stand-in (`STAND_INS`, `test/golden/checks.ts`).
- Golden A's weapon proficiencies are `battleaxe`, `handaxe`, `lightHammer`, `warhammer`, `simple`;
  golden B's `simple`, `martial`. Neither golden has a place for the kinds of weapons it uses the
  mastery of: the proficiency categories are `skill`, `save`, `armor`, `weapon`, `tool`,
  `language` (`system.ts`), and the fixture's Weapon Mastery feature is its name only.
- `pnpm test`: `Test Files 42 passed (42)`, `Tests 449 passed (449)`.

#### 3. What it should look like when done

1. **Every character** has `attack.weapon.melee.bonus`, `attack.weapon.ranged.bonus`,
   `damage.weapon.melee.bonus` and `damage.weapon.ranged.bonus`, 0 until an effect changes them,
   and `crit.range` 20, the lowest d20 face a weapon attack scores a critical hit on: one step
   `{ kind: 'rule', rule: 'criticalHit', value: 20, change: 20 }`.
2. **Each equipped weapon** (`equipmentOf(...).weapons`: an equipped item of the category
   `weapon`, once per entity, in inventory order, dormant or not) gives paths under
   `attacks.<key>`, its item's `key`:
   - `attacks.<key>.prof`: the highest level a `weapon` proficiency gives that names its
     `weapon.group` or its `key`, its step that grant's; 0 with no step when none does.
   - `attacks.<key>.hit`: its stat's modifier, the proficiency bonus × `.prof`,
     `attack.weapon.<kind>.bonus`, its `magic.bonus` when its magic works (ENG-44: no attunement
     needed, or attuned), and `d20.all.bonus`.
   - `attacks.<key>.damage`, when it has `damage`: its stat's modifier, `damage.weapon.<kind>.bonus`
     and its magic bonus. The damage dice and type are the item's own (`weapon.damage`, and
     `weapon.versatile` with two hands), added to this number when rolled. A damage formula with
     no dice (the Blowgun's `1`) adds the modifier in 2014 and not in 2024 (§8): in 2024 its step
     is `{ kind: 'rule', rule: 'fixedDamage', value: <the modifier>, change: 0 }`.
   - `attacks.<key>.mastery`, when it has a `mastery`: 1 when a `mastery` proficiency names its
     `key`, its step that grant's; else 0 with no step.
   - Its stat: `str` for a melee weapon, `dex` for a ranged one; with the property `finesse`, the
     one of the two with the higher modifier, `str` when they are equal.
   A weapon that is not equipped gives nothing. Two rows of one weapon give one attack.
3. **A weapon with no key** gives no attack paths, and `attack.weapon.<kind>.bonus` warns
   `stepRule` `weaponWithoutKey` `{ item }`. A second weapon entity with a key already taken (a
   2014 and a 2024 greatsword, mixed) gives none either, warned `weaponKeyTaken` `{ item, kept }`.
4. **The proficiency category `mastery`**: its keys are kinds of weapons (a weapon's `key`), as
   dnd5e's `weaponProf.mastery`. The pack schema and the published `pack.schema.json` accept it.
5. **The 2024 fixture**: the Weapon Mastery feature gives `mastery` choices of
   `{ type: 'item', category: 'weapon' }`: 3 at fighter level 1, then 1 at 4, 10 and 16 (§8). The
   pack gains the SRD 5.2.1 greataxe, glaive and halberd, the property Reach and the mastery
   Cleave. Golden B chooses greatsword, greataxe and glaive; golden B4 adds halberd at level 4.
   These choices are test data; SPEC §6.7 states only that the greatsword's Graze is used.
6. **Goldens** (SPEC §6.7):

   | Golden | Path | Value |
   |---|---|---|
   | A | `attacks.warhammer.hit` | 3 (STR +1, proficiency +2 from Dwarven Combat Training) |
   | A | `attacks.warhammer.damage` | 1, with the item's `1d8` bludgeoning |
   | B | `attacks.greatsword.hit` | 5 |
   | B | `attacks.greatsword.damage` | 3, with the item's `2d6` slashing |
   | B | `attacks.greatsword.mastery` | 1, the item's mastery `graze` |
   | B4 | `attacks.greatsword.hit`, `.damage` | 6, 4 |
   | B4 | `crit.range` | 19 (Improved Critical) |
   | B4 | the `mastery` kinds | 4, and `classes.fighter.table.weaponMastery` 4 |
   | D | `attacks.greatsword.hit`, `.damage` | 1, 3; golden B again 5, 3 without exhaustion |

   Every golden gives no warning, and each breakdown adds up to its value.
7. **Variants** on made-up weapons (`character:`), each value worked out by hand in §7: the
   finesse stat both ways, a ranged weapon, no proficiency, proficiency by key, a magic bonus
   with and without attunement, fixed damage in each edition, effects on the four bonus targets,
   an override on `.hit`, no key, a key taken, an unequipped weapon, a weapon twice.
8. **The stand-ins are gone**: `STAND_INS` and `standingIn` no longer exist; every test computes
   with `fifthEditionModule`.
9. **`diceOf`** (the core, game-free): the dice terms of a parsed roll, in the order written:
   `2d6` one, `1` none, `1d4 + 2к6 + @prof` two, a term in either branch of `?:` counted.
10. `compute()` stays pure: frozen inputs give equal results.
11. The quality gate is green, `pnpm e2e` included (the schema file is in `apps/web`).

#### 4. How to do it

1. `formula.ts`: `diceOf(roll: ParsedRoll): DiceNode[]`, a walk of the tree.
2. `system.ts`: `mastery` joins `proficiencyCategories`.
3. `rulesets/`: `EditionRules.fixedDamageModifier`, `true` in 2014, `false` in 2024.
4. `checks.ts`: `proficiencySources(gathered)` gives `(category, key) => Source[]`; `levelOf` and
   `Source` are exported; `checkSteps` reads them.
5. `equipment.ts`: `weapons`, each equipped weapon once, with `magic`.
6. `attacks.ts`: the four bonus targets, `crit.range`, and each weapon's paths; `module.ts` joins
   them.
7. The fixture, the goldens, `attacks.test.ts`; `STAND_INS` and `standingIn` removed; the schema
   file's snapshot updated with `vitest -u`, its diff read.

Technical choices (ADR 002):
- **An attack is numbers under `attacks.<key>`.** A derived value is a number with a breakdown
  (ENG-28); the hit, the damage bonus, the proficiency and the mastery each are one, and each takes
  effects and an override (ENG-17) with no new kind of value. The key names it: stable, as an id is
  (SPEC §5.1), so an override stored on `attacks.greatsword.hit` stays on the greatsword when the
  inventory is reordered. A row's position would move it; a uid is no path step.
- **The dice are the item's.** No golden changes a weapon's dice; the sheet shows the item's
  `weapon.damage` beside the computed bonus, and a roll is the two as ENG-26's `RollPart`s. A
  computed count of dice (a cantrip's) is ENG-50's; the one SRD spell that changes a weapon's die,
  Shillelagh, is in §11.
- **The stat is not a key path.** Finesse takes the higher modifier, which a key path's own key
  cannot read (ENG-43 gives it before any number). No golden changes a weapon's stat by an effect;
  §11 notes the spell that does.
- **The weapon's kind decides its bonus targets** (`attack.weapon.melee` or `.ranged`), as both
  SRDs word Archery and Dueling ("attack rolls you make with Ranged weapons"); a thrown melee
  weapon stays melee.
- **The kinds of weapons a character masters are a `mastery` proficiency**, chosen in `choices`
  like a skill (SPEC §5.5): no stored shape changes, and a choice changed after a long rest is a
  choice edited. A widened list needs no migration (ENG-02 §4). The grants sit on the Weapon
  Mastery feature, not the class: a class taken later gives its features, not its starting
  proficiencies (ENG-13), and SRD 5.2.1 gives a class's features to a multiclass (§8). The count is
  the grants' (3 + 1 + 1 + 1, as dnd5e's advancements); the table's column stays the table.
- **`mastery` is 1 or 0**, not a proficiency level: a grant's `level` means nothing for it.
- **The fixed-damage rule is an edition field** (`rulesets/`), as ENG-15's rounding is: no
  `if (ruleset …)`. ENG-19's row, every edition difference, keeps it.
- **A weapon without a key warns on its kind's bonus path**, the one path every weapon of that kind
  reads, as ENG-44 warns of an extra armor on `armor.worn`.
- **`diceOf` is the core's**: a roll formula's tree is the core's; ENG-52's average needs the same
  walk.

#### 5. Stored data

Nothing stored changes shape. The proficiency category list gains `mastery`: a widening, which no
stored pack or character fails; no `schemaVersion` or `systemSchemaVersion` bump, no migration.
The published `pack.schema.json` lists the new category.

#### 6. What a person will see

Not a screen. The published pack schema accepts `mastery` (a changelog line).

#### 7. Tests

- `packages/system-5e/test/golden/golden-values.test.ts` — `describe('ENG-16 goldens: weapon
  attacks')`: §3 item 6.
- `packages/system-5e/test/attacks.test.ts` — `describe('ENG-16 weapon attacks')`: §3 items 1–3,
  7 and 10, on golden A (2014: STR 13 (+1), DEX 10 (+0), proficiency +2, simple weapons and the
  dwarf's four) and golden B (2024: STR 17 (+3), DEX 13 (+1), proficiency +2, simple and martial).
- `packages/system-5e/test/golden/fixtures-2024.test.ts` — the counts the new entities change, and
  golden B's `mastery` proficiencies.
- `packages/engine/test/formula.test.ts` — `describe('ENG-16 dice terms of a roll')`: §3 item 9.
- `packages/system-5e/test/pack-json-schema.test.ts` — a pack with a `mastery` grant passes both
  the schema and the JSON Schema.
- Control values from: SPEC §6.7 (the goldens), the fixtures' data read from 5e-database
  (`e6edf9a`), the made-up items' own numbers. Each worked out by hand, never copied from a run.

#### 8. Checked against the source

Sources: SRD 5.1 as 5e-database quotes it (5e-bits/5e-srd-api at `e6edf9a`,
`packages/5e-database/src/2014/en/`); SRD 5.2.1 as dnd5e quotes it (foundryvtt/dnd5e at
`7bfb3f1`, `packs/_source/content24/`, CC-BY-4.0) and as 5e-database's 2024 files give it. Read
2026-10-02.

**The attack roll's modifiers.**
- SRD 5.1 (`5e-SRD-Rules.json`, Attack Rolls, "Modifiers to the Roll"): "The ability modifier used
  for a melee weapon attack is Strength, and the ability modifier used for a ranged weapon attack
  is Dexterity. Weapons that have the finesse or thrown property break this rule." "You add your
  proficiency bonus to your attack roll when you attack using a weapon with which you have
  proficiency".
- SRD 5.2.1 (`chapter-1/d20-tests.yml`, Attack Rolls): the Attack Roll Abilities table, "Strength —
  Melee attack with a weapon", "Dexterity — Ranged attack with a weapon"; "the Finesse property …
  lets you use Strength or Dexterity"; "You add your Proficiency Bonus to your attack roll when you
  attack using a weapon you have proficiency with". `chapter-6/equipment.yml`, Weapon Proficiency:
  "you must have proficiency with it to add your Proficiency Bonus to an attack roll".
- Finesse, both: "you use your choice of your Strength or Dexterity modifier for the attack and
  damage rolls. You must use the same modifier for both rolls." dnd5e
  (`module/data/item/weapon.mjs` `availableAbilities`, `_typeAbilityMod`): finesse offers both and
  picks the larger modifier, the first (Strength) when equal.
- Thrown, SRD 5.1: "If the weapon is a melee weapon, you use the same ability modifier for that
  attack roll and damage roll that you would use for a melee attack with the weapon."
- Proficiency, dnd5e (`proficiencyMultiplier`): the actor has the weapon's category (`sim`,
  `mar`) or its base item. ENG-09 §4: our keys are `simple`, `martial`, or the weapon's `key`.

**Damage.**
- SRD 5.1 (Damage Rolls): "When attacking with a weapon, you add your ability modifier—the same
  modifier used for the attack roll—to the damage." No exception.
- SRD 5.2.1 (`chapter-1/damage-and-healing.yml`, Damage Rolls): the same sentence, then "Unless a
  rule says otherwise, you don't add your ability modifier to a fixed damage amount that doesn't
  use a roll, such as the damage of a Blowgun." So this is an edition difference that SPEC §6.3's
  table does not list. dnd5e (`attack-data.mjs` `_processDamagePart`) leaves `@mod` out of a
  deterministic damage formula in both editions; this ticket follows each SRD's own text.
- A magic weapon, both: "You have a +1 bonus to attack and damage rolls made with this magic
  weapon" (2014 `weapon-1`; 2024 `weapon-1`: "attack rolls and damage rolls"). dnd5e adds
  `magicalBonus` only when `magicAvailable` (attuned, or attunement not required): ENG-44's rule.

**The critical range.**
- SRD 5.1 (Rolling 1 or 20): "If the d20 roll for an attack is a 20, the attack hits regardless of
  any modifiers … This is called a critical hit". SRD 5.2.1 (d20-tests.yml) says the same.
- Improved Critical, 2024 (`5e-SRD-Features.json`, `champion-improved-critical`): "Your attack
  rolls with weapons and Unarmed Strikes can score a Critical Hit on a roll of 19 or 20 on the
  d20." dnd5e: `weaponCriticalThreshold`, 20 by default (`attack-data.mjs` `criticalThreshold`).

**Weapon mastery (2024 only).**
- `chapter-6/equipment.yml`: "Each weapon has a mastery property … To use that property, you must
  have a feature that lets you use it."
- `fighter-weapon-mastery`: "use the mastery properties of three kinds of Simple or Martial
  weapons of your choice. Whenever you finish a Long Rest, you can practice weapon drills and
  change one of those weapon choices. When you reach certain Fighter levels, you gain the ability
  to use the mastery properties of more kinds of weapons, as shown in the Weapon Mastery column".
  The column (ENG-10): 3 at levels 1–3, 4 at 4–9, 5 at 10–15, 6 at 16–20.
- dnd5e `classes24/fighter/fighter.yml`: a `Trait` advancement in `mode: mastery`, pool
  `weapon:sim:*`, `weapon:mar:*`, count 3 at level 1, count 1 at levels 4, 10, 16, beside the
  scale value "Weapon Masteries Known". `weapon.mjs` `masteryOptions`: a weapon's mastery is
  offered only when the actor's `traits.weaponProf.mastery.value` has its base item.
- Barbarian ("Simple or Martial Melee weapons"), paladin, ranger, rogue ("with which you have
  proficiency") choose two kinds each (5e-database 2024 Features). Not in the fixtures (§11).
- Multiclassing, SRD 5.2.1 (`chapter-2/character-creation.yml`): "When you gain a new level in a
  class, you get its features for that level"; only "some of the new class's starting
  proficiencies". So the choices sit on the feature.
- 5e-database 2024 Equipment: all 38 weapons have a mastery. Greataxe: martial melee, `1d12`
  slashing, Heavy, Two-Handed, Cleave, 30 gp, 7 lb. Glaive: martial melee, `1d10` slashing, Heavy,
  Reach, Two-Handed, Graze, 20 gp, 6 lb. Halberd: martial melee, `1d10` slashing, Heavy, Reach,
  Two-Handed, Cleave, 20 gp, 6 lb.

**Golden A's warhammer**: 5e-database 2014: martial melee, `1d8` bludgeoning, Versatile (`1d10`).
The cleric's weapons are simple (ENG-09); the warhammer's proficiency is the hill dwarf's Dwarven
Combat Training, by key: SPEC §6.7 "proficiency from the species".

#### 9. Not in this ticket

- A spell's dice for the character's level, and a spell's healing: ENG-50 (ADR 014 item 6).
- `attack.spell.bonus` and `damage.spell.bonus`, and a spell a grant gives with its own stat:
  ENG-51.
- A roll formula's average (SPEC §5.6): ENG-52.
- Advantage and disadvantage on attacks, what a critical hit does to the dice: ENG-34.
- How an attack is made at the table: one hand or two (versatile), a thrown attack's range, an
  off-hand attack's modifier, damage never below 0, ammunition: phase 2's attack and roll.
- Unarmed strikes and improvised weapons: no golden has one.
- What each mastery property does (Graze, Cleave …): text, shown by phase 2; ENG-34 for rolls.
- Choosing the kinds after a long rest: phase 2's rest and phase 4's wizard edit the choice.

#### 10. Rake check

- **The golden tests are the truth.** The ENG-16 lines are SPEC §6.7's values; none changes.
  Fixture counts change because the fixture gains entities, not to fit the code.
- **Measure, never estimate.** Every rule in §8 is quoted from its file; every weapon's numbers
  from 5e-database.
- **`packages/engine` is pure; the core names no game.** `diceOf` walks a tree; it names no weapon.
- **Everything is data.** The stats a weapon uses and the finesse key are the module's named
  constants, as ENG-14's `RULE_STATS`; the kinds come from the item; the mastery count from the
  grants.
- **`compute()` is pure.** `attackSteps` reads its arguments only; tested frozen.
- **A number with no breakdown entry is a bug.** Each path has its steps; the dice are item data.
- **Manual overrides always win.** Tested on `attacks.greatsword.hit`.
- **Each system's rules live in its own module.** The fixed-damage rule is `rulesets/` data.
- **Missing is not broken.** A weapon with no key or a key taken warns; a missing stat reads 0
  with `missingPath`, never a throw.
- **Ids are stable.** An attack is named by its item's key, never by its row.
- **A stored-shape change needs a migration.** Only a list widens (§5).
- **Licensing.** The three weapons, Reach and Cleave are SRD 5.2.1 (CC-BY-4.0) names and numbers,
  no rules text; the variants' items are made up.

#### 11. What came out of it

Measured on 2026-10-02, on `main` after ENG-45 and ENG-47 (rebased onto `d7f84cf`):
- `pnpm lint`: `Checked 155 files`, no errors. `pnpm typecheck`: 6 projects, no errors.
- `pnpm test`: `Test Files 43 passed (43)`, `Tests 481 passed (481)`, 7.1 s. This ticket's
  16: 10 in `attacks.test.ts`, 4 golden lines, 1 for `diceOf`, 1 for the schema (measured on
  `d88b0b9` first: 449 tests before, 465 after).
- `pnpm e2e`: `12 passed (9.4s)`, with `PLAYWRIGHT_CHROMIUM_PATH` set to the container's Chromium
  as `RUNNING.md` says. Without it, 11 of 12 fail at `browserType.launch`: the browser build the
  project's Playwright asks for is not installed here.
- ENG-47's new test computed with `standingIn` twice; both now use `fifthEditionModule`.
- The goldens, SPEC §6.7's values, all true: A `attacks.warhammer.hit` 3 and `.damage` 1 (the
  item's `1d8` bludgeoning), the proficiency's step
  `srd-2014:feature/dwarven-combat-training#weapons`; B greatsword 5 and 3 (`2d6` slashing),
  mastery 1 (`graze`); B4 6 and 4, `crit.range` 19, 4 `mastery` kinds and the column 4; D 1 and 3.
  Every golden gives no warning, and every breakdown adds up.
- The 2024 fixture's counts, worked out by hand before the run, then measured equal: 57 entities;
  5 items, 3 weapon properties, 2 masteries; 81 keys named; rolls `2d6`, `1d12`, `1d10`, `1d10`.
- The published schema's diff is one line: `"mastery"` after `"language"` in the category list.

Against §3: as written. Two things changed while building. The first override test was on
`.damage`; it was moved to `.hit`, as §3 item 7 says. §4 first said a weapon's dice never change
in either SRD; Shillelagh changes them (below), so §4 now says no golden does.

Against the row: the row was "Attacks are computed, weapon mastery included", size S, and its note
held four more things. Checked against the code, three were hats of their own, so the row is
narrowed to weapon attacks, size M, and the rest became rows: ENG-52 (a roll formula's average),
ENG-50 (a spell's dice for the character's level: ADR 014 item 6, which names ENG-16), ENG-51
(`attack.spell.bonus`, and a spell a grant gives with its own stat). Each new row's note in
`BACKLOG.md` carries what the old note said.

Found, not fixed:
- The Heavy weapon property gives disadvantage on attack rolls: in 2024 with a heavy melee weapon
  below Strength 13 or a heavy ranged one below Dexterity 13; in 2014 to a Small creature
  (5e-database `heavy`, each edition). Roll modes are ENG-34's; the difference is an edition one.
  Noted on ENG-34.
- Shillelagh (SRD 5.1, SRD 5.2.1 spells) lets a club or a quarterstaff use the spellcasting stat
  instead of Strength and makes its die a d8; in 2024 the die grows at levels 5, 11 and 17. Noted
  for phase 3's mechanics, with a pointer on ENG-50.
- A magic weapon has no kind of its own (dnd5e's `type.baseItem`), so a "Longsword, +1" with a key
  of its own loses a proficiency by key and its `mastery` kind. Noted for phase 3.
- A `mastery` choice's filter cannot say the barbarian's "Melee weapons" nor the paladin's,
  ranger's and rogue's "with which you have proficiency". Noted for phase 3.
- `fixedDamageModifier` is an edition difference SPEC §6.3's table does not list. Noted on ENG-19,
  which holds every difference.

Changelog: "The fifth-edition pack schema accepts a `mastery` proficiency".

---

### ENG-22 Golden E: the homebrew pack from Appendix Д

**Hat:** The homebrew pack from Appendix Д changes character B
**Depends on:** ENG-10 (golden B, `srd-2024`), ENG-12 (stat scores), ENG-13 (saves, skills),
ENG-25 (packs load into the index), ENG-39 (`systemSchemaVersion`), ENG-43 (a skill's stat)
**Size:** S
**Screen:** No
**SPEC:** §6.7 golden E; Appendix Д; D3; §8.2

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/test/golden/golden-values.test.ts` — changes: an `ENG-22`
block; the file's `computed` helper loads the packs the character names.
- `packages/system-5e/test/golden/hb-local.ts` — new: SPEC Appendix Д's pack, with `system` and
  `systemSchemaVersion` added.
- `packages/system-5e/test/golden/characters-2024.ts` — changes: `goldenE`, golden B with the pack.
- `packages/system-5e/test/golden/index.ts` — changes: exports `hb-local.ts`.

No source file changes.

#### 2. What is missing now

Measured on `main` at `7633984`, with a scratch test (deleted):
- Appendix Д's pack as the SPEC writes it does not open with `openFifthEditionPack`:
  `Invalid input: expected "5e" → at system` and `Invalid input: expected 2 → at
  systemSchemaVersion`. With `system: '5e'` alone, only the second.
- With both fields, it loads beside `srd-2024`: `loaded` `['srd-2024', 'hb-local']`, nothing
  refused, no warning.
- Golden B with the pack, SAN 14 and the feat already gives SPEC §6.7's values: SAN 14, +2, save
  +2; Composure +2; INT 9 (−1); Occultism proficiency 1, total +1; no warning.
- No test holds any of it: `grep -rn "goldenE\|hb-local" packages/system-5e` finds nothing.
- `pnpm test`: `Test Files 43 passed (43)`, `Tests 481 passed (481)`.

#### 3. What it should look like when done

Golden E is golden B (ENG-10) with the pack `hb-local` after `srd-2024` in its `packs`, a base
SAN of 14 (Appendix Д's last line) and the feat Arcane Scholar given by hand (`systemData.feats`,
no `replaces`: a 2024 fighter 1 has no grant to take a feat in place of).

1. **The pack.** `hb-local.ts` is Appendix Д's pack word for word, plus `system: '5e'` and
   `systemSchemaVersion: 2` (ADR 004 item 3, ENG-39). It opens with `openFifthEditionPack`, and
   loads after `srd-2024` with nothing refused and no warning.
2. **SAN 14.** `abilities.san.score` 14, `.mod` +2, `.save` +2 (the modifier, no proficiency).
   SAN is a stat of the character beside the SRD's six, ordered after them (`order` 7), with
   `hasSave`: what the abilities and saves blocks list.
3. **Composure +2.** `skills.composure.ability` is `san`; `.prof` 0; `.total` +2.
4. **Occultism +1.** `abilities.int.score` 9 (8, then the feat's `add 1`), `.mod` −1;
   `skills.occultism.prof` 1, from the grant `hb-local:feat/arcane-scholar#occult-prof`;
   `prof` +2; `skills.occultism.total` +1.
5. **SAN to 16.** Golden E with a base SAN of 16: `skills.composure.total` +3.
6. **The feat removed.** Golden E with no feats: `skills.occultism.total` −1,
   `abilities.int.score` 8.
7. **The pack off.** Golden E with `packs` `['srd-2024']` opens and computes without a throw. Its
   warnings are exactly two: `missing` for `hb-local:feat/arcane-scholar`, its message
   `Missing: hb-local:feat/arcane-scholar (given by character).`; and ENG-12's `noStat` for the
   base score `san`, which no pack now gives. It has the SRD's six stats, and no Occultism or
   Composure.
8. **Nothing else moves.** Every value golden B has, golden E has equal, except
   `abilities.int.score` (9): INT 9's modifier is −1, as INT 8's is.
9. **Whole.** Golden E, with SAN 16 and with no feat: no warning, and each breakdown adds up to its
   value (ENG-13's check).
10. The goldens A–D keep their values: their tests pass unchanged.
11. The quality gate is green.

#### 4. How to do it

1. `hb-local.ts`: the pack as one object, `satisfies z.input<typeof fifthEditionPackSchema>`, its
   comment naming Appendix Д and the two added fields.
2. `characters-2024.ts`: `goldenE`, spread from `goldenB` with its own id and name, `packs`, the
   base SAN and the feat.
3. `golden-values.test.ts`: the packs on the device, each opened once, by id; `computed` loads
   the character's `packs`, in order, into the index (SPEC §5.8: the active packs). Goldens A–D
   name one SRD pack each, so their index is the one they had. The ENG-13 check that a result has
   no warning and adds up becomes a function both blocks call.
4. `describe('ENG-22 golden E: the homebrew pack from Appendix Д')`: §3 items 1–9.

#### 5. Stored data

Nothing stored changes. The pack and the character are test data in the existing shapes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/golden/golden-values.test.ts` — the `ENG-22` block: §3 items 1–9.
- The same file's ENG-13 to ENG-16 blocks: §3 item 10, unchanged.
- Control numbers from: SPEC §6.7 golden E (SAN 14 → +2; Composure +2; INT 8 → 9 (−1) + 2 = +1;
  SAN 16 → Composure +3; no feat → Occultism −1, INT 8; the pack off → `Missing: hb-local:…`);
  Appendix Д (the pack, SAN 14); golden B's base INT 8 (ENG-10). The SAN save +2 is the modifier
  with no proficiency (ENG-13's rule); the `noStat` warning is ENG-12's rule for a base score whose
  stat no pack gives.

#### 8. Checked against the source

No `[ПРОВЕРИТЬ]` in golden E or Appendix Д. The rules facts are ENG-13's, checked there (ENG-13
§8): the modifier `floor((score − 10) / 2)`; the proficiency bonus +2 at level 1; a skill adds its
stat's modifier and, with proficiency, the bonus. The cap of 20 is the stat's `defaultMax`
(Appendix Д's last line; ENG-12). The pack is the owner's homebrew, not SRD text.

#### 9. Not in this ticket

- The abilities and saves blocks on screen: phase 2 (`SHEET`). This ticket proves the engine
  gives them SAN.
- Turning a pack on or off, and a character naming a pack the device lacks: the app, phase 2 (the
  `BACKLOG.md` note found by ENG-25). Here the index holds the packs the character names.
- Golden F, a character mixing both editions: ENG-37.
- The prerequisites and repeat of a homebrew feat: Arcane Scholar has none.

#### 10. Rake check

- **The golden tests are the truth.** Each expected value is SPEC §6.7's or follows from it by a
  rule named in §7; none was copied from a run. No expected value of A–D changes.
- **Everything is data.** SAN, Composure and Occultism come from a pack; no code names them.
- **Missing is not broken.** §3 item 7: the pack off gives warnings, never a throw.
- **The engine is pure.** No source file changes.
- **Content and licensing.** The pack is the owner's homebrew from the SPEC (`redistributable:
  false`), as ENG-04 and ENG-05 used it; it is test data and enters no build.
- **Language.** The pack's Russian strings are its entities' data, written as Appendix Д writes
  them; every comment and test name is English.

#### 11. What came out of it

The gate, measured:
- `pnpm lint`: `Checked 156 files in 265ms. No fixes applied.`
- `pnpm typecheck`: 6 projects `Done`, the module's tests included.
- `pnpm test`: `Test Files 43 passed (43)`, `Tests 490 passed (490)`, 8.49 s. Before: 481; the 9
  new are the `ENG-22` block. `golden-values.test.ts` alone: 25 (16 before).

The values, from the tests (each SPEC §6.7's):
- Golden E: SAN 14, +2, save +2 (save proficiency 0). The stats by `order`: STR, DEX, CON, INT,
  WIS, CHA, SAN, each with a save.
- Composure: its stat `san`, proficiency 0, +2.
- INT 9 (base 8, then `hb-local:feat/arcane-scholar#int-plus-1`), −1; Occultism proficiency 1
  from `hb-local:feat/arcane-scholar#occult-prof`, `prof` 2, total +1.
- SAN 16: Composure +3. No feat: Occultism −1, INT 8.
- The pack off: two warnings, `Missing: hb-local:feat/arcane-scholar (given by character).` and
  `noStat` for `san`; the six SRD stats; no Occultism or Composure value.
- Of golden B's values, only `abilities.int.score` differs in golden E: 8 → 9.
- The pack loads after `srd-2024`: nothing refused, no warning.

The fixture was checked against the SPEC's text: a scratch test (deleted) parsed Appendix Д's
JSON out of `docs/SPEC.md` and compared it with `hbLocal` less `system` and
`systemSchemaVersion`: equal, top-level keys in the same order.

The tests were checked to fail, each change undone after:
- The base phase's effects on a stat dropped (`stats.ts`): 2 fail (Occultism; the values that do
  not move).
- A missing id throws in gathering (`gather.ts`): 1 fails (the pack off).
- Only the first six stats computed (`stats.ts`): 4 fail (SAN 14; Composure; SAN 16; whole).

Differences from §3: none.

Against the row: the engine already gave every golden E value (§2), so the ticket wrote test data
and the test only; no source file changed. The row's note (the pack gains `system` and
`systemSchemaVersion`, no expected value changes) is done as written.

Found, not fixed: nothing.

Changelog: nothing. No screen shows a character yet.

---

### ENG-49 A spell or item a grant names that no pack has gives a warning

**Hat:** A spell or item a grant names that no pack has gives a warning
**Depends on:** ENG-11 (`gather`, the `missing` warning), ENG-13 (`SystemModule.grantsOf`, the
model for a module telling the core about its grants), ENG-32 (the `spell` and `item` grant
kinds), ENG-27 (Tales and its `boon` kind)
**Size:** S
**Screen:** No
**SPEC:** §5.5 (grants: `fixed` and `choose`); §6.1 steps 1–2 (gathering); §8.2 (a missing
reference is a placeholder and a warning, never a crash); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/gather.ts` — changes: `gather` takes the ids a grant of a
module's own kind names, and looks each one up; a `missing` warning is given once per id and
place.
- `packages/engine/src/compute.ts` — changes: `SystemModule.namedIds`, passed to `gather`.
- `packages/system-5e/src/module.ts` — changes: `namedIds` gives a `spell` grant's `fixed` spells
  and an `item` grant's `fixed` items.
- `packages/engine/test/tales-module.ts` — changes: Tales' `namedIds` gives a `boon` grant's talent.
- `packages/engine/test/compute.test.ts` — changes: a `describe('ENG-49 …')` block, on Tales and
  on the made-up card system.
- `packages/system-5e/test/module.test.ts` — changes: a `describe('ENG-49 …')` block, on golden A
  with a made-up feat; ENG-13's made-up class `scribe` gives an item the 2024 pack has (§11).

#### 2. What is missing now

Measured on `main` at `7633984`, with a scratch test (deleted after):
- Golden A with a made-up feat whose grants are a `spell` grant with `fixed:
  ['srd-2014:spell/nothing']`, an `item` grant with `fixed: [{ id: 'srd-2014:item/nothing', qty:
  1 }]`, and a `spell` grant with `choose: { count: 1, from: ['srd-2014:spell/missing',
  'srd-2014:spell/bless'] }` whose stored choice is `['srd-2014:spell/missing']`. Its warnings:

  ```
  [{"code":"missing","id":"srd-2014:spell/missing","from":"character:feat/test#pick"},
   {"code":"missing","id":"srd-2014:spell/missing","from":"character:feat/test#pick"}]
  ```

  The fixed spell and the fixed item give nothing; the chosen spell warns twice, once as chosen
  (`chosenFor`) and once among the pending choice's options.
- `gather.ts` looks up only an `entity` grant's `fixed` ids (the walk) and every grant's chosen
  ids. `SystemModule` has no way to say which ids a module's own grant kind names.
- Goldens A, B, B4, C 2014, C 2024: 0 warnings each.
- `pnpm test`: `Test Files 43 passed (43)`, `Tests 481 passed (481)`.

#### 3. What it should look like when done

1. **The module names the ids** (the core, game-free): `SystemModule.namedIds?(grant)` gives the
   entity ids a grant of the module's own kind names that gathering does not walk. Gathering asks
   it for each grant it reaches that is not a core `entity`, `proficiency` or `resource` grant,
   looks each id up (the character's own entities, then the packs), and warns `missing` with the
   grant's part id as `from` for each one not found. The ids are not gathered: they join no
   `entities`, and their effects and grants do nothing. Without `namedIds`, nothing is looked up.
2. A grant not reached names nothing: one whose `atLevel` is above the level, one of a dormant
   entity, one a module's `grantsOf` leaves out.
3. **One warning per id and place.** A `missing` warning with the same `id` and `from` is given
   once. A chosen id that is missing from a list choice warns once, not twice. The same missing id
   given from two places warns once for each place.
4. **Fifth edition**: `namedIds` gives a `spell` grant's `fixed` and an `item` grant's `fixed`
   entries' `id`s; every other kind gives none. Golden A with a made-up feat
   `character:feat/finder`, the feat of §2 with `srd-2014:spell/bless` added to the spell grant's
   `fixed` and `{ id: 'srd-2014:item/shield', qty: 1 }` to the item grant's (its missing item at
   `qty: 2`), gives exactly these warnings, in this order (the order the grants are reached):
   - `missing` `srd-2014:spell/nothing` from `character:feat/finder#spells`;
   - `missing` `srd-2014:item/nothing` from `character:feat/finder#kit`;
   - `missing` `srd-2014:spell/missing` from `character:feat/finder#pick`.

   Its pending choice `character:feat/finder#pick` has `chosen: []` and options
   `['srd-2014:spell/bless']`. Nothing is gathered from the feat's grants: Bless is not in
   `entities`, and the shield, which golden A wears, has `from: ['character']` only.
5. **Tales** (core tests): Tales' `namedIds` gives a `boon` grant's `boon`. Brook with a talent of
   its own whose boon names `tales-core:talent/gone` warns `missing` once, from that talent's
   boon part; with a module without `namedIds`, it does not. Brook's own boon (Deep Lungs, in the
   pack) warns nothing and still gathers nothing. A boon whose `atLevel` is above Brook's level 3
   warns nothing.
6. Goldens A, B, B4, C 2014, C 2024 and D still give 0 warnings; no expected value changes.
7. `compute()` stays pure: frozen inputs give equal results.
8. The quality gate is green.

#### 4. How to do it

1. `gather.ts`: a sixth parameter, `namedIds` (default: none). In the walk, a grant that is not
   an `entity`, `proficiency` or `resource` grant has its `namedIds` looked up with `find`, each
   not found warned `missing` from its part. A `warnMissing(id, from)` inside `gather` keeps the
   `(from, id)` pairs it warned, and every lookup that warns `missing` goes through it.
2. `compute.ts`: `SystemModule.namedIds`, passed to `gather`.
3. `module.ts` (fifth edition): `namedIds` for `spell` and `item`.
4. `tales-module.ts`: `namedIds` for `boon`.
5. The tests of §7.

Technical choices (ADR 002):
- **The module says which ids its kinds name**, as the row's note says and as ENG-13's `grantsOf`
  says which grants apply. The core cannot know that a `spell` grant's `fixed` is a list of ids
  and an `item` grant's is a list of `{ id, qty }`: they are the module's kinds (ENG-32).
- **A function of the grant alone**, not of the character: which ids a grant names is its shape,
  never a rule of the character. `grantsOf` takes the character because its rule reads the class
  order.
- **Looked up, not gathered.** A spell a subclass gives is known or prepared, not an entity whose
  effects apply; an item a background gives goes into the inventory, and only an equipped one is
  named (ENG-44). Gathering them would apply their effects.
- **Only `fixed` ids are the module's to give.** Every grant's chosen ids are looked up by
  gathering already (`chosenFor`), so the module gives only what the grant names itself.
- **Asked of every grant but `entity`, `proficiency` and `resource`.** An `entity` grant's ids are
  walked; a `proficiency` grant names keys, a `resource` grant a key. The core's `abilityScore`
  kind is asked too and names nothing; a module gives `[]` for it.
- **One warning per id and place, not per id.** A `missing` warning has one `from`; the person
  fixes the reference where it is. Two places naming the same missing id are two references to
  fix (SPEC §8.2: each missing reference has its placeholder and warning). The same place looking
  the same id up twice is one reference. The row's "one warning per id" was said of the double
  warning of one choice (§11).

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/compute.test.ts` — `describe('ENG-49 ids a module's grant names, looked
  up once')`: §3 items 1, 2, 3 and 5 on Tales and on the card system of ENG-11's test.
- `packages/system-5e/test/module.test.ts` — `describe('ENG-49 a spell or item a grant names that
  no pack has')`: §3 items 4, 6, 7.
- Control values from: the made-up entities' own ids, and the fixture pack `srd-2014.ts`, which
  has `srd-2014:spell/bless` (line 466) and `srd-2014:item/shield` (line 521) and no
  `…/nothing` or `…/missing`. Each expected value was read from that data by hand, never copied
  from a run.

#### 8. Checked against the source

Nothing to check: no rule of a game. Which grant fields name entities is ENG-32's schema
(`spellGrantSchema`, `itemGrantSchema` in `system.ts`); what a missing reference does is SPEC §8.2.

#### 9. Not in this ticket

- A named spell or item of the other edition gets no `otherRuleset` warning, as a spell grant's
  chosen one gets none today: only entities the character has are warned so (ENG-11).
- What a spell grant's spells do on the sheet (known, prepared, cast): phase 2's Spells tab,
  ENG-20, ENG-51. What an item grant's items do (the starting inventory): the creation wizard.
- A `Missing: <id>` placeholder on screen: phase 2.

#### 10. Rake check

- **`packages/engine` is pure; the core names no game.** `namedIds` and the one-warning rule name
  no spell or item; the core is tested on Tales' `boon` and the card system.
- **Each system's rules live in its own module.** Which fields of `spell` and `item` are ids is
  in `module.ts`; no `if (system === …)` in the core.
- **Missing is not broken.** A missing id warns and nothing throws; the grant still applies.
- **`compute()` is pure.** `namedIds` reads the grant only; a frozen character and index give
  equal results.
- **Golden values do not move.** No golden names a missing spell or item; their 0 warnings stay.
- **Licensing.** The feat, talent and ids in the tests are made up (`character:`, `…/nothing`).

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- `compute.test.ts` and `module.test.ts` together: `Tests 44 passed (44)` (7 new: 4 on Tales and
  the made-up feat's talent, 3 on fifth edition).
- Lint: `Checked 155 files`, no fixes, no error. Typecheck: all 6 projects `Done`.
- Test: `Test Files 43 passed (43)`, `Tests 488 passed (488)`, 5.86 s (before, at `7633984`: 43
  files, 481 tests).
- ENG-22 reached `main` while this ticket was built (`b23b984`); the ticket was rebased onto it.
  On the result: lint `Checked 156 files`, no error; typecheck all 6 `Done`; `Test Files 43
  passed (43)`, `Tests 497 passed (497)`, 6.07 s. Golden E with its pack off still gives its one
  `Missing: hb-local:feat/arcane-scholar (given by character).`: the Appendix Д pack has no
  `spell` or `item` grant.
- Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The made-up feat of §2, run again on the new code (scratch test, deleted after):
  `spell/nothing` from `#spells`, `item/nothing` from `#kit`, `spell/missing` from `#pick`, once
  each. Before: `spell/missing` twice, the other two not at all.
- Goldens A, B, B4, C 2014, C 2024 and D: 0 warnings each, as before. No expected value changed.
- The tests bite. 8 breaks, each on its own and restored, the `engine` and `system-5e` tests run
  (360 tests): `namedIds` not passed to `gather`, 3 fail; no once-per-place check, 2; the named
  ids gathered, 11; found ids warned too, 22; one warning per id whatever the place, 1; no spell
  ids in fifth edition, 2; no item ids, 2; no boon ids in Tales, 2.

Differences from §3 and §4:
- ENG-13's made-up class `scribe` (`module.test.ts`) gave `srd-2014:item/shield` from its `kit`
  grant, and two of its tests compute it as golden B's first class, on the 2024 pack, which has no
  such id. The new lookup warned `missing` there, rightly: the test data named an id its pack
  lacks. Its kit now gives `srd-2024:item/greatsword`; the tests' expected values did not change.
- §3 item 4 first said none of the feat's four spells and items is in `entities`. Golden A wears
  the shield, so it is there, named by the character; the test checks that its `from` is the
  character's only.

Against the row and its note:
- The note said "one warning per id". It was said of one chosen id warned twice by the same
  choice; the built rule is one warning per id and place (§4), so two places naming the same
  missing id still give two warnings, each naming where to fix it.

Found, not fixed:
- A spell or item a grant names that is of the other edition gets no `otherRuleset` warning (§9),
  nor does a `spell` grant's chosen one. Only entities the character has are warned so. New note
  for phase 2 in `BACKLOG.md`: the Spells tab and the starting inventory show the edition there.

Nothing for the changelog.

---

### ENG-36 Level-up as an undoable action

**Hat:** Level-up changes the character through an undoable action
**Depends on:** ENG-30 (`logEntrySchema`, `applyEntry`, `reverseEntry`, `LogStamp`), ENG-33
(`systemData.classes`, `feats`, `spells`, `state.hp`), ENG-14 (`hp.max`, `hitPointsOf`), ENG-13
(a feat's `replaces`, a later class's grants), ENG-10 (golden B, B4)
**Size:** S
**Screen:** No
**SPEC:** §6.4 `levelUp`, `undoLevelUp`, as ADR 014 item 10 widens it; §7.4's level-up steps;
ADR 004 item 1 (level-up is a module's action)

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/level-up.ts` — new: fifth edition's `levelUp`.
- `packages/system-5e/src/index.ts` — exports it.
- `packages/engine/src/trackers.ts` — changes: `entryOf` (the entry of a stamp) and `changeTo`
  (one change, its `before` read from the character) are exported, so a module's action builds its
  entry as the core's actions do; `ActionResult` takes the action's own refusals as a second type.
- `packages/system-5e/test/level-up.test.ts` — new.

#### 2. What is missing now

- `grep -rn "levelUp\|LevelUp\|level-up" packages --include=*.ts` finds nothing.
- No function changes `systemData.classes`. A level is gained only by writing the character by
  hand.
- `pnpm test`: `Test Files 43 passed (43)`, `Tests 481 passed (481)`, 6.47 s.

#### 3. What it should look like when done

The control characters are golden B (2024: human fighter 1, CON 15 (+2), d10, `hp: ['max']`,
12 of 12 hit points) and golden A (2014: hill dwarf cleric 1, CON 16 (+3), d8, Dwarven Toughness
+1 per level, 12 of 12). `stamp` is `{ id, at, by: { role: 'player', name: 'Wren' } }`.

**The action**
1. `levelUp(character, index, ask, stamp)` (`@grimoire/system-5e`) gives `{ ok: true, character,
   entry }` or a refusal. `ask` is `{ class, hp, subclass?, choices?, feats?, spells? }`: the class
   that gains the level, that level's hit points (a number rolled, `avg` or `max`), the subclass it
   takes, the picks for the grants the level opens (part id → keys or ids), the feats taken, and the
   spells a class or subclass knows and has prepared after it.
2. The entry: `action` `levelUp`, `subject` the class's id, `label` its name, the stamp's `id`,
   `at` and `by`. It parses with `logEntrySchema`. Its changes, in order:
   - `['systemData', 'classes']`, the whole list: the class one level higher with the level's hit
     points last, or a new class taken last at level 1; the subclass set when given;
   - `['choices', <part>]` for each pick, `before` what was picked (none when nothing was); a
     pick equal to the one held is left out;
   - `['systemData', 'feats']`, the whole list, the feats taken last, when any are given;
   - `['systemData', 'spells', <id>]` for each class or subclass given;
   - `['systemData', 'state', 'hp', 'current']`, when the maximum changes.
3. **The hit points lost stay lost.** The current hit points rise by what `hp.max` rises
   (computed before and after), in whole points, never below 0. An `hp.max` that is overridden, or
   not a number, rises by 0, and the entry then has no hit point change.

**Golden B to B4**
4. B, fighter, `avg`: classes `[{ id: fighter, level: 2, hp: ['max', 'avg'] }]`; hit points
   12 → 20 (12 + 6 + 2); computed `hp.max` 20, `level` 2. The entry has 2 changes, `label`
   `{ en: 'Fighter' }`.
5. Then fighter, `avg`, subclass Champion: 20 → 28. Then fighter, `avg`, choices
   `{ 'srd-2024:class/fighter#ability-scores-4': ['str'],
   'srd-2024:feature/fighter-weapon-mastery#kinds-4': ['halberd'] }`: 28 → 36. The result equals
   golden B4 opened, but for `id` and `name`; computed `hp.max` 36 and `abilities.str.score` 19
   (SPEC §6.7 B4).
6. Golden A, cleric, `avg`: hit points 12 → 21 (12 + 5 + 3 + 1): the rise holds Dwarven
   Toughness's point for the new level.

**Hit points**
7. B, fighter, 7: `hp: ['max', 7]`, 12 → 21. `max`: 12 → 24. B at 5 of 12, `avg`: 5 → 13.
8. B with an override of `hp.max` to 30, `avg`: the entry has only the classes change; the
   current hit points stay 12. B with its own feat adding `@level / 2` to `hp.max.bonus`: 12.5 →
   21, so 12 → 20 (20.5 rounded down). With `0 - 10 * @level` at 1 of 2: 2 → 0, so 1 → 0, not -1.
9. B, fighter, 11 (above the d10), 0 or 1.5: `{ code: 'badHitPoints', value, die: 10 }`.

**Multiclass, subclass, feats**
10. B, wizard, `avg`: classes `[fighter 1, { id: wizard, level: 1, hp: ['avg'] }]`; 12 → 18
    (6 / 2 + 1 + 2). Its prerequisite (INT 13) is not checked here (§9).
11. B at level 3 with a feat of its own taken by hand, fighter, `feats: [{ id: <another feat of
    its own>, replaces: 'srd-2024:class/fighter#ability-scores-4' }]` and no STR pick: the feats
    change adds the new feat after the one it has; `abilities.str.score` stays 17; the feat's
    `2 * @level` on `hp.max.bonus` makes the level's rise 8 + 8 = 16 (28 → 44).
    B, fighter, the weapon mastery kinds picked again with the halberd for the glaive: that change
    has the old kinds as `before`.

**Refusals** — each changes nothing and carries a `code`, its data and an English `message`:
12. A character of level 20: `{ code: 'maxLevel', level: 20 }`.
13. A class no pack has: `missing`. Champion as the class: `{ code: 'wrongType', type:
    'subclass', expected: 'class' }`. Wizard as the fighter's subclass: `wrongType`, expected
    `subclass`. A feat no pack has: `missing`; a feature as a feat: `wrongType`, expected `feat`.
14. B, wizard with subclass Champion: `{ code: 'otherClass', id: champion, classKey: 'fighter',
    expected: 'wizard' }`.
15. B4, fighter with any subclass: `{ code: 'hasSubclass', id: fighter, subclass: champion }`.
16. A pick of no items: `{ code: 'invalid', issues }`, an issue at
    `['choices', 'srd-2024:class/fighter#ability-scores-4']`: the result is checked against
    `fifthEditionCharacterSchema`, so a level-up never gives a character its opener refuses.

**Undo**
17. `reverseEntry` with each entry of items 4–5, newest first, gives back each character before
    it, down to golden B.
18. The level 2 entry reversed on the level 3 character: `{ code: 'changed', path: ['systemData',
    'classes'] }`.
19. Deep-frozen inputs: `levelUp` does not throw, and each input equals its copy after the call.
20. The quality gate is green.

#### 4. How to do it

1. `packages/engine/src/trackers.ts`: `entryOf(stamp, made)` and `changeTo(character, path,
   after)` out of the private `done` and `before`, which now use them; `ActionResult<C, R =
   TrackerRefusal>`.
2. `packages/system-5e/src/level-up.ts`: `LevelUpAsk`, `LevelUpRefusal`, `levelUp`. In order:
   the level cap; the class, subclass and feats looked up (`finderOf`, the character's own first);
   the hit points against the class's die; the changes without the hit points; the character with
   them checked against the schema; `hp.max` computed before and after; the hit point change; the
   entry applied with `applyEntry`.
3. Tests, then the gate.

Technical choices (ADR 002):
- **A module's action.** ADR 004 item 1 puts level-up in the system module. It uses the core's
  entry, applying and reversing unchanged.
- **Undo is `reverseEntry`.** SPEC §6.4's `undoLevelUp` is reversing the level-up's entry
  (ADR 014 item 10); no second function. A later change on the same place refuses the undo as
  `changed`, as every entry does (ENG-30).
- **One entry holds the whole level-up**: the class, its hit points, the picks, the feats, the
  spells. The DM's review approves or edits a level-up as one entry (ADR 013 item 3), and one undo
  takes all of it back.
- **The hit points lost stay lost.** The current hit points rise by the maximum's rise, computed
  by `compute()` before and after, so a per-level bonus or a Constitution raised by the same
  level-up is counted once, in one place. dnd5e also raises the current hit points (§8).
- **The action refuses what is not a level-up**: a level past 20, a class, subclass or feat that
  no pack has or that is another type, a roll the die cannot give, a subclass for a class that
  has one. A pick may replace an earlier one (SRD 5.2.1's fighter may replace its Fighting Style
  feat on a level-up, §8); the entry keeps the old pick as `before`.
- **The rules a person may bend are not checked here.** A multiclass prerequisite, the subclass
  level, the house rules' hit point methods and `multiclass` are warnings in the level-up wizard
  (phase 4); manual mode allows any of them (SPEC §7.4).
- **The result is checked against the character schema.** Unlike `applyEntry`, the module knows
  its schema; a level-up never gives a character that would not open.

#### 5. Stored data

Nothing stored changes. The entry is ENG-30's `logEntrySchema`; the fields it changes are
ENG-33's.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/level-up.test.ts` — `describe('ENG-36 level-up')`: §3 items 1–19.
- Control numbers from: SPEC §6.7 golden B and B4 (hit points 12 and 36, STR 19), golden A's hit
  points (12); the values between, worked out by hand in §3 from ENG-14 §8's hit points per level.

#### 8. Checked against the source

Sources: foundryvtt/dnd5e at `7bfb3f1` (2026-10-01): `module/documents/advancement/hit-points.mjs`,
and SRD 5.2.1 as dnd5e quotes it, `packs/_source/content24/chapter-2/character-creation.yml` and
`packs/_source/classes24/` (CC-BY-4.0). 5e-bits/5e-srd-api at `240592b` (2026-10-02), `packages/5e-database/src/2014/en/`:
its rules file has no chapter on gaining a level or multiclassing (searched for "Beyond 1st",
"additional Hit Die", "hit point maximum increases": only class features and traits match).
- **Gaining a level** (SRD 5.2.1, "Gaining a Level"): choose a class, the same or another by the
  multiclassing rules; gain a Hit Die, roll it, add the Constitution modifier, add the total
  (minimum 1) to the Hit Point maximum, or take the fixed value; record the new class features and
  make the choices they offer. A Constitution modifier raised by 1 raises the maximum by 1 per
  level. ENG-14 computes the maximum this way from `classes[].hp`.
- **A new class's first level** (SRD 5.2.1, Multiclassing, "Hit Points and Hit Point Dice"): "You
  gain the level 1 Hit Points for a class only when your total character level is 1." So a later
  class's level 1 is rolled or the average; `max` there is a house rule (`hitPointMethods`), not
  refused (§4).
- **The current hit points.** Neither SRD says what a level-up does to them. dnd5e's
  `HitPointsAdvancement#apply` adds the level's hit points (the value plus the Constitution
  modifier, at least 1, plus per-level bonuses) to `attributes.hp.value`; `reverse` takes them
  off. This ticket adds the maximum's whole rise (§4).
- **Replacing a pick on a level-up.** SRD 5.2.1's Fighting Style, as dnd5e quotes it
  (`packs/_source/classes24/fighter/class-features/fighting-style.yml`, `license: CC-BY-4.0`):
  "Whenever you gain a Fighter level, you can replace the feat you chose with a different Fighting
  Style feat." So a level-up may change an earlier pick; the action allows any pick, with its old
  value as `before`.

#### 9. Not in this ticket

- The multiclass prerequisites, the subclass level, the house rules' hit point methods and
  multiclass switch as warnings: the level-up wizard, phase 4 (SPEC §12 stage 4: "multiclass
  checks prerequisites, a warning, not a block").
- Which grants a level opens and the choices still to make: `compute()`'s `pendingChoices`
  (ENG-11), read by the wizard after the level-up.
- XP: gaining it, and a level reached by it (ADR 010 item 7): phase 4.
- Storing entries, the history, the DM's approval of a waiting level-up: phase 2 and the table
  link.
- Level-down past what an entry holds (taking a level off by hand): the sheet's manual edit,
  phase 2.

#### 10. Rake check

- **Each system's rules live in its module.** Level-up is in `system-5e`; the core gains only two
  game-free helpers. No `if (ruleset === …)`: both editions level up the same way.
- **Missing is not broken.** A class or feat no pack has is a refusal with a code, never a throw;
  an unmade pick stays a pending choice, not a refusal.
- **Ids are stable.** The entry names the class by id and each pick by its part id.
- **`compute()` is pure.** The action calls it twice and changes nothing it is given; the frozen
  test proves it.
- **Measure, never estimate.** Every value in §3 is SPEC §6.7's or worked out by hand from ENG-14's
  rules.
- **No user-facing string in the engine or the module.** `message` is English for logs; the screen
  uses `code`.
- **A stored-shape change needs a migration.** None changes (§5).
- **Licensing.** The made-up feat is the character's own (`character:`), with no rules text.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- Before: `grep -rn "levelUp\|LevelUp\|level-up" packages --include=*.ts` found nothing.
  `pnpm test`: `Test Files 43 passed (43)`, `Tests 481 passed (481)`, 6.47 s.
- After, on `7633984`: `pnpm test`: `Test Files 44 passed (44)`, `Tests 498 passed (498)`, 6.49 s.
  Rebased onto `1b4f1b0` (ENG-22 and ENG-49 landed first): `Test Files 44 passed (44)`,
  `Tests 514 passed (514)`, 6.63 s.
- The new file alone: `Tests 17 passed (17)`, 1.11 s. ENG-30's `trackers.test.ts`, after the
  helpers moved: `Tests 12 passed (12)`, 620 ms.
- Lint: `Checked 158 files` (rebased), no fixes, no error. Typecheck: `Scope: 6 of 7 workspace projects`,
  all `Done`. Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- Golden B leveled three times equals golden B4 in every field but `id` and `name`; computed
  `hp.max` 36 and `abilities.str.score` 19, SPEC §6.7's B4 values. Current hit points 12 → 20 →
  28 → 36. Golden A, cleric 2: 12 → 21. Each of the three entries reversed, newest first, gives
  back the character before it, down to golden B.
- The tests catch mistakes. Each change made on its own in `level-up.ts`, then the new file run
  (17 tests): no level cap, 1 fails; a roll above the die allowed, 2; a roll of 0 allowed, 1; a
  roll not whole allowed, 1; a second subclass allowed, 1; another class's subclass allowed, 1;
  feats not looked up, 1; a new class taken first, 1; the level's hit points put first, 4; the
  subclass dropped, 1; changes that change nothing kept, 1; the feats asked for replacing the
  list, 0 at first; no schema check, 1; the current hit points not raised, 9; raised below 0, 1;
  rounded instead of down, 1; set to the new maximum, 3; raised by the level's die and CON alone,
  4; the label dropped, 2. Each was undone, and the file compared equal to its copy.
- The one change that first passed every test, the feats replacing the list, passed because every
  test character had no feats. The feat test now starts from a character with a feat taken by
  hand; with that change, 1 fails.

Differences from §3:
- §3 items 3, 8 and 11 gained what the work added: the current hit points rise in whole points
  (a test with a half point per level, and one that would go below 0), a pick equal to the one
  held is left out of the entry, and a pick made again keeps the old one as `before`.
- A refusal of an entry's place (`badPath`, `changed`) can come back from `levelUp` too, as from
  ENG-30's actions: `ActionResult<C, R>` keeps `EntryRefusal` beside the action's own refusals.
  No test reaches it; a part id in `choices` that is not a safe path step would.

Against the row and its note: the note named ENG-30's entry, applied and reversed by
`applyEntry` and `reverseEntry`, built from the character it changes; that is what was built. No
`undoLevelUp` function: SPEC §6.4's undo is `reverseEntry` (§4).

Found, not fixed:
- `compute()` gives no warning for `max` hit points at a level other than the character's very
  first (SRD 5.2.1, Multiclassing: "the level 1 Hit Points for a class only when your total
  character level is 1"; §8). The schema and the level-up accept it as a house rule. The warning
  belongs with the level-up wizard's other warnings, phase 4, whose rows are written when it
  opens; no row now.
- 5e-bits/5e-srd-api's `HEAD` is `240592b` (2026-10-02), past ENG-09's `e6edf9a`. Only its 2014
  rules file was read here, for text it does not have; no fixture was compared against it.

Nothing for the changelog.

---

### ENG-50 A spell's dice for the character's level

**Hat:** A spell's dice are computed for the character's level
**Depends on:** ENG-32 (`SpellDef.damage`, `scaling`), ENG-08 (roll formulas), ENG-16 (`diceOf`),
ENG-17 (effects and overrides on any path), ENG-28 (the module's derived steps)
**Size:** S
**Screen:** No
**SPEC:** §5.3 (`SpellDef.damage`, `scaling`); §5.6 (roll formulas); §6.1 step 5; ADR 013 item 6;
ADR 014 item 6

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/spell-dice.ts` — new: `CANTRIP_LEVELS`,
`CANTRIP_UPGRADES_PATH`, `cantripUpgrades`, `spellDiceSteps`, `spellDice` and its types.
- `packages/engine/src/formula.ts` — changes: `addDice(base, added, times)`, a roll formula with
  more dice written out.
- `packages/system-5e/src/module.ts`, `index.ts` — change: `derive` joins `spellDiceSteps`; export.
- `packages/engine/test/formula.test.ts` — changes: the ENG-50 block.
- `packages/system-5e/test/spell-dice.test.ts` — new.

#### 2. What is missing now

Measured on `main` at `7633984`:
- `git grep scaling` in `packages/system-5e/src` and `packages/engine/src` finds only the schema
  (`entity-types.ts`, lines 234–277). No code reads a spell's `scaling`.
- No computed path says how far a cantrip has grown: `cantrip` in `packages/system-5e/src` is only
  `cantripsKnown` and `classes.<key>.spell.cantrips` (ENG-15), a count of cantrips known.
- A count of dice is digits, not a formula: `parseRoll('(1 + @level)d10')` gives
  `{"code":"unexpected","found":"d10","at":12}`. So dice that grow must be written out (ENG-08's
  note).
- `pnpm test`: `Test Files 43 passed (43)`, `Tests 481 passed (481)`.

#### 3. What it should look like when done

1. **Every character** has `cantrip.upgrades`: how many of the levels 5, 11 and 17 its total level
   (`level`) has reached: 0 at levels 1–4, 1 at 5–10, 2 at 11–16, 3 at 17–20. One step:
   `{ kind: 'path', path: 'level', value: <level>, change: <upgrades> }`. Effects and an override
   change it as on any derived path (ENG-17).
2. **`spellDice(spell, values, slot?)`** gives `{ times, damage, warnings }`.
   - `times`: how many times the spell's `scaling.formula` joins its first damage. For a cantrip
     (`scaling.kind: 'cantrip'`), `values['cantrip.upgrades']`; for another spell (`'slot'`), the
     slot levels above its own, 0 with no slot or a lower one; 0 with no `scaling`. A number that
     is not whole counts as the whole number below it, and as 0 below 0.
   - `damage`: each damage in order, `{ formula, type }`, the first with the scaling joined.
3. **Control values:**

   | Spell | Input | Dice |
   |---|---|---|
   | SRD 5.1 Fire Bolt (1d10; 1d10 per upgrade) | 0, 1, 2, 3 upgrades | 1d10, 2d10, 3d10, 4d10 |
   | SRD 5.1 Fire Bolt | golden C (level 6), golden A (level 1) computed | 2d10, 1d10 |
   | SRD 5.1 Fireball (level 3; 8d6; 1d6 per slot level above) | slots 3 to 9 | 8d6 to 14d6 |
   | SRD 5.1 Fireball | no slot, slot 2 | 8d6, `times` 0 |
   | `cantrip.upgrades` | golden A, B4, C 2014, C 2024 | 0, 0, 1, 1 |

4. **`addDice(base, added, times)`** (the core, game-free) gives the parsed roll formula `base`
   with `added` added `times` times:
   - one dice term that keeps every die joins the first dice term `base` adds at its top with its
     faces: `1d10` + 3 × `1d10` = `4d10`; `1к10` + 2 × `1d10` = `3к10`;
     `d8 + @stats.grit.mod` + 2 × `1d8` = `3d8 + @stats.grit.mod`;
   - with no such term, it follows after ` + `: `2d4` + 3 × `1d6` = `2d4 + 3d6`;
     `2 * 1d6` + `1d6` = `2 * 1d6 + 1d6`; a base whose top binds less than `+` goes in brackets:
     `(@gear.worn ? 1d6 : 1d8) + 1d6`;
   - any other `added` follows `times` times in brackets: `3d4 + 3` + 2 × `1d4 + 1` =
     `3d4 + 3 + (1d4 + 1) + (1d4 + 1)`;
   - `times` 0, below 0, or not finite gives `base`; 1.9 counts as 1;
   - errors, never a throw: `1d` does not parse (`unexpected`); `990d6` + 10 × `1d6` is
     `diceCount` 1000; `1d6` + 200 × `1d4 + 1` is `tooLong` 2403; at most 1000 copies are written.
5. **Never throws.** `spellDice` warns `missingPath` when the values have no number at
   `cantrip.upgrades` (0 steps used), `scalingWithoutDamage` for a scaling with no damage to join,
   and `scalingFormula` with the error when the formulas do not parse or join past the limits (the
   damage's own formula is used).
6. **Pure**: frozen inputs, equal results.
7. The quality gate is green. No file in `apps/web` changes, so no `pnpm e2e`.

#### 4. How to do it

1. `formula.ts`: `addDice`, reading the parsed trees of both formulas and writing the text.
2. `spell-dice.ts`: the levels, `cantripUpgrades`, the step of `cantrip.upgrades`, `spellDice`.
3. `module.ts`: `derive` joins `spellDiceSteps()`.
4. The tests of §7.

Technical choices (ADR 002):
- **One number for every cantrip, not a path per spell.** In both SRDs a cantrip reads the
  character's total level, and every SRD cantrip that grows by dice grows at 5, 11 and 17 (§8).
  So the step is one number, with a breakdown; an effect or an override on it changes every
  cantrip, as a homebrew "your cantrips count one step higher" would. Paths per spell would need
  the list of the character's spells, which no code gives yet.
- **The dice are text made from the number, outside `compute()`.** A derived value is a number
  (ENG-28); a roll formula is text. The sheet shows a spell's dice as
  `spellDice(spell, computed.values)`: the rule is the module's, the number and its breakdown are
  `Computed`'s, the dice the spell's own fields, as ENG-16's sheet shows an item's dice beside
  its computed bonus.
- **The path is `cantrip.upgrades`.** SRD 5.2.1 calls each step a "Cantrip Upgrade". It is not
  under `spell.`, ENG-15's casting numbers: a character who casts nothing can have a cantrip from a
  feat or a species.
- **The scaling joins the first damage.** `scaling` is one formula with no damage type, so it
  joins one damage: the first. A spell whose upgrade goes to another damage, or to two, is in §11.
- **Joining dice is the core's.** It is text of a roll formula, game-free, beside `diceOf`. It
  works on the parsed tree, so the pack's `d` or `к`, its spaces and its paths stay as written,
  and it parses the result with the same limits as any roll.
- **A count that is not whole is rounded down, and 0 below 0**: dice come whole, as `sumOf` rounds
  a half proficiency down. An effect may give such a number; nothing throws.
- **The slot is a parameter.** The same field holds a slot spell's growth; ENG-20's cast passes
  the slot. Without one, a spell shows its own dice.

#### 5. Stored data

Nothing stored changes. No schema, pack or character field changes; the published
`pack.schema.json` does not change.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/spell-dice.test.ts` — `describe('ENG-50 cantrip upgrades')` and
  `describe("ENG-50 a spell's dice")`: §3 items 1–3, 5, 6.
- `packages/engine/test/formula.test.ts` — `describe('ENG-50 dice added to a roll formula')`: §3
  item 4.
- Control values from: 5e-database `e6edf9a` (Fire Bolt's `damage_at_character_level`,
  Fireball's `damage_at_slot_level`), the levels of the goldens (SPEC §6.7), made-up spells. Each
  worked out by hand, never copied from a run.

#### 8. Checked against the source

Sources: 5e-bits/5e-srd-api at `e6edf9a` (`packages/5e-database/src/{2014,2024}/en/`); foundryvtt/
dnd5e at `7bfb3f1` (SRD 5.1 in `packs/_source/rules/`, SRD 5.2.1 in `packs/_source/content24/` and
`packs/_source/spells24/`, CC-BY-4.0). Read 2026-10-02.

**`[ПРОВЕРИТЬ]` (ADR 014 item 6): which level a cantrip reads.**
- SRD 5.2.1 (`content24/chapter-2/character-creation.yml`, Multiclassing, Spellcasting):
  "Cantrips. If a cantrip of yours increases in power at higher levels, the increase is based on
  your total character level, not your level in a particular class, unless the spell says
  otherwise."
- SRD 5.1 has no such sentence. Its Multiclassing "Spellcasting" (`rules/chapter-6-customization-
  options.yml`) covers spells known, prepared and slots only. Its spells say "when you reach 5th
  level" (Fire Bolt: "increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and
  17th level (4d10)"), and 5e-database names the table `damage_at_character_level`
  (`{"1": "1d10", "5": "2d10", "11": "3d10", "17": "4d10"}`).
- dnd5e: `module/data/actor/character.mjs` `cantripLevel` gives `details.level`, the total;
  `module/data/item/spell.mjs` `scalingIncrease` gives a cantrip `floor((level + 1) / 6)`: 0 at
  1–4, 1 at 5–10, 2 at 11–16, 3 at 17–20. Another spell gets its slot level minus its own.
- Result: the total character level, in both editions. Not an edition difference.

**The levels 5, 11 and 17.** All 10 SRD 5.1 cantrips with a table (5e-database) have the keys 1,
5, 11, 17. All 15 SRD 5.2.1 Cantrip Upgrade paragraphs name levels 5, 11 and 17.

**A slot.** SRD 5.1 Fireball (`higher_level`): "the damage increases by 1d6 for each slot level
above 3rd"; its table: 3: `8d6`, 4: `9d6` … 9: `14d6`. SRD 5.2.1 Fireball
(`spells24/3rd-level/fireball.yml`): "The damage increases by 1d6 for each spell slot level above
3"; dnd5e's data: 8 dice of 6, scaling `whole`, `number: 1`.

**How much `scaling` holds** (a script over 5e-database `e6edf9a`):
- SRD 5.1: 38 spells have a damage table by level (10 cantrips, 28 by slot). 35 grow by the same
  dice once per step, which `scaling` holds: Magic Missile with `1d4 + 1`; Eldritch Blast's table
  stays `1d10` (it gains beams, not dice), so it has none. 3 do not: Flame Blade (`3d6` at 2, `4d6`
  at 4) and Spiritual Weapon (`1d8 + MOD` at 2–3, `2d8 + MOD` at 4–5) grow every two slot levels;
  Flame Strike's die goes to its fire or its radiant damage (`4d6 OR 5d6`).
- SRD 5.2.1: 11 of the 15 Cantrip Upgrades are "The damage increases by 1dX … (2dX) … (3dX) …
  (4dX)". 4 are not: Eldritch Blast (beams), Shillelagh ("The damage die changes … (d10) … (d12)
  … (2d6)"), Spare the Dying (its range), True Strike (extra Radiant damage 1d6, 2d6, 3d6, with
  none at levels 1–4). 5e-database's 2024 spells give one table entry each (Fireball:
  `{"3": "8d6"}`), so 2024's slot spells were not counted.

#### 9. Not in this ticket

- A spell's healing (Cure Wounds: 1d8 + the modifier, 1d8 more per slot level above 1st): no field
  holds it (found by ENG-09). New row ENG-53.
- A spell's casting stat, which a formula's "modifier" reads: ENG-51.
- Casting with a slot, and which slots a cast may use: ENG-20.
- The growth `scaling` cannot hold (§8): phase 3's import.
- A roll formula's average: ENG-52. Advantage and critical hits: ENG-34.
- Showing the dice: phase 2.

#### 10. Rake check

- **The golden tests are the truth.** No SPEC §6.7 value changes; the new lines read the goldens'
  levels.
- **`[ПРОВЕРИТЬ]`.** Which level a cantrip reads is checked in §8, both SRDs and dnd5e.
- **Measure, never estimate.** Every count in §8 comes from a script over the source files; every
  dice text in §3 from 5e-database or worked out by hand.
- **`packages/engine` is pure; the core names no game.** `addDice` reads and writes formula text;
  it names no spell and no level.
- **Everything is data.** The dice are the spell's fields; the levels 5, 11, 17 are one named
  constant of the module, as ENG-16's `CRITICAL_FACE`.
- **`compute()` is pure.** The step reads `level` only; `spellDice` is tested frozen.
- **A number with no breakdown entry is a bug.** `cantrip.upgrades` has its step; `spellDice`
  returns `times` with the dice, and the spell's own fields are the rest.
- **Manual overrides always win.** Tested on `cantrip.upgrades`.
- **Each system's rules live in its own module.** Which level and which levels are the module's;
  the editions agree, so nothing goes to `rulesets/`.
- **Formulas never run code.** `addDice` writes text and parses it with ENG-07's limits.
- **Missing is not broken.** A missing number, a scaling with no damage, a formula that fails:
  warnings, the spell's own dice, never a throw.
- **A stored-shape change needs a migration.** Nothing stored changes.
- **Licensing.** Fire Bolt's and Fireball's numbers are SRD 5.1 (CC-BY-4.0); the code and tests
  hold no rules text.

#### 11. What came out of it

Measured on 2026-10-02, on `main` after ENG-22, ENG-49 and ENG-36 (rebased onto `fcccd77`):
- `pnpm lint`: `Checked 160 files`, no errors. `pnpm typecheck`: 6 projects, no errors.
- `pnpm test`: `Test Files 45 passed (45)`, `Tests 534 passed (534)`, 6.9 s. This ticket's 20: 13
  in `spell-dice.test.ts`, 7 in `formula.test.ts` (514 before, at `fcccd77`; first measured on
  `7633984`: 481 before, 501 after).
- `pnpm e2e` not run: no file in `apps/web` changed.
- The tests catch a wrong rule. Each break below, made alone and undone: a level counted only
  above 5, 11, 17 (`>`): 2 of 13 fail; the slot not minus the spell's level: 3 fail; the scaling
  joined to every damage: 1 fails.
- The values of §3, all true: `cantrip.upgrades` 0, 0, 1, 1 for goldens A, B4, C 2014, C 2024,
  with the step `level 6 → 1` on golden C; 0, 1, 1, 2, 2, 3, 3 for a fighter of levels 4, 5, 10,
  11, 16, 17, 20; Fire Bolt 1d10 to 4d10, 2d10 on golden C; Fireball 8d6 to 14d6.

Against §3: as written. Changed while building: `addDice` first wrote ` + ` after any base, which
changes a `?:` formula's meaning (`a ? b : c + 1d6` reads as `a ? b : (c + 1d6)`); a base whose top
binds less than `+` now goes in brackets, tested. The purity test copied the spell with
`structuredClone`, which the module's test settings refuse (ENG-42); it freezes in place.

Against the row: as the row. Its note held three things. ENG-08's: done, `addDice`. ENG-09's, a
spell's healing: a field of its own and a modifier only ENG-51 gives, so a new row, ENG-53.
ENG-16's, Shillelagh: its die changes faces, which `scaling` cannot hold (§8); the phase 3 note
says so now.

Found, not fixed:
- Growth `scaling` cannot hold (§8): SRD 5.1 Flame Blade and Spiritual Weapon (every two slot
  levels) and Flame Strike (the caster picks which damage grows); SRD 5.2.1 Eldritch Blast (beams),
  Shillelagh (a die that changes), Spare the Dying (range) and True Strike (extra damage with none
  at first). And 5e-database's 2024 spells have no table by slot. Noted for phase 3.
- A spell's healing: ENG-53.

Nothing for the changelog: no screen and no published file changes.

---

### ENG-52 A roll formula's average

**Hat:** A roll formula's average is computed, kept dice included
**Depends on:** ENG-07 (the formula language and its walker), ENG-08 (dice terms, `rollDice`),
ENG-16 (`diceOf`)
**Size:** S
**Screen:** No
**SPEC:** §5.6 (a roll formula is shown with its average); ADR 014 item 11 (the dice terms)

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/formula.ts` — changes: `averageOf(formula, read)`, the
average of a roll formula, walked on the same tree as `rollFormula`; the warning `notExact`.
- `packages/engine/src/dice.ts` — changes: `AVERAGE_LIMITS`; `averageOfDice(term)`, one term's
  average; `distributionOfDice(term, limit)`, how likely each total of one term is.
- `packages/engine/test/average.test.ts` — new.

#### 2. What is missing now

Measured on `main` at `7633984`:
- `grep -rn -i "averag\|mean" packages/engine/src` finds one line, ENG-16's comment on `diceOf`
  ("fixed damage amount"). No function gives a roll formula's average.
- A term that keeps some dice has no simple average: `2d20kh1`'s is 553/40 = 13.825, not
  `count × (faces + 1) / 2` = 21 (python3, every outcome of the two dice).
- A formula that puts dice under a function has no simple average either: `max(1, 1d6 - 3)`'s is
  3/2, and `max(1, 3.5 - 3)` is 1 (python3).
- `pnpm test`: `Test Files 43 passed (43)`, `Tests 481 passed (481)`.

#### 3. What it should look like when done

1. `@grimoire/engine` exports `averageOf`, `averageOfDice`, `distributionOfDice` and
   `AVERAGE_LIMITS` = `{ outcomes: 100000 }`.
2. **One term.** `averageOfDice(term)` is the term's exact average, for every term the parser
   allows (`DICE_LIMITS`), kept dice included. The control values, from python3 with fractions
   (every outcome where there are at most 100,000; a closed form or the order statistics past that):

   | Term | Average |
   |---|---|
   | `2d6` | 7 |
   | `1d20` | 10.5 |
   | `2d20kh1` | 553/40 = 13.825 |
   | `2d20kl1` | 287/40 = 7.175 |
   | `4d6kh3` | 15869/1296 ≈ 12.2445987654 |
   | `4d6kl3` | 11347/1296 ≈ 8.7554012346 |
   | `3d6kh3` | 10.5 (all three kept) |
   | `5d10kh2` | 63833/4000 = 15.95825 |
   | `5d10kl4` | 74833/4000 = 18.70825 |
   | `20d20kh10` | ≈ 152.5357142857 |
   | `9d20kh1` | ≈ 18.4625873439 |
   | `999d1000` | 499999.5 |
   | `999d1000kh1` | ≈ 999.4180987796 |
   | `999d1000kl1` | ≈ 1.5819012204 |
   | `999d6kh998` | ≈ 3495.5 |

   Each within 10⁻⁹ of the control.
3. **One term's chances.** `distributionOfDice(term, limit)` maps each total the term can give to
   its chance, in rising order; the chances add up to 1 within 10⁻¹²: `2d20kh1` gives 20 with
   39/400 and 1 with 1/400; `3d2` gives 3, 4, 5, 6 with 1/8, 3/8, 3/8, 1/8. Past `limit` it gives
   `undefined`: a term with no keep when one die added would pair more than `limit` totals with
   faces, a term that keeps when `faces ^ count` is above `limit` (`7d6kh3`: 279,936).
4. **A formula.** `averageOf(formula, read)` takes the text or a `ParsedRoll` and the reader of
   ENG-07. It returns `{ value, reads, warnings }` and never throws. `value` is the average of the
   numbers `rollFormula` gives over every face the dice can show, each outcome as likely as the
   dice make it. Control values, from python3 with fractions over every outcome (paths: `level` 5,
   `stats.grit.mod` 2, `gear.worn` true, `gear.shield` false):

   | Formula | Average |
   |---|---|
   | `1d10 + @level` | 10.5 |
   | `2d20kh1 + @stats.grit.mod` | 15.825 |
   | `2к6+3` | 10 |
   | `-1d4` | −2.5 |
   | `(2d6) * 2` | 14 |
   | `1d6 * 1d6` | 12.25 |
   | `1d6 / 2` | 1.75 |
   | `12 / 1d6` | 4.9 |
   | `(1d6 + 1d6) / (1d2)` | 5.25 |
   | `max(1, 1d6 - 3)` | 1.5 |
   | `max(1, 1d4 - 3)` | 1 |
   | `floor(1d6 / 2)` | 1.5 |
   | `round(1d4 / 2)` | 1.5 |
   | `clamp(2d6, 4, 10)` | 7 |
   | `abs(1d6 - 1d6)` | 35/18 ≈ 1.9444444444 |
   | `max(2d20kh1, 1d20)` | 1239/80 = 15.4875 |
   | `max(0, 4d6kh3 - 10)` | 3403/1296 ≈ 2.6257716049 |
   | `min(1d8, 1d8) + 1d4 * 2` | 131/16 = 8.1875 |
   | `1d20 >= 10` | 0.55 |
   | `!(1d4 == 1)` | 0.75 |
   | `1d4 == 1 \|\| 1d4 == 1` | 7/16 = 0.4375 |
   | `1d6 > 3 && @gear.worn` | 0.5 |
   | `1d20 >= 11 ? 2d6 : 0` | 3.5 |
   | `if(1d4 > 2, 1d6, -1d6)` | 0 |
   | `@gear.worn ? 1d6 : 1d8` | 3.5 |
   | `@gear.shield ? 1d6 : 1d8 + @level` | 9.5 |
   | `1d2 == 2 ? @level : @stats.grit.mod` | 3.5 |
   | `1d20 > 20 ? @level : 1` | 1 |

   Each within 10⁻⁹ of the control.
5. **Reads.** A path is read when some outcome reads it: `@gear.worn ? 1d6 : 1d8` reads
   `['gear.worn']`; `@gear.shield ? 1d6 : 1d8 + @level` reads `['gear.shield', 'level']`;
   `1d2 == 2 ? @level : @stats.grit.mod` reads both branches; `1d20 > 20 ? @level : 1` reads
   nothing (no face takes that branch); `0 && @level + 1d6` reads nothing.
6. **Warnings** are those some outcome meets, each once: `1d6 + @nothing` is 3.5 with one
   `missingPath`; `@gear.kind + 1d4` is 2.5 with one `wrongType` at 0; `max(0, 1d6 / 0)` is 0 with
   one `notFinite`. A formula that does not parse (`@level + 1d1`) gives 0, `reads` `[]`, the parse
   error as its one warning, and never calls the reader.
7. **Past the limit.** A part whose exact average needs a step of more than
   `AVERAGE_LIMITS.outcomes` outcomes gives the value it has with each term at its average, with
   one `notExact` warning `{ at, limit }` at that part: `max(1, 999d1000)` is 499999.5;
   `max(1, 9d20kh1)` is `averageOfDice` of `9d20kh1`. A path that only the abandoned walk read is
   not in `reads`: `max(0, 1d2 == 1 ? @level : 999d1000)` reads nothing.
8. **The rolls agree.** For each formula of item 4, and for every seeded formula of small dice
   (item 9) whose outcomes number at most 500, the average equals the mean of `rollFormula`
   over every outcome (each weighted by its chance) within 10⁻⁹, with the same set of paths read
   and the same set of warnings.
9. **Never throws.** 2,000 seeded roll formulas, half damaged as in ENG-08's run: `averageOf`
   gives a finite number for each.
10. A plain formula's average is its value: `@level * 2` gives 10, reads `['level']`, as
    `evaluateNumber` does. The same formula and reader give equal results twice.
11. The quality gate is green.

#### 4. How to do it

1. `dice.ts`: `AVERAGE_LIMITS`; `averageOfDice` (below); `distributionOfDice`, one die added at a
   time for a term with no keep, every outcome counted for a term that keeps.
2. `formula.ts`: the walker's arithmetic and its functions become methods the average can call
   (`Walk.numeric`, `Walk.call`), so the two walks share one meaning of each operator; `averageOf`
   walks the tree in two modes (below); `notExact` joins `FormulaWarning`.
3. `average.test.ts`: §7.

Technical choices (ADR 002):
- **The exact average, not the formula at each term's average.** The two agree while dice are
  only added, subtracted or multiplied; under a function, a comparison or a choice they do not
  (§2: 1.5 against 1). A screen that shows the exact number shows nothing that is wrong.
- **Two modes on one tree.** The tree holds each dice term once, so the dice of two branches of a
  node are independent. Where a node only adds, subtracts, negates or multiplies its parts, or
  divides by a part with no dice, or takes a choice whose test has no dice, its average comes from
  its parts' averages (the average of a sum is the sum of the averages; of a product of independent
  parts, the product). Anywhere else (a function, a comparison, `&&`, `||`, `!`, a choice whose
  test has dice, a divisor with dice) the node takes the chance of each value of its parts, and
  combines them pair by pair; a choice's branches each keep their own mode, weighted by the test's
  chance. A part with no dice is walked by ENG-07's walker as it is.
- **A kept term's average by counting, not by listing.** The sum of the `k` highest dice is the
  sum, over each face `x`, of how many kept dice show `x` or more: `min(k, N)`, `N` the number of
  dice at `x` or more, a binomial count. So the average is the sum over faces of `E[min(k, N)]`;
  `kl` is its mirror, `k × (faces + 1)` minus the same sum. The work is `faces × k` steps, 10⁶ at
  most, where listing the outcomes of `999d1000` cannot end. Past half the dice, the dropped ones
  are counted instead.
- **A limit on the exact walk.** A step that would pair more than 100,000 outcomes stops, and the
  part falls back to its value at each term's average, warned `notExact` (SPEC §8.2: a value and a
  warning, never a throw). The limit is one number in `AVERAGE_LIMITS`. What the abandoned walk
  read and warned is taken back, so `reads` names what the fallback read.
- **No rounding.** The average is a number with its fraction (7.5); how a screen writes it is the
  screen's.
- **A warning once.** An exact walk meets a value many times (a division by 0 for each face); the
  result lists each warning once, as a roll does.

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/average.test.ts` — `describe('ENG-52 a roll formula's average')`: §3
  items 1–10; the rolls' oracle of item 8 enumerates every outcome through `rollFormula` with a
  scripted die, so it shares no code with `averageOf`.
- Control values from: python3 3 with `fractions` (every outcome enumerated; `9d20kh1`,
  `999d1000kh1`, `999d1000kl1`, `999d6kh998` by the closed forms of the highest and lowest die;
  `20d20kh10` by the order statistics, a sum the code does not use), never from the new code.
  Paths and values are made up.

#### 8. Checked against the source

Nothing to check: no rules fact is used. SPEC §5.6 says a roll formula is shown with its average;
what an average is, is arithmetic. A level's fixed hit points "by average" (SPEC §6.7 B4) are a
rules value of the fifth-edition module (`hitPointsOf`, ENG-14), not this function.

#### 9. Not in this ticket

- How the screen writes the average (a fraction, rounded, `1к20` or `1d20`): phase 2's dice and
  sheet.
- Advantage, disadvantage and critical dice on a roll: ENG-34, whose `2d20kh1` this averages.
- A count of dice that grows with level (`ceil(@level / 2)d6`): ENG-50.
- Using the average anywhere in `compute()`: no golden reads one; a level's hit points by average
  are ENG-14's `hitPointsOf`.
- The chance of a roll reaching a number (to hit a given AC): no row asks for it;
  `distributionOfDice` is the piece it would build on.

#### 10. Rake check

- **`packages/engine` is pure TypeScript.** The new code is arithmetic on the parsed tree; no
  import beyond the engine's own files.
- **Formulas never run code; limits.** The average walks the same frozen tree; the parse limits of
  ENG-07 and ENG-08 hold, and the exact walk has its own limit.
- **Missing is not broken.** A missing path is 0 with a warning, a part past the limit a value
  with a warning, a formula that does not parse 0 with its error. Nothing throws.
- **`compute()` is pure and deterministic.** `averageOf` changes nothing it is given and has no
  randomness; equal inputs give equal results.
- **The core names no game.** No stat, die or rule of a game is in the code; test paths are made
  up.
- **Measure, never estimate.** Every expected value is python3's, with fractions.
- **Licensing.** No rules text.

#### 11. What came out of it

Measured on 2026-10-02, built on `7633984`, then rebased onto `7997fbb` (after ENG-22, ENG-49,
ENG-36 and ENG-50) and measured again there:
- `pnpm lint`: `Checked 161 files`, no errors. `pnpm typecheck`: 6 projects, all `Done`.
- `pnpm test`: `Test Files 46 passed (46)`, `Tests 545 passed (545)`, 7.84 s. Without
  `average.test.ts`: 45 files, 534 tests. This ticket's 11 are in `average.test.ts`: 11 passed,
  2.40 s. (On `7633984`: 481 tests before, 492 after.)
- No file in `apps/web` changed, so `pnpm e2e` was not run.
- Every control value of §3 items 2 and 4 is met within 10⁻⁹. The largest gap measured on a term:
  `999d1000kl1` gives 1.581901220366717 against python3's 1.581901220366367 (3.5 × 10⁻¹³).
- The rolls' oracle (§3 item 8): the 28 formulas of item 4 agree, and 1,716 of the 2,000 seeded
  formulas were compared, value, paths read and warnings each the same set (a formula that does
  not parse is compared too: one outcome, 0 and its error). 67 fell back past the limit; the other
  217 have more than 500 outcomes.
- Time, one run each: `999d1000kh500` 16.49 ms, `999d1000kh499` 13.04 ms, `999d1000kl1` 0.07 ms,
  `max(0, 4d6kh3 - 10)` 3.90 ms, `max(1, 12d10 * 12d10 * 12d10)` (a fallback) 8.92 ms. The 2,000
  seeded averages together: 159 ms.
- The tests bite. Each guard broken on its own, `average.test.ts` run (11 tests): `kl` without its
  mirror, 3 fail; the dropped dice counted with `faces` for `faces + 1`, 3; no case for a face every
  die reaches, 3; the keep order reversed in the chances, 4; a divisor with dice averaged as a
  number, 3; every part sent to the fallback, 4; nothing taken back after a fallback, 1; warnings
  not made unique, 1; a choice's chances swapped, 3; the right side of `&&` and `||` always walked,
  2; no exact 0 and 1 for a test's chances, 1; no limit on pairing two parts, 1 (with the two
  cases added below; before them, 0).

Differences from §3:
- Item 8 first said seeded formulas of at most 20,000 outcomes. The oracle then took 46 s, most of
  it parsing the text again for every outcome; it now parses once and compares formulas of at most
  500 outcomes (1.4 s). Item 8 says 500.
- Item 7 gained two cases, so the limit on pairing is tested: `max(1, 12d10 * 12d10 * 12d10)` gives
  66³ = 287496, and `max(12d10, 12d10, 12d10)` gives 66, each with `notExact` at 0 (python3: the
  product of two pairs 11,881 and gives 3,788 values, which with a third pair 412,892; three
  arguments pair 109³ = 1,295,029).

Against the row: as the row says. The walker's arithmetic and functions became two methods
(`Walk.numeric`, `Walk.call`) that the average calls, so one operator has one meaning; no result of
`evaluateFormula` or `rollFormula` changed (their tests pass unchanged).

Found, not fixed: nothing.

Nothing for the changelog: no screen shows the average yet.

---

### ENG-19 The edition files

**Hat:** The ruleset files hold every 2014/2024 rules difference
**Depends on:** ENG-15 (`rulesets/`, `EditionRules`, `rulesOf`), ENG-16 (`fixedDamageModifier`,
`ATTACK_STATS`), ENG-33 (`houseRulesSchema`, `bonusSource`, `inspiration`), ENG-14 (`hp.max`,
`speed.all.mul`), ENG-30 (`setCondition`, `removeCondition`), ENG-10 (golden D, the 2024
exhaustion)
**Size:** M
**Screen:** No
**SPEC:** §6.3 (every row, each `[ПРОВЕРИТЬ]`, §8); §6.4 (rests); §6.7 golden D; §8.4 (the house
rules' defaults, "by the SRD"); §5.4 (`hp.max.*`, `speed.all.mul`); ADR 004; ADR 009 item 5 and
ADR 014 item 8 (inspiration)

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/rulesets/edition-rules.ts` — changes: `EditionRules` gains
the differences SPEC §6.3 and the closed tickets name; its comment lists the rows that are data.
- `packages/system-5e/src/rulesets/2014.ts`, `rulesets/2024.ts` — change: each new field's value,
  with the SRD sentence it comes from.
- `packages/system-5e/src/character.ts` — changes: `DEFAULT_HOUSE_RULES`, the house rules a new
  character is written with.
- `packages/system-5e/src/combat.ts` — changes: `hp.max.mul`, the hit point maximum's multiplier,
  a target for 2014 exhaustion's level 4.
- `packages/system-5e/test/rulesets.test.ts` — new: each edition's values, the house rules'
  defaults.
- `packages/system-5e/test/exhaustion.test.ts` — new: both editions' exhaustion as data, level by
  level.
- `packages/system-5e/test/combat.test.ts` — changes: the multiplier's step in `hp.max`.
- `packages/system-5e/test/golden/golden-values.test.ts` — changes: golden D's last lines.
- `docs/tickets/BACKLOG.md` — the notes of ENG-21, ENG-34, ENG-35, ENG-46, phase 2; a new row for
  the house rule `abilityMax` (§4).

#### 2. What is missing now

Measured on `main` at `7633984`:
- `EditionRules` has two fields, `halfCasterRounding` and `fixedDamageModifier`. SPEC §6.3's other
  rows have no place: the words for a species and for inspiration, whose ability increases count,
  the hit dice a long rest gives back, what inspiration does and how much of it a character holds.
- `grep -rn "houseRules" packages/system-5e/src` finds only the schema and its inspiration check:
  no default house rules exist, so nothing can write a new character's.
- `grep -rn "hp.max.mul" packages` finds nothing. Measured with golden A and a 2014 exhaustion at
  level 4 (`mul 0.5` on `speed.all.mul` from level 2, on `hp.max.mul` from level 4): speed 12,
  hit points 12, and the warning `noTarget`: `"srd-2014:condition/exhaustion#hp-halved" changes
  hp.max.mul, which the character has no value for; it is not applied.` The SRD says 6 (§8).
- No 2014 exhaustion is tested; the 2024 one only at level 2 (golden D).
- Golden D's last line, "removing the condition gives golden B's values back", is checked by
  computing golden B beside it, not by removing the condition. Its "every d20 test −4" is checked
  on Athletics, the Strength save, the greatsword and initiative only.
- The note under the backlog: `statDefaults` is one value for every character, so the house rule
  `abilityMax` is read by no code (found by ENG-13).
- `pnpm test`: `Test Files 43 passed (43)`, `Tests 481 passed (481)`.

#### 3. What it should look like when done

1. **`EditionRules` holds each difference** (§8 has every source), each edition's file giving
   every field:

   | Field | 2014 | 2024 | What it is |
   |---|---|---|---|
   | `terms.species` | `race` | `species` | The word for a species: an i18n key's last part |
   | `terms.lineage` | `subrace` | `lineage` | The word for a lineage |
   | `terms.inspiration` | `inspiration` | `heroicInspiration` | The word for inspiration |
   | `abilityBonusSource` | `species` | `background` | Whose ability increases a new character takes |
   | `inspiration.max` | 1 | 1 | The most inspiration the SRD lets a character hold |
   | `inspiration.use` | `advantage` | `reroll` | What spending it does |
   | `longRestHitDice` | 0.5 | 1 | The share of its hit dice a long rest gives back, rounded down, at least 1 |
   | `hitDieMinimum` | 0 | 1 | The fewest hit points one hit die spent gives |
   | `heavyWeapon` | `{ by: 'size', sizes: ['small'] }` | `{ by: 'score', min: 13 }` | Who has disadvantage with a Heavy weapon |
   | `halfCasterRounding` | `down` | `up` | ENG-15, unchanged |
   | `fixedDamageModifier` | `true` | `false` | ENG-16, unchanged |

   `rulesOf` gives the 2014 values to a 2014 character and the 2024 values to a 2024 one.
2. **The rows of SPEC §6.3 that are data** get no field: a class's subclass level (its own
   `subclassLevel`), exhaustion (each SRD's own condition entity), the origin feat (a background's
   grant), feat categories (a feat's `category`), weapon mastery (ENG-16), spell preparation
   (ENG-15). `edition-rules.ts` lists them, so a reader looking for them finds where they are.
3. **`DEFAULT_HOUSE_RULES`** is one value for both editions, measured equal in both SRDs (§8):
   `hitPointMethods: ['roll', 'avg']`, `abilityMax: 20`, `feats: 'own'`, `multiclass: true`,
   `encumbrance: 'simple'`, `skillAbilitySwap: false`, `inspirationMax: 3` (the owner's default,
   ADR 009 item 5). `houseRulesSchema` accepts it. Golden B written with it opens with inspiration
   3, and inspiration 4 is refused on `systemData.state.inspiration`.
4. **`hp.max.mul`**: 1 for every character, one step `{ kind: 'rule', rule: 'hitPointsMultiplier',
   value: 1, change: 1 }`; effects change it. `hp.max` is its parts' sum × the multiplier, rounded
   down, and its breakdown ends with `{ kind: 'path', path: 'hp.max.mul', value: <mul>, change:
   <value − sum> }`. Golden A, B4 and the made-up characters of ENG-14 keep their hit points; their
   breakdowns gain that last step with a change of 0.
5. **2014 exhaustion is data.** Test data written from SRD 5.1's table (§8), on golden A (speed
   25, hit points 12): levels 0 to 6 give speed 25, 25, 12, 12, 12, 0, 0 and hit points 12, 12,
   12, 12, 6, 6, 6; `d20.all.bonus` 0 at every level. Its `disadvantage` effects (levels 1 and 3)
   change no number and give no warning. No level gives a warning. Removing it gives golden A's
   values and breakdowns back.
6. **2024 exhaustion is data.** The 2024 fixture's condition on golden B (speed 30, hit points
   12): levels 1 to 6 give `d20.all.bonus` −2, −4, −6, −8, −10, −12 and speed 25, 20, 15, 10, 5,
   0; hit points 12 at every level; no warning.
7. **Golden D is whole** (SPEC §6.7):
   - every d20 test of D is golden B's − 4: each stat's save, each stat's check, each skill, the
     greatsword's attack, initiative;
   - every speed of D is golden B's − 10 (walking 20; the others 0 in both);
   - the greatsword's damage, the hit point maximum and AC are golden B's;
   - golden B given exhaustion 2 with `setCondition` computes golden D's values and breakdowns;
     then `removeCondition` gives golden B's values and breakdowns back.
8. **No golden value changes.** Every golden computes with no warning, and each breakdown adds up.
9. The quality gate is green.

#### 4. How to do it

1. `edition-rules.ts`: the fields of §3 item 1, each with its doc comment; the comment at the top
   lists the data rows of §3 item 2.
2. `2014.ts`, `2024.ts`: the values, each with the SRD's words (§8).
3. `character.ts`: `DEFAULT_HOUSE_RULES`, beside `houseRulesSchema`.
4. `combat.ts`: `hp.max.mul` among the combat steps; `hitPoints` reads it last.
5. Tests (§7). Then the backlog notes (§11).

Technical choices (ADR 002):
- **A field holds a rule's value, not code.** Each is a number, a key or a small record that the
  reading ticket turns into its computation, as ENG-15's `halfCasterRounding` is read through a
  map in `spellcasting.ts`. No function is added here that only a later ticket calls: a rest is
  ENG-21's, a roll mode ENG-34's, the bonus source ENG-35's, the screens phase 2's.
- **Only differences go in the edition files.** The house rules' defaults were measured equal in
  both SRDs (§8), so they are one constant in `character.ts`, as ENG-15 kept the multiclass table
  one constant. A default that comes to differ moves into the edition files.
- **`inspiration.max` is in the edition files though both are 1**: ADR 009 item 5 asks for "the
  ruleset default" shown next to the house rule, so the screen reads it from the character's
  edition. The house rule's default stays the owner's 3.
- **`feats: 'own'` in both editions.** SRD 5.1 calls feats "the optional feats rule"; SRD 5.2.1
  makes them part of every character. The default follows ADR 013 item 9's first option ("only its
  own ruleset's") and dnd5e's `allowFeats: true` (§8); `none` is the house rule of a table that
  turns the optional rule off. One value to reverse.
- **`hp.max.mul` mirrors ENG-14's `speed.all.mul`**: a multiplier path, 1 by default, applied last
  and rounded down. SPEC §5.4's catalog lists `hp.max.bonus` only; halving needs a multiplier,
  since an effect on `hp.max` reading `hp.max` is a loop. Rounding down is SRD 5.2.1's general
  rule and dnd5e's for both editions (§8). The step is always in the breakdown, as the speed's is.
- **The 2014 exhaustion is test data**, not added to the golden pack: ENG-09's pack holds what
  goldens A and C need, and no golden has a 2014 exhaustion. Its `disadvantage` effects target
  `roll.check.all`, `roll.attack.all` and `roll.save.all`; roll modes are ENG-34's, and SPEC
  §5.4's catalog has `roll.check.<ability>`, not `.all` (noted on ENG-34).
- **The heavy-weapon rule is held, not applied**: ENG-34 owns roll modes; the backlog marks it an
  edition difference for this row (found by ENG-16). In 2024 the stat is the weapon kind's,
  `ATTACK_STATS` (melee `str`, ranged `dex`).
- **The shield's 2024 training rule is not added**: ENG-46's note owns it, with the armor-training
  penalties it builds and checks.
- **The house rule `abilityMax` becomes a row of its own** (ENG-54): making a house rule cap the
  stats changes the core's `statDefaults`, which is one value for every character. That is a hat
  of its own ("the house rule's highest score caps every stat"), not an edition difference.

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table. `DEFAULT_HOUSE_RULES` is a
value a new character will be written with; no character is written yet.

#### 6. What a person will see

Not a screen. The words (`terms`) and inspiration's rule are read by phase 2's screens (§9).

#### 7. Tests

- `packages/system-5e/test/rulesets.test.ts` — `describe('ENG-19 the edition files')`: §3 items 1
  to 3.
- `packages/system-5e/test/exhaustion.test.ts` — `describe('ENG-19 exhaustion is data in both
  editions')`: §3 items 5 and 6.
- `packages/system-5e/test/combat.test.ts` — `describe('ENG-19 the hit point multiplier')`: §3
  item 4: the default step, an effect halving an odd maximum (rounded down), an override.
- `packages/system-5e/test/golden/golden-values.test.ts` — `describe('ENG-19 goldens: golden
  D')`: §3 item 7.
- Control numbers from: SPEC §6.7 (golden D); the SRD texts of §8 (each edition's value, both
  exhaustion tables); the levels worked out by hand from them before the tests ran.

#### 8. Checked against the source

Sources, read 2026-10-02: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
`packages/5e-database/src/{2014,2024}/en/`, read with `jq`; foundryvtt/dnd5e at
`7bfb3f1c03e107bf65942151ef08d50ddb01ba8a`, `module/`, and `packs/_source/rules` (SRD 5.1) and
`packs/_source/content24` (SRD 5.2.1), which quote the SRDs (CC-BY-4.0). The same commits as
ENG-13 to ENG-16.

**SPEC §6.3, "Термин" (`[ПРОВЕРИТЬ]`).** SRD 5.1: 5e-database 2014 has `5e-SRD-Races.json` and
`5e-SRD-Subraces.json` (13 uses of "subrace" in the races file). SRD 5.2.1: `5e-SRD-Species.json`;
its traits say "Choose a lineage from the Elven Lineages table" and the Gnome's "when you select
the lineage". The SPEC row agrees: race and subrace; species and lineage. ENG-32 named both
entity types `species` and `lineage`, so only the words differ.

**SPEC §6.3, "Повышение характеристик" (`[ПРОВЕРИТЬ]`).** SRD 5.1: the dwarf's
`ability_bonuses` `[{ con, 2 }]`; no 2014 background has ability fields (Acolyte's keys have none).
SRD 5.2.1 (`chapter-2/character-creation.yml`, Step 3): "adjust them according to your background.
Your background lists three abilities; increase one of those scores by 2 and a different one by 1,
or increase all three by 1. None of these increases can raise a score above 20." Soldier's
`ability_scores`: `str`, `dex`, `con`; no 2024 species has an ability field. The SPEC row agrees.

**SPEC §6.3, "Уровень подкласса" (`[ПРОВЕРИТЬ]`).** 5e-database `5e-SRD-Levels.json`, the first
level with a `subclass` per class: 2014, cleric, sorcerer, warlock 1; druid, wizard 2; barbarian,
bard, fighter, monk, paladin, ranger, rogue 3. 2024: all twelve 3. The SPEC row agrees. The
fixtures' `subclassLevel`s match: 2014 cleric 1, wizard 2, paladin 3; 2024 fighter, wizard,
paladin 3. Data, no field.

**SPEC §6.3, "Черта на старте", "Категории черт", "Оружейное мастерство", "Подготовка
заклинаний".** Data: the 2024 Soldier's `feat` `savage-attacker` (a background's grant, ENG-10); a
feat's `category` (ENG-32); weapon mastery ENG-16 §8; spell preparation ENG-15 §8.

**SPEC §6.3, "Истощение" (`[ПРОВЕРИТЬ]`).** SRD 5.1 (`5e-SRD-Conditions.json`, `exhaustion`):
"1 - Disadvantage on ability checks", "2 - Speed halved", "3 - Disadvantage on attack rolls and
saving throws", "4 - Hit point maximum halved", "5 - Speed reduced to 0", "6 - Death"; "A creature
suffers the effect of its current level of exhaustion as well as all lower levels." SRD 5.2.1
(the same file, 2024; `rules-glossary.yml`, Exhaustion): "You die if your Exhaustion level is 6";
"When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level"; "Your Speed is
reduced by a number of feet equal to 5 times your Exhaustion level." The SPEC row agrees. dnd5e
(`settings.mjs`, `applyLegacyRules`): `noMovement` at `exhaustion-5`, `halfMovement` at
`exhaustion-2`, `halfHealth` at `exhaustion-4`; `attributes.mjs` `prepareHitPoints`: `hp.max *=
0.5`, then `Math.floor`. Rounding: SRD 5.2.1 (`chapter-1/playing-the-game.yml`, Round Down):
"Whenever you divide or multiply a number in the game, round down if you end up with a fraction".
SRD 5.1 has no such sentence (no "round down" in `5e-SRD-Rules.json` but the modifier table);
dnd5e floors in both editions. ENG-14 already rounds a halved speed down.

**SPEC §6.3, "Продолжительный отдых: кости хитов" (`[ПРОВЕРИТЬ]`).** SRD 5.1 (`rules`, Long Rest):
"The character also regains spent Hit Dice, up to a number of dice equal to half of the
character's total number of them (minimum of one die). For example, if a character has eight Hit
Dice, he or she can regain four spent Hit Dice". SRD 5.2.1 (`rules-glossary.yml`, Long Rest):
"Regain All HP. You regain all lost Hit Points and all spent Hit Point Dice." The SPEC row agrees.
dnd5e (`actor.mjs`, `_getRestHitDiceRecovery`): `fraction ??= rulesVersion === "modern" ? 1 : 0.5`;
`hit-dice.mjs`: `Math.max(Math.floor(this.max * fraction), 1)`. SRD 5.2.1's Long Rest also says
"If your Hit Point maximum was reduced, it returns to normal" and "If any of your ability scores
were reduced, they return to normal"; SRD 5.1's Long Rest says neither. No tracker stores a reduced
maximum or score yet, so no field holds it (§11).

**A rest difference SPEC §6.3 does not list: one hit die's minimum.** SRD 5.1 (Short Rest): "the
player rolls the die and adds the character's Constitution modifier to it. The character regains
hit points equal to the total." SRD 5.2.1 (Short Rest): "roll the die and add your Constitution
modifier to it. You regain Hit Points equal to the total (minimum of 1 Hit Point)." dnd5e
(`rollHitDie`): `const minimumValue = rulesVersion === "modern" ? 1 : 0`. Both editions: a long
rest lowers exhaustion by 1 (2014 "provided that the creature has also ingested some food and
drink"); the same rule, no field.

**SPEC §6.3, "Вдохновение" (`[ПРОВЕРИТЬ]`; ADR 009 item 5, ADR 014 item 8).** SRD 5.1
(`rules/appendix-e-rules.yml`, Inspiration, embedded in chapter 4): "You either have inspiration
or you don't—you can't stockpile multiple “inspirations” for later use." "If you have inspiration,
you can expend it when you make an attack roll, saving throw, or ability check. Spending your
inspiration gives you advantage on that roll." SRD 5.2.1 (`rules-glossary.yml`, Heroic
Inspiration): "If you (a player character) have Heroic Inspiration, you can expend it to reroll
any die immediately after rolling it, and you must use the new roll. If you gain Heroic
Inspiration but already have it, it’s lost unless you give it to a player character who lacks it."
So both SRDs allow 1, fewer than the owner's 3. ADR 009 item 5 already says what happens then: "the
default of 3 is a house setting and the ruleset default is shown next to it". No stop.

**The heavy-weapon rule (found by ENG-16).** 5e-database `5e-SRD-Weapon-Properties.json`, `heavy`:
2014 "Small creatures have disadvantage on attack rolls with heavy weapons." 2024 "You have
Disadvantage on attack rolls with a Heavy weapon if it's a Melee weapon and your Strength score
isn't at least 13 or if it's a Ranged weapon and your Dexterity score isn't at least 13."

**The house rules' defaults (SPEC §8.4, "by the SRD").**
- Hit points per level. SRD 5.1 (`chapter-1-beyond-1st-level.yml`): "Roll that Hit Die … or
  Alternatively, you can use the fixed value shown in your class entry". SRD 5.2.1 (Gaining a
  Level): "Roll that die … Instead of rolling, you can use the fixed value". Both `roll`, `avg`.
- Highest score. SRD 5.1: "You can't increase an ability score above 20." SRD 5.2.1: "None of
  these increases can raise a score above 20." Both 20.
- Feats. SRD 5.1 (`chapter-6-customization-options.yml`): "Using the optional feats rule, you can
  forgo taking that feature to take a feat of your choice instead." SRD 5.2.1: an origin feat from
  every background. dnd5e `allowFeats` default `true`. Both `own` (§4).
- Multiclassing. Both SRDs: "With this rule, you have the option of gaining a level in a new class
  whenever you advance in level". Neither calls it optional. Both `true`.
- Encumbrance. SRD 5.1 (Lifting and Carrying): "Your carrying capacity is your Strength score
  multiplied by 15"; "The rules for lifting and carrying are intentionally simple. Here is a
  variant". SRD 5.2.1 (Carrying Capacity): the size and Strength table, no variant. Both `simple`.
- A skill with another ability. SRD 5.1: "Variant: Skills with Different Abilities". SRD 5.2.1
  (`d20-tests.yml`, Skill Proficiencies): the table notes "the ability check the skill most often
  applies to"; "The GM has the ultimate say on whether a skill is relevant". Neither gives the
  player the swap. Both `false`.
- Inspiration: the owner's 3 (above).

No golden value looks wrong; nothing stops.

#### 9. Not in this ticket

- A rest that gives hit dice and hit points back: ENG-21, reading `longRestHitDice` and
  `hitDieMinimum`.
- Advantage, disadvantage and the Heavy property's disadvantage: ENG-34, reading `heavyWeapon`.
  What spending inspiration does to a roll: phase 2's dice, reading `inspiration.use`.
- The ability bonus source chosen and applied: ENG-35, its default `abilityBonusSource`.
- A shield without training in 2024, armor without training: ENG-46, which adds its own field.
- The house rule `abilityMax` read by the stats: ENG-54 (new row, §4).
- The screens' words and the inspiration stars: phase 2, reading `terms` and `inspiration`.
- Death at exhaustion 6: the same rule in both editions, no number; the sheet shows it (phase 2).
- A subclass chosen below its class's `subclassLevel` gives no warning: noted for phase 4, whose
  level-up wizard offers it (§11).

#### 10. Rake check

- **The golden tests are the truth.** No golden value changes; golden D's lines are SPEC §6.7's,
  and the exhaustion levels are worked out from the SRD tables of §8 before the run.
- **Each system's rules live in its own module; no `if (ruleset === …)`.** Every difference is a
  field of `rulesets/2014.ts` and `rulesets/2024.ts`, read through `rulesOf`; no code tests an
  edition.
- **Everything is data.** Exhaustion stays a condition entity in each edition; the 2014 one is
  effects with `when`, as SPEC §6.3 says. The heavy rule names a size key and a score, no stat.
- **`compute()` is pure; a number with no breakdown entry is a bug.** `hp.max.mul` has its step,
  and `hp.max` names it; every breakdown adds up.
- **Manual overrides always win.** `hp.max.mul` is finished by ENG-17's phases, tested with an
  override.
- **Missing is not broken.** A `roll.*` disadvantage is left alone with no warning (ENG-17).
- **Licensing.** The 2014 exhaustion is numbers and names from SRD 5.1 (CC-BY-4.0), no rules
  text; §8 quotes the SRDs only.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-02, on `main` at `7633984`:
- `pnpm lint`: `Checked 157 files`, no errors (155 before; 2 new test files).
- `pnpm typecheck`: 6 projects, all `Done`.
- `pnpm test`: `Test Files 45 passed (45)`, `Tests 496 passed (496)`, 7.22 s (before: 43 files,
  481 tests). This ticket's 15: 5 in `rulesets.test.ts`, 4 in `exhaustion.test.ts`, 3 in
  `combat.test.ts`, 3 golden D lines. The two new files alone: 9 tests, 786 ms.
- `pnpm build`: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- ENG-22, ENG-49, ENG-36, ENG-50 and ENG-52 reached `main` while this ticket was built; it was
  rebased onto `44c1b5a`. There: `pnpm lint` `Checked 163 files`, no errors; `pnpm typecheck` 6
  projects `Done`; `pnpm test` `Test Files 48 passed (48)`, `Tests 560 passed (560)`, 8.15 s
  (`main` alone, measured: 46 files, 545 tests); `pnpm build` `Done`.
- 2014 exhaustion on golden A, levels 0 to 6: speed 25, 25, 12, 12, 12, 0, 0; hit points 12, 12,
  12, 12, 6, 6, 6; `d20.all.bonus` 0; no warning at any level. Level 5's `speed.all.mul` steps:
  the rule's 1, `#speed-halved` −0.5, `#no-speed` −0.5. Removed with `removeCondition`, golden A's
  values and breakdowns come back. In §2 the same level 4 gave hit points 12 and `noTarget`.
- 2024 exhaustion on golden B, levels 1 to 6: `d20.all.bonus` −2 to −12, speed 25 to 0 by 5,
  hit points 12; no warning.
- Golden D: golden B has 32 d20 tests (6 saves, 6 checks, 18 skills, the greatsword, initiative),
  each 4 lower in D. Walking speed 20 (B 30), the other four speeds 0 in both; greatsword damage
  3, hit points 12, AC 17 in both. Golden B given exhaustion 2 with `setCondition` computes D's
  values and breakdowns; `removeCondition` then gives B's.
- The tests bite. 22 breaks, each on its own and restored, the `system-5e` tests run (174
  tests): each edition value changed on its own (the bonus source, a word, inspiration's maximum
  and use, the hit dice share, the hit die minimum, the heavy rule; 12 breaks over both files):
  1 fails each; `rulesOf` always 2014: 7; the house rules' inspiration 1: 2; `feats: 'none'`: 1;
  `encumbrance: 'none'`: 1; the maximum not rounded: 1; rounded up: 1; the multiplier ignored: 3;
  its step dropped: 4; its default 2: 12; no multiplier path: 61.

Differences from §3: none in values. The three ENG-14 tests of `hp.max`'s breakdown gained the
multiplier's last step (`value: 1, change: 0`); no number changed. After the rebase, one test of
ENG-36 (`level-up.test.ts`, "raises the current hit points in whole points") failed: its made-up
feat adds half a hit point a level, and it expected a maximum of 12.5. With §3 item 4 the maximum
is rounded down, so 12 at level 1 and 21 at level 2 (10 + 6 + 2 × 2 + 1), a rise of 9: current hit
points 12 → 21, where it expected 20. The value was worked out again by hand and changed, with its
comment; it is not a golden value. Rounding the maximum down always is SRD 5.2.1's Round Down and
dnd5e's `Math.floor(hp.max)` (§8). The golden values file's
header now says which golden lines are still open and where the fixture tests hold the scores and
Second Wind's uses.

Against the row and its note:
- The ability increase source is `abilityBonusSource`. The subclass level is data
  (`subclassLevel`), checked in §8. Exhaustion is data in both editions, tested level by level.
  Rests: `longRestHitDice`, and `hitDieMinimum`, a difference SPEC §6.3 does not list.
  Inspiration: `terms.inspiration`, `inspiration.max`, `inspiration.use`.
- Inspiration's SRD text (ADR 014 item 8) is in §8 and was shown to the owner in the chat. Both
  SRDs allow 1. ADR 009 item 5 already decides that case: the owner's 3 is the house rule's
  default, and the edition's 1 is shown next to it. No stop.
- The house rules' defaults are one constant, `DEFAULT_HOUSE_RULES`, not each ruleset's: §8
  measured them equal. The one judgment is `feats: 'own'` for 2014, where SRD 5.1 calls feats
  optional (§4); changing it is one value.
- Golden D is whole. The row's note said goldens A to D would be whole by ENG-19; that assumed
  ENG-34 first. ENG-19 was taken before ENG-51 and ENG-34, which come before it in the backlog,
  so B4's two "with advantage" lines stay ENG-34's and Second Wind back on a rest stays ENG-21's;
  their notes say so.
- `fixedDamageModifier` stays as ENG-16 made it. The Heavy property's rule (found by ENG-16) is
  in. The shield's 2024 training rule is left to ENG-46 (§4).
- The house rule `abilityMax` is a new row, ENG-54, with the note that was ENG-19's.

Found, not fixed:
- SPEC §5.4's roll targets have `roll.check.<ability>` and no `roll.check.all`, which 2014
  exhaustion's level 1 needs without naming a stat. Noted on ENG-34.
- A subclass chosen below its class's `subclassLevel` gives no warning, and its spellcasting
  counts. Noted for phase 4.
- SRD 5.2.1's long rest also restores a reduced hit point maximum and reduced ability scores;
  SRD 5.1's does not say so (§8). No tracker stores either reduction. Noted on ENG-21.
- Exhaustion 6 is death in both editions and gives no number. Noted for phase 2, with the words
  and inspiration's rule the sheet reads.

Nothing for the changelog.

---

### ENG-51 A spell a grant gives with its own stat

**Hat:** A spell a grant gives with its own stat has its casting numbers
**Depends on:** ENG-15 (`spellcastingSteps`, the class's DC and attack, the two bonus targets),
ENG-32 (the `spell` grant's `ability`), ENG-11 (`Gathered.grants`, the grants that apply), ENG-16
(the `attack.<kind>.bonus` targets), ENG-17 (effects and overrides on any path)
**Size:** S
**Screen:** No
**SPEC:** §5.5 (`spell` grant: `ability`); §5.4 (`attack.<weapon.melee | weapon.ranged | spell>.bonus`,
`spell.dc.bonus`, `spell.attack.bonus`); §6.1 step 5 (spell save DC and attack bonus); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/spellcasting.ts` — changes: `ATTACK_SPELL_BONUS_PATH`,
`statSpellPath`, `grantCastingStat`; a stat's casting steps, shared by a class's and a stat's;
`spellcastingSteps` gives the new paths.
- `packages/system-5e/test/grant-casting.test.ts` — new.
- `packages/system-5e/test/spellcasting.test.ts` — changes: a spell attack's breakdown has the new
  part; the paths of a character who casts nothing include `attack.spell.bonus`.
- `packages/system-5e/test/golden/golden-values.test.ts` — changes: golden D's list of d20 tests
  names a stat's spell attack too.
- `docs/tickets/BACKLOG.md` — the notes of ENG-53 and phase 3; the new row ENG-55 (§9).

#### 2. What is missing now

Measured on `main` at `4df11a3`:
- `grep -rn "\.ability" packages/system-5e/src/spellcasting.ts` finds only `def.ability`, a class's
  stat. No code reads a `spell` grant's `ability`: `git grep -n "grant.ability"` in `packages/`
  finds nothing.
- So a spell a feat or a species gives with its own stat (SRD 5.1's High Elf cantrip, Intelligence;
  Infernal Legacy, Charisma) has no save DC and no attack bonus: the test entity feat
  `hb-test:feat/steady-hands` (`ability: 'san'`, `test/entities.ts`) has none.
- `git grep -n "attack.spell" packages/` finds nothing: SPEC §5.4's `attack.spell.bonus` is no
  path, so an effect on it warns `noTarget`. ENG-15's spell attack adds `spell.attack.bonus` only.
- `pnpm test`: `Test Files 48 passed (48)`, `Tests 560 passed (560)` (ENG-19 §11, measured on
  `44c1b5a`; `4df11a3` is ENG-19's own commit).

#### 3. What it should look like when done

1. **A stat a grant names.** Each stat a `spell` grant that applies names in its `ability` (once
   per stat, in the order the grants are reached) gives:
   - `abilities.<stat>.spell.dc` = 8 + `abilities.<stat>.mod` + `prof` + `spell.dc.bonus`;
   - `abilities.<stat>.spell.attack` = `abilities.<stat>.mod` + `prof` + `spell.attack.bonus` +
     `attack.spell.bonus` + `d20.all.bonus`.
   The breakdown is the class's (ENG-15): the 8 a `rule` step `spellDcBase`, each part a `path`
   step. A grant that does not apply yet (`atLevel` above the character's level) gives nothing; a
   grant with no `ability` gives nothing (its spells are its class's, §4).
2. **`attack.spell.bonus`** is 0 for every character, a target for effects (SPEC §5.4), and every
   spell attack adds it: each class's `classes.<key>.spell.attack` and each stat's. Its place in
   the breakdown is after `spell.attack.bonus`, before `d20.all.bonus`.
3. **Where a grant's numbers are.** `grantCastingStat(grant)` gives the stat a `spell` grant's
   spells are cast with, its `ability`, or `undefined` (another kind of grant, or none named);
   `statSpellPath(stat)` gives `abilities.<stat>.spell`, whose `.dc` and `.attack` §3 item 1 gives.
4. **Control values, worked out by hand** (golden A, 2014: CHA 12 → +1, INT 8 → −1, proficiency
   +2; golden E, 2024: SAN 14 → +2, proficiency +2):

   | Character | Grant's stat | DC | Attack |
   |---|---|---|---|
   | golden A | `cha` | 8 + 1 + 2 = 11 | 1 + 2 = 3 |
   | golden A | `int` | 8 − 1 + 2 = 9 | −1 + 2 = 1 |
   | golden A | `cha`, given by two grants | one pair: 11, 3 | |
   | golden A | `str` at `atLevel: 3` | no path | no path |
   | golden A | `san` (no such stat) | 8 + 0 + 2 = 10, `missingPath` | 0 + 2 = 2, `missingPath` |
   | golden E | `san` | 8 + 2 + 2 = 12 | 2 + 2 = 4 |
   | golden A, `cha`, with `spell.dc.bonus` +1, `spell.attack.bonus` +2, `attack.spell.bonus` +1, `d20.all.bonus` −1 | | 12 | 1 + 2 + 2 + 1 − 1 = 5 |
   | the same, golden A's cleric (WIS 16 → +3) | | 13 + 1 = 14 | 3 + 2 + 2 + 1 − 1 = 7 |
   | golden A, `cha`, an override of `abilities.cha.spell.dc` to 15 | | 15 | 3 |

   Golden A's own numbers do not change: cleric DC 13, attack +5. No golden value changes, and the
   goldens give no warning.
5. `compute()` stays pure: frozen inputs give equal results.
6. The quality gate is green. No file in `apps/web` changes, so no `pnpm e2e`.

#### 4. How to do it

1. `spellcasting.ts`: `ATTACK_SPELL_BONUS_PATH`; `castingSteps(path, stat)`, the DC and attack of
   a stat under a path, used by the class loop as it is and by the new stat loop.
2. `statSpellPath`, `grantCastingStat`; the stat loop over `gathered.grants`.
3. Tests (§7). Then the backlog notes (§9) and the row ENG-55.

Technical choices (ADR 002):
- **The numbers are a stat's, not a grant's.** A spell's DC and attack read its stat, `prof` and
  the bonus targets, nothing of the grant (both SRDs' rule, §8), so two grants with one stat have
  one DC. dnd5e computes them the same way, per ability (`abilities.<id>.dc`, `.attack`, §8). A
  grant's part id (`srd-2014:trait/infernal-legacy#spells`) is no path step; a stat's key is one.
- **Under `abilities.<stat>.spell`**, beside ENG-13's `abilities.<stat>.save` and mirroring
  ENG-15's `classes.<key>.spell`. Not under `spell.`: a stat named `dc` or `slots` would meet
  ENG-15's `spell.dc.bonus` or `spell.slots.*`.
- **Given only for a stat a grant names**, as ENG-15 gives a class's paths only to a class that
  casts: a character with no such grant has none.
- **A grant with no `ability` gets nothing here.** In both SRDs a grant with no stat is a class's or
  a subclass's (the Life domain's spells, cast as a cleric's, §8); which class's numbers its spells
  show is the Spells tab's mapping (phase 2), with `systemData.spells`, keyed by class or subclass.
- **`attack.spell.bonus` and `spell.attack.bonus` both add to every spell attack.** SPEC §5.4 has
  both: the first in the attack family beside the weapon kinds (ENG-16's
  `attack.weapon.<kind>.bonus`), the second beside `spell.dc.bonus`. The SRD says the same thing
  both ways ("a +1 bonus to spell attack rolls", "your spell save DC and spell attack bonus each
  increase by 2", §8), so a pack's effect may target either, and two effects on the two add up.
  One alias of the other would drop an effect or hide it behind an override of the other.
- **One function for the stat a grant casts with** (`grantCastingStat`), so the rule sits in the
  module, not in a screen, and the phase 3 import that lets a person choose the stat (ENG-32's
  note) changes that function, not its readers. ENG-53's modifier reads it too.
- **The DC does not read `d20.all.bonus`; the attack does** — ENG-15 §8, the same rule.

#### 5. Stored data

Nothing stored changes. No schema, pack or character field changes; the grant's `ability` was
stored already and is now read. The published `pack.schema.json` does not change.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/grant-casting.test.ts` — `describe('ENG-51 a granted spell's casting
  numbers')`: §3 items 1–5, on golden A and golden E with made-up feats (`character:`).
- `packages/system-5e/test/spellcasting.test.ts` — ENG-15's breakdowns of a spell attack gain the
  `attack.spell.bonus` step; the paths of a character who casts nothing gain it. No value changes.
- `packages/system-5e/test/golden/golden-values.test.ts` — golden D's d20 tests include a stat's
  spell attack (golden B has none, so the count stays 32).
- Control values from: the goldens' scores (SPEC §6.7) and the rule in §8, worked out by hand in §3
  item 4, never copied from a run.

#### 8. Checked against the source

Sources: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
`packages/5e-database/src/{2014,2024}/en/`; foundryvtt/dnd5e at
`7bfb3f1c03e107bf65942151ef08d50ddb01ba8a`: `module/` and `packs/_source/content24/`, which quotes
SRD 5.2.1 (CC-BY-4.0). The same commits as ENG-15 §8. Read 2026-10-02.

**The DC and attack of any spell.**
- SRD 5.1 (`5e-SRD-Rules.json`, Casting a Spell): "The DC to resist one of your spells equals 8 +
  your spellcasting ability modifier + your proficiency bonus + any special modifiers." "Your
  attack bonus with a spell attack equals your spellcasting ability modifier + your proficiency
  bonus."
- SRD 5.2.1 (`content24/chapter-7/spells.yml`): "Spell save DC = 8 + your spellcasting ability
  modifier + your Proficiency Bonus"; "Spell attack modifier = your spellcasting ability + your
  Proficiency Bonus".
- Neither names a class: the rule is the stat's. So a spell a grant gives with its own stat has
  the same DC and attack as a class's spell cast with that stat.

**Grants that name a stat.**
- SRD 5.1 (`5e-SRD-Traits.json`): `high-elf-cantrip`, "Intelligence is your spellcasting ability
  for it."; `infernal-legacy`, "Charisma is your spellcasting ability for these spells." No 2014
  feat gives a spell (`5e-SRD-Feats.json`: Grappler only).
- SRD 5.2.1 (5e-database 2024 `5e-SRD-Traits.json`, `5e-SRD-Feats.json`): `elven-lineage`,
  `gnomish-lineage`, `fiendish-legacy` and `magic-initiate`: "Intelligence, Wisdom, or Charisma is
  your spellcasting ability for …", chosen; `otherworldly-presence` "uses the same spellcasting
  ability you use for your Fiendish Legacy trait". A choice of stat is ENG-32's phase 3 note.
- The Life domain's spells (ENG-15 §8, `domain-spells-1`) name no stat: a subclass's spells, cast
  as its class's.

**dnd5e.**
- `module/data/actor/templates/common.mjs`, `prepareAbilities`: for every ability,
  `abl.dc = 8 + abl.mod + prof + dcBonus` (`bonuses.spell.dc`) and
  `abl.attack.value = abl.mod + prof + abl.attack.bonus + rollReduction`, where `abl.attack.bonus`
  holds the ability's own and every attack's (`rolls.attack.bonus`) bonus.
- `module/data/item/spell.mjs`, `availableAbilities`: a spell's own `ability`, else its class's
  spellcasting ability. `module/data/activity/save-data.mjs`: a spell's save DC is
  `abilities[ability].dc`.
- `module/data/activity/attack-data.mjs`, `getAttackData`: a spell's attack roll adds the ability's
  attack bonus, `rolls.attack` and `rolls.attack.<msak|rsak>` (the spell attack kind's bonus,
  `bonuses.msak.attack` before), so a bonus of the kind and a general one add up.

**Two words for one bonus.** SRD 5.1 magic items (`5e-SRD-Magic-Items.json`): Robe of the
Archmagi, "Your spell save DC and spell attack bonus each increase by 2."; Wand of the War Mage +1,
"you gain a +1 bonus to spell attack rolls"; Staff of Power, "a +2 bonus to Armor Class, saving
throws, and spell attack rolls". SRD 5.2.1's Robe of the Archmagi says the same as SRD 5.1's. Both
words name the attack bonus of every spell attack; no SRD bonus is to one class's spells only.

#### 9. Not in this ticket

- `damage.spell.bonus` (SPEC §5.4): what a spell's damage adds. A spell's damage is dice text
  (ENG-50's `spellDice`), which reads no bonus; new row ENG-55.
- Choosing a grant's stat among three (2024's lineages, legacy and Magic Initiate): phase 3's
  import, which widens `grantCastingStat` (ENG-32's note).
- Which class a grant with no stat casts as, and listing a grant's spells with their numbers: the
  Spells tab (phase 2).
- A spell's healing and its modifier: ENG-53. Casting through a grant's `uses`: ENG-20.
- Advantage on a spell attack: ENG-34.

#### 10. Rake check

- **The golden tests are the truth.** No SPEC §6.7 value changes; ENG-15's breakdowns gain a step
  of 0, their totals the same.
- **`[ПРОВЕРИТЬ]`, measure, never estimate.** Nothing is marked; every rule is quoted in §8 from
  its file, every value worked out from the goldens' scores.
- **`packages/engine` is pure; the core names no game.** No core file changes.
- **Everything is data.** No stat is named in code: a grant's `ability` is any key, `san` as `cha`.
- **`compute()` is pure.** The steps read their arguments only; tested frozen.
- **A number with no breakdown entry is a bug.** Each new path has its steps, which add up.
- **Manual overrides always win.** Tested on `abilities.cha.spell.dc`.
- **Each system's rules live in its own module.** Every rule is in `packages/system-5e`; the
  editions agree (§8), so nothing goes to `rulesets/`.
- **Missing is not broken.** A stat the character lacks reads 0 with `missingPath`, never a throw.
- **A stored-shape change needs a migration.** Nothing stored changes.
- **Licensing.** §8 quotes SRD 5.1 and SRD 5.2.1 (CC-BY-4.0) only; the test feats are made up.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-02, on `main` at `4df11a3`:
- `pnpm lint`: `Checked 164 files`, no errors (163 before; 1 new test file).
- `pnpm typecheck`: 6 projects, all `Done`.
- `pnpm test`: `Test Files 49 passed (49)`, `Tests 568 passed (568)`, 8.38 s (before, measured on
  `4df11a3`: 48 files, 560 tests). This ticket's 8 are in `grant-casting.test.ts` (882 ms alone);
  3 tests of ENG-15 changed (below).
- `pnpm build`: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- Every value of §3 item 4 is true: golden A with a `cha` grant 11 and 3, an `int` grant 9 and 1,
  `cha` from two grants one pair, `str` at `atLevel: 3` none (and 11, 3 once golden A is cleric 3,
  STR 13 → +1); `san` on golden A 10 and 2 with two `missingPath` warnings, on golden E 12 and 4
  with none; with the four effects 12 and 5, the cleric 14 and 7; the override 15, attack 3.
  Golden A's own cleric stays DC 13, attack +5.
- An effect `attack.spell.bonus +1` on golden A, measured with a throwaway test: before the
  change, `noTarget` and the cleric's attack 5; after, no warning and 6. An effect on
  `damage.spell.bonus` warns `noTarget` before and after (ENG-55).
- The tests bite. 7 breaks in `spellcasting.ts`, each on its own and restored, the `system-5e`
  tests run (224 tests): no stat paths, 5 fail; a spell attack without `attack.spell.bonus`, 4;
  no `attack.spell.bonus` target, 30; every spell grant cast with `cha`, 5; the DC reads
  `d20.all.bonus`, 4; the attack without `prof`, 14; the paths under `spell.<stat>`, 6.

Differences from §3 and §4: none in values. As §7 says, ENG-15's tests changed in three places:
golden A's spell attack breakdown and the focused feat's gain the `attack.spell.bonus` step (0);
the paths of golden B, who casts nothing, filtered by `spell.`, gain `attack.spell.bonus`. Golden
D's d20 test pattern names a stat's spell attack too; golden B has none, so it still counts 32.
The class's DC and attack moved into `castingSteps`, which a stat's use too; the class's steps are
the same but for the one new part.

Against the row and its note:
- The note's two points are done: `attack.spell.bonus` is a target every spell attack adds
  (§4 says why both targets add); a `spell` grant with its own `ability` has a DC and an attack.
- `damage.spell.bonus`, named beside them in the note and in ENG-16 §9, is not a casting number:
  new row ENG-55, with its note.
- ENG-53's note now names where the modifier's stat is read; the phase 3 note on choosing a stat
  among three names `grantCastingStat`.

Found, not fixed:
- `damage.spell.bonus` is no path (above). New row ENG-55.
- SRD items cast spells "using your spell save DC" (2014 Staff of Fire, Staff of Healing, Staff
  of Power, `5e-SRD-Magic-Items.json`) without saying which, when a character has more than one
  (a multiclass, or a class and a grant). Noted for phase 3's mechanics of those items, in
  `BACKLOG.md`.

Nothing for the changelog: no screen and no published file changes.

---

### ENG-35 The ability-bonus source

**Hat:** The ability-bonus source is a choice, the rules base by default
**Depends on:** ENG-33 (`systemData.abilities.bonusSource`), ENG-19
(`rulesOf(character).abilityBonusSource`), ENG-13 (the module's `grantsOf`), ENG-12 (an
`abilityScore` grant raises a score), ENG-09, ENG-10 (the dwarf, the hill dwarf, the Soldier)
**Size:** S
**Screen:** No
**SPEC:** §6.3 "Повышение характеристик"; ADR 014 item 1 (from ADR 013 item 10); ADR 005 item 3.4

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/ability-bonus.ts` — new: which side's ability score
increases a character takes, and the warning for `both`.
- `packages/system-5e/src/module.ts` — changes: its two grant rules move into `ruledGrants`;
  `grantsOf` then leaves out the side not taken; `ruleWarnings` gives the warning.
- `packages/system-5e/src/classes.ts` — changes: `characterLevel`, the character's level, which the
  module's `level` and the new file both read.
- `packages/system-5e/src/index.ts` — exports the new file.
- `packages/engine/src/compute.ts` — changes: `grantsOf` is given `find`; a new optional
  `ruleWarnings`, warnings about the character as a whole, each a `characterRule` warning.
- `packages/engine/test/compute.test.ts` — the two core changes, on the made-up system.
- `packages/system-5e/test/ability-bonus.test.ts` — new.

#### 2. What is missing now

- `grep -rn "bonusSource" packages/*/src` finds the schema field (`character.ts`) and the type of
  `abilityBonusSource` (`edition-rules.ts`) only. No code reads the stored choice.
- Measured on golden A (2014, hill dwarf) with mixing on, both SRD packs, the 2024 Soldier as its
  background and the Soldier's increases put on `str`, `dex`: each of the three stored values
  gives the same scores, `str 15, dex 11, con 16, wis 16`. Every one of the three `abilityScore`
  grants applies (`dwarf#ability-scores`, `hill-dwarf#ability-scores`,
  `soldier#ability-scores`). The only warnings are `otherRuleset`; `both` gives none.
- A module can warn only about one computed path (`stepRule`, a key path's `ruleWarnings`). No
  path is the character's bonus source.
- `pnpm test`: `Test Files 48 passed (48)`, `Tests 560 passed (560)`.

#### 3. What it should look like when done

1. **The two sides.** The species side is the `abilityScore` grants of the character's species
   and of the lineages that species' `entity` grants give (fixed or chosen). The background side is
   the `abilityScore` grants of its background. A side *gives* when one of its grants applies at
   the character's level and no feat is taken in its place.
2. **When both sides give**, `systemData.abilities.bonusSource` decides. The mixed character of
   §2 (bases `str 13, dex 10, con 14, wis 15`; dwarf `con +2`, hill dwarf `wis +1`, Soldier
   `str +2, dex +1`):
   | `bonusSource` | `str` | `dex` | `con` | `wis` | Warning |
   |---|---|---|---|---|---|
   | `species` | 13 | 10 | 16 | 16 | none |
   | `background` | 15 | 11 | 14 | 15 | none |
   | `both` | 15 | 11 | 16 | 16 | one `characterRule`, rule `abilityBonusesFromBoth` |
   A side left out is not gathered: its grants are not in `grants`, its distribution is not in
   `pendingChoices`, and its stored choice is not read. The background's other grants still give
   (the Soldier's `athletics`, `intimidation`).
3. **The warning** is `{ code: 'characterRule', rule: 'abilityBonusesFromBoth', data: { species,
   background }, message }`: the id of the first entity of each side whose increase applied (the
   dwarf, the Soldier). It never blocks: the scores are computed as row 2 says.
4. **When only one side gives**, its increases apply whatever is stored, and nothing warns:
   golden A stored as `background` keeps `con 16, wis 16` (the 2014 Acolyte gives none); golden B
   stored as `species` keeps `str 17, con 15` (the 2024 human gives none). Golden A stored as
   `both` gives no warning.
5. **The rules base by default.** Every golden stores its rules base's source:
   `rulesOf(character).abilityBonusSource` (ENG-19) is `species` for goldens A and C 2014 and
   `background` for goldens B, B4, C 2024, D and E, and each stores that value. Golden B (2024)
   with the 2014 dwarf and hill dwarf as its species takes the Soldier's: `str 17, con 15, wis 12`;
   stored as `species`, the dwarf's: `str 15, con 16, wis 13`.
6. **The core.** A module's `grantsOf` is given `find`, the same finder `entities` and `derive`
   get. A module's `ruleWarnings(input)` gives warnings about the whole character; each is a
   `characterRule` warning in `Computed.warnings`, with `data` only when the module gives it. A
   module without `ruleWarnings` adds none.
7. Goldens A–E compute exactly as before: `golden-values.test.ts` passes unchanged.
8. The quality gate is green.

#### 4. How to do it

1. **Core.** `SystemModule.grantsOf(character, entity, find)`; `compute()` passes its `find`.
   `SystemModule.ruleWarnings?(input: DeriveInput<C, E>): readonly RuleWarning[]`, called after
   gathering; each result becomes `{ code: 'characterRule', rule, data?, message }`
   (`CharacterRuleWarning`, part of `ComputeWarning`), after the other warnings.
2. **`characterLevel(character)`** in `classes.ts`: the sum of the class levels, as the module's `level`
   computes it now. The module's `level` calls it.
3. **`ability-bonus.ts`.**
   - `type BonusSide = EditionRules['abilityBonusSource']` (`species` | `background`).
   - `bonusSideOf(entity)`: `species` for a `species` or `lineage`, `background` for a
     `background`, else nothing. By type: a lineage is reached only through its species.
   - `bonusGivers(character, find, grantsBy)`: for each side, its entities that give increases
     (row 1 of §3), found before gathering. The lineages are the species' `entity` grants' fixed
     ids and the ids stored in `character.choices` for them, found as type `lineage`. `grantsBy`
     is the module's own grant rules, so a grant a feat replaces gives nothing here either.
   - `leftOutSide(character, find, grantsBy)`: with `both` stored, or when a side gives nothing,
     none; else the side not stored.
   - `abilityBonusWarnings({ character, gathered })`: with `both` stored and an `abilityScore`
     grant of each side gathered, the one warning of §3 row 3. It reads what was gathered, so it
     names what applied.
4. **The module.** Its two grant rules (a later class's grants, a grant a feat replaces) move
   from `grantsOf` into `ruledGrants`, unchanged. `grantsOf`: `ruledGrants`, then an entity on the
   left-out side gives its grants without its `abilityScore` ones. `ruleWarnings:
   abilityBonusWarnings`.
5. Why a conflict is "both sides give", not "both editions": ADR 013 item 10 shows the choice
   when both raise scores; with one side giving there is nothing to pick, and taking the stored
   side would leave a 2024-based character with a 2014 race and a 2014 background with no
   increases at all. A homebrew entity of either edition, or of `any`, counts by its side, so the
   rule ADR 005 item 3.4 states, "a bonus of one kind counts once", holds for it too.
6. Why the field stays required: ENG-33 made it so, and a new character is written with
   `rulesOf(character).abilityBonusSource` (ENG-19). An absent value would need a version bump and
   a migration, and would add a third state for the same choice.

#### 5. Stored data

Nothing stored changes. `bonusSource` keeps ENG-33's shape and values.

#### 6. What a person will see

Not a screen. The window with a checkbox for each source is phase 4's (ADR 013 item 10).

#### 7. Tests

- `packages/system-5e/test/ability-bonus.test.ts` — §3 rows 1–5: the three stored values on the
  mixed character, its pending choices and kept grants, the warning, one side giving (and no
  background at all), the goldens' defaults, golden B with a 2014 race. Two made-up species of
  the character's own: one whose increase comes at level 4 (golden B at level 1, B4 at level 4),
  and one with no increase whose lineage, fixed or chosen, gives `str +1`.
- `packages/engine/test/compute.test.ts` — §3 row 6: `grantsOf` finds as `entities` does;
  `ruleWarnings` become `characterRule` warnings, with and without `data`, after the others.
- Control numbers from: the fixtures' increases (`srd-2014.ts` dwarf `con 2`, hill dwarf `wis 1`;
  `srd-2024.ts` Soldier `[2, 1]` or `[1, 1, 1]` over `str`, `dex`, `con`), added by hand to the
  goldens' stored bases.

#### 8. Checked against the source

Sources, read 2026-10-02: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
`packages/5e-database/src/{2014,2024}/en/`, read with `jq`; foundryvtt/dnd5e at
`7bfb3f1c03e107bf65942151ef08d50ddb01ba8a`, `packs/_source/rules` (SRD 5.1) and
`packs/_source/content24` (SRD 5.2.1), which quote the SRDs (CC-BY-4.0). The same commits as
ENG-19.

**Ability score increases (the known case).** SRD 5.1 (`rules/chapter-2-races.yml`): "Every race
increases one or more of a character's ability scores"; the dwarf: "Your Constitution score
increases by 2". 5e-database 2014: every race has `ability_bonuses` (the half-elf also
`ability_bonus_options`, choose 2), every subrace has `ability_bonuses`, and the one background
(`acolyte`) has no ability field. SRD 5.2.1 (`chapter-2/character-creation.yml`, Adjust Ability
Scores): "adjust them according to your background. Your background lists three abilities;
increase one of those scores by 2 and a different one by 1, or increase all three by 1."
5e-database 2024: each background has `ability_scores`; no species or subspecies has an ability
field. So in each SRD only one side gives; a conflict needs a mix (or homebrew).

**Other bonuses of one kind given in two places** (ADR 005 item 3.4), each kind compared between
the two SRDs' fields and texts:

| Kind | SRD 5.1 gives it from | SRD 5.2.1 gives it from | Moved between places? |
|---|---|---|---|
| Languages | race (`languages`: Common and one more; the human and half-elf one of choice), the high elf's Extra Language, background (Acolyte: two of choice) | character creation itself: "Common plus two languages you roll or choose from the Standard Languages table" (Choose Languages); no species or background has a language field | **Yes** |
| Skill proficiencies | background (two), race traits (elf, half-elf, half-orc), class | background (two), species traits (elf Keen Senses, human Skillful), class | No |
| Tool proficiencies | race traits (the dwarf's Tool Proficiency, the rock gnome's Tinker), class; "most backgrounds give … one or more tools" | background (one each), class | No: the background in both; the 2014 race's tools are an extra the 2024 species dropped |
| Weapon proficiencies | race traits (dwarf, high elf), class | class | No: dropped, not moved |
| Feats | none at level 1 | background (an origin feat), the human's Versatile | No: no 2014 place to double |
| Starting equipment and coins | background (the Acolyte's gear, 15 gp), class | background (gear and 8 GP, or 50 GP), class | No |
| Spells from origins | race and subrace traits (the high elf's cantrip, the tiefling's legacy) | species and lineage traits; Magic Initiate, a feat, from the Acolyte and the Sage | No: species in both |
| Size, speed, darkvision | race | species | No |

The one new case is languages. SRD 5.1 (`rules/chapter-4-personality-and-background.yml`): "Your
race indicates the languages your character can speak by default, and your background might give
you access to one or more additional languages of your choice." SRD 5.2.1: "Your character knows
at least three languages: Common plus two languages … Your class and other features might also
give you languages." A 2014 race in a 2024-based character would count its languages and 2024's
three; a 2024 species in a 2014-based character gets none from its species. A new row (§11).

**A rule met on the way.** SRD 5.1, the same chapter: "If a character would gain the same
proficiency from two different sources, he or she can choose a different proficiency of the same
kind (skill or tool) instead." No text of `content24` has "different proficiency" or "already
have proficiency" (grep). It is a choice at creation, not a bonus moved between places (§11).

No golden value looks wrong; nothing stops.

#### 9. Not in this ticket

- The window with a checkbox for each source, and the DM's setting in a campaign: phase 4 and the
  table link (ADR 013 item 10, ADR 014 item 1).
- Languages from two places: ENG-56, the new row (§8).
- Golden F's stated source: ENG-37.
- A breakdown step for an increase left out: the score's breakdown lists what made the number; an
  increase left out made none of it.

#### 10. Rake check

- **Everything is data.** No stat is named: the sides are entity types of the fifth-edition
  module, and every `abilityScore` grant of a side is left out, whatever stats it raises.
- **Each system's rules live in its own module.** The core gets two game-free hooks; it never
  reads `bonusSource`. No `ruleset ===` test: the default is `rulesOf`'s field.
- **Missing is not broken; prerequisites warn, never block.** `both` warns and computes; a species
  or lineage id no pack has gives nothing to either side, and gathering warns `missing` as before.
- **`compute()` is pure.** The new functions read the character and `find` only.
- **The golden tests are the truth.** No golden changes; each stores its rules base's source.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-03, on `main` at `fe4d2b5` (ENG-51 reached `main` while this ticket was built;
the work was rebased onto it):
- `pnpm lint`: `Checked 166 files`, no errors.
- `pnpm typecheck`: 6 projects, all `Done`.
- `pnpm test`: `Test Files 50 passed (50)`, `Tests 577 passed (577)`, 7.13 s (`main` alone,
  measured: 49 files, 568 tests). This ticket's 9: 6 in `ability-bonus.test.ts` (690 ms alone),
  3 in `compute.test.ts`.
- `pnpm build`: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- `golden-values.test.ts` passes unchanged: no golden value or fixture changed.
- The mixed character of §2, now: `species` → `str 13, dex 10, con 16, wis 16`, the dwarf's and
  the hill dwarf's grants only; `background` → `str 15, dex 11, con 14, wis 15`, the Soldier's
  only; `both` → `str 15, dex 11, con 16, wis 16`, all three, and one `characterRule` warning
  `abilityBonusesFromBoth` with `{ species: 'srd-2014:species/dwarf', background:
  'srd-2024:background/soldier' }`. In §2 all three gave `str 15, dex 11, con 16, wis 16`.
- Golden B with the 2014 dwarf: `background` (its rules base's) → `str 17, con 15, wis 12`;
  `species` → `str 15, con 16, wis 13`.
- The tests bite. Each guard broken on its own, then restored, measured before the rebase (the
  `system-5e` tests: 222; the `engine` tests: 219; both: 441): no side ever left out, 5 fail;
  an increase at a later level counted at once, 1; a side giving none still a conflict, 2; no
  warning for `both`, 2; a fixed lineage not looked at, 1; a chosen one, 1; a lineage not on the
  species side, 3; a left-out entity giving no grant at all, 1; the core dropping a warning's
  `data`, 1; the core giving `grantsOf` no finder, 6; the core dropping the module's warnings, 3.

Differences from §3 and from the row:
- A conflict is "both sides give", not "the stored side decides always" (§4 item 5). A stored
  source matters only when both sides give: golden A stored as `background` keeps its dwarf's
  increases, since the 2014 Acolyte gives none.
- The core changed, which the row did not name: `grantsOf` gets `find`, and a module has
  `ruleWarnings`, warned `characterRule`. A module had no way to look at the other side before
  gathering, nor to warn about the character as a whole (only about one path, `stepRule`).
- "The rules base by default" needed no new code: the field stays required (ENG-33), a new
  character is written with `rulesOf(character).abilityBonusSource` (ENG-19; the phase 2 note
  found by ENG-19 says so), and the test shows every golden stores it.
- The module's two grant rules moved from `grantsOf` into `ruledGrants`, unchanged, so the look
  ahead reads the same rules. The module's level is `characterLevel` in `classes.ts` (the name
  `levelOf` was taken in `checks.ts`).
- Two made-up cases were added to §7 once the bite check showed the SRD fixtures never test them:
  an increase at a later level, and a lineage giving the only increase of its species' side.

Found, not fixed:
- Languages are a bonus of one kind given in two places (§8): SRD 5.1's race, SRD 5.2.1's
  character creation. New row ENG-56.
- SRD 5.1's "If a character would gain the same proficiency from two different sources, he or
  she can choose a different proficiency of the same kind" has no SRD 5.2.1 text (§8). A choice
  at creation: a Phase 4 note in `BACKLOG.md`.
- The Phase 4 note found by ENG-13 said the module has no warning of its own but `stepFormula`;
  it now has `ruleWarnings`. The note says so.

Nothing for the changelog: no screen changes.

---

### ENG-20 Damage, healing, slots, concentration

**Hat:** Damage, healing, slots, concentration change by fifth-edition rules
**Depends on:** ENG-30 (`entryOf`, `changeTo`, `applyEntry`, `ActionResult`, `LogStamp`), ENG-33
(`systemData.state`, `DEATH_SAVES`), ENG-14 (`hp.max`), ENG-15 (`spell.slots.level<N>`,
`spell.pact.level`, `spell.pact.slots`), ENG-19 (`rulesOf`), ENG-36 (a module action's shape)
**Size:** M
**Screen:** No
**SPEC:** §6.4 (`applyDamage`, `applyHealing`, `setTempHp`, `spendSlot`, `setConcentration`);
§6.3 (the concentration DC, a ruleset's own formula); ADR 014 item 7 ("use a slot: no")

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/hit-points.ts` — new: `applyDamage`, `applyHealing`,
`setTempHp`, `concentrationDc`, `isDead`.
- `packages/system-5e/src/casting.ts` — new: `castSpell`, `spendSlot`, `regainSlot`,
  `endConcentration`.
- `packages/system-5e/src/actions.ts` — new: the paths of `systemData.state` and the one way a
  fifth-edition tracker action ends (its entry built, then applied).
- `packages/system-5e/src/rulesets/edition-rules.ts`, `2014.ts`, `2024.ts` — change: the field
  `concentrationDcMax`.
- `packages/system-5e/src/index.ts` — exports the new files.
- `packages/system-5e/test/hit-points.test.ts`, `test/casting.test.ts` — new;
  `test/rulesets.test.ts` — the new field.
- `docs/tickets/BACKLOG.md` — the re-cut (§4) and the rows found (§11).

#### 2. What is missing now

- `grep -rn "applyDamage\|applyHealing\|setTempHp\|spendSlot\|castSpell" packages --include=*.ts`
  finds nothing.
- `systemData.state` (`hp`, `slotsSpent`, `pactSlotsSpent`, `deathSaves`, `concentration`) is
  only read: by `compute()` for nothing yet, and by the schema. ENG-30's actions change the
  core's trackers only (resources, conditions, toggles); ENG-36's level-up changes
  `hp.current` alone.
- `EditionRules` has no concentration field: `grep -n concentration
  packages/system-5e/src/rulesets/*.ts` finds nothing.
- `pnpm test`: `Test Files 48 passed (48)`, `Tests 560 passed (560)`, 7.97 s.

#### 3. What it should look like when done

`stamp` is `{ id, at, by: { role: 'player', name: 'Wren' } }`. Golden A (2014): hit point
maximum 12, two level 1 slots, Bless (concentration) and Cure Wounds always prepared. Golden B
(2024): maximum 12. Golden C: wizard 3 and paladin 3, caster level 4 in 2014 (slots 4, 3) and 5
in 2024 (4, 3, 2) (ENG-15). The character's own spells and the pact class `hexer` (pact level 2,
2 slots at hexer 3, as ENG-15's test) are made up. Every value below is worked out by hand.

**The edition files**
1. `rulesOf(character).concentrationDcMax` is `null` in 2014 and `30` in 2024 (§8).
2. `concentrationDc(character, damage)` is the higher of 10 and half the damage rounded down,
   at most `concentrationDcMax`: 7 → 10; 21 → 10; 22 → 11; 25 → 12; 70 → 35 in 2014 and 30 in
   2024.

**Damage** — `applyDamage(character, index, { amount, critical? }, stamp)`
3. Temporary hit points go first (both SRDs' example): B with 5 temporary, 12 of 12, takes 7:
   temporary 0, hit points 10. The entry's `action` is `applyDamage`, `subject` `hp`, and its
   changes are `hp.current` 12 → 10 and `hp.temp` 5 → 0. The outcome: `{ temp: 5, hp: 2,
   status: 'up', failures: 0 }`.
4. Hit points stop at 0: A at 6 takes 17: 0, 11 left over, below the maximum 12: `status:
   'down'`, no death save changes.
5. Massive damage (both SRDs' own example: maximum 12, 6 hit points, 18 damage): A and B at 6
   take 18: 0 hit points, 12 left over, equal to the maximum: `status: 'dead'`, death save
   failures 3.
6. Damage at 0 hit points: A at 0 takes 3: failures 0 → 1, `status: 'down'`, `failures: 1`.
   With `critical: true`: 0 → 2. At 2 failures, 1 more: 3, `dead`. At 2, a critical: 3 (never
   above 3). 12 damage at 0: `dead` (equal to the maximum); 11: one failure.
7. Temporary hit points at 0 hit points take the damage first: A at 0 with 5 temporary takes 3:
   temporary 2, no failure. Takes 7: temporary 0, one failure (2 got through).
8. Concentration: B concentrating, 12 of 12, takes 7: the outcome's `concentrationDc` is 10, and
   `state.concentration` stays. With 100 of 100 (an override of `hp.max`) and 70 damage:
   `concentrationDc` 35 for A (2014), 30 for B (2024). A concentrating takes 12 at 12: 0 hit
   points, concentration ends (a change `state.concentration` → none), no `concentrationDc`,
   `concentrationEnded` names the spell.
9. Refusals: an amount of 0, -1 or 1.5: `badAmount`. A dead character (0 hit points, 3
   failures): `dead`.

**Healing** — `applyHealing(character, index, { amount }, stamp)`
10. The SRD 5.1 example: A with an override `hp.max` 20, at 14, healed 8: 20 (6 regained, not 8).
    A at 5 healed 4: 9. Healed at its maximum: `unchanged`.
11. Above the maximum (an override `hp.max` 6, at 12): healing changes nothing (`unchanged`), and
    never lowers the hit points.
12. From 0: A at 0 with 1 success and 2 failures, healed 3: 3 hit points, death saves 0 and 0.
13. Refusals: `badAmount` as item 9; a dead character: `dead`.

**Temporary hit points** — `setTempHp(character, { amount, replace? }, stamp)`
14. They do not add up; the larger stays (both SRDs' example, 12 or 10, not 22): with 10,
    receiving 12 gives 12; with 12, receiving 10 is `unchanged`. With `replace: true`, 12 → 10,
    and 12 → 0 clears them.
15. At 0 hit points they change nothing else: A at 0 with 1 failure receives 5: temporary 5,
    hit points 0, failures 1.
16. Refusals: an amount of -1 or 1.5: `badAmount`; a dead character: `dead`.

**Slots and casting** — `castSpell(character, index, { spell, slot? }, stamp)`; a slot is
`{ level }` or `'pact'`; without `slot`, no slot is used ("use a slot: no")
17. A casts Bless with a level 1 slot: `slotsSpent` `{ 1: 1 }` and `concentration` Bless; the
    entry's `action` `castSpell`, `subject` the spell's id, `label` `{ en: 'Bless' }`. Then Cure
    Wounds with a level 1 slot: `{ 1: 2 }`, concentration still Bless. A third: `noSlotLeft`,
    `max: 2`, `spent: 2`.
18. A higher slot: C (2014) casts a level 1 spell with a level 2 slot: `{ 2: 1 }`. A level 3 slot:
    `noSlotLeft`, `max: 0`. C (2024) has one: `{ 3: 1 }`.
19. A level 2 spell with a level 1 slot: `slotTooLow`. Slot level 0, 10 or 1.5: `badLevel`.
20. Pact magic: B as hexer 3 casts a level 1 spell with `'pact'`: `pactSlotsSpent` 1, then 2,
    then `noSlotLeft` (`max: 2`, `spent: 2`). A level 3 spell with `'pact'`: `slotTooLow` (pact
    level 2). A with `'pact'`: `noSlotLeft`, `max: 0`.
21. No slot: A casts Bless without one: only `concentration` Bless. Again, while concentrating
    on it: `unchanged`. Cure Wounds without one: `unchanged` (nothing to change).
22. A new concentration spell ends the old one: A concentrating on Bless casts its own
    concentration spell: `concentration` before Bless, after the new one.
23. A cantrip with a slot: `cantripSlot`. A spell no pack has: `missing`; a class's id:
    `notASpell`.

**Slots without a spell, and concentration ended**
24. `spendSlot(character, index, { slot }, stamp)`: A, level 1: `{ 1: 1 }`; a third: `noSlotLeft`.
    Pact as item 20.
25. `regainSlot(character, { slot, amount }, stamp)`, `amount` a whole number from 1 or `all`: A
    with `{ 1: 2 }` regains 1: `{ 1: 1 }`; `all`: `{ 1: 0 }`; 5: `{ 1: 0 }`. None spent:
    `unchanged`. Pact: `pactSlotsSpent` 2 → 0 with `all`. An amount of 0: `badCount`.
26. `endConcentration(character, index, stamp)`: A on Bless: `concentration` removed, `label`
    `{ en: 'Bless' }`. Not concentrating: `unchanged`. On an id no pack has: removed, no label.

**Every action**
27. A refusal changes nothing and carries a `code`, its data and an English `message`.
28. Each entry parses with `logEntrySchema`; each character an action gives opens with
    `openFifthEditionCharacter` unchanged; `reverseEntry` with the entry gives back the character
    before.
29. Deep-frozen inputs: no action throws, and each input equals its copy after the call.
30. The quality gate is green.

#### 4. How to do it

**The re-cut first** (`BACKLOG.md`). ENG-33 §9 gave "damage, slots, death saves, concentration,
inspiration" to ENG-20 and ENG-21, and ENG-32 §11 the spent uses of a `spell` grant. Together
they are more than M, and three are outside the hat. New rows, after ENG-20:
- **ENG-57** (S) "A spell a grant gives is cast through its own uses": the spent count by part id
  (a stored-shape change: version 3 and its migrations), the uses' maximum with a breakdown, and
  `castSpell`'s third way to cast. ENG-32's note moves there.
- **ENG-58** (S) "A death save roll changes the character by fifth-edition rules": 10 or higher a
  success, 1 two failures, 20 one hit point; three successes stable; who is stable; reviving.
- **ENG-59** (XS) "Inspiration is gained or spent up to its maximum": `houseRules.inspirationMax`.

Then:
1. `rulesets/`: `concentrationDcMax`, quoted in §8.
2. `actions.ts`: the state paths; `settled(character, stamp, made)`, which drops the changes
   whose value does not change, refuses `unchanged` when none is left, and applies the entry.
3. `hit-points.ts`: `isDead`, `concentrationDc`, then the three actions. Damage: temporary hit
   points first; the rest from the hit points, down to 0; what is left over is measured against
   the maximum; at 0 hit points before the damage, the damage past the temporary hit points
   gives failures; at 0 after it, concentration ends.
4. `casting.ts`: the slot a cast or a spend uses, checked against the computed slots and the
   spent count; `castSpell` adds concentration; `regainSlot`, `endConcentration`.
5. Tests, then the gate.

Technical choices (ADR 002):
- **Fifth edition's actions are the module's.** They change `systemData.state`, which only the
  module knows; they build their entries with the core's `entryOf` and `changeTo`, as ENG-36.
- **The action computes the character itself** (`index`, as `levelUp`): the hit point maximum
  and the slots are read from `compute()`, never from a number the screen passes.
- **The damage given is the damage taken.** Resistance, vulnerability and immunity are applied
  before; no row computes `defenses.*` yet (§11).
- **Death is three failures.** The schema has no "dead" field; SRD 5.1 and 5.2.1 both say the
  third failure kills, so instant death writes failures 3, and `isDead` is 0 hit points with 3
  failures. Nothing is added to the stored shape.
- **What the screen must ask is an outcome, not a change.** The concentration save's DC is
  returned (`concentrationDc`); the screen rolls it and, on a failure, calls `endConcentration`.
  Dropping to 0 changes concentration itself, since that needs no roll.
- **Each field is its own change.** `hp.current` and `hp.temp` are two changes, so a pending
  entry from a heal and one from temporary hit points never refuse each other.
- **A cast that changes nothing is refused,** as ENG-30 refuses any action that would leave an
  empty entry. The screen rolls a cantrip's attack without casting it as an action.
- **The person picks the slot.** Any slot of the spell's level or higher, or a pact slot of a
  level at least the spell's, whichever class the spell is from (both SRDs' multiclass rule,
  §8). Whether the spell is prepared or a ritual is not checked: "use a slot: no" is the
  person's, as ADR 014 item 7 says.
- **Recasting the concentration spell already held keeps it.** The slot is spent; the field does
  not change.
- **Healing above the maximum never lowers the hit points.** The maximum may have dropped (2014
  exhaustion 4, an override); healing only raises.

#### 5. Stored data

Nothing stored changes. Every field the actions write is ENG-33's. The spent uses of a `spell`
grant would be a new field: ENG-57.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/hit-points.test.ts` — `describe('ENG-20 hit points')`: §3 items 2–16,
  27–29 for these actions.
- `packages/system-5e/test/casting.test.ts` — `describe('ENG-20 slots and concentration')`: §3
  items 17–29.
- `packages/system-5e/test/rulesets.test.ts` — `describe('ENG-19 the edition files')`: item 1.
- Control numbers from: the SRD examples quoted in §8 (temporary hit points 5 and 7; massive
  damage 12, 6, 18; healing 20, 14, 8; temporary 12 or 10); SPEC §6.7 (A's and B's maximum 12);
  ENG-15's slots; the rest worked out by hand in §3.

#### 8. Checked against the source

Sources, read 2026-10-02: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
`packages/5e-database/src/{2014,2024}/en/` (SRD 5.1 `5e-SRD-Rules.json`; both editions'
`5e-SRD-Conditions.json`, `5e-SRD-Classes.json`, `5e-SRD-Features.json`); foundryvtt/dnd5e at
`7bfb3f1c03e107bf65942151ef08d50ddb01ba8a`: `packs/_source/content24` (SRD 5.2.1:
`chapter-1/damage-and-healing.yml`, `appendices/appendix-d-rule-references.yml`,
`appendices/rules-glossary.yml`, `chapter-7/spells.yml`, `chapter-2/character-creation.yml`),
`packs/_source/rules/chapter-6-customization-options.yml` (SRD 5.1), and `module/`. The same
commits as ENG-13 to ENG-19.

**Hit points stop at 0.** SRD 5.1 (Hit Points): "can be any number from the creature's hit point
maximum down to 0". SRD 5.2.1 (Hit Points): "which is the lowest Hit Points can go".

**Temporary hit points first.** SRD 5.1: "When you have temporary hit points and take damage, the
temporary hit points are lost first, and any leftover damage carries over to your normal hit
points. For example, if you have 5 temporary hit points and take 7 damage, you lose the temporary
hit points and then take 2 damage." SRD 5.2.1 says the same with the same numbers.

**They do not add up.** SRD 5.1: "Healing can't restore temporary hit points, and they can't be
added together. If you have temporary hit points and receive more of them, you decide whether to
keep the ones you have or to gain the new ones. For example, if a spell grants you 12 temporary
hit points when you already have 10, you can have 12 or 10, not 22." SRD 5.2.1 the same. Both:
"If you have 0 hit points, receiving temporary hit points doesn't restore you to consciousness".
SPEC §6.4 makes the larger the default, the person confirming; `replace` is the other choice.
dnd5e `applyTempHP` keeps the larger only. How long they last, for ENG-21: SRD 5.1 "Unless a
feature that grants you temporary hit points has a duration, they last until they're depleted or
you finish a long rest"; SRD 5.2.1 "Temporary Hit Points last until they're depleted or you finish
a Long Rest."

**Healing.** SRD 5.1: "A creature's hit points can't exceed its hit point maximum, so any hit
points regained in excess of this number are lost. For example, a druid grants a ranger 8 hit
points of healing. If the ranger has 14 current hit points and has a hit point maximum of 20, the
ranger regains 6 hit points". "A creature that has died can't regain hit points until magic such
as the revivify spell has restored it to life." SRD 5.2.1 (Healing) the same example, 6 not 8;
(Dead) "A dead creature has no Hit Points and can't regain them unless it is first revived".

**Death saves reset by healing.** Both: "The number of both is reset to zero when you regain any
hit points or become stable." dnd5e `preUpdateHP`: from 0 to above 0, success and failure 0.

**Massive damage.** SRD 5.1 (Instant Death): "When damage reduces you to 0 hit points and there
is damage remaining, you die if the remaining damage equals or exceeds your hit point maximum.
For example, a cleric with a maximum of 12 hit points currently has 6 hit points. If she takes 18
damage from an attack, she is reduced to 0 hit points, but 12 damage remains. Because the
remaining damage equals her hit point maximum, the cleric dies." SRD 5.2.1 (Massive Damage): the
same rule and example.

**Damage at 0 hit points.** Both: "If you take any damage while you have 0 hit points, you suffer
a death saving throw failure. If the damage is from a critical hit, you suffer two failures
instead. If the damage equals or exceeds your hit point maximum, you suffer instant death"
(2024: "you die"). Temporary hit points at 0: SRD 5.1 "They can still absorb damage directed at
you while you're in that state, but only true healing can save you." Read: damage they absorb
whole gives no failure, since absorbing it would otherwise not protect; the failure and the
maximum are measured on the damage that gets past them. SRD 5.2.1 says the same as 5.1 without
the sentence on absorbing; one reading for both. "On your third failure, you die" (both).

**Concentration** (SPEC §6.3 names the DC a ruleset's formula). SRD 5.1 (Duration,
Concentration): "Whenever you take damage while you are concentrating on a spell, you must make a
Constitution saving throw to maintain your concentration. The DC equals 10 or half the damage you
take, whichever number is higher." SRD 5.2.1 (Concentration): "The DC equals 10 or half the damage
taken (round down), whichever number is higher, up to a maximum DC of 30." So 2014 has no
maximum and 2024 has 30: a difference SPEC §6.3's table does not list, added as ENG-19 added
`hitDieMinimum`. 2014 states no rounding; dnd5e `getConcentrationDC`: `Math.clamp(Math.floor(
damage / 2), 10, rulesVersion === "modern" ? 30 : Infinity)`, so both round down. Both end it at 0
hit points: SRD 5.1 "You lose concentration on a spell if you are incapacitated or if you die",
and Unconscious (`5e-SRD-Conditions.json`) "An unconscious creature is incapacitated"; SRD 5.2.1
"Your Concentration ends if you have the Incapacitated condition or you die", Unconscious "You
have the Incapacitated and Prone conditions", and Falling Unconscious "If you reach 0 Hit Points
and don't die instantly, you have the Unconscious condition". A new concentration spell: SRD 5.1
"You lose concentration on a spell if you cast another spell that requires concentration";
SRD 5.2.1 "You lose Concentration on an effect the moment you start casting a spell that requires
Concentration". Both: "You can end concentration at any time (no action required)."

**Slots.** SRD 5.1 (Spell Slots): "When a character casts a spell, he or she expends a slot of
that spell's level or higher". SRD 5.2.1 (Spell Level): "When you cast a spell, you expend a slot
of that spell's level or higher". Cantrips: SRD 5.1 "A cantrip is a spell that can be cast at
will, without using a spell slot"; SRD 5.2.1 "A cantrip is cast without a spell slot". Without a
slot: SRD 5.1 "Some characters and monsters have special abilities that let them cast spells
without using spell slots"; SRD 5.2.1 (Casting without Slots) cantrips, rituals, special
abilities, magic items. Rituals: both "doesn't expend a spell slot". Back on a rest, for ENG-21:
SRD 5.1 "Finishing a long rest restores any expended spell slots"; SRD 5.2.1 the same words.

**Pact magic.** SRD 5.1 (warlock, `5e-SRD-Classes.json`): "all of your spell slots are the same
level. To cast one of your warlock spells of 1st level or higher, you must expend a spell slot";
"To cast the 1st-level spell thunderwave, you must spend one of those slots, and you cast it as a
3rd-level spell." SRD 5.2.1 (Pact Magic): the same, with Charm Person. Multiclass, SRD 5.1: "you
can use the spell slots you gain from the Pact Magic feature to cast spells you know or have
prepared from classes with the Spellcasting class feature, and you can use the spell slots you
gain from the Spellcasting class feature to cast warlock spells you know." SRD 5.2.1 the same
with "prepared". So any slot casts any spell. Back on a rest, for ENG-21: SRD 5.1 "You regain
all expended spell slots when you finish a short or long rest"; SRD 5.2.1 "You regain all expended
Pact Magic spell slots when you finish a Short or Long Rest".

No golden value is touched; no rules source disagrees with the SPEC. Nothing stops.

#### 9. Not in this ticket

- A spell a grant gives, cast through the grant's own uses: ENG-57.
- Death save rolls, stable, reviving: ENG-58. Inspiration: ENG-59.
- Slots, hit dice and temporary hit points back on a rest: ENG-21.
- Resistance, vulnerability and immunity: §11.
- The Unconscious condition at 0 hit points, and knocking a creature out: ENG-58's note.
- Rolling the concentration save, advantage on it: the screen (phase 2) with ENG-34's roll modes.
- One slot per turn (SRD 5.2.1), and whether a spell is prepared: the screen's warning.
- A reduced hit point maximum, and 2024's death at a maximum of 0: no tracker stores one (ENG-19
  §8).

#### 10. Rake check

- **Each system's rules live in its module.** The actions are `system-5e`'s; the core is not
  changed. The concentration DC's edition difference is one field read through `rulesOf`; no code
  tests the edition.
- **Measure, never estimate.** Every expected value is the SRD's example or worked out in §3.
- **Missing is not broken.** A missing spell is a refusal with a code; concentration on an id no
  pack has can still end; a missing slot path reads as no slots.
- **Ids are stable.** Concentration and entries name spells by id.
- **The engine is pure.** No clock, no random id: the caller gives the stamp; nothing given is
  changed (the frozen-input test).
- **No user-facing string in the module.** Messages are English for logs; the screen uses `code`.
- **A stored-shape change needs a migration.** None changes (§5).
- **Licensing.** The rules are quoted from the CC-BY-4.0 SRDs in this ticket only; the test
  entities are made up, with no text.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- Before: `grep -rn "applyDamage\|applyHealing\|setTempHp\|spendSlot\|castSpell" packages
  --include=*.ts` found nothing. `pnpm test`: `Test Files 48 passed (48)`, `Tests 560 passed
  (560)`, 7.97 s.
- After: `pnpm test`: `Test Files 50 passed (50)`, `Tests 588 passed (588)`, 7.27 s. Rebased onto
  ENG-51 and ENG-35: `Test Files 52 passed (52)`, `Tests 605 passed (605)`, 7.22 s; lint `Checked
  172 files`, no error; typecheck 6 of 6 `Done`.
- The two new files alone: `Tests 28 passed (28)`, 770 ms: `hit-points.test.ts` 17,
  `casting.test.ts` 11. `rulesets.test.ts` keeps its 5 tests, each edition's object with the new
  field.
- Lint: `Checked 169 files`, no error. Typecheck: `Scope: 6 of 7 workspace projects`, all 6
  `Done`. Build: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The tests catch mistakes. Each change made alone in the code, then the three test files run (33
  tests); every one failed at least one test, and each was undone: temporary hit points not taken
  first, 2 failed; hit points below 0, 4; no massive damage, 1; massive damage only above the
  maximum, 1; a critical hit gives one failure, 1; failures above 3, 1; damage the temporary hit
  points absorb gives a failure, 1; concentration kept at 0 hit points, 1; the DC rounded up, 1;
  2024 with no DC maximum, 3; healing past the maximum, 2; healing lowers hit points above the
  maximum, 1; no death save reset, 1; temporary hit points added up, 1; a dead character allowed,
  3; no slot count check, 4; no slot level check, 2; a cantrip with a slot allowed, 1; no
  concentration on a cast, 3; slots regained below 0, 1; the pact level ignored, 1.

Differences from §3:
- `regainSlot` first wrote a 0 where no count was stored, an entry that changed "nothing" to 0.
  Found while working out §3 item 25, before any test ran: it now refuses `unchanged` when none is
  spent.
- When a slot has none left and is also below the spell's level, the refusal is `noSlotLeft`:
  the count is checked first, so a character with no pact magic gets `noSlotLeft` with `max: 0`
  (§3 item 20), never `slotTooLow` against a pact level of 0.
- §3 item 2 gained 59 → 29 (2024, below the maximum); item 21 a cantrip cast with no slot
  (`unchanged`); item 25 a slot level of 10 (`badLevel`).
- The module's tests see the language only (ENG-42), so `structuredClone` is not declared there;
  the frozen copies are JSON copies (`test/action-checks.ts`).

Re-cut (§4): ENG-57, ENG-58 and ENG-59 are new rows after ENG-20, in `BACKLOG.md`, with their
notes. ENG-32's note on a `spell` grant's uses moved to ENG-57; ENG-33's bounds of death saves and
inspiration to ENG-58 and ENG-59. Rebased onto ENG-51 and ENG-35, which closed while this ticket
ran and took ENG-55 and ENG-56 for their own rows, so these three are ENG-57 to ENG-59.

Found, not fixed:
- Nothing computes `defenses.*` (SPEC §5.4: resistance, immunity, vulnerability), so
  `applyDamage` takes the damage after them, typed by the person. SRD 5.2.1 also has Bloodied
  (half the hit points or fewer: "no game effect on its own but which might trigger other game
  effects"), which no path gives. New note for phase 2.
- At 0 hit points both SRDs give the Unconscious condition; `applyDamage` does not set it, since
  a condition is a pack's entry and the module names no id. Its effects (Strength and Dexterity
  saves failed) do not apply until it is set. Stable has no field: both SRDs reset both counts
  to 0 when the character becomes stable, and dnd5e keeps a status of its own. Noted on ENG-58.
- A long rest ends temporary hit points, gives spell slots back, and a short rest gives pact
  slots back (§8). Noted on ENG-21.

Nothing for the changelog.

---

### ENG-34 Roll modes and critical hits

**Hat:** Advantage, disadvantage, critical hits apply to fifth-edition rolls
**Depends on:** ENG-13 (checks, saves, skills, passives), ENG-14 (`init.total`, `RULE_STATS`),
ENG-16 (`attacks.<key>.*`, `crit.range`, `ATTACK_STATS`, `diceOf`), ENG-15 and ENG-51 (spell
attacks), ENG-17 (`activeEffects`, the phases), ENG-19 (`heavyWeapon`,
the 2014 exhaustion test data), ENG-43 (a skill's stat), ENG-44 (`equipmentOf`), ENG-48 (`size`),
ENG-50 (`addDice`'s writing of dice)
**Size:** M (the row said S; §11)
**Screen:** No
**SPEC:** §5.4 (the `roll.*` targets, `crit.range`); §5.6 (`2d20kh1`); §6.1 step 5 (passive
values); §6.5 (advantage, disadvantage, critical 20 and 1, the critical range, doubled damage dice);
§6.7 golden B4 ("with advantage" twice); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/rolls.ts` — new: the roll mode of each d20 test
(`<test>.mode` paths), `rollModeOf`, the roll targets each test reads, `d20Formula`,
`attackOutcome`, `criticalDamage`, the Stealth rule of armor.
- `packages/engine/src/effects.ts` — changes: `rollModeEffects`, the `advantage` and
  `disadvantage` effects on given targets, worked out as `appendedNumbers` works out an `append`;
  the warning `notARollMode`.
- `packages/engine/src/stats.ts` — changes: an `effect` breakdown step's `op` may be `advantage`
  or `disadvantage`.
- `packages/engine/src/derived.ts` — changes: an effect warning that several paths meet is
  warned once.
- `packages/engine/src/formula.ts` — changes: `multiplyDice`, a roll formula with each dice term
  rolled more times.
- `packages/system-5e/src/checks.ts` — changes: a passive value adds 5 × its skill's mode.
- `packages/system-5e/src/attacks.ts` — changes: `attacks.<key>.mode`, the Heavy property's
  disadvantage by `rulesOf(character).heavyWeapon`.
- `packages/system-5e/src/module.ts`, `index.ts` — change: `derive` joins the roll modes; export.
- `packages/system-5e/test/rolls.test.ts` — new.
- `packages/system-5e/test/golden/golden-values.test.ts` — changes: golden B4's two lines.
- `packages/system-5e/test/exhaustion.test.ts` — changes: 2014 exhaustion's disadvantages.
- `packages/system-5e/test/attacks.test.ts`, `spellcasting.test.ts`, `module.test.ts` — change:
  the lists of every path under `attacks.`, `spell.` and `.save` gain the new mode paths.
- `packages/engine/test/phases.test.ts`, `formula.test.ts` — changes: the core's parts.

#### 2. What is missing now

Measured on `main` at `4df11a3`, then again on `5fbd320` where noted:
- `grep -rn "roll\.\|advantage" packages/system-5e/src packages/engine/src` finds only
  `rulesets/` (the heavy rule and inspiration's `use`, held, not read) and the roll record. No code
  reads an effect on a `roll.*` target.
- Golden B4 computed with `fifthEditionModule`: 151 values, none matching `mode|roll|adv`; no
  warning. Its Remarkable Athlete has `advantage` on `roll.init` and on `roll.skill.athletics`,
  and nothing shows them: SPEC §6.7's "Athletics +6, with advantage" and "Initiative +3, with
  advantage" are the two golden lines no test holds (`golden-values.test.ts`, its header).
- Golden A's passive Perception 13 has two steps, `passiveBase` 10 and `skills.perception.total`
  3; no step for advantage or disadvantage.
- Golden A wears chain mail (`stealthDisadvantage: true`); its Stealth has a total (0) and nothing
  saying it rolls with disadvantage.
- 2014 exhaustion's test data gives `disadvantage` on `roll.check.all`, `roll.attack.all`,
  `roll.save.all`; `exhaustion.test.ts` says they change nothing. SPEC §5.4 has
  `roll.check.<ability>` and no `roll.check.all`.
- No function writes the d20 of a roll with advantage (`2d20kh1`), says whether a d20 face is a
  critical hit, or doubles a damage formula's dice.
- `pnpm test`: `Test Files 48 passed (48)`, `Tests 560 passed (560)`; on `5fbd320` (after ENG-51
  and ENG-35): `Test Files 50 passed (50)`, `Tests 577 passed (577)`.

#### 3. What it should look like when done

1. **Each d20 test has a roll mode**, a number path: 1 advantage, −1 disadvantage, 0 neither. Its
   steps are its sources, each with `value` +1 (advantage) or −1 (disadvantage) and `change` what
   it moved the mode; the changes add up to the mode. The tests, and the `roll.*` targets
   (SPEC §5.4) each reads:

   | Path | Targets read | Rule source |
   |---|---|---|
   | `checks.<stat>.mode` | `roll.check.<stat>`, `roll.check.all` | |
   | `abilities.<stat>.saveMode` (a stat with a save) | `roll.save.<stat>`, `roll.save.all` | |
   | `skills.<key>.mode` | `roll.skill.<key>`, `roll.check.<its stat>`, `roll.check.all` | the worn armor's `stealthDisadvantage`, on the skill `stealth` |
   | `init.mode` | `roll.init`, `roll.check.dex`, `roll.check.all` | |
   | `attacks.<key>.mode` | `roll.attack.weapon.<kind>`, `roll.attack.all` | the Heavy property, by the edition's `heavyWeapon` |
   | `spell.attackMode` (every spell attack: `classes.<key>.spell.attack`, `abilities.<stat>.spell.attack`) | `roll.attack.spell`, `roll.attack.all` | |
   | `deathSave.mode` | `roll.deathSave`, `roll.save.all` | |

   A skill's stat is its key path's (ENG-43), initiative's `RULE_STATS.initiative`.
2. **Both cancel.** Any advantage and any disadvantage give 0, however many of each (§8). Two
   advantages give 1: the first step's change is 1, the second's 0. An advantage then a
   disadvantage: 1, then −1.
3. **The sources, in order:** the module's rule sources, then each effect in the order gathering
   gives them. An effect is used when it is active (ENG-17: its toggle on, its entity not dormant
   unless it has a `when`, not situational) and its `when` is true. Its step is
   `{ kind: 'effect', part, source, label, op: 'advantage' | 'disadvantage', value: ±1, change }`.
4. **Golden B4** (SPEC §6.7): `skills.athletics.mode` 1, one step, Remarkable Athlete's
   `srd-2024:feature/champion-remarkable-athlete#athletics`; `init.mode` 1, one step, its
   `#initiative`. Every golden still computes with no warning, and each breakdown adds up.
5. **Armor's Stealth** (§8): the armor worn with `stealthDisadvantage` gives `skills.stealth.mode`
   a step `{ kind: 'entity', source: <armor>, label: <its name>, value: -1, change }`. Goldens A,
   B and B4 wear chain mail: their Stealth mode is −1. An armor carried but not worn, or a second
   armor that counts for nothing (ENG-44), gives none.
6. **The Heavy property** (§8; ENG-19's `heavyWeapon`): a weapon with the property `heavy` gives
   its attack's mode a disadvantage, `{ kind: 'rule', rule: 'heavyWeapon', value: -1, change }`:
   in 2014 when the character's `size` is one of `sizes` (`small`); in 2024 when the score of the
   weapon kind's stat (`ATTACK_STATS`: melee `str`, ranged `dex`) is below `min` (13). A size not
   chosen gives no disadvantage. Golden B's and B4's
   greatsword (STR 17, 19) have mode 0.
7. **Passive values** (§8): `skills.<key>.passive` = 10 + its total + 5 × the sign of its mode,
   with a step `{ kind: 'path', path: 'skills.<key>.mode', value: <mode>, change: <5 × sign> }`.
   The goldens' passive Perception stays 13 (mode 0, change 0).
8. **2014 exhaustion** (ENG-19's test data, SRD 5.1's table): at level 1, every check, skill and
   initiative mode −1; at level 3, every save, attack, spell attack and the death save −1 too; at
   0, golden A's own modes. No warning.
9. **Effects and overrides** apply to a mode path as to any number (ENG-17): an override
   `skills.athletics.mode` −1 wins, its step last. The passive and `d20Formula` read the sign, so
   a mode above 1 counts as 1.
10. **Warnings.** An effect on a target a test reads whose op is neither `advantage` nor
    `disadvantage` and gives no number (`append`, `note`, a `set` of a text or a yes/no) warns
    `notARollMode` `{ part, op, target }`, once however many tests read the target. A number op on
    a `roll.*` target warns `noTarget` (the phases: no value has that path). An `advantage` on a
    number path warns `notANumber` (ENG-17).
11. **`rollModeOf(signs)`**: the mode the rule gives for sources of these signs: `[]` 0, `[1]` 1,
    `[-1]` −1, `[1, 1]` 1, `[1, -1]` 0, `[1, 1, -1]` 0, `[-1, -1, 1]` 0. The mode steps use it, so
    the rule is written once; the roll dialog (phase 2) adds its own sources with it.
12. **`d20Formula(mode)`**: `1d20` for 0, `2d20kh1` above 0, `2d20kl1` below 0.
13. **`attackOutcome(natural, range = 20)`**: a natural 1 is `automaticMiss`; a natural 20, or a
    face at or above `range` (a weapon attack's `crit.range`), is `criticalHit`; any other face
    is `byTotal`. `(19, 19)` and `(20, 25)` give `criticalHit`, `(1, 1)` `automaticMiss`, `(19, 20)`
    `byTotal`.
14. **`criticalDamage(formula)`**: the formula with each dice term rolled twice (§8): `1d4` →
    `2d4`, `2d6+4` → `4d6+4`, `1d8 + 2к6 + @prof` → `2d8 + 4к6 + @prof`, `4d6kh3` →
    `(4d6kh3 + 4d6kh3)`, `5` → `5`. A formula that does not parse, or a term past 999 dice, gives
    its error, never a throw.
15. **`multiplyDice(formula, times)`** (the core, game-free): a term that keeps every die has its
    count multiplied; one that keeps some is written `times` times in brackets, in its place;
    numbers and paths stay. `times` counts as a whole number, rounded down; below 1 the formula is
    given as it is. Never throws.
16. `compute()` stays pure: frozen inputs give equal results. The quality gate is green.

#### 4. How to do it

1. `effects.ts`: `RollModeEffect` and `rollModeEffects(effects, targets, readerOf, warn)`, built
   on `applies` and `withOwnPaths`; `notARollMode` joins `EffectWarning`.
2. `stats.ts`: the `effect` step's `op` widens.
3. `derived.ts`: `valueAt` keeps the effect warnings already pushed and pushes each once.
4. `formula.ts`: `multiplyDice`, written from `diceOf` and ENG-50's `withCount`.
5. `rolls.ts`: `rollModeOf`, `ROLL_TARGETS`, `modeOf` (a mode's steps from its rule sources and
   its targets' effects), `rollModeSteps` (checks, saves, skills, initiative, the death save),
   `d20Formula`, `attackOutcome`, `criticalDamage`.
6. `attacks.ts`: each weapon's mode through `modeOf`; `checks.ts`: the passive.
7. Tests (§7), then the backlog notes (§11).

Technical choices (ADR 002):
- **Every step of a mode is a source, its `value` its sign** (an override's, the mode it forces):
  the roll dialog (phase 2) adds its own sources to those values with `rollModeOf`, so no step
  only informs. The score that makes a Heavy weapon too heavy is its stat's own path.
- **A mode is a number path**, as every value is (ENG-28), like ENG-16's `mastery` (1 or 0):
  1, 0 or −1, dnd5e's `AdvantageModeField` values (§8). Effects and overrides apply to it with no
  new kind of value, and its steps name each source, so the sheet's "with advantage" has its
  breakdown (`CLAUDE.md`: a number with no breakdown entry is a bug).
- **The targets stay SPEC §5.4's `roll.*` names; the computed modes are other paths.** One target
  (`roll.save.all`) reaches several tests, and one test reads several targets, so neither can be
  the other. A target is read, never computed: a number op on one warns `noTarget`.
- **`roll.check.all` is added**, beside SPEC's `roll.save.all` and `roll.attack.all`: 2014
  exhaustion's level 1 gives disadvantage on every ability check, and writing it per stat would
  miss a custom stat (`CLAUDE.md`: `san` behaves as `str`). A widening of what a target may name;
  no stored shape changes.
- **A skill check and initiative are ability checks** (§8: "a Dexterity check"), so they read
  `roll.check.<stat>` and `roll.check.all`, as dnd5e combines them.
- **`roll.attack.<kind>`'s kinds are the bonus targets' kinds**, `weapon.melee`, `weapon.ranged`,
  `spell` (SPEC §5.4's `attack.<weapon.melee | weapon.ranged | spell>.bonus`).
- **One mode for every spell attack**, `spell.attackMode`: a class's spell attack and a grant's
  (ENG-51) read the same two targets and no rule source, so their modes are always equal; one
  path, beside `spell.attack.bonus`, which every character has too. A weapon's mode is its own,
  since the Heavy property is the weapon's.
- **A death save reads `roll.save.all`.** SRD 5.1 calls it "a special saving throw" "aided only
  by spells and features that improve your chances of succeeding on a saving throw"; SRD 5.2.1
  "Unlike other saving throws". dnd5e reads only its own death roll mode; this follows the SRDs.
- **The roll mode's rule is the module's**: the core collects the `advantage` and `disadvantage`
  effects (`rollModeEffects`), as it collects appended formulas for ENG-14; what they do (cancel,
  ±5 on a passive, `2d20kh1`) is fifth edition's (`effect.ts`: "What a roll does with `advantage`
  is a module's").
- **An effect warning is warned once.** A mode test evaluates its targets' effects in its own step,
  so a loop through an effect's `when` names the right path; one target is read by up to 25 tests,
  so the same warning comes many times. `valueAt` keeps each one once. A `missingPath` read for
  each test stays one per test: it names the path that read it.
- **The Stealth skill is a named constant**, `STEALTH_SKILL = 'stealth'`, as ENG-14's `RULE_STATS`
  names `dex`: the armor's field is the SRD's rule about that one skill. A character without that
  skill gets nothing from it.
- **The Heavy property is a named constant**, `HEAVY = 'heavy'`, as ENG-16's `FINESSE`.
- **Critical dice are the core's tree work** (ENG-08 §9: "double a term's dice in the tree"); the
  ×2 is fifth edition's (`CRITICAL_DICE = 2`). A term that keeps some dice is rolled twice whole,
  not as one term of twice the dice: `8d6kh6` is another roll than two `4d6kh3` (dnd5e duplicates
  such a term, §8).
- **A spell attack's critical range is 20**: SRD 5.2.1's Improved Critical names "attack rolls
  with weapons and Unarmed Strikes" (ENG-16 §8), so `crit.range` stays a weapon attack's, and
  `attackOutcome`'s default is `CRITICAL_FACE`.

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table. An effect's `target` is
any computed path already; `roll.check.all` needs no schema change.

#### 6. What a person will see

Not a screen. The sheet's "with advantage" marks, the roll dialog and its buttons are phase 2's
(§9).

#### 7. Tests

- `packages/system-5e/test/rolls.test.ts` — `describe('ENG-34 roll modes')`: §3 items 1–3 and
  5–10 on golden A (2014, chain mail, warhammer, a cleric's spell attack) and golden B (2024,
  chain mail, greatsword, STR 17, DEX 13); made-up effects, items and a Small species
  (`character:`); `describe('ENG-34 rolls and critical hits')`: items 11–14.
- `packages/system-5e/test/golden/golden-values.test.ts` — `describe('ENG-34 goldens: golden
  B4')`: item 4.
- `packages/system-5e/test/exhaustion.test.ts` — item 8.
- `packages/engine/test/phases.test.ts` — `describe('ENG-34 roll mode effects')`: on Tales,
  `rollModeEffects`' order, `when`, toggles, its warning, once for two readers.
- `packages/engine/test/formula.test.ts` — `describe('ENG-34 dice rolled more times')`: item 15.
- Control values from: SPEC §6.7 (B4); the SRD texts of §8 (each rule); the goldens' data and the
  made-up entities, each mode worked out by hand before the run.

#### 8. Checked against the source

Sources, read 2026-10-02: SRD 5.1 as 5e-bits/5e-srd-api quotes it at `e6edf9a` (`5e-SRD-Rules.json`,
read with python3), and as foundryvtt/dnd5e quotes it at `7bfb3f1` (`packs/_source/rules`); SRD
5.2.1 as dnd5e quotes it (`packs/_source/content24`) and 5e-database's 2024 files; dnd5e's code
at `7bfb3f1` (`module/`). The same commits as ENG-13 to ENG-19. All CC-BY-4.0.

**Advantage and disadvantage, and both on one roll.** SRD 5.1 (Advantage and Disadvantage): "you
roll a second d20 when you make the roll. Use the higher of the two rolls if you have advantage,
and use the lower roll if you have disadvantage"; "If two favorable situations grant advantage,
for example, you still roll only one additional d20"; "If circumstances cause a roll to have both
advantage and disadvantage, you are considered to have neither of them, and you roll one d20. This
is true even if multiple circumstances impose disadvantage and only one grants advantage or vice
versa." SRD 5.2.1 (`chapter-1/d20-tests.yml`, Advantage/Disadvantage): "roll a second d20 … Use the
higher of the two rolls if you have Advantage, and use the lower roll if you have Disadvantage";
"They Don't Stack"; "If circumstances cause a roll to have both Advantage and Disadvantage, the roll
has neither of them, and you roll one d20. This is true even if multiple circumstances impose
Disadvantage and only one grants Advantage or vice versa." One rule in both editions: no edition
field. dnd5e (`data/fields/advantage-mode-field.mjs`): values `[-1, 0, 1]`; `resolveMode` gives
`Math.sign(advantageCount) - Math.sign(disadvantageCount)`, an override forcing a mode.

**Which modes a test combines.** dnd5e (`documents/actor/actor.mjs`): a skill check combines
`abilities.<ability>.check.roll`, `rolls.ability.check`, `rolls.ability.skill` and
`skills.<skill>.roll`; a save `abilities.<ability>.save.roll` and `rolls.ability.save`; initiative
`abilities.<ability>.check.roll`, `attributes.init.roll` and `rolls.ability.check`; an attack
`abilities.<ability>.attack.roll`, `rolls.attack` and `rolls.attack.<type>` (melee or ranged,
weapon or spell); the death save `attributes.death.roll` alone. The SRDs: SRD 5.1 (Initiative)
"you roll initiative by making a Dexterity check"; SRD 5.2.1 (Combat, Initiative) "they make a
Dexterity check that determines their place in the Initiative order"; SRD 5.1 (Skills) "a
Dexterity check might reflect … to stay hidden. Each of these aspects of Dexterity has an
associated skill". SRD 5.1 (Death Saving Throws): "a special saving throw, called a death saving
throw … You are in the hands of fate now, aided only by spells and features that improve your
chances of succeeding on a saving throw." SRD 5.2.1 (`damage-and-healing.yml`): "Unlike other
saving throws, this one isn't tied to an ability score." So a death save reads the saves' target
(§4). dnd5e's per-ability attack mode and global skill mode are not SPEC §5.4 targets; none is
added.

**Passive values.** SRD 5.1 (Passive Checks): "10 + all modifiers that normally apply to the check.
If the character has advantage on the check, add 5. For disadvantage, subtract 5." SRD 5.2.1
(`rules-glossary.yml`, Passive Perception): "If the creature has Advantage on such checks, increase
the score by 5. If the creature has Disadvantage on them, decrease the score by 5." dnd5e
(`data/actor/templates/creature.mjs`): `+ (advantageMode * CONFIG.DND5E.skillPassive.modifier)`,
`skillPassive = { base: 10, modifier: 5 }`.

**Armor and Stealth.** SRD 5.1 (`chapter-5-equipment.yml`, Armor): "If the Armor table shows
“Disadvantage” in the Stealth column, the wearer has disadvantage on Dexterity (Stealth) checks."
SRD 5.2.1 (`chapter-6/equipment.yml`): "If the table shows “Disadvantage” in the Stealth column for
an armor type, the wearer has Disadvantage on Dexterity (Stealth) checks." 5e-database 2014:
`padded-armor`, `scale-mail`, `half-plate-armor`, `ring-mail`, `chain-mail`, `splint-armor`,
`plate-armor` have `stealth_disadvantage`. dnd5e (`data/actor/templates/attributes.mjs`): the
first equipped armor with `stealthDisadvantage` sets `skills.ste.roll.mode` to −1.

**The Heavy property.** SRD 5.1 (`chapter-5-equipment.yml`): "Small creatures have disadvantage on
attack rolls with heavy weapons." SRD 5.2.1 (5e-database 2024 `heavy`): "You have Disadvantage on
attack rolls with a Heavy weapon if it's a Melee weapon and your Strength score isn't at least 13
or if it's a Ranged weapon and your Dexterity score isn't at least 13." ENG-19 holds it as
`heavyWeapon`; the fixtures' greatsword, greataxe, glaive and halberd have `heavy`.

**A concentration save.** SRD 5.1 (Concentration): "you must make a Constitution saving throw to
maintain your concentration." SRD 5.2.1 (`appendices/appendix-d-rule-references.yml`,
Concentration): "you must succeed on a Constitution saving throw to maintain" it. So ENG-20's concentration roll is the Constitution
save's, and reads its mode.

**Remarkable Athlete (golden B4).** 5e-database 2024 `champion-remarkable-athlete`: "you have
Advantage on Initiative rolls and Strength (Athletics) checks." The fixture's two effects (ENG-10).

**Critical 20 and 1.** SRD 5.1 (Rolling 1 or 20): "If the d20 roll for an attack is a 20, the attack
hits regardless of any modifiers or the target's AC. This is called a critical hit"; "If the d20
roll for an attack is a 1, the attack misses regardless of any modifiers or the target's AC." SRD
5.2.1 (`d20-tests.yml`, Rolling 20 or 1): "If you roll a 20 on the d20 (called a “natural 20”) for
an attack roll, the attack hits regardless of any modifiers or the target's AC. This is called a
Critical Hit"; "If you roll a 1 on the d20 (a “natural 1”) for an attack roll, the attack misses
regardless". Only attack rolls: neither SRD gives an ability check or a save a natural 20 or 1
rule. The death save's 1 and 20 (both SRDs) are its tracker's, ENG-20. Improved Critical: "can
score a Critical Hit on a roll of 19 or 20 on the d20" (ENG-16 §8), so a natural 20 is a critical
hit whatever the range.

**Critical damage.** SRD 5.1 (Critical Hits): "Roll all of the attack's damage dice twice and add
them together. Then add any relevant modifiers as normal"; "if you score a critical hit with a
dagger, roll 2d4 for the damage, rather than 1d4". SRD 5.2.1 (`damage-and-healing.yml`, Critical
Hits): "Roll the attack's damage dice twice, add them together, and add any relevant modifiers as
normal. For example, if you score a Critical Hit with a Dagger, roll 2d4 for the damage rather than
1d4". One rule in both editions. dnd5e (`dice/damage-roll.mjs`, `#applyCriticalTerm`): a die with
no modifiers has its count multiplied (`term.alter(cm, cb)`); "Modified or complex terms are
duplicated", wrapped in brackets when `*` or `/` binds them; numbers are not multiplied unless a
setting says so.

No golden value looks wrong; nothing stops.

#### 9. Not in this ticket

- The roll dialog: its advantage and disadvantage buttons, a situational effect shown as a switch
  (SPEC §5.4 `situational`), the person's own modifiers, "I roll myself", the roll log: phase 2,
  reading the modes, `ROLL_TARGETS`, `rollModeOf`, `d20Formula`, `attackOutcome` and
  `criticalDamage`.
- Spending inspiration: phase 2, by `inspiration.use` (2014: one more advantage, through
  `rollModeOf`; 2024: one die rolled again).
- The death save as a roll and its 1 and 20: ENG-58 (re-cut from ENG-20), which keeps its count.
- Armor worn without training (disadvantage on Strength and Dexterity rolls): ENG-46, a rule
  source through `modeOf`.
- Features that change critical damage (a Brutal Critical's extra die): their mechanics, phase 3.
- A tool check: no path computes one yet. A concentration save (ENG-20's DC) is a Constitution
  save in both SRDs (§8), so its mode is `abilities.con.saveMode`.

#### 10. Rake check

- **The golden tests are the truth.** B4's two lines are SPEC §6.7's; no golden value changes;
  every mode expected is worked out from §8 before the run.
- **`packages/engine` is pure; the core names no game.** `rollModeEffects` collects ops by target;
  `multiplyDice` rewrites dice terms; neither names a stat, a skill or a rule.
- **Everything is data.** Each stat's check and save mode comes from the stats the character has,
  each skill's from its skills (a `san` check reads `roll.check.san`); the targets are built from
  keys; the two rule keys are named constants.
- **`compute()` is pure; a number with no breakdown entry is a bug.** Each mode has a step per
  source; the passive's step names the mode.
- **Manual overrides always win.** Tested on `skills.athletics.mode`.
- **Each system's rules live in its own module; no `if (ruleset === …)`.** The heavy rule is read
  from `rulesOf(character).heavyWeapon`; the cancel rule, the passive's 5 and the critical ×2
  are one rule in both editions (§8).
- **Formulas never run code.** `multiplyDice` writes text and parses it with ENG-07's limits.
- **Missing is not broken.** A wrong op warns; a size not chosen gives no disadvantage; a formula
  that does not parse gives its error.
- **Licensing.** The made-up entities have no rules text; §8 quotes the SRDs only.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-03, on `main` at `5fbd320` (ENG-51 and ENG-35 reached `main` while this
ticket was written; it was rebased onto them before any code):
- `pnpm lint`: `Checked 168 files`, no errors (166 before; 2 new files).
- `pnpm typecheck`: 6 projects, all `Done`.
- `pnpm test`: `Test Files 51 passed (51)`, `Tests 609 passed (609)`, 7.08 s (before: 50 files,
  577 tests). This ticket's 32: 20 in `rolls.test.ts` (955 ms alone), 3 in `phases.test.ts`, 5 in
  `formula.test.ts`, 3 golden B4 lines, 1 in `exhaustion.test.ts`.
- `pnpm build`: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- ENG-20 reached `main` while this ticket was pushed; it was rebased onto `e3a1730` (conflicts in
  `BACKLOG.md` and this file only). There: `pnpm lint` `Checked 174 files`, no errors;
  `pnpm typecheck` 6 projects `Done`; `pnpm test` `Test Files 53 passed (53)`, `Tests 637 passed
  (637)`, 7.57 s (`main` alone, measured: 52 files, 605 tests, 172 files linted). ENG-20's death
  saves moved to ENG-58, and its concentration save is the Constitution save's (§8, §9).
- Golden B4 (SPEC §6.7): `skills.athletics.mode` 1, its one step
  `srd-2024:feature/champion-remarkable-athlete#athletics`; `init.mode` 1, its one step `#initiative`;
  Athletics +6 and initiative +3 as before. Every golden computes with no warning, and each
  breakdown adds up.
- Goldens A, B and B4: `skills.stealth.mode` −1, one step, their chain mail (`srd-2014:item/chain-mail`,
  `srd-2024:item/chain-mail`); every other mode 0 (B4: Athletics and initiative 1). Passive
  Perception stays 13 in each, its new third step `skills.perception.mode` 0 with change 0.
- 2014 exhaustion on golden A, levels 0 to 6: checks, skills and initiative −1 from level 1;
  saves, the warhammer, spell attacks and the death save −1 from level 3; no warning at any level.
  At level 1 Stealth has two steps, the chain mail −1 and `#checks` 0.
- Golden B4 has 186 values (152 before: 6 checks, 6 saves, 18 skills, initiative, spell attacks,
  the death save and the greatsword gain a mode). One compute of B4 in this container, 500 runs,
  5 rounds: 0.433 to 0.549 ms before, 0.550 to 0.728 ms after (SPEC §6.6's limit is 10 ms; the
  slowed benchmark is ENG-23's).
- The tests bite. 19 breaks, each on its own and restored, every test run (609): the cancel rule
  counted as a sum, 2 fail; no once-only effect warning, 2; the passive's ±5 dropped, 2; no Stealth
  rule, 5; the 2014 heavy rule read by score, 1; the Heavy property ignored, 2; 13 not enough in
  2024, 1; a source's value not its sign (−5), 2; no `roll.check.all`, 5; a skill without its
  stat's check targets, 8; initiative without the Dexterity check's, 3; the death save without
  `roll.save.all`, 3; a skill's stat not followed, 1; toggles ignored, 1; a kept term merged into
  one, 3; a natural 20 needing the range, 1; no `notARollMode`, 3; `when` ignored, 4; each step's
  change its value, 4.

Differences from §3: none in values; every mode was worked out from §8 and the data before the run,
and the 20 tests of `rolls.test.ts` passed on their first run. While building, three ENG tests that
list every path under a prefix gained the new paths: 8 ENG-15 tests (`spell.attackMode` 0), 3
ENG-16 tests (`attacks.<key>.mode` 0), 1 ENG-13 test (the paths containing `.save`: 18 → 24, the
six `.saveMode`). No value of theirs changed. §3 item 6 first put the 2024 Heavy rule's score
before its rule step, a `path` step of change 0 and value 12; then a step's value was not always a
sign, and the roll dialog adding its sources to the step values would read 12 as an advantage. The
step was dropped (§4), and a test reads every mode's step values back through `rollModeOf`. §2 first
gave a test count for `5fbd320` before it
was measured; it was measured (577) and corrected before any code.

Against the row and its notes:
- The row was size S; with the notes it holds (the passive, Stealth, the Heavy property, 2014
  exhaustion's targets, the warnings) and SPEC §6.5's critical 20, 1 and dice, it is M. Not split:
  each part reads or writes the roll mode, the hat's one thing.
- ENG-51 gave spell attacks a second place (`abilities.<stat>.spell.attack`); one
  `spell.attackMode` serves both (§4), so `spellcasting.ts` did not change.
- The notes, each done: B4's two lines are on; the `roll.*` effects are read through
  `activeEffects` with their own warning (`notARollMode`); the passive's ±5; armor's Stealth; the
  Heavy property by `heavyWeapon`; `roll.check.all` is a target (§4), so the 2014 test data stays.

Found, not fixed:
- An `advantage` or `disadvantage` on a `roll.*` target no test reads (a typo, a stat the
  character lacks) warns nowhere, as an `append` on a list no step reads (ENG-14). Noted for phase
  5, whose effect builder and import checks know the target catalogue.
- What the roll dialog needs from this ticket. Noted for phase 2.
- ENG-46's armor-without-training disadvantage is a rule source through `modeOf`. Its note says so.

Nothing for the changelog: no screen shows a roll mode yet.

---

### ENG-54 The house rule's highest score

**Hat:** The house rule's highest score caps every stat
**Depends on:** ENG-12 (a stat's maximum caps its score), ENG-13 (fifth edition's `statDefaults`),
ENG-33 (`houseRules.abilityMax`), ENG-19 (its default, 20)
**Size:** S
**Screen:** No
**SPEC:** §8.4 (the ceiling of the stats, a house rule); §5.3 `AbilityDef.defaultMax`; §6.1 step 4

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/module.ts` — changes: `statDefaults` reads the character's
house rule.
- `packages/engine/src/compute.ts` — changes: `SystemModule.statDefaults` is a function of the
  character.
- `packages/engine/src/derived.ts` — changes: `StatDefaults` gains an optional `maxRule`.
- `packages/engine/src/stats.ts` — changes: a maximum a rule of the module gives is a `rule` step.
- `packages/engine/test/tales-module.ts`, `compute.test.ts`, `derived.test.ts`,
  `packages/system-5e/test/character.test.ts`, `entity-types.test.ts` — their modules give
  `statDefaults` as a function.
- `packages/engine/test/stats.test.ts` — the core's part, on Tales.
- `packages/system-5e/test/module.test.ts` — the house rule, on goldens B4 and E.

#### 2. What is missing now

- `grep -rn "abilityMax" packages/*/src` finds the schema field (`character.ts:48`) and its
  default (`character.ts:67`). No code reads it.
- `SystemModule.statDefaults` is a value (`compute.ts:47`): the same for every character, so a
  module cannot give one character's highest score.
- Measured on golden B4 (2024 fighter 4), base STR 15 and 18, with `abilityMax` 18, 20 and 22:
  each of the six runs gives `abilities.str.max` 20, its breakdown
  `[{ kind: 'default', of: 'system', value: 20, change: 20 }]`. Base 15 gives score 19, mod 4,
  Athletics 6; base 18 gives score 20, mod 5, Athletics 7, whatever the house rule says.
- `pnpm test`: `Test Files 53 passed (53)`, `Tests 637 passed (637)`.

#### 3. What it should look like when done

1. **The core.** `SystemModule.statDefaults(character)` gives a stat's defaults for that
   character. `StatDefaults.maxRule`, optional, is the module's name for the rule that gives
   `defaultMax`. A stat without its own `defaultMax` starts its maximum with
   `{ kind: 'rule', rule: maxRule, value: defaultMax, change: defaultMax }`; without `maxRule`,
   with `{ kind: 'default', of: 'system', … }` as before. A stat's own `defaultMax` still wins
   (`{ kind: 'default', of: 'stat', … }`). Effects on the maximum apply after it, as before.
2. **Fifth edition.** `fifthEditionModule.statDefaults(character)` is
   `{ defaultMax: systemData.houseRules.abilityMax, maxRule: 'abilityMax',
   modFormula: 'floor((@score - 10) / 2)', hasSave: true }`.
3. **A lower house rule.** Golden B4 with `abilityMax: 18`: `abilities.str.max` 18, its breakdown
   `[{ kind: 'rule', rule: 'abilityMax', value: 18, change: 18 }]`; `abilities.str.score` 18
   (15 + 2 + 2 = 19, then `{ kind: 'cap', value: 18, change: -1 }`); `abilities.str.mod` 4;
   `skills.athletics.total` 6. Each of the six stats has `.max` 18.
4. **A higher house rule.** Golden B4 with base STR 18 (18 + 2 + 2 = 22): with `abilityMax: 22`,
   `abilities.str.score` 22, mod 6, Athletics 8 (6 + proficiency 2), no cap step; with
   `abilityMax: 20`, score 20, mod 5, Athletics 7.
5. **A homebrew pack's stat is capped the same way.** Golden E (hb-local's `san`, no `defaultMax`
   of its own, base 14) with `abilityMax: 12`: `abilities.san.score` 12, `abilities.san.max` 12,
   `abilities.san.mod` 1, `abilities.san.save` 1.
6. **A stat with its own `defaultMax` keeps it.** Golden B4 with `abilityMax: 22` and a stat of
   its own, `luck`, `defaultMax: 30`, base 25: `abilities.luck.max` 30, its breakdown
   `[{ kind: 'default', of: 'stat', value: 30, change: 30 }]`; `abilities.luck.score` 25.
7. **Per character, on the made-up system.** Tales' module made to give `defaultMax` = level + 4
   with `maxRule: 'tableMax'`: Ash (level 2) has `.max` 6 on grit and wits, grit 7 capped to 6,
   wits 5; Brook (level 3) has `.max` 7, wits 8 capped to 7, grit 6. Nerve keeps its own 8 in
   both. Tales' own module gives no `maxRule`: ENG-27's expected values and ENG-12's breakdowns
   pass unchanged.
8. Goldens A–E compute as before: `golden-values.test.ts` passes unchanged (every golden stores
   `abilityMax: 20`).
9. The quality gate is green.

#### 4. How to do it

1. **Core.** `SystemModule.statDefaults(character: C): StatDefaults`; `compute()` calls it once.
   `StatDefaults.maxRule?: string`; `BasePhase` carries it beside `defaultMax`. In
   `computeStats`, a maximum's first step: the stat's own → `default`/`stat`; else `maxRule` →
   `rule`; else `default`/`system`.
2. **Fifth edition.** `FIFTH_EDITION_STAT_DEFAULTS` keeps the modifier and the save only
   (`Pick<StatDefaults, 'modFormula' | 'hasSave'>`). The 20 stays in one place,
   `DEFAULT_HOUSE_RULES.abilityMax` (ENG-19), which a new character is written with.
   `statDefaults` adds `defaultMax` from `systemData.houseRules.abilityMax` and
   `maxRule: 'abilityMax'`.
3. **The modules in tests** give `statDefaults: () => ({ … })`, their values unchanged.
4. **Why a stat's own `defaultMax` wins over the house rule.** SPEC §5.3 gives a stat its own
   ceiling, "by default 20"; SPEC §8.4's house rule is the ceiling of the stats, by default the
   SRD's, the same 20. So the house rule replaces that default, and a stat whose pack gives its own
   ceiling (Tales' nerve, 8) keeps the pack author's rule for that one stat. The other reading,
   the house rule over every stat's own ceiling, would raise a stat made to stop at 8 to the
   table's 20. To reverse: the order of two branches in `computeStats`.
5. **Why a function, not a second member.** The module's `level` and `entities` already read the
   character. A value plus a per-character maximum would keep 20 in two places
   (`FIFTH_EDITION_STAT_DEFAULTS` and `DEFAULT_HOUSE_RULES`).
6. **Why the step names the rule.** A table's 22 shown as "the system's default" would be wrong on
   the sheet. `rule` is the step kind for "a number a rule of the system gives" (`stats.ts`); the
   screen (phase 2) words it from the module's name.

#### 5. Stored data

Nothing stored changes. `houseRules.abilityMax` keeps ENG-33's shape; no `schemaVersion` bump.

#### 6. What a person will see

Not a screen. The house rules screen is phase 4's (SPEC §8.4); the words for the `abilityMax`
step are phase 2's.

#### 7. Tests

- `packages/engine/test/stats.test.ts` — `describe("ENG-54 a stat's highest score per
  character")`: §3 items 1 and 7.
- `packages/system-5e/test/module.test.ts` — `describe("ENG-54 the house rule's highest score")`:
  §3 items 2–6. ENG-13's test of the module's defaults calls `statDefaults(goldenB)`.
- Control numbers from: golden B4's STR (SPEC §6.7: 15 + Soldier 2 + level 4's 2 = 19, mod 4,
  Athletics 6), golden E's SAN 14 (SPEC Appendix Д), Tales' ENG-27 expected values; each cap
  applied by hand, each modifier `floor((score − 10) / 2)` worked out by hand.

#### 8. Checked against the source

The default this ticket reads is ENG-19's, measured there (ENG-19 §8): SRD 5.1 "You can't
increase an ability score above 20."; SRD 5.2.1 "None of these increases can raise a score above
20." Both 20, `DEFAULT_HOUSE_RULES.abilityMax`. No golden changes its stored 20. No new rules fact.

#### 9. Not in this ticket

- The house rules screen, where a table sets its highest score: phase 4 (SPEC §8.4).
- A creation method's own cap (ADR 010 item 12, "No stat goes above 18"): phase 4's methods.
- The other house rules (`hitPointMethods`, `feats`, `multiclass`, `encumbrance`,
  `skillAbilitySwap`): each is read by the ticket that builds its rule.
- The words the sheet shows for the `abilityMax` step: phase 2.
- An item that sets a score above the maximum: phase 3's mechanics (ENG-12 caps a score after
  its effects, and an effect on `.max` raises the cap).

#### 10. Rake check

- **Everything is data.** No stat is named: the house rule caps hb-local's `san` as it caps `str`
  (§3 item 5).
- **The core names no game.** The core takes `maxRule` as a name it does not read; `abilityMax`
  is written in `packages/system-5e` only.
- **`compute()` is pure.** `statDefaults` reads only the character it is given.
- **A number with no breakdown is a bug.** Each maximum keeps one first step, now naming the
  rule; the tests' helper checks every breakdown adds up to its value.
- **Golden values are the truth.** None changes; every golden stores `abilityMax: 20`.
- **A stored-shape change needs a migration.** Nothing stored changes.
- **No `if (ruleset === …)`.** One value for both editions, from the character.
- **Manual overrides win.** Unchanged: they apply after the maximum, in the `final` phase.

#### 11. What came out of it

- `pnpm test`: `Test Files 53 passed (53)`, `Tests 644 passed (644)`, 7.9 s; 7 tests are new
  (3 in `stats.test.ts`, 4 in `module.test.ts`). `pnpm lint`: 174 files, no errors.
  `pnpm typecheck`: 6 of 6 projects. `pnpm build` passes.
- Each item of §3 holds as written, with the values written there: golden B4 at 18 gives STR 18,
  mod 4, Athletics 6 and `.max` 18 on all six stats; base STR 18 gives 22, mod 6, Athletics 8 at
  22, and 20, mod 5, Athletics 7 at 20; golden E's SAN at 12 gives 12, mod 1, save 1; `luck`
  keeps its own 30; Tales' made-up module gives Ash 6 and Brook 7, nerve 8 in both.
- With `defaultMax` held at 20 in the module, the four new fifth-edition tests fail and the rest
  pass: the tests read the house rule, not the old constant.
- `golden-values.test.ts`, ENG-27's expected values and ENG-12's breakdowns pass unchanged.

Found, not fixed:
- A stat's own `defaultMax` wins over the house rule (§4 item 4). Phase 3's SRD import must give
  the six SRD stats no `defaultMax` of their own, or a table's house rule does not reach them.
  Noted for phase 3.

Nothing for the changelog: no screen changes.

---

### ENG-53 A spell's healing

**Hat:** A spell's healing is a roll formula of its own
**Depends on:** ENG-50 (`spellDice`, `addDice`), ENG-51 (`grantCastingStat`), ENG-32 (`SpellDef`),
ENG-52 (`averageOf`), ENG-07 (formula paths)
**Size:** S
**Screen:** No
**SPEC:** §5.3 (`SpellDef`); §5.6 (roll formulas, context paths such as `@score`); ADR 014 item 6

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/spell-dice.ts` — changes: `spellDice` gives a spell's
healing, joins the scaling to it, and writes the casting stat's modifier for `@mod`.
- `packages/system-5e/src/entity-types.ts` — changes: `SpellDef.healing`.
- `packages/system-5e/src/system.ts` — changes: `HEALING_KINDS`.
- `packages/engine/src/formula.ts` — changes: `renamePaths(formula, rename)`; `diceOf` walks the tree
  through a shared walker.
- `packages/system-5e/test/golden/srd-2014.ts` — changes: SRD 5.1 Cure Wounds gains its healing and
  scaling (5e-database's `heal_at_slot_level`).
- `packages/system-5e/test/entities.ts` — changes: the made-up Lantern Ward gives temporary hit
  points.
- `apps/web/public/schema/5e/pack.schema.json` — rewritten from the module (ENG-38).
- Tests: `spell-dice.test.ts`, `entity-types.test.ts`, `pack-json-schema.test.ts` (module);
  `formula.test.ts` (engine).

#### 2. What is missing now

Measured on `main` at `613e0ed`:
- `SpellDef` has no field for healing. SRD 5.1 Cure Wounds with
  `healing: { formula: '1d8 + @mod', kind: 'hp' }` is refused:
  `{"code":"unrecognized_keys","keys":["healing"],"message":"Unrecognized key: \"healing\""}`.
- The same spell with only `scaling: { kind: 'slot', formula: '1d8' }` passes the schema, and
  `spellDice(cure, {}, 2)` gives `damage: []`, `times: 1` and the warning `scalingWithoutDamage`:
  the scaling has nothing to join.
- No formula reads "your spellcasting ability modifier": a spell does not know its stat, and `@mod`
  is no path (a roll would read it as 0 with `missingPath`).
- `pnpm test`: `Test Files 53 passed (53)`, `Tests 637 passed (637)`.

#### 3. What it should look like when done

1. **`SpellDef.healing`**, optional: `{ formula, kind }`. `formula` is a roll formula; `kind` is
   `hp` (hit points regained) or `tempHp` (temporary hit points). Both required inside it, no other
   field. The published `pack.schema.json` says the same.
2. **`@mod`** in a spell's roll formula (its damage, its healing, its scaling) is the modifier of the
   stat the spell is cast with. `spellDice(spell, values, { slot?, stat? })` writes
   `@abilities.<stat>.mod` in its place. Without a stat, `@mod` stays and the warning is
   `noCastingStat`; a roll of it then reads 0 with `missingPath` (ENG-07).
3. **The scaling joins the first damage and the healing**, each the spell has, the same number of
   times (ENG-50's `times`). A scaling with neither warns `scalingWithoutRoll` (was
   `scalingWithoutDamage`).
4. **`spellDice` gives `healing`** (`{ formula, kind }`) when the spell has one, beside `damage`.
5. **Control values, worked out by hand.** Golden A (2014): WIS 15 + 1 (hill dwarf) = 16 → +3;
   CHA 12 → +1. Golden C 2024: CHA 14 → +2 (no species, no background). Averages are ENG-52's.

   | Spell (source) | Cast | Formula | Average |
   |---|---|---|---|
   | SRD 5.1 Cure Wounds, golden A | `wis`, no slot | `1d8 + @abilities.wis.mod`, `hp` | 4.5 + 3 = 7.5 |
   | the same | `wis`, slot 1 / 2 / 9 | `1d8` / `2d8` / `9d8` `+ @abilities.wis.mod` | 7.5 / 12 / 43.5 |
   | the same | `cha` (a grant's stat) | `1d8 + @abilities.cha.mod` | 4.5 + 1 = 5.5 |
   | the same | no stat | `1d8 + @mod`, `noCastingStat` | 4.5, `missingPath` `mod` |
   | SRD 5.2.1 Cure Wounds, golden C 2024 | `cha`, slot 1 / 2 / 3 | `2d8` / `4d8` / `6d8` `+ @abilities.cha.mod` | 11 / 20 / 29 |
   | SRD 5.1 False Life | slot 1 / 3 | `1d4 + 4` / `1d4 + 4 + (5) + (5)`, `tempHp` | 6.5 / 16.5 |
   | SRD 5.1 Heal (level 6) | slot 6 / 9 | `70` / `70 + (10) + (10) + (10)` | 70 / 100 |
   | SRD 5.2.1 Conjure Celestial (level 7) | `cha`, slot 9 | damage `8d12`; healing `6d12 + @abilities.cha.mod` | |
   | SRD 5.1 Spiritual Weapon, golden A | `wis`, slot 2 | damage `1d8 + @abilities.wis.mod` | 7.5 |

6. **`renamePaths(formula, rename)`** (the core, game-free; made-up paths, ADR 004 item 4) gives the
   parsed roll formula with each path `rename` names anew written in its place; any other path, the
   dice (`d` or `к`), the spaces stay: `1d8 + @mod` → `1d8 + @stats.grit.mod`; `max(@mod, 1) + 1к6`
   → `max(@stats.wit.mod, 1) + 1к6`; `@mod * 2 + @mod` → both; `@mod.bonus + @modifier` stays.
   Errors, never a throw: `1d + @mod` does not parse (`unexpected`); a new name that is not a path
   (`stats.Grit.mod`, `stats) + (1d100`, empty) is `badPath`, never parsed as more formula; `@mod`
   and 100 × ` + @mod` (704 characters) renamed to `stats.grit.mod` is `tooLong` at
   704 + 101 × 11 = 1815.
7. **Never throws.** A formula with the stat's modifier written in that fails (past the limits, a
   stat that is not a key) keeps `@mod`, with `castingStatFormula` and the error.
8. **Pure**: frozen inputs, equal results. No golden value changes; no computed path changes.
9. The quality gate is green; the published schema changes, a file in `apps/web`, so `pnpm e2e` runs.

#### 4. How to do it

1. `formula.ts`: a walker over every part of a tree, shared by `diceOf`; `renamePaths`.
2. `system.ts`, `entity-types.ts`: `HEALING_KINDS`, `SpellDef.healing`.
3. `spell-dice.ts`: the cast's `{ slot, stat }`; the scaling joined to the first damage and the
   healing; `@mod` written as the stat's modifier; the warnings.
4. Fixtures: SRD 5.1 Cure Wounds' healing and scaling; Lantern Ward's `tempHp` healing.
5. Tests (§7); the published schema rewritten (`--update`, RUNNING.md); the changelog line.
6. `BACKLOG.md`: the new row ENG-60 and the phase 3 note (§9).

Technical choices (ADR 002):
- **A field of its own, not a damage of type "healing".** A damage's `type` is a damage type's
  key; healing is none. One object, not a list: dnd5e's heal activity has one healing part, and no
  SRD spell heals twice in one cast (§8). The SPEC §5.3 shape gains the field; nothing else in it
  changes.
- **`kind` is required, `hp` or `tempHp`.** False Life gives temporary hit points, Cure Wounds hit
  points; ENG-20 changes them with two actions (`applyHealing`, `setTempHp`), so the screen needs
  to know which. dnd5e keeps the same split (`healing`, `temphp`, §8). Required now can turn
  optional later with no migration; the reverse needs one.
- **`@mod`, a context path**, as SPEC §5.6's `@score` is in a modifier formula. 5e-database writes
  `MOD`, dnd5e `@mod` (§8). The spell does not know its stat: Cure Wounds is a cleric's (WIS) and a
  bard's (CHA). So the pack writes `@mod`, and `spellDice` writes the stat's own path, whose number
  has a breakdown (ENG-12), so a roll's part names a computed path. It holds in every formula of a
  spell, damage too (Spiritual Weapon, §8): one text means one thing in one entity.
- **The stat is the caller's.** A class's spell is cast with its `spellcasting.ability` (or its
  subclass's), a grant's with `grantCastingStat` (ENG-51); which class or grant a spell on the
  sheet comes from is the Spells tab's (phase 2), as ENG-51 §9 says.
- **The cast is one object** `{ slot, stat }`, not two optional parameters in a row; ENG-50's
  `spellDice(spell, values, slot)` becomes `{ slot }`. Only tests call it.
- **The scaling joins both** the first damage and the healing: Conjure Celestial, the one SRD spell
  with both, says "The healing and damage increase by 1d12" (§8).
- **Renaming paths is the core's**, beside `addDice`: text of a roll formula, game-free. It checks
  each new name is a path before it writes it, so a name never turns into formula.

#### 5. Stored data

`SpellDef` gains an optional field: a widening, which no stored pack or character fails. No
`schemaVersion` or `systemSchemaVersion` bump, no migration (ENG-16 §5, the same case). The
published `pack.schema.json` gains `healing`.

#### 6. What a person will see

Not a screen. The published fifth-edition pack schema accepts a spell's `healing` (a changelog
line).

#### 7. Tests

- `packages/system-5e/test/spell-dice.test.ts` — `describe("ENG-53 a spell's healing")`: §3 items
  2–5, 7, 8. ENG-50's calls pass `{ slot }`; its `scalingWithoutDamage` check becomes
  `scalingWithoutRoll`.
- `packages/system-5e/test/entity-types.test.ts` — `describe("ENG-53 a spell's healing")`: §3
  item 1, the refusals.
- `packages/system-5e/test/pack-json-schema.test.ts` — the same in the JSON Schema.
- `packages/engine/test/formula.test.ts` — `describe('ENG-53 paths renamed in a roll formula')`:
  §3 item 6.
- Control values from: 5e-database `e6edf9a` (`heal_at_slot_level`, `damage_at_slot_level`), dnd5e
  `7bfb3f1` (SRD 5.2.1 Cure Wounds, Conjure Celestial), the goldens' scores (SPEC §6.7). Each worked
  out by hand in §3, never copied from a run.

#### 8. Checked against the source

Sources: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`
(`packages/5e-database/src/{2014,2024}/en/5e-SRD-Spells.json`, `5e-SRD-Features.json`);
foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (`packs/_source/spells/`, SRD 5.1;
`packs/_source/spells24/`, SRD 5.2.1; CC-BY-4.0). Read 2026-10-03.

**The modifier is the spellcasting ability's.**
- SRD 5.1 Cure Wounds: "regains a number of hit points equal to 1d8 + your spellcasting ability
  modifier"; "the healing increases by 1d8 for each slot level above 1st". 5e-database:
  `{"1": "1d8 + MOD", "2": "2d8 + MOD", … "9": "9d8 + MOD"}`.
- SRD 5.2.1 Cure Wounds: "regains a number of Hit Points equal to 2d8 plus your spellcasting
  ability modifier"; "The healing increases by 2d8 for each spell slot level above 1."
- dnd5e writes it `bonus: '@mod'` in both packs (`healing.number` 1 and 2, `denomination` 8,
  `scaling.number` 1 and 2). Which stat a spell is cast with: ENG-51 §8 (a class's, or the one a
  grant names).
- In damage too: SRD 5.1 Spiritual Weapon, "force damage equal to 1d8 + your spellcasting ability
  modifier", 5e-database `damage_at_slot_level` `"2": "1d8 + MOD"` (the one SRD 5.1 damage table
  with `MOD`); dnd5e's spells24 damage reads `@mod` in 3 spells (Alter Self, Flame Blade, Sorcerous
  Burst).

**Healing spells, counted with a script.**
- 5e-database: 10 of 319 SRD 5.1 spells have `heal_at_slot_level`: Aid, Cure Wounds, False Life,
  Heal, Healing Word, Mass Cure Wounds, Mass Heal, Mass Healing Word, Prayer of Healing,
  Regenerate. 0 of 339 SRD 5.2.1 spells (its spells have no such field).
- dnd5e: 16 SRD 5.1 spells and 17 SRD 5.2.1 spells have a heal activity. Its types: `healing`,
  `temphp` (False Life, Heroism in both), `maximum` (2014 Heroes' Feast). One healing part per
  activity; 2024 Arcane Vigor has five activities, one per hit die size.
- The kinds: SRD 5.1 False Life, "you gain 1d4 + 4 temporary hit points", "5 additional temporary
  hit points for each slot level above 1st" (5e-database `"3": "1d4 + 14"`). SRD 5.1 Heal: "regain
  70 hit points", "increases by 10 for each slot level above 6th" (`"9": "100"`). Aid raises "hit
  point maximum and current hit points" (`"2": "5"` … `"9": "40"`); SRD 5.2.1's Aid the same
  ("Hit Point maximum and current Hit Points increase by 5"): neither kind (§9).
- Healing over time or from another pool (dnd5e's text of both SRDs): Heroism, "Temporary Hit
  Points equal to your spellcasting ability modifier at the start of each of its turns";
  Regenerate, "4d8 + 15" and then 1 hit point "at the start of each of its turns"; SRD 5.2.1 Arcane
  Vigor, "Roll one or two of your unexpended Hit Point Dice … plus your spellcasting ability
  modifier" (§9).
- Both damage and healing: none in SRD 5.1 (5e-database, dnd5e); in SRD 5.2.1 Conjure Celestial,
  "The healing and damage increase by 1d12 for each spell slot level above 7", 4d12 + the modifier
  and 6d12 Radiant.

**Disciple of Life** (golden A's subclass feature) — not built here (§9), read for its row:
SRD 5.1: "the creature regains additional hit points equal to 2 + the spell's level"; SRD 5.2.1:
"The additional Hit Points equal 2 plus the spell slot's level."

#### 9. Not in this ticket

- A bonus to a spell's healing (Disciple of Life: 2 + the slot's level): SPEC §5.4 has no target
  for it, and a formula cannot read the slot. New row ENG-60.
- Healing `healing` cannot hold (§8): Aid and 2014 Heroes' Feast raise the hit point maximum; 2024
  Arcane Vigor's die is the hit die spent; Regenerate's hit point each turn; Heroism's temporary
  hit points each turn. A phase 3 note.
- Which class or grant a sheet's spell is cast as: the Spells tab (phase 2).
- Applying a heal to a character: ENG-20's `applyHealing` and `setTempHp`. `damage.spell.bonus`:
  ENG-55.
- Showing the healing: phase 2.

#### 10. Rake check

- **The golden tests are the truth.** No SPEC §6.7 value changes; Cure Wounds is no golden value.
- **Measure, never estimate.** The counts in §8 come from scripts over the two sources; the averages
  in §3 are worked out by hand.
- **`packages/engine` is pure; the core names no game.** `renamePaths` reads and writes formula
  text; it names no stat and no spell.
- **Everything is data.** The stat is a key the caller passes, `san` as `wis`; `@mod` is a name in
  the pack's text.
- **`compute()` is pure.** Nothing in `compute()` changes; `spellDice` is tested frozen.
- **A number with no breakdown entry is a bug.** The formula reads `abilities.<stat>.mod`, a
  computed path with its breakdown.
- **Formulas never run code.** `renamePaths` refuses a new name that is not a path, then parses with
  ENG-07's limits.
- **Missing is not broken.** No stat, a formula that fails, a scaling with nothing to join:
  warnings, never a throw.
- **A stored-shape change needs a migration.** An optional field added: a widening (§5).
- **Licensing.** The numbers are SRD 5.1 and SRD 5.2.1 (CC-BY-4.0); the code holds no rules text;
  §8 quotes the SRDs only.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-03, on `main` at `613e0ed`:
- `pnpm lint`: `Checked 174 files`, no errors (174 before; no new file).
- `pnpm typecheck`: 6 projects, all `Done`.
- `pnpm test`: `Test Files 53 passed (53)`, `Tests 653 passed (653)`, 7.20 s (before: 53 files, 637
  tests). This ticket's 16: 10 in `spell-dice.test.ts`, 3 in `formula.test.ts`, 2 in
  `entity-types.test.ts`, 1 in `pack-json-schema.test.ts`.
- `pnpm e2e`: `12 passed (9.5s)` on `pixel-7`, the published schema file served as before (ENG-38's
  two tests among them). No screen changed, so no screenshot.
- Rebased onto `2e9ba26` (ENG-54) before the push, the gate run again: lint `Checked 174 files`, no
  errors; typecheck 6 projects `Done`; `Tests 660 passed (660)` (644 at `2e9ba26`); `pnpm e2e`
  `12 passed (8.7s)`.
- Every value of §3 item 5 is true: golden A's Cure Wounds `1d8 + @abilities.wis.mod`, averages
  7.5, 12, 43.5 at slots 1, 2, 9, each reading `abilities.wis.mod` alone, no warning; with `cha`
  5.5; with no stat `1d8 + @mod`, `noCastingStat`, average 4.5 with `missingPath` `mod`; golden C
  2024's 2d8, 4d8, 6d8 + `@abilities.cha.mod`, 11, 20, 29; False Life 6.5 and 16.5 (`tempHp`); Heal
  70 and 100; Conjure Celestial at 9 `8d12` and `6d12 + @abilities.cha.mod`; Spiritual Weapon
  `1d8 + @abilities.wis.mod`, 7.5. The cleric's `wis` and the paladin's `cha` are read from the
  fixture classes' `spellcasting.ability`, the grant's `cha` from `grantCastingStat`.
- The tests catch a wrong rule. Each break below, made alone and undone, the `engine` and
  `system-5e` tests run (525 tests): the scaling joined to the damage only, 8 fail; `@mod` written
  in the healing only, 1; no `noCastingStat`, 2; a new name not checked as a path, 1.

Against §3 and §4:
- §3 item 6's examples were written with fifth-edition paths; the core's tests use the made-up
  system's (ADR 004 item 4), so the item now says `stats.grit.mod`, and its length 1815
  (704 + 101 × 11).
- Lantern Ward's healing was first `1d4 + @mod`. One scaling joins both its damage and its
  healing, so at slot 4 it gives `1d4 + @abilities.san.mod + 2d6`; the test's `3d4` was a
  hand-worked mistake, not the code's. The made-up healing is `1d6 + @mod` now, which grows as its
  damage does: `3d6 + @abilities.san.mod`, average 12.5 on golden E (SAN +2).
- ENG-50's tests changed in two ways: five calls pass `{ slot }`; `scalingWithoutDamage` is
  `scalingWithoutRoll`. ENG-09's fixture check lists Cure Wounds' two roll formulas, and
  `formulasOf` (`golden/checks.ts`) reads a spell's healing.

Against the row and its note: as the row. Its note's points are done: a field of its own; the
growth by the same `scaling` (`addDice`); the modifier is `abilities.<stat>.mod` of the stat the
caller names, a class's `spellcasting.ability` or `grantCastingStat`. Its count, 10 SRD 5.1 spells
with `heal_at_slot_level`, measured the same. The `kind` field and `@mod` in damage are this
ticket's own choices (§4).

Found, not fixed:
- Disciple of Life, golden A's feature, adds 2 + the slot's level to a spell's healing (both SRDs);
  no target and no slot in a formula. New row ENG-60, with its note.
- Healing the field cannot hold (Aid, 2014 Heroes' Feast, Arcane Vigor, healing each turn) and
  2024's healing table: a phase 3 note in `BACKLOG.md`.

Changelog: one line, the published pack schema accepts a spell's `healing`.

---

### ENG-21 Rests by each edition's rules

**Hat:** A rest changes the character by its edition's rules
**Depends on:** ENG-30 (`changeTo`, `entryOf`, `ActionResult`, `LogStamp`, `state.resources`),
ENG-29 (`Computed.resources`, `resources.<key>.max`), ENG-20 (`settled`, the state paths,
`isDead`, `regainSlot`), ENG-19 (`rulesOf`, `longRestHitDice`, `hitDieMinimum`), ENG-14
(`hp.max`, `RULE_STATS`), ENG-15 (the slots), ENG-33 (`hitDiceSpent`)
**Size:** S
**Screen:** No
**SPEC:** §6.4 (`shortRest`, `longRest`); §6.3 (the long rest's hit dice row, "правила отдыха");
§6.7 golden B (Second Wind back on a rest); ADR 004 item 1 (a module's actions, rests among them)

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/rests.ts` — new: `shortRest`, `longRest`, `REST_EVENTS`,
`LONG_REST_MIN_HP`.
- `packages/system-5e/src/hit-dice.ts` — new: `hitDicePath`, `hitDiceSteps` (`hitDice.d<N>.max`).
- `packages/engine/src/trackers.ts` — new: `recoveredOn`, the uses each resource gets back on a
  system's recovery events, a key given twice included.
- `packages/system-5e/src/actions.ts` — new: `hitDiceSpentPath`; `whole` moved here from
  `casting.ts`, which still uses it.
- `packages/system-5e/src/module.ts` — `derive` gains `hitDiceSteps`.
- `packages/system-5e/src/rulesets/edition-rules.ts`, `2014.ts`, `2024.ts` — new fields
  `shortRestMinHp` and `longRestEndsConcentration`.
- `packages/system-5e/src/index.ts` — exports `rests.ts`.
- `packages/engine/test/recovery.test.ts`, `packages/system-5e/test/rests.test.ts` — new;
  `test/rulesets.test.ts` — the new fields; `test/golden/golden-values.test.ts` — golden B's
  Second Wind line; `test/action-checks.ts` — the hit dice and resources a test sets.
- `docs/tickets/BACKLOG.md` — the new row and notes (§11).

#### 2. What is missing now

Measured on `main` at `613e0ed`:
- `grep -rn "shortRest\|longRest\|hitDice\." packages --include=*.ts` finds nothing.
  `hitDiceSpent` is only in the schema and its tests; `longRestHitDice` and `hitDieMinimum` are
  read by no code.
- No computed path gives a character's hit dice: `compute()` on golden B has no path starting
  `hitDice`.
- ENG-30's `regainResource` gives back one key at a time, by a count the caller passes; nothing
  reads a grant's `uses.recovery`.
- Golden B's Second Wind line (SPEC §6.7: "2 uses; a short rest gives back 1, a long rest all")
  is left out of `golden-values.test.ts`, whose header names ENG-21 for it.
- `pnpm test`: `Test Files 53 passed (53)`, `Tests 637 passed (637)`, 9.89 s.

#### 3. What it should look like when done

`stamp` is ENG-20's. Golden A (2014): cleric 1, d8, CON +3, hit point maximum 12, two level 1
slots. Golden B (2024): fighter 1, d10, CON +2, maximum 12, Second Wind 2. Golden B4: fighter 4,
4 d10, maximum 36, Second Wind 3 (the table's level 4). Golden C: wizard 3 (d6) and paladin 3
(d10), CON +1, maximum 6 + 4 + 4 + 6 × 3 + 6 × 1 = 38, slots 4, 3 (2014) and 4, 3, 2 (2024). The
hexer and the spells `character:` are ENG-20's made-up ones. Every value below is worked out by
hand from §8.

**The edition files**
1. `rulesOf(character).shortRestMinHp` is 0 in 2014 and 1 in 2024;
   `.longRestEndsConcentration` is `false` in 2014 and `true` in 2024 (§8).

**Hit dice**
2. Every character computes `hitDice.d6.max`, `hitDice.d8.max`, `hitDice.d10.max`,
   `hitDice.d12.max`: the levels of its classes with that die, one `entity` step per class
   (`value` and `change` its level). A: d8 1, the others 0 with no step. B: d10 1. B4: d10 4.
   C: d6 3 (the wizard's step) and d10 3 (the paladin's). An override of `hitDice.d10.max` 2 on B
   gives 2.

**The core: what a resource gets back** — `recoveredOn(character, computed, events)`
3. On Tales (ENG-27): Ash's luck (1 spent, `scene` all) on `['scene']`: one change, `luck` 1 → 0.
   On `['session']`: none. Brook's focus (`session` 2) with 5 spent, on `['session']`: 5 → 3;
   with 1 spent: 1 → 0.
4. Each grant recovers by the first of `events` it names: a talent with `scene` 1 and `session`
   all, 2 of 2 spent: `['scene', 'session']` gives 2 → 1; `['session', 'scene']` gives 2 → 0.
5. A key two grants give gets back the most either gives: `scene` 1 beside `scene` all, 3 spent:
   0; `scene` 1 beside `scene` 2: 3 → 1; `scene` 1 beside `session` all, on `['scene']`: 3 → 2.
6. An amount is a formula on the computed values, rounded down, never below 0: `@abilities.nerve
   .mod` (Ash's 1): 2 → 1; `1.5`: 2 → 1; `-1`: none; `@nope`: none, and a warning `{ code:
   'recoveryFormula', key, part, warning: { code: 'missingPath', path: 'nope' } }`.
7. A key no grant gives (`state.resources.old: 2`) and a key with none spent give no change.

**Short rest** — `shortRest(character, index, { hitDice }, stamp)`, `hitDice` a list of
`{ die, roll }`: the die's faces and the number it rolled
8. B at 3 spends a d10 rolling 6: 6 + 2 = 8, hit points 3 → 11, `hitDiceSpent.d10` none → 1.
   The entry's `action` is `shortRest`, `subject` `rest`; `outcome.hitDice` is `[{ die: 10,
   roll: 6, hp: 8 }]`.
9. The maximum caps it: B at 10, a d10 rolling 6: 10 → 12. At 12: only the die is spent. With an
   override `hp.max` 6 at 12: hit points stay 12.
10. Several dice: B4 at 10 spends three d10 rolling 4, 7, 10: 6 + 9 + 12 = 27, hit points 10 → 36,
    `hitDiceSpent.d10` 3. C (2024) at 20 spends a d6 rolling 3 and a d10 rolling 5: 4 + 6 = 10,
    hit points 30; `d6` 1, `d10` 1.
11. One die's minimum is the edition's: A with a base CON of 4 (CON 6, −2; maximum 8 − 2 + 1 = 7)
    at 3, a d8 rolling 1: 1 − 2 = −1, at least 0: hit points stay 3, the die is spent, `hp: 0`; a
    d8 rolling 3: 4. B with a base CON of 4 (CON 5, −3; maximum 7) at 3, a d10 rolling 1:
    −2, at least 1: 4; rolling 5: 5.
12. Refusals: B's second d10 in one rest: `noHitDieLeft`, `{ die: 10, left: 1, count: 2 }`; a d8:
    `{ die: 8, left: 0, count: 1 }`; B with `hitDiceSpent.d10` 1 and a d10: `left: 0`. A roll of
    0, 11 or 1.5 on a d10: `badRoll`; a d4 or a d20: `badDie`.
13. Resources on `short`: B with Second Wind 2 spent and no dice: 2 → 1; with 1 spent: 1 → 0.
    Pact slots: B as hexer 3 with 2 spent: 2 → 0. Spell slots stay: A with `slotsSpent` `{ 1: 2 }`
    and no dice: `unchanged`.
14. At 0 hit points: B (2024): `tooFewHitPoints`, `{ hp: 0, min: 1 }`. A (2014) at 0 with 1
    success and 1 failure, a d8 rolling 5: 5 + 3 = 8, hit points 8, death saves 0 and 0. A dead
    character (0 hit points, 3 failures): `dead`, in both editions.
15. Nothing to change (B rested, no dice): `unchanged`.

**Long rest** — `longRest(character, index, stamp)`
16. A (2014) at 3 with 4 temporary, `slotsSpent` `{ 1: 2 }`, `hitDiceSpent.d8` 1, concentrating on
    Bless: hit points 3 → 12, temporary 4 → 0, `d8` 1 → 0 (half of 1 rounded down is 0, at least
    1), slot level 1 2 → 0; concentration stays.
17. B (2024) at 3 with 5 temporary, `d10` 1, Second Wind 2 spent, concentrating on a made-up
    spell: hit points 3 → 12, temporary 5 → 0, `d10` 1 → 0, Second Wind 2 → 0, concentration
    ended.
18. Hit dice, the largest first: C (2014), 6 dice, gets back 3: all 6 spent gives `d10` 3 → 0,
    `d6` stays 3; `d6` 3 and `d10` 1 spent give `d10` 1 → 0, `d6` 3 → 1. C (2024) gets back 6:
    `d6` 3 → 0 and `d10` 3 → 0.
19. Slots: C (2014) with `{ 1: 4, 2: 3 }`: both 0; B as hexer 3 with 2 pact slots spent: 0. B4 with
    Second Wind 3 spent: 0.
20. A resource with only a `short` recovery gets that one on a long rest (`REST_EVENTS`): a made-up
    feature on B, 3 uses, `short` 1, 3 spent: 3 → 2. One with `dawn` only: nothing on either rest.
21. Hit points above the maximum stay (an override `hp.max` 6, at 12); at the maximum with nothing
    spent: `unchanged`.
22. Refusals: A at 0 hit points and B at 0: `tooFewHitPoints`, `{ hp: 0, min: 1 }`; dead: `dead`.

**Golden B** (SPEC §6.7)
23. Second Wind: 2 uses; with both spent a short rest leaves 1 left (`resourceUses`), a long rest
    2.

**Every action**
24. A refusal changes nothing and carries a `code`, its data and an English `message`.
25. Each entry parses with `logEntrySchema`; each character opens with `openFifthEditionCharacter`
    unchanged; `reverseEntry` gives back the character before. Deep-frozen inputs: nothing throws,
    nothing changes.
26. The quality gate is green.

#### 4. How to do it

1. `rulesets/`: the two fields, quoted in §8.
2. `trackers.ts`: `RecoveryWarning`, `recoveredOn`: for each key in `computed.resources` order,
   each grant's first recovery in `events` order; `all` above any count; the change to the uses
   spent, by `changeTo`.
3. `actions.ts`: `hitDiceSpentPath(die)`.
4. `hit-dice.ts`: `hitDiceSteps`, in `derive`. `rests.ts`: `shortRest` and `longRest`, each one
   entry through `settled`, with an `outcome` of the dice spent and the recovery warnings.
5. Tests, then the gate.

Technical choices (ADR 002):
- **A rest is one entry.** The hit dice, hit points, slots and uses a rest changes are one undo,
  as the P6 frames end with one "Undo" (BRIEF Part 3). The short rest takes every die spent in
  it; the screen calls it with the dice rolled so far to show the summary (the action is pure),
  and keeps its result on "Confirm".
- **The roll is a number given.** The app's dice (ENG-08, with the phase 2 die) or the person's
  own throw ("I roll myself", SPEC §6.5) give the face; the action checks it is one of the die's.
- **Hit dice are computed paths**, `hitDice.d<N>.max`, so the sheet shows them with a breakdown
  and an effect or an override can change them. SPEC §5.4's catalogue has no hit dice; the name
  follows `resources.<key>.max`. Every size has its path, 0 when no class has it, so a path never
  comes and goes with a class.
- **The core gives back resources** (`recoveredOn`): `resource` and `uses.recovery` are the
  core's, and a system's recovery events are its keys; the module names which events each rest
  triggers. A long rest triggers `long`, then `short`: dnd5e's `restTypes` (`["lr", "sr"]`) and
  its first-matching recovery (§8). SRD features that come back on a short rest say "a Short or
  Long Rest", so a pack writes `short` once.
- **A key two grants give gets back the most either gives,** `all` above any count. Its maximum
  is already the highest of its grants' (ENG-29); neither depends on the order of the grants, and
  a second source never takes away what the first gives back.
- **An amount is rounded down, never below 0.** Uses spent are whole (ENG-30), and a formula's
  number is the formula's to make whole (ENG-29); a warning is returned, never thrown.
- **The largest hit dice come back first**: the rules let the player pick, and dnd5e's
  `createHitDiceUpdates` gives the largest first by default (§8). One field to reverse.
- **A rest that the rules give no benefit is refused,** not warned: at 0 hit points a long rest
  in both editions, a short rest in 2024 (`tooFewHitPoints`), and a dead character's
  (`dead`). It would change nothing the rules allow, as ENG-20 refuses healing the dead.
- **A count is written 0, not removed,** as `regainSlot` and `regainResource` write it.
- **The edition's long rest ends concentration** where its text puts the character to sleep
  Unconscious (2024). A spell's duration running out is time, which no action tracks (§9).

#### 5. Stored data

Nothing stored changes. Every field written is ENG-33's or ENG-06's. `hitDice.d<N>.max` is a
computed path, not stored.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/recovery.test.ts` — `describe('ENG-21 resources back on recovery
  events')`: §3 items 3–7, on Tales.
- `packages/system-5e/test/rests.test.ts` — `describe('ENG-21 rests')`: §3 items 2, 8–22, 24, 25.
- `packages/system-5e/test/rulesets.test.ts` — the ENG-19 tests of each edition's object: item 1.
- `packages/system-5e/test/golden/golden-values.test.ts` — `describe('ENG-21 goldens: golden
  B')`: item 23.
- Control numbers from: SPEC §6.7 (goldens A, B, B4 and C, Second Wind); the SRD rules of §8;
  ENG-27's Ash and Brook; the rest worked out by hand in §3.

#### 8. Checked against the source

Sources, read 2026-10-03: 5e-bits/5e-srd-api at `e6edf9a51fad4b59a7e9561fad6c15232caed214`
(SRD 5.1 `2014/en/5e-SRD-Rules.json`; SRD 5.2.1 `2024/en/5e-SRD-Traits.json`); foundryvtt/dnd5e
at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (SRD 5.2.1 `packs/_source/content24/appendices/
rules-glossary.yml`; `module/config.mjs`, `module/documents/actor/actor.mjs`,
`module/documents/actor/hit-dice.mjs`, `module/data/shared/uses-field.mjs`). The same commits as
ENG-13 to ENG-20.

**Short rest, SRD 5.1:** "A character can spend one or more Hit Dice at the end of a short rest,
up to the character's maximum number of Hit Dice, which is equal to the character's level. For
each Hit Die spent in this way, the player rolls the die and adds the character's Constitution
modifier to it. The character regains hit points equal to the total. The player can decide to
spend an additional Hit Die after each roll." No word on the hit points it starts with.
**SRD 5.2.1:** "To start a Short Rest, you must have at least 1 Hit Point." "For each Hit Point
Die you spend in this way, roll the die and add your Constitution modifier to it. You regain Hit
Points equal to the total (minimum of 1 Hit Point). You can decide to spend an additional Hit
Point Die after each roll." "Special Feature. Some features are recharged by a Short Rest."
So `shortRestMinHp` 0 and 1; one die's minimum is ENG-19's `hitDieMinimum` (0 and 1; dnd5e
`rollHitDie`). A die's total is regained hit points: never above the maximum, and from 0 they
reset the death saves (ENG-20 §8, both SRDs).

**Long rest, SRD 5.1:** "At the end of a long rest, a character regains all lost hit points. The
character also regains spent Hit Dice, up to a number of dice equal to half of the character's
total number of them (minimum of one die)." "a character must have at least 1 hit point at the
start of the rest to gain its benefits." **SRD 5.2.1:** "To start a Long Rest, you must have at
least 1 Hit Point." "Regain All HP. You regain all lost Hit Points and all spent Hit Point Dice.
If your Hit Point maximum was reduced, it returns to normal." "Ability Scores Restored."
"Exhaustion Reduced. If you have the Exhaustion condition, its level decreases by 1." "Special
Feature. Some features are recharged by a Long Rest." "During sleep, you have the Unconscious
condition." The share of the hit dice is ENG-19's `longRestHitDice` (0.5 and 1). Both: 1 hit
point to start.
Temporary hit points end on a long rest in both (ENG-20 §8: SRD 5.1 "they last until they're
depleted or you finish a long rest"; SRD 5.2.1 "until they're depleted or you finish a Long
Rest"). Spell slots come back on a long rest, and pact slots on a short or long rest, in both
(ENG-20 §8).

**Concentration.** SRD 5.2.1: asleep during a long rest, the character is Unconscious; "You have
the Incapacitated and Prone conditions", and "Your Concentration ends if you have the
Incapacitated condition" (ENG-20 §8). SRD 5.1's long rest "sleeps or performs light activity",
and says nothing of a condition. So `longRestEndsConcentration` `false` and `true`.

**dnd5e.** `config.mjs` `restTypes`: short `recoverPeriods: ["sr"]`, `recoverSpellSlotTypes:
new Set(["pact"])`; long `recoverPeriods: ["lr", "sr"]`, `recoverSpellSlotTypes: new
Set(["spell", "pact"])`, `recoverHitPoints`, `recoverHitDice`, `recoverTemp`, `exhaustionDelta:
-1`. `uses-field.mjs` `recoverUses`: "Search the recovery profiles in order to find the first
matching period", the periods in their order outside, the item's profiles inside. `hit-dice.mjs`
`createHitDiceUpdates({ maxHitDice, fraction=0.5, largest=true })`: `Math.max(Math.floor(this.max
* fraction), 1)`, the classes sorted by die, the largest first.

**Found while reading, other hats** (§11): SRD 5.2.1's human, Resourceful: "You gain Heroic
Inspiration whenever you finish a Long Rest." Exhaustion's level goes down 1 on a long rest in
both (ENG-19 §8).

No golden value is touched; no rules source disagrees with the SPEC. Nothing stops.

#### 9. Not in this ticket

- Exhaustion down by 1 on a long rest: a condition is a pack's entry, its schema says nothing of
  rests, and the module names no condition (ENG-20 §4). New row (§11).
- Heroic Inspiration on a long rest (the 2024 human's Resourceful): ENG-59's note (§11).
- A spell grant's own uses back on a rest: ENG-57 stores them, and adds them to these rests.
- A reduced hit point maximum or ability score back to normal (SRD 5.2.1): no tracker stores one
  (ENG-19 §8).
- A spell's duration running out, and one long rest in 24 hours: the app tracks no time; the
  person ends concentration with `endConcentration`.
- The recovery events `dawn`, `turn` and `manual`: no action triggers them yet (§11).
- The rest screens, the hit dice on the sheet, the uses' recovery label: phase 2.

#### 10. Rake check

- **Each system's rules live in its module; no `if (ruleset === …)`.** The rests are
  `system-5e`'s; their two edition differences are fields read through `rulesOf`. The core's
  `recoveredOn` names no event: the module passes them.
- **Everything is data.** A resource's recovery is its grant's; the Constitution modifier is
  `RULE_STATS.hitPoints`'s; the hit die sizes are `HIT_DIE_SIZES`.
- **A number shown has a breakdown.** `hitDice.d<N>.max` has a step per class.
- **Formulas never run code; a missing path is 0 and a warning.** A recovery amount goes through
  `evaluateNumber`; its warning is returned.
- **Missing is not broken.** A class no pack has gives no hit dice; a key no grant gives keeps its
  count.
- **Measure, never estimate.** Every expected value is worked out in §3 from §8.
- **The engine is pure.** The caller gives the stamp and the rolls; the frozen-input tests.
- **A stored-shape change needs a migration.** None changes (§5).
- **Licensing.** The SRDs are quoted in this ticket only; the test entities are made up.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-03, on `main` at `613e0ed`:
- Before: `pnpm test` `Test Files 53 passed (53)`, `Tests 637 passed (637)`, 9.89 s.
- After: `pnpm lint` `Checked 178 files`, no error; `pnpm typecheck` 6 of 6 `Done`; `pnpm test`
  `Test Files 55 passed (55)`, `Tests 660 passed (660)`, 10.03 s; `pnpm build` `apps/web build:
  Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- ENG-54 and ENG-53 reached `main` while this ticket was built; it was rebased onto `fb32b73`.
  `main` alone, measured there: `Test Files 53 passed (53)`, `Tests 660 passed (660)`, 9.93 s;
  lint `Checked 174 files`. Rebased: `pnpm lint` `Checked 178 files`, no error; `pnpm typecheck`
  6 of 6 `Done`; `pnpm test` `Test Files 55 passed (55)`, `Tests 683 passed (683)`, 10.30 s.
  ENG-53 took the id ENG-60 for its own row, so the row found here is ENG-61.
- This ticket's 23 tests: `recovery.test.ts` 6 (653 ms alone), `rests.test.ts` 16 (1.07 s alone),
  golden B's line 1. `rulesets.test.ts` keeps its 5 tests, each edition's object with the two new
  fields.
- Golden B, through the actions: Second Wind 2 left; `useResource` 2: 0 left; `shortRest`: 1 left;
  `longRest` from 0: 2 left. That was the last open line of goldens A to E; the golden values
  file's header says so.
- The tests catch mistakes. 27 breaks, each made alone in the code, then `recovery.test.ts`,
  `rests.test.ts`, `rulesets.test.ts` and `golden-values.test.ts` run (59 tests); each break failed
  at least one test, and each was undone: the events' order ignored, 4 fail; a key given twice
  following its last grant, 1; following the least, 1; an amount not rounded down, 1; `all` as one
  use, 5; the formula warnings dropped, 2; no Constitution on a hit die, 4; no hit die minimum, 1;
  a short rest past the maximum, 2; a short rest keeping the pact slots, 1; a short rest giving
  `long` uses, 2; a short rest at any hit points, 1; one hit die more than left, 2; no death save
  reset, 1; hit dice smallest first, 1; no minimum of one die, 1; every hit die back in 2014, 1;
  temporary hit points kept, 2; concentration always ended, 1; a long rest giving only `long`
  uses, 1; a long rest lowering hit points to the maximum, 1; the dead resting, 1; a long rest at
  0 hit points, 1; a long rest keeping the slots, 3; one hit die per class, not per level, 3; 2024's
  short rest at 0, 2; 2024 keeping concentration, 2.

Differences from §3:
- `hitDiceSteps` is in a file of its own, `hit-dice.ts`, not in `rests.ts`: `rests.ts` imports
  `module.ts` to compute, and `module.ts` imports the steps, so one file each keeps the two from
  importing each other. §1 says so.
- `whole` (a computed count, whole and never below 0) moved from `casting.ts` to `actions.ts`, so
  the rests read the hit dice as `castSpell` reads the slots. No behaviour changed; ENG-20's
  tests pass unchanged.
- The first run of `rests.test.ts` failed 1 of 16: the test's hexer 3 kept golden B's 12 hit
  points, below its own maximum of 16 (8 + 1 + 1, CON +2 at 3 levels), so the long rest rightly
  raised them. The test data now starts at 16; no expected value changed.
- §3 gained: a key's grants in either order give the same (item 5); a resource whose amount reads
  a missing path, through `longRest`'s `outcome.warnings` (item 20).

Against the row and its note:
- "Which recovery a key given twice follows": the most either grant gives back, `all` above any
  count (§4), as its maximum is the highest of its grants'.
- `longRestHitDice` and `hitDieMinimum` are read (`rests.ts`). Two more differences, read in both
  SRDs (§8): `shortRestMinHp` and `longRestEndsConcentration`.
- SRD 5.2.1's reduced maximum and scores back to normal: no tracker stores them (§9), as ENG-19
  found.
- Temporary hit points end, spell slots come back on a long rest, pact slots on both (ENG-20's
  note). Golden B's Second Wind line is in.

Found, not fixed:
- A long rest lowers exhaustion by 1 in both SRDs (ENG-19 §8; SRD 5.2.1 "its level decreases by
  1"). A condition's schema has only `maxLevel`, and the module names no condition. New row
  ENG-61 in `BACKLOG.md`.
- SRD 5.2.1's human, Resourceful: "You gain Heroic Inspiration whenever you finish a Long Rest."
  Golden B is that human; no data shape gives inspiration on a rest. Noted on ENG-59.
- The recovery events `dawn`, `turn` and `manual` (`fifthEditionLists`) are triggered by no
  action; a magic item's charges back at dawn need one. The uses' label ("1 back on a short
  rest, all on a long rest", BRIEF Part 5) reads `Computed.resources[].uses.recovery`; an amount
  that is a formula has no computed value with a breakdown to show. Noted for phase 2.
- A spell grant's own uses (ENG-57) come back by their `recovery` once ENG-57 stores them; its
  note now names `recoveredOn` and `REST_EVENTS`.

Nothing for the changelog.

---

### ENG-46 Armor worn without training

**Hat:** Armor worn without training has its edition's penalties
**Depends on:** ENG-09 (the armor proficiency keys), ENG-13 (`proficiencySources`), ENG-14
(`armor.worn`, `shield`, the AC paths), ENG-16 (`attacks.<key>.*`), ENG-19 (`rulesets/`), ENG-34
(`modeOf`, the mode paths), ENG-43 (a skill's stat), ENG-44 (`equipmentOf`)
**Size:** S
**Screen:** No
**SPEC:** §5.3 (`ItemDef.armor`, the shield's effect); §5.5 (`proficiency` grants of the category
`armor`); §6.1 step 5; §6.3 (2014/2024 differences); §6.5 (disadvantage); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/training.ts` — new: whether the armor and the shield worn
have their training, the paths `armor.untrained`, `shield.untrained`, `spell.cannotCast`, the
roll-mode sources, and the shield effects a 2024 shield without training loses.
- `packages/engine/src/compute.ts` — changes: `SystemModule.suppressedEffects`, asked once
  gathering is done; the parts it names are marked on their entities.
- `packages/engine/src/gather.ts` — changes: `HadEntity.suppressed`, the ids of an entity's
  effects a module suppressed.
- `packages/engine/src/effects.ts` — changes: `activeEffects` leaves a suppressed effect out.
- `packages/system-5e/src/rulesets/edition-rules.ts`, `2014.ts`, `2024.ts` — change: the field
  `untrained`, what an armor and a shield worn without training do.
- `packages/system-5e/src/rolls.ts` — changes: each Strength and Dexterity check, save, skill and
  initiative mode gains the training sources.
- `packages/system-5e/src/attacks.ts` — changes: each weapon attack's mode gains them.
- `packages/system-5e/src/combat.ts` — changes: a shield that loses its AC adds no magic bonus;
  `ac.bonus` names the rule.
- `packages/system-5e/src/module.ts`, `index.ts` — change: `derive` joins the training paths;
  `suppressedEffects`; export.
- `packages/system-5e/test/training.test.ts` — new.
- `packages/engine/test/phases.test.ts` — changes: suppressed effects, on Tales.

#### 2. What is missing now

Measured on `main` at `613e0ed`:
- `grep -rni "untrained\|training" packages/system-5e/src packages/engine/src` finds nothing.
- Golden C (2014) with only its wizard 3 (no paladin, so no armor proficiency at all:
  `proficiencies` of the category `armor` is `[]`), wearing the SRD chain mail and shield:
  `ac.base` 16, `ac.bonus` 2, `ac.total` 18; every roll mode 0 but `skills.stealth.mode` −1 (the
  chain mail's own Stealth rule, ENG-34); `warnings` `[]`. Nothing says the armor is worn without
  training, no Strength or Dexterity test has disadvantage, and nothing says the character cannot
  cast spells.
- No edition field says what a shield without training does; SRD 5.2.1 takes its AC away (§8).
- The core has no way for a module to switch off an effect once gathering is done; the shield's
  +2 is its own effect (SPEC §5.3), and ENG-44's `dormant` is decided before gathering, when the
  character's proficiencies are not known yet.
- `pnpm test`: `Test Files 53 passed (53)`, `Tests 637 passed (637)`.

#### 3. What it should look like when done

1. **Training.** The armor worn (ENG-44) has its training when a `proficiency` grant of the
   category `armor` names its `armor.group` (`light`, `medium`, `heavy`) or its own `key`; the
   shield worn when one names `shield` or its own `key` (ENG-09 §4). An armor carried and not
   equipped, or a second one that counts for nothing (ENG-44), is not judged. Goldens A (the
   cleric's `light`, `medium`, `shield`, the Life Domain's `heavy`), B and B4 (the fighter's four)
   have their training: every golden value stays, and every golden computes with no warning.
2. **`armor.untrained`** is 1 when the armor worn lacks its training, with one step
   `{ kind: 'entity', source: <the armor>, label: <its name>, value: 1, change: 1 }` and the
   warning `{ code: 'stepRule', path: 'armor.untrained', rule: 'untrainedArmor', data: { item:
   <the armor> } }`; else 0, with no step and no warning. **`shield.untrained`** the same for the
   shield worn, rule `untrainedShield`.
3. **The edition field `untrained`** (`rulesets/`), the penalties of each kind of item:

   | | armor | shield |
   |---|---|---|
   | 2014 | `disadvantage`, `noSpells` | `disadvantage`, `noSpells` |
   | 2024 | `disadvantage`, `noSpells` | `noArmorClass` |

4. **Disadvantage.** Each item without training whose penalties hold `disadvantage` gives a
   source `{ kind: 'rule', rule: 'untrainedArmor' | 'untrainedShield', value: -1, change }`, after
   the test's other rule sources, to each d20 test of Strength or Dexterity: `checks.str.mode`,
   `checks.dex.mode`, `abilities.str.saveMode`, `abilities.dex.saveMode`, each skill's mode whose
   stat (its key path, ENG-43) is `str` or `dex`, `init.mode` (a Dexterity check), and each weapon
   attack's mode (its stat is `str` or `dex`, ENG-16). Not `spell.attackMode`, not
   `deathSave.mode`, not a check, save or skill of another stat.
5. **No spells.** `spell.cannotCast` is 1 when an item without training has `noSpells`, with a
   step `{ kind: 'rule', rule: 'untrainedArmor' | 'untrainedShield', value: 1, change }` for each
   (the first's change 1, a second's 0); else 0, with no step.
6. **A 2024 shield's AC.** When the shield worn lacks its training and has `noArmorClass`, its own
   effects on a target starting `ac.` are suppressed (never applied), its `magic.bonus` is not
   added, and `ac.bonus` gains the step `{ kind: 'rule', rule: 'untrainedShield', value: 0,
   change: 0 }`. Its other effects apply, and `shield` stays 1.
7. **Worked values** (each from §8 and the data, by hand). Golden C keeps STR 13, DEX 10; "the
   wizard" is golden C with only its wizard 3.
   - The wizard (2014) in chain mail: `armor.untrained` 1; `checks.str.mode`, `checks.dex.mode`,
     both saves' modes, `skills.acrobatics.mode`, `.athletics.mode`, `.sleightOfHand.mode`,
     `init.mode` −1, each with one step, `untrainedArmor` −1, change −1; `skills.stealth.mode` −1
     with two steps, the chain mail's −1 (change −1) and `untrainedArmor` −1 (change 0); the 4
     other checks and saves, the 14 other skills, `spell.attackMode` and `deathSave.mode` 0;
     `spell.cannotCast` 1; AC 16 as before; one warning.
   - The wizard (2014) in chain mail with the SRD shield: AC 18 (16 + the shield's 2, kept in
     2014); each Strength or Dexterity mode above −1, its training steps `untrainedArmor` (change
     −1 where it is the first source) and `untrainedShield` (change 0); `spell.cannotCast` 1, its
     steps' changes 1 and 0; two warnings. With the shield alone: `armor.untrained` 0,
     `shield.untrained` 1, every Strength or Dexterity mode −1 by `untrainedShield`, AC 12
     (10 + DEX 0 + 2).
   - Golden C (2014: the paladin's multiclass gives `light`, `medium`, `shield`) in chain mail
     and the shield: `armor.untrained` 1, `shield.untrained` 0, one warning.
   - The wizard (2014) in chain mail with the SRD warhammer: `attacks.warhammer.mode` −1.
   - The wizard (2024) in chain mail: the same modes as the 2014 wizard, `spell.cannotCast` 1.
   - The wizard (2024) with a made-up shield (+2 `ac.bonus` `when: '@equipped'`, `magic.bonus`
     1, +1 `init.bonus` `when: '@equipped'`): `shield.untrained` 1; `ac.base` 10, `ac.bonus` 0
     with the one rule step, `ac.total` 10; `init.bonus` 1; every mode 0; `spell.cannotCast` 0;
     the shield gathered with `suppressed: ['ac']`; one warning. Golden C (2024: the paladin gives
     `shield`) with it: `ac.bonus` 3, `ac.total` 13, no warning.
   - A made-up feat giving the armor proficiency `chainMail` makes the wizard's chain mail
     trained.
   - An effect setting `skills.arcana.ability` to `dex` gives the wizard in chain mail
     `skills.arcana.mode` −1; one setting `skills.athletics.ability` to `int`, 0.
8. **The core** (game-free): a module's `suppressedEffects(input)` names effect parts once
   gathering is done; `compute` marks each on its gathered entity as `suppressed` (its effect ids,
   in the entity's order) before the base phase, and `activeEffects` leaves them out, so they
   apply in no phase and through no op: a number, an `append`, a roll mode, a key `set`. A toggle
   switched on or a `when` that is true does not bring one back. A part naming no effect of a
   gathered entity changes nothing. A module without the hook suppresses nothing. Tested on
   Tales.
9. `compute()` stays pure: frozen inputs give equal results. The quality gate is green.

#### 4. How to do it

1. `gather.ts`: `HadEntity.suppressed?: readonly string[]`. `effects.ts`: `activeEffects` skips
   an effect whose id it lists.
2. `compute.ts`: `suppressedEffects?(input: DeriveInput<C, E>): readonly EntityPartId[]`; `stats`
   is worked out right after gathering (it reads only `gathered`), the hook is asked, and the
   marked `gathered` is what the base phase, the derived values, the phases and `Computed` get.
3. `rulesets/`: `UntrainedPenalty`, `untrained` in `EditionRules`, each edition's value.
4. `training.ts`: `untrainedOf(input)` (the armor, then the shield, worn without training, each
   with its penalties), `trainingSteps(input)` (the three paths), `trainingSources(input, stat)`
   (a test's rule sources), `untrainedShieldEffects(input)` (the hook's parts),
   `shieldLosesAC(input)`.
5. `rolls.ts`, `attacks.ts`, `combat.ts`, `module.ts`: read them.
6. Tests (§7), then the backlog (§11).

Technical choices (ADR 002):
- **Training is decided from what the character has**, once gathering is done: the grants'
  proficiencies and the items worn. The paths `armor.untrained` and `shield.untrained` show it with
  its breakdown; the penalties read the same decision, not the paths, as `ac.base` and the Stealth
  rule read `equipmentOf` and not `armor.worn`. An override on `armor.untrained` changes that path
  only; the way to give a character training is a proficiency grant (a feat, a feature).
- **A shield's AC is suppressed by the core, not left out by the module.** The shield's +2 is its
  own effect (SPEC §5.3), and only gathering knows the proficiencies; ENG-44's choices (leave the
  item out, or name it dormant) are made before gathering, and either would also drop a magic
  shield's other benefits (an advantage, a resistance), which the rule keeps: "You gain the Armor
  Class benefit of a Shield only if you have training with it" (§8). So the module names the
  shield's effects on `ac.*` targets, and the core never applies them. The core learns that a
  module may switch an effect off after gathering; it does not learn why. Foundry calls such an
  effect suppressed.
- **The warning comes once per item**, on its own path, as ENG-44's `oneAtATime`: an untrained
  shield in 2024 makes the AC lower with nothing on the item saying why, and "cannot cast spells"
  is shown by no number yet.
- **"Cannot cast spells" is a path and a warning, not a refused cast.** SPEC §8.2: rules warn,
  they never block. `castSpell` (ENG-20) does not read it; the sheet's cast button does (phase 2).
  Making `castSpell` refuse later is one check of `spell.cannotCast`.
- **The stats are a named constant**, `UNTRAINED_STATS = ['str', 'dex']`, as ENG-14's
  `RULE_STATS`: the rule names Strength and Dexterity, and a custom stat is never one of them.
- **A spell attack is left out.** Its mode is one path for every spell attack (ENG-34), its stat
  is each caster's (never `str` or `dex` in the SRDs), and the same rule forbids casting at all.
- **An item's own key gives its training too**, as ENG-16 reads a weapon's `key` and dnd5e reads
  the armor's base item (§8). The SRD grants groups and `shield` only; a homebrew grant may name
  one armor.
- **The rule sources come after the test's others**: Stealth's armor, then the training; a
  Heavy weapon, then the training. The mode is the same in any order (ENG-34: any disadvantage
  gives −1).

#### 5. Stored data

Nothing stored changes. No schema, no `schemaVersion`, no Dexie table. `suppressed` is computed,
on `Computed.entities`.

#### 6. What a person will see

Not a screen. The sheet's "no training" mark, the disadvantage marks and the cast button are
phase 2's, reading the paths and the warnings.

#### 7. Tests

- `packages/system-5e/test/training.test.ts` — `describe('ENG-46 armor without training')`: §3
  items 1–7 and 9, on golden C (both editions) and its wizard, with the SRD chain mail, shield and
  warhammer and made-up items, feats and effects (`character:`).
- `packages/engine/test/phases.test.ts` — `describe('ENG-46 suppressed effects')`: §3 item 8, on
  Tales.
- The goldens' own tests (`golden-values.test.ts`, `combat.test.ts`, `rolls.test.ts`): unchanged
  values, no warning.
- Control values from: the SRD texts of §8 and the data (golden C's scores, the items), each
  worked out by hand before the run.

#### 8. Checked against the source

Sources, read 2026-10-03: SRD 5.1 as foundryvtt/dnd5e quotes it at `7bfb3f1`
(`packs/_source/rules/chapter-5-equipment.yml`); SRD 5.2.1 as dnd5e quotes it
(`packs/_source/content24/chapter-6/equipment.yml`, `appendices/rules-glossary.yml`,
`chapter-1/d20-tests.yml`); 5e-bits/5e-srd-api at `e6edf9a`
(`packages/5e-database/src/{2014,2024}/en/5e-SRD-Equipment.json`, read with python3); dnd5e's code
at `7bfb3f1` (`module/`). The same commits as ENG-13 to ENG-34. All CC-BY-4.0.

**SRD 5.1, Armor Proficiency.** "Anyone can put on a suit of armor or strap a shield to an arm.
Only those proficient in the armor's use know how to wear it effectively, however. Your class
gives you proficiency with certain types of armor. If you wear armor that you lack proficiency
with, you have disadvantage on any ability check, saving throw, or attack roll that involves
Strength or Dexterity, and you can't cast spells." The Armor table's last category is "Shield"
(Shield, 10 gp, AC "+2", 6 lb.), beside Light, Medium and Heavy Armor; "Shields. … Wielding a
shield increases your Armor Class by 2." So in 2014 a shield is armor: without proficiency it gives
the disadvantage and stops spells, and nothing takes its +2 away.

**SRD 5.2.1, Armor Training.** "Anyone can don armor or hold a Shield, but only those with training
can use them effectively, as explained below. A character's class and other features determine the
character's armor training. … Light, Medium, or Heavy Armor. If you wear Light, Medium, or Heavy
armor and lack training with it, you have Disadvantage on any D20 Test that involves Strength or
Dexterity, and you can't cast spells. Shield. You gain the Armor Class benefit of a Shield only if
you have training with it." So in 2024 a shield without training gives no disadvantage and stops
no spell; it gives no AC.

**D20 Tests.** SRD 5.2.1 (rules glossary): "D20 Tests encompass the three main d20 rolls of the
game: ability checks, attack rolls, and saving throws." (`d20-tests.yml`: "they come in three kinds:
ability checks, saving throws, and attack rolls"). SRD 5.1 names the same three. A skill check is
an ability check of its stat ("Dexterity (Stealth) checks"), initiative a Dexterity check, a weapon
attack uses Strength (melee) or Dexterity (ranged, finesse either), and a death save is tied to no
ability (ENG-34 §8 quotes each). So the tests "that involve Strength or Dexterity" are §3 item 4's.

**The shield is armor in the data.** 5e-database 2014 `shield`: `equipment_category` `armor`,
`armor_category` `Shield`, `armor_class.base` 2; 2024 `shield`: `equipment_categories` `armor` and
`shields`.

**dnd5e.** `config.mjs`: `armorTypes` holds `light`, `medium`, `heavy`, `natural`, `shield`;
`armorProficienciesMap` maps `light` → `lgt`, `medium` → `med`, `heavy` → `hvy`, `shield` → `shl`
(`natural` and `clothing` need none). `data/item/equipment.mjs` `proficiencyMultiplier`: proficient
when the actor has the type's proficiency or the item's base item (`actorProfs.has(itemProf) ||
actorProfs.has(this.type.baseItem)`). It computes no penalty from it: `armorProf` is read only
there (`grep -rn armorProf module`), the item's proficiency is only shown on its chat card
(`data/item/templates/equippable-item.mjs`), and `prepareArmorClass` adds `ac.shield` whatever the
training. The SRDs are followed here.

**The goldens.** A: the cleric's `light`, `medium`, `shield` and the Life Domain's Bonus Proficiency
`heavy` (SPEC §6.7: "тяжёлый доспех — от домена Жизни"): chain mail and the shield trained. B, B4,
D, E: the fighter's `light`, `medium`, `heavy`, `shield`. C: no item. No golden value changes;
nothing stops.

#### 9. Not in this ticket

- The sheet: a "no training" mark on the armor, the disadvantage marks, the cast button reading
  `spell.cannotCast`: phase 2.
- `castSpell` refusing a cast while `spell.cannotCast` is 1 (§4): not done; phase 2 reads the path.
- SPEC §5.4's `prof.armor` as a target an effect appends to: no path computes it yet; training is
  read from the grants. When it is computed, `untrainedOf` reads it.
- Tool checks: no path computes one yet (ENG-34 §9).
- A spell's own attack mode or save DC changing with armor: none in either SRD.

#### 10. Rake check

- **The golden tests are the truth.** No golden value changes; §8 shows each golden has its
  training. Every expected value is worked out from §8 and the data before the run.
- **`packages/engine` is pure; the core names no game.** `suppressedEffects` names parts; the core
  marks and skips them; it names no item, armor or rule. Tested on Tales.
- **Everything is data.** The keys compared are the item's own fields (`armor.group`, `category`,
  `key`); the two stats are one named constant; each skill's stat is read from its key path.
- **`compute()` is pure; a number with no breakdown entry is a bug.** Every new path and source
  has its step; `ac.bonus` names the rule that keeps the shield's AC out.
- **Manual overrides always win.** The new paths are finished by ENG-17's phases.
- **Each system's rules live in its own module; no `if (ruleset === …)`.** What an item without
  training does is `rulesOf(character).untrained`.
- **Missing is not broken; prerequisites warn.** A missing item is not worn (ENG-44); no training
  warns and never blocks a cast.
- **Licensing.** The made-up items and feats have no rules text; §8 quotes the SRDs (CC-BY-4.0).

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-03, on `main` at `613e0ed`:
- `pnpm lint`: `Checked 176 files`, no errors (174 before, measured; 2 new files).
- `pnpm typecheck`: 6 projects, all `Done`.
- `pnpm test`: `Test Files 54 passed (54)`, `Tests 650 passed (650)`, 8.09 s (before: 53 files,
  637 tests). This ticket's 13: 10 in `training.test.ts`, 3 in `phases.test.ts`.
- `pnpm build`: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- ENG-54, ENG-53 and ENG-21 reached `main` while this ticket was pushed; it was rebased onto
  `d7a18da`. Conflicts: `compute.ts` (ENG-54 made `statDefaults` a function of the character),
  `module.ts`'s header, the edition files and their test (ENG-21 added two fields; both sides
  kept), `BACKLOG.md` and the archive. There: `pnpm lint` `Checked 180 files`, no errors;
  `pnpm typecheck` 6 projects `Done`; `pnpm test` `Test Files 56 passed (56)`, `Tests 696 passed
  (696)`, 8.32 s (`main` alone, measured: 55 files, 683 tests, 178 files linted); `pnpm build`
  `Done`.
- §3 item 7's values, each worked out by hand before the run: the 10 tests of `training.test.ts`
  passed on their first run. The 2014 wizard in chain mail: 9 modes −1 (STR and DEX checks and
  saves, Acrobatics, Athletics, Sleight of Hand, Stealth, initiative), the other 24 of its 33 mode
  paths 0; `spell.cannotCast` 1; AC 16. With the SRD shield: AC 18, two training steps on each.
  The 2024 wizard with the made-up shield: AC 10, `init.bonus` 1, the shield gathered with
  `suppressed: ['ac']`; trained (golden C's paladin), AC 13.
- Every golden computes with its values unchanged and no warning. Golden B4 has 189 values (186
  before: `armor.untrained`, `shield.untrained`, `spell.cannotCast`).
- One compute of golden B4 in this container, 500 runs, 5 rounds: 0.530 to 0.649 ms before; after,
  three runs, 0.521 to 0.715 ms, but for the first run's first two rounds, 1.224 and 1.309 ms
  (SPEC §6.6's limit is 10 ms; the benchmark is ENG-23's).
- The tests bite. 14 breaks, each on its own and restored, every test run: an item's own key
  ignored, 1 fails; `con` among the stats, 3; no 2014 shield penalty, 2; the 2024 shield keeping
  its AC, 2; the core ignoring `suppressed`, 3; the shield's magic bonus kept, 1; a skill's own
  stat read in place of its key path, 1; no weapon attack penalty, 1; no initiative penalty, 3; no
  save penalty, 3; every effect of the shield suppressed, 1; each `spell.cannotCast` step changing
  it by 1, 1; no warning, 11; no `ac.bonus` rule step, 1.

Differences from §3: none in values. While building:
- Six tests of earlier tickets put golden B's chain mail on a class that gives no armor training
  (the made-up scribe, no class, the made-up warden 5, hexer 3 and mystic 1): 3 ENG-13 tests
  (`module.test.ts`) and 3 ENG-15 tests (`spellcasting.test.ts`) now expect the one
  `untrainedArmor` warning; their data did not change. 13 ENG-15 lists of paths (in 8 tests)
  gain `spell.cannotCast`: 1 for golden B with the warden 5, the hexer 3 and the mystic 1, 0 for
  the other 10. The ENG-19 test of the edition files gains `untrained`. No other value changed.
- The Tales test first expected Veil gathered before Night Warden; gathering gives each entity
  followed by what it gives (`Gathered.entities`), so the warden's Night Warden and Quick Step come
  first. The expectation was corrected; no code changed.
- Typecheck refused two test helpers' types (a part id cast, a union of two characters); both
  typed again, no value changed.

Against the row and its notes:
- Each note is done: the disadvantage and no spells in both editions; the 2024 shield's AC; the
  keys `light`, `medium`, `heavy`, `shield` compared with `armor.group` and `category`; a rule
  source through `modeOf`; the field in the edition files; the worn items from `equipmentOf`.
- The note offered two ways for the shield, leaving it out of `equipmentOf` or naming it dormant.
  Neither was used (§4): both are decided before gathering knows the proficiencies, and both would
  drop a magic shield's other benefits. A core hook suppresses its AC effects.
- The note did not say what a 2014 shield without training does. SRD 5.1's Armor table lists the
  shield as armor, so it gives the disadvantage and stops spells, and keeps its +2 (§8). The SPEC
  says nothing against it, so it is not a stop.
- Size S held.

Found, not fixed:
- `castSpell` (ENG-20) does not read `spell.cannotCast` (§4). A phase 2 note in `BACKLOG.md`.
- SPEC §5.4's targets `prof.armor`, `prof.weapon`, `prof.tool`, `prof.language` are computed by no
  path; an effect on one changes nothing. Proficiencies come only from grants, which ENG-13,
  ENG-16 and this ticket read. A phase 3 note in `BACKLOG.md`.

Nothing for the changelog: no screen shows armor training yet.

---

### ENG-59 Inspiration is gained or spent up to its maximum · XS

**Hat:** Inspiration is gained or spent up to its maximum
**Where:** `packages/system-5e/src/inspiration.ts` — new: `gainInspiration`, `spendInspiration`.
`actions.ts` gains `INSPIRATION_PATH`; `index.ts` exports the file.
**Depends on:** ENG-20 (`settled`, the shared action paths), ENG-33 (`state.inspiration`,
`houseRules.inspirationMax`), ENG-19 (`rulesOf(...).inspiration`)
**Screen:** No

**What it should look like when done:**
1. `gainInspiration(character, stamp)` adds 1 to `systemData.state.inspiration`, as one log entry:
   action `gainInspiration`, subject `inspiration`, one change on `systemData.state.inspiration`.
2. The most it reaches is `houseRules.inspirationMax`, not the SRDs' 1: with the default house
   rules (3, ADR 009 item 5) three gains from 0 give 1, 2, 3. At the maximum a gain is refused as
   `unchanged`: the inspiration gained is lost. Both SRDs say so at their maximum of 1, quoted in
   ENG-19 §8 (SRD 5.1 "you can't stockpile multiple inspirations"; SRD 5.2.1 "If you gain Heroic
   Inspiration but already have it, it's lost"). The goldens hold at most 1: a gain from 0 gives
   1, a second is refused.
3. `spendInspiration(character, stamp)` takes 1 away, as one entry of action `spendInspiration`;
   at 0 it is refused as `unchanged`. What spending does to a roll (2014 advantage, 2024 a reroll)
   is `rulesOf(...).inspiration.use`, read by phase 2's dice; the action does not roll.
4. Both actions change no input, and reversing the entry gives the character back.
5. No rules fact is new: the two rules above are ENG-19 §8's, so there is no §8. Nothing stored
   changes: `state.inspiration` and `inspirationMax` are ENG-33's. No screen. It stays XS.

**Tests:** `packages/system-5e/test/inspiration.test.ts` — gain and spend on golden A (2014) and
golden B (2024) with their maximum of 1; three gains to the default house rules' 3, then a refusal;
a spend from 3 to 2; frozen inputs. `action-checks.ts` gains the `inspiration` tracker and the
`INSPIRATION` path. Control numbers: the goldens' `inspirationMax` 1 (`character-parts.ts`),
`DEFAULT_HOUSE_RULES.inspirationMax` 3 (ADR 009 item 5), counted by hand.

**What came out of it:**

Measured on 2026-10-03, on top of `b212371`:
- `pnpm lint`: `Checked 182 files`, no errors (180 before, ENG-46 §11; 2 new files).
- `pnpm typecheck`: 6 projects, all `Done`.
- `pnpm test`: `Test Files 57 passed (57)`, `Tests 703 passed (703)`, 9.09 s (before: 56 files,
  696 tests). This ticket's 7, all in `inspiration.test.ts`, passed on their first run.
- `pnpm build`: `apps/web build: Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- The tests bite. 4 breaks, each on its own and restored: no cap on a gain, 3 fail; the SRDs' 1
  in place of the house rules' maximum, 1; no floor on a spend, 2; the spend logged as
  `gainInspiration`, 2.

Differences from the row and its note:
- The note's SRD 5.2.1 rule, "lost unless given away": the loss is the `unchanged` refusal at the
  maximum. Giving it to another character is a move between two characters, which the table link
  owns (ADR 005 item 5); nothing in this ticket.
- The note's Resourceful (SRD 5.2.1's human, "You gain Heroic Inspiration whenever you finish a
  Long Rest", ENG-21 §8; golden B is that human) is not done here. It needs a data shape that says
  a feature gives inspiration on a rest, and a change to `longRest` (`rests.ts`): a second
  function and a rules fact, so not XS. Re-cut as a new row, **ENG-62** (S), in `BACKLOG.md`.

Found, not fixed: nothing beyond ENG-62.

Nothing for the changelog: no screen shows inspiration yet.
