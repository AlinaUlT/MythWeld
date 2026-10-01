# Backlog

**The one place a ticket is ticked off.** Order, size and status for every ticket live here and
nowhere else. The expanded tickets live in `docs/tickets/<AREA>_TICKET.md`. How a ticket runs is in
[`README.md`](README.md).

| Column | Meaning |
|---|---|
| **ID** | `<AREA>-<NN>`, never reused. Areas are in [`README.md`](README.md). |
| **Hat** | One phrase, no "and". |
| **Size** | XS up to 1 h · S 1–3 h · M half a day. |
| **Status** | 🔲 not started · 🚧 in work · ✅ with the date · ❌ cancelled with a reason |

**Rows are written when a phase opens, not earlier.** A cut is a first guess: re-cut it when the
work shows it is wrong, and say so in the ticket's §11.

**Notes under a table are for open rows only.** When a row closes, its note is deleted; the
ticket in `docs/archive/tickets/` holds it.

**A phase closes** when all its rows are closed **and** that stage's "Готово, когда" list in
SPEC §12 has been shown true in the chat. The list is not copied here; SPEC §12 owns it.

---

## Phase 0 — The scaffold (SPEC stage 0)

Gate: SPEC §12 stage 0, with the English-only screenshot from ADR 000.

**Closed 2026-09-28.** The gate's proof is in SETUP-09 §11, in
[`docs/archive/tickets/SETUP_TICKET.md`](../archive/tickets/SETUP_TICKET.md).

| ID | Hat | Size | Status |
|---|---|---|---|
| SETUP-01 | An empty pnpm monorepo with the six packages builds and lints | S | ✅ 2026-09-27 |
| SETUP-02 | Vitest and Playwright (Pixel 7) each run one passing test | S | ✅ 2026-09-27 |
| SETUP-03 | CI runs lint, typecheck, test and build on every push to `main` | XS | ✅ 2026-09-27 |
| SETUP-04 | The app shell shows the bottom bar with four empty tabs | S | ✅ 2026-09-27 |
| SETUP-05 | Every visible string goes through an i18next key, enforced by lint | S | ✅ 2026-09-27 |
| SETUP-06 | Dexie opens its database and asks for persistent storage | XS | ✅ 2026-09-28 |
| SETUP-07 | The app installs to the home screen and opens offline | S | ✅ 2026-09-28 |
| SETUP-08 | Every push to `main` deploys to a public link | S | ✅ 2026-09-28 |
| SETUP-09 | `docs/RUNNING.md` and `docs/adr/001-platform.md` exist | XS | ✅ 2026-09-28 |

---

## Phase 1 — Schemas and the engine (SPEC stage 1)

Gate: SPEC §12 stage 1, widened by ADR 004 and ADR 005 — golden tests A, B, B4, C, D, E, F pass;
the made-up test system passes through the core; CI fails if the core imports a system module;
coverage of `engine` and of the fifth-edition module ≥ 90 %; the benchmark is within 10 ms; a
formula cycle stops with a readable message. No UI, no SRD import.

**Re-cut on 2026-09-30 by OPS-05** (ADR 003, ADR 004, ADR 005), approved by the owner before it was
written. The game-free core comes first, and its compute rows are tested on the made-up test
system. The fifth-edition module follows, as its own package. The table is in work order, which
since the re-cut is not number order. An old row kept its id where its meaning stayed; a part
split off an old row got a new id.

