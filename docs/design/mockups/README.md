# Mockups — the whole design canvas, as files

Every board of the design canvas, all nine pages, saved in the repository so that every chat
can open them and build from them (the owner's decision, 2026-10-01). A new chat does not see the
chats before it; it sees this folder. The canvas itself is a private page on the owner's account:
[the design canvas](https://claude.ai/artifact/RatMY6p7o1XaSFsSew2qSg). If the two ever differ,
the newer date in `docs/design/BRIEF.md` Part 5 wins, and the other is brought in line.

- **What each screen must do:** `docs/design/BRIEF.md` (Part 2 per screen, Part 5 the choices)
  and ADRs 008–013. **What it changes in the engine:** ADR 014.
- **These files show the look and the layout.** They are not app code to copy: the app builds
  its screens from design tokens and i18n keys (`CLAUDE.md`, "The interface"), and every number
  comes from `compute()`. Names and numbers in the mockups are samples; "[SRD text]" marks where
  the rules text goes.
- **No images here.** Pictures and screenshots stay out of the repository; these are text.

## The boards

`V3-*` is the current design. The rows follow the canvas.

| Row | Board file | What it shows |
|---|---|---|
| Player page, library, Quick rules | `V3-Player` | Six sections: Characters, Sources, Library, Dice roll, Quick rules, Bookmarks |
| | `V3-Sources` | All sources, with licenses |
| | `V3-Library` | A topic's list: search, Filter, Sources, Export, groups, legend |
| | `V3-Entry` | A spell's floating window: small top part, tappable dice and terms, classes per edition |
| | `V3-QuickRules` | Quick rules: topics |
| | `V3-QuickRule` | A topic's window, and a rule's window over it, the rest dimmed |
| The sheet | `V3-Sheet` | Main tab; the class line is the level |
| | `V3-Turn` | The Turn tab |
| | `V3-SheetDice` | The half-screen dice panel |
| | `V3-Keypad` | Damage, Heal and Temp HP number pad |
| | `V3-LevelUp` | Level up, XP or milestone (waits for the owner's screenshot) |
| | `V3-Spells` | Spells: the slot grid, a granted spell "1/LR" |
| | `V3-Cast` | Casting: summary, "See full description", "Don't use a spell slot" |
| | `V3-TempHP` | Temporary hit points: a green number and a green part of the bar |
| Making a character | `V3-Create` | Steps that open and close with the turning circle arrow |
| | `V3-Methods` | Ability score methods |
| | `V3-Roller` | The roll calculator |
| | `V3-Feats` | Choosing a feat from the library's Feats list |
| | `V3-Conflict` | Race and background from two editions both raise abilities |
| Support screens | `V3-Characters`, `V3-Dice`, `V3-Roll`, `V3-Rest`, `V3-Features`, `V3-About`, `V3-Add`, `V3-Stat`, `V3-Token` | My characters, the dice page, a roll, rests, features by source, About, edit mode, a custom stat, the portrait |
| | `V3-Actions` | The sheet's "⋯" menu, Level up first |
| Start and the DM's side | `V3-Systems` | Later: choosing the game system |
| | `V3-Start` | Player and DM as two squares |
| | `V3-DMHome` | The DM's home: Approvals with a count, Actors, Campaigns, and every player section |
| | `V3-Approvals` | Characters waiting for approval |
| | `V3-DMReview` | Grouped changes; the DM edits a value before approving |
| | `V3-Actor` | A new actor with a type |

### The other pages

| Canvas page | Files | What it is |
|---|---|---|
| Retro and weird | `Retro-*` (6) | Six looks kept as ideas for paid skins, not the base design (BRIEF Part 5, "Future skins") |
| Our design v2 | `V2-*` (19) | The second round, replaced by v3 |
| Our design v1 | `G-*` (12) | The first round of our own design, replaced by v2 |
| Reference, improved | `R-*` (12) | Our redraw of the ideas in the owner's reference app; only ideas and parts were kept (ADR 008 item 7) |
| Player flow | `Flow-*` (8) | The navigation that became ADR 008 |
| Overall design · 5 options | `O1-*` to `O5-*` (11) | Five home pages with a bottom bar, all rejected |
| P4 · 3 palettes | `P4-*` (9) | Three colour sets for the sheet; Lavender and Cream rejected, Sky open |
| First look | `Main`, `Font-*`, `Layout-*`, `P1-*`, `P2-*`, `P5-*` (11) | The very first boards: fonts, layouts, first screens |

Together: 123 boards. `canvas.json` is the canvas's index: its nine pages, each board's place
and title, and the row titles. Only `V3-*` is the current design; the rest is history, kept so
that no round is lost.

## The tokens these mockups use

Placeholders until the owner chooses the base colours and the heading font (BRIEF Part 5). The
app turns them into design tokens; a skin replaces them (ADR 005). Contrast is measured on white
with `generator/gen2.py`.

| Token | Value | Contrast on white | Used for |
|---|---|---|---|
| `bg` | `#F5F5F3` | — | the page |
| `surface` | `#FFFFFF` | — | cards, sheets, the header and the dock |
| `text`, `strong` | `#1C1D20` | 16.85 : 1 | text; filled buttons, tokens, ticks |
| `onStrong` | `#FFFFFF` | — | text on filled buttons |
| `muted` | `#5E6269` | 6.13 : 1 | second lines, labels |
| `line` | `#E2E2DE` | — | borders and dividers |
| `soft` | `#EDECE8` | — | chips, search fields, boxes |
| `hp` | `#B5473A` | 5.35 : 1 | the hit point bar, count badges |
| `track` | `#E6E3DF` | — | the empty part of a bar |
| `temp` | `#2F7A4A` | 5.25 : 1 | temporary hit points |
| `warnBg`, `warnText` | `#FBF1D9`, `#6B4A00` | 8.06 : 1 (text) | warnings |
| `danger` | `#A23A2E` | 6.60 : 1 | Delete |

- **Fonts:** headings in EB Garamond (a placeholder; the heading font is still open, BRIEF X1),
  everything else in Inter.
- **Sizes most used:** 11–14 px for second lines and labels, 15–16 px for body text, 18–22 px
  for numbers and names, 28 px for page titles.
- **Corners:** 14 px on cards, 12 px on buttons, a full pill on chips, 20 px on the top of a
  floating window.
- **Phone frame:** 360 × 800; buttons and icon buttons are 44–48 px tall.
- **Light only:** the dark theme is not drawn yet (BRIEF Part 5, "Still open in the design").

## Reading a file

Each file is one phone screen, 360 × 800, in plain HTML with inline styles.

- `{{name}}` is a live value, filled in by the canvas's runtime (`support.js`, not in the
  repository).
- `<sc-if value="{{x}}">` shows its content when `x` is true; `<sc-for>` repeats its content.
- The script at the end (`class Component`) holds the screen's state: what opens, what is ticked.
- Opened alone in a browser, a file shows every branch at once and the `{{…}}` marks as text.
  The canvas link shows it as designed.

## Changing the mockups

The files are generated by the Python scripts in `generator/` (Python 3, no packages). The
`V3-*` boards are rebuilt, byte for byte, by four scripts in this order; a later one rewrites
some boards of an earlier one:

```sh
cd docs/design/mockups
python3 generator/gen9.py canvas.json
python3 generator/gen11.py canvas.json
python3 generator/gen12.py canvas.json
python3 generator/gen14.py canvas.json
```

`gen14.py` alone is enough when only the boards of `gen13.py` and `gen14.py` change. The other
scripts hold the shared pieces (colours, icons, the sheet's header and dock), and drew the
earlier pages; those pages are kept as files and were not rebuilt to check them. A change
to a board is made in its generator, regenerated, published to the canvas, and committed here
in the same ticket. `generator/shot.cjs` renders boards side by side into a PNG for the chat
(set `CHROMIUM_PATH` if Playwright's own browser is not installed); the PNG is not committed.

## If the canvas is ever lost

The canvas can be rebuilt from this folder alone. A chat that can publish artifacts publishes
`canvas.json`, with every `*.dc.html` file beside it, to a new design canvas, and writes the new
link into BRIEF Part 5 and this file.
