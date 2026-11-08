# SHEET — The character sheet, made by hand

**Why this theme:** Phase 2 puts the engine on the phone. A person makes a character by hand,
keeps it on the device and plays it from the sheet: trackers, rolls, rests, undo. Every number on
screen comes from `compute()` with its breakdown, and every look comes from a design token or a
skin slot (ADR 015). The screens follow the owner's mockups and the ADRs that placed work here.
**SPEC:** stage 2, sections §5.8, §6.4, §6.5, §7.1, §7.2, §7.4 (manual mode), §7.5, §11;
ADR 005, ADR 008, ADR 009, ADR 010, ADR 011, ADR 013, ADR 015
**Order and status:** [`BACKLOG.md`](BACKLOG.md) — never repeated here.
**Theme is closed when:** every SHEET row is ✅ or ❌, and the phase 2 gate named in `BACKLOG.md`
(SPEC §12 stage 2, as ADR 000 changes it) is proved.
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections and ADRs the
row's note names; for a screen, its boards in `docs/design/mockups/` and that folder's README.
**Closed tickets:** in [`docs/archive/tickets/SHEET_TICKET.md`](../archive/tickets/SHEET_TICKET.md),
moved there when each one closes.

---

### SHEET-60 The phase 2 gate is shown on golden characters made by hand

**Hat:** Show the phase 2 gate on golden A and golden B made in the interface
**Depends on:** Every other SHEET row
**Size:** M
**Screen:** No new screen. It drives the manual form (SHEET-27, 28) and every tab of the sheet.
**SPEC:** §12 stage 2 ("Готово, когда"), §6.7 golden A and golden B

---

#### 1. Where the code lives

**Main file:** `apps/web/e2e/gate.spec.ts` — new. Three tests: golden B, golden A, and the scenario
"damage while concentrating → save → undo". No other file in `apps/web/src` or `packages/` changes.

#### 2. What is missing now

Measured on `main` at `79c852b` (SHEET-76):
- No test makes golden A or golden B from an empty form. `create.spec.ts` types golden B's inputs
  and stops at the pinned bar (HP 12, AC 11, Init +1); its picks and gear are not made there.
- The scenario exists only in parts: `sheet.spec.ts` has the pad's save (SHEET-40) and the toast's
  Undo (SHEET-23) in separate tests, and none of them starts from a character made by hand.
- No file holds a time for making a character, and no file holds a screenshot of every tab.

#### 3. What it should look like when done

1. `gate.spec.ts` makes golden B from `characters/new`: 2024 rules, Human, Soldier, Fighter, the
   standard array (15, 13, 14, 8, 12, 10), Chain Mail and Greatsword. Then it answers the 8
   pending choices, and wears both items on the Gear tab.
2. It makes golden A the same way: 2014 rules, Dwarf, Acolyte, Cleric, subclass Life, the standard
   array (13, 10, 14, 8, 15, 12), Chain Mail, Shield and Warhammer. Then it answers the 4 pending
   choices (Hill Dwarf, ADR 016), and wears the 3 items.
3. Each test starts its clock at the empty form and stops it after the last SPEC §6.7 value the
   sheet shows. Past 300 s the test fails. The time is printed as `SHEET-60 golden X: made in … s`.
4. Golden B shows: scores 17 13 15 8 12 10; modifiers +3 +1 +2 −1 +1 +0; hit points 12; saves STR
   +5, CON +4; Athletics +5, Intimidation +2, Perception +3, Survival +3, Insight +3; passive
   Perception 13; Init +3; AC 17; Greatsword +5, 2d6 +3 slashing, Graze; Second Wind 2 uses, the
   short rest gives back 1, the long rest 2; speed 30 ft.
5. Golden A shows: scores 13 10 16 8 16 12; modifiers +1 +0 +3 −1 +3 +1; hit points 12; saves WIS
   +5, CHA +3, the others equal to their modifier; Insight +5, Medicine +5, Persuasion +3,
   Religion +1, Perception +3; passive Perception 13; AC 18; speed 25 ft; Init +0; save DC 13,
   attack +5; Warhammer +3, 1d8 +1 bludgeoning; 2 slots of level 1; Bless and Cure Wounds always
   prepared.
6. One test, on a character made by hand: cast Bless, take 4 damage, see "Constitution save, DC 10",
   roll d20 + 3, lose it, Undo brings the concentration back, the history's Undo gives the 4 hit
   points back.
7. One screenshot of each of the 8 tabs at 360×800, English, with no toast over the sheet.

#### 4. How to do it

1. Two helpers, `makeGoldenB` and `makeGoldenA`, drive the form and the choices panel. Both use
   only what a person taps: the form's fields, the choices badge, the Gear tab's "Worn" switch.
2. `pick()` taps a choice and waits until it is stored: the pick's chip is there, or its choice
   has left the list. Without that wait the next tap lands before the save and is lost.
