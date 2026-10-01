# Grimoire — the short guide

**Grimoire** (working name) is an offline-first PWA for tabletop role-playing games. Its first game
system is fifth edition, with the 2014 rules (SRD 5.1) and the 2024 rules (SRD 5.2.1); other D&D
editions, Pathfinder and later systems come as system modules
([ADR 004](docs/adr/004-game-systems.md)). It has three parts: a character sheet that computes
every derived number and can show where each one came from, a reference library, and homebrew
content that uses the same rules engine. The full specification is [`docs/SPEC.md`](docs/SPEC.md).

This file is the **short guide**. Read it, then read the **one** ticket you were given. Open
nothing else unless the ticket or the doc map below sends you there.

**Where this file and `docs/SPEC.md` disagree, this file and `docs/adr/` win.** SPEC Appendix A
(its draft `CLAUDE.md`) is replaced by this file. The reasons are in
[`docs/adr/000-working-rules.md`](docs/adr/000-working-rules.md).

---

## How work happens

One ticket = one chat = one commit, straight to `main`. The hat is one phrase without "and".
Size is XS / S / M. Anything bigger is split in `BACKLOG.md` **before** coding.

**The steps for a ticket, in order:**
`git pull --rebase` → expand the ticket (if it is still a row) → do §4 → quality gate green →
fill §11 → ✅ and the date **in `BACKLOG.md`** → commit whose first line starts with the ticket id
→ `git push`.

**The quality gate:** `pnpm lint && pnpm typecheck && pnpm test`. A ticket that touches
`apps/web` also runs `pnpm e2e`. Commit only when the whole gate is green. Do not close a ticket
if only "my own tests" pass.

**No branches and no pull requests.** Work happens on `main`, and the commit message tells the
story. Three rules replace what a branch would give:
- commit only when the quality gate is green;
- run `git pull --rebase` before starting, and again if a push is rejected;
- the ticket id is the first thing in the commit message, so `git log --grep=ENG-07` finds the
  ticket's commits.

**Claude Code runs every command itself:** pnpm, Playwright, git. The owner does not type commands.
She makes the decisions that are hers and reads the results in the chat. So report measured results,
not "it passed". For example: `412 passed, 0 failed, 38.2 s`. When there are screenshots, show
them in the chat. Screenshots are not committed.

**Stops.** The chat stops only for a decision that is the owner's: the list in ADR 002, "Still
the owner's" (golden values, a rules source that disagrees with the SPEC, licensing, features and
scope, money and accounts, a person's saved data). Everything else runs straight through, at any
size: §3 and §4 are written in the ticket file, not shown for a yes. Her answers to a list of
questions are written into the repository at once. Never asked: git, the push to `main`, layout,
names inside code, test data, the next ticket. In doubt, it is not a stop
([ADR 007](docs/adr/007-stop-only-for-the-owners-decisions.md)).

**Which file answers what.** Each fact has one owner, and no other file repeats it:

| Question | File |
|---|---|
| What is next, what is done, the phases | [`docs/tickets/BACKLOG.md`](docs/tickets/BACKLOG.md) |
| How a ticket runs, area codes, lifecycle | [`docs/tickets/README.md`](docs/tickets/README.md) |
| What a ticket must contain | [`docs/tickets/TEMPLATE.md`](docs/tickets/TEMPLATE.md) |
| What the app is, the decisions D1–D11, data model, engine, screens, stages | [`docs/SPEC.md`](docs/SPEC.md) — in Russian, the owner's document |
| A decision that changes the spec | `docs/adr/NNN-title.md` |
| What a person can already see | [`docs/CHANGELOG.md`](docs/CHANGELOG.md) |
| How the screens should look, and the designs the owner chose | [`docs/design/BRIEF.md`](docs/design/BRIEF.md); the mockups to build from: [`docs/design/mockups/`](docs/design/mockups/README.md) |
| Installing, running, testing, deploying | `docs/RUNNING.md` — written by `SETUP-09`; does not exist before it |
| The hand-computed golden characters | SPEC §6.7 → `packages/engine/test/golden/` |
| Russian terms | `packages/content/glossary.ru.json` (seeded from SPEC Appendix B) |
| Copy-paste prompts for new chats (the owner) | [`PROMPTS.md`](PROMPTS.md) |
| Open tickets of one theme, expanded | `docs/tickets/<AREA>_TICKET.md` |
| A closed theme's tickets and what each one learned | `docs/archive/tickets/<AREA>_TICKET.md` |
| Ticket → files → commits | Search the ticket id in the code, and `git log --grep=<id>` |

