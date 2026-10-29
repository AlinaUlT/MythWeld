# Backlog — closed rows

Rows moved here from `docs/tickets/BACKLOG.md` word for word, so a new chat does not read them.
Phases 0 and 1 are closed; OPS keeps running, and only its closed rows are here.

---

## Phase 0 — The scaffold (SPEC stage 0)

Gate: SPEC §12 stage 0, with the English-only screenshot from ADR 000.

**Closed 2026-09-28.** The gate's proof is in SETUP-09 §11, in
[`docs/archive/tickets/SETUP_TICKET.md`](tickets/SETUP_TICKET.md).

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
[`docs/archive/tickets/ENG_TICKET.md`](tickets/ENG_TICKET.md).

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

## OPS — closed rows

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
| OPS-33 | A new chat reads less | XS | ✅ 2026-10-29 |
