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

**Closed 2026-11-08.** The gate's proof is in SHEET-60 §11, in
[`docs/archive/tickets/SHEET_TICKET.md`](../archive/tickets/SHEET_TICKET.md). ADR 019 decided what the
gate needed (SHEET-85, 86 and 87) and what waits for phases 3 and 4: picking the spells of a class
list, and a person's own timing of the 5 minutes. SHEET-88 is open and outside the gate.

**Cut on 2026-10-22 by OPS-29**, before phase 1 closed: ENG-64 is phase 1's last open row, and the
owner asked for rows she can start in parallel chats once it lands. No phase 2 row starts before
phase 1's gate is proved. The rows come from SPEC §12 stage 2 and from the ADRs that put work in
phase 2: ADR 008 (navigation), ADR 009, 010, 011 and 013 (the sheet, dice, descriptions, the home
page) and ADR 015 (the skin layer comes first). Each phase 1 note that named phase 2 is now the
note of the row that takes it. A screen row builds from its boards in `docs/design/mockups/` and
its row in BRIEF Part 5 (OPS-22). It draws the backgrounds, the header, the dock, cards, buttons,
the portrait, the token frame and the dice with `<Slot>` (SHEET-03), and the shape of buttons,
icon buttons, cards, panels, chips, sheets and toasts with `<Part>` (SHEET-04). It moves an
element only with `<Motion>` and a preset (SHEET-05); a motion the presets lack joins
`apps/web/src/theme/motions.ts`, moves only position, size or opacity, and is measured on the
Pixel 7 profile (ADR 015 item 9). BRIEF's prompts
still hold text that later ADRs replaced, so a screen row reads its prompt with the ADRs, and the
ADRs win (OPS-27 §11).

**Running rows at the same time.** The table is in work order. The rows of one wave run in
parallel chats once every row of the waves before it is closed: each row owns files no other row
of its wave touches. Two rows make that possible. SHEET-11 gives every phase 2 screen its route,
an empty page and its own i18n namespace file, and creates empty the shared pieces later rows
fill. SHEET-30 gives each tab of the sheet one empty file per section, and one empty file for each
panel the sheet opens (its §11 lists each file, its row and its namespace). Every chat still edits
`BACKLOG.md`, `SHEET_TICKET.md` and the archive, so the second chat to push rebases, keeps both
sides and runs the gate again (`CLAUDE.md`, the steps). A wave holds at most one row that may
change a stored shape (SHEET-53, SHEET-57, SHEET-76), so two chats never claim one version number.

| Wave | Rows | Starts when |
|---|---|---|
| 1 | SHEET-01, 02, 07, 14, 15, 17, 19 | Phase 1 is closed |
| 2 | SHEET-03, 04, 05, 06, 08, 10, 16, 18, 20, 21, 61 | Wave 1 is closed |
| 3 | SHEET-09, 11, 22, 62, 63, 64 | Wave 2 is closed |
| 4 | SHEET-12, 13, 23, 24, 37, 65, 66, 67 | Wave 3 is closed |
| 5 | SHEET-25, 27, 30, 31, 38, 68 | Wave 4 is closed |
| 6 | SHEET-26, 28, 32, 33, 36, 39, 46, 48, 50, 53, 54, 55, 56 | Wave 5 is closed |
| 7 | SHEET-29, 34, 40, 41, 42, 43, 44, 45, 47, 49, 51, 52, 57, 58 | Wave 6 is closed |
| 8 | SHEET-35, 59, 69, 70, 72, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84 | Wave 7 is closed |
| 9 | SHEET-74 | Wave 8 is closed: it reuses the field SHEET-69 makes for typed faces |
| 10 | SHEET-85, 86, 87 | Wave 9 is closed; found by SHEET-60, needed by the gate (ADR 019) |
| 11 | SHEET-60 | Wave 10 is closed: the gate runs again and closes phase 2 |

