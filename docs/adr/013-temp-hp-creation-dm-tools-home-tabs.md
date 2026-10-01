# ADR 013 — Temporary hit points, creation, DM tools and the home tabs

**Status:** accepted · **Date:** 2026-10-01 · **Decided by:** The owner

## Context

On 2026-10-01 the owner reviewed the "Our design v3" mockups and gave the requirements below,
with three screenshots of a website's ability score calculator as the reference for item 8.
The same day the owner sent four screenshots of the same website's spell page as the reference
for item 6, and ten screenshots of its DM screen reference for item 18. From the references,
only the idea and the order of the parts are taken: no text, no images, no styling. Each item
names the phase that builds it (ADR 007 item 4).

## Decision

### The sheet

1. **Temporary hit points have their own colour.** On the sheet and on the Damage and Heal
   number pad, temporary hit points show as a number in their own colour next to the hit points
   (for example "12 / 12 +5"), and as a part of the hit point bar in the same colour. The colour
   is set with the base colours (BRIEF Part 5). (Phase 2.)
2. **The level is the class line; level-up is in "⋯".** The class and its level next to the
   name ("Fighter 1") is the level shown on the sheet; there is no separate level plate. In the
   DM's change review, a level change shows on that line: "Fighter 1 → 2" (item 13). Level up
   is the first entry of the sheet's "⋯" menu (ADR 008 item 4). The owner chose this on
   2026-10-01, over the six level plates drawn on the design canvas. (Phase 2; the review with
   the table link.)
3. **Level-up and approval.** Outside a campaign, a level-up applies at once; nobody approves
   it. In a campaign, it waits for the DM's approval. ADR 010 item 7 otherwise stays: XP or
   milestone, and the DM can level characters. (Phase 4; the campaign part with the table link.)

### Spells in the library

4. **Who can use a spell, per ruleset.** The spell's window (ADR 012 item 4) lists every class
   and subclass that has the spell, in each ruleset, each with its source: for example
   "Wizard (2014)", "Wizard (2024)". (Phase 3.)
5. **One entry per ruleset.** A spell that reads the same in 2014 and 2024 is still two
   entries, one marked 2014 and one marked 2024, each with its own id. (Phase 3.)
6. **A spell's description, top to bottom**, in the window of ADR 012 and in "See full
   description" (ADR 011):
   - the name, and the other language's name under it; buttons: share, bookmark (item 17),
     close; the homebrew copy and edit of ADR 012 sit in a "⋯" menu;
   - **a small top part**: the type line (for example "Cantrip, Evocation") with the source,
     and the properties (casting time, range, duration, components) in a compact box. It is kept
     small so the text starts high on the screen;
   - the text: dice are tappable and roll; terms such as conditions are tappable links;
   - the classes per ruleset (item 4).

   There is no "Damage dice" list by level: the text already says how a spell grows. On the
   sheet, a spell's dice follow the character: after a level-up, the spell shows the dice for
   the new level by itself (for example a cantrip's damage at level 5).

### Making a character

7. **A turning arrow opens and closes a step.** The control is an arrow tip (a chevron) in a
   circle, drawn as an outline in the text colour: it points down when the step is closed and
   up when it is open, and turns between the two with a short animation when tapped. It is an
   icon, a small vector drawing, so it takes the theme's colours and can move; it is not an
   emoji and not a picture. The owner's two pictures (a chevron in a circle, down and up) show
   the shape only; they are not copied. The same control opens and closes everything else that
   opens and closes, the descriptions of ADR 011 included. This replaces the arrow of ADR 010
   item 11. (Phase 4; the descriptions in phase 2.)
8. **The roll calculator.** After the person picks an ability score method (ADR 010 item 12),
   the step shows, top to bottom:
   - the total of the rolled scores;
   - a "Roll" button, which reads "Reroll" after the first roll;
   - six rolled scores, each with a "Choose ability" picker;
   - a table with one column per ability: the rolled score, the bonuses, the final score, the
     modifier.

   "Apply to abilities" turns on only when all six scores are rolled by the method's rules and
   each one is placed on an ability. The calculator is a step of making a character. Its columns
   come from the system's abilities, never from six names in code (D3). (Phase 4.)
9. **Optional feats.** A rules option sets which feats a character may take: only its own
   ruleset's; also the other ruleset's optional ones (for example a 2024 origin feat in a 2014
   game); or every feat, for homebrew. Picking a feat opens the library's Feats list (ADR 012)
   with filters, such as origin feats, feats of level 4 and up, and species feats. (Phase 4.)
10. **Ability bonuses from two rulesets.** When options from different rulesets both raise
   ability scores (for example a 2014 race with +2 and +1, and a 2024 background), a window shows
   the conflict, with a checkbox for each source: race and background.
   - Outside a campaign, the person ticks either one or both. It is a warning, never a block.
   - In a campaign, the DM decides whether one or both may be used.

   This replaces "pick one" in BRIEF P3. (Phase 4; the DM's setting with the table link.)

### The DM

11. **The DM can do everything a player can, and more.** The DM's side has every player
    feature, plus the DM's rights. (The DM tools' phase.)
12. **The DM can edit a change before approving it.** In the review (ADR 010 item 13), each
    value the player sent can be edited, for example "+24 gold" to "+34 gold". The DM's value
    replaces the player's. (The table link's phase.)
