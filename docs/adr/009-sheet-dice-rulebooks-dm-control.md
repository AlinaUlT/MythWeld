# ADR 009 — The sheet, dice, rulebooks, custom content and DM control

**Status:** accepted · **Date:** 2026-09-30 · **Decided by:** The owner

## Context

While reviewing the mockups of ADR 008 on 2026-09-30, the owner listed what the sheet, the dice,
the rulebook and a campaign must do. Some items are design, some are product scope, some shape
the data. She asked that all of them be written down once, so she does not have to repeat them.
This ADR is that record. Each item names the phase that builds it; placing an item in a phase is
ordering work (ADR 007 item 4).

## Decision

### The sheet

1. **Dice on the sheet.** A dice button on the sheet opens a dice panel that covers at most half
   of the screen. The sheet stays visible above it. (Phase 2.)
2. **Features by source.** Features are grouped under the name of what gave them: the species
   ("Human"), the class ("Fighter") with its subclass named on the line below, the background,
   the feats. Each feature shows its description, its uses and its actions. (Phase 2.)
3. **About is visible.** Background, alignment, languages, and armor, weapon and tool
   proficiencies have their own tab next to Spells, Gear and Features, not a hidden menu. Money
   sits in Gear, with the inventory. (Phase 2.)
4. **Spellcasting at a glance.** For a spellcaster, the spellcasting ability, the spell save DC
   and the spell attack bonus sit together: at the top of the Spells tab and in the sheet's
   header row. (Phase 2.)
5. **Inspiration.** A tracker drawn as eight-pointed stars. Its maximum is set by the DM; the
   default is 3. `[ПРОВЕРИТЬ]` The SRD's inspiration rule is checked when this is built: if the
   SRD allows fewer, the default of 3 is a house setting and the ruleset default is shown next to
   it. (Phase 2; the DM's control comes with item 13.)
6. **Portrait and token.** The person adds an image of the character. The app makes a token from
   it: the image in a simple round frame. (Phase 2, with the images of ADR 005 item 10.)

### Edit mode

7. **Custom things anywhere.** Edit mode adds custom armor, weapons and items, and companions: a
   familiar, a pet, a mount, each with its own small stat block. (Phase 2 for free-text entries;
   phase 5 for entries with effects.)
8. **Custom sections.** Edit mode adds sections next to the built-in tabs: Mounts, Pets,
   Familiars, Notes, or any named list. (Phase 2.)
9. **Custom stats.** Edit mode, or a homebrew pack, adds a new stat whose score is a formula
   over other stats. It then works like a built-in one: a score, a modifier, rolls, a breakdown,
   and a field for its use. This is D3 and SPEC §6 applied: a custom stat is data, like `san`.
   (Phase 5.)

   the owner's example, **Vitality**: score = 8 + STR modifier + DEX modifier + CON modifier. For
   Iren: 8 + 3 + 1 + 2 = 14, modifier +2. Its rule: it can be added as a bonus to any check,
   save or attack roll, "equal to the proficiency bonus".

### Dice

10. **An honest roll that looks real.** The throw is animated to look and behave like real dice.
    Every face is equally likely; the ticket that builds it proves this with a statistical test.
    How the animation and the fair result fit together is a technical choice of that ticket.
    (The dice phase, with the dice of ADR 005 item 11.)
11. **Custom roll modifiers.** Before a roll, the person can add modifiers of their own, such as
    +2 or +1d4. They show in the roll's breakdown. (The dice phase.)

### The rulebook

12. **Several books at once, sources always shown.** The person turns on several rulebooks at
    the same time, and any homebrew packs they want next to them. Every entry, wherever it is
    listed, shows the book or pack it comes from, so entries of different sources never look
    alike. (Phase 3 for the books; phase 5 for the person's packs.)

### A character in a campaign

13. **DM control through the table link** (ADR 005 item 5; built with the table link's phase):
    1. Outside a campaign, the person changes everything on their own character.
    2. Linking a character to a DM's campaign makes a campaign copy. The person's own character
       stays separate from it.
    3. In the campaign copy, the DM can change homebrew content and custom sections, and sees
       every change the player makes.
    4. Important changes wait for the DM's approval before they apply: ability scores and other
       stats, spell slots, short and long rests. The inventory, money included, stays free to
       change. The final list is set when that phase opens.

## Still open

- Vitality's "equal to the proficiency bonus": whether that is the size of the bonus, or how
  many times it can be used, and when the uses come back.
- Whether the DM's approval list is the same in every campaign or set per campaign.
- Everything ADR 008 lists as open.

## What this changes

| Where | Was | Now |
|---|---|---|
| SPEC §7.2 | Six tabs: Main, Combat, Spells, Equipment, Features, Notes | Adds an About tab (item 3) and custom sections (item 8); features grouped by source (item 2) |
| SPEC §5 data model | No custom sections, no campaign copy | Custom sections (item 8); a campaign copy with pending changes (item 13); each gets its migration in its phase (SPEC §5.8) |
| ADR 005 item 5 | The table link shares the campaign | Adds the campaign copy, the DM's changes, and approval of important changes (item 13) |
| ADR 005 item 11 | Skins change looks only; a "flat dice" setting | Adds the realistic, fair animation and custom modifiers (items 10, 11) |
| BRIEF Part 1, P4, P17 | — | Follow items 1–6, 8 and 12 |
| `BACKLOG.md` | — | Notes each item under the phase that builds it |

## What does not change

- D1–D11. A custom stat is already data (D3); formulas never run code (SPEC §5.6).
- Manual overrides always win (SPEC §6.1 step 7). The DM's approval decides whether a player's
  change applies in the campaign copy; it does not replace the override rule.
- ADR 008's navigation, and P4 V3's layout.
- The golden tests, and every hard invariant in `CLAUDE.md`.