| ID | Hat | Size | Status |
|---|---|---|---|
| **Skin layer** | **before the first screen (ADR 015 item 13)** | | |
| SHEET-01 | The base theme's tokens cover every token the mockups use | S | ✅ 2026-10-28 |
| SHEET-02 | Lint fails on a colour, font or animation written in a component | S | ✅ 2026-10-28 |
| SHEET-03 | Screens draw named slots the base theme fills | S | ✅ 2026-10-28 |
| SHEET-04 | Each part takes its style from a fixed menu | M | ✅ 2026-10-29 |
| SHEET-05 | Animations are presets that stop for reduced motion | S | ✅ 2026-10-29 |
| SHEET-06 | The app's fonts ship inside it, each licence read | S | ✅ 2026-10-29 |
| SHEET-67 | A part names its fill slot without a lint finding | XS | ✅ 2026-10-29 |
| **On the device** | **tables, the mini-pack, saved characters** | | |
| SHEET-07 | Phase 2's device tables arrive in one database version | XS | ✅ 2026-10-28 |
| SHEET-08 | The phase 1 fixtures ship as the built-in mini-pack | M | ✅ 2026-10-29 |
| SHEET-09 | Built-in packs load into the content index at start | S | ✅ 2026-10-29 |
| SHEET-10 | Characters are saved on the device, migrated as they open | S | ✅ 2026-10-29 |
| **Navigation** | **ADR 008, ADR 013** | | |
| SHEET-11 | The start page replaces the bottom bar | M | ✅ 2026-10-29 |
| SHEET-12 | The player page shows its six sections | S | ✅ 2026-10-29 |
| SHEET-13 | Settings keep the person's display choices | S | ✅ 2026-10-29 |
| SHEET-68 | Distances can be shown in squares | XS | ✅ 2026-10-29 |
| **Rules the screens need** | **engine and module, no screen** | | |
| SHEET-14 | An unmet prerequisite gives a warning | S | ✅ 2026-10-28 |
| SHEET-15 | Resistances, immunities, vulnerabilities are computed from effects | S | ✅ 2026-10-28 |
| SHEET-16 | Damage applies the character's defenses by its type | S | ✅ 2026-10-29 |
| SHEET-17 | Casting warns of what forbids it | S | ✅ 2026-10-28 |
| SHEET-18 | Attunement past the limit gives a warning | XS | ✅ 2026-10-29 |
| SHEET-19 | Rolling initiative interrupts a knock-out's rest | XS | ✅ 2026-10-28 |
| SHEET-20 | A use's recovery amount is computed with a breakdown | S | ✅ 2026-10-29 |
| SHEET-21 | Every base AC calculation is computed for the pin | S | ✅ 2026-10-29 |
| SHEET-22 | Removing an entity drops what was stored for it | S | ✅ 2026-10-29 |
| SHEET-61 | A condition the character is immune to has no effect | S | ✅ 2026-10-29 |
| SHEET-62 | Gaining the Incapacitated condition ends concentration | XS | ✅ 2026-10-29 |
| SHEET-63 | Attuning two copies of one item gives a warning | XS | ✅ 2026-10-29 |
| SHEET-64 | Exhaustion the character is immune to does not kill | XS | ✅ 2026-10-29 |
| SHEET-65 | Dying ends concentration | XS | ✅ 2026-10-29 |
| SHEET-66 | An effect may set the size to any size the packs hold | S | ✅ 2026-10-29 |
| **Characters** | **the list, the file, the manual form** | | |
| SHEET-23 | An undo toast reverses the last change | S | ✅ 2026-10-29 |
| SHEET-24 | My characters lists the saved characters | S | ✅ 2026-10-29 |
| SHEET-25 | A character's Actions copy, export or delete it | S | ✅ 2026-10-29 |
| SHEET-26 | A character file imports through its checks | S | ✅ 2026-11-03 |
| SHEET-27 | The manual form makes a character | M | ✅ 2026-10-29 |
| SHEET-28 | The manual form's equipment step adds items | S | ✅ 2026-11-03 |
| SHEET-29 | The manual form shows the ability bonus window | S | ✅ 2026-11-04 |
| **The sheet** | **the frame, the tabs, trackers, rolls** | | |
| SHEET-30 | The sheet's frame pins the header above the dock | M | ✅ 2026-10-29 |
| SHEET-31 | An entry's description opens in place | S | ✅ 2026-10-29 |
| SHEET-32 | The Main tab shows every check bonus | S | ✅ 2026-11-03 |
| SHEET-33 | A long press opens a number's breakdown | S | ✅ 2026-11-03 |
| SHEET-34 | A manual edit overrides a number | S | ✅ 2026-11-04 |
| SHEET-35 | The AC breakdown pins its base calculation | XS | ✅ 2026-11-04 |
| SHEET-36 | The choices badge opens every pending choice | M | ✅ 2026-11-03 |
| SHEET-37 | Rolls are kept in the roll log | S | ✅ 2026-10-29 |
| SHEET-38 | The dice panel rolls any formula fairly | M | ✅ 2026-10-29 |
| SHEET-39 | Tapping a number rolls it in the roll dialog | M | ✅ 2026-11-03 |
| SHEET-40 | The number pad changes the hit points | M | ✅ 2026-11-04 |
| SHEET-41 | Concentration shows until it ends | XS | ✅ 2026-11-04 |
| SHEET-42 | Conditions are set from the sheet | S | ✅ 2026-11-04 |
| SHEET-43 | The death saves tracker follows a dying character | S | ✅ 2026-11-04 |
| SHEET-44 | The Combat tab lists the attacks | S | ✅ 2026-11-04 |
| SHEET-45 | The Rest frames show what comes back | M | ✅ 2026-11-04 |
| SHEET-46 | The Spells tab shows the slot grid | M | ✅ 2026-11-03 |
| SHEET-47 | The cast panel casts a spell | M | ✅ 2026-11-04 |
| SHEET-48 | The Features tab groups features by source | M | ✅ 2026-11-03 |
| SHEET-49 | The Turn tab lists actions by timing | S | ✅ 2026-11-04 |
| SHEET-50 | The Gear tab equips items | M | ✅ 2026-11-03 |
| SHEET-51 | Coins change by quick steps | XS | ✅ 2026-11-04 |
| SHEET-52 | Custom entries are added as free text | S | ✅ 2026-11-04 |
| SHEET-53 | The About tab shows the origin details | S | ✅ 2026-11-03 |
| SHEET-54 | The Notes tab keeps free text | XS | ✅ 2026-11-03 |
| SHEET-55 | Inspiration is tracked as stars | S | ✅ 2026-11-03 |
| SHEET-56 | The portrait makes a round token | S | ✅ 2026-11-03 |
| SHEET-57 | Custom sections hold the person's own lists | S | ✅ 2026-11-04 |
| SHEET-58 | The sheet's "⋯" menu opens the character's actions | S | ✅ 2026-11-04 |
| SHEET-59 | The change history lists the last 50 changes | S | ✅ 2026-11-04 |
| SHEET-60 | The phase 2 gate is shown on golden characters made by hand | M | ✅ 2026-11-08 |
| SHEET-69 | The roll dialog counts the faces a person types | S | ✅ 2026-11-04 |
| SHEET-70 | The header keeps the class line whole beside the choices badge | XS | ✅ 2026-11-04 |
| SHEET-71 | The undo toast shows above an open panel | XS | ✅ 2026-11-04 |
| SHEET-72 | The number pad takes a damage type and a critical hit | S | ✅ 2026-11-04 |
| SHEET-73 | A key closes the panel on top, not every panel | XS | ✅ 2026-11-04 |
| SHEET-74 | A hit die takes the faces a person typed | S | ✅ 2026-11-04 |
| SHEET-75 | A long attribution line wraps in a description | XS | ✅ 2026-11-04 |
| SHEET-76 | The Turn tab lists feats and once-per-turn timings | S | ✅ 2026-11-04 |
| SHEET-77 | A disabled button looks different from an enabled one | XS | ✅ 2026-11-04 |
| SHEET-78 | A second context menu on the same number opens its breakdown | XS | ✅ 2026-11-04 |
| SHEET-79 | A skill's stat is overridden from the sheet | S | ✅ 2026-11-04 |
| SHEET-80 | A custom entry is edited after it is added | S | ✅ 2026-11-04 |
| SHEET-81 | The toast stops covering the round buttons | XS | ✅ 2026-11-04 |
| SHEET-82 | The toast goes after its time once Undo was tapped | XS | ✅ 2026-11-04 |
| SHEET-83 | The roll dialog names an attack by its own name | XS | ✅ 2026-11-04 |
| SHEET-84 | The packs hold every damage type of the SRD | S | ✅ 2026-11-04 |
| SHEET-85 | Current hit points follow a pick that raises the maximum | S | ✅ 2026-11-08 |
| SHEET-86 | The Spells tab shows how many spells are prepared and how many cantrips are known | S | ✅ 2026-11-08 |
| SHEET-87 | The SHEET-11 route test waits for the back arrow before it measures it | XS | ✅ 2026-11-08 |
| SHEET-88 | Current hit points stay inside the maximum when a pick is taken back | XS | 🔲 |

