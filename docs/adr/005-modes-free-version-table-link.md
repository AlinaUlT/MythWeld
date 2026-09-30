# ADR 005 — Modes, the free version, mixed editions, the table link, AI and themes

**Status:** accepted · **Date:** 2026-09-29 · **Decided by:** Alina

## Context

Before phase 1, Alina set out what the app does around the sheet:
- a player mode and a DM mode;
- what is free and what is paid;
- mixing the 2014 and 2024 editions on one character;
- sharing a campaign without a cloud;
- dice, generators, AI, PDF, images and themes.

The options were discussed in the chat on 2026-09-29, and she chose among them. The facts the
choices rest on are listed under "Sources" at the end.

## Decision

### 1. Two modes in one app

1. On first start the app asks: "I play", "I run games", or both. Settings change it at any time.
   Both modes can be on at once.
2. DM mode adds one tab to the bottom bar, the later tab SPEC §7.1 plans. It holds campaigns, the
   initiative tracker, encounters, generators and DM notes. Its label is an i18n key, set in its
   ticket.
3. The DM tools on one device are free and work offline.

### 2. Free, and paid once

The rule: **playing at the table is free.** The paid version is **one payment, never a
subscription.** It adds looks, extras, and more of what the free version limits.

| Free | Paid, one payment |
|---|---|
| 3 characters | Unlimited characters |
| 1 campaign the person runs as DM, with the table link (item 5) | Unlimited campaigns |
| Every computed number, the library, the homebrew editor, packs, import, export and backup; no limit on homebrew or packs | Dice skins made by the owner |
| Bestiary, initiative tracker, generators, DM notes | Themes made by the owner |
| Images on the device, and shared inside a campaign (item 10) | PDF extras: the person's own fonts and images (item 12) |
| PDF: our own template, and filling a sheet the person uploads | |
| AI with the person's own key (item 6) | |
| Basic dice, light and dark themes, the theme editor | |

Rules for the limits:
- Nothing a person already made is ever locked, hidden or deleted. Over a limit (after an import,
  a restore or a refund), everything still opens and plays; only making a new one is blocked.
- Limits are checked on the device. No copy protection is built.
- No limit applies before the payment phase exists.

Support around the app:
- **Patreon and one-time tips**, through a link on the About screen that the person opens
  themselves (SPEC §11). Patreon perks are extras: early versions, votes on features, a skin or a
  theme only patrons get, a name in the credits. No app feature is available only through
  Patreon.
- **Kickstarter backers and first supporters** get the paid version forever, a dice skin only they
  get, and their name in the credits.
- **The price is Alina's**, set before the payment phase opens.
- **The app earns money.** This answers SPEC §14 question 3: content under a non-commercial
  license (for example the Long Story Short translation, CC BY-NC-SA) never enters the app.
- **The payment phase opens only after the lawyer's check** of ADR 003 Part B item 7, which then
  also covers taxes, refunds and store rules.

### 3. Mixing the two editions

1. **A campaign has one edition.** Content of the other edition counts as custom content in it.
2. **A character has one rules base** (`ruleset`: 2014 or 2024). It decides every rule the two
   editions do differently (the SPEC §6.3 table).
3. **A character may take content from both editions** (`allowMixedRulesets`, SPEC §5.8). A mix
   that may not fit gives a warning, never a block.
4. **A bonus of one kind counts once.** Where both editions give the same kind of bonus from
   different places, the person picks the place. The default is the rules base's place.
   - The known case: ability score increases come from the race in 2014 and from the background
     in 2024 (SPEC §6.3). A 2014 race with a 2024 background gives them from one of the two, never
     both.
   - The full list of such cases is found by reading both SRDs, in the ticket's §8.
5. **The same entry in both editions** (for example a spell in SRD 5.1 and in SRD 5.2.1) stays two
   entries with two ids, and the person picks one. A setting, "prefer 2014" or "prefer 2024",
   hides the other copy in lists. A badge shows each entry's edition.
6. **Golden test F** is a character that mixes both editions, computed by hand. Its values are
   shown to Alina and approved before the test is used (SPEC §6.7). It joins phase 1.

