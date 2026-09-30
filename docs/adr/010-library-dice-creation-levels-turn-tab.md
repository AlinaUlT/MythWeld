# ADR 010 — Library, dice, creation, levels, the Turn tab, spells and DM review

**Status:** accepted · **Date:** 2026-09-30 · **Decided by:** The owner

## Context

After the ADR 009 mockups (the design canvas, page "Our design v2"), the owner added more
requirements on 2026-09-30. As with ADR 009, they are written down once here, so she does not
have to repeat them. Each item names the phase that builds it (ADR 007 item 4).

## Decision

### The player page and the library

1. **Adding packs.** "Books in use" has a "⋯" menu that adds packs: downloaded ones, imported
   files, and the person's own. Imports pass the checks of ADR 003. (Phase 5.)
2. **All sources.** The player page links to a list of every book and pack on the device, with
   its license and whether it is in use. (Phase 3 for books; phase 5 for packs.)
3. **One library page.** On top, the person picks a topic: Armor, Backgrounds, Classes,
   Encounter templates, Feats, Items, Monsters, Species, Spells, Weapons. Below is that topic's
   list, each entry with its source (ADR 009 item 12). Tapping an entry opens all of its details
   the way a rulebook shows them: a class with everything about it, a spell with every field,
   and the book and source it comes from. Encounter templates come ready-made and grow with
   custom and imported packs. The text shown is openly licensed text or the person's own packs
   (`CLAUDE.md`, "Content and licensing"). (Phase 3; encounter templates with the DM tools.)

### Dice

4. **Custom dice.** The dice panel has an edit mode that adds dice with any number of faces.
   (Phase 2.)
5. **Any number of dice.** One roll can hold any count of dice, for example 37d6. (Phase 2.)

### The sheet

6. **Damage and Heal take a number.** Tapping either opens a number pad; the person types the
   amount. (Phase 2; BRIEF P6.)
7. **Level up.** A level-up button sits on the sheet. Progress is by experience points or by
   milestone, chosen per character. In a campaign the DM decides: a player's level-up waits for
   approval, or only the DM levels characters. (Phase 4; the campaign part with the table link.)
8. **The Turn tab.** A tab that lists, in short, everything the character can do, grouped by
   when: action, bonus action, reaction, once per turn, always on, limited uses. It is a
   reminder of the options, for example Second Wind or Savage Attacker. It is built from the
   character's features; nothing is typed twice. (Phase 2; it fills out as phase 3 adds
   content.)
9. **Spell slots as a grid.** One column per spell level, circles two per row. The grid follows
   the character's actual slots, a single higher-level slot included. (Phase 2.)
10. **Casting without a slot.** Casting offers "Don't use a spell slot". Spells a feature grants
    join the spell list by themselves, marked with their source and their limit, for example
    "1/LR", and "no spell slot" next to the name. (Phase 2 for the display; the grants arrive
    with phases 3 and 5.)

### Making a character

11. **Steps open and close.** Each creation step has an arrow: down shows what was chosen, up
    hides it. "Change" stays. (Phase 4.)
12. **Ability score methods are data.** Standard array, point buy, 4d6, and custom methods. A
    method is described by: dice per stat, reroll rules, what is dropped, a shared bonus roll, a
    cap, or a pool the scores are taken from. Methods never run code (SPEC §5.6). The owner's
    examples:
    1. Roll 4d6 for each of the six stats. If dice show 1, one of those 1s can be rerolled,
       once, and the new result must be kept: 3, 4, 1, 1 lets one of the two 1s be rerolled.
    2. Roll 1d4 once; that is the bonus. Roll 3d6 for each stat and add the bonus. No stat goes
       above 18.
    3. Roll 8d20. Remove the highest and the lowest. The six that are left are the scores.

    (Phase 4, with house rules, SPEC §8.4.)

### A campaign

13. **Several changes, one review.** When a player sends several changes, the DM sees them
    together: the character's name with an edit icon, one line per change ("HP 6 → 12",
    "+24 gold, +12 silver", "added spell …"), then "Approve changes?" with Yes and No. (The table
    link's phase, with ADR 009 item 13.)

## Still open

- Method 1: after the reroll, are all four dice added, or is the lowest one dropped?
- Method 2: one 1d4 for all six stats, as written, or one 1d4 per stat?
- Method 3: are the six scores placed freely on the abilities, or in the order rolled?

## What this changes

| Where | Was | Now |
|---|---|---|
| SPEC §7.3 | The library's sections as a list | A topic picker, full entries with their source (item 3) |
| SPEC §7.4 | Creation and level-up wizards | Steps that open and close; ability score methods as data; XP or milestone (items 7, 11, 12) |
| SPEC §7.2, ADR 009 item 3 | The sheet's tabs | Adds the Turn tab (item 8) |
| ADR 009 item 13 | Approval of each change | Changes reviewed together (item 13) |
| BRIEF P3, P4, P6, P7, P9, P11, P17 | — | Follow this ADR |
| `BACKLOG.md` | — | Notes each item under its phase |

## What does not change

- D1–D11. Formulas and score methods never run code (SPEC §5.6).
- Manual overrides always win (SPEC §6.1 step 7).
- ADR 008's navigation, and ADR 009.
- The golden tests, and every hard invariant in `CLAUDE.md`.
