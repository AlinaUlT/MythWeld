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
  **Built before SETUP-04** (Alina, 2026-09-27; option A in SETUP-04 §4), so the tab labels are
  i18n keys from the start.
- **SETUP-08** — **needs Alina.** Cloudflare Pages (or GitHub Pages) needs an account. A chat
  cannot create an account or sign in. SPA fallback to `index.html`.
- **SETUP-09** — the phase's last ticket. Its §11 carries the proof of the stage 0 gate: the link
  opened on Alina's phone, installed, and opened again with the network off.

---

## Phase 1 — Schemas and the engine (SPEC stage 1)

Gate: SPEC §12 stage 1 — golden tests A, B, B4, C, D, E pass; `engine` coverage ≥ 90 %; the
benchmark is within 10 ms; a formula cycle stops with a readable message. No UI, no SRD import.

**Re-cut before ENG-01 starts** (ADR 004). The rows below are the first cut, written for fifth
edition only. The re-cut splits the game-free core from the fifth-edition module, adds the
made-up test system, and puts ADR 003's pack items into the schema rows from the start: `system`,
the source details, the dependency checks, and refusing a newer `schemaVersion`. It also adds
ADR 005's three phase 1 items: golden F (a mixed-edition character, its values approved by Alina
first), the ability-bonus source as a choice, and a roll result that can be sent to a DM later.
The new rows are shown to Alina before they replace these.

| ID | Hat | Size | Status |
|---|---|---|---|
| ENG-01 | CI fails if `engine` imports React, DOM, Dexie or the network | XS | 🔲 |
| ENG-02 | Zod schemas for ids and the entity base | S | 🔲 |
| ENG-03 | Zod schemas for each entity type | M | 🔲 |
| ENG-04 | Zod schemas for effects, grants and prerequisites | S | 🔲 |
| ENG-05 | The content pack and locale overlay schemas, with the exported JSON Schema | S | 🔲 |
| ENG-06 | The character document schema, with the migration frame | S | 🔲 |
| ENG-07 | Formulas are parsed and evaluated safely, returning the paths they read | M | 🔲 |
| ENG-08 | Dice notation is rolled, with advantage, disadvantage and critical hits | S | 🔲 |
| ENG-09 | 2014 fixtures: the SRD entities goldens A and C need | M | 🔲 |
| ENG-10 | 2024 fixtures: the SRD entities goldens B, B4, C and D need | M | 🔲 |
| ENG-11 | `compute()` resolves references and expands grants | M | 🔲 |
| ENG-12 | Ability scores are computed in the base phase | S | 🔲 |
| ENG-13 | Modifiers, proficiency bonus, saves, skills and passives are computed | M | 🔲 |
| ENG-14 | Hit points, armor class, initiative and speed are computed | M | 🔲 |
| ENG-15 | Spellcasting numbers and slots are computed, multiclass included | M | 🔲 |
| ENG-16 | Attacks, weapon mastery and resource maximums are computed | M | 🔲 |
| ENG-17 | Derived-phase effects, toggles and manual overrides apply with a breakdown | M | 🔲 |
| ENG-18 | A formula cycle stops with a message naming the paths | S | 🔲 |
| ENG-19 | The 2014 and 2024 ruleset modules hold every rules difference | M | 🔲 |
| ENG-20 | Damage, healing and trackers change the character and can be undone | M | 🔲 |
| ENG-21 | Short rest, long rest and level-up change the character and can be undone | M | 🔲 |
| ENG-22 | Golden E: the homebrew pack from Appendix Д changes character B | S | 🔲 |
| ENG-23 | `engine` coverage is at least 90 % and `compute()` stays within 10 ms | S | 🔲 |

- **ENG-02** — `meta.translation` takes the four values of SPEC §5.2 (`official`, `community`,
  `machine`, `reviewed`); §3.3 lists only three. Alina's decision, 2026-09-27.
- **ENG-09, ENG-10** — hand-written minimal entities only, not an import. Every rules fact in
  them goes through §8 of the ticket (`[ПРОВЕРИТЬ]`).
- **ENG-09** — golden A says mountain dwarf, but its numbers (+2 CON, +1 WIS, Dwarven Toughness)
  are the hill dwarf's, and SRD 5.1 has only the hill dwarf. §8 checks the 2014 and 2024 sources
  and shows Alina the result before the fixture is written. The golden values are not changed
  without her.
- **ENG-12 to ENG-17** — each ticket turns on the golden-test lines it makes true. The full
  goldens A–D are green by ENG-19.
- **ENG-19** — ability increase source, subclass level, multiclass rounding, exhaustion, rests,
  inspiration (SPEC §6.3 table). Golden C and golden D close here.
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

Phases L1–L6 (Foundry, game master tools, assistant, accounts, shared room) are in SPEC §12 and
get rows only when Alina opens them. ADR 003 adds two more of that kind: the Fantasy Grounds
exporter, and the community place for sharing packs (its gate is a lawyer's check). ADR 005
reshapes three of them: L3 gains roll tables, generators and a fuller tool list; L4 is the
person's own AI key, free; L5's campaign sync becomes the table link. It adds three more: payments
(one payment, no subscription; its gate is a lawyer's check), dice skins, and the theme editor.

---

## Order

**Phase 0 → phase 1 → phase 2 → phase 3 → phase 4 → phase 5 → phase 6 → phase 7.** Inside a
phase, rows go in number order unless a row's "Depends on" allows otherwise.

Three things can change this order, and all are Alina's decision (SPEC §14):
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

- **OPS-03** — `docs/design/BRIEF.md`: the pages, what is on each, free and paid marks, the
  style of ADR 005 item 7, and a prompt per screen. Alina's chosen results come back into it.