### 4. No link to D&D Beyond

People who bought books on D&D Beyond cannot bring them in through a link. It is not built:
- D&D Beyond has no public API. Its staff say so on its forums, and say its character data may
  change without warning.
- The known tool that reads it, ddb-importer for Foundry, asks for the person's login cookie and
  sends the requests through its own server.
- ADR 003 Part B item 5 (no importer for websites) stays as it is.

People bring their own books' content by typing it into personal packs (ADR 003), or later with
the "paste text from your book" assistant (SPEC §13.1), which makes personal packs only.

### 5. The table link: a campaign without a cloud

1. **The DM's device holds the main copy of a campaign.** The players' devices connect to it
   directly, device to device ("peer-to-peer").
2. **A small server only helps the devices find each other.** It stores no campaign data.
3. **When a network blocks a direct link**, the data passes through a relay server, which forwards
   it and stores nothing.
4. **The link works while the DM's app is open**, which is session time. Changes made while apart
   are merged at the next session.
5. **The DM backs the campaign up to a file.** The main copy lives on one device, so the app
   reminds the DM to make a backup.
6. **What the link carries:**
   - each player's hit points, conditions and rolls, seen by the DM. A player's sheet stays the
     player's; the DM does not edit it;
   - rolls. A roll holds who rolled, what for, the dice, the result and the breakdown. A player can
     roll secretly to the DM, and the DM can roll hidden;
   - roll requests. The DM asks for a roll ("everyone: Perception") and it opens on each player's
     device;
   - gifts. The DM gives an item, gold, experience or a condition, and the player accepts it;
   - the initiative order and whose turn it is, without the monsters' hit points;
   - images (item 10);
   - chat, later: inside a campaign only, never public.
7. **Without the link**, "Share with the DM" as a file or a link stays (SPEC §13.2): a read-only
   copy of the sheet.
8. Where the finder and relay servers run, and what they cost, is decided in the phase that builds
   the link. Money is Alina's decision (ADR 002).

### 6. AI: the person's own key, free, off by default

- The person uses their own key from an AI provider. The owner hosts no AI and pays for none.
- It is free, and off until the person turns it on. Generated content carries an "AI" mark
  (SPEC §13.1).
- Which providers are supported is decided in phase L4.
- Every feature that can use AI also works without it. The generators run on roll tables
  (item 8).

### 7. Themes: colours and fonts as data

1. **A theme is a JSON file of named values:** colours, fonts, sizes, textures. These named values
   are called design tokens. A theme is never raw CSS, because CSS from a stranger can load files
   from the internet (SPEC §11).
2. **The app is built on tokens from its first real screen (phase 2).** Any theme restyles every
   screen.
3. **The theme editor is free**, with a live preview. Themes are imported and exported as files.
   Community themes follow the pack rules of ADR 003.
4. **The first theme takes its colours from "ITS Theme"** for Obsidian, by SlRvb. Only the colour
   values are taken. Its code is under GPL-2.0 and is not copied. The About screen thanks it.

   | Role | Dark | Light |
   |---|---|---|
   | Background | `#1a1e24` | `#f8fbff` |
   | Outer bars | `#0b0f13` | `#eef3fd` |
   | Text | `#bccad8` | `#30353a` |
   | Muted text | `#97a1b9` | `#697580` |
   | Headings | `#c14343` | `#c14343` |
   | Accent | `#863737` | `#912e2e` |
   | Dark accent | `#652121` | `#c35c5c` |
   | Bright accent | `#c94d4d` | `#cd2626` |
   | Second accent | `#61afef` | `#5599d0` |
   | Lines | `#2f3b4d` | `#b5c2d8` |

5. **Fonts.** Body text in **Inter**. Headings in one of **EB Garamond**, **Alegreya**, **Lora** or
   **Cormorant Garamond**; Alina picks it in the design step (OPS-03). All five are under the SIL
   Open Font License, and all five have Cyrillic letters. The font files ship inside the app; they
   are never loaded from a font server (SPEC §11).
