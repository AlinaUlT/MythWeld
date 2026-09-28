# ADR 004 — More than one game system

**Status:** accepted · **Date:** 2026-09-28 · **Decided by:** Alina

## Context

The SPEC builds a sheet for one game: fifth edition, with the 2014 rules and the 2024 rules. Alina
decided on 2026-09-28 that the app must work with every edition of D&D and with Pathfinder, and
later with other game systems.

Much of the SPEC already keeps the engine free of any one game. D3 makes abilities and skills
data; formulas, effects, grants, choices, the breakdown and manual overrides do not name a game.
Other parts are written for fifth edition only:

- `Ruleset = '2014' | '2024'` (§5.2);
- a closed list of entity types (§5.2);
- a character document with fifth-edition fields: classes with hit points, spell slots, hit dice,
  death saves, five coins (§5.8);
- the compute steps (§6.1) and the `RulesetModule` (§6.3);
- the sheet screens (§7.2).

No schema or engine code exists yet (`packages/schema` and `packages/engine` export nothing), so
this is the cheapest moment to split them.

## Decision

1. **Two layers: the core and the system modules.**
   - **The core** knows no game. It owns entities and packs, stats, skills and resources as data,
     formulas, effects and their phases, grants and choices, the breakdown, manual overrides,
     dice, trackers, undo, migrations, search, the editor, import and export.
   - **A system module** holds one game: its entity types and their schemas, its derived values
     and compute steps (pure TypeScript), its actions (rests, level-up), its sheet layout, and its
     editions. The fifth-edition module holds the 2014 and 2024 rulesets.
2. **Each module is its own package.** The core cannot import a module; CI checks this the same
   way ENG-01 checks the engine's purity. Dependencies point one way: core ← module ← `apps/web`.
3. **Packs and characters name their system** (`system`, for example `dnd5e`), and their edition
   where the system has editions (`ruleset`). A character uses packs of its own system only.
4. **The core is proven game-free by a made-up test system.** The core's tests use a small
   invented game, with its own stats and resources and no content from any real game, so the
   proof raises no licensing question.
5. **Fifth edition is the first module**, as planned: its SRD content and the golden tests A–E
   are ready. Every later system gets its own hand-computed golden characters, approved by Alina,
   before its module is built.
6. **The other systems are later phases.** Other D&D editions, Pathfinder, then others. For each
   one:
   - open content ships only after its license check (ADR 003, Part B item 1);
   - a system without open content ships as a module with no built-in content, and people type
     in their own (personal packs, ADR 003);
   - how the system is named on screen is checked first (ADR 003, Part B item 6).
7. **Exporters are per system.** The Foundry exporter maps fifth edition to Foundry's `dnd5e`
   system; a Pathfinder exporter would map to Foundry's `pf2e`. Each lives in its own package.

## What this changes in the SPEC

| SPEC | Was | Now |
|---|---|---|
| §1 | A fifth-edition sheet, 2014 + 2024 | Any D&D edition, Pathfinder, later others; fifth edition first |
| D3 | The six abilities and 18 skills are data | Every system's stats, skills and entity types are data or module code; the core names no game |
| §5.2 | `Ruleset = '2014' \| '2024'`; a closed entity type list | `system` plus `ruleset`; core entity types plus the types a module adds |
| §5.8 | One fifth-edition character document | A core part (id, versions, system, packs, choices, overrides, local entities, notes, trackers) plus a part the module owns |
| §6.1, §6.3 | One compute pipeline; `RulesetModule` for 2014/2024 | Core phases; the steps come from the module; 2014/2024 live inside the fifth-edition module |
| §7.2 | One sheet layout | The layout comes from the module |
| §12 stage 1 | Engine for fifth edition | Core plus the fifth-edition module; phase 1 is re-cut |

## What does not change

- D1, D2, D4–D11.
- The golden tests A–E (SPEC §6.7) and their values.
- The formula language (SPEC §5.6), the breakdown and manual overrides.
- Offline first, the licensing rules (widened by ADR 003), the i18n rules.
- Phase 0: SETUP-08 and SETUP-09.

## Consequences

- **Phase 1 is re-cut before ENG-01 starts.** The new rows are shown to Alina before they replace
  the old ones in `docs/tickets/BACKLOG.md`.
- The "more systems" phase (area `SYS`) is placed when phase 2 closes. That is Alina's decision.
  The recommendation is right after phase 2, before the library (phase 3), so that the library,
  the wizard and the editor are built for every system from the start.
- The hard invariants in `CLAUDE.md` about data and rulesets now speak of systems.
