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

**Rows are written when a phase opens, not earlier.** Phases 0 and 1 are cut into rows now,
before the first line of code, so this cut is a first guess. Re-cut it when the work shows it is
wrong, and say so in the ticket's §11. Phases 2–7 are cut when the phase before them closes.

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

- **SETUP-01** — Vite + React 19 + TypeScript strict in `apps/web`; empty `schema`, `engine`,
  `content`, `pdf` packages; Biome. `foundry` is not created until phase L1.
- **SETUP-04** — Tailwind v4, shadcn/ui, lucide-react; the tabs Characters · Library · Dice ·
  Settings; dark theme by default.
- **SETUP-05** — i18next with an `en` locale only (ADR 000); a lint rule that fails on a string
  literal in JSX.
  **Built before SETUP-04** (the owner, 2026-09-27; option A in SETUP-04 §4), so the tab labels are
  i18n keys from the start.
- **SETUP-08** — **needs the owner.** Cloudflare Pages (or GitHub Pages) needs an account. A chat
  cannot create an account or sign in. SPA fallback to `index.html`.
- **SETUP-09** — the phase's last ticket. Its §11 carries the proof of the stage 0 gate: the link
  opened on the owner's phone, installed, and opened again with the network off.

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
| ENG-39 | A pack records the schema version of its system's module | XS | 🔲 |
| ENG-25 | Packs are checked as they load into the content index | S | 🔲 |
| **Core** | **formulas, dice** | | |
| ENG-07 | Formulas evaluate safely, returning the paths they read | M | 🔲 |
| ENG-08 | Dice notation is rolled, in `d` or `к` | S | 🔲 |
| ENG-26 | A roll result has the shape the table link will send | XS | 🔲 |
| **Core** | **compute, tested on the made-up system** | | |
| ENG-27 | The made-up test system exists as core test data | S | 🔲 |
| ENG-11 | `compute()` gathers every entity a character has, grants included | M | 🔲 |
| ENG-12 | Stat scores are computed in the base phase | S | 🔲 |
| ENG-28 | `compute()` runs the derived-value steps a system module supplies | S | 🔲 |
| ENG-29 | Resource maximums are computed from their formulas | XS | 🔲 |
| ENG-17 | Derived-phase effects, toggles, overrides apply with a breakdown | M | 🔲 |
| ENG-18 | A formula cycle stops with a message naming the paths | S | 🔲 |
| ENG-30 | Tracker actions return a log entry that undoes them | S | 🔲 |
| **Fifth edition** | **its own package** | | |
| ENG-31 | The fifth-edition module is a package the core cannot import | XS | 🔲 |
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

- **ENG-02** — `meta.translation` takes the four values of SPEC §5.2 (`official`, `community`,
  `machine`, `reviewed`); §3.3 lists only three. The owner's decision, 2026-09-27. `source` gains
  `book`, `author`, `license`; `meta.foundry` is left out (ADR 003 items A1, A2).
- **ENG-24** — found by ENG-04: a module adds grant kinds, and lists the values the core checks
  only for shape (proficiency categories and levels, recovery events). `safeExtend` cannot widen
  the base's `grants`; ENG-04 §4 has the measurement.
- **ENG-05** — the pack names its `system` and its edition (`ruleset`), and carries `homepage`,
  `repository`, `copyrightNotice` (ADR 003 item A2, ADR 004 item 3). No field says where a pack
  came from; the app sets that (ADR 003 item A7). The locale overlay schema is here too. The JSON
  Schema is exported per system: the core's types plus the module's. Found by ENG-02: Zod's
  refinements do not reach the JSON Schema (at least one language, http or https links, the id's
  type equal to `type`); ENG-02 §11 has the measurement. ENG-04 adds 8 more; ENG-04 §11 lists
  them.
- **ENG-06** — the core part of ADR 004's §5.8 row; the module's part is ENG-33. Packs and
  characters share the migration frame, which refuses a file with a newer `schemaVersion`
  (ADR 003 item A6). ADR 014 item 8: the actor's kind.
- **ENG-39** — found by ENG-06: a pack holds the module's entity types but carries only the
  core's `schemaVersion`. `packSchemaOf` takes the module's `systemSchemaVersion` and
  `packOpenerOf` its migrations, as ENG-06 did for a character (ENG-06 §11).
- **ENG-25** — ADR 003 item A3: a missing dependency gives a warning and `Missing: <id>`; a
  dependency loop refuses the pack, with a message naming the loop; a pack never replaces another
  pack's entry. Also: a duplicate `key` among active packs of one ruleset (SPEC §5.1, ADR 014
  item 2); a pack of another system is not loaded for a character (ADR 004 item 3). ADR 014
  items 3–4: the index finds the other ruleset's copy by type and key, and keeps names and
  aliases per language. Found by ENG-06: a pack whose id is `character`, the pack id of a
  character's own entities, is refused.