| ID | Hat | Size | Status |
|---|---|---|---|
| **Core** | **schemas** | | |
| ENG-01 | CI fails if `engine` imports React, DOM, Dexie or the network | XS | ✅ 2026-09-30 |
| ENG-02 | The entity base has a core Zod schema, ids included | S | ✅ 2026-09-30 |
| ENG-03 | The core entity types have Zod schemas | S | ✅ 2026-09-30 |
| ENG-04 | Effects, grants, prerequisites have game-free Zod schemas | S | ✅ 2026-09-30 |
| ENG-24 | A system module adds its entity types to the schemas | S | ✅ 2026-10-01 |
| ENG-05 | The content pack has a schema, exported as JSON Schema | S | ✅ 2026-10-01 |
| ENG-06 | The core character document has a schema, with the migration frame | S | ✅ 2026-10-01 |
| ENG-39 | A pack records the schema version of its system's module | S | ✅ 2026-10-01 |
| ENG-25 | Packs are checked as they load into the content index | S | ✅ 2026-10-01 |
| **Core** | **formulas, dice** | | |
| ENG-07 | Formulas evaluate safely, returning the paths they read | M | ✅ 2026-10-01 |
| ENG-08 | Dice notation is rolled, in `d` or `к` | S | ✅ 2026-10-01 |
| ENG-26 | A roll result has the shape the table link will send | XS | ✅ 2026-10-01 |
| **Core** | **compute, tested on the made-up system** | | |
| ENG-27 | The made-up test system exists as core test data | S | ✅ 2026-10-01 |
| ENG-11 | `compute()` gathers every entity a character has, grants included | M | ✅ 2026-10-01 |
| ENG-12 | Stat scores are computed in the base phase | S | ✅ 2026-10-01 |
| ENG-28 | `compute()` runs the derived-value steps a system module supplies | S | ✅ 2026-10-01 |
| ENG-29 | Resource maximums are computed from their formulas | XS | ✅ 2026-10-01 |
| ENG-17 | Derived-phase effects, toggles, overrides apply with a breakdown | M | ✅ 2026-10-01 |
| ENG-18 | A formula cycle stops with a message naming the paths | S | ✅ 2026-10-01 |
| ENG-30 | Tracker actions return a log entry that undoes them | S | ✅ 2026-10-01 |
| ENG-40 | A content key never reads a field every object has | XS | ✅ 2026-10-01 |
| **Fifth edition** | **its own package** | | |
| ENG-31 | The fifth-edition module is a package the core cannot import | XS | ✅ 2026-10-01 |
| ENG-41 | Lint holds the fifth-edition module to the engine's purity rules | XS | ✅ 2026-10-01 |
| ENG-42 | A test holds the module's tsconfig to the language alone | XS | ✅ 2026-10-01 |
| ENG-32 | The fifth-edition entity types have Zod schemas | M | 🔲 |
| ENG-33 | The fifth-edition part of the character document has a schema | S | 🔲 |
| ENG-38 | The fifth-edition pack's JSON Schema is published as a file | XS | 🔲 |
| ENG-09 | 2014 fixtures: every SRD entity golden A or C needs | M | 🔲 |
| ENG-10 | 2024 fixtures: every SRD entity golden B, B4, C or D needs | M | 🔲 |
| ENG-13 | Check bonuses are computed: modifiers, proficiency, saves, skills, passives | M | 🔲 |
| ENG-14 | Combat numbers are computed: hit points, armor class, initiative, speed | M | 🔲 |
| ENG-15 | Spellcasting numbers are computed, multiclass slots included | M | 🔲 |
| ENG-16 | Attacks are computed, weapon mastery included | S | 🔲 |
| ENG-34 | Advantage, disadvantage, critical hits apply to fifth-edition rolls | S | 🔲 |
| ENG-19 | The ruleset files hold every 2014/2024 rules difference | M | 🔲 |
| ENG-35 | The ability-bonus source is a choice, the rules base by default | S | 🔲 |
| ENG-20 | Damage, healing, slots, concentration change by fifth-edition rules | M | 🔲 |
| ENG-21 | A rest changes the character by its edition's rules | S | 🔲 |
| ENG-36 | Level-up changes the character through an undoable action | S | 🔲 |
| ENG-22 | Golden E: the homebrew pack from Appendix Д changes character B | S | 🔲 |
| ENG-37 | Golden F: a character mixing both editions passes | M | 🔲 |
| ENG-23 | The phase 1 gate is shown true: coverage, speed, every golden | S | 🔲 |

- **ENG-36** — ADR 014 item 10: level-up gives ENG-30's log entry (`logEntrySchema`, applied and
  reversed by `applyEntry` and `reverseEntry`), built from the character it changes.
- **ENG-21** — found by ENG-29: `Computed.resources` keeps one row per grant, each with its own
  recovery; ENG-21 decides which ones a key given twice follows on a rest. ENG-30's
  `regainResource` gives uses back, never below none spent.
