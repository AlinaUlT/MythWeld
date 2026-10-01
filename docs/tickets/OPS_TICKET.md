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
1. ADR 003 says what the owner's note "GrimoireMancer — Library / Compendium Architecture"
   (2026-09-28) changes in the SPEC (packs), and how the owner stays clear of content rights.
2. ADR 004 says how the app grows past fifth edition: a game-free core, and one module per system.
3. `CLAUDE.md`: the opening line and the hard invariants on data, rulesets and licensing follow
   the two ADRs.
4. `BACKLOG.md`: phase 1 is marked for a re-cut before ENG-01; phase 5 grows; the `SYS` phase and
   the later Fantasy Grounds and community phases are listed; `README.md` has the `SYS` area.
5. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts before and after (lint files, test count).

**What came out of it:** The owner accepted both decisions on 2026-09-28, and asked that sharing
personal libraries never puts the rights risk on her as the owner (ADR 003, Part B). Checked
before writing: `packages/schema/src/index.ts` and `packages/engine/src/index.ts` export nothing
yet, so ADR 003's schema items and ADR 004's split cost no migration. The ADRs say plainly that
they are not legal advice; a lawyer's check is the gate of the future community-place phase. Not
done here, on purpose: the phase 1 re-cut (shown to the owner first) and any license check of another
system's content (each system's own ticket). Found, not fixed: nothing. Nothing for the
changelog; a person sees no change.

### OPS-02 The product decisions of 2026-09-29 · XS

**Hat:** ADR 005 records the product decisions of 2026-09-29
**Where:** `docs/adr/005-modes-free-version-table-link.md` — new; `CLAUDE.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-01

**What it should look like when done:**
1. ADR 005 records the owner's seven answers of 2026-09-29: 3 free characters; 1 free campaign with
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
8. **Part 6, "What the owner chose":** an empty table, one row per screen plus the heading font.
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
- Choosing the heading font: the owner, in the design step; written into part 6 afterwards.

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

`docs/design/BRIEF.md` exists: 371 lines, 16 screen prompts (P1–P16), 2 extra prompts (a heading
font sampler, an app map), and an empty "What the owner chose" table with 17 rows. `CLAUDE.md`'s doc
map has one new row. The gate is green: lint checked 52 files; typecheck passed; 6 test files,
18 tests passed, 0 failed, 783 ms. No invisible characters; no AI product named.

Differs from §3:
- **Five parts, not six.** The app summary, the rules and the style form one "base block", so
  the design tool gets them in one paste. Each screen's section is its prompt, so nothing is
  written twice. The parts: the base block, the screens, extra prompts, notes, the choices.
- **Added: where each colour may be used.** Contrast was measured with the WCAG formula:
  dark heading 3.31:1 and dark accent-bright 3.71:1 on bg (large text and icons only); dark
  accent 2.08:1 on bg (never text); light accent-2 2.95:1 on bg (never text); text-on-accent on
  light accent-dark 3.49:1 (large text only). Body text passes: 10.02:1 dark, 11.93:1 light.
- **Added: text-on-accent `#e5ebee`**, ITS's `--text-dl` (shared by both themes), because
  buttons need a text colour and ADR 005's table has none.

Found, not fixed: the contrast limits above bind the phase 2 ticket that turns the colours into
design tokens; they are written in the brief, and ADR 005 is not changed. Nothing for the
changelog; a person sees no change.

### OPS-04 Fewer stops · XS

**Hat:** ADR 006 removes the stops that protect nothing
**Where:** `docs/adr/006-fewer-stops.md` — new; `CLAUDE.md`, `PROMPTS.md`,
`docs/tickets/README.md`, `docs/adr/002-technical-choices.md`, `docs/tickets/BACKLOG.md` — changed
**Depends on:** Nothing

**What it should look like when done:**
1. ADR 006 records the owner's approval (2026-09-30) of two rules: a document-only ticket has no
   checkpoint; her answers to a list of questions are recorded at once. It lists what still stops.