- **SHEET-88** — found by SHEET-85: taking a pick back lowers the maximum and leaves the current
  hit points above it (golden A, 12 current, Hill Dwarf taken back: 12 of 11). Not needed for the
  phase 2 gate (ADR 019 item 1 does not list it).

---

## Phase 3 — The SRDs and the library (SPEC stage 3)

Gate: SPEC §12 stage 3, as ADR 000 changes it (the Russian overlays go to the Russian phase) and as
OPS-35 reads it: the import repeats with one command, every entity passes the schema and the counts
equal the source's; every feature of levels 1 to 5 is mechanized or marked `manual: true`; a typo
search ("fireb") finds Fireball; the About screen carries both SRDs' attribution. The "огнен" line
of the stage's list needs Russian names, so it moves to the Russian phase with them. CONT-62 is the
phase's last row: its §11 carries the proof.

**Cut on 2026-11-08 by OPS-35**, before phase 2 closed: SHEET-85, 86 and 87 and then SHEET-60 are
its last rows (ADR 019), and the owner asked for rows she can start in parallel chats. No phase 3
row starts before phase 2's gate is proved. The rows come from SPEC §12 stage 3, §3, §6.8, §7.3 and
§9 (search), and from the ADRs that put work in phase 3: ADR 003, 009, 010, 011, 012, 013 and 014. A
screen row builds from its boards in `docs/design/mockups/` and its row in BRIEF Part 5 (P7 Library
and an entry's card, P17 Player page), with `<Slot>`, `<Part>` and `<Motion>` as phase 2's rows do.
This cut is a first guess, as the sizes are: a row the work shows is wrong is re-cut, and its §11
says so.

**Running rows at the same time.** The rows of one wave run in parallel chats once every row of the
waves before it is closed (`PROMPTS.md` prompt 8 runs several in one chat). Each row owns files no
other row of its wave touches: an importer is one file in `packages/content/src/import/` (CONT-04
creates them empty); a mechanics file is one `packages/content/mechanics/<pack>/<type>/<slug>.json`
for one entity, so two class rows never meet; a topic's list and a window are files CONT-03 creates
empty. Every chat still edits `BACKLOG.md`, `CONT_TICKET.md` and the archive, so the second chat to
push rebases, keeps both sides and runs the gate again (`CLAUDE.md`, the steps). Two things a wave
holds at most one of: a row that edits the fifth-edition schemas and so the published JSON Schema
(CONT-05 in wave 1, CONT-06 in wave 2), and a row that claims a database version (CONT-02).
Mechanics rows check in their §8 what each SRD says before they write an effect, and what a
multiclass does with it (ENG-29: two `resource` grants of one key give one resource, with the
highest maximum; uses that add up are an effect `add` on `resources.<key>.max`).

| Wave | Rows | Starts when |
|---|---|---|
| 1 | CONT-01 to 05 | Phase 2 is closed (SHEET-60) |
| 2 | CONT-06 to 19 | Wave 1 is closed |
| 3 | CONT-20 to 59 | Wave 2 is closed |
| 4 | CONT-60 to 61 | Wave 3 is closed |
| 5 | CONT-62 | Wave 4 is closed |

| ID | Hat | Size | Status |
|---|---|---|---|
| CONT-01 | One command fetches the import source at a pinned commit | S | 🔲 |
| CONT-02 | Phase 3's device tables arrive in one database version | XS | 🔲 |
| CONT-03 | Every phase 3 screen has its own empty file | S | 🔲 |
| CONT-04 | The import frame maps both SRDs' entries to our ids | S | 🔲 |
| CONT-05 | The fifth-edition schemas hold the SRD values found so far | M | 🔲 |
| CONT-06 | Monsters have an entity type | S | 🔲 |
| CONT-07 | Spells are imported from both SRDs | M | 🔲 |
| CONT-08 | Classes are imported with their subclasses | M | 🔲 |
| CONT-09 | Species are imported with their subraces | S | 🔲 |
| CONT-10 | Backgrounds are imported from both SRDs | S | 🔲 |
| CONT-11 | Feats are imported from both SRDs | S | 🔲 |
| CONT-12 | Equipment is imported from both SRDs | M | 🔲 |
| CONT-13 | Magic items are imported from both SRDs | S | 🔲 |
| CONT-14 | The small rule types are imported from both SRDs | S | 🔲 |
| CONT-15 | The rules chapters are imported as rules with topics | M | 🔲 |
| CONT-16 | The build merges hand-written mechanics into the imports by id | S | 🔲 |
| CONT-17 | Search finds a name by prefix, case, accent or typo | M | 🔲 |
| CONT-18 | The library page lists one topic under a search field | M | 🔲 |
| CONT-19 | An entry opens in a floating window over its list | M | 🔲 |
| CONT-20 | Monsters are imported from both SRDs | M | 🔲 |
| CONT-21 | The import's entry counts match the sources | S | 🔲 |
| CONT-22 | The Barbarian's levels 1 to 5 have mechanics in both SRDs | S | 🔲 |
| CONT-23 | The Bard's levels 1 to 5 have mechanics in both SRDs | M | 🔲 |
| CONT-24 | The Cleric's levels 1 to 5 have mechanics in both SRDs | M | 🔲 |
| CONT-25 | The Druid's levels 1 to 5 have mechanics in both SRDs | M | 🔲 |
| CONT-26 | The Fighter's levels 1 to 5 have mechanics in both SRDs | S | 🔲 |
| CONT-27 | The Monk's levels 1 to 5 have mechanics in both SRDs | S | 🔲 |
| CONT-28 | The Paladin's levels 1 to 5 have mechanics in both SRDs | M | 🔲 |
| CONT-29 | The Ranger's levels 1 to 5 have mechanics in both SRDs | M | 🔲 |
| CONT-30 | The Rogue's levels 1 to 5 have mechanics in both SRDs | S | 🔲 |
| CONT-31 | The Sorcerer's levels 1 to 5 have mechanics in both SRDs | M | 🔲 |
| CONT-32 | The Warlock's levels 1 to 5 have mechanics in both SRDs | M | 🔲 |
| CONT-33 | The Wizard's levels 1 to 5 have mechanics in both SRDs | M | 🔲 |
| CONT-34 | The 2014 races have mechanics | S | 🔲 |
| CONT-35 | The 2024 species have mechanics | S | 🔲 |
| CONT-36 | The backgrounds have mechanics | S | 🔲 |
| CONT-37 | The feats have mechanics | S | 🔲 |
| CONT-38 | The spells that give features have mechanics | M | 🔲 |
| CONT-39 | The magic items with effects have mechanics | M | 🔲 |
| CONT-40 | The conditions have mechanics | S | 🔲 |
| CONT-41 | The device keeps the search index | S | 🔲 |
| CONT-42 | Entry text links a word to its entry or rule | M | 🔲 |
| CONT-43 | The Spells topic lists its spells by level with filters | M | 🔲 |
| CONT-44 | A spell's window lists who can cast it in each ruleset | S | 🔲 |
| CONT-45 | The Classes topic opens a class with its level table | M | 🔲 |
| CONT-46 | The Species topic lists species or races by ruleset | S | 🔲 |
| CONT-47 | The Backgrounds topic lists its entries | S | 🔲 |
| CONT-48 | The Feats topic lists its entries | S | 🔲 |
| CONT-49 | The equipment topics list their entries | M | 🔲 |
| CONT-50 | The Magic items topic lists its entries | S | 🔲 |
| CONT-51 | The Conditions topic lists its entries | XS | 🔲 |
| CONT-52 | The Monsters topic lists its entries | M | 🔲 |
| CONT-53 | Quick rules show their topics as cards | M | 🔲 |
| CONT-54 | A Quick rules topic or rule opens in a floating window | M | 🔲 |
| CONT-55 | A bookmark is kept from an entry's window | S | 🔲 |
| CONT-56 | The Bookmarks page lists the person's bookmarks | S | 🔲 |
| CONT-57 | The Sources page lists every book with its license | S | 🔲 |
| CONT-58 | A ruleset switch hides the other edition's entries | S | 🔲 |
| CONT-59 | The About screen shows both SRDs' attribution | S | 🔲 |
| CONT-60 | Every feature of levels 1 to 5 is mechanized or marked manual | S | 🔲 |
| CONT-61 | The built-in packs are the full SRDs | M | 🔲 |
| CONT-62 | The phase 3 gate is shown on the built packs | M | 🔲 |

- **CONT-01** — the 5e-database files of 5e-bits/5e-srd-api,
  `packages/5e-database/src/{2014,2024}/en/*.json` (SPEC §3.2), pinned to one commit (ENG-02 and
  ENG-32 measured `e6edf9a`). `docs/RUNNING.md` gets the command. `src/2014/ru` is not a source of
  terms (SPEC §3.2); nothing is taken from ttg.club or wikidot (`CLAUDE.md`).
- **CONT-02** — `bookmarks`, `entityIndex` (SHEET-07 left it for phase 3) and any other table phase
  3 stores into, in one Dexie version, as SHEET-07 did, so no two rows claim one version. Later rows
  add fields to a row, never a version. Bookmarks stay on the device, outside any character (ADR 014
  item 13).
- **CONT-03** — as SHEET-11 and SHEET-30 did: a route for the library (with a topic), Quick rules,
  Bookmarks, Sources and About, an empty page file and an i18n namespace file for each, one empty
  file for each topic list and each window the later rows fill, and the player page's tiles linking
  to them. Its §11 lists each file with the row that fills it.
- **CONT-04** — the frame also reads both text shapes. Found by ENG-02: 11 of 4,428 slugs do not fit the
  entity id's slug pattern; the frame maps them (ENG-02 §11 lists them). SPEC §3.2: 2014 keeps text
  in `desc: string[]`, 2024 in `description: string`. The frame checks every entity with the pack
  schema and creates one empty importer file for each type, with a registry, so no two wave 2 rows
  edit one file.
- **CONT-05** — the only row of wave 1 that edits the fifth-edition schemas and the published JSON
  Schema (`pnpm vitest run apps/web/test/pack-schema.test.ts --update`, `docs/RUNNING.md`); no
  migration, every field optional. It widens them for what phase 1 found:
  - ENG-32: 2014 `mounts-and-vehicles` (40 entries) has no `ItemDef.category`; 2024's "Until
    dispelled or triggered" (2 spells) has no place for "or triggered"; 2024's `elven-lineage`,
    `gnomish-lineage`, `magic-initiate` let the person choose the casting stat among three, and a
    `spell` grant's `ability` takes one (`grantCastingStat`, ENG-51, then reads the choice).
  - ENG-50: growth a spell's `scaling` cannot hold: SRD 5.1 Flame Blade and Spiritual Weapon (every
    two slot levels), Flame Strike's die type; SRD 5.2.1 Eldritch Blast beams, Shillelagh's die,
    Spare the Dying's range, True Strike's extra damage.
  - ENG-53: healing `healing` cannot hold: Aid (both), 2014 Heroes' Feast (hit point maximum), 2024
    Arcane Vigor (by hit die), Regenerate and Heroism (each turn).
  - ENG-16: a `mastery` choice's filter cannot say "Melee weapons" or "with which you have
    proficiency"; a growing die needs its own field; a magic weapon has no kind of its own (dnd5e
    `type.baseItem`).
  - ENG-33: a feat taken twice needs its own choices (2024 `ability-score-improvement`,
    `magic-initiate`, `skilled`); 2024's Ability Score Improvement under one id needs a class grant
    for each level.
  - ENG-10: the 2024 human's size is Medium or Small, chosen; `prerequisites.feature_named` (the
    four fighting style feats; Boon of Spell Recall) has no prerequisite kind.
