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
