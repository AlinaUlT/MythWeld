# ADR 011 — Every entry on the sheet opens its full description

**Status:** accepted · **Date:** 2026-09-30 · **Decided by:** Alina

## Context

After ADR 010, Alina added one more requirement on 2026-09-30. It is recorded here under the rule
in `CLAUDE.md`, "Nothing she says is lost".

## Decision

1. **Descriptions can always be shown and hidden.** Every ability, skill, feature, feat, spell
   and item on the sheet has its description. The person opens it and closes it in place.
2. **"See full description".** Tapping an entry, for example a spell, shows its short summary
   and a "See full description" control. It opens the exact text from the book or pack the
   entry was taken from, with that source named: the book, its version, its license.
3. **Only text the app may show.** The exact text comes from openly licensed books (SRD 5.1 and
   SRD 5.2.1 today) or from the person's own packs. For an entry with no text in its source, the
   control says so instead of showing anything else (`CLAUDE.md`, "Content and licensing").

Phases: phase 2 shows descriptions from the fixtures and the person's free-text entries; phase 3
fills them from the SRD import; phase 5 from the person's packs.

## What this changes

| Where | Was | Now |
|---|---|---|
| BRIEF P4 | — | Descriptions open and close in place; "See full description" |
| `BACKLOG.md` | — | Notes the item by phase |

## What does not change

- ADRs 008, 009 and 010.
- No rules text without an open license, in the app or in the repository.
- The golden tests, and every hard invariant in `CLAUDE.md`.