- **CONT-06** — ADR 010 item 3 lists a Monsters topic in phase 3; the schemas have no monster type
  (measured: no `monster` in `packages/schema/src` or `packages/system-5e/src`). The only row of
  wave 2 that edits the schemas. The type lives in the fifth-edition module (ADR 004).
- **CONT-07** — 5e-database gives 2024 spells no `heal_at_slot_level` and no table by slot (ENG-50,
  ENG-53): their healing and growth are read from the text or from dnd5e's data, into the fields
  CONT-05 made. A pack writes the spellcasting modifier as `@mod` (5e-database: `MOD`).
- **CONT-08** — each class's level table (SPEC §3.1: 12 classes, one subclass each, in both SRDs).
- **CONT-09** — found by ENG-10: 5e-database gives the 2024 human one size, `Medium`; the SRD's text
  is Medium or Small (the field CONT-05 made holds the choice). High elf's Extra Language is a trait
  (`language_options`): the import puts its grant on the lineage, because ENG-56 reads a side's own
  grants and a grant left on the trait is never left out.
- **CONT-10** — SRD 5.1 has one (Acolyte), SRD 5.2.1 four. 5e-database has no text for the 2024
  backgrounds (SPEC §3.2): it comes from the SRD 5.2.1 PDF, CC-BY-4.0, with its page named in the
  row's §8. No 2024 species or background gives a language; dnd5e puts Common and two standard
  languages on each background, and ENG-56 reads a 2024 background's `language` grants as 2024's
  starting languages (`languageSource`, `rulesets/2024.ts`): the import puts them there, or changes
  that field.
