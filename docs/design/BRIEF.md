# Design brief — the screens

**What this file is for:** designing the app's screens in a design tool, one screen at a time,
and keeping what Alina chose.

**How to use it:**
1. Paste the **base block** (Part 1) into the design tool.
2. Then paste **one screen's prompt** (Part 2) or an extra prompt (Part 3).
3. When a design is right, write what you chose into **Part 5**.

**Who owns what:** the features come from SPEC §7 and ADR 005; the navigation from ADR 008; the
colours and fonts from ADR 005 item 7. The base block carries a copy of them so it can be pasted
in one piece. If this file and those ever differ, SPEC §7 and the ADRs win.

---

## Part 1 — The base block

Paste this first, every time.

```text
You are designing screens for "Grimoire" (a working name), an app for tabletop role-playing
games. Phone first. It installs from a link and works with no network.

WHAT THE APP DOES
- A character sheet that computes every number and shows where each number comes from.
- A library of game content (spells, items, monsters, backgrounds and more), with one search.
- Homebrew: people make their own content, and it works exactly like the built-in content.
- For game masters (DMs): campaigns, an initiative tracker, a bestiary, an encounter builder and
  random generators.
- The first game is fifth edition, with the 2014 rules and the 2024 rules.

NAVIGATION (no bottom bar)
- Start page: the game system ("5E compatible"), then two large choices: "Player" and
  "Game master". The Game master side comes later; mark it so.
- Player page: what a player needs before making a character. "My characters" (count, last
  opened); the rulebook as chapters (Species, Classes, Backgrounds, Feats, Spells, Equipment,
  Rules and conditions), each showing its source: 2014, 2024 or "My packs"; Dice; My packs.
  No "create" button here.
- My characters: the list, with "+" in the corner to make a new character. A swipe or "⋯" on a
  character opens Actions: Copy, Link for DM, Transfer, Export, Delete.
- Every page has a back arrow; Settings open from a gear in the top corner.

RULES FOR EVERY SCREEN
- Size: phone 360×800 first. On a tablet: the list on the left, the open card on the right.
- Dark theme by default. Every screen also has a light version.
- Touch targets at least 44×44 px. Main actions sit in the lower half, for one-hand use.
- One pattern everywhere: list → card → edit.
- Tap a number to roll it. Long-press a number to see where it comes from, with an
  "Override by hand" field. A hand-made value is labelled "Manual edit".
- Play mode locks the sheet so only trackers change (hit points, slots, uses). An "Edit" switch
  unlocks it.
- After every change, a small "Undo" message appears at the bottom.
- An unmade choice shows a badge with a count, like [!1], that opens the list of choices.
- Missing content shows a grey chip "Missing: <id>". Never an error page.
- A warning is a small amber note. Nothing is ever blocked by a rule.
- Numbers are large. Modifiers always show a sign: +3, −1, +0.
- Leave room in every label: all text will also appear in Russian, which is often longer.
- Paid features carry a small star mark. Free limits show as a counter, like "2 of 3".
- Units: feet and pounds by default; metres and kilograms by setting.
- Never write "D&D" or "Dungeons & Dragons", never use their logos, never copy the look of the
  official books. The only allowed phrase is "5E compatible".
- Rules terms: "Race" belongs to the 2014 rules, "Species" to the 2024 rules. Show a small
  "2014" or "2024" badge wherever an entry's edition matters.

STYLE
Colours (token: dark / light):
- bg (main background): #1a1e24 / #f8fbff
- bg-outer (bars, pinned panels): #0b0f13 / #eef3fd
- text: #bccad8 / #30353a
- text-muted: #97a1b9 / #697580
- heading: #c14343 / #c14343
- accent: #863737 / #912e2e
- accent-dark: #652121 / #c35c5c
- accent-bright: #c94d4d / #cd2626
- accent-2 (links, second accent): #61afef / #5599d0
- line (dividers, borders): #2f3b4d / #b5c2d8
- text-on-accent (text on accent buttons): #e5ebee in both themes

Where each colour may be used (contrast measured with the WCAG formula):
- Dark: heading (3.3:1) and accent-bright (3.7:1) only for large text and icons.
  accent (2.1:1) never for text on bg; use it as a fill with text-on-accent (6.7:1).
- Light: accent-2 (3.0:1) never for text; use it for icons and fills only.
  text-on-accent on accent-dark (3.5:1) only for large text.
- line is for dividers only, never for text.

Fonts:
- Body text and interface: Inter.
- Headings: one of EB Garamond, Alegreya, Lora, Cormorant Garamond (not chosen yet).
- Feel: a well-kept spellbook. Serif headings, clean sans-serif text, flat surfaces, thin lines,
  no heavy textures behind text.

SAMPLE CHARACTER (use these exact numbers)
Iren, human Fighter, level 1, 2024 rules. Background Soldier. Feats: Savage Attacker, Alert.
Fighting style: Defense. Chain mail, greatsword.
- STR 17 (+3), DEX 13 (+1), CON 15 (+2), INT 8 (−1), WIS 12 (+1), CHA 10 (+0)
- Hit points 12 / 12. AC 17. Initiative +3. Speed 30 ft. Proficiency +2.
- Saves: STR +5 and CON +4 (proficient).
- Skills: Athletics +5, Intimidation +2, Perception +3, Survival +3, Insight +3.
  Passive Perception 13.
- Greatsword: +5 to hit, 2d6+3 slashing, mastery Graze.
- Second Wind: 2 uses.
- Breakdowns: "Athletics +5 = STR +3, proficiency +2". "Initiative +3 = DEX +1, Alert +2".
  "AC 17 = chain mail 16, Defense +1".
For anything not listed here, use placeholder numbers and mark them as samples.
```