6. **Not used:**
   - ITS's heading fonts (Calisto MT, Palatino Black, Book Antiqua, Georgia) are commercial;
   - its fallback, Suez One, has no Cyrillic letters;
   - free look-alikes of the official books' fonts copy the official look, which the app must not
     have (SPEC §3.4).

### 8. Generators on roll tables

1. **A roll table is a core entity** (ADR 004). It is a list of rows with weights, and a row may
   roll on another table. It names no game.
2. **The generators built on it:** NPC, monster idea, location, plot hook, merchant, tavern, loot,
   names. The model is dmheroes.com, for the idea only; no text is taken from it.
3. A result can be kept as an entry. Chosen lines can be locked while the rest is rolled again.
4. The built-in tables are original text. The community shares tables as packs.
5. The merchant picks items from the active packs by shop type, rarity and price.
6. The encounter builder's difficulty budget is a rule, so it lives in the fifth-edition module
   (SPEC §12 L3). It picks monsters from the bestiary.

### 9. DM tools

The initiative tracker (free, offline):
- initiative for every monster in one tap; identical monsters grouped on one turn;
- the monster's stat block inside the tracker; an attack rolls on a tap;
- damage or healing for several targets at once, with each target's save rolled;
- temporary hit points; a concentration reminder when a concentrating creature takes damage;
- counters for legendary actions and legendary resistances; recharge abilities;
- conditions with an end point, such as "until the end of its next turn";
- lair actions; delaying a turn; adding a creature in the middle of a fight;
- death saves for players; undo;
- encounters prepared ahead; experience and loot at the end, written into the session log
  (SPEC §13.2).

The rules behind each of these (timing, recharge, lair actions) are checked against both SRDs in
the ticket that builds it.

The bestiary:
- the SRD monsters of both editions;
- filters: challenge rating, type, size, environment, pack, edition;
- copy and edit (`variantOf`); reskin (the same numbers under a new name and picture); a portrait;
- "Add to encounter" on each monster's card;
- a person's own monsters are homebrew (phase 5), with no limit.

### 10. Images

- Icons shipped inside the app come from an openly licensed icon set. The license is checked in
  its ticket.
- A person's own images stay on their device (the `blobs` table, SPEC §11).
- A DM shares images with players in a campaign file (a pack may hold pictures, ADR 003 item A5)
  or through the table link. Each player keeps a copy. Images are made smaller before sending.
- Campaign images are private to the campaign. The DM is responsible for the rights to their own
  images.

### 11. Dice

- A dice skin changes looks only, never a number.
- A skin is data: colours, a texture picture, a font for the numbers. Community skins can come
  later, under the pack rules of ADR 003.
- Art that is sold is the owner's own, or licensed for selling.
- A "flat dice" setting serves weak devices and people who turn animation off.

### 12. PDF

Phase 6 adds two things to SPEC §10:
- the person's own image on the sheet (a portrait, a symbol);
- the person's own fonts.

Both stay on the device. The PDF is made on the device, so neither costs the owner anything. The
license of an uploaded font is the person's matter, as with the sheet they upload. Both are PDF
extras of the paid version (item 2).

## What this changes in the SPEC

| SPEC | Was | Now |
|---|---|---|
| §5.8, §6.3 | `allowMixedRulesets`: content of the other edition, with a warning | Also: a bonus of one kind counts once, and the person picks its source; an edition preference for entries in both editions (item 3) |
| §6.7 | Golden tests A–E | Adds golden F, a mixed-edition character, with values approved by Alina (item 3) |
| §7.1 | Four tabs; a DM tab later | Player and DM modes, both at once if wanted; DM mode adds the fifth tab (item 1) |
| §7.5 | A theme setting | Themes as design tokens, the theme editor, the ITS colours, the fonts (item 7) |
| §10 | Our own template; filling an uploaded sheet | Adds the person's own images and fonts (item 12) |
| §11 | No external requests, except links the person opens | Also the features the person turns on: the table link and their own AI key (items 5, 6) |
| §12 L3 | Initiative, encounter builder, SRD monsters, party panel | Adds roll tables and generators, and the tool list of item 9 |
| §12 L4, §13.1 | The person's key for one AI provider, stored on the device | The person's own key from a provider chosen in L4; free; off by default (item 6) |
| §12 L5, D11 | Supabase for accounts, sync and campaigns | Campaign sync by the table link, with no campaign data stored on a server (item 5). D11 stays the default for accounts and the community place until their phases decide |
| §14 question 3 | Is money planned? | Yes: one payment, Patreon, tips, Kickstarter; no subscription; no non-commercial content (item 2) |
| — | Nothing on free and paid, dice skins, images, D&D Beyond | Items 2, 4, 10, 11 |

