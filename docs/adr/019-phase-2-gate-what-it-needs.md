# ADR 019 — The phase 2 gate: what it needs, and what waits

**Status:** accepted · **Date:** 2026-11-08 · **Decided by:** The owner, in the chat of SHEET-60:
she asked that chat to decide what is optional and what is reasonable, for now and for later rows.

## Context

SHEET-60 built the gate's test (`apps/web/e2e/gate.spec.ts`). Golden A and golden B are made in
the interface and the test is green. The sheet does not show two lines of golden A's SPEC §6.7
table (SHEET-60 §11):
- the current hit points read 11 of 12; SPEC §6.7 says 12;
- "4 prepared" and "3 cantrips" are computed and shown nowhere.

The first is a wrong number on screen. The second is a missing number, and a missing way to pick
the spells themselves. SPEC §12 stage 2 says the characters "show the values from 6.7".

## Decision

1. **Needed for the gate (do first):**
   - **SHEET-85.** A character at full hit points stays at full when a pick raises the maximum.
     A character below full keeps its current hit points. How it is built is the ticket's
     choice (ADR 002).
   - **SHEET-86, narrowed.** The Spells tab shows how many spells a class prepares and how many
     cantrips it knows, each as a number with its breakdown (`classes.<id>.spell.prepared`,
     `classes.<id>.spell.cantrips`). It shows a number only when the class has that count.
   - **SHEET-87.** The SHEET-11 route test waits for the back arrow. The gate runs `pnpm e2e`,
     and a flaky test in it can fail the gate for no reason.
   Then SHEET-60 runs again, fills the rest of its §11, and closes phase 2.
2. **Optional, and not in phase 2:**
   - **Picking the spells of a class list** (cantrips known, spells prepared) waits for phase 3
     (the library, so the spell lists exist) and phase 4 (the wizard that asks for them). Until
     then a class's spells come from grants only, as in golden A.
   - **A person's own timing of the 5 minutes.** The test proves every pick can be made in the
     interface, and prints the driver's time. If the owner times a creation herself and finds a
     step too slow, that is a new row, not a reopened gate.
3. **What does not change:** every expected value in SPEC §6.7; the engine's computed numbers;
   the rule that a number on screen has a breakdown; golden tests are never edited to pass.