---

## Part 2 — The screens

Seventeen screens. Each block is one prompt: paste it after the base block. The mark after each
title says which mode shows it, and what is free or paid (ADR 005 item 2). The navigation is
ADR 008's.

### P1 Start page · both modes

```text
Design P1 "Start". Phone 360×800, dark and light.
Purpose: the person picks the game system and how they use the app.
On screen: the app name; a chip "5E compatible · 2014 and 2024 rules"; two large choices in
the lower half, one under another: "Player" (your characters and your rulebook) and
"Game master" (campaigns, party, encounters), the second marked "Later". A gear in the top
corner opens Settings.
Action: tapping "Player" opens the player page (P17).
One state only.
```

### P17 Player page · player

```text
Design P17 "Player". Phone 360×800, dark and light.
Purpose: what a player needs before making a character.
On screen: a back arrow and the title "Player"; a card "My characters" with portraits,
"2 of 3" and "last opened: Iren"; the rulebook as a table of contents: Species, Classes,
Backgrounds, Feats, Spells, Equipment, Rules and conditions. Each chapter shows its source as a
small badge (2024, 2014, My packs); a switch "Rules base 2014 / 2024" sits on the rulebook's
title row. Under it two tiles: "Dice" and "My packs". No button to make a character here.
Actions: tap "My characters" to open the list (P2); tap a chapter to open it; tap a badge to
choose the chapter's source.
One state only.
```

### P2 Characters list · player · free: 3 characters

```text
Design P2 "Characters". Phone 360×800, dark and light.
Purpose: all the person's characters.
On screen: one card per character with a portrait circle, the name, class and level, a
"2014" or "2024" badge, and a thin hit point bar. A counter "1 of 3" at the top (free limit).
A "+" in the top corner makes a new character. "Import file" as a smaller action.
Actions: tap a card to open the sheet; swipe a card left for Copy, Link for DM, Delete and
"More"; "More" (or "⋯") opens the full Actions list: Copy, Link for DM, Transfer, Export,
Delete (Delete shows "Undo").
States: empty (a short friendly line, "+" and "Import file"); one character (Iren); a card
swiped open; at the limit, "3 of 3": "+" shows a star and opens the paid offer. Existing
characters always open.
```

### P3 Character creation · player

