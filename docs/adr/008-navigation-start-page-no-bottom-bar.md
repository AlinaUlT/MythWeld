# ADR 008 — Navigation: a start page, a player page, no bottom bar

**Status:** accepted · **Date:** 2026-09-30 · **Decided by:** Alina

## Context

SPEC §7.1 plans a bottom bar with four tabs, and ADR 005 item 1.2 adds a DM tab to it. SETUP-04
built that bar as the app shell.

On 2026-09-30 Alina looked at mockups of the screens on a design canvas
([`docs/design/BRIEF.md`](../design/BRIEF.md) Part 5 links it). She rejected the bottom bar and
the home pages built around it. She showed screenshots of a tabletop app she uses and asked for
its ideas and parts, in a design of our own.

## Decision

1. **No bottom bar.** Each page has a back arrow and, where it needs one, a gear for Settings in
   the top corner.
2. **The start page** shows the game system ("5E compatible" for now) and two large choices:
   **Player** and **Game master**. The Game master side opens with the phase that builds the DM
   tools; until then it is marked as coming later.
3. **The player page** holds what a player needs before making a character:
   - **My characters**, with the count and the last opened character;
   - **the rulebook**, as chapters: species, classes, backgrounds, feats, spells, equipment,
     rules and conditions. Each chapter shows, and lets the person choose, where its content
     comes from: the 2014 rules, the 2024 rules, or the person's own packs;
   - **Dice** and **My packs**.

   Making a character does not start here.
4. **My characters** is the list of characters. A **+** in the corner makes a new one. A swipe
   on a character, or its **⋯**, opens **Actions**: copy, link for the DM, transfer, export,
   delete. The **⋯** on the sheet opens the same Actions.
5. **Making a character** goes through the usual steps. Every choice is recorded, and any step
   can be changed later.
6. **The sheet** follows P4 V3 (BRIEF Part 5). Every feature from the class, subclass, species,
   background and feats is listed on it and can be used from it, with its uses tracked. An edit
   mode unlocks the numbers.
7. **Look.** The screens take the reference app's ideas and parts, never its layout or its look.
   Its screenshots stay out of the repository, like every screenshot.

## Still open

- Whether the start page shows every time the app opens, or only the first time.
- The base colours and the heading font (BRIEF Part 5).

## What this changes

| Where | Was | Now |
|---|---|---|
| SPEC §7.1 | A bottom bar of four tabs | Items 1–4 |
| ADR 005 item 1.1 | First start asks "I play", "I run games" or both | The start page asks Player or Game master (item 2); when it shows is open |
| ADR 005 item 1.2 | DM mode adds a tab to the bottom bar | The DM tools open from the start page's Game master choice |
| BRIEF Part 1, P1, P2, P3, P4, X2 | The bottom bar | Items 1–4; a new prompt P17 for the player page |
| The SETUP-04 shell in `apps/web` | A bottom bar with four tabs | Replaced in phase 2; `BACKLOG.md` notes it for the phase 2 rows |

## What does not change

- D1–D11, and ADR 005 items 1.3 and 2–12: the DM tools stay free and offline, and the free and
  paid split stays as it is.
- The sheet's six tabs (SPEC §7.2), placed at the bottom by P4 V3.
- The golden tests, and every hard invariant in `CLAUDE.md`.
