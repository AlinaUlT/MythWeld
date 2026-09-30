# ADR 006 — Fewer stops: document-only tickets, and Alina's answers recorded at once

**Status:** accepted · **Date:** 2026-09-30 · **Decided by:** Alina

## Context

Two waits in one chat each cost Alina an extra message:
- ADR 005 waited for a "go", although Alina had already answered every question;
- the design brief (OPS-03, size S) stopped at its checkpoint, although it changed no code.

Alina asked why she has to say so much. She approved the two rules below on 2026-09-30, on the
condition that nothing puts the app's goal at risk.

## Decision

1. **A document-only ticket has no checkpoint.** A ticket is document-only when it changes only
   Markdown files (`docs/`, `CLAUDE.md`, `PROMPTS.md`): no code, no configuration, no content
   data. It runs straight through, and the chat reports the result.
2. **Alina's answers are recorded at once.** When she answers a list of questions, her answers
   are written into the repository in the same chat, without a second "may I?".
3. **These still stop for Alina's yes:**
   - a code ticket of size S or M (its checkpoint, `CLAUDE.md`);
   - any ticket that changes a number the engine computes;
   - a document that makes a new decision for her instead of recording one she made. Example:
     the phase 1 re-cut changes only `BACKLOG.md`, but ADR 004 says she sees it first;
   - everything ADR 002 leaves to her.

## Why nothing is put at risk

- A document-only ticket changes no code and no computed number.
- Every change is one commit, and one commit undoes it.
- Alina reads each result in the chat report.

## What this changes

| Where | Was | Now |
|---|---|---|
| ADR 002, "What does not change" | The checkpoint for S and M tickets stays | It stays, except for document-only tickets (item 1) |
| `CLAUDE.md`, "The checkpoint" | Every S and M ticket stops | Items 1–3 |
| `docs/tickets/README.md`, lifecycle step 4 | Checkpoint for S and M | Points to the exception |
| `PROMPTS.md`, prompt 2 | Only an XS ticket may drop the checkpoint | A document-only ticket of any size drops it too |

## What does not change

- The golden tests and every hard invariant in `CLAUDE.md`.
- The quality gate, and one ticket = one commit.
- The checkpoint for code tickets of size S and M.
- ADR 002's list of what Alina decides.
