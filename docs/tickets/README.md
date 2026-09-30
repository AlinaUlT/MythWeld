# How a ticket runs

The rules for tickets: what an id means, the sizes, the statuses, and the life of a ticket from a
row in the backlog to a closed theme. The steps of one ticket are in `CLAUDE.md`. The form of a
ticket is in [`TEMPLATE.md`](TEMPLATE.md). Order and status are in [`BACKLOG.md`](BACKLOG.md).

---

## The id

`<AREA>-<NN>`, for example `ENG-07`. A number is never reused, even when its ticket is cancelled.

| Area | What it covers | SPEC stage |
|---|---|---|
| `SETUP` | The scaffold: monorepo, build, tests, CI, PWA, deploy | 0 |
| `ENG` | The game-free core and the fifth-edition module: schemas, formulas, effects, `compute()`, actions, dice (ADR 004) | 1 |
| `SHEET` | Character list, manual creation, the character sheet and its trackers | 2 |
| `CONT` | SRD import, mechanics, the library, search, attribution | 3 |
| `WIZ` | The creation wizard, level-up, house rules | 4 |
| `HB` | The homebrew editor, the effect builder, pack import and export | 5 |
| `PDF` | Own PDF template, filling an uploaded sheet | 6 |
| `POL` | Accessibility, performance, onboarding, Android | 7 |
| `RU` | The Russian interface, the glossary check, Russian overlays for SRD texts | later (ADR 000) |
| `SYS` | Game systems beyond fifth edition: their modules and content (ADR 004) | later (ADR 004) |
| `OPS` | Around the code: CI, deploy, tooling, docs. This theme never closes | — |

Phases L1–L6 get their own area codes when they are opened.

---

## Sizes

| Size | Time | Note |
|---|---|---|
| XS | up to 1 hour | One function, one edit. Short form of the template. |
| S | 1–3 hours | Full form. |
| M | half a day | Full form. The largest size there is. |

A ticket that turns out bigger than M is **split before coding**. The split goes into
`BACKLOG.md`: the old row is narrowed, and the new rows get new numbers.

---

## Statuses

`🔲` not started · `🚧` in work · `✅ 2026-MM-DD` done · `❌ 2026-MM-DD — reason` cancelled

Only `BACKLOG.md` carries a status. A ticket file never says "done". Its §11 says what came out.

---

## Lifecycle

1. **A row in `BACKLOG.md`.** It has an id, a hat, a size and one line saying what it does. Rows
   are written when a phase opens, not earlier.
2. **Expanded when it is taken into work, not before.** The ticket is written from
   [`TEMPLATE.md`](TEMPLATE.md) into `docs/tickets/<AREA>_TICKET.md`, in number order. The first
   ticket of a theme creates that file with the theme header from the template.
3. **Checked against the code as it is now**, not against the row. If the row and the code
   disagree, §4 follows the code, and the checkpoint says so.
4. **Checkpoint** (S and M): §3 and §4 are shown as a few short answers. Work starts after
   Alina's yes. A document-only ticket skips it (ADR 006).
5. **Built.** §4 is done, and the quality gate in `CLAUDE.md` is green.
6. **§11 filled.** It is never left empty.
7. **✅ and the date in `BACKLOG.md`**, then the commit and the push.
8. **The theme closes** when every row of it is ✅ or ❌. Its `<AREA>_TICKET.md` moves whole to
   `docs/archive/tickets/`. `OPS` never closes.

**A phase closes** when every row in it is closed **and** that stage's "Готово, когда" list in
SPEC §12 has been shown true in the chat. The proof goes into the §11 of the phase's last
ticket.

---

## Four traces a ticket leaves

With these four, one search for the id finds the ticket, its code and its commits:

1. The ticket heading in `<AREA>_TICKET.md`.
2. A comment at the main place in the code: `// ENG-07: missing paths read as 0 with a warning.`
   One comment per ticket, at the spot a reader would look first. Not on every line.
3. The test: the `describe` block names the id, for example `describe('ENG-07 formula paths', …)`.
4. The first line of the commit message starts with the id.

---

## Found, not fixed

Anything a ticket finds outside its hat — a bug, a missing rule, a wrong row — is **written
down, not fixed**:
- in §11, under "Found, not fixed";
- and, if it needs work, as a new row in `BACKLOG.md`, with "found by `<id>`".

Fixing it quietly inside the current ticket gives the ticket a second hat, and nobody can find the
fix later.

---

## Screens

A ticket that changes what a person sees runs `pnpm e2e` and shows screenshots at 360×800 in the
chat. For now that is English only. Screenshots are not committed. The changelog gets one line.