- **ENG-32** — found by ENG-04: also fifth edition's grant kinds `spell` and `item`, built on
  ENG-04's `grantBaseSchema` and `chooseEntitiesSchema`, and on the system's `usesDefSchema`
  from ENG-24's `systemListsOf`. ADR 014 items 5–7: a `rule` has a topic; a spell's `scaling`;
  a granted spell's own uses, with no slot. Found by ENG-11: a kind's `choose` has the core's
  shape (`GrantView`); `compute()` reports it pending and passes its items through, and the
  module decides what they give.
- **ENG-33** — ADR 014 item 8: XP or milestone, inspiration as a count with a maximum, the
  ability score method's key and rolls, the ability bonus source, which feats may be taken.
  ENG-06 left it SPEC §5.8's fifth-edition fields, in `systemData`, with its own
  `systemSchemaVersion` and migrations (ENG-06 §9). Found by ENG-39: the same version goes to
  the module's packs, with a pack step for each version (ENG-39 §4).
- **ENG-38** — found by ENG-05: SPEC §5.7's `/schema/pack.schema.json`, from
  `packJsonSchemaOf` with ENG-32's entity union, kept in step with the schemas by a test.
- **ENG-09, ENG-10** — hand-written minimal entities only, not an import, written with ENG-32's
  schemas. Every rules fact in them goes through §8 of the ticket (`[ПРОВЕРИТЬ]`).
- **ENG-09** — golden A says mountain dwarf, but its numbers (+2 CON, +1 WIS, Dwarven Toughness)
  are the hill dwarf's, and SRD 5.1 has only the hill dwarf. §8 checks the 2014 and 2024 sources
  and shows the owner the result before the fixture is written. The golden values are not changed
  without her.
- **ENG-13** — found by ENG-28: the module's `statDefaults` are SPEC §5.3's (the modifier
  formula, a save, a maximum of 20); its saves read `StatOf.hasSave`; its values are `derive`'s
  steps, as Tales' are (`packages/engine/test/tales-module.ts`). A skill's own `totalFormula`
  (SPEC §5.3, a core field) is read by no code yet: this ticket decides whether the module's
  skill step or the core reads it.
- **ENG-13 to ENG-16, ENG-34** — each ticket turns on the golden-test lines it makes true. The
  full goldens A–D are green by ENG-19.
- **ENG-13, ENG-14, ENG-34** — found by ENG-17: an effect whose op gives no number (`append`,
  `advantage`, `disadvantage`, `note`, a `set` with a text) on a path that is not a number value
  (`ac.formulas`, `defenses.*`, `roll.*`, `skills.<key>.ability`) is left alone by the phases,
  with no warning. The ticket that computes such a list, roll or text reads its effects through
  `activeEffects` (`effects.ts`) and warns for its own targets.
