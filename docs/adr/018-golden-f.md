# ADR 018 — Golden F: a 2014 hill dwarf, a 2024 Soldier, a 2024 fighter

**Status:** accepted · **Date:** 2026-10-05 · **Decided by:** The owner, in the chat of ENG-37

## Context

ADR 005 item 3.6 adds golden test F to SPEC §6.7: a character that mixes both editions, computed
by hand, its values approved by the owner before the test is used. ADR 017 lets a player tick the
race's ability increases, the background's, both or neither, so golden F is computed for each of
the four.

The sums were run in a script with no engine code, from the SRD numbers the fixtures hold
(ENG-37 §8). They were shown to the owner with the five steps that make them: the base scores,
the bonuses, score to modifier, hit points, the greatsword. She answered "Yes" on 2026-10-05.

## Decision

1. **The character.** Golden B with the 2014 hill dwarf in place of the 2024 human. The SRD 5.2.1
   dwarf has no subraces, so a person who wants a hill dwarf in a 2024 game takes SRD 5.1's: the
   mix ADR 005 item 3.4 names, "a 2014 race with a 2024 background".

| Part | Golden F | Edition |
|---|---|---|
| Rules base | 2024; mixing on (`allowMixedRulesets: true`); packs `srd-2014`, `srd-2024` | — |
| Scores | Standard array: STR 15, DEX 13, CON 14, INT 8, WIS 12, CHA 10 (golden B's) | — |
| Species | Dwarf, subrace hill dwarf; tool: mason's tools (test data) | 2014 |
| Background | Soldier: +2 STR, +1 CON; Savage Attacker; Athletics, Intimidation; playing cards (test data) | 2024 |
| Class | Fighter 1, hit points the maximum; Perception, Survival; Defense; mastery of greatsword, greataxe, glaive (the last two test data) | 2024 |
| Equipment | Chain mail and a greatsword, both equipped | 2024 |
| Ability bonus source | Each of the four: the background's (the rules base's, ticked first), the race's, both, neither (ADR 017) | — |
| Languages' place | `background`: the rules base's (ENG-56) | — |

2. **The values.** Each is golden F's expected value, for the option named.

What the option changes:

| Option ticked | STR | CON | WIS | STR save | CON save | Athletics | Hit points | Greatsword |
|---|---|---|---|---|---|---|---|---|
| The background's (ticked first) | 17 (+3) | 15 (+2) | 12 (+1) | +5 | +4 | +5 | 13 | +5, 2d6+3 |
| The race's | 15 (+2) | 16 (+3) | 13 (+1) | +4 | +5 | +4 | 14 | +4, 2d6+2 |
| Both | 17 (+3) | 17 (+3) | 13 (+1) | +5 | +5 | +5 | 14 | +5, 2d6+3 |
| Neither | 15 (+2) | 14 (+2) | 12 (+1) | +4 | +4 | +4 | 13 | +4, 2d6+2 |

How: the base scores, plus the Soldier's +2 STR and +1 CON when the background is ticked, plus
the dwarf's +2 CON and the hill dwarf's +1 WIS when the race is ticked. A save or Athletics is the
modifier + 2. Hit points are 10 (d10, the maximum at level 1) + the CON modifier + 1 (the hill
dwarf's Dwarven Toughness, 1 per level). The greatsword hits with the STR modifier + 2 and adds
the STR modifier to 2d6.

The same with every option:

| What | Value | How |
|---|---|---|
| Other scores | DEX 13 (+1), INT 8 (−1), CHA 10 (+0) | No option raises them |
| Other saves | DEX +1, INT −1, WIS +1, CHA +0 | The modifier: the fighter's saves are STR and CON |
| Proficiency bonus | +2 | Level 1 |
| Other skills | Intimidation +2, Perception +3, Survival +3; Insight +1 | The Soldier's Intimidation and the fighter's two: modifier + 2. Insight has no proficiency: golden B's came from the human. |
| Passive Perception | 13 | 10 + 3 |
| AC | 17 | Chain mail 16 (no DEX) + Defense 1 |
| Initiative | +1 | DEX +1. No Alert: golden B's came from the human. |
| Speed | 25 ft | The 2014 dwarf's. STR 15 or 17 meets chain mail's 13, and the dwarf's trait keeps heavy armor from slowing it anyway. |
| Size | Medium | The 2014 dwarf's one size |
| Greatsword | Slashing, mastery Graze | The 2024 greatsword; Graze is one of the fighter's three |
| Critical hit | On 20 only | No feature widens it |
| Second Wind | 2 uses; a short rest gives back 1, a long rest all | The 2024 fighter's table at level 1 |
| Languages | Common, Dwarvish | The 2014 dwarf's. The 2024 Soldier gives none in the fixture (5e-database has no language field, ENG-10 §8), and when one side gives, it applies whatever place is stored (ENG-56). |
| Other proficiencies | Weapons: simple, martial, and battleaxe, handaxe, light hammer, warhammer (the dwarf's); armor: light, medium, heavy, shields; tools: mason's tools, playing cards | The fighter's, the dwarf's traits', the Soldier's |
| Stats and skills used | The 2024 entries (`srd-2024:ability/str`, `srd-2024:skill/athletics`, and so on); languages the 2014 entries, the only ones | ADR 014 item 2: the rules base's copy of a key |
| Choices left | None | — |
| Warnings | 9: one per 2014 entry the character has (the dwarf, its 5 traits, the hill dwarf, Dwarven Toughness), each "of the ruleset 2014, not the character's 2024"; and one that the race and the background both raise abilities. No other. | ADR 005 item 3.3: a mix warns, never blocks; ADR 017 item 4: the bonus warning stays whatever is ticked (ENG-68 gives it) |

## What this changes

| Where | Was | Now |
|---|---|---|
| SPEC §6.7 | Golden tests A to E | Golden F too, with the values above |

## What does not change

- Every value of goldens A to E.
- SPEC.md's text: it is read, not edited; this ADR is the change.
- Golden F's languages are the fixture Soldier's none and the dwarf's two; the import of phase 3
  does not change the fixtures.
