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
