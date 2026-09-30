# ADR 007 — The chat stops only for Alina's decisions

**Status:** accepted · **Date:** 2026-09-30 · **Decided by:** Alina

## Context

In the chat of OPS-05, the work stopped or ended with a question four times. Only one of them
was hers to answer (the phase 1 rows, ADR 004). The others were:
- a push to `main`, which `CLAUDE.md` already orders;
- whether to approve test data of the made-up test system;
- a closing "say X or Y" about where the commit goes.

Alina said on 2026-09-30: do things yourself, and do not ask what does not need her approval.
The questions made her think the work was stuck and failing.

## Decision

1. **The chat stops only for a decision that is Alina's.** That is the list in ADR 002, "Still
   Alina's":
   - the decisions D1–D11 (SPEC §2);
   - a rules source that disagrees with the SPEC; a golden value that looks wrong;
   - licensing and content sources;
   - what the app does for a person: features, scope, the order of phases;
   - her accounts or money;
   - losing or rewriting data a person has already saved.
2. **No stop by size.** An S or M ticket no longer stops to show §3 and §4. They are still
   written in the ticket file before the work; the final report says what was built and what
   was decided.
3. **Engine numbers.** A ticket that makes the engine match an approved golden value runs
   straight through. It stops only under item 1.
4. **Cutting a phase into rows is ordering work**, a technical choice (ADR 002). It stops only
   when a row would add or drop a feature compared with SPEC §12 and the ADRs.
5. **Never asked:** git, the commit, the push to `main`, file and package layout, names inside
   code, test data, which ticket comes next. When the work environment also names a work branch,
   the commit is pushed there too.
6. **A report ends with what was done and what comes next**, not with a question. A question
   comes only under item 1: one sentence, with what happens after each answer.
7. **In doubt, it is not a stop.** The option easiest to undo is taken (ADR 002 item 2), written
   into the ticket, and reported in one line.

## Why nothing is put at risk

- Every item in ADR 002's list still stops.
- The golden tests are hand-computed and approved; code cannot pass by changing them.
- Nothing is committed unless the quality gate is green.
- Every change is one commit, and one commit undoes it.
- Alina reads each result in the chat report.

## What this changes

| Where | Was | Now |
|---|---|---|
| ADR 006, item 3 | S and M code tickets, engine-number tickets and new-decision documents stop | Replaced by items 1–4 |
| ADR 002, "What does not change" | The checkpoint for S and M tickets stays | No checkpoint by size (item 2) |
| `CLAUDE.md`, the steps, "The checkpoint", "Working with Alina" | A checkpoint for S and M; a choice at the end of each report | Items 1, 2, 5, 6 |
| `docs/tickets/README.md`, lifecycle step 4 | Checkpoint for S and M | No stop for the shape |
| `PROMPTS.md`, prompts 2 and 6 | "Stop and show me" | Build straight through; stop only under item 1 |

## What does not change

- ADR 002's list of what Alina decides.
- The golden tests, and every hard invariant in `CLAUDE.md`.
- The quality gate, and one ticket = one commit on `main`.
- ADR 006 items 1 and 2.