```text
Design P3 "New character", the manual form. Phone 360×800, dark and light.
Purpose: enter a character from paper in about five minutes.
On screen: one scrolling form, in this order:
1. System: "5E compatible" (the only one for now).
2. Rules base: 2014 or 2024 (a two-way switch).
3. Content packs: checkboxes "SRD 2014", "SRD 2024", "My packs". A switch "Mix editions".
4. Name, and a portrait picker.
5. Race (2014) or Species (2024); Background.
6. When editions are mixed: "Ability bonuses come from:" Race or Background (pick one).
7. Classes and levels (add a class with a level).
8. Ability scores: six number fields, any numbers.
9. Equipment: add items.
A bar pinned at the bottom shows the live numbers: AC, hit points, initiative.
Warnings appear inline in amber; nothing blocks "Create".
States: empty form; filled with Iren; a warning shown (for example a mix that may not fit).
```

### P4 Character sheet · player

```text
Design P4 "Character sheet" for Iren. Phone 360×800, dark and light.
Pinned at the top: "Iren · Fighter 1", a "2024" badge, a [!1] choices badge; under it the row
"AC 17 · Init +3 · 30 ft · Prof +2".
Pinned at the bottom, near the thumb: the hit point bar "12 / 12" with
"Damage" and "Heal" buttons; under it the tabs, swiped sideways:
Main · Combat · Spells · Equipment · Features · Notes.
Design the Main tab fully, and the Combat tab as a second frame:
- Main: six ability tiles in one row (modifier large, score small below); the saves as six
  chips; the skills in two columns with a proficiency dot; Passive Perception 13.
- Combat: the greatsword attack row (+5, 2d6+3 slashing, "Graze"); Second Wind with 2 use
  circles; conditions; death saves; concentration.
Other tabs, as short sketches: Spells (slot circles per level, the prepared list, "Cast"),
Equipment (items with worn and attuned toggles, weight, coins cp sp ep gp pp with + and −),
Features (grouped by source: class, species, background, feats; Second Wind's uses with the
label "1 back on a short rest, all on a long rest"), Notes (plain text).
A lock icon in the header shows play mode; the "Edit" switch sits in the tab's menu.
```

### P5 Roll dialog and breakdown · player

```text
Design P5, two bottom sheets over Iren's sheet. Phone 360×800, dark and light.
Sheet 1, "Roll": the formula "d20 + 5 (Athletics)"; switches Advantage and Disadvantage;
situational hints as small chips; a large result with the dice shown; "Roll again".
In a campaign it also has "Send to DM" and "Secret to DM".
Sheet 2, "Where this number comes from": "Athletics +5 = STR +3, proficiency +2", one line per
part, each naming its source; an "Override by hand" field with a note; when overridden, the
number shows a "Manual edit" label.
```

### P6 Damage, healing and rests · player

```text
Design P6, three frames. Phone 360×800, dark and light.
1. "Damage": a large number keypad; "Apply". If the character is concentrating, a follow-up
   asks for a concentration save with a "Roll" button.
2. "Short rest": hit dice to spend, each spend rolls; a summary of what comes back.
3. "Long rest": before confirming, a list of exactly what will be restored (hit points, slots,
   uses); "Confirm" and "Cancel".
Each frame ends with the "Undo" message after applying.
```

### P7 Library and an entry's card · both modes

```text
Design P7 "Library", two frames. Phone 360×800, dark and light.
Frame 1, the library: one search field at the top (finds English and Russian names);
an edition filter 2014 / 2024 / both; sections as a list: Races and Species, Classes,
Backgrounds, Feats, Spells, Equipment, Magic items, Monsters, Conditions, Rules.
Frame 2, a spell's card (for example "Bless", with a "2014" badge): the text with tappable link
chips to other entries; a short mechanics summary; "Used in" (entries that point here); source
and license; buttons "Add to character" and "Make homebrew copy".
States: search with no results; a "Missing: <id>" chip inside a text.
```

### P8 My packs and the homebrew editor · both modes · free, no limits