- **CONT-11** — SRD 5.1 has one (Grappler), SRD 5.2.1 seventeen: 4 origin, 2 general, 4 fighting
  style, 7 epic boons (SPEC §3.1). `prerequisites.feature_named` takes the kind CONT-05 made.
- **CONT-12** — armor, weapons, gear, tools, packs, mounts and vehicles. Weapons are tagged so
  ENG-16's "Melee weapons" and "with which you have proficiency" filters can read them (the filter
  field is CONT-05's); `mounts-and-vehicles` takes the category CONT-05 made.
- **CONT-13** — the import only; their effects are CONT-39.
- **CONT-14** — skills, abilities, conditions, damage types, languages, proficiencies and the other
  small types the packs carry (SHEET-84 closed the damage types in the mini-pack).
- **CONT-15** — ADR 014 item 13: both SRDs' rules chapters become `rule` entries, each with a
  `topic` (the `ruleTopic` entries of ADR 013 item 18's list) and an optional icon key, for Quick
  rules.
- **CONT-16** — SPEC §6.8: files at `packages/content/mechanics/<pack>/<type>/<slug>.json`, merged
  by `EntityId`. A mechanics file whose id the import lacks fails the build; an entity with no
  mechanics carries `meta.manual: true`. Foundry dnd5e's `packs/_source` is the reference for
  effects (MIT code, CC-BY-4.0 content).
- **CONT-17** — pure code in `packages/engine`, over `name.en`, `name.ru` and `aliases` (ADR 014
  item 4, SPEC §9): case and ё = е, prefix, typos. Gate line: a typo search, "fireb", finds
  Fireball. The gate's "огнен" line needs Russian names, which come with the Russian phase (OPS-35
  §11).
