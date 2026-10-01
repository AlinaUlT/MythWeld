# ADR 014 — What the design decisions change in the engine and the data

**Status:** accepted · **Date:** 2026-10-01 · **Decided by:** technical choices under ADR 002;
item 1 applies the owner's ADR 013 item 10

## Context

ADRs 008–013 record the owner's design decisions of 2026-09-30 and 2026-10-01. On 2026-10-01 the
owner asked what they change in the plan and in the code still to be written, and made this a
priority. Each ADR already names the phase that builds each item; this ADR lists what reaches
further down: the schemas, the character document and the engine rows of phase 1, which come
next. Each item names the rows it changes. The rows are not re-cut; their notes in `BACKLOG.md`
point here.

## Decision

### A conflict, settled by the owner's newer decision

1. **Ability bonuses from two rulesets: race, background, or both.** ADR 005 item 3.4 said a 2014
   race with a 2024 background gives ability increases from one of the two, never both. ADR 013
   item 10 (the owner, 2026-10-01) says: outside a campaign the person ticks either or both, with
   a warning; in a campaign the DM decides. ADR 013 item 10 wins for this case. The rest of
   ADR 005 item 3.4 stays: other bonuses of one kind given in two places count once.
   - **ENG-35:** the choice takes `race`, `background` or `both`; the default stays the rules
     base's source; `both` gives a warning, never a block. A campaign setting that limits the
     choice comes with the table link.
   - **ENG-37 (golden F):** the fixture states which of the three it uses. Its values are still
     the owner's (SPEC §6.7).

### The schemas (ENG-05, ENG-24, ENG-25, ENG-32)

2. **A key is unique within a ruleset, not across both.** With mixing on, both SRD packs are
   active, and the same entry has the same `key` in each (ADR 005 item 5, ADR 013 item 5: two
   entries, two ids). ENG-25 reports a duplicate `key` only between packs of the same ruleset.
   Across rulesets, a formula path resolves to the entry the character has; where the character
   has neither, the rules base's entry wins. The reason: SPEC §5.1 makes a key unique among a
   character's active packs, which a mixed character could never satisfy.
3. **The other edition's copy is found by type and key.** The spell window's "also its own entry"
   and its classes per ruleset (ADR 013 items 4 and 5) come from the content index: same `type`,
   same `key`, other ruleset. No new field. A homebrew copy keeps `meta.variantOf` (SPEC §5.2).
   ENG-25 builds the index this way.
4. **Names and aliases are indexed for links.** Every text links a word whose entry exists
   (ADR 013 item 18). The content index keeps, per language, each entry's `name` and `aliases`
   (SPEC §5.2 already has `aliases`). ENG-25 builds it; phase 3 uses it to find the words. A word
   with no entry stays plain text.
5. **A rule entry has a topic.** Quick rules group the rules by topic (ADR 013 item 18). The
   `rule` type of SPEC §5.2 takes a `topic` key, and an optional icon key. ENG-32 adds it to the
   fifth-edition types; the topics are that system's.
6. **A spell's dice come from its scaling field.** The sheet shows a spell's dice for the
   character's level and updates them after a level-up (ADR 013 item 6). SPEC §5.3's
   `scaling` (`cantrip` or `slot`, with a formula) carries it; ENG-32 keeps it required wherever
   a spell's damage grows. ENG-16 computes a spell's current dice like a weapon's, with a
   breakdown; which level a cantrip reads is `[ПРОВЕРИТЬ]` in that ticket's §8.
7. **A granted spell has its own uses and may need no slot.** ADR 010 item 10's "1/LR, no spell
   slot" is ENG-32's `spell` grant with ENG-04's uses. ENG-20's cast action takes "use a slot:
   no".

### The character document (ENG-06, ENG-33)

