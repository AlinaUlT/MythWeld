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

**Closed 2026-10-23.** The gate's proof is in ENG-64 §11, in
[`docs/archive/tickets/ENG_TICKET.md`](../archive/tickets/ENG_TICKET.md).

**The gate's proof.** Since ENG-23 the quality gate runs the gate's checks: the goldens, the
made-up system, the cycle message, coverage and speed in `pnpm test`; the core's imports in `pnpm
lint`. ENG-23 §11 names each check, with its measurement on 2026-10-05. The phase's last row to
close puts that run in its §11, with golden F, and measures "no UI, no SRD import" again.

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
| ENG-32 | The fifth-edition entity types have Zod schemas | M | ✅ 2026-10-01 |
| ENG-33 | The fifth-edition part of the character document has a schema | S | ✅ 2026-10-01 |
| ENG-38 | The fifth-edition pack's JSON Schema is published as a file | S | ✅ 2026-10-02 |
| ENG-09 | 2014 fixtures: every SRD entity golden A or C needs | M | ✅ 2026-10-02 |
| ENG-10 | 2024 fixtures: every SRD entity golden B, B4, C or D needs | M | ✅ 2026-10-02 |
| ENG-13 | Check bonuses are computed: modifiers, proficiency, saves, skills, passives | M | ✅ 2026-10-02 |
| ENG-43 | An effect sets the stat a skill uses | S | ✅ 2026-10-02 |
| ENG-14 | Combat numbers are computed: hit points, armor class, initiative, speed | M | ✅ 2026-10-02 |
| ENG-44 | Equipped items count only as the rules allow | S | ✅ 2026-10-02 |
| ENG-45 | Heavy armor's Strength requirement slows its wearer | S | ✅ 2026-10-02 |
| ENG-47 | The person picks which base AC calculation counts | S | ✅ 2026-10-02 |
| ENG-48 | The character's size comes from its species | S | ✅ 2026-10-02 |
| ENG-15 | Spellcasting numbers are computed, multiclass slots included | M | ✅ 2026-10-02 |
| ENG-16 | Weapon attacks are computed, weapon mastery included | M | ✅ 2026-10-02 |
| ENG-49 | A spell or item a grant names that no pack has gives a warning | S | ✅ 2026-10-02 |
| ENG-52 | A roll formula's average is computed, kept dice included | S | ✅ 2026-10-02 |
| ENG-50 | A spell's dice are computed for the character's level | S | ✅ 2026-10-02 |
| ENG-51 | A spell a grant gives with its own stat has its casting numbers | S | ✅ 2026-10-02 |
| ENG-53 | A spell's healing is a roll formula of its own | S | ✅ 2026-10-03 |
| ENG-55 | A spell's damage adds `damage.spell.bonus` | S | ✅ 2026-10-03 |
| ENG-60 | A spell's healing adds what a feature gives it | S | ✅ 2026-10-03 |
| ENG-34 | Advantage, disadvantage, critical hits apply to fifth-edition rolls | M | ✅ 2026-10-03 |
| ENG-19 | The ruleset files hold every 2014/2024 rules difference | M | ✅ 2026-10-02 |
| ENG-46 | Armor worn without training has its edition's penalties | S | ✅ 2026-10-03 |
| ENG-35 | The ability-bonus source is a choice, the rules base by default | S | ✅ 2026-10-03 |
| ENG-56 | A mixed character's starting languages come from one place | S | ✅ 2026-10-03 |
| ENG-54 | The house rule's highest score caps every stat | S | ✅ 2026-10-03 |
| ENG-20 | Damage, healing, slots, concentration change by fifth-edition rules | M | ✅ 2026-10-03 |
| ENG-57 | A spell a grant gives is cast through its own uses | S | ✅ 2026-10-03 |
| ENG-58 | A death save roll changes the character by fifth-edition rules | S | ✅ 2026-10-03 |
| ENG-62 | Dropping to 0 hit points gives the Unconscious condition | S | ✅ 2026-10-03 |
| ENG-65 | Knocking a creature out leaves it unconscious at 1 hit point | S | ✅ 2026-10-03 |
| ENG-63 | Death ends attunement to magic items | XS | ✅ 2026-10-03 |
| ENG-59 | Inspiration is gained or spent up to its maximum | XS | ✅ 2026-10-03 |
| ENG-21 | A rest changes the character by its edition's rules | S | ✅ 2026-10-03 |
| ENG-61 | A long rest lowers a condition's level as its entry says | S | ✅ 2026-10-03 |
| ENG-66 | Coming back to life lowers a condition's level as its entry says | S | ✅ 2026-10-13 |
| ENG-67 | Exhaustion at level 6 makes the character dead | S | ✅ 2026-10-22 |
| ENG-64 | A long rest gives the inspiration a trait names | S | ✅ 2026-10-23 |
| ENG-69 | Dying of exhaustion ends attunement to magic items | S | ✅ 2026-10-22 |
| ENG-36 | Level-up changes the character through an undoable action | S | ✅ 2026-10-02 |
| ENG-22 | Golden E: the homebrew pack from Appendix Д changes character B | S | ✅ 2026-10-02 |
| ENG-68 | A mixed character's ability increases may come from neither side | S | ✅ 2026-10-05 |
| ENG-37 | Golden F: a character mixing both editions passes | M | ✅ 2026-10-05 |
| ENG-23 | The phase 1 gate runs in `pnpm test`: coverage, speed, every golden | S | ✅ 2026-10-05 |

---

## Phase 2 — The character sheet, made by hand (SPEC stage 2)

Gate: SPEC §12 stage 2, as ADR 000 changes it — characters A and B are made in the interface in
at most 5 minutes each and show their SPEC §6.7 values; the e2e scenario "damage while
concentrating → save → undo" passes; every tab has a screenshot at 360×800, in English. No
creation wizard, no homebrew editor. SHEET-60 is the phase's last row: its §11 carries the proof.

**Cut on 2026-10-22 by OPS-29**, before phase 1 closed: ENG-64 is phase 1's last open row, and the
owner asked for rows she can start in parallel chats once it lands. No phase 2 row starts before
phase 1's gate is proved. The rows come from SPEC §12 stage 2 and from the ADRs that put work in
phase 2: ADR 008 (navigation), ADR 009, 010, 011 and 013 (the sheet, dice, descriptions, the home
page) and ADR 015 (the skin layer comes first). Each phase 1 note that named phase 2 is now the
note of the row that takes it. A screen row builds from its boards in `docs/design/mockups/` and
its row in BRIEF Part 5 (OPS-22). BRIEF's prompts still hold text that later ADRs replaced, so a
screen row reads its prompt with the ADRs, and the ADRs win (OPS-27 §11).

**Running rows at the same time.** The table is in work order. The rows of one wave run in
parallel chats once every row of the waves before it is closed: each row owns files no other row
of its wave touches. Two rows make that possible. SHEET-11 gives every phase 2 screen its route,
an empty page and its own i18n namespace file, and creates empty the shared pieces later rows
fill. SHEET-30 gives each tab of the sheet one empty file per section, and one empty file for each
panel the sheet opens. Every chat still edits `BACKLOG.md`, `SHEET_TICKET.md` and the archive, so
the second chat to push rebases, keeps both sides and runs the gate again (`CLAUDE.md`, the
steps). A wave holds at most one row that may change a stored shape (SHEET-53, SHEET-57), so two
chats never claim one version number.

| Wave | Rows | Starts when |
|---|---|---|
| 1 | SHEET-01, 02, 07, 14, 15, 17, 19 | Phase 1 is closed |
| 2 | SHEET-03, 04, 05, 06, 08, 10, 16, 18, 20, 21, 61 | Wave 1 is closed |
| 3 | SHEET-09, 11, 22 | Wave 2 is closed |
| 4 | SHEET-12, 13, 23, 24, 37 | Wave 3 is closed |
| 5 | SHEET-25, 27, 30, 31, 38 | Wave 4 is closed |
| 6 | SHEET-26, 28, 32, 33, 36, 39, 46, 48, 50, 53, 54, 55, 56 | Wave 5 is closed |
| 7 | SHEET-29, 34, 40, 41, 42, 43, 44, 45, 47, 49, 51, 52, 57, 58 | Wave 6 is closed |
| 8 | SHEET-35, 59 | Wave 7 is closed |
| 9 | SHEET-60 | Every other row is closed |

| ID | Hat | Size | Status |
|---|---|---|---|
| **Skin layer** | **before the first screen (ADR 015 item 13)** | | |
| SHEET-01 | The base theme's tokens cover every token the mockups use | S | 🔲 |
| SHEET-02 | Lint fails on a colour, font or animation written in a component | S | 🔲 |
| SHEET-03 | Screens draw named slots the base theme fills | S | 🔲 |
| SHEET-04 | Each part takes its style from a fixed menu | M | 🔲 |
| SHEET-05 | Animations are presets that stop for reduced motion | S | 🔲 |
| SHEET-06 | The app's fonts ship inside it, each licence read | S | 🔲 |
| **On the device** | **tables, the mini-pack, saved characters** | | |
| SHEET-07 | Phase 2's device tables arrive in one database version | XS | 🔲 |
| SHEET-08 | The phase 1 fixtures ship as the built-in mini-pack | M | 🔲 |
| SHEET-09 | Built-in packs load into the content index at start | S | 🔲 |
| SHEET-10 | Characters are saved on the device, migrated as they open | S | 🔲 |
| **Navigation** | **ADR 008, ADR 013** | | |
| SHEET-11 | The start page replaces the bottom bar | M | 🔲 |
| SHEET-12 | The player page shows its six sections | S | 🔲 |
| SHEET-13 | Settings keep the person's display choices | S | 🔲 |
| **Rules the screens need** | **engine and module, no screen** | | |
| SHEET-14 | An unmet prerequisite gives a warning | S | 🔲 |
| SHEET-15 | Resistances, immunities, vulnerabilities are computed from effects | S | ✅ 2026-10-28 |
| SHEET-16 | Damage applies the character's defenses by its type | S | 🔲 |
| SHEET-17 | Casting warns of what forbids it | S | 🔲 |
| SHEET-18 | Attunement past the limit gives a warning | XS | 🔲 |
| SHEET-19 | Rolling initiative interrupts a knock-out's rest | XS | 🔲 |
| SHEET-20 | A use's recovery amount is computed with a breakdown | S | 🔲 |
| SHEET-21 | Every base AC calculation is computed for the pin | S | 🔲 |
| SHEET-22 | Removing an entity drops what was stored for it | S | 🔲 |
| SHEET-61 | A condition the character is immune to has no effect | S | 🔲 |
| **Characters** | **the list, the file, the manual form** | | |
| SHEET-23 | An undo toast reverses the last change | S | 🔲 |
| SHEET-24 | My characters lists the saved characters | S | 🔲 |
| SHEET-25 | A character's Actions copy, export or delete it | S | 🔲 |
| SHEET-26 | A character file imports through its checks | S | 🔲 |
| SHEET-27 | The manual form makes a character | M | 🔲 |
| SHEET-28 | The manual form's equipment step adds items | S | 🔲 |
| SHEET-29 | The manual form shows the ability bonus window | S | 🔲 |
| **The sheet** | **the frame, the tabs, trackers, rolls** | | |
| SHEET-30 | The sheet's frame pins the header above the dock | M | 🔲 |
| SHEET-31 | An entry's description opens in place | S | 🔲 |
| SHEET-32 | The Main tab shows every check bonus | S | 🔲 |
| SHEET-33 | A long press opens a number's breakdown | S | 🔲 |
| SHEET-34 | A manual edit overrides a number | S | 🔲 |
| SHEET-35 | The AC breakdown pins its base calculation | XS | 🔲 |
| SHEET-36 | The choices badge opens every pending choice | M | 🔲 |
| SHEET-37 | Rolls are kept in the roll log | S | 🔲 |
| SHEET-38 | The dice panel rolls any formula fairly | M | 🔲 |
| SHEET-39 | Tapping a number rolls it in the roll dialog | M | 🔲 |
| SHEET-40 | The number pad changes the hit points | M | 🔲 |
| SHEET-41 | Concentration shows until it ends | XS | 🔲 |
| SHEET-42 | Conditions are set from the sheet | S | 🔲 |
| SHEET-43 | The death saves tracker follows a dying character | S | 🔲 |
| SHEET-44 | The Combat tab lists the attacks | S | 🔲 |
| SHEET-45 | The Rest frames show what comes back | M | 🔲 |
| SHEET-46 | The Spells tab shows the slot grid | M | 🔲 |
| SHEET-47 | The cast panel casts a spell | M | 🔲 |
| SHEET-48 | The Features tab groups features by source | M | 🔲 |
| SHEET-49 | The Turn tab lists actions by timing | S | 🔲 |
| SHEET-50 | The Gear tab equips items | M | 🔲 |
| SHEET-51 | Coins change by quick steps | XS | 🔲 |
| SHEET-52 | Custom entries are added as free text | S | 🔲 |
| SHEET-53 | The About tab shows the origin details | S | 🔲 |
| SHEET-54 | The Notes tab keeps free text | XS | 🔲 |
| SHEET-55 | Inspiration is tracked as stars | S | 🔲 |
| SHEET-56 | The portrait makes a round token | S | 🔲 |
| SHEET-57 | Custom sections hold the person's own lists | S | 🔲 |
| SHEET-58 | The sheet's "⋯" menu opens the character's actions | S | 🔲 |
| SHEET-59 | The change history lists the last 50 changes | S | 🔲 |
| SHEET-60 | The phase 2 gate is shown on golden characters made by hand | M | 🔲 |

- **SHEET-01** — ADR 015 item 13. Every token `docs/design/mockups/README.md` lists ("The tokens
  these mockups use"), in light and dark, as data the base theme fills. Their values stay
  placeholders until the owner picks the base colours and the heading font (BRIEF Part 5, still
  open); dark stays the default (SPEC §7.2). The row lays the theme out one file per concern, each
  imported once, so SHEET-03 to SHEET-06 each fill their own file. The web-app manifest's
  background stays a fixed value (ADR 015 item 13).
- **SHEET-02** — ADR 015 item 4, `CLAUDE.md` "No look is written in a component". The check works
  as SETUP-05's visible-text check does (`biome/no-visible-literals.grit`).
- **SHEET-03** — ADR 015 item 6: the app background, each page background, the token frame, the
  portrait, the header, the dock, cards, buttons, the dice.
- **SHEET-04** — ADR 015 item 7: the parts phase 2 draws (button, icon button, card, panel, chip,
  bottom sheet, toast), each with its fixed menu of styles; the base theme picks one each.
- **SHEET-05** — ADR 015 items 8 and 9: the phone's "reduce motion" and an app switch (shown by
  SHEET-13) turn the presets into still pictures; animations stop off screen.
- **SHEET-06** — ADR 005 item 7.5, ADR 015 item 10: Inter for text, and EB Garamond as the
  heading placeholder of the mockups until the owner picks (BRIEF X1). No font service.
- **SHEET-07** — SPEC §11's tables that phase 2 stores into (characters, packs, settings, roll
  log, history, blobs), in one Dexie version, so parallel rows never each claim the next version.
  This departs from SETUP-06's "each table arrives with the ticket that first stores into it", for
  that reason.
- **SHEET-08** — SPEC §12 stage 2: "a mini-pack of the stage 1 fixtures". The goldens' SRD
  fixtures (`packages/system-5e/test/golden/srd-2014.ts`, `srd-2024.ts`) become the app's
  built-in packs, with their CC-BY-4.0 metadata; the tests keep reading the same data. If the row
  makes `content` import the module, the ENG-31 note under phase 3 applies to it.
  Found by ENG-32: some fifth-edition keys have no entity type to give their name on screen: a
  spell's `school`, a species' `size` and `creatureType`, an item's `rarity`, a spell area's
  `shape`, a feat's `category`, a rule's `topic` and `icon`. This row gives them names (a simple
  entity type each, or the module's i18n keys), so the wave 6 tabs only show them. Found by
  ENG-48: the key path `size` takes only the species' own sizes, so an effect or an override
  naming another warns and is not applied (SRD 5.2.1's goliath, Large Form: "you can change your
  size to Large"). A size type would give every size as its keys.
- **SHEET-09** — found by ENG-25: a character's active pack that is not installed on the device
  never reaches `loadContentIndex`; the sheet says which pack is missing, not only `Missing: <id>`
  on each of its entries. The row starts the load from `apps/web/src/main.tsx`, which SHEET-11, in
  the same wave, leaves alone.
- **SHEET-10** — SPEC §5.8: an older stored character migrates as it opens.
- **SHEET-11** — found by OPS-08: ADR 008 replaces the SETUP-04 bottom bar with a start page, a
  player page and My characters. Player and DM are two squares (ADR 013 item 16, board
  `V3-Start`); the DM square shows as coming later (ADR 008 item 2). Every page has a back arrow
  and, where it needs one, the gear (ADR 008 item 1). ADR 008 leaves open whether the start page
  shows on every start; until the owner says, it does (ADR 007 item 7). For the waves, the row
  gives every phase 2 screen its route, an empty page and its own i18n namespace file, and creates
  empty the shared pieces later rows fill: the toast host, the dice panel, the roll dialog, the
  breakdown sheet, the description.
- **SHEET-12** — ADR 013 item 17, board `V3-Player`: Characters works; Sources, Library, Quick
  rules and Bookmarks open with phase 3, and Dice roll with SHEET-38; until then each shows as
  coming later. No "2 of 3": no limit applies before the payment phase (ADR 005 item 2).
- **SHEET-13** — SPEC §7.5, BRIEF P10 (not drawn yet; the row draws it from SHEET-04's parts). The
  theme (dark by default, light), the motion switch (SHEET-05), the units (feet or metres, pounds
  or kilograms; stored units stay feet and pounds), "I roll myself" (SPEC §6.5). Language, backup,
  packs, AI and purchases come with their phases.
- **SHEET-14** — found by ENG-04: no row checks a prerequisite against a character (SPEC §5.5,
  §8.2: a warning, never a block). Found by ENG-11: Tales' `unmetPrerequisites` (ENG-27) are its
  test data; `Computed.entities` gives the entities to check. The manual form lets a person pick a
  class that has multiclass prerequisites; phase 4's wizard shows the same warnings.
- **SHEET-16** — found by ENG-20: `applyDamage` takes the damage the person types, resistance,
  immunity and vulnerability already applied. It takes the damage's type and applies SHEET-15's
  defenses in the engine, for the number pad (SHEET-40). Found by SHEET-15: `defensesOf(values)`
  (`defenses.ts`) gives the four lists; SHEET-15 §8 quotes both SRDs' order (resistance, then
  vulnerability, after every other change) and "only one instance".
- **SHEET-17** — found by ENG-46: `spell.cannotCast` is 1 while armor worn without training
  forbids spells (ENG-46 §4), with an `untrainedArmor` or `untrainedShield` warning; `castSpell`
  (ENG-20) does not read it. Found by ENG-62 (§11): `castSpell` reads neither the hit points nor a
  knock-out, so a character with the Unconscious condition, and so the Incapacitated one, casts
  and starts concentrating. The row decides, from each SRD's text, which refuses and which warns;
  a warning never blocks.
- **SHEET-18** — found by ENG-63: nothing counts the attuned rows; both SRDs allow "no more than
  three magic items at a time" (ENG-63's ticket quotes both). A warning, never a block (§8.2),
  computed by the module, not the screen.
- **SHEET-19** — found by ENG-65: rolling initiative interrupts the knock-out's short rest (SRD
  5.2.1, Short Rest): the action that records an initiative roll sets
  `systemData.state.knockedOut` to `interrupted`; no action does yet. The roll dialog (SHEET-39)
  calls it.
- **SHEET-20** — found by ENG-21: a use's label ("1 back on a short rest, all on a long rest")
  reads `Computed.resources[].uses.recovery`; an amount that is a formula has no computed value
  with a breakdown, so this row computes it. Game-free: tested on the made-up system.
- **SHEET-21** — found by ENG-47: the pinned base AC calculation is `systemData.acCalc`:
  `equipment` (the armor worn, else 10 + DEX) or an `ac.formulas` effect's part id; without it the
  highest counts. The control that pins one (SHEET-35) needs each candidate's key, name and value,
  and `Computed` gives only the chosen one's breakdown (`acCalcChosen` first when pinned).
- **SHEET-22** — found by ENG-17: a stored switch (`state.toggles`) stays after its entity is
  removed and warns `toggleGone` on every compute. Found by ENG-47: a pin that does not apply
  warns `stepRule` `acCalcNotApplying` on every compute. Removing an entity drops both.
- **SHEET-61** — found by SHEET-15: `defenses.conditionImmune.<key>` is 1 for a condition the
  character is immune to, but nothing reads it: a condition stored for the character still applies
  its effects, and `setCondition` still sets it. SRD 5.2.1 (Immunity): "If you have Immunity to a
  damage type or a condition, it doesn't affect you in any way" (SHEET-15 §8). The row decides,
  from each SRD's text, whether setting it is refused or warned and whether its effects stop; a
  warning never blocks.
- **SHEET-23** — SPEC §7.2: an "Undo" toast after every change, and the last 50 states kept in
  the history table; an entry is ENG-30's log entry.
- **SHEET-24** — ADR 008 item 4, BRIEF P2, board `V3-Characters`; an empty state with "+" and
  "Import file". No counter and no limit before the payment phase (ADR 005 item 2).
- **SHEET-25** — ADR 008 item 4: a swipe or "⋯" opens Actions. Copy, Export (a JSON file, SPEC
  §12 stage 2) and Delete (with Undo) work; Link for DM and Transfer wait for the table link's
  phase and show as coming later.
- **SHEET-26** — SPEC §5.8, §12 stage 2: an older file migrates; a file that fails its checks is
  refused with the reason, and nothing of it is saved.
- **SHEET-27** — SPEC §7.4 (manual mode), BRIEF P3 steps 1–8, board `V3-Create`: one scrolling
  form, a pinned bar with the live AC, hit points and initiative; warnings never block "Create".
  Found by ENG-19: where the editions use different words, the screens read
  `rulesOf(character).terms` (race or species, subrace or lineage, inspiration or heroic
  inspiration), each an i18n key's last part; a new character is written with
  `DEFAULT_HOUSE_RULES` and its edition's `abilityBonusSource` and `languageSource` (ENG-56).
  Score methods, steps that open and close, and the roll calculator are phase 4's (ADR 010 items
  11 and 12, ADR 013 items 7 and 8). The row gives each step its own empty file.
- **SHEET-28** — BRIEF P3 step 9. Found by ENG-49: a spell or item a grant names (a `spell` or
  `item` grant's `fixed` ids, and its chosen ones) is looked up, not gathered, so one of the other
  edition gets no `otherRuleset` warning, which a gathered entity gets. The starting inventory
  shows each one's edition (ADR 005 item 3.5) or warns there; the Spells tab does the same
  (SHEET-46).
- **SHEET-29** — found by ENG-37 (ADR 017): when the race or species and the background come from
  different editions and both raise ability scores, the manual form (BRIEF P3 step 6) shows a
  warning and a popup, or a sign that opens it: a checkbox for each, either, both or neither,
  and "Create" stays on. ENG-68's warning `abilityBonusConflict` says when, its `source` what is
  ticked. Board `V3-Conflict`. Phase 4's creation wizard shows the same.
- **SHEET-30** — BRIEF P4 V3, board `V3-Sheet`, ADR 013 items 1 and 2: the header (the name, the
  class line as the level, the edition badge, the choices badge, AC · initiative · speed ·
  proficiency, and for a caster the spellcasting line of ADR 009 item 4); the dock (the hit point
  bar with temporary hit points in their own colour, Damage, Heal, the tabs: the six of SPEC §7.2,
  About and Turn); play mode locked by default, with the Edit switch (SPEC §7.2). Every number
  comes from `Computed`. For the waves, the row gives each tab one empty file per section, an
  empty file for each panel the sheet opens (the number pad, the Rest frames, the "⋯" menu, the
  choices list), and one number component whose tap rolls (SHEET-39) and whose long press opens
  the breakdown (SHEET-33).
- **SHEET-31** — ADR 011, ADR 013 item 7: every entry opens and closes its description in place
  with the turning chevron; "See full description" shows the exact text with its source, or says
  the source has none. Phase 2's texts are the fixtures' and the person's free text.
- **SHEET-32** — board `V3-Sheet`: the stats, the saves, the skills with their proficiency, the
  passives. Found by ENG-43: a skill's stat is `Computed.keys['skills.<key>.ability']`, with steps
  naming the skill, each effect and a manual edit; the sheet shows that key, never the skill's own
  `ability`.
- **SHEET-33** — SPEC §7.2, BRIEF P5 sheet 2, board `V3-Roll`. Found by ENG-17: the breakdown's
  kind `override` is shown as "Manual edit" (SPEC §6.1 step 7). Found by ENG-40: an override's
  path or an effect's target may be one step such as `toString` (`computedPathSchema`).
  `compute()` handles it (`overrideNoPath`), but `Computed.values` and `Computed.breakdown` are
  plain objects, so `values['toString']` gives a function, not `undefined`. The screen reads only
  own fields, or the path schema refuses ENG-40's `RESERVED_KEYS` as a step.
- **SHEET-34** — found by ENG-17: an override applies only when its value is a number on a number
  path (`overrideNotANumber` otherwise), so the override editor stores a number there. Found by
  ENG-43: an override of a skill's stat applies only when its value is one of its keys (a stat's
  key, `overrideNotAKey` otherwise), so the editor stores a stat's key there. An override of a
  roll mode is a manual edit of it (ENG-34).
- **SHEET-35** — ENG-47's control, on the AC breakdown, from SHEET-21's candidates.
- **SHEET-36** — SPEC §7.2, "What needs choosing": the grants' `pendingChoices` and
  `Computed.pendingKeys`, each answered from the list. Found by ENG-48: a size not chosen is in
  `Computed.pendingKeys` (`{ path, options }`); the answer is written to
  `systemData.species.size`, not to `choices`. A stored size the species does not offer warns
  `stepRule` `sizeNotOffered`.
- **SHEET-37** — SPEC §6.5: the last 100 rolls of a character. Found by ENG-26: the roll log
  keeps `RollRecord`s, built with `recordRoll`. `rollRecordSchema` refuses an unknown field and
  carries no version of its own, so the table that keeps the log gives each record one; the table
  link does the same for what it sends.
- **SHEET-38** — ADR 009 item 1, ADR 010 items 4 and 5, boards `V3-SheetDice` and `V3-Dice`: the
  half-screen panel on the sheet, and the dice page; any count of dice; custom dice. Found by
  ENG-08: the engine has no random source of its own (lint refuses `Math.random` in it). The panel
  passes `fairDie(randomSourceOf((a) => crypto.getRandomValues(a)))` to `rollFormula`; "I roll
  myself" (SPEC §6.5) passes the faces the person typed as the die. The throw that looks real and
  dice skins are the dice phase's.
- **SHEET-39** — BRIEF P5 sheet 1, board `V3-Roll`. Found by ENG-34: each d20 test's roll mode is
  a number path, 1 advantage, −1 disadvantage, 0 neither, with a step per source:
  `checks.<stat>.mode`, `abilities.<stat>.saveMode`, `skills.<key>.mode`, `init.mode`,
  `attacks.<key>.mode`, `spell.attackMode`, `deathSave.mode` (`rolls.ts`, `attacks.ts`). Every
  step's `value` is its source's sign, so the roll dialog adds its own sources to those values
  with `rollModeOf` (2014 inspiration's advantage, a situational effect switched on, matched to
  the test by `ROLL_TARGETS`), rolls `d20Formula(mode)`, reads the kept d20 face with
  `attackOutcome(face, range)` (a weapon's `crit.range`, a spell's 20) and, on a critical hit,
  rolls `criticalDamage` of the damage dice. ENG-20's concentration save is the Constitution save:
  its mode is `abilities.con.saveMode`. "Send to DM" waits for the table link.
- **SHEET-40** — ADR 010 item 6, ADR 013 item 1, boards `V3-Keypad` and `V3-TempHP`. Found by
  ENG-20: damage returns the concentration save's DC (`outcome.concentrationDc`); the screen rolls
  it and calls `endConcentration` on a failure. Found by ENG-65: the pad offers knocking out
  (`applyDamage`'s `knockOut`) where the edition has it (`rulesOf(character).knockOutToOneHp`,
  2024) and the damage would drop the character to 0; the outcome's `status` `knockedOut` says it
  happened.
- **SHEET-41** — SPEC §6.4, §7.2: the spell held, and ending it by hand.
- **SHEET-42** — found by ENG-69: the sheet sets a fifth-edition character's condition through
  the module's `setConditionLevel` (`conditions.ts`), not the core's `setCondition`: only the
  module's ends every attunement when the level kills (exhaustion at its highest, ENG-67). Below
  that it gives the core's result. Found by ENG-19: exhaustion 6 is death in both editions and
  gives no number; the sheet says so.
- **SHEET-43** — found by ENG-58: the death save tracker calls `rollDeathSave` (`death-saves.ts`)
  with the kept d20 face and the total the dice panel gives (`d20Formula(deathSave.mode)`, with
  the person's bonuses); its outcome's `status` (`dying`, `stable`, `dead`, `up`) says what to
  show, and `isStable`, `isDead` give the state at any time. First aid's Medicine check, Spare the
  Dying and 2014's knocking out call `stabilize`; a revival spell calls `revive` with `1` or
  `max`. A stable character's 1 hit point after 1d4 hours is the person's `applyHealing` of 1:
  nothing keeps the time. Found by ENG-65: while `isKnockedOut`, the sheet offers first aid
  (`firstAid`): someone else's DC 10 Wisdom (Medicine) check, recorded as a success.
- **SHEET-44** — the P4 prompt's Combat tab, board `V3-Sheet`: each attack with its mastery
  (ENG-16); tapping it rolls through SHEET-39.
- **SHEET-45** — board `V3-Rest`. Found by ENG-21: a rest is one action and one entry, `shortRest`
  or `longRest` (`rests.ts`), pure, so the Rest frames (BRIEF P6) call it to show what comes back
  and keep its result on "Confirm"; the short rest takes every die spent, `{ die, roll }`, the face
  from the dice panel or the person's own throw, and its `outcome.hitDice` gives each die's hit
  points. The hit dice are `hitDice.d<N>.max` (with a breakdown) less
  `systemData.state.hitDiceSpent`. The recovery events `dawn`, `turn` and `manual` are triggered
  by no action (a magic item's charges at dawn); the row decides whether a frame offers them.
  Found by ENG-61: a long rest lowers exhaustion in both editions, but SRD 5.1's only "provided
  that the creature has also ingested some food and drink"; the 2014 Rest frame says so, and a
  person whose character did not eat sets the level back (SHEET-42).
- **SHEET-46** — ADR 010 item 9, ADR 009 item 4, board `V3-Spells`. Found by ENG-57: a granted
  spell's own uses are the resource of its `spell` grant's `key` (`resources.<key>.max`, spent in
  `state.resources`); `castSpell` takes the grant's part as `grant`. The sheet shows them on the
  spell's row ("1/LR, no spell slot", ADR 010 item 10). The resource's label is its entity's name,
  so two spell grants of one entity (a trait's spells at levels 3 and 5) give two resources with
  one label: the sheet pairs each with its spell through the grant's `key`. Found by ENG-49 (see
  SHEET-28): the tab shows each spell's edition or warns.
- **SHEET-47** — ADR 010 item 10, ADR 011 item 2, board `V3-Cast`: the summary, "See full
  description", "Cast", "Don't use a spell slot"; the dice at a higher slot (ENG-50); a new
  concentration ends the old one with a confirmation (SPEC §6.4). It reads SHEET-17.
- **SHEET-48** — ADR 009 item 2, board `V3-Features`: grouped under the species, the class (its
  subclass on the line below), the background, the feats; each with its uses, their recovery label
  (SHEET-20) and its switches (`state.toggles`, ENG-17).
- **SHEET-49** — ADR 010 item 8, board `V3-Turn`: built from each feature's `activation`; nothing
  is typed twice. It fills out as phase 3 adds content.
- **SHEET-50** — SPEC §7.2: worn and attuned change AC and attacks at once (ENG-44); weight;
  containers. Found by ENG-63: the inventory sets a row's `attuned` by hand; death clears every one
  (`deathChanges`, `actions.ts`); SHEET-18 warns past the limit.
- **SHEET-51** — SPEC §7.2: cp, sp, ep, gp, pp with + and −.
- **SHEET-52** — SPEC §12 stage 2 ("custom item", "custom feature" with text), ADR 009 item 7
  (free text now; with effects in phase 5), board `V3-Add`. The stored shape has both already: an
  inventory row's `custom`, and the character's own entities (`localEntities`).
- **SHEET-53** — ADR 009 item 3, board `V3-About`: background, alignment, languages, armor, weapon
  and tool proficiencies. Found by ENG-48: the size shown is `Computed.keys.size`, with steps
  naming the species or lineage, each effect and a manual edit. The stored character has no
  alignment field: the row adds one (a migration, SPEC §5.8) or keeps it in `notes`.
- **SHEET-54** — SPEC §5.8 `notes`.
- **SHEET-55** — ADR 009 item 5. Found by ENG-19: the inspiration stars hold the house rule's
  `inspirationMax` and show the edition's `inspiration.max` (1 in both SRDs) next to it; spending
  one does `inspiration.use` (advantage in 2014, a reroll of one die in 2024).
- **SHEET-56** — ADR 009 item 6, ADR 015 item 2, board `V3-Token`: the person's image, an animated
  picture or a short video included, kept in the blobs table on the device (ADR 005 item 10); the
  token is the image in a round frame (SHEET-03's slot).
- **SHEET-57** — ADR 009 items 7 and 8, board `V3-Add`: Mounts, Pets, Familiars, Notes or any
  named list, each entry free text; a companion is such an entry with its small stat block as text.
  A companion with a sheet of its own waits for the table link (ADR 014 item 9). A stored-shape
  change: `schemaVersion` and a migration (SPEC §5.8).
- **SHEET-58** — ADR 013 item 2 and the P4 prompt's list, board `V3-Actions`: Level up first, then
  Link for the DM, Export, Copy, Transfer, Rules options, Change history, Delete. Level up (phase
  4), Link for the DM and Transfer (the table link) and Rules options (phase 4's house rules) show
  as coming later. Rest and Edit stay header buttons.
- **SHEET-59** — SPEC §7.2's 50 states, opened from "⋯" (ADR 013 item 2: "undo any change").
  Undoing a change that later changes touched is decided in the row.
- **SHEET-60** — the gate above, in English (ADR 000). Its §11 measures each golden's time from an
  empty form to its values, and carries every tab's screenshot in the chat.

---

## Phases 3–7 — cut when the phase before closes

| Phase | SPEC stage | Area | What it delivers |
|---|---|---|---|
| 3 | 3 | `CONT` | SRD 2014 and 2024 import, mechanics for levels 1–5, the library, search, attribution |
| 4 | 4 | `WIZ` | The creation wizard, the level-up wizard, house rules |
| 5 | 5 | `HB` | The homebrew editor, the effect builder, before/after preview, several personal packs, `.gmpack` import and export with the import checks (ADR 003) |
| 6 | 6 | `PDF` | Own template (6a), filling an uploaded sheet (6b) |
| 7 | 7 | `POL` | Accessibility, performance, onboarding, optional Android |
| RU | — | `RU` | Russian locale, glossary check, Russian overlays for SRD texts (ADR 000); placed when phase 3 closes |
| SYS | — | `SYS` | More game systems: other D&D editions, Pathfinder, later others (ADR 004); placed when phase 2 closes |

- **Phase 3** — found by ENG-57: the SRD traits that cast a spell with no slot (SRD 5.1 Infernal
  Legacy; SRD 5.2.1 Elven Lineage, Fiendish Legacy, Gnomish Lineage, Magic Initiate; ENG-57 §8)
  are one `spell` grant per spell, each with its `atLevel`, its `uses` and a `key`.
- **Phase 3** — found by ENG-02: 11 of 4,428 5e-database slugs do not fit the entity id's slug
  pattern; the import maps them. ENG-02 §11 lists them.
- **Phase 3** — found by ENG-31: a core file may climb into a sibling package other than a
  module (`../../content/src/index.ts` passes lint, measured). The row that first makes
  `content`, `pdf` or `foundry` import the module also refuses that climb in `packages/schema/src`
  and `packages/engine/src`, or the core reaches the module through it with no error. Found by
  ENG-41: a module file climbs the same way (`../../content/src/index.ts`,
  `../../system-tales/src/index.ts` pass lint in `packages/system-5e/src`, measured); that row
  refuses it in `packages/system-*/src` too.
- **Phase 3** — found by ENG-32: SRD values the fifth-edition schemas cannot hold yet, measured
  at 5e-database `e6edf9a` (ENG-32 §8, §11): 2014's `mounts-and-vehicles` equipment (40 entries)
  has no `ItemDef.category`; 2024's "Until dispelled or triggered" (2 spells) has no place for
  "or triggered"; 2024's `elven-lineage`, `gnomish-lineage` and `magic-initiate` let the person
  choose the spellcasting stat among three, and a `spell` grant's `ability` takes one stat. The
  import widens the schema for each (no migration) or maps the value. The stat a grant casts
  with is read in one place, `grantCastingStat` (ENG-51), which then reads the choice.
- **Phase 3** — found by ENG-33: an entity two grants give is gathered once, with one choice
  per grant (ENG-11). That is right for a trait two sources give, and wrong for a feat taken
  twice: of 2024's feats, `ability-score-improvement`, `magic-initiate` and `skilled` say "You
  can take this feat more than once" (ENG-33 §8), and Magic Initiate can come twice at level 1
  (the Acolyte's, and a human's Versatile origin feat). 2024 gives its Ability Score Improvement feature at several levels under
  one id, so each level's choice needs its own class grant. The import, or a core row before it,
  gives a feat taken twice its own choices.
- **Phase 3** — found by ENG-10: 5e-database at `e6edf9a` gives the 2024 human one size,
  `Medium`, where the SRD's text, as dnd5e quotes it, is Medium or Small, chosen (ENG-10 §8). Its
  `prerequisites.feature_named` (the four fighting style feats: "Fighting Style"; Boon of Spell
  Recall: "Spellcasting") has no prerequisite kind: `entity` names one entity. The import decides
  each. No 2024 species or background gives a language; dnd5e puts Common and two standard
  languages on each background, and ENG-56 reads a 2024 background's `language` grants as 2024's
  starting languages (`languageSource` in `rulesets/2024.ts`), so the import puts them there, or
  changes that field. ENG-56 reads a side's own grants: 5e-database's high elf Extra Language is a
  trait (`extra-language`'s `language_options`). The import puts its grant on the high elf
  lineage; left on the trait, it is never left out, and adds to a 2024 background's three.
- **Phase 3** — found by ENG-29: two `resource` grants of one key give one resource, with the
  highest of their maximums. Mechanics that give one key from two classes (a multiclass) check
  in their §8 what the SRD says for that case; uses that add up are an effect `add` on
  `resources.<key>.max`.
- **Phase 3** — found by ENG-12: a stat's maximum caps its score after every base-phase effect
  (SPEC §6.1 step 4), so an item whose mechanics put a score above the maximum must raise
  `abilities.<key>.max` too (SPEC §5.4's belt, `max 21`). The mechanics' §8 checks which items
  do this.
- **Phase 3** — found by ENG-46: SPEC §5.4's targets `prof.armor`, `prof.weapon`, `prof.tool`,
  `prof.language` are computed by no path, so an effect on one changes nothing; proficiencies
  come only from grants (`gathered.proficiencies`, read by ENG-13, ENG-16, ENG-46). The mechanics
  that give a proficiency by an effect, if the SRDs have any, decide: a computed list, or grants.
- **Phase 3** — found by ENG-16, three things the weapons of the import and its mechanics meet:
  - Shillelagh (SRD 5.1, SRD 5.2.1) lets a club or a quarterstaff attack and deal damage with the
    spellcasting stat instead of Strength, and makes its die a d8; in 2024 the die grows at levels
    5, 11 and 17 (d10, d12, 2d6). ENG-16's attack stat is the weapon's kind's, or the higher with
    finesse, and its dice are the item's; a key path for the stat (ENG-43's road) would hold the
    stat. ENG-50's `scaling` adds dice and never changes a die's faces, so the growing die needs
    its own field.
  - A magic weapon has no kind of its own: dnd5e keeps `type.baseItem`, which its proficiency and
    mastery read. ENG-16 reads a weapon proficiency by key and a `mastery` kind by the item's own
    `key`, so a "Longsword, +1" with a key of its own loses both.
  - A `mastery` choice's filter (`type`, `tag`, `category`) cannot say the barbarian's "Melee
    weapons" nor the paladin's, ranger's and rogue's "with which you have proficiency" (ENG-16
    §8). The import widens the filter, tags the weapons, or lists them.
- **Phase 3** — found by ENG-50: growth a spell's `scaling` cannot hold (one formula, added to
  the first damage once per step; ENG-50 §8). SRD 5.1: Flame Blade and Spiritual Weapon grow every
  two slot levels; Flame Strike's die goes to the fire or the radiant damage, the caster's choice.
  SRD 5.2.1: Eldritch Blast gains beams, Shillelagh's die changes, Spare the Dying's range grows,
  True Strike gains extra damage it has none of at first. 5e-database `e6edf9a` gives the 2024
  spells no table by slot (one entry each), so the import reads 2024's growth from the text or
  dnd5e's data. The import widens the field (no migration) or maps each.
- **Phase 3** — found by ENG-53: healing a spell's `healing` (`{ formula, kind }`, `hp` or
  `tempHp`) cannot hold (ENG-53 §8): Aid (both SRDs) and 2014 Heroes' Feast raise the hit point
  maximum; 2024 Arcane Vigor heals by the hit die spent (dnd5e: one activity per die size);
  Regenerate's hit point each turn and Heroism's temporary hit points each turn. 5e-database's 2024
  spells have no `heal_at_slot_level`, so 2024's healing is read from dnd5e's data or the text. The
  import maps or widens each. A pack writes the spellcasting modifier as `@mod` (5e-database:
  `MOD`).
- **Phase 3** — found by ENG-51: SRD items that cast a spell "using your spell save DC" (2014
  Staff of Fire, Staff of Healing, Staff of Power, among others) do not say which DC when a
  character has more than one: a class's (`classes.<key>.spell.dc`) and a stat's a grant names
  (`abilities.<stat>.spell.dc`). The mechanics of those items pick one, or let the person pick.
- **Phase 3** — found by ENG-55: every spell's first damage adds `damage.spell.bonus`
  (`spellDice`, `spell-dice.ts`), so an effect on it cannot be limited to some spells. Each SRD
  bonus to a spell's damage is limited (ENG-55 §8): to a damage type (Elemental Affinity), a school
  (Empowered Evocation), one cantrip (Agonizing Blast: 2014 Eldritch Blast, 2024 a chosen one), a
  class's cantrips (2024 Potent Spellcasting); and "one damage roll of that spell" is one ray of a
  spell that rolls several (Scorching Ray). The mechanics of those features add a narrower target,
  or a condition an effect's `when` can test.
- **Phase 3** — found by ENG-60: Disciple of Life's mechanics are two effects in each SRD (ENG-60
  §3): SRD 5.1's `healing.spell.bonus` 2 and `healing.spell.bonusPerLevel` 1, SRD 5.2.1's the same
  on `healing.slot.*`. The Life domain's other healing features have no target: Blessed Healer
  (both SRDs, level 6) heals the caster 2 + the level when a spell heals another creature, and
  Supreme Healing (both, level 17) uses each healing die's highest number. The mechanics that
  reach those levels add what they need.
- **Phase 3** — found by ENG-64: SRD 5.2.1's Resourceful (the human) is one effect, `add 1` on
  `inspiration.longRest` (ENG-64 §3); the golden fixture's Resourceful is a name, and ENG-64's test
  index carries the effect. The Champion's Heroic Warrior (level 10) gives Heroic Inspiration at
  the start of a turn in combat; no action tracks turns, so the person gains it with
  `gainInspiration`. Its mechanics decide whether that stays the person's.
- **Phase 3** — found by ENG-13: a half proficiency that rounds up (2014's Remarkable Athlete:
  "half your proficiency bonus (round up)") and half a proficiency on every ability check (2014's
  Jack of All Trades). `skills.<key>.prof` 0.5 rounds down (`checkSteps`), and an ability check
  (`checks.<key>.total`) has no proficiency level. The mechanics of those features add what they
  need.
- **Phase 5** — found by ENG-39: a locale overlay keys its texts by field name, but carries only
  the core's `schemaVersion`. When a module renames a text field, a stored overlay keeps the old
  name and its text is no longer shown. The row that stores imported overlays gives them the
  module's version, or ties each to its pack's.
- **Phase 5** — found by ENG-38: a pack refuses unknown fields, so a pack file cannot name the
  published schema in a `$schema` field (`schema/5e/pack.schema.json`); an editor finds the schema
  only through its own setting. The row that writes the import checks decides: the pack takes an
  optional `$schema` (an optional field needs no migration), or the import removes it.
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
- **Phase 5** — found by ENG-34: an `advantage` or `disadvantage` on a `roll.*` target that no
  d20 test reads (a typo such as `roll.skil.athletics`, or `roll.save.san` on a character without
  `san`) warns nowhere, as an `append` on a list no step reads (ENG-14). The targets each test
  reads are `ROLL_TARGETS` (`rolls.ts`); the effect builder and the import checks compare a target
  with them.
- **Phases 2–5** — added by OPS-22: each screen is built from its mockup in
  `docs/design/mockups/` and its row in BRIEF Part 5; a design change made during a phase is
  made in the mockup and the canvas too.
- **ADR 009, by phase** — added by OPS-09. Phase 2: rows (SHEET-30, 38, 46, 48, 52, 53, 55, 56,
  57). Phase 3: several rulebooks at once, the source on every entry. Phase 5: custom stats, the person's packs next to the books, custom entries with effects. The
  dice phase (with ADR 005 item 11): the honest animated roll, custom roll modifiers. The table
  link's phase: the campaign copy, the DM's changes, approval of important changes.
- **Phase 4** — found by ENG-33: SPEC §8.4's point-buy budget is the point-buy method's (ADR 010
  item 12), not a house rule: `houseRulesSchema` has no field for it. A method is a key in
  `systemData.abilities.method`, with its rolls as ENG-26 roll records.
- **Phase 4** — found by ENG-13: a feat's `replaces` (ENG-33) leaves out the grant it names
  (`ruledGrants` in `module.ts`); one naming a grant the character does not reach is unused with
  no warning. The level-up wizard writes `replaces` only for a grant it shows, or the module
  gains a warning: since ENG-35 a module has warnings about the whole character
  (`SystemModule.ruleWarnings`, warned `characterRule`).
- **Phase 4** — found by ENG-35 (ENG-35 §8): SRD 5.1 says "If a character would gain the same
  proficiency from two different sources, he or she can choose a different proficiency of the
  same kind (skill or tool) instead"; SRD 5.2.1 has no such text. An edition difference the
  creation wizard offers; its value joins `rulesets/` (ENG-19).
- **Phase 4** — found by ENG-58: `levelUp` (`level-up.ts`) at 0 hit points raises them and keeps
  the death saves: golden A at 0 with 1 success and 2 failures, a 2014 cleric level at `avg`,
  gives 9 hit points and death saves `{ success: 1, failure: 2 }` (measured, ENG-58 §11). Hit
  points regained from 0 reset them in both SRDs. The level-up wizard offers no level-up at 0 hit
  points, or `levelUp` writes `deathSavesReset` (`actions.ts`) as healing does.
- **Phase 4** — found by ENG-56: where the starting languages come from is the person's pick
  when the species' side and the background both give some (ADR 005 item 3.4; no `both`, ADR
  014 item 1): `systemData.languageSource`, its rules base's by default. The creation wizard
  offers it then; `leftOutLanguageSide` (`languages.ts`) says when, as ENG-35's `leftOutSide`
  does for the ability bonus conflict window.
- **Phase 4** — found by ENG-19: a subclass chosen below its class's `subclassLevel` (2014: 1, 2
  or 3 by class; 2024: 3) gives no warning, and its spellcasting counts. The level-up wizard
  offers the subclass at that level, or the module gains a warning.
- **Phase 4** — found by ENG-45: SRD 5.1's variant encumbrance says "When you use this variant,
  ignore the Strength column of the Armor table" (`5e-SRD-Rules.json`). That is the house rule
  `encumbrance: 'variant'`, which no code reads; ENG-45's `speed.armorReduction` (`combat.ts`)
  reads no house rule. The row that makes the encumbrance house rule work gives it 0 under the
  variant.
- **ADR 010, by phase** — added by OPS-10. Phase 2: rows (SHEET-38, 40, 46, 47, 49). Phase
  3: the one-page library with topics and full entries, the All sources list. Phase 4: steps
  that open and close, ability score methods, level-up by XP or milestone. Phase 5: adding
  packs from "Books in use". DM tools: encounter templates. The table link's phase: the DM's
  level-up control, changes reviewed together.
- **ADR 012** — added by OPS-14. Phase 3: the library's list page and its floating entry window.
- **ADR 013, by phase** — added by OPS-15 to OPS-19. Phase 2: rows (SHEET-11, 12, 30, 31, 40,
  58). Phase 3: classes and subclasses per ruleset, one entry per ruleset, the spell's description
  layout, Sources with the SRDs built in, Quick rules with every SRD rule and linked terms,
  Bookmarks. Phase 4: the turning arrow on creation steps, the roll calculator, optional feats, the ability
  bonus conflict window. The dice phase: the roll that looks like a real throw. The table link's
  phase: level-up approval in a campaign, the DM's edit before approving, the approvals tab, the
  DM's setting for the conflict window. The DM tools' phase: actors with types. A second system:
  the system preview.
- **ADR 015** — added by OPS-26. Phase 2: rows (SHEET-01 to SHEET-06, SHEET-56). The theme
  editor's phase: the skin schema, import, export. The dice phase: dice skins and their effects.
  The purchases phase: frames, backgrounds, seasons.
- **ADR 014** — added by OPS-20. Phase 3: the import brings in both SRDs' rules chapters as
  `rule` entries with topics, for Quick rules; bookmarks are a table on the device.
- **ADR 011, by phase** — added by OPS-12. Phase 2: SHEET-31. Phase 3: the SRD texts. Phase 5:
  the person's packs.

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
Phase 2's waves (its section) say which of its rows can run in parallel chats.

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
| OPS-28 | The quality gate gives one verdict for one commit, whatever the load | S | 🔲 |
| OPS-29 | Phase 2 is cut into rows that run in waves | S | ✅ 2026-10-22 |

- **OPS-28** — found by ENG-66 (ENG-66 §11): ENG-23's speed pass (`compute.speed.ts`, the median
  × 4 at most 10 ms) fails on some runs in the cloud container with no code changed. On `05f3430`,
  8 runs gave a median × 4 of 6.53 to 11.20 ms, 2 of them above 10; ENG-23 measured 5.78 to
  6.07 ms. A gate that fails by the machine's load stops a commit that has no fault. The row
  decides how the check reads the same on every run of one commit. Found by OPS-29, and the row's
  hat widened for it: ENG-52's seeded-formula test (`packages/engine/test/average.test.ts`, its
  limit 5,000 ms) took 5,096 ms and 5,117 ms in two of four full `pnpm test` runs of one
  documents-only change on `c6e3395`, and passed in the other two; alone it took 2,157 ms.
  It belongs to no phase, so it can run now, beside any other row: it owns
  `packages/system-5e/test/speed/`, `packages/engine/test/average.test.ts` and `vitest.config.ts`,
  which no phase 2 row touches.