- **CONT-18** — ADR 012 items 2, 3 and 5; board `Library` (BRIEF P7): the topic picker, the search
  field, the Filter and Sources buttons, grouping and sorting, a legend; each entry a card with its
  kind's icon, name, source badge (ADR 009 item 12), second line and markers. A topic names its own
  markers through the empty files of CONT-03. The Export button waits for phase 5's `.gmpack` export
  (ADR 003 item A5).
- **CONT-19** — ADR 012 items 1 and 4, ADR 013 item 6; board `Entry`: the other-language name under
  the name, a small top part (type line, source, properties box), the full text with tappable dice
  that roll (SHEET-39's dialog), "See full description" (ADR 011). No "Damage dice" list. Closing
  returns to the same place in the list. Share is here; the bookmark button is CONT-55, the homebrew
  copy and edit in "⋯" are phase 5.
- **CONT-20** — takes the type CONT-06 made.
- **CONT-21** — a test counts each type in each edition against the pinned source (SPEC §12 stage 3
  gate) and runs every entity through the pack schema.
- **CONT-22** — ENG-16: the mastery choice's filter "Melee weapons" (the field CONT-05 made).
- **CONT-23** — ENG-13: 2014 Jack of All Trades is half the proficiency bonus on every ability
  check, and `skills.<key>.prof` 0.5 rounds down; the mechanics add what they need.
- **CONT-24** — ENG-60: Disciple of Life is two effects in each SRD (SRD 5.1 `healing.spell.bonus` 2
  and `healing.spell.bonusPerLevel` 1; SRD 5.2.1 the same on `healing.slot.*`).
- **CONT-25** — Wild Shape is a tracked use (SPEC §6.8 item 2); the row's §8 reads what each SRD
  gives at levels 1 to 5.
- **CONT-26** — golden B and B4's hand-written fixtures (ENG-10) are the reference for its entries.
- **CONT-27** — its pool of points is a `resource` grant with its recovery (SPEC §6.8 item 2); the
  row's §8 reads the pool's name in each edition.
- **CONT-28** — ENG-16: the mastery choice's filter "with which you have proficiency".
- **CONT-29** — ENG-16: the mastery choice's filter "with which you have proficiency".
- **CONT-30** — ENG-16: the mastery choice's filter "with which you have proficiency".
- **CONT-31** — the sorcery points are a tracked resource (SPEC §6.8 item 2); the row's §8 reads
  what each SRD gives at levels 1 to 5.
- **CONT-32** — ENG-55: Agonizing Blast adds to one cantrip's damage (2014 Eldritch Blast; 2024 a
  chosen one); the mechanics add a narrower target or a condition for `when`.