**`docs/archive/` is not for working from.** Open a file there only if the owner names it, or if a
ticket builds on a closed ticket's §11.

---

## Hard invariants

These rules cut across the whole project. Breaking one gives a wrong number with no error, or a
legal problem. The reasoning lives in the SPEC section named in brackets. Do not re-derive these
rules in a new function.

**Truth and checking**

- **The golden tests are the truth** (§6.7). Their expected values were computed by hand. Never
  change an expected value to make a test pass. If a value looks wrong, stop and explain it in the
  chat.
- **`[ПРОВЕРИТЬ]` means "check before building".** Anything marked `[ПРОВЕРИТЬ]` in the SPEC is
  checked against the SRD text or the dnd5e code before it is implemented. The ticket's §8 names
  the source and what it said.
- **Measure, never estimate.** Every number in a ticket, a test or an answer comes from a source
  file, a test run or a command. Not from memory, and not from arithmetic done in your head.

**The engine**

- **`packages/engine` is pure TypeScript** (D2, §4.1). It imports no React, no DOM, no Dexie and
  nothing from the network. CI checks this rule (`ENG-01`). Every rule lives in `engine` or
  `content`, never in a component.
- **Everything is data** (D3). Never hardcode the six abilities or the 18 skills in code. A custom
  ability such as `san` must behave exactly like `str`. The core names no game: a system's stats,
  skills, entity types and rules live in its module and its packs (ADR 004).
- **`compute()` is pure and deterministic** (§6.1). The UI reads only `Computed` and its
  breakdown. A number shown on screen with no breakdown entry is a bug.
- **Manual overrides always win** (§6.1 step 7). They apply in the `final` phase, and the
  breakdown labels them as a manual edit.
- **Each system's rules live in its own module** (ADR 004). Inside the fifth-edition module,
  2014/2024 differences live in `rulesets/2014.ts` and `rulesets/2024.ts` (§6.3). Never scatter
  `if (ruleset === '2024')` or `if (system === …)` checks through other code. The multiclass
  half-caster rounding (2014 down, 2024 up) sits in one place.
- **Formulas never run code** (§5.6). No `eval`, no `new Function`. Formulas have a length limit
  and a depth limit. A missing path gives `0` plus a warning, not an exception. Formulas in the
  `base` phase read only levels, class levels and choices.
- **Missing is not broken** (§8.2). A missing reference shows `Missing: <id>` and a warning, and
  never crashes the app. An unmade choice goes into `pendingChoices`; it is not an error.
  Prerequisites warn; they never block.
- **Ids are stable** (§5.1). Renaming an entity never changes its `EntityId`.
- **Stored units are feet and pounds** (§7.5). Conversion happens only on screen.
- **A stored-shape change needs a migration** (§5.8): bump `schemaVersion` and add a pure
  `vN → vN+1` function with its own test.

**Content and licensing** (§3, [ADR 003](docs/adr/003-library-packs.md))

- Only openly licensed content goes into the repository and into builds, test fixtures included.
  Today that is SRD 5.1 and SRD 5.2.1 (CC-BY-4.0). Another system's open content joins only after
  its license is read from the publisher's own legal text and the owner approves.
- Never scrape or copy text from ttg.club, dnd5e.wikidot.com, dnd2024.wikidot.com or any book
  without an open license. ttg.club is a reference for Russian terms only.
- Every pack carries license metadata. A pack with `redistributable: false` never enters the
  public build.
- A pack a person makes is personal (`redistributable: false`): it stays on the device, and the
  app never uploads it by itself. Whether a pack is built-in, local or community is set by the
  app when it is installed, never read from the pack file.