```text
Design P8, three frames. Phone 360×800, dark and light.
1. "My packs": packs in three labelled groups, never mixed: Built-in, Local, Community.
   Each pack shows its name, license and number of entries. "New pack" and "Import file".
2. A pack's entry editor: a form for one entry (name in English and Russian, type, text,
   numbers); an "Effects" section with an effect builder (target, operation, value).
3. "Before and after": pick a character, see which numbers the entry changes (for example
   "Occultism −1 → +1").
Export shows a short note: the pack is for personal use; sharing text from books is up to the
rights holder.
```

### P9 Dice · both modes · basic dice free, skins paid

```text
Design P9 "Dice". Phone 360×800, dark and light.
On screen: a formula field ("2d6+3"; also accepts "2к6+3"); buttons d4 d6 d8 d10 d12 d20 d100;
a roll area where dice land (3D, with a "Flat dice" setting); the result large; the roll
history below.
A "Skins" row: basic skins free; the owner's skins with a star mark.
States: before the first roll; after a roll; history full.
```

### P10 Settings and the theme editor · both modes

```text
Design P10, two frames. Phone 360×800, dark and light.
Frame 1, "Settings", grouped: Modes (I play / I run games / both); Language; Units (feet or
metres, pounds or kilograms); Dice notation; Theme (Dark, Light, Custom); Content packs;
Backup and restore; AI (off by default, a field for the person's own key); About (license
credits, thanks to ITS Theme, support links); Purchases.
Frame 2, "Theme editor": the colour tokens as a list with colour swatches; a live preview of a
small sheet above; "Import theme", "Export theme". Owner-made themes carry a star mark.
```

### P11 Campaigns and a campaign's page · DM · free: 1 campaign

```text
Design P11, two frames. Phone 360×800, dark and light.
Frame 1, "Campaigns": campaign cards (name, edition badge, number of players, last session).
A counter "1 of 1" (free limit). "New campaign".
Frame 2, a campaign's page: its one edition; the party (each player's name, hit point bar,
conditions); the table link status ("Off", "3 players connected", "Through relay"); "Invite"
(a QR code and a link); the session log; DM notes; images; a backup reminder
("Last backup: 12 days ago").
```

### P12 Initiative tracker · DM · free

```text
Design P12 "Initiative". Phone 360×800, dark and light.
On screen: the round number; the turn order as a list with the current turn highlighted;
each row shows the name, initiative, a hit point bar, AC, condition chips with end timers,
and counters for legendary actions and resistances when a monster has them. Identical monsters
are grouped ("Goblin ×4") and expand.
Actions: a large "Next turn" button in the lower half; "Roll initiative for all monsters";
select several rows to apply damage or healing at once; add a creature mid-fight; "Undo";
a "Player view" toggle that hides monster hit points.
States: before the fight (no initiative yet); in round 2; a creature at 0 hit points.
Use placeholder numbers for monsters.
```

### P13 Bestiary and a monster's card · DM · free

```text
Design P13, two frames. Phone 360×800, dark and light.
Frame 1, "Bestiary": filters (challenge rating, type, size, environment, pack, edition);
rows with the name, challenge rating, type and an edition badge.
Frame 2, a monster's card: portrait; the stat block with tap-to-roll attacks; buttons
"Add to encounter", "Copy and edit", "Reskin" (same numbers, new name and picture).
Use placeholder numbers.
```

### P14 Encounter builder · DM · free

```text
Design P14 "Encounter". Phone 360×800, dark and light.
On screen: the party (number of characters and their levels); the chosen monsters with a
count stepper each; a difficulty meter; "Save encounter" and "Start in tracker".
States: empty; a built encounter. Use placeholder numbers.
```

### P15 Generators · DM · free

```text
Design P15 "Generators", two frames. Phone 360×800, dark and light.
Frame 1: the list of generators: NPC, Monster idea, Location, Plot hook, Merchant, Tavern,
Loot, Names. Each shows which table set it uses (built-in or from a pack).
Frame 2, an NPC result card: lines such as Name, Look, Manner, Voice, Wants, Secret. Each line
has a lock icon. Buttons: "Re-roll" (rolls the unlocked lines) and "Keep" (saves the NPC).
An optional "Fill in details" button marked "AI" appears only when AI is turned on.
```