- **CONT-33** — Arcane Recovery is a tracked use (SPEC §6.8 item 2); which spells the spellbook
  holds is the person's list, which phase 4 asks for (ADR 019).
- **CONT-34** — the races and their subraces. ENG-57: SRD 5.1 Infernal Legacy casts spells with no
  slot: one `spell` grant per spell, each with its `atLevel`, `uses` and `key`.
- **CONT-35** — ENG-57: Elven Lineage, Fiendish Legacy, Gnomish Lineage (one `spell` grant per
  spell, as above). ENG-64: Resourceful (the human) is one effect, `add 1` on
  `inspiration.longRest`; golden B's fixture holds the name only. ENG-10: the human's size is
  chosen.
- **CONT-36** — each 2024 background's origin feat and tool or skill grants; the language grants of
  CONT-10.
- **CONT-37** — ENG-33: a feat taken twice gets its own choices (the field CONT-05 made); Magic
  Initiate's spells are `spell` grants (ENG-57).
- **CONT-38** — SPEC §6.8 item 3. ENG-50, ENG-53: growth and healing in the fields CONT-05 made.
  ENG-55: a spell bonus limited to a type, a school or one spell needs a narrower target. ENG-16:
  Shillelagh uses the casting stat for a club or quarterstaff and a d8 (2024: a die that grows at
  levels 5, 11 and 17).
- **CONT-39** — ENG-12: an item that puts a score above its maximum raises `abilities.<key>.max` too
  (the belt, `max 21`). ENG-46: `prof.armor`, `prof.weapon`, `prof.tool` and `prof.language` are
  computed by no path; a proficiency by effect becomes a computed list or grants. ENG-51: items that
  cast a spell "using your spell save DC" (2014 Staff of Fire, Staff of Healing, Staff of Power)
  pick one DC, or let the person pick. ENG-16: a "Longsword, +1" with a key of its own loses
  proficiency and mastery.
- **CONT-40** — golden D's exhaustion (SPEC §6.7) is the reference for how a condition's effects are
  written; the row's §8 lists each condition of each SRD.
- **CONT-41** — fills the `entityIndex` CONT-02 made, from the packs in use at start (SHEET-09),
  rebuilt when they change.
- **CONT-42** — ADR 013 item 18: a word whose entry or rule exists is a link ("concentration" in a
  spell opens the Concentration rule); a word with no target stays plain; the link plugin of SPEC
  §4.2 reads `{@…}`.
- **CONT-43** — ADR 012 item 3: groups by level (Cantrips, Level 1, …), the school's icon, markers V
  S M, concentration, ritual. SPEC §7.3 filters: level, school, class, casting time, concentration,
  ritual, components. One entry per ruleset (ADR 013 item 5).
- **CONT-44** — ADR 013 item 4: "Wizard (2014)", "Wizard (2024)", each with its source.
- **CONT-45** — ADR 013: classes and subclasses per ruleset, one entry per ruleset; board `Classes`.
- **CONT-46** — the word "Race" in 2014 and "Species" in 2024 (SPEC §9).
- **CONT-47** — SRD 5.1 has one entry, SRD 5.2.1 four (SPEC §3.1).
- **CONT-48** — grouped as SPEC §3.1 groups the 2024 feats: origin, general, fighting style, epic
  boon.
- **CONT-49** — ADR 010 item 3: Armor, Weapons and Items.
- **CONT-50** — rarity and attunement as markers.
- **CONT-51** — a condition's text, and its levels where it has them (exhaustion).
- **CONT-52** — needs CONT-20.
- **CONT-53** — ADR 013 item 18; board `QuickRules`: the title, a search field, the topics as cards.
- **CONT-54** — ADR 013 item 18; board `QuickRule`: the rule's window over the topic's, everything
  behind dimmed; a small box with the topic (a link back) and the source, a one-line summary, the
  full text.
- **CONT-55** — the bookmark button of ADR 013 items 6 and 17, in the entry window and the rule
  window; the table is CONT-02's.
- **CONT-56** — ADR 013 item 17.
- **CONT-57** — ADR 010 item 2, ADR 013 item 17; board `Sources`: both SRDs built in from the first
  start, whether each is in use (ADR 009: several rulebooks at once). Packs of the person's own come
  with phase 5.
- **CONT-58** — SPEC §7.3: 2014, 2024 or both. ADR 005 item 3.5: a setting "prefer 2014" or "prefer
  2024" hides the other copy of an entry in lists; a badge shows each entry's edition.
- **CONT-59** — the texts of SPEC Appendix В, `[ПРОВЕРИТЬ]` word for word against the legal page of
  each SRD PDF (SPEC §3.5), in §8. "5E compatible" is the only phrase for the edition; no WotC name
  or logo (`CLAUDE.md`).
- **CONT-60** — a check over the build (SPEC §6.8, gate): each feature has effects or `meta.manual:
  true`; each mechanized entity has a unit test.
- **CONT-61** — replaces the mini-pack of SHEET-08 in `BUILT_IN_PACKS`. The goldens and `pnpm e2e`
  stay green; the ids the sheet uses do not change; the build's size, the first frame and the
  offline start (SETUP-07) are measured.
