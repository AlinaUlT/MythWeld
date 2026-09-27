# ADR 000 — How the work runs, and in which language

**Status:** accepted · **Date:** 2026-09-27 · **Decided by:** Alina

## Context

`docs/SPEC.md` §0 and §12 describe one way of working: one stage = one branch and one pull
request, documentation in Russian, and an interface in Russian and English from stage 0. Its
Appendix A is a draft `CLAUDE.md` built on that.

The working rules are instead taken from an earlier project of Alina's, where they were tested
over about sixty tickets. There, work is cut into small tickets, each ticket is one chat and one
commit to `main`, and everything is written in English.

## Decision

1. **Tickets, not stage pull requests.** Every SPEC stage becomes a phase in
   `docs/tickets/BACKLOG.md` and is cut into tickets of size XS, S or M. One ticket = one chat =
   one commit, straight to `main`, with no branches and no pull requests.
2. **English everywhere.** Code, comments, commits, tickets, the backlog, the changelog, the ADRs
   and `docs/RUNNING.md` are in English. `docs/SPEC.md` stays in Russian, as the owner's document.
3. **The interface is English first.** i18next is set up from the start and every visible string
   is a key, but only the `en` locale is filled. Russian comes later, in its own phase: the locale
   files, the glossary check and the Russian overlays for SRD texts.
4. **Claude Code runs the commands** — pnpm, Playwright and git — in its own cloud environment.

## What this changes in the SPEC

| SPEC | Was | Now |
|---|---|---|
| §0 item 3, §12 opening line | One stage = one branch + one PR | One ticket = one commit to `main`; a stage is a phase of tickets |
| §0 item 6 | `docs/` in Russian; interface RU + EN | Everything in English; interface EN first, RU later |
| §12 stage 0, "Done when" | Screenshot of the main screen in both languages | Screenshot in English; the Russian one moves to the Russian phase |
| §12 stage 3 | Russian overlays (machine draft) inside stage 3 | Moved to the Russian phase |
| Appendix A | Draft `CLAUDE.md` | Replaced by the repository's `CLAUDE.md` |
| Appendix A, "attach screenshots to the PR" | Screenshots in the PR | Screenshots shown in the chat; not committed |

**What does not change:** decisions D1–D11, the data model (§5), the engine (§6), the golden
tests (§6.7), the licensing rules (§3), the stage order, and each stage's "Готово, когда" list.
That list becomes the gate that closes the phase.

## Consequences

- There is no pull request to hold a checklist, so each phase's gate is proved in the chat and
  written in the §11 of the phase's last ticket.
- CI runs on every push to `main`. It cannot block a commit, so the local quality gate in
  `CLAUDE.md` is what keeps `main` green.
- The Russian phase needs its own decision on where it sits in the order. It is listed in
  `BACKLOG.md` and placed when the library (phase 3) closes.