## What does not change

- D1–D10.
- The golden tests A–E and their values.
- The formula language (SPEC §5.6).
- ADR 003, Part B item 5 included, and ADR 004.
- Offline first: a person's data stays on their device (D5).
- Phases 0–7 and their order. The L phases open only when Alina opens them.
- The licensing rules and the i18n rules.

## Still open

Each of these is decided in the phase named, and the money ones by Alina (ADR 002):
- the price, and how a purchase is remembered on the device: the payment phase;
- whether joining someone else's campaign as a player counts toward any limit (proposed: no): the
  payment phase;
- where the finder and relay servers run, and their cost: the phase that builds the table link;
- which AI providers are supported: phase L4;
- the heading font: OPS-03.

## Consequences

- **Phase 1 re-cut** (still shown to Alina before it replaces the rows) adds:
  - golden F, with its values approved first;
  - the ability-bonus source as a choice in the fifth-edition module;
  - the roll result's shape of item 5.6, so a roll can be sent to a DM later.
- **The roll table** is a new entity type. Adding it later needs no migration, so it waits for its
  phase.
- **Phase 2** builds its screens on design tokens.
- **Later phases**, each opened by Alina:
  - the DM tools (L3, grown by items 8 and 9);
  - AI (L4, item 6);
  - the table link (L5, item 5);
  - payments (item 2; its gate is the lawyer's check);
  - dice skins and the theme editor.
- **OPS-03** writes the design brief for the screens.
- **`CLAUDE.md`:** the external-requests invariant names the features a person turns on.

## Sources

Read on 2026-09-29. Some sites were blocked from the work environment; for those, the fact comes
from web search results, and the entry says so.

- D&D Beyond has no public API: forum threads
  [Third Party API](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/17230-third-party-api)
  and
  [Terms of Service? API?](https://www.dndbeyond.com/forums/d-d-beyond-general/general-discussion/49086-d-d-beyond-terms-of-service-api)
  (search results).
- D&D Beyond gives 6 characters free, and unlimited characters with a subscription:
  [forum thread](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/43162-why-do-we-only-have-six-character-slots),
  [subscriptions](https://store.dndbeyond.com/store/subscribe) (search results).
- ddb-importer uses the person's login cookie through a proxy server:
  [its setup page](https://docs.ddb.mrprimate.co.uk/docs/ddb-importer/initial-setup) (search
  results).
- Fight Club 5th Edition: 1 character free, $2.99 once for unlimited. Game Master 5th Edition: 1
  campaign, 1 adventure and 3 encounters free, $2.99 once. Both by Lion's Den (search results;
  the store pages were blocked).
- Shieldmaiden: the main features are free; Patreon tiers add storage and extras
  ([Patreon page](https://www.patreon.com/shieldmaidenapp/about), search results).
- dmheroes.com: NPC, monster, location and plot hook generators, with portraits; development on
  hold (search results; the site was blocked).
- ITS Theme: `theme.css` and `LICENSE` (GPL-2.0) on the main branch of
  [SlRvb/Obsidian--ITS-Theme](https://github.com/SlRvb/Obsidian--ITS-Theme), read directly. The
  colours in item 7 are its `.theme-dark` and `.theme-light` values.
- Fonts: the license of each font from its `METADATA.pb` in
  [google/fonts](https://github.com/google/fonts) (all `OFL`), and its character sets from the
  Google Fonts CSS API. Inter, EB Garamond, Alegreya, Lora and Cormorant Garamond list `cyrillic`;
  Suez One does not.