- **CONT-62** — its §11 carries the proof of SPEC §12 stage 3 as ADR 000 and OPS-35 change it, and
  each screen's screenshot at 360×800 in the chat.

---
## Phases 4–7 — cut when the phase before closes

| Phase | SPEC stage | Area | What it delivers |
|---|---|---|---|
| 4 | 4 | `WIZ` | The creation wizard, the level-up wizard, house rules |
| 5 | 5 | `HB` | The homebrew editor, the effect builder, before/after preview, several personal packs, `.gmpack` import and export with the import checks (ADR 003) |
| 6 | 6 | `PDF` | Own template (6a), filling an uploaded sheet (6b) |
| 7 | 7 | `POL` | Accessibility, performance, onboarding, optional Android |
| RU | — | `RU` | Russian locale, glossary check, Russian overlays for SRD texts (ADR 000); placed when phase 3 closes (its section above) |
| SYS | — | `SYS` | More game systems: other D&D editions, Pathfinder, later others (ADR 004); placed when phase 2 closes |

- **Levels 6 to 20** — found by ENG-60, ENG-64, ENG-13 and ENG-55, placed by OPS-35: SPEC §12 stage
  3's gate ends at level 5, so no phase 3 row writes these mechanics, and they have no row yet; the
  owner places them when phase 3 closes. What phase 1 found for them: Blessed Healer (both SRDs,
  level 6) heals the caster 2 + the level when a spell heals another creature, and Supreme Healing
  (both, level 17) uses each healing die's highest number (ENG-60); the Champion's Heroic Warrior
  (level 10) gives Heroic Inspiration at the start of a turn in combat, no action tracks turns, so
  the person gains it with `gainInspiration`, and its mechanics decide whether that stays the
  person's (ENG-64); 2014's Remarkable Athlete is half the proficiency bonus, rounded up, and
  `skills.<key>.prof` 0.5 rounds down (ENG-13); Elemental Affinity (a damage type), Empowered
  Evocation (a school) and 2024 Potent Spellcasting (a class's cantrips) limit a spell damage bonus
  (ENG-55).
- **Phase 4** — found by SHEET-60 (ADR 019): choosing the spells of a class list (cantrips
  known, spells prepared) has no screen. Phase 3's library (CONT-43) gives the lists; phase 4's
  wizard asks for the choices.
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
  57). Phase 3: rows (CONT-18, 19, 57, 58). Phase 5: custom stats, the person's packs next to the books, custom entries with effects. The
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
- **ADR 010, by phase** — added by OPS-10. Phase 2: rows (SHEET-38, 40, 46, 47, 49). Phase 3: rows (CONT-18, 19, 43 to 52, 57). Phase 4: steps
  that open and close, ability score methods, level-up by XP or milestone. Phase 5: adding
  packs from "Books in use". DM tools: encounter templates. The table link's phase: the DM's
  level-up control, changes reviewed together.
- **ADR 012** — added by OPS-14. Phase 3: rows (CONT-18, 19).
- **ADR 013, by phase** — added by OPS-15 to OPS-19. Phase 2: rows (SHEET-11, 12, 30, 31, 40,
  58). Phase 3: rows (CONT-19, 42, 44, 45, 53 to 58). Phase 4: the turning arrow on creation steps, the roll calculator, optional feats, the ability
  bonus conflict window. The dice phase: the roll that looks like a real throw. The table link's
  phase: level-up approval in a campaign, the DM's edit before approving, the approvals tab, the
  DM's setting for the conflict window. The DM tools' phase: actors with types. A second system:
  the system preview.
- **ADR 015** — added by OPS-26. Phase 2: rows (SHEET-01 to SHEET-06, SHEET-56). The theme
  editor's phase: the skin schema, import, export. The dice phase: dice skins and their effects.
  The purchases phase: frames, backgrounds, seasons.
- **ADR 014** — added by OPS-20. Phase 3: rows (CONT-02, 15, 56).
- **ADR 011, by phase** — added by OPS-12. Phase 2: SHEET-31. Phase 3: rows (CONT-07 to 15, 19, 42). Phase 5:
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
The waves of phase 2 and phase 3 (their sections) say which of their rows can run in parallel chats.

Three things can change this order, and all are the owner's decision (SPEC §14):
- if she plays in Foundry now, L1 can move ahead of phase 6;
- the Russian phase is placed when phase 3 closes (its section above);
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
| OPS-28 | The quality gate gives one verdict for one commit, whatever the load | S | ✅ 2026-10-29 |
| OPS-29 | Phase 2 is cut into rows that run in waves | S | ✅ 2026-10-22 |
| OPS-30 | `RUNNING.md` names the container's current Chromium path | XS | ✅ 2026-10-29 |
| OPS-31 | The chat with the owner is in English | XS | ✅ 2026-10-28 |
| OPS-32 | The changelog's format example names no real ticket | XS | ✅ 2026-10-29 |
| OPS-33 | The rows found in wave 7 join the waves, and a prompt runs several rows in one chat | XS | ✅ 2026-11-04 |
| OPS-34 | The rows found in wave 7's last batch join wave 8 | XS | ✅ 2026-11-04 |
| OPS-35 | Phase 3 is cut into rows that run in waves | S | ✅ 2026-11-08 |