- **ENG-16** — ADR 014 item 6: a spell's current dice for the character's level, with a breakdown.
  Found by ENG-08: SPEC §5.6 shows a roll formula with its average, and no function gives it; a
  term that keeps some dice has no simple average (`2d20kh1`'s is 13.825). A count of dice that
  grows with level is not notation: a term's count is digits, so the dice are written from the
  computed count.
- **ENG-20** — ADR 014 item 7: casting with "use a slot: no".
- **ENG-19** — ability increase source, subclass level, multiclass rounding, exhaustion, rests,
  inspiration (SPEC §6.3 table). Golden C and golden D close here. ADR 014 item 8: inspiration's
  SRD text is shown to the owner next to her default of 3.
- **ENG-35** — ADR 014 item 1 (from ADR 013 item 10): a 2014 race with a 2024 background gives
  ability increases from the race, the background or both; `both` warns, never blocks; the
  default is the rules base's source. Its §8 reads both SRDs for other bonuses of one kind given
  in two places (ADR 005 item 3.4, still in force for those); each one found becomes a new row.
- **ENG-22** — the Appendix Д pack gains the `system` field (ADR 004 item 3) and the module's
  `systemSchemaVersion` (ENG-39); no expected value changes.
- **ENG-37** — ADR 005 item 3.6; the fixture states its ability bonus source (ADR 014 item 1).
  The ticket stops to show the character and its hand-computed values to the owner (golden
  values are hers); the test is written only after her yes. No golden F value is written before
  that.
- **ENG-23** — the phase's last ticket. Its §11 carries the proof of the stage 1 gate.

---

## Phases 2–7 — cut when the phase before closes

| Phase | SPEC stage | Area | What it delivers |
|---|---|---|---|
| 2 | 2 | `SHEET` | Character list, manual creation, the sheet with every tab, trackers, rolls, rests, undo, JSON export; screens built on design tokens (ADR 005) |
| 3 | 3 | `CONT` | SRD 2014 and 2024 import, mechanics for levels 1–5, the library, search, attribution |
| 4 | 4 | `WIZ` | The creation wizard, the level-up wizard, house rules |
| 5 | 5 | `HB` | The homebrew editor, the effect builder, before/after preview, several personal packs, `.gmpack` import and export with the import checks (ADR 003) |
| 6 | 6 | `PDF` | Own template (6a), filling an uploaded sheet (6b) |
| 7 | 7 | `POL` | Accessibility, performance, onboarding, optional Android |
| RU | — | `RU` | Russian locale, glossary check, Russian overlays for SRD texts (ADR 000); placed when phase 3 closes |
| SYS | — | `SYS` | More game systems: other D&D editions, Pathfinder, later others (ADR 004); placed when phase 2 closes |

- **Phase 3** — found by ENG-02: 11 of 4,428 5e-database slugs do not fit the entity id's slug
  pattern; the import maps them. ENG-02 §11 lists them.
- **Phase 3** — found by ENG-31: a core file may climb into a sibling package other than a
  module (`../../content/src/index.ts` passes lint, measured). The row that first makes
  `content`, `pdf` or `foundry` import the module also refuses that climb in `packages/schema/src`
  and `packages/engine/src`, or the core reaches the module through it with no error. Found by
  ENG-41: a module file climbs the same way (`../../content/src/index.ts`,
  `../../system-tales/src/index.ts` pass lint in `packages/system-5e/src`, measured); that row
  refuses it in `packages/system-*/src` too.
- **Phase 3** — found by ENG-29: two `resource` grants of one key give one resource, with the
  highest of their maximums. Mechanics that give one key from two classes (a multiclass) check
  in their §8 what the SRD says for that case; uses that add up are an effect `add` on
  `resources.<key>.max`.
- **Phase 3** — found by ENG-12: a stat's maximum caps its score after every base-phase effect
  (SPEC §6.1 step 4), so an item whose mechanics put a score above the maximum must raise
  `abilities.<key>.max` too (SPEC §5.4's belt, `max 21`). The mechanics' §8 checks which items
  do this.
- **Phase 5** — found by ENG-39: a locale overlay keys its texts by field name, but carries only
  the core's `schemaVersion`. When a module renames a text field, a stored overlay keeps the old
  name and its text is no longer shown. The row that stores imported overlays gives them the
  module's version, or ties each to its pack's.
- **Phase 5** — found by ENG-12: a stat distribution's pattern is picked by its count of items,
  so of two patterns with one length (`[[2, 1], [1, 1]]`) the second is never used. The import
  checks or the editor warn.
- **Phase 5** — found by ENG-07: a pack's formulas are only text to the schema, which cannot
  import the engine, so a formula past ENG-07's limits, or one that does not parse, loads and
  warns only when it is evaluated. The import checks (ADR 003 item A6) parse each formula with
  `parseFormula`. Found by ENG-08: a roll formula with `parseRoll`, since `parseFormula` refuses
  dice.
- **Phase 5** — found by ENG-18: `compute()` warns of a formula loop only when its reads happen,
  so a loop on a branch a formula does not take today (`@level > 3 ? @a : 0`) gives no warning
  until it is taken. The effect builder's live preview (SPEC §8.3) shows the warning for the chosen
  character; the import checks can look for one in ENG-07's `paths`.
- **Phase 5** — found by ENG-18: `missingPath` names the path whose computing read the missing
  one, not the effect or grant whose formula did, so a typo in an effect's formula points at its
  target's own step. `valueAt` in `derived.ts` knows that part (`by`); the warning can carry it
  before the effect builder shows it.
- **Phases 2, 4** — found by ENG-04: no row checks a prerequisite against a character (SPEC §5.5,
  §8.2: a warning, never a block). The row is cut with the first phase that lets a person pick an
  entity with prerequisites. Found by ENG-11: Tales' `unmetPrerequisites` (ENG-27) are its test
  data; `Computed.entities` gives the entities to check.
- **Phase 2** — found by ENG-40: an override's path or an effect's target may be one step such
  as `toString` (`computedPathSchema`). `compute()` handles it (`overrideNoPath`), but
  `Computed.values` and `Computed.breakdown` are plain objects, so `values['toString']` gives a
  function, not `undefined`. The first screen that reads `Computed` by a stored path reads only
  own fields, or the path schema refuses ENG-40's `RESERVED_KEYS` as a step.
- **Phase 2** — found by ENG-08: the engine has no random source of its own (lint refuses
  `Math.random` in it). The dice panel passes `fairDie(randomSourceOf((a) =>
  crypto.getRandomValues(a)))` to `rollFormula`; "I roll myself" (SPEC §6.5) passes the faces
  the person typed as the die.
- **Phase 2** — found by ENG-26: the roll log (SPEC §6.5) keeps `RollRecord`s, built with
  `recordRoll`. `rollRecordSchema` refuses an unknown field and carries no version of its own, so
  the table that keeps the log gives each record one; the table link does the same for what it
  sends.
- **Phase 2** — found by ENG-17: a stored switch (`state.toggles`) stays after its entity is
  removed and warns `toggleGone` on every compute, so removing an entity drops its switches. An
  override applies only when its value is a number on a number path (`overrideNotANumber`
  otherwise), so the override editor stores a number there. The breakdown's kind `override` is
  shown as "Manual edit" (SPEC §6.1 step 7).
- **Phase 2** — found by ENG-25: a character's active pack that is not installed on the device
  never reaches `loadContentIndex`; the sheet says which pack is missing, not only `Missing: <id>`
  on each of its entries.
- **Phase 2** — found by OPS-08: ADR 008 replaces the SETUP-04 bottom bar with a start page, a
  player page and My characters. The phase 2 rows build that navigation instead of the bar.
- **Phases 2–5** — added by OPS-22: each screen is built from its mockup in
  `docs/design/mockups/` and its row in BRIEF Part 5; a design change made during a phase is
  made in the mockup and the canvas too.
- **ADR 009, by phase** — added by OPS-09. Phase 2: the dice panel on the sheet, features by
  source, the About tab, the spellcasting line, Inspiration, portrait and token, custom items,
  companions and sections. Phase 3: several rulebooks at once, the source on every entry.
  Phase 5: custom stats, the person's packs next to the books, custom entries with effects. The
  dice phase (with ADR 005 item 11): the honest animated roll, custom roll modifiers. The table
  link's phase: the campaign copy, the DM's changes, approval of important changes.
- **ADR 010, by phase** — added by OPS-10. Phase 2: custom dice and any count of dice, the
  Damage and Heal number pad, the Turn tab, the spell slot grid, casting without a slot. Phase
  3: the one-page library with topics and full entries, the All sources list. Phase 4: steps
  that open and close, ability score methods, level-up by XP or milestone. Phase 5: adding
  packs from "Books in use". DM tools: encounter templates. The table link's phase: the DM's
  level-up control, changes reviewed together.
- **ADR 012** — added by OPS-14. Phase 3: the library's list page and its floating entry window.
- **ADR 013, by phase** — added by OPS-15 to OPS-19. Phase 2: temporary hit points in their
  own colour, the class line as the level with Level up in "⋯", the Player and DM squares, the
  home page's sections. Phase 3: classes and subclasses per ruleset, one entry per ruleset, the spell's description
  layout, Sources with the SRDs built in, Quick rules with every SRD rule and linked terms,
  Bookmarks. Phase 4: the turning arrow on creation steps, the roll calculator, optional feats, the ability
  bonus conflict window. The dice phase: the roll that looks like a real throw. The table link's
  phase: level-up approval in a campaign, the DM's edit before approving, the approvals tab, the
  DM's setting for the conflict window. The DM tools' phase: actors with types. A second system:
  the system preview.
- **ADR 015** — added by OPS-26. Phase 2 opens with the skin layer, before the first screen:
  the full token set, the slots, the part styles, the motion settings, the lint check; the
  portrait takes animated pictures and video. The theme editor's phase: the skin schema, import,
  export. The dice phase: dice skins and their effects. The purchases phase: frames, backgrounds,
  seasons.
- **ADR 014** — added by OPS-20. Phase 3: the import brings in both SRDs' rules chapters as
  `rule` entries with topics, for Quick rules; bookmarks are a table on the device.
- **ADR 011, by phase** — added by OPS-12. Phase 2: descriptions open and close, from fixtures
  and free text. Phase 3: the SRD texts. Phase 5: the person's packs.

Phases L1–L6 (Foundry, game master tools, assistant, accounts, shared room) are in SPEC §12 and
get rows only when the owner opens them. ADR 003 adds two more of that kind: the Fantasy Grounds
exporter, and the community place for sharing packs (its gate is a lawyer's check). ADR 005
reshapes three of them: L3 gains roll tables, generators and a fuller tool list; L4 is the
person's own AI key, free; L5's campaign sync becomes the table link. It adds three more: payments
(one payment, no subscription; its gate is a lawyer's check), dice skins, and the theme editor.

---

## Order

**Phase 0 → phase 1 → phase 2 → phase 3 → phase 4 → phase 5 → phase 6 → phase 7.** Inside a
phase, rows go in the order of its table unless a row's "Depends on" allows otherwise.

Three things can change this order, and all are the owner's decision (SPEC §14):
- if she plays in Foundry now, L1 can move ahead of phase 6;
- the Russian phase is placed when phase 3 closes;
- the more-systems phase is placed when phase 2 closes (ADR 004).

---

## OPS — around the code (never closes)

| ID | Hat | Size | Status |
|---|---|---|---|
| OPS-01 | ADR 003 and ADR 004 record the library packs and the game systems | XS | ✅ 2026-09-28 |
| OPS-02 | ADR 005 records the product decisions of 2026-09-29 | XS | ✅ 2026-09-30 |
| OPS-03 | The design brief for the screens exists | S | ✅ 2026-09-30 |
| OPS-04 | ADR 006 removes the stops that protect nothing | XS | ✅ 2026-09-30 |
| OPS-05 | Phase 1 is re-cut to follow ADRs 003–005 | XS | ✅ 2026-09-30 |
| OPS-06 | ADR 007 limits stops to the owner's decisions | XS | ✅ 2026-09-30 |
| OPS-07 | The design brief records the owner's choices of 2026-09-30 | XS | ✅ 2026-09-30 |
| OPS-08 | ADR 008 records the navigation the owner chose | XS | ✅ 2026-09-30 |
| OPS-09 | ADR 009 records the owner's sheet, dice, rulebook and campaign requirements | XS | ✅ 2026-09-30 |
| OPS-10 | ADR 010 records the owner's library, dice, creation, level and spell requirements | XS | ✅ 2026-09-30 |
| OPS-11 | `CLAUDE.md` says every detail the owner gives is recorded in the same chat | XS | ✅ 2026-09-30 |
| OPS-12 | ADR 011 records full descriptions on the sheet | XS | ✅ 2026-09-30 |
| OPS-13 | No personal name for the owner appears in the repository | XS | ✅ 2026-09-30 |
| OPS-14 | ADR 012 records the library's look on the phone | XS | ✅ 2026-09-30 |
| OPS-15 | ADR 013 records the owner's requests of 2026-10-01 | XS | ✅ 2026-10-01 |
| OPS-16 | ADR 013 records the spell description's layout | XS | ✅ 2026-10-01 |
| OPS-17 | ADR 013 records what Quick rules holds | XS | ✅ 2026-10-01 |
| OPS-18 | ADR 013 records Level up in the sheet's "⋯" menu | XS | ✅ 2026-10-01 |
| OPS-19 | ADR 013 takes the owner's three corrections to the mockups | XS | ✅ 2026-10-01 |
| OPS-20 | ADR 014 records what the design decisions change in the engine | S | ✅ 2026-10-01 |
| OPS-21 | The design brief records the current design, kept open | XS | ✅ 2026-10-01 |
| OPS-22 | The current mockups are kept in the repository | S | ✅ 2026-10-01 |
| OPS-23 | The design reference lists its tokens and its undrawn parts | XS | ✅ 2026-10-01 |
| OPS-24 | The whole design canvas is kept in the repository | XS | ✅ 2026-10-01 |
| OPS-25 | Every ticket that builds a screen names its mockup boards | XS | ✅ 2026-10-01 |
| OPS-26 | ADR 015 makes every look a skin's data | XS | ✅ 2026-10-01 |
| OPS-27 | Closed tickets leave the files a new chat reads | XS | ✅ 2026-10-01 |
