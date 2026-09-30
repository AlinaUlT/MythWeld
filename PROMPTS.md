# Prompts for a new chat

Copy-paste texts for starting a Claude Code chat on Grimoire. Replace the parts in `<…>`.
Every prompt starts from `CLAUDE.md`, because a new chat remembers nothing.

---

## 1 · The very first chat — an empty repository

Use this once, when the repository holds only `docs/SPEC.md`, `CLAUDE.md`, `PROMPTS.md`,
`docs/adr/000-working-rules.md`, `docs/tickets/` and `docs/CHANGELOG.md`.

```
Grimoire project. Read CLAUDE.md first, then docs/adr/000-working-rules.md.
docs/SPEC.md is the full specification, in Russian. Where it disagrees with CLAUDE.md or
ADR 000, those two win.

Read SPEC sections 1–6 and 12 once. If anything in sections 2–6 contradicts itself or
CLAUDE.md, list it as short questions and stop. Do not guess.

If nothing contradicts: the ticket is SETUP-01. It is a row in docs/tickets/BACKLOG.md,
phase 0. Create docs/tickets/SETUP_TICKET.md with the theme header from
docs/tickets/TEMPLATE.md, and expand SETUP-01 there in the full form. Then stop and show
me §3 and §4 as a few short answers.

After my yes: do §4 → the quality gate from CLAUDE.md green → fill §11 → ✅ and the date in
BACKLOG.md → one commit, first line starting with SETUP-01, no attribution lines → push.

Short answers, plain language, no analogies. Everything new is in English.
```

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
disagree, fix §4 and say so.

Then stop and show me §3 and §4: a few short answers, not an essay. I am approving the shape
of the work, not reading a design document. The long version stays in the file.

After my yes: do §4 → the quality gate green → fill §11 → ✅ and the date in BACKLOG.md →
one commit starting with <ID> → push. Show me the test count and the time from the gate.
If the ticket changes a screen, show me the screenshots.

Anything marked [ПРОВЕРИТЬ] is checked against the source before it is built, in §8.
If a golden value looks wrong, stop and explain. Do not change it.
Short answers, plain language, no analogies. Everything new is in English.
```

**For an XS ticket** the checkpoint can be dropped, if every decision is already in the prompt and
the ticket changes no number the engine computes. Replace the "Then stop and show me" paragraph
with: "No checkpoint. Show me `git status --short` and the gate result before the commit."
A document-only ticket (Markdown only) drops the checkpoint at any size (ADR 006).

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
did (measured numbers, differences from §3, found-not-fixed), ✅ and the date in BACKLOG.md,
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
0 and 1. Name the phase's last row: its §11 will carry the proof of the stage gate.
Show me the rows before writing them into BACKLOG.md.
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

## Which prompt reads what

| Prompt | Number | Reads |
|---|---|---|
| First chat | 1 | `CLAUDE.md`, ADR 000, SPEC §1–6 and §12, `BACKLOG.md` |
| Expand and build | 2 | `CLAUDE.md`, one row, one theme header, the SPEC sections it names |
| Continue | 3 | `CLAUDE.md`, one ticket |
| Close and commit | 4 | `CLAUDE.md`, one ticket |
| Next ticket | 5 | `CLAUDE.md`, `BACKLOG.md` |
| Open a phase | 6 | `CLAUDE.md`, `BACKLOG.md`, SPEC §12 and what it names |
| A number looks wrong | 7 | `CLAUDE.md`, SPEC §6.7, the SRD |