3. The three tests call the helpers, so the scenario runs on a made character, not a saved row.
4. Every expected value is typed from SPEC §6.7. Values the SPEC leaves open are test data: Playing
   cards, Greataxe, Glaive, size Medium, Masons tools, Celestial, Elvish.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `apps/web/e2e/gate.spec.ts` — the three tests above; each `test` name starts with `SHEET-60`.
- Control numbers from: SPEC §6.7 golden A and golden B, with ADR 016 for the hill dwarf.

#### 8. Checked against the source

- SPEC §6.7 golden A names a "mountain dwarf". ADR 016 (owner, 2026-10-02) makes it the hill dwarf.
  No expected value changes.
- Golden B at level 1: SPEC §6.7 lists 3 weapon masteries nowhere; "Greatsword" with Graze is the
  one it names. The other two kinds are test data, as in `characters-2024.ts`.

#### 9. Not in this ticket

- The creation wizard (phase 4) and the homebrew editor (phase 5), as SPEC §12 says.
- Golden B4, C, D and E: they are not in the gate's two characters.
- Russian screenshots: ADR 000 puts the Russian locale in its own phase.
- A fix for anything §11 lists under "Found, not fixed".

#### 10. Rake check

- Golden tests are the truth: no expected value was read from a run; each one is SPEC §6.7's.
- Measure, never estimate: the times and counts in §11 are printed by the runs.
- Nothing in `apps/web/src` changed, so no look, string or rule moved into a component.
- No Content or licensing change: the test uses the built-in packs only.

#### 11. What came out of it

**Gate:** `pnpm lint` clean (454 files). `pnpm typecheck` clean. `pnpm test`: 1655 passed, 0 failed,
144 files, 33.7 s, plus the speed project 2 passed. `pnpm e2e`: 101 passed, 0 failed, 2.0 min. The
first full run had 1 failure in `navigation.spec.ts` (SHEET-11), which passed 3 of 3 alone; see
"Found, not fixed".

**Times** (from the empty form to the last SPEC §6.7 value, printed by the test):

| Character | Made in | Limit |
|---|---|---|
| Golden B | 3.5 s in the last full run (3.2 to 3.4 s in three earlier runs) | 300 s |
| Golden A | 2.7 s in the last full run (2.4 to 2.5 s in three earlier runs) | 300 s |

These are the driver's times. The driver does not read or think, so they are a floor. They show
that every pick can be made in the interface, and that the form and the choices panel are fast.
They do not show that a person makes a character in 5 minutes. That needs a person.

**What the sheet showed, all asserted from SPEC §6.7:** every line of §3 items 4 and 5 passed,
except two lines of golden A below.

**Not shown on the sheet for golden A (SPEC §6.7 "Хиты", "Заклинания"):**
1. Hit points: the maximum is 12. The current hit points read **11 / 12**. The form stores the
   current hit points as the computed maximum at creation (`packages/system-5e/src/manual.ts`,
   lines 153 to 160). At that moment the subrace is not picked: the form's bar shows 11. The Hill
   Dwarf pick later raises the maximum to 12 (Dwarven Toughness, +1) and the current ones stay 11.
   The test asserts the maximum only, and the scenario test reads the current ones from the screen.
2. "4 prepared" and "3 cantrips": `classes.cleric.spell.prepared` is 4 and `.cantrips` is 3 in
   `compute()` (ENG-15 test `golden-values.test.ts`). No screen shows either number. And no screen
   picks the spells of a class list: the Spells tab reads `character.systemData.spells`, which the
   form leaves empty. The tab shows the slots (2 of 2) and the two domain spells.

**Phase 2 is not closed.** Two of golden A's §6.7 lines are not on the sheet. ADR 019 decides what
the gate needs: SHEET-85, SHEET-86 (the two numbers only) and SHEET-87 close first, then this
ticket runs again, fills the rest of §11 and closes phase 2. Picking the spells of a class list
waits for phases 3 and 4.

**Found, not fixed:**
- SHEET-85: current hit points stay below the maximum after a pick raises the maximum.
- SHEET-86: the Spells tab shows how many spells a class prepares and how many cantrips it knows.
  Whether the sheet also picks them is part of the owner's question.
- SHEET-87: `navigation.spec.ts` line 21 reads `boundingBox()` with no wait; under two workers it
  got `undefined` once in two full runs.

**Screenshots:** 8 files, one for each tab, golden A as made by hand, 360×800, English, no toast
over the sheet. They are in
`apps/web/test-results/gate-SHEET-60-golden-A-is--23b1a--shows-its-SPEC-§6-7-values-pixel-7/`
(`tab-main`, `tab-turn`, `tab-combat`, `tab-spells`, `tab-gear`, `tab-features`, `tab-about`,
`tab-notes`) and are sent in the chat. They are not committed.

**Changelog:** Nothing for the changelog.
