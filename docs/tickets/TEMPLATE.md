# Ticket template

Copy the full form for an S or M ticket, and the [short form](#short-form-for-xs) for an XS one.
The ticket goes into `docs/tickets/<AREA>_TICKET.md`, in number order.

---

## Theme header (the first ticket of a theme writes it)

````markdown
# <AREA> — <what the theme is>

**Why this theme:** <one paragraph>
**SPEC:** stage <N>, sections §…
**Order and status:** [`BACKLOG.md`](BACKLOG.md) — never repeated here.
**Theme is closed when:** <every row is ✅ or ❌, and the stage's "Готово, когда" list is proved>
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections above.

---
````

---

## Full form (S and M)

````markdown
### <AREA-NN> <Name>

**Hat:** <one phrase, no "and">
**Depends on:** <ids / `Nothing`>
**Size:** <S | M>
**Screen:** <Yes — which one; its boards in `docs/design/mockups/` and its row in `docs/design/BRIEF.md` Part 5 | No>
**SPEC:** <§… that this ticket builds>

---

#### 1. Where the code lives

**Main file:** `packages/…` — <new | changes>. The other files it touches, one line each.

#### 2. What is missing now

<What happens today, measured, with the exact output or the exact missing thing.>

#### 3. What it should look like when done

1. <a checkable statement, with the exact value, text or command output>
2. …

#### 4. How to do it

<The steps, in order. Code shapes in short pieces, not whole files.>

#### 5. Stored data

<Does `CharacterDoc`, `ContentPack` or a Dexie table change? If yes: the `schemaVersion` bump,
the migration, and its test. If no: "Nothing stored changes.">

#### 6. What a person will see

<The screen at 360×800: where it opens from, every state (empty, loading, error, full), the
English i18n keys and their text. "Not a screen" if §1 says No.>

#### 7. Tests

- `packages/…/test/…` — <what it checks>
- Control numbers from: <SPEC §6.7 golden X | SRD section | measured on …>

#### 8. Checked against the source

<Every `[ПРОВЕРИТЬ]` and every rules fact this ticket relies on: the source (SRD 5.1 / 5.2.1 page
or section, the dnd5e file path), and what it says. "Nothing to check" if there is none.>

#### 9. Not in this ticket

- <what a reader might expect here, and which ticket or phase owns it>

#### 10. Rake check

<The Hard invariants from `CLAUDE.md` that this ticket could break, one line each, with how the
ticket avoids breaking them.>

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
<The measured result (test count, time, the values), anything that differed from §3 and why,
"Found, not fixed", the changelog line or "Nothing for the changelog".>
````

---

## Short form (for XS)

An hour or less: one function, one edit. Five blocks instead of eleven. If filling it in shows
that §5, §6 or §8 are needed, it is not XS. Use the full form.

````markdown
### <AREA-NN> <Name> · XS

**Hat:** <one phrase>
**Where:** `packages/…` — <module or file>
**Depends on:** <id / `Nothing`>
**Screen:** <its boards in `docs/design/mockups/` | No>

**What it should look like when done:**
1. …

**Tests:** `…` — <what it checks>, control numbers: <where the truth comes from>
**What came out of it:** <filled at the end, never left empty>
````

---

## Notes on the blocks

| Block | What to watch |
|---|---|
| **id `<AREA-NN>`** | Area codes are in [README.md](README.md). The id goes in the heading, in one comment in the code, in the test's `describe`, and first in the commit message. |
| **Hat** | The most important block. If it does not fit one phrase without "and", the ticket is cut in two. "Compute skill totals" is one hat. "Compute skill totals and show them" is two tickets. |
| **Size** | XS up to 1 h · S 1–3 h · M half a day. Nothing is bigger. A small ticket is a short chat: cheaper, and clearer in git history. |
| **§2** | Measured, not remembered. Show the command output or the missing export. |
| **§3** | Each line can be checked by someone else. "Works well" cannot be checked. "Golden B: AC 17" can. |
| **§5** | A changed stored shape without a migration corrupts saved characters silently. |
| **§7** | Expected values come from SPEC §6.7 or from a source named in §8, never from running the code and copying its output. |
| **§8** | This is where `[ПРОВЕРИТЬ]` gets checked. A rule taken from memory is a rule that is probably wrong for one of the two rulesets. |
| **§9** | Name what a reader will look for and not find, and which ticket owns it. |
| **§11** | Measured numbers, differences from §3, and what was found but not fixed. A future ticket reads this, not the chat. |
