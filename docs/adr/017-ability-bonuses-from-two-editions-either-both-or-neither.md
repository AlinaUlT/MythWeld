# ADR 017 — Ability bonuses from two editions: either, both or neither

**Status:** accepted · **Date:** 2026-10-05 · **Decided by:** The owner, in the chat of ENG-37

## Context

A character may mix the two editions (ADR 005 item 3). The 2014 race raises ability scores, and
so does the 2024 background. ADR 013 item 10 and ADR 014 item 1 let the person tick the race's
bonuses, the background's, or both, with a warning. The default is the rules base's source.

ENG-37 (golden F, a 2014 hill dwarf with a 2024 Soldier) asked which of the three golden F uses.
The owner answered, on 2026-10-05:

> Give players 2 options, warning and a popup or sign where they choose version they want to
> use. They can choose both or neither and still continue.

## Decision

1. **A warning and two options.** When the race or species and the background come from
   different editions and both raise ability scores, the person sees a warning. A popup, or a
   sign on the screen that opens it, shows two options: the race's bonuses and the
   background's.
2. **Any of the four.** The person ticks one, both or neither.
3. **Never a block.** With any of the four, the person continues.
4. **The warning stays** whatever is ticked, as long as the mix is there.
5. **Kept from ADR 014 item 1:** a new character starts with the rules base's source ticked; in a
   campaign, the DM decides (ADR 013 item 10).

## What this changes

| Where | Was | Now |
|---|---|---|
| ADR 013 item 10, ADR 014 item 1 | Either one or both | Either one, both or neither (items 2, 3) |
| ADR 014 item 1 | A warning when both apply | A warning for every such mix (item 4) |
| `docs/design/BRIEF.md` P3, step 6 | A window; either or both, with a warning | A popup or a sign; either, both or neither, with a warning |
| The engine (ENG-35's `abilities.bonusSource`) | `species`, `background`, `both` | Neither as well: ENG-68 |
| Golden F (ENG-37) | One stored choice | Each of the four, once ENG-68 is done |

## What does not change

- The rules base's source is ticked first.
- In a campaign, the DM decides.
- The rules base still decides every other rule the two editions do differently (ADR 005 item 3.2).
- Every golden value of A to E.
