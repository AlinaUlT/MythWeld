# ENG — The game-free core and the fifth-edition module

**Why this theme:** Every number the app shows comes from the engine, and a wrong rule gives a
wrong number with no error. This theme builds the schemas, formulas, dice, effects and the
`compute()` pipeline, with no UI: first the core, which knows no game and is tested on a made-up
system, then the fifth-edition module as its own package (ADR 004). The golden tests of SPEC §6.7
are its proof.
**SPEC:** stage 1, sections §4.1, §5, §6; ADR 004, ADR 005
**Order and status:** [`BACKLOG.md`](BACKLOG.md) — never repeated here.
**Theme is closed when:** every ENG row is ✅ or ❌, and the phase 1 gate named in `BACKLOG.md`
(SPEC §12 stage 1, widened by ADR 004 and ADR 005) is proved.
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections above,
ADR 004.

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
