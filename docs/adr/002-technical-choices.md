# ADR 002 — Technical choices are made in the ticket, not asked

**Status:** accepted · **Date:** 2026-09-28 · **Decided by:** Alina

The number 001 is kept for `001-platform.md`, which SETUP-09 writes (SPEC §12, stage 0).

## Context

SETUP-06 made two technical choices that differ from the letter of SPEC §11: the database starts
with no tables, and persistent storage is asked for on every start, not only the first. Both were
put to Alina as a question. She accepted both, and said that choices of this kind, the ones that
are optimal and logical for development, are to be made without asking.

## Decision

1. **A technical choice is decided inside the ticket.** Technical means how a thing is built,
   stored, tested or ordered. Examples: storage tables and their keys, when a browser API is
   called, a library inside the SPEC §4.2 stack, how code is split into files.
2. **Between two otherwise equal options, the one that is easier to change later wins.**
3. **It may depart from the letter of a SPEC detail** when the intent of that detail is kept. The
   ticket names the SPEC section, what differs, and why.
4. **The chat reports it as done**, in one line, with what it would take to reverse.

## Still Alina's

- The decisions D1–D11 (SPEC §2).
- Rules: when the SPEC and a rules source disagree; golden test values (SPEC §6.7).
- Licensing and content sources (SPEC §3).
- What the app does for a person: features, scope, the order of phases.
- Anything that needs her accounts or money.
- Anything that would lose or rewrite data a person has already saved.

## What does not change

- Technical choices are reported as decided, with the reason, not as questions. (The checkpoint
  for S and M tickets is gone: ADR 007.)
- The hard invariants in `CLAUDE.md`.
- ADR 000.