- No "D&D", "Dungeons & Dragons" or WotC logos in names, icons or the UI. "5E compatible" is the
  only allowed phrase for fifth edition. How any other system is named on screen is checked
  against its publisher's trademark policy first.
- No official PDF character sheets in the repository, only field-mapping profiles (JSON). Field
  names are read from the real file, never written from memory (§10.2).

**The interface**

- **No user-facing string literal in a component** (§9). Every visible string goes through an
  i18next key. English is the only locale filled for now; Russian is added later by its own
  phase (ADR 000).
- Entity names stay bilingual (`name.en`, and `name.ru` when it is known), because search must
  find both.
- The dice parser accepts both `d` and `к`.
- No telemetry and no external requests, except links the person opens themselves and features
  the person turns on: the table link and their own AI key (§11,
  [ADR 005](docs/adr/005-modes-free-version-table-link.md)). Both are off until then.

---

## What does not go in this project

**No tool attribution anywhere.** Commit messages carry no `Co-Authored-By` line and no session
link. Documents, code comments, ticket text and the changelog do not name the assistant or any AI
product. The commit message says what the ticket did, not what wrote it.

**No personal names.** The person who owns this project is "the owner" in every file, commit
message, mockup and chat reply. Never write a personal name for them, and never take one from an
account name, an email address or a repository address.

**Nothing invisible.** No zero-width characters, no byte-order marks, no non-breaking spaces,
except in code that deliberately strips them from imported text.

**No rules text without an open license**, even in a test, a fixture or a code comment.

---

## Language

**Everything is written in English:** code, comments, test names, commit messages, the ticket
files, the backlog, the changelog, the ADRs and `RUNNING.md`.

Three exceptions. They are data, not wording:
- `docs/SPEC.md`, which the owner wrote in Russian. It is read, not edited; a change to it is an ADR.
  A ticket cites a SPEC section number and does not copy its text.
- Russian names inside entities (`name.ru`) and `glossary.ru.json`.
- The Russian locale files, once the Russian phase opens.

---

## Working with the owner

- **Simple words.** Explain a term the first time you use it.
- **Literal, not figurative.** No analogies. Show the exact text, value or command output.
- **One fact per line, short sentences.** A list of facts beats a paragraph.
- **Name what does NOT change**, as its own list.
- **End with what was done and what comes next**, not with a question. Only for a decision
  that is hers, state the choice in one sentence, with what happens after each answer.
- **One fact, one place.** A note points at the file that owns the fact; it does not repeat it.
- **Nothing she says is lost.** Every requirement, design choice or technical detail the owner gives
  in the chat is written, in the same chat, into the file that owns it: an ADR for a decision,
  `docs/design/BRIEF.md` for a screen. The report names the file and the commit.
- **Technical choices are made, not asked** ([ADR 002](docs/adr/002-technical-choices.md)). How
  a thing is built, stored, tested or ordered is decided in the ticket, even where it departs
  from the letter of a SPEC detail. The ticket says why; the chat reports it as done.
- **The owner decides** everything else ADR 002 lists: when the SPEC and a rules source disagree, a
  decision in §2 that looks wrong, golden values, licensing, what the app does for a person.
  Stop and ask. Do not change such a decision without asking.

---

## Layout

```
apps/web            the PWA (React) — the only place with UI
packages/schema     Zod schemas, TS types, the pack's JSON Schema
packages/engine     formulas, effects, the compute pipeline, dice, rests
packages/content    SRD import, hand-written mechanics, glossary, built packs
packages/pdf        own PDF template and form filling
packages/foundry    (phase L1) mapping to Foundry dnd5e and back
docs/               SPEC.md, adr/, tickets/, CHANGELOG.md, RUNNING.md
```

Dependencies point one way: `schema ← engine ← pdf, foundry ← apps/web`.

---

## Keeping this file small

When something ships:
- the write-up goes in the ticket's §11;
- one line goes in `docs/CHANGELOG.md` if a person can see the change.

Do not paste ticket narrative here. The doc map gets at most a one-line row. A new cross-cutting
rule that prevents damage may earn a *Hard invariants* bullet. Nothing else belongs in this file.