13. **A tab of characters waiting for approval.** The DM's side has a tab that lists every
    character with changes waiting, and shows their count as a notification. (The table link's
    phase.)
14. **Actors.** The DM creates an actor and gives it a type: PC, NPC, enemy, or a type the DM
    names. The idea comes from Foundry VTT's actors. (The DM tools' phase.)

### Start and the home page

15. **Choosing the system.** Once the app has a second system (ADR 004 item 6), it opens with
    a preview: the app's name and the list of game systems. The person picks one. Systems never
    mix: a fifth-edition character never takes a Daggerheart or Pathfinder entry (ADR 004
    item 3). While fifth edition is the only system, the start page of ADR 008 item 2 stays.
16. **Player or DM.** Next come two large squares with icons: Player and DM. (Phase 2.)
17. **The home page's sections.** Then a page with these sections (ADR 008 item 1: no bottom
    bar). They replace the parts of ADR 008 item 3. (Phase 2 for the page; each section fills as
    its phase lands.)
    - **Characters** (ADR 008 item 4).
    - **Sources**: the free, openly licensed 2014 and 2024 rules (SRD 5.1 and SRD 5.2.1), built
      in from the first start, so a person has their content at once; and the person's packs
      (ADR 010 items 1 and 2). (Phase 3; packs in phase 5.)
    - **Library**, as ADR 012. (Phase 3.)
    - **Dice roll**: an animation that looks like a real roll on a table, in the spirit of the
      "Dice So Nice!" module for Foundry VTT. No code or art is taken from it. ADR 009 item 10's
      fairness test stays. (The dice phase.)
    - **Quick rules**: a cheat sheet for players and DMs (item 18). (Phase 3.)
    - **Bookmarks**: entries the person marks to keep at hand, such as spells, armor and magic
      items. Bookmarks stay on the device. (Phase 3.)

    The DM's home page has the same sections, plus the DM's: approvals (item 13), actors (item
    14) and campaigns (BRIEF P11).
18. **Quick rules hold all the rules.** Every rule of the open rulebooks (SRD 5.1 and
    SRD 5.2.1), in English first; Russian comes with its own phase. Top to bottom:
    - the title and a search field;
    - topics as cards, for example Move, Action, Bonus action, Reaction, Combat, Other actions,
      Environment, Damage and attack, Hit points, death and rest, Abilities and skills, Origins,
      Conditions and diseases, Active class features, Spells, Multiclassing;
    - a topic opens in a floating window: its name, share, bookmark, close; a short
      introduction; its rules as cards, each with an icon, its name and its source;
    - a rule opens in a floating window over the topic: its name, bookmark, close; a small box
      with its topic (a link back) and its source; a one-line summary; the full text.
      Everything behind the open window, the topic window included, is dimmed.

    In every text of the app (rules, spells, features, items), a word whose entry or rule
    exists is a link, and tapping it opens that entry in a floating window: "concentration" in a
    spell opens the Concentration rule. A word with no target stays plain text. (Phase 3.)

## Still open

- The level-up screenshot the owner named; it did not arrive.
- Whether "Reroll" in the roll calculator is unlimited.

## What this changes

| Where | Was | Now |
|---|---|---|
| ADR 008 items 2 and 3, BRIEF P1 and P17 | Start page; a player page with My characters, the rulebook, Dice, My packs | A system preview once there are two systems; Player and DM squares; six sections (items 15–17) |
| ADR 010 item 7 | A level-up button on the sheet; in a campaign, the DM decides how level-up works | Level up in the sheet's "⋯" menu (item 2); outside a campaign, no approval; in a campaign, the DM approves (item 3) |
| ADR 010 item 11 | An arrow | A chevron in a circle that turns (item 7) |
| ADR 010 item 13 | Approve with Yes or No | The DM can edit a value first (item 12) |
| ADR 012 item 4 | Classes and subclasses with their sources; share, homebrew copy, edit, close; "Damage dice" by level | Also per ruleset (item 4); a small top part; share, bookmark, close, and "⋯"; no "Damage dice" list (item 6) |
| BRIEF P3 item 6 | Ability bonuses from race or background, pick one | A window with a checkbox for each (item 10) |
| ADR 011 | Full descriptions | Terms inside them are links (item 18) |
| BRIEF P1, P3, P4, P6, P7, P9, P11, P17 | — | Follow this ADR |
| `BACKLOG.md` | — | Notes each item under its phase |

## What does not change

- ADR 008 item 1 (no bottom bar), and ADRs 009–012 except where the table above says so.
- Only openly licensed text or the person's own packs is shown (`CLAUDE.md`, "Content and
  licensing"). On screen, fifth edition is "5E compatible"; another system's on-screen name is
  checked against its publisher's trademark policy first.
- Manual overrides always win (SPEC §6.1 step 7). Formulas and score methods never run code
  (SPEC §5.6).
- The golden tests, and every hard invariant in `CLAUDE.md`.
