# ADR 015 — Skins: everything that changes the look is data

**Status:** accepted · **Date:** 2026-10-01 · **Decided by:** The owner (what skins can do);
technical choices under ADR 002 (how the app is built for them)

## Context

On 2026-10-01 the owner said what the paid skins of ADR 005 will include, and asked that the code
be ready for them from the start: themes with their own colours and fonts; changed designs like
the retro looks on the design canvas (BRIEF Part 5, "Future skins"); custom 3D dice with special
effects; token frames that can be animated, like profile decorations in chat apps; backgrounds on
the person's pages and character pages that loop, shift their gradient, or play an animated
picture; an animated portrait that keeps playing; seasonal themes. ADR 005 items 7 and 11 already
make themes and dice skins data. This ADR widens that to every kind of look, before phase 2
builds the first real screen, so no screen has to be rebuilt later.

## Decision

### What a skin can change (the owner's)

1. **A skin is one product that can change any of these, alone or together:**
   - **colours and fonts**, for light and dark;
   - **the style of the parts**, enough for a retro look: borders, corners, shadows, textures,
     the shape of buttons, panels and cards;
   - **motion**: how things move and appear;
   - **backgrounds** of the app and of the person's pages and character pages: a picture, a
     gradient that shifts, a looping animated picture, or a short looping video with no sound;
   - **the token frame** around the round portrait, still or animated, which may reach outside
     the circle;
   - **dice**: 3D dice with their own materials, textures, number font and special effects when
     they roll, land, or roll a critical;
   - **a season**: a skin may carry the dates of its season (item 12).
2. **A person's own portrait may be animated** (an animated picture or a short video) and keeps
   playing while it is on screen. It stays on the device (ADR 005 item 10).
3. **Skins change looks only, never a number** (ADR 005 item 11). The engine does not know skins
   exist.

### How the app is built for them (technical, ADR 002)

4. **No look is written in a component.** Every colour, font, size, corner, border, shadow,
   texture, picture and animation a screen shows comes from a design token or from a skin slot
   (item 6). A lint check fails on a colour, font or animation value written in a component, the
   way SETUP-05's check fails on visible text. `CLAUDE.md` carries this as a hard invariant.
5. **A skin is a file of data, never code.** A manifest (JSON) plus its pictures, videos and font
   files, packed in one file. It has a schema in `packages/schema`, like a pack (ADR 003), and is
   checked when it is imported. No JavaScript, no raw CSS, no web addresses: everything it needs
   is inside the file, so it works offline and loads nothing from the internet (SPEC §11).
6. **Slots.** The screens have named places a skin can fill: the app background, each page
   background, the token frame, the portrait, the header, the dock, cards, buttons, the dice. A
   screen draws a slot; the active skin decides what fills it; with no skin, the base theme fills
   it. A new slot is added in the app; a skin cannot invent one.
7. **Part styles are a fixed menu.** Each part offers a few styles the app has built (for example
   a button: flat, outlined, raised; a panel: card, parchment, window). A skin picks one and sets
   its tokens. This gives retro looks without CSS from a stranger. A new style comes with an app
   update.
8. **Animations are presets with settings.** The app has a list of animations (for example glow,
   pulse, float, sparkle, gradient shift, and dice effects for roll, land and critical). A skin
   picks presets and sets their colours, speed and size. Animated pictures (GIF, animated WebP,
   APNG) and short videos (WebM, MP4, muted) are allowed as files. Other animation formats are
   decided by the ticket that needs them.
9. **Motion respects the person and the battery.**
   - The phone's "reduce motion" setting turns animations into still pictures, and so does a
     switch in the app's settings.
   - Animations stop when they are off screen or the app is in the background.
   - Animations change only what a phone draws cheaply (position, size, opacity); each ticket
     that adds one measures it on the Pixel 7 profile the e2e tests use.
   - "Flat dice" stays (ADR 005 item 11).
10. **Fonts ship with the app or the skin.** No font is loaded from a font service; the mockups'
    links to one are for the canvas only. Every font's licence is read before it ships; a font in
    a sold skin must allow that (ADR 005 item 11: art that is sold is the owner's own, or licensed
    for selling).
11. **Who owns a skin is set by the app,** never read from the skin file: built-in, bought, free,
    or made by the person, the same way a pack's origin is set (ADR 003 item A7).
12. **A season is a date range in the skin.** During it the app can show the skin. Whether the app
    switches to it by itself is still open.

### Phases

13. **Phase 2, before the first screen:** the full token set (every token the mockups use,
    listed in `docs/design/mockups/README.md`), the slots, the part-style switch, the motion settings and the
    lint check of item 4. The portrait accepts animated pictures and video from the start. The
    current shell already keeps its colours as tokens (SETUP-04); its one colour outside them is
    the web-app manifest's background, which a manifest can only hold as a fixed value; the page's
    theme colour follows the active skin at run time.
14. **The theme editor's phase (BRIEF P10):** the skin schema, import and export, the editor.
15. **The dice phase:** dice skins and their effects, on top of ADR 009 item 10's fair roll.
16. **The skins' sale (ADR 005's purchases phase):** frames, backgrounds, seasons, the shop. By
    then they are new data for slots that already exist, not new screens.

## Still open

- Item 12: whether a seasonal skin switches on by itself during its season, or is only offered.
- The base colours and the heading font (BRIEF Part 5).

## What this changes

| Where | Was | Now |
|---|---|---|
| ADR 005 item 7 | A theme: colours, fonts, sizes, textures | A skin: also part styles, motion, backgrounds, token frames, dice, seasons (items 1, 6–8, 12) |
| ADR 005 item 11 | A dice skin: colours, a texture, a number font | Also materials and special effects, as presets (items 1, 8) |
| SPEC §5.8 portrait | A picture | Also an animated picture or a short video (item 2) |
| `CLAUDE.md` | — | A hard invariant: no look written in a component (item 4) |
| `BACKLOG.md` | — | Phase 2 starts with the skin layer (item 13) |

## What does not change

- ADR 005's free and paid split: the base light and dark themes and the theme editor are free.
- Skins never change a number; the engine stays pure.
- No external requests (SPEC §11); a skin is checked like a pack (ADR 003).
- The design canvas and the mockups.