8. **Fields the design needs, added now.** Each one is cheaper now than as a migration later
   (ADR 002 item 2). The names are set in the tickets.

   | Need | Where | Shape | From |
   |---|---|---|---|
   | What kind of actor this is | ENG-06 (core) | a key; default PC; the list is data, the DM adds kinds | ADR 013 item 14 |
   | XP or milestone | ENG-33 | the mode, and the XP total | ADR 010 item 7 |
   | Inspiration as a count | ENG-33 | a number (SPEC §5.8 has a yes/no) and a maximum from the house rules | ADR 009 item 5 |
   | The ability score method | ENG-33 | the method's key and the dice it rolled (SPEC §5.8 has four fixed names) | ADR 010 item 12, ADR 013 item 8 |
   | The ability bonus source | ENG-33 | `race`, `background` or `both` | item 1 |
   | Which feats may be taken | ENG-33 (house rules) | own ruleset, also the other's optional ones, or all | ADR 013 item 9 |

   Inspiration's default maximum is the owner's 3 (ADR 009 item 5); the SRD text is checked in
   ENG-19's §8 and the result shown to the owner, as ADR 009 already says.
9. **Left to later phases, with a migration then.** The campaign copy and its link (ADR 009
   item 13), the DM's approval settings, and companions with their own sheets. Their shape depends
   on the table link, which is not designed yet.

### Changes, history and approval (ENG-30, ENG-36)

10. **Every change is a log entry that can wait.** The change history in "⋯", undo, the DM's
    grouped review, the DM's edit before approving ("+24 gold" to "+34 gold") and a level-up
    waiting in a campaign (ADR 010 item 13, ADR 013 items 2, 3, 12) all need one shape. An action
    returns a log entry with: who, when, a label, and the changed paths with their values before
    and after. Applying an entry is a pure function; so is reversing it; an entry that is not
    applied yet is a pending change, and editing its "after" value is how the DM corrects it.
    ENG-30 defines it for tracker actions; ENG-36 uses it for level-up. Storing and sending
    entries belong to phase 2 and the table link.

### Dice (ENG-08, ENG-26)

11. **Any dice, any count, fair.** ADR 010 items 4–5 and ADR 009 item 10. ENG-08 accepts any
    whole number of faces from 2 to 1000 and from 1 to 999 dice in one term (for example 37d6
    or 3d7); beyond that it refuses with a message, never a crash. Every face is equally likely:
    random numbers come from the platform's secure source, without the bias of a remainder, and a
    statistical test proves it. The limits are a technical choice; raising them is one number.
12. **A roll records its extra modifiers.** ADR 009 item 11's custom roll modifiers each appear
    in ENG-26's roll result and its breakdown, with their labels.

### Later phases

13. **Phase 3 grows.** Quick rules hold every SRD rule (ADR 013 item 18): the import brings in
    the rules chapters of both SRDs as `rule` entries with topics, not only the game entities.
    Bookmarks are a table on the device, outside any character.
14. **Nothing else in phase 1 changes.** The temporary hit point colour, the level on the class
    line, the "⋯" menu, the turning arrow, the screens and the system picker are phase 2 and later
    screens over data that phase 1 already plans (SPEC §5.8 has temporary hit points; ADR 004
    already keeps systems apart).

## What this changes

| Where | Was | Now |
|---|---|---|
| ADR 005 item 3.4 | Ability increases from race or background, never both | Race, background or both (item 1) |
| SPEC §5.1 | A key unique among a character's active packs | Unique within a ruleset; across rulesets, the character's entry, then the rules base's (item 2) |
| SPEC §5.2 | `rule` has no fields of its own | A topic, an optional icon (item 5) |
| SPEC §5.8 | `inspiration` yes/no; `abilities.method` four names; no actor kind, no XP | A count with a maximum; a method key with its rolls; a kind; XP or milestone; feats allowed (item 8) |
| SPEC §6.4 | Each log entry can undo its action | Each log entry also has its author, time and before/after values, and may wait unapplied (item 10) |
| SPEC §6.5 | `d` and `к` | Also any faces 2–1000, 1–999 dice, a fairness test (item 11) |
| `BACKLOG.md` | — | The notes of ENG-06, 08, 16, 19, 20, 25, 26, 30, 32, 33, 35, 36, 37 point here; phase 3's note grows |

## What does not change

- The phase 1 rows, their order and their sizes.
- Every hard invariant in `CLAUDE.md`: formulas and score methods never run code; manual
  overrides win; missing is not broken; ids are stable.
- The golden tests A–E and their values.
- ADR 004: systems never mix, and the core names no game.