2. `CLAUDE.md` ("The checkpoint"), `docs/tickets/README.md` (lifecycle step 4), ADR 002 ("What
   does not change") and `PROMPTS.md` (prompt 2) name the exception and point to ADR 006.
3. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** The owner approved both rules on 2026-09-30, "if nothing will crush final
goal". The ADR says why nothing does: a document-only ticket changes no code and no computed
number, and each change is one revertible commit. Kept on purpose: the checkpoint for code tickets
of size S and M, any ticket that changes an engine number, and a document that makes a new
decision for the owner (the phase 1 re-cut is the named example). The gate is green: lint checked 52
files; typecheck passed; 6 test files, 18 tests passed, 0 failed, 798 ms. Found, not fixed:
nothing. Nothing for the changelog; a person sees no change.

### OPS-05 The phase 1 re-cut · XS

**Hat:** Phase 1 is re-cut to follow ADRs 003–005
**Where:** `docs/tickets/BACKLOG.md` — the phase 1 section, the Order section, the OPS table;
`docs/tickets/README.md` — the `ENG` area line
**Depends on:** OPS-01, OPS-02

**What it should look like when done:**
1. Phase 1's table is in work order: the game-free core first, then the fifth-edition module
   (ADR 004 item 1). One area, `ENG`, covers both, so no new area code is needed.
2. One row makes the fifth-edition module its own package, which CI stops the core from
   importing (ADR 004 item 2).
3. One row builds the made-up test system, and the core's compute rows are tested on it
   (ADR 004 item 4).
4. The schema rows carry ADR 003's pack items from the start: `system`, the source details, no
   `meta.foundry`, no field that says where a pack came from. One row checks dependencies,
   dependency loops and a newer `schemaVersion` when packs load.
5. ADR 005's three phase 1 items each have a row: golden F, the ability-bonus source as a
   choice, the roll result's shape. Golden F's row shows its values to the owner before its test is
   written. This ticket writes no golden value.
6. Every row is XS, S or M, with a hat of one phrase without "and". No id is reused: an old row
   keeps its id when its meaning stays; a split-off part gets a new id; a row that goes gets ❌
   with the reason.
7. The gate line names golden F, the made-up test system and the core-import check.
8. The owner approved the rows in the chat before they were written (ADR 004, ADR 006 item 3).
9. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** The owner approved the rows on 2026-09-30, before they were written. Phase 1
now has 37 rows (was 23): 14 new (ENG-24 to ENG-37), none cancelled; 4 XS, 21 S, 12 M; no hat
holds "and" (counted by a script over `BACKLOG.md`). Old rows kept as they were: ENG-01, ENG-18,
ENG-22. Old rows with the same scope and only the hat reworded to drop "and": ENG-07, ENG-09,
ENG-10, ENG-13, ENG-14, ENG-15, ENG-19. Narrowed, with the split-off parts under new ids: ENG-03,
ENG-05, ENG-06, ENG-08, ENG-16, ENG-20, ENG-21. Checked in the code before cutting:
`packages/schema/src/index.ts` and `packages/engine/src/index.ts` hold only `export {};`, and Zod
is not installed, so the split costs no migration. Decided here (ADR 002): one area, `ENG`, for the
core and the module; the Order section reads "the order of its table"; ENG-31 picks the module's
package name and `system` id; the 90 % coverage bar covers the fifth-edition module too. The
made-up test system's expected values are test data, not goldens (ENG-27 note). No golden value
was written or changed. The gate is green: lint checked 52 files; typecheck passed in all 5
packages; 6 test files, 18 tests passed, 0 failed, 683 ms. Found, not fixed: nothing. Nothing for
the changelog; a person sees no change.

### OPS-06 Stop only for the owner's decisions · XS

**Hat:** ADR 007 limits stops to the owner's decisions
**Where:** `docs/adr/007-stop-only-for-the-owners-decisions.md` — new; `CLAUDE.md`, `PROMPTS.md`,
`docs/tickets/README.md`, `docs/adr/002-technical-choices.md`, `docs/adr/006-fewer-stops.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-04

**What it should look like when done:**
1. ADR 007 records the owner's rule of 2026-09-30: the chat stops only for a decision on ADR 002's
   "Still the owner's" list; no stop by ticket size; git and the push to `main` are never asked; a
   report ends with what was done and what comes next.
2. `CLAUDE.md` (the steps, "Stops", "Working with the owner"), `docs/tickets/README.md` (lifecycle
   step 4), ADR 002, ADR 006 and `PROMPTS.md` (prompts 2 and 6) follow it.
3. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** The owner set the rule on 2026-09-30, after the OPS-05 chat stopped or ended
with a question four times when only one was hers (the phase 1 rows). Still stops: everything on
ADR 002's list, which includes golden F's values (ENG-37) and golden A's dwarf check (ENG-09). No
longer stops: S and M tickets by size, engine tickets that match approved goldens, cutting a phase
into rows unless a row adds or drops a feature. The gate is green: lint checked 52 files;
typecheck passed in all 5 packages; 6 test files, 18 tests passed, 0 failed, 778 ms. Found, not
fixed: nothing. Nothing for the changelog; a person sees no change.

---

### OPS-07 the owner's design choices of 2026-09-30 · XS

**Hat:** The design brief records the owner's choices of 2026-09-30
**Where:** `docs/design/BRIEF.md` — Part 2 (the P4 prompt) and Part 5; `docs/tickets/BACKLOG.md`
**Depends on:** OPS-03

**What it should look like when done:**
1. Part 5, row P4: V3 "Thumb". The name and the stats row sit at the top. Hit points, "Damage",
   "Heal" and the tabs sit at the bottom, near the thumb.
2. The P4 prompt in Part 2 describes V3, so a new design made from it matches the choice.
3. Part 5 gains three rows. Base colours: not chosen; the base theme stays plain and calm, and
   paid skins add personality; Lavender and Cream are rejected. Overall design: not chosen; the
   app gets a first page instead of opening on a character sheet. Future skins: the six retro
   looks.
4. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** The owner chose from mockups on a design canvas. The mockups stay out of the
repository (BRIEF Part 4); Part 5 links the canvas. V3 shows the modifier large and the score
small, the reverse of the old P4 prompt; the new prompt follows V3. ADR 005 item 7 still names
the ITS colours: it changes by a new ADR once the owner picks the base colours. The gate is green:
lint checked 66 files; typecheck passed in all 5 packages; 10 test files, 59 tests passed,
0 failed, 1.26 s. The first commit left this ticket text out; a second commit with the same id
adds it. Found, not fixed: nothing. Nothing for the changelog; a person sees no change.

---

### OPS-08 The navigation the owner chose · XS

**Hat:** ADR 008 records the navigation the owner chose
**Where:** `docs/adr/008-navigation-start-page-no-bottom-bar.md` — new; `docs/design/BRIEF.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-07

**What it should look like when done:**
1. ADR 008 records the owner's decisions of 2026-09-30: no bottom bar; a start page with the game
   system and Player or Game master; a player page with My characters, the rulebook chapters
   with a source per chapter, Dice and My packs, and no create button; My characters with "+" in
   the corner and Actions on a swipe or "⋯"; recorded creation steps; a sheet whose features are
   used and tracked on it, and an edit mode; the reference app's ideas and parts, never its look.
2. ADR 008 lists what it changes in SPEC §7.1 and ADR 005 item 1, and what stays open.
3. BRIEF Part 1 describes the new navigation. P1 becomes the start page, P17 is the player page,
   and P2, P3, P4 and X2 no longer mention a bottom bar. Part 5 records the overall design.
4. `BACKLOG.md` notes for phase 2 that the SETUP-04 bottom bar is replaced.
5. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** The owner rejected the bottom bar and every home page built around it,
then described the flow and sent screenshots of a reference app. The screenshots stay out of the
repository, and the ADR does not name the app. The mockups are on the design canvas, page "Our
design v1". The SETUP-04 shell still shows the bottom bar; phase 2 replaces it, and `BACKLOG.md`
says so. The gate is green: lint checked 66 files; typecheck passed in all 5 packages; 10 test
files, 59 tests passed, 0 failed, 1.35 s. Found, not fixed: SPEC §7.1 still describes
the bottom bar; the SPEC is read, not edited, and ADR 008 overrides it. Nothing for the
changelog; a person sees no change.

---

### OPS-09 Sheet, dice, rulebook and campaign requirements · XS

**Hat:** ADR 009 records the owner's sheet, dice, rulebook and campaign requirements
**Where:** `docs/adr/009-sheet-dice-rulebooks-dm-control.md` — new; `docs/design/BRIEF.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-08

**What it should look like when done:**
1. ADR 009 holds every requirement the owner gave on 2026-09-30 after the ADR 008 mockups: the dice
   panel on the sheet; features by source; the About tab; the spellcasting line; Inspiration as
   eight-pointed stars, 3 by default, set by the DM; portrait and token frame; custom items,
   companions, sections and stats (her Vitality example); the honest, realistic dice animation;
   custom roll modifiers; several rulebooks and packs at once with the source on every entry;
   the campaign copy with DM changes and DM approval of important changes.
2. Each item names the phase that builds it; `BACKLOG.md` lists them by phase.
3. BRIEF's base block, P4 and P17 follow ADR 009; Part 5 points to it.
4. What stays open is listed in ADR 009.
5. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** the gate is green: lint checked 66 files; typecheck passed in all 5
packages; 10 test files, 59 tests passed, 0 failed, 1.34 s. Vitality's example numbers are
Iren's own modifiers (STR +3, DEX +1, CON +2; BRIEF Part 1), so 8 + 3 + 1 + 2 = 14 and
(14 − 10) / 2 = modifier +2. Found, not fixed: SRD's inspiration rule is not checked yet; ADR 009
item 5 marks it `[ПРОВЕРИТЬ]` for the ticket that builds Inspiration. Nothing for the changelog;
a person sees no change.

---

### OPS-10 Library, dice, creation, level and spell requirements · XS

**Hat:** ADR 010 records the owner's library, dice, creation, level and spell requirements
**Where:** `docs/adr/010-library-dice-creation-levels-turn-tab.md` — new; `docs/design/BRIEF.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-09

**What it should look like when done:**
1. ADR 010 holds every requirement the owner gave on 2026-09-30 after the ADR 009 mockups: "⋯" on
   Books in use to add packs; All sources; the one-page library with topics and full entries;
   custom dice and any count of dice; the Damage and Heal number pad; level-up by XP or
   milestone, with the DM's control in a campaign; the Turn tab; the spell slot grid; casting
   without a slot and granted spells marked "1/LR"; creation steps that open and close; ability
   score methods as data, with her three examples; changes reviewed together by the DM.
2. Each item names its phase; `BACKLOG.md` lists them by phase.
3. BRIEF P3, P4, P6, P7, P9, P11 and P17 follow ADR 010; Part 5 points to it.
4. What stays open is listed in ADR 010.
5. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** the gate is green: lint checked 66 files; typecheck passed in all 5
packages; 10 test files, 59 tests passed, 0 failed, 1.72 s. The "Turn" tab's name was chosen so
it does not clash with the "Actions" list behind "⋯". Found, not fixed: nothing. Nothing for the
changelog; a person sees no change.

---

### OPS-11 Every detail is recorded · XS

**Hat:** `CLAUDE.md` says every detail the owner gives is recorded in the same chat
**Where:** `CLAUDE.md` — "Working with the owner"; `docs/tickets/BACKLOG.md`
**Depends on:** OPS-10

**What it should look like when done:**
1. "Working with the owner" has a bullet: every requirement, design choice or technical detail
   the owner gives in the chat is written, in the same chat, into the file that owns it (an ADR for
   a decision, `docs/design/BRIEF.md` for a screen); the report names the file and the commit.
2. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** The owner asked on 2026-09-30 that technical details she adds later be
recorded too, so nothing is forgotten; ADRs 009 and 010 were the first records of this kind. The
gate is green: lint checked 66 files; typecheck passed in all 5 packages; 59 tests passed,
0 failed. Found, not fixed: nothing. Nothing for the changelog; a person sees no change.

---

### OPS-12 Full descriptions on the sheet · XS

**Hat:** ADR 011 records full descriptions on the sheet
**Where:** `docs/adr/011-descriptions-on-the-sheet.md` — new; `docs/design/BRIEF.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-11

**What it should look like when done:**
1. ADR 011 records the owner's requirement of 2026-09-30: every ability, skill, feature, feat, spell
   and item opens and closes its description in place; tapping one shows "See full
   description", the exact text of its source, with the source named; only openly licensed text
   or the person's own packs are shown.
2. BRIEF P4 and `BACKLOG.md` follow it.
3. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** the first record made under OPS-11's rule. The owner then placed it: for a
spell, the summary and "See full description" sit in the cast panel, above "Cast"; the separate
spell card mockup was removed, and a second commit with this id records that. The gate is green: lint
checked 66 files; typecheck passed in all 5 packages; 59 tests passed, 0 failed, 1.50 s. Found,
not fixed: nothing. Nothing for the changelog; a person sees no change.

---

### OPS-13 No personal name · XS

**Hat:** No personal name for the owner appears in the repository
**Where:** every document that named the owner; `CLAUDE.md` — "What does not go in this
project"; `docs/adr/007-…` — renamed
**Depends on:** OPS-12

**What it should look like when done:**
1. No file in the repository names the owner. Each mention says "the owner" instead.
2. ADR 007's file is `007-stop-only-for-the-owners-decisions.md`, and every link points to it.
3. `CLAUDE.md` has a rule: no personal name for the owner in any file, commit message, mockup or
   chat reply, and none taken from an account, email or repository address.
4. No code changes. The quality gate stays green.

**Tests:** none new; `git grep -i` for the old name finds only the GitHub account in the public
link's address. Control numbers: the gate's counts.

**What came out of it:** the owner asked on 2026-09-30 that the name never be used; it was not
their name. The owner's name appeared in 20 files; all now read "the owner". The GitHub account
name stays only inside the link `https://alinault.github.io/MythWeld/` and the repository's
path, because those are addresses: changing them means renaming the account or the repository,
which only the owner can do on GitHub. Found, not fixed: six earlier commit messages and one
commit's author field still hold the name; removing them rewrites the history of `main`, which
waits for the owner's answer. Nothing for the changelog; a person sees no change.

---

### OPS-14 The library's look on the phone · XS

**Hat:** ADR 012 records the library's look on the phone
**Where:** `docs/adr/012-library-look-on-the-phone.md` — new; `docs/design/BRIEF.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-13

**What it should look like when done:**
1. ADR 012 records the owner's choice of 2026-09-30: an entry opens in a floating window over
   the list; the list page's controls, groups, cards and markers; the window's parts, "Damage
   dice" by level included.
2. It states that nothing is copied from the two references: no text, images or styling.
3. BRIEF P7 and `BACKLOG.md` follow it.
4. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** the references were a tabletop app's floating spell window and a
website's spell page, which the owner likes for its overall layout; the ADR names neither. The
website's comments section is not taken: the app has no server for it. The gate is green:
lint checked 66 files; typecheck passed in all 5 packages; 59 tests passed, 0 failed, 1.75 s.
Found, not fixed:
nothing. Nothing for the changelog; a person sees no change.

---

### OPS-15 The owner's requests of 2026-10-01 · XS

**Hat:** ADR 013 records the owner's requests of 2026-10-01
**Where:** `docs/adr/013-temp-hp-creation-dm-tools-home-tabs.md` — new; `docs/design/BRIEF.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-14

**What it should look like when done:**
1. ADR 013 records each request: temporary hit points, the level on the token, level-up
   approval, spells per ruleset, filled triangles, the roll calculator, optional feats, the
   ability bonus conflict, the DM's rights, edits, approvals tab and actors, the system preview,
   the Player and DM squares, and the home page's six sections.
2. It lists what is still open, the six level options and the screenshots still to come
   included.
3. BRIEF P1, P3, P4, P6, P7, P9, P11, P17 and Part 5, and `BACKLOG.md`, follow it.
4. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** the reference for the roll calculator was three screenshots of a
website's ability score calculator; the ADR takes the order of its parts, not its text or look.
BRIEF P3 item 6 said "pick one"; the owner's rule is either or both outside a campaign, and the
DM's call inside one. The level-up screenshot the owner named did not arrive; ADR 013 lists it
as open. The gate is green:
lint checked 66 files; typecheck passed in all 5 packages; 59 tests passed, 0 failed, 1.57 s.
Found, not fixed: nothing. Nothing for the changelog; a person sees no change.

---

### OPS-16 The spell description's layout · XS

**Hat:** ADR 013 records the spell description's layout
**Where:** `docs/adr/013-temp-hp-creation-dm-tools-home-tabs.md`, `docs/design/BRIEF.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-15

**What it should look like when done:**
1. ADR 013 item 6 records the spell's description, top to bottom, with a small top part (type
   line, source, casting time, range, duration, components), so the text starts high.
2. The items after it are renumbered, with their cross-references; "A better layout for the
   spell's description" leaves "Still open".
3. BRIEF P7 and `BACKLOG.md` follow it.
4. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** the reference was four screenshots of a website's spell page, two
spells, the top and the bottom of each. The owner's change to it: the top part is smaller. The
website's link, bookmark and close buttons map to share, bookmark (ADR 013 item 17) and close;
ADR 012's homebrew copy and edit move into a "⋯" menu, so the title row keeps its room.
The gate is green: lint checked 66 files; typecheck passed in all 5 packages; 59 tests passed,
0 failed, 1.59 s.
Found, not fixed: nothing. Nothing for the changelog; a person sees no change.
