# OPS — Around the code

**Why this theme:** Some work changes no feature: CI, deploy, tooling and the project's documents.
It still needs an id, so that every commit starts with one and `git log --grep` finds it.
**SPEC:** none by default; each ticket names what it touches.
**Order and status:** [`BACKLOG.md`](BACKLOG.md) — never repeated here.
**Theme is closed when:** never. `OPS` stays open (see [`README.md`](README.md)).
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`.

---

### OPS-01 The library-packs and game-systems decisions · XS

**Hat:** ADR 003 and ADR 004 record the library packs and the game systems
**Where:** `docs/adr/003-library-packs.md`, `docs/adr/004-game-systems.md` — new; `CLAUDE.md`,
`docs/tickets/BACKLOG.md`, `docs/tickets/README.md` — changed
**Depends on:** Nothing

**What it should look like when done:**
1. ADR 003 says what Alina's note "GrimoireMancer — Library / Compendium Architecture"
   (2026-09-28) changes in the SPEC (packs), and how the owner stays clear of content rights.
2. ADR 004 says how the app grows past fifth edition: a game-free core, and one module per system.
3. `CLAUDE.md`: the opening line and the hard invariants on data, rulesets and licensing follow
   the two ADRs.
4. `BACKLOG.md`: phase 1 is marked for a re-cut before ENG-01; phase 5 grows; the `SYS` phase and
   the later Fantasy Grounds and community phases are listed; `README.md` has the `SYS` area.
5. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts before and after (lint files, test count).

**What came out of it:** Alina accepted both decisions on 2026-09-28, and asked that sharing
personal libraries never puts the rights risk on her as the owner (ADR 003, Part B). Checked
before writing: `packages/schema/src/index.ts` and `packages/engine/src/index.ts` export nothing
yet, so ADR 003's schema items and ADR 004's split cost no migration. The ADRs say plainly that
they are not legal advice; a lawyer's check is the gate of the future community-place phase. Not
done here, on purpose: the phase 1 re-cut (shown to Alina first) and any license check of another
system's content (each system's own ticket). Found, not fixed: nothing. Nothing for the
changelog; a person sees no change.

### OPS-02 The product decisions of 2026-09-29 · XS

**Hat:** ADR 005 records the product decisions of 2026-09-29
**Where:** `docs/adr/005-modes-free-version-table-link.md` — new; `CLAUDE.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-01

**What it should look like when done:**
1. ADR 005 records Alina's seven answers of 2026-09-29: 3 free characters; 1 free campaign with
   the table link; no limit on homebrew or packs; AI with the person's own key, free and off by
   default; the ITS colour values reused in our own code; campaign sync by the table link
   (peer-to-peer); partial mixing of the two editions, with golden F.
2. It also records what the discussion settled around them: the two modes, the free and paid
   table, no D&D Beyond link, dice skins, roll tables and generators, the DM tools, images, PDF
   extras, the fonts. It lists what it changes in the SPEC, what does not change, what is still
   open, and its sources.
3. `CLAUDE.md`: the external-requests invariant names the features a person turns on.
4. `BACKLOG.md`: the phase 1 re-cut note carries ADR 005's three phase 1 items; the later-phase
   paragraph names what ADR 005 reshapes and adds; OPS-03 is listed.
5. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** The gate is green: lint checked 52 files; typecheck passed in every
package; 6 test files, 18 tests passed, 0 failed, 577 ms. Measured for the ADR, not remembered:
the ITS colours from its `theme.css` (main branch), its license (GPL-2.0) from its `LICENSE`, and
each font's license (`OFL`) and Cyrillic support from Google Fonts' metadata and CSS API. Some
sources were blocked from the work environment (dndbeyond.com, dmheroes.com, the app stores,
supabase.com, cloudflare.com, shieldmaiden.app); the ADR marks those facts as coming from search
results, and names no server price. Differs from the chat: the fonts ship inside the app, because
SPEC §11 forbids loading them from a font server (found in SETUP-04's rake check). Found, not
fixed: nothing. Nothing for the changelog; a person sees no change.

### OPS-03 The design brief for the screens

**Hat:** The design brief for the screens exists
**Depends on:** OPS-02
**Size:** S
**Screen:** No — a document for designing screens; the app does not change
**SPEC:** §7 (screens and UX), §9 (every visible string is a key); ADR 005 items 1, 2, 3, 5, 7, 8, 9

---

#### 1. Where the code lives

**Main file:** `docs/design/BRIEF.md` — new.
- `CLAUDE.md` — one row in the doc map.

#### 2. What is missing now

- `ls docs` gives `CHANGELOG.md RUNNING.md SPEC.md adr archive tickets`: there is no `design`
  folder.
- The screens are described in SPEC §7, in Russian, with no style. The style is in ADR 005 item 7.
  The modes, the DM tools and the free and paid marks are in ADR 005 items 1, 2 and 9. Nothing
  gathers them in one place that a design tool can read.

#### 3. What it should look like when done

1. `docs/design/BRIEF.md` exists, in English, in six parts.
2. **Part 1, the app:** what it is, in five lines; the two modes; the bottom bar: Characters ·
   Library · Dice · Table (DM mode only) · Settings.
3. **Part 2, the rules every screen follows:** tap a number to roll it; long-press to see where it
   comes from; play mode locks the sheet; touch targets of at least 44 px; main actions in the
   lower half; one pattern, list → card → edit; phone first at 360×800, two columns on a tablet;
   dark by default; no "D&D" name, logo or official look (SPEC §3.4), only "5E compatible".
4. **Part 3, the style block:** the colours of ADR 005 item 7 for dark and light, Inter for text,
   the four heading-font candidates. It is ready to paste, and says that ADR 005 wins if the two
   ever differ.
5. **Part 4, the screens**, one section each: its purpose, what is on it, the main actions, its
   states (empty and full), and a free or paid mark where ADR 005 item 2 sets one. Sixteen
   screens:
   - Player: first start (the mode choice); the characters list; character creation; the
     character sheet (the header and six tabs); the roll dialog and the breakdown; damage,
     healing and rests; the library and an entry's card; my packs and the homebrew editor; dice;
     settings with the theme editor.
   - DM: campaigns and one campaign's page; the initiative tracker; the bestiary and a monster's
     card; the encounter builder; the generators.
   - Both: a player's view of a campaign (roll requests, gifts, the turn order).
6. **The sample numbers are golden B's** (SPEC §6.7), so the sheet shows real, hand-computed
   values: STR 17 (+3), DEX 13 (+1), CON 15 (+2), INT 8 (−1), WIS 12 (+1), CHA 10 (+0); hit
   points 12; AC 17; initiative +3; speed 30 ft.
7. **Part 5, the prompts:** one per screen, ready to paste into a design tool, plus a font sampler
   prompt that shows the four heading fonts side by side.
8. **Part 6, "What Alina chose":** an empty table, one row per screen plus the heading font.
   Results are written in as text: the choice, a link if there is one, notes. Mockup images are
   not committed, like screenshots.
9. `CLAUDE.md`'s doc map has one row: screen designs → `docs/design/BRIEF.md`.
10. The brief names no AI product and holds no rules text (`CLAUDE.md`).
11. The quality gate stays green.

#### 4. How to do it

1. Gather from SPEC §7.1–§7.5, §8.3 and §10, and from ADR 005 items 1, 2, 3, 5, 7, 8 and 9.
2. Write parts 1–4. Each screen section is short, 5–10 lines.
3. Write part 5. Each prompt is: "use the style block" + that screen's section + "phone
   360×800, dark and light".
4. Write the part 6 table.
5. Add the doc-map row.
6. The gate, §11, ✅, the commit, the push.

Decided here (ADR 002):
- **The style block repeats ADR 005's values.** "One fact, one place" says to point, not repeat.
  A design tool needs one block to paste, so the brief carries a copy, marked "ADR 005 wins".
  Reversing it: delete the block and paste from the ADR.
- **English**, like every document (`CLAUDE.md`). A design tool reads English.
- **Results as text, no images in the repository**, like screenshots.
- **Sixteen screens, not every dialog.** Smaller dialogs (conditions, spell slots, level-up) are
  designed in the phase that builds them.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- None new. The quality gate is run to show nothing else changed.
- Control numbers from: SPEC §6.7 golden B, copied as they stand.

#### 8. Checked against the source

Nothing to check: the brief states no rule. Its sample numbers are golden B's (SPEC §6.7), copied
unchanged. The term pair Race (2014) / Species (2024) comes from SPEC §6.3.

#### 9. Not in this ticket

- Design tokens in code: phase 2 (ADR 005 item 7).
- Russian screen text: the Russian phase (ADR 000).
- Building the theme editor, dice skins, the table link or payments: their later phases
  (ADR 005).
- Choosing the heading font: Alina, in the design step; written into part 6 afterwards.

#### 10. Rake check

- **No "D&D" or official look:** part 2 says so; the sample names are SRD names.
- **No rules text without an open license:** the brief quotes no rules; golden B's names (Savage
  Attacker, Alert, Graze, Second Wind) are SRD 5.2.1 names.
- **Nothing invisible:** the file is scanned for zero-width characters, byte-order marks and
  non-breaking spaces before the commit.
- **No tool attribution:** the brief says "a design tool" and names no AI product.
- **No user-facing string literal in a component:** not code; the brief says every label becomes
  an i18n key.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