- **ENG-08** — ADR 014 item 11: faces 2–1000, 1–999 dice per term, a fairness test.
- **ENG-26** — ADR 005 item 5.6: who rolled, what for, the dice, the result, the breakdown; public,
  secret to the DM, or hidden by the DM. Only the shape; sending it belongs to the table-link
  phase. ADR 014 item 12: the person's own roll modifiers, labelled.
- **ENG-27** — a small invented game with its own stats, skills and resources, and no content
  from any real game (ADR 004 item 4). Its expected values are computed by hand from its own
  rules; they are test data, not goldens. ENG-28 adds its derived-value steps.
- **ENG-11** — an entity of the other edition gives a warning, never a block (SPEC §5.8,
  ADR 005 item 3.3). Found by ENG-24: an entity whose grants hold a module's kind is not
  assignable to the open `EntityBase` type (`TS2322`); ENG-24 §11 has the measurement. Found by
  ENG-06: species, classes and feats are in the module's `systemData`, so the core gets a
  character's entities through the module.
- **ENG-28** — found by ENG-24: the defaults a system gives a stat (SPEC §5.3: the modifier
  formula, a save, a maximum) come with the module's steps here. ENG-03 §4 also named ENG-24;
  a schema adds nothing on parse, so ENG-24 §9 moved them here.
- **ENG-31** — the package name and the `system` id are chosen here, checked against the rule on
  names in `CLAUDE.md`. `CLAUDE.md`'s layout, its dependency line and its golden-test path follow
  the new package. Found by ENG-01: a relative path can climb out of `packages/engine` into a
  sibling package (`../../content/src/index.ts`), and ENG-01's lint rule cannot see that; the
  core-to-module check here also covers a climb into the module by relative path.
- **ENG-30, ENG-36** — ADR 014 item 10: a log entry carries who, when, a label and before/after
  values; it can wait unapplied, and its "after" value can be edited before it applies.
- **ENG-32** — found by ENG-04: also fifth edition's grant kinds `spell` and `item`, built on
  ENG-04's `grantBaseSchema` and `chooseEntitiesSchema`, and on the system's `usesDefSchema`
  from ENG-24's `systemListsOf`. ADR 014 items 5–7: a `rule` has a topic; a spell's `scaling`;
  a granted spell's own uses, with no slot.
- **ENG-33** — ADR 014 item 8: XP or milestone, inspiration as a count with a maximum, the
  ability score method's key and rolls, the ability bonus source, which feats may be taken.
  ENG-06 left it SPEC §5.8's fifth-edition fields, in `systemData`, with its own
  `systemSchemaVersion` and migrations (ENG-06 §9).
- **ENG-38** — found by ENG-05: SPEC §5.7's `/schema/pack.schema.json`, from
  `packJsonSchemaOf` with ENG-32's entity union, kept in step with the schemas by a test.
- **ENG-09, ENG-10** — hand-written minimal entities only, not an import, written with ENG-32's
  schemas. Every rules fact in them goes through §8 of the ticket (`[ПРОВЕРИТЬ]`).
- **ENG-09** — golden A says mountain dwarf, but its numbers (+2 CON, +1 WIS, Dwarven Toughness)
  are the hill dwarf's, and SRD 5.1 has only the hill dwarf. §8 checks the 2014 and 2024 sources
  and shows the owner the result before the fixture is written. The golden values are not changed
  without her.
- **ENG-13 to ENG-16, ENG-34** — each ticket turns on the golden-test lines it makes true. The
  full goldens A–D are green by ENG-19.
- **ENG-16** — ADR 014 item 6: a spell's current dice for the character's level, with a breakdown.
- **ENG-20** — ADR 014 item 7: casting with "use a slot: no".
- **ENG-19** — ability increase source, subclass level, multiclass rounding, exhaustion, rests,
  inspiration (SPEC §6.3 table). Golden C and golden D close here. ADR 014 item 8: inspiration's
  SRD text is shown to the owner next to her default of 3.
- **ENG-35** — ADR 014 item 1 (from ADR 013 item 10): a 2014 race with a 2024 background gives
  ability increases from the race, the background or both; `both` warns, never blocks; the
  default is the rules base's source. Its §8 reads both SRDs for other bonuses of one kind given
  in two places (ADR 005 item 3.4, still in force for those); each one found becomes a new row.
- **ENG-22** — the Appendix Д pack gains the `system` field (ADR 004 item 3); no expected value
  changes.
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
- **Phases 2, 4** — found by ENG-04: no row checks a prerequisite against a character (SPEC §5.5,
  §8.2: a warning, never a block). The row is cut with the first phase that lets a person pick an
  entity with prerequisites.
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

- **OPS-03** — `docs/design/BRIEF.md`: the pages, what is on each, free and paid marks, the
  style of ADR 005 item 7, and a prompt per screen. The owner's chosen results come back into it.