### P16 A player's view of a campaign · player

```text
Design P16, three frames over Iren's sheet. Phone 360×800, dark and light.
1. A roll request from the DM: "DM asks: Perception" with a large "Roll" button.
2. A gift from the DM: "The DM gives you: Potion of Healing" with "Accept" and "Decline".
3. A turn-order strip at the top of the sheet: "Round 2 · Your turn in 2".
Also show the connection status (connected, through relay, the DM is offline) and a
"Secret to DM" option on rolls.
```

---

## Part 3 — Extra prompts

### X1 Heading font sampler

```text
Show the same character sheet header ("Iren · Fighter 1", the hit point bar, the row
"AC 17 · Init +3 · 30 ft · Prof +2") four times, one under another, with the headings in
EB Garamond, Alegreya, Lora and Cormorant Garamond. Body text in Inter in all four.
Dark theme. Label each version with its font name.
```

### X2 App map

```text
Draw a map of the whole app: the start page, the player page, and under each the screens it
opens: P1 to P17 from this brief. Mark which screens belong to the Game master side.
```

---

## Part 4 — Notes for designing

- Mockup images stay out of the repository, like screenshots. Only the choice is written down,
  as text, in Part 5.
- Every visible word becomes a translation key when the screen is built (CLAUDE.md, "The
  interface"). A design can use any wording; the ticket that builds the screen sets the keys.
- The screens not listed here (conditions, spell slots in detail, level-up, PDF export) are
  designed in the phase that builds them.

---

## Part 5 — What Alina chose

| Item | Chosen | Link or notes | Date |
|---|---|---|---|
| Heading font (X1) | — | — | — |
| P1 Start page | — | — | — |
| P2 Characters list | — | — | — |
| P3 Character creation | — | — | — |
| P4 Character sheet | V3 "Thumb": name and the stats row pinned at the top; hit points, "Damage", "Heal" and the tabs pinned at the bottom; Main tab as in the P4 prompt | [Design canvas](https://claude.ai/artifact/RatMY6p7o1XaSFsSew2qSg), page "P4 · 3 palettes", column V3 | 2026-09-30 |
| P5 Roll dialog and breakdown | — | — | — |
| P6 Damage, healing and rests | — | — | — |
| P7 Library and an entry's card | — | — | — |
| P8 My packs and the homebrew editor | — | — | — |
| P9 Dice | — | — | — |
| P10 Settings and the theme editor | — | — | — |
| P11 Campaigns and a campaign's page | — | — | — |
| P12 Initiative tracker | — | — | — |
| P13 Bestiary and a monster's card | — | — | — |
| P14 Encounter builder | — | — | — |
| P15 Generators | — | — | — |
| P16 A player's view of a campaign | — | — | — |
| Base colours | Not chosen. The base theme is plain and calm; personality comes from paid skins. Rejected: Lavender (3D52A0 · 7091E6 · 8697C4 · ADBBDA · EDE8F5) and Cream (F7F5E6 · 333A56 · 52658F · E8E8E8), which read as a clinic or government app. Sky (E2F0F9 · B0DDE4 · 286FB4 · FFFFFF · DF4C73) is still open | [Design canvas](https://claude.ai/artifact/RatMY6p7o1XaSFsSew2qSg), page "P4 · 3 palettes" | 2026-09-30 |
| Overall design | The navigation of ADR 008: no bottom bar; a start page (Player or Game master); a player page with what a player needs before making a character; My characters with "+" in the corner. The five home-page options with a bottom bar are rejected. The look is still being drawn | [Design canvas](https://claude.ai/artifact/RatMY6p7o1XaSFsSew2qSg), page "Our design v1" | 2026-09-30 |
| P17 Player page | — | — | — |
| Future skins | Six retro looks are kept as ideas for optional paid skins: Win95 shareware, 16-bit RPG menu, green-screen terminal, parchment overload, wood and leather, early homepage. Not the base design | [Design canvas](https://claude.ai/artifact/RatMY6p7o1XaSFsSew2qSg), page "Retro and weird" | 2026-09-30 |
