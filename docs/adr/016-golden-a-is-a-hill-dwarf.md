# ADR 016 — Golden A's character is a hill dwarf

**Status:** accepted · **Date:** 2026-10-02 · **Decided by:** The owner, in the chat of ENG-09

## Context

SPEC §6.7 golden A is a 2014 "mountain dwarf" Life domain cleric. Its numbers are another
subrace's:
- SRD 5.1 has one dwarf subrace, the hill dwarf. Measured in 5e-database at `e6edf9a`,
  `src/2014/en/5e-SRD-Subraces.json`: `hill-dwarf`, `high-elf`, `lightfoot-halfling`,
  `rock-gnome`.
- Golden A's numbers are the dwarf's and the hill dwarf's: the dwarf's +2 Constitution and speed
  25; the hill dwarf's +1 Wisdom and Dwarven Toughness (+1 hit point per level), which gives hit
  points 12 = 8 + 3 + 1.
- The mountain dwarf is not in SRD 5.1, so it is not openly licensed and cannot enter the
  repository, test fixtures included (`CLAUDE.md`, "Content and licensing").
- SRD 5.2.1 has one dwarf with no subspecies (`src/2024/en/5e-SRD-Species.json`: `subspecies`
  is empty).

The details of the check are in ENG-09 §8, in `docs/archive/tickets/ENG_TICKET.md` once it
closes.

## Decision

1. **Golden A's character is SRD 5.1's hill dwarf.** Where SPEC §6.7 says mountain dwarf, it
   means the hill dwarf (`hill-dwarf`), in both places it is named.
2. **No expected value of golden A changes.** Every number in its table stays as SPEC §6.7
   writes it.

## What this changes

| Where | Was | Now |
|---|---|---|
| SPEC §6.7, golden A | Mountain dwarf | Hill dwarf, SRD 5.1's `hill-dwarf` |

## What does not change

- Every expected value of golden A, and every other golden test.
- SPEC.md's text: it is read, not edited; this ADR is the change.
- The rule that only openly licensed content enters the repository.
