# ENG — The game-free core and the fifth-edition module

**Why this theme:** Every number the app shows comes from the engine, and a wrong rule gives a
wrong number with no error. This theme builds the schemas, formulas, dice, effects and the
`compute()` pipeline, with no UI: first the core, which knows no game and is tested on a made-up
system, then the fifth-edition module as its own package (ADR 004). The golden tests of SPEC §6.7
are its proof.
**SPEC:** stage 1, sections §4.1, §5, §6; ADR 004, ADR 005
**Order and status:** [`BACKLOG.md`](BACKLOG.md) — never repeated here.
**Theme is closed when:** every ENG row is ✅ or ❌, and the phase 1 gate named in `BACKLOG.md`
(SPEC §12 stage 1, widened by ADR 004 and ADR 005) is proved.
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections above,
ADR 004.
**Closed tickets:** in [`docs/archive/tickets/ENG_TICKET.md`](../archive/tickets/ENG_TICKET.md), moved there
when each one closes.

---

### ENG-37 Golden F: a character mixing both editions

**Hat:** A character mixing both editions passes
**Depends on:** ENG-09 and ENG-10 (the fixtures), ENG-11 (`otherRuleset`), ENG-13, ENG-14, ENG-16
(the numbers), ENG-21 (Second Wind on a rest), ENG-35 (the ability bonus source), ENG-48 (size),
ENG-56 (the languages' place)
**Size:** M
**Screen:** No
**SPEC:** §6.7 (golden F, added by ADR 005 item 3.6); §5.8 `allowMixedRulesets`; ADR 005 item 3;
ADR 014 items 1 and 2

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/test/golden/golden-values.test.ts` — changes: an `ENG-37`
block.
- `packages/system-5e/test/golden/characters-mixed.ts` — new: `goldenF`, on both SRD packs.
- `packages/system-5e/test/golden/index.ts` — changes: exports `characters-mixed.ts`.
- `packages/system-5e/test/ability-bonus.test.ts`, `languages.test.ts` — changes: golden F joins
  their "every golden stores its rules base's choice" lists.
- `docs/adr/017-golden-f.md` — new: golden F's character and values, as the owner approved them
  (the SPEC §6.7 addition ADR 005 item 3.6 asks for; SPEC.md is not edited).

No source file changes, unless the test finds a value the engine gets wrong.

#### 2. What is missing now

Measured on `main` at `b0aabbe`:
- No golden F: `grep -rn "goldenF\|Golden F" packages/` finds nothing. SPEC §6.7 has goldens A to
  E only; ADR 005 item 3.6 adds F, "computed by hand", its values "shown to the owner and approved
  before the test is used".
- The engine can already compute a mix: `ability-bonus.test.ts` and `languages.test.ts` build
  golden B with the 2014 dwarf as test data, and check its scores and languages. No test holds a
  whole mixed character's numbers.
- `pnpm test`: `Test Files 63 passed (63)`, `Tests 827 passed (827)`.

#### 3. What it should look like when done

**The character (proposed; waiting for the owner's yes).** Golden B with the 2014 hill dwarf in
place of the 2024 human. The SRD 5.2.1 dwarf has no subraces, so a person who wants a hill dwarf
in a 2024 game takes SRD 5.1's: the mix ADR 005 item 3.4 names, "a 2014 race with a 2024
background".

| Part | Golden F | Edition |
|---|---|---|
| Rules base | 2024; mixing on (`allowMixedRulesets: true`); packs `srd-2014`, `srd-2024` | — |
| Scores | Standard array: STR 15, DEX 13, CON 14, INT 8, WIS 12, CHA 10 (golden B's) | — |
| Species | Dwarf, subrace hill dwarf; tool: mason's tools (test data) | 2014 |
| Background | Soldier: +2 STR, +1 CON; Savage Attacker; Athletics, Intimidation; playing cards (test data) | 2024 |
| Class | Fighter 1, hit points the maximum; Perception, Survival; Defense; mastery of greatsword, greataxe, glaive (the last two test data) | 2024 |
| Equipment | Chain mail and a greatsword, both equipped | 2024 |
| Ability bonus source | `background`: the rules base's, the default (ADR 014 item 1) | — |
| Languages' place | `background`: the rules base's (ENG-56) | — |

**The values, by hand (proposed; no test holds them before the owner's yes).** The sums were run
in a scratch script with no engine code, from the fixtures' SRD numbers (§8).

| What | Value | How |
|---|---|---|
| Scores | STR 17 (+3), DEX 13 (+1), CON 15 (+2), INT 8 (−1), WIS 12 (+1), CHA 10 (+0) | Base + the Soldier's +2 STR, +1 CON. The dwarf's +2 CON and the hill dwarf's +1 WIS are left out: the source is the background. |
| Proficiency bonus | +2 | Level 1 |
| Saves | STR +5, CON +4; DEX +1, INT −1, WIS +1, CHA +0 | The fighter's saves, STR and CON: modifier + 2 |
| Skills | Athletics +5, Intimidation +2, Perception +3, Survival +3; Insight +1 | The Soldier's two and the fighter's two: modifier + 2. Insight has no proficiency: golden B's came from the human. |
| Passive Perception | 13 | 10 + 3 |
| Hit points | 13 | 10 (d10, the maximum at level 1) + 2 (CON) + 1 (the hill dwarf's Dwarven Toughness, 1 per level) |
| AC | 17 | Chain mail 16 (no DEX) + Defense 1 |
| Initiative | +1 | DEX +1. No Alert: golden B's came from the human. |
| Speed | 25 ft | The 2014 dwarf's. STR 17 meets chain mail's 13, and the dwarf's trait keeps heavy armor from slowing it anyway. |
| Size | Medium | The 2014 dwarf's one size |
| Greatsword | +5 to hit, 2d6+3 slashing, mastery Graze | STR +3 + 2; damage STR +3 |
| Critical hit | On 20 only | No feature widens it |
| Second Wind | 2 uses; a short rest gives back 1, a long rest all | The 2024 fighter's table at level 1 |
| Languages | Common, Dwarvish | The 2014 dwarf's. The 2024 Soldier gives none in the fixture (5e-database has no language field, ENG-10 §8), and when one side gives, it applies whatever place is stored (ENG-56). |
| Other proficiencies | Weapons: simple, martial, and battleaxe, handaxe, light hammer, warhammer (the dwarf's); armor: light, medium, heavy, shields; tools: mason's tools, playing cards | The fighter's, the dwarf's traits', the Soldier's |
| Stats and skills used | The 2024 entries (`srd-2024:ability/str`, `srd-2024:skill/athletics`, and so on); languages the 2014 entries, the only ones | ADR 014 item 2: the rules base's copy of a key |
| Choices left | None | — |
| Warnings | 8, one per 2014 entry the character has, each "of the ruleset 2014, not the character's 2024", mixing allowed: the dwarf, its 5 traits, the hill dwarf, Dwarven Toughness. No other. | ADR 005 item 3.3: a mix warns, never blocks |

The other two sources, from the same script, for the owner's choice:
- `species`: STR 15 (+2), CON 16 (+3), WIS 13 (+1); STR save +4, CON save +5; Athletics +4; hit
  points 14; greatsword +4, 2d6+2. The Soldier's +2 and +1 are left out.
- `both`: STR 17 (+3), CON 17 (+3), WIS 13 (+1); CON save +5; hit points 14; a ninth warning,
  `characterRule` `abilityBonusesFromBoth`.

**When done:**
1. ADR 017 holds the character and the values the owner approved, with the date of her yes.
2. `goldenF` opens with `openFifthEditionCharacter`; its packs load with nothing refused and no
   warning.
3. Every value in the approved table is a line of the `ENG-37` block.
4. Each breakdown adds up to its value (ENG-13's check); the warnings are exactly the approved
   list.
5. Golden F is in the "every golden" lists of `ability-bonus.test.ts` and `languages.test.ts`,
   storing `background` for both, its rules base's.
6. Goldens A–E keep their values: their tests pass unchanged.
7. The quality gate is green.

#### 4. How to do it

1. **Stop** (ADR 007 item 1: golden values are the owner's). Show her the character and the
   values of §3 in the chat. Her answer goes into §3 and ADR 017 at once.
2. After her yes: `docs/adr/017-golden-f.md`, the character and the table, as approved.
3. `characters-mixed.ts`: `goldenF`, built as golden B is (`characters-2024.ts`), with golden A's
   dwarf choices (`#subrace`, `#tools`); its current hit points the approved maximum. A file of
   its own: it is of neither edition's pack alone.
4. `golden-values.test.ts`: `describe('ENG-37 golden F: a character mixing both editions')`, one
   `it` per group of §3's table. The ENG-13 helper `expectWhole` checks no warning and the sums;
   golden F checks its sums the same way and its warnings against the approved list.
5. The two "every golden" lists: golden F added, `background` and `background`.

#### 5. Stored data

Nothing stored changes. The character is test data in the existing shape (version 6).

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/golden/golden-values.test.ts` — the `ENG-37` block: §3 items 2–4.
- `packages/system-5e/test/ability-bonus.test.ts`, `languages.test.ts` — §3 item 5.
- The rest of the suite — §3 item 6.
- Control numbers from: the table in §3, once approved (ADR 017); each sum from the SRD numbers
  §8 names, never from a run.

#### 8. Checked against the source

No `[ПРОВЕРИТЬ]` is new here. Every rules fact golden F reads was checked by the ticket that wrote
it into a fixture or the engine, against 5e-database at `e6edf9a` and dnd5e at `7bfb3f1` (SRD 5.1
and SRD 5.2.1, CC-BY-4.0):
- The dwarf: speed 25, Medium, +2 CON, Common and Dwarvish, the five traits; Dwarven Combat
  Training's four weapons; Tool Proficiency's three tools. The hill dwarf: +1 WIS; Dwarven
  Toughness, "Your hit point maximum increases by 1, and it increases by 1 every time you gain a
  level." The SRD 5.2.1 dwarf has `subspecies: []`. (ENG-09 §8.)
- The dwarf's "Your speed is not reduced by wearing heavy armor" (ENG-45 §8).
- The Soldier: +2/+1 or +1/+1/+1 among STR, DEX, CON; Savage Attacker; Athletics, Intimidation;
  one gaming set; no language field. The fighter: d10, saves STR and CON, Second Wind 2 uses at
  level 1, 3 kinds of weapon mastery. Defense: +1 AC in armor. Chain mail: AC 16, no DEX, STR 13,
  stealth disadvantage. Greatsword: 2d6 slashing, heavy, two-handed, Graze. (ENG-10 §8, ENG-16
  §8.)
- The modifier `floor((score − 10) / 2)`, the proficiency bonus +2 at level 1, passive
  Perception 10 + the check (ENG-13 §8). Level-1 hit points: the hit die's maximum + the CON
  modifier (ENG-14 §8).
- SRD 5.1's increases come from the race, SRD 5.2.1's from the background; languages from the
  race in SRD 5.1 and the origin step in SRD 5.2.1 (ENG-35 §8, ENG-56 §8).

No golden value looks wrong to this check; the stop in §4 is for the owner's approval, which
ADR 005 item 3.6 asks for every golden F value.

#### 9. Not in this ticket

- The 2024 Soldier's three languages: the import puts them on each 2024 background (phase 3,
  ENG-56). The fixture Soldier, from 5e-database, gives none; golden F's languages are the
  fixture's.
- How the sheet shows the 8 mixing warnings: phase 2 (`SHEET`).
- A mix the other way, a 2024 species in a 2014-based character: ENG-56's tests hold its
  warning; golden F is one character.
- Two copies of one entry (ADR 005 item 3.5, "prefer 2014 / 2024" in lists): the library, phase 3.

#### 10. Rake check

- **The golden tests are the truth.** No golden F value enters a test before the owner's yes; each
  is a sum of SRD numbers (§8), run in a script with no engine code. No value of A–E changes.
- **Measure, never estimate.** The sums are a script's output; the engine's output is measured
  after, not copied.
- **Each system's rules live in its module.** No source file changes; the test names no
  `if (ruleset === …)`.
- **Content and licensing.** Golden F uses only the SRD fixtures already in the repository.
- **Missing is not broken.** A mix warns and never blocks: golden F expects its warnings.

#### 11. What came out of it

In work. Stopped on 2026-10-05 at §4 step 1, for the owner's yes on §3. Measured before the
stop, after the values were written: the engine, run on the proposed character in a scratch
test (deleted), gives every value of §3's table for all three sources, and the same 8 warnings
(9 with `both`).
