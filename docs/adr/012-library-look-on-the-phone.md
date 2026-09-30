# ADR 012 — The library's look on the phone

**Status:** accepted · **Date:** 2026-09-30 · **Decided by:** The owner

## Context

On 2026-09-30 the owner showed two references for the library of ADR 010 item 3: a tabletop app
whose spell list opens an entry in a floating window, with a "Damage dice" list that opens and
closes; and a website's spell page, whose overall look they like. "Look" means the layout and
the parts, not the colours or fonts. The website is laid out for a wide browser; the app needs
the same idea on a phone. Nothing is copied from either: no text, no images, no styling.

## Decision

1. **An entry opens in a floating window over the list**, not on a new page. The list stays
   underneath; closing the window returns to the same place in the list.
2. **The list page, top to bottom:** the topic's title; a search field; a row of buttons:
   Filter, Sources, Export; Grouping and Sorting choices; a legend that explains the markers.
3. **The list:** grouped (for spells, by level: Cantrips, Level 1, …), each group under its own
   heading. Each entry is a card with: an icon for its kind (for spells, the school); its name;
   its source badge (ADR 009 item 12); a second line (for spells, the school); and markers (for
   spells, V S M, concentration, ritual).
4. **The floating window, top to bottom:**
   - the name, and the name in the other language when the entry has it (the entry's two names,
     `name.en` and `name.ru`);
   - the source badges; buttons to share, make a homebrew copy, edit, and close;
   - a line with its type (for a spell: "Cantrip, Evocation");
   - a box with its properties (for a spell: casting time, range, components, duration);
   - the full text (ADR 011), where terms, conditions and other entries are tappable links, and
     dice such as "1d6" are tappable and roll;
   - "At higher levels", or the cantrip upgrade;
   - "Damage dice": a list by level that opens and closes, for example "Level 5: 2d8 fire";
   - who can use it (for a spell: classes and subclasses), each with its source.
5. The same layout serves every topic; each topic names its own markers, properties and groups.

Phase 3 builds it with the library.

## What this changes

| Where | Was | Now |
|---|---|---|
| ADR 010 item 3 | Tapping an entry opens all of its details | They open in a floating window over the list (item 1) |
| BRIEF P7 | A spell's card | Items 1–5 |
| `BACKLOG.md` | — | Notes it for phase 3 |

## What does not change

- ADRs 008–011.
- Only openly licensed text or the person's own packs is shown (`CLAUDE.md`, "Content and
  licensing"). The website is not a source of text; `CLAUDE.md` allows it only as a reference for
  Russian terms.
- The golden tests, and every hard invariant in `CLAUDE.md`.
