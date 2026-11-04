# Prompts for a new chat

Copy-paste texts for starting a Claude Code chat on Grimoire. Replace the parts in `<…>`.
Every prompt starts from `CLAUDE.md`, because a new chat remembers nothing.

---

Prompt 1 (the very first chat, on an empty repository) was used once and is removed. The
numbers of the others stay, because ADR 006 and ADR 007 cite them.

---

## 2 · Expand and build a ticket — one chat

This is the normal shape.

```
Grimoire project. Read CLAUDE.md before doing anything.

The ticket is <ID>, size <XS/S/M>. It is a row in docs/tickets/BACKLOG.md. Read that row,
and the theme header in docs/tickets/<AREA>_TICKET.md. Leave the neighbouring tickets alone.
Read only the SPEC sections the row points at.

git pull --rebase first. Then expand <ID> from docs/tickets/TEMPLATE.md into the theme file,
in number order. Check the plan against the code as it is now, not against the row. If they
disagree, fix §4 and say so in §11.

Then build it without stopping: do §4 → the quality gate green → fill §11 → move the ticket to
docs/archive/tickets/ → ✅ and the date in BACKLOG.md → one commit starting with <ID> → push.
Show me the test count and the time from the gate. If the ticket changes a screen, build it
from its boards in docs/design/mockups/ and its row in docs/design/BRIEF.md Part 5, and show
me the screenshots next to those boards.

Stop only for a decision that is mine (ADR 007): a golden value that looks wrong, the SPEC and
the SRD disagreeing, licensing, a feature or scope change, money. Anything marked [ПРОВЕРИТЬ] is
checked against the source before it is built, in §8.
Short answers, plain language, no analogies. Everything new is in English.
```

Every size runs the same way (ADR 007).

---

## 3 · Continue — the blocker is gone

```
Grimoire project. Read CLAUDE.md and docs/tickets/<AREA>_TICKET.md, ticket <ID> — the file,
not a memory of it. The blocker (<what it was>) is gone: <what changed>.
git pull --rebase, then continue from §4. Do not re-plan what is already done.
```

---

## 4 · Close and commit only

When the work is done and only the closing steps are left.

```
Grimoire project. Read CLAUDE.md and ticket <ID> in docs/tickets/<AREA>_TICKET.md.
Run the quality gate and show me the result. If it is green: fill §11 from what the ticket
did (measured numbers, differences from §3, found-not-fixed), move the ticket to
docs/archive/tickets/, ✅ and the date in BACKLOG.md,
one line in docs/CHANGELOG.md if a person can see the change, then one commit starting with
<ID> and push.
```

---

## 5 · What is the next ticket?

```
Grimoire project. Read CLAUDE.md, then git pull --rebase, then docs/tickets/BACKLOG.md.
Tell me the next ticket by the Order section, in three lines: its id and hat, why it is next,
and what it needs from me (an account, a decision, nothing). Do not start it.
```

---

## 6 · Open the next phase — cut it into rows

```
Grimoire project. Read CLAUDE.md and docs/tickets/BACKLOG.md. Phase <N-1> is closed.
Read SPEC §12 stage <N> and the SPEC sections it depends on. Cut phase <N> into rows of size
XS, S or M, each with a hat of one phrase without "and", in the same table form as phases
0 and 1. Name the phase's last row: its §11 will carry the proof of the stage gate. A row that
builds a screen names its boards in docs/design/mockups/.
Write them into BACKLOG.md and commit. Stop first only if a row adds or drops a feature
compared with SPEC §12 and the ADRs (ADR 007).
```

---

## 7 · A number looks wrong

```
Grimoire project. Read CLAUDE.md. On the character <which one>, <the number> shows <what you
see> and I expect <what you expect>.
Do not change any code yet. Show me the breakdown of that number, then the SRD rule it should
follow (section and what it says), then whether a golden test in SPEC §6.7 covers it. Tell me
which of the three is wrong: the code, the golden value, or my expectation.
```

---

## 8 · Several rows in one chat

For rows of one wave, or of waves in a row, that one chat builds one after another.

```
Grimoire project. Read CLAUDE.md before doing anything.

Build these tickets in this chat, one after another, in this order: <ID, ID, ID>.
<What is already done and pushed, and the last commit. Start with `git pull --rebase`, and check
that `git log --oneline` shows "<the last closed ticket's commit line>". If node_modules is
missing, run `pnpm install --frozen-lockfile`. In the cloud container e2e runs as
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e`. If the session names a development
branch, push every commit to `main` and to that branch.>

For each ticket, run the normal steps from CLAUDE.md. Read only that ticket's row in
docs/tickets/BACKLOG.md and the theme header in docs/tickets/<AREA>_TICKET.md, and only the SPEC
sections and ADRs the row points at. Expand the row from docs/tickets/TEMPLATE.md (the short form
for XS), build it, get the quality gate green (add pnpm e2e when apps/web is touched), fill §11,
move the ticket to docs/archive/tickets/, put ✅ and the date in BACKLOG.md and delete the row's
note under the table, add one line to docs/CHANGELOG.md, make one commit starting with the ticket
id, push. For a screen ticket, build from its boards in docs/design/mockups/ and its row in
docs/design/BRIEF.md Part 5.

<Pieces the closed tickets made, to reuse: the files to read, not the old tickets.>

Rules for the run:
- One ticket = one commit. Never mix two tickets in one commit.
- Never start the next ticket until the previous one is pushed and its gate is green.
- If the gate fails, fix it. Do not skip a test. Do not change a golden value.
- Expected values come from SPEC §6.7, the SRD or the packs' source, never from a run's output.
- Stop the whole run only for a decision that is mine (ADR 007). Otherwise go straight on.
- Anything found outside a ticket's hat is not fixed: write it in §11 and as a new BACKLOG row.
- Between tickets, write at most 2 lines in the chat: the id, the gate line (for example
  "1501 passed, 0 failed, 29.7 s"), the commit hash. Do not retell the ticket.
- After the last ticket, write one short report: ids with commit hashes, anything found and not
  fixed, and the screenshots for the screen tickets (send each one as a file).
- If the chat gets heavy before the end, stop after a pushed commit and tell me the next id.

<Notes for this batch: what a row decides, what it must not touch.>
Short answers, plain language, no analogies. Everything new is in English.
```

---

## Which prompt reads what

| Prompt | Number | Reads |
|---|---|---|
| Expand and build | 2 | `CLAUDE.md`, one row, one theme header, the SPEC sections it names |
| Continue | 3 | `CLAUDE.md`, one ticket |
| Close and commit | 4 | `CLAUDE.md`, one ticket |
| Next ticket | 5 | `CLAUDE.md`, `BACKLOG.md` |
| Open a phase | 6 | `CLAUDE.md`, `BACKLOG.md`, SPEC §12 and what it names |
| A number looks wrong | 7 | `CLAUDE.md`, SPEC §6.7, the SRD |
| Several rows in one chat | 8 | `CLAUDE.md`, then for each row: its row, the theme header, what the row names |
