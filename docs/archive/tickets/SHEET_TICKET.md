# SHEET — The character sheet, made by hand

**Why this theme:** Phase 2 puts the engine on the phone. A person makes a character by hand,
keeps it on the device and plays it from the sheet: trackers, rolls, rests, undo. Every number on
screen comes from `compute()` with its breakdown, and every look comes from a design token or a
skin slot (ADR 015). The screens follow the owner's mockups and the ADRs that placed work here.
**SPEC:** stage 2, sections §5.8, §6.4, §6.5, §7.1, §7.2, §7.4 (manual mode), §7.5, §11;
ADR 005, ADR 008, ADR 009, ADR 010, ADR 011, ADR 013, ADR 015
**Order and status:** [`BACKLOG.md`](../../tickets/BACKLOG.md) — never repeated here.
**Theme is closed when:** every SHEET row is ✅ or ❌, and the phase 2 gate named in `BACKLOG.md`
(SPEC §12 stage 2, as ADR 000 changes it) is proved.
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections and ADRs the
row's note names; for a screen, its boards in `docs/design/mockups/` and that folder's README.
**This file:** the theme's closed tickets, moved here as each one closed. Open tickets are in
[`docs/tickets/SHEET_TICKET.md`](../../tickets/SHEET_TICKET.md).

---

### SHEET-07 Phase 2's device tables

**Hat:** Phase 2's device tables arrive in one database version
**Depends on:** SETUP-06
**Size:** XS
**Screen:** No
**SPEC:** §11 (the Dexie tables)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/db/db.ts` — changes: Dexie version 2 and the six tables. The other
files it touches:

- `apps/web/test/storage.test.ts` — the SHEET-07 tests; SETUP-06's test keeps only the name.
- `apps/web/e2e/storage.spec.ts` — the SHEET-07 tests in Chromium; SETUP-06's test no longer pins
  the version.

#### 2. What is missing now

Measured on 2026-10-28 at `138757e`:

- `db.ts` declares `this.version(1).stores({})`: `db.verno` is `1`, `db.tables` is `[]`.
- In Chromium, `indexedDB.databases()` gives `[{ name: 'grimoire', version: 10 }]`, with no object
  store.

The backlog note (written by OPS-29) gave the reason: phase 2's rows run in parallel waves, and if
each row that first stores into a table added it as the next Dexie version, two chats of one wave
would claim the same version number. This departs from SETUP-06's "each table arrives with the
ticket that first stores into it".

#### 3. What it should look like when done

1. `db.verno` is `2`. Version 1 stays declared, with no tables.
2. Version 2 declares, in this order, with these primary keys and indexes:

   | Table | Primary key | Indexes |
   |---|---|---|
   | `characters` | `id` | — |
   | `packs` | `id` | — |
   | `settings` | `key` | — |
   | `rollLog` | `id` | `[characterId+rolledAt]` |
   | `history` | `id` | `[characterId+at]` |
   | `blobs` | `id` | — |

3. No table has an auto-increment key: every key is a value the row carries.
4. In Chromium, after the app opens, the database is at IndexedDB version 20 with the object stores
   `blobs`, `characters`, `history`, `packs`, `rollLog`, `settings`.
5. A version 1 database left by an earlier start (IndexedDB version 10, no stores) upgrades to
   version 20 with the same six stores when the app opens.
6. Each table has a TypeScript row type holding its key and its indexed fields; the row that first
   stores into a table adds the rest.

#### 4. How to do it

1. In `GrimoireDb`, after `this.version(1).stores({})`, add `this.version(2).stores({...})` with
   the table above. No `upgrade()` function: version 1 holds no data.
2. Declare each table as `EntityTable<Row, keyField>`, with the row interfaces next to the class.
3. Choices made here (ADR 002), because a primary key never changes once a table exists (SETUP-06
   §11 measured Dexie's `Not yet support for changing primary key`):
   - `characters` by the character's `id` (a uuid, `CharacterDoc.id`), `packs` by the pack id
     (`ContentPack.id`), `blobs` by a uuid (`CharacterDoc.portraitBlobId` names one).
   - `settings` holds one row per choice, keyed by its name, so SHEET-13 adds a choice without a
     new version.
   - `rollLog` and `history` are keyed by their record's own uuid (`RollRecord.id`,
     `LogEntry.id`). Each row also carries `characterId` and its time, so the compound index gives
     one character's rows in time order: the last 100 rolls (SPEC §6.5, SHEET-37) and the last 50
     changes (SPEC §7.2, SHEET-23, SHEET-59). A roll made off a sheet (the dice page) has no
     `characterId`, and Dexie leaves it out of the index.
   - `characters` gets no index: the My characters list is short and sorts in memory. An index
     can still come later; only a primary key cannot change.
   - `entityIndex` (SPEC §11) is left out: phase 3's search stores into it. Adding a new table is
     a new version, which phase 3 can take; it changes no table here.

#### 5. Stored data

Six new, empty IndexedDB object stores; Dexie version 1 → 2 (IndexedDB 10 → 20). No record shape
changes: `CharacterDoc`, `ContentPack` and their `schemaVersion` stay as they are, and no row is
written. The upgrade from version 1 is tested in Chromium (§3 item 5).

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `apps/web/test/storage.test.ts` — `SHEET-07 phase 2 tables`: version 2; each table's name,
  primary key and indexes, in order; no auto-increment key.
- `apps/web/e2e/storage.spec.ts` — `SHEET-07`: the app opens the database at IndexedDB version 20
  with the six stores; a version 1 database (made on a blank page of the app's origin) upgrades to
  version 20.
- Control numbers from: SPEC §11 (the table names); Dexie's "version N = IndexedDB version N × 10",
  measured in Chromium by SETUP-06 (version 1 → 10) and here (version 2 → 20).

#### 8. Checked against the source

Nothing to check: no rules facts.

#### 9. Not in this ticket

- What each row holds, its version field and its writes: SHEET-08 and SHEET-09 (packs), SHEET-10
  (characters), SHEET-13 (settings), SHEET-37 (rollLog), SHEET-23 and SHEET-59 (history), SHEET-56
  (blobs).
- Dropping a deleted character's rolls and changes: SHEET-22, SHEET-25.
- A screen that says the database failed to open: still logged only (`apps/web/src/main.tsx`).
- `entityIndex`: phase 3.

#### 10. Rake check

- **A stored-shape change needs a migration**: no record shape changes; the Dexie version bump is
  the migration of the database, and it is tested from version 1.
- **Ids are stable**: every key is a stored id (`id`, the pack id, the setting's name), never an
  auto-increment that would differ between devices or after an import.
- **No telemetry, no external requests**: the database is local IndexedDB only.

#### 11. What came out of it

Measured on 2026-10-28:

- Whole gate (`lint && typecheck && test && e2e`): exit 0, 39.8 s.
- `pnpm lint`: `Checked 201 files`, 0 errors. `pnpm typecheck`: every project `Done`.
- `pnpm test`: `Test Files 63 passed (63)`, `Tests 881 passed (881)` (879 before, 2 new).
  The second suite (`Tests 2 passed (2)`) is unchanged.
- `pnpm e2e`: `14 passed` on `pixel-7` (12 before, 2 new).
- In headless Chromium after the app opens: the database is at version 20 with
  `['blobs', 'characters', 'history', 'packs', 'rollLog', 'settings']`.
- The e2e tests are live: with version 2 taken out of `db.ts`, both SHEET-07 tests failed
  (`Expected value: {"name": "grimoire", "version": 20}`, `Received array: [{"name": "grimoire",
  "version": 10}]`); SETUP-06's still passed.
- Dexie gives `primKey.outbound` as `undefined`, not `false`, for a key path; the test checks the
  key path and `auto` instead.
- Build: JS 493.24 kB (157.47 kB gzip).
- The e2e test for SETUP-06 pinned `version: 10`; it now checks only that the database appears,
  and the version lives in the SHEET-07 test.

Found, not fixed: nothing.

Nothing for the changelog.

---

### SHEET-02 No look written in a component

**Hat:** Lint fails on a colour, font or animation written in a component
**Depends on:** SETUP-05
**Size:** S
**Screen:** No
**SPEC:** ADR 015 item 4; `CLAUDE.md` "No look is written in a component"

---

#### 1. Where the code lives

**Main file:** `biome/no-look-literals.grit` — new: a Biome GritQL plugin, built like SETUP-05's
`biome/no-visible-literals.grit`. The other files it touches:

- `biome.json` — changes: an override for `apps/web/src/**/*.tsx` that turns the plugin on.
- `apps/web/test/no-look-literals.test.ts` — new.

#### 2. What is missing now

Measured on 2026-10-28, at `138757e`:

- No rule: a probe `apps/web/src/Probe.tsx` with
  `<p className="bg-red-500 animate-spin" style={{ fontFamily: 'Inter' }} />`, linted with the
  repository's `biome.json` and plugins: `Checked 1 file in 4ms. No fixes applied.`, exit 0.
- The components today use only theme tokens (`bg-background`, `text-primary`, `border-border`,
  `text-muted-foreground`); `pnpm lint` passes on them before and after.

#### 3. What it should look like when done

1. `pnpm lint` fails, in `apps/web/src/**/*.tsx`, on a colour written in any string: a hex
   colour (`text-[#1c1d20]`, `'#fff'`), a CSS colour function (`oklch(…)`, `rgb(…)` and the
   rest), a Tailwind palette class (`bg-red-500`, `hover:border-x-white/50`; the 28 palette names
   of Tailwind 4.3.3's `theme.css`), a typed colour (`text-[color:tomato]`).
2. It fails on a colour, font or animation in an inline `style` object: `color`, `fill`,
   `stroke`, any `…Color`, `background`, `font`, `fontFamily`, `animation…`, `transition…`.
3. It fails on a colour or font in an attribute: `fill`, `stroke`, `color` (an icon's colour),
   `stopColor`, `floodColor`, `lightingColor`, `fontFamily`.
4. It fails on a font in brackets (`font-['EB_Garamond']`), on Tailwind's own animations
   (`animate-spin`, `-ping`, `-pulse`, `-bounce`), on an animation in brackets (`animate-[…]`),
   and on SVG's animation elements (`<animate>`, `<animateMotion>`, `<animateTransform>`,
   `<set>`).
5. It passes: theme-token classes, `font-sans`, a weight (`font-black`, `font-[600]`),
   `font-[var(--…)]`, `animate-none`, `currentColor`, `none`, `transparent`, `inherit`,
   `var(--…)`, `url(#…)`, a picture in `background: 'url(…)'`, an anchor such as `#section`, and
   a value passed in a variable.
6. `.ts` files are not checked: `config/app.ts` keeps the manifest's fixed background colour
   (ADR 015 item 13), and the theme's own files hold token values.
7. `pnpm test`: the lint test runs Biome on a bad sample (exit 1, 18 findings at the listed
   lines), a good sample (exit 0) and a `.ts` sample (exit 0).

#### 4. How to do it

1. `biome/no-look-literals.grit`, one top-level `or` of six branches: colour in a string, font
   in a class, animation in a class, an inline style member, an attribute, an SVG animation
   element. Regexes use only non-capturing groups (GritQL turns a capturing group into a
   variable and refuses the pattern).
2. `biome.json`: a new override `apps/web/src/**/*.tsx` with `"plugins":
   ["./biome/no-look-literals.grit"]`. Biome adds it to the `apps/web/src/**` override's plugin;
   a probe got both plugins' findings.
3. `test/no-look-literals.test.ts` (`describe('SHEET-02 no look written in a component')`):
   copies `biome.json` and `biome/` into a temporary folder and lints samples there, as the
   SETUP-05 test does.
4. Run the gate, `pnpm e2e` included.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `apps/web/test/no-look-literals.test.ts` — bad sample: exit 1, findings at lines
  3, 3, 3, 4, 5, 6, 7, 8, 8, 9, 9, 9, 10, 12, 14, 15, 16, 17; good sample: exit 0; `.ts`
  sample: exit 0.
- `apps/web/test/no-visible-literals.test.ts` — unchanged, still passes with the new plugin in
  the copied `biome/` folder.
- Control numbers from: the samples' line numbers, counted in the test source.

#### 8. Checked against the source

Nothing to check. No rules facts. The palette names and the four animation names were read from
`node_modules/.pnpm/tailwindcss@4.3.3/node_modules/tailwindcss/theme.css`.

#### 9. Not in this ticket

- The token values and their files — SHEET-01.
- Transition and duration classes (`transition`, `duration-200`): motion presets are SHEET-05;
  that row extends this check if its presets need it.
- Sizes, corners, borders, shadows written as Tailwind's scale: ADR 015 item 4 asks the lint for
  colours, fonts and animations only.
- Pictures written in a component: slots are SHEET-03.

#### 10. Rake check

- **No look is written in a component:** this ticket builds the check.
- **No user-facing string literal in a component:** the plugin adds no visible text; SETUP-05's
  check still runs on the same files.
- **`engine` is pure TypeScript:** nothing outside `biome/`, `biome.json` and `apps/web/test`
  changes.
- **Nothing invisible; no tool attribution:** the plugin and the test are plain ASCII.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->

**Measured on 2026-10-28, on top of SHEET-07 (`2dc081f`):**

- `pnpm lint`: `Checked 203 files in 451ms. No fixes applied.`, exit 0.
- `pnpm typecheck`: every project `Done`.
- `pnpm test`: unit `Test Files 64 passed (64)`, `Tests 884 passed (884)`, 19.42 s; speed
  `Tests 2 passed (2)`, 3.11 s.
- `pnpm e2e`: `14 passed (16.3s)` on `pixel-7`.
- The real `pnpm lint` on the §2 probe in `apps/web/src`: 2 findings, `plugin` at 2:23 (colour)
  and 2:70 (font). The probe was deleted.

**Differences from §3 and §4:**

- Biome reports one finding per string, even when a pattern registers two: a class string with
  a palette colour and `animate-spin` gets the colour finding; once fixed, the animation shows.
  The bad sample therefore puts each kind in its own string.
- Biome's formatter puts a space before one comma in the plugin
  (`within JsxAttribute(name=\`style\`) ,`); the file is kept in Biome's format, as SETUP-05 did.
- An anchor made only of hex letters (`href="#add"`, `#bed`, `#cafe`) reads as a colour and is
  flagged. No such anchor exists; rename it if one is needed.
- A CSS colour name in brackets (`bg-[red]`) is not caught, because `text-[large]` and
  `border-[thin]` are sizes. `bg-[color:red]` is caught.

**Found, not fixed:** `docs/RUNNING.md` names the container's Chromium as
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; the container now has
`/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`. New row OPS-30.

**Changelog:** nothing for the changelog; nothing a person sees changed.

### SHEET-01 The base theme's tokens cover every token the mockups use

**Hat:** the base theme's tokens as data
**Depends on:** Nothing
**Size:** S
**Screen:** Yes — every page of the current shell changes colour; the tokens are those of
`docs/design/mockups/README.md` ("The tokens these mockups use") and BRIEF Part 5
**SPEC:** §7.2 (dark by default), ADR 015 item 13

---

#### 1. Where the code lives

**Main file:** `apps/web/src/theme/theme.ts` — new. It merges the concern files and writes their
values as CSS custom properties.
- `apps/web/src/theme/part.ts` — new: the shape of one concern.
- `apps/web/src/theme/colors.ts`, `typography.ts`, `shape.ts` — new: the values.
- `apps/web/src/theme/slots.ts`, `parts.ts`, `motion.ts`, `fonts.css` — new, empty: SHEET-03,
  SHEET-04, SHEET-05 and SHEET-06 fill one each, so the wave 2 chats touch different files.
- `apps/web/src/index.css` — changes: Tailwind's own values are cleared; each token reads
  `--theme-<name>`.
- `apps/web/src/main.tsx` — changes: the theme is applied before the first render.
- `apps/web/src/shell/AppShell.tsx`, `apps/web/src/pages/PageTitle.tsx` — change: the new
  utility names.
- `apps/web/src/config/app.ts`, `apps/web/public/favicon.svg` — change: the dark page colour.
- `docs/design/mockups/README.md` — changes: the token list gains what the boards use and the
  list did not name.

#### 2. What is missing now

- `apps/web/src/index.css` holds the shadcn/ui neutral set from SETUP-04: 13 colours
  (`background`, `foreground`, `primary`, …) as `oklch()` values, and one `--radius`.
- None of the mockups' tokens exists: no `bg`, `surface`, `hp`, `temp`, `warnBg`, no EB Garamond,
  no 14 px card corner.
- The values are CSS text, not data a skin or the theme editor can read.
- Tailwind's default palette (`bg-red-500` and the rest) is open to any component.

Measured on the 35 `V3-*` boards (`grep` over `docs/design/mockups/V3-*.html`):
- colours: the 14 of the README table, plus `#44464B` (1 use, the swipe "Actions" button in
  `V3-Characters`) and `#dcdcd8` (the canvas page behind each board, not the app);
- the dimmed screen: `rgba(20, 20, 22, a)` at 0.25 (6), 0.35 (1), 0.45 (4), 0.55 (1);
- shadows: `0 1px 3px rgba(0,0,0,0.12)` (3), `0 -4px 12px rgba(0,0,0,0.05)` (14),
  `0 -8px 24px rgba(0,0,0,0.18)` (7, and 0.2 and 0.22 once each), `0 6px 16px rgba(0,0,0,0.25)`
  (5), and three rings around the token (21);
- 20 font sizes: 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 26, 28, 30, 32, 44, 48,
  54 px;
- line heights: 22 px (66), 26 px (60), 1.1 (42), 1.35 (35), and 25, 24, 23 px and 1 a few times;
- corners: 50 % (328), 12 px (235), 14 px (114), 6 px (48, tags 20–24 px tall), 4 px (41), 10 px
  (33, fields 34–44 px tall), 15 px (26, all on 30 px shapes), 16 px (18, large boxes), 2, 17,
  9, 8, 5, 18, 22, 11 px, and `20px 20px 0 0` (12);
- fonts: `'EB Garamond', Georgia, serif` (81) and `Inter, system-ui, sans-serif` (35);
- weights 500, 600, 700, 800; one motion, `transition: transform 0.2s ease` (10).

#### 3. What it should look like when done

1. Every colour row of the mockups README has a token, filled in light with the README's value
   and in dark with a placeholder.
2. Light and dark fill the same keys.
3. Every text pair the screens use keeps 4.5 : 1 in both modes, measured with the WCAG formula.
4. The fonts, the 20 sizes, the line heights, the corners, the shadows and the 44 / 48 px control
   heights are tokens.
5. The values are TypeScript data, one file per concern, merged once; a key filled by two
   concerns throws.
6. `index.css` maps every key once and nothing else; Tailwind's own colours, fonts, sizes, line
   heights, corners and shadows are cleared.
7. The page is dark by default and paints with the dark tokens; without the `dark` class it paints
   with the light ones.
8. The manifest's background equals the dark page colour, as a fixed value.

#### 4. How to do it

1. `part.ts`: a concern is `{ light?, dark?, shared? }`, each a map from a Tailwind theme
   variable name (without `--`) to a value. `color-bg` fills `--color-bg`, so `bg-bg` paints
   with it.
2. `colors.ts`, `typography.ts`, `shape.ts` hold the values of §2. Names: the README's names in
   kebab case. Text sizes are named by their pixels and stored in rem, so the phone's text size
   still scales them. Corners are named by what wears them; every shape whose corner is half its
   height is `pill`. Font weights stay Tailwind's (500–800 are its `medium` to `extrabold`).
3. `theme.ts`: `mergeParts()` joins the concerns; `baseTheme` is the six of them; `themeCss()`
   writes shared and light values on `:root` as `--theme-<key>`, dark ones on `.dark`;
   `applyTheme()` puts that text in one `<style id="theme">`.
4. `index.css`: `@theme { --color-*: initial; … }` clears Tailwind's values, and `@theme inline`
   maps each key to its `--theme-` variable. The body takes `bg`, `text` and `font-body`.
5. `main.tsx` calls `applyTheme(baseTheme)` before `createRoot`.
6. The shell's classes move to the new names, at the same sizes (`text-xs` → `text-12`,
   `text-2xl` → `text-24`).
7. The dark placeholder `bg` becomes `APP_BACKGROUND_COLOR` and the icon's background.

A skin later replaces values in the same keys at run time; no component changes.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Every page of the current shell, at 360×800. No new text, so no i18n key.
- Dark (the default): the page `#131417`, text `#ECEBE7`, the inactive tabs `#A2A6AD`.
- Light (not reachable from the screen until SHEET-13): the mockups' `#F5F5F3` page and
  `#1C1D20` text.
- The icon and the splash screen: `#131417` instead of `#0a0a0a`.
- The text font is Inter where the device has it, else the system font, until SHEET-06 ships it.

#### 7. Tests

- `apps/web/test/theme.test.ts` — the README's colour rows are all filled, with the README's light
  values; light and dark keys match; 14 text pairs keep 4.5 : 1 in each mode; fonts, a size, the
  corners, a shadow; each size key equals its rem value × 16; `index.css` maps every key once;
  Tailwind's colours are cleared; the manifest colour is the dark `bg`; `themeCss()` output; a
  key filled twice throws.
- `apps/web/e2e/theme.spec.ts` — the built page has one theme style, its body and heading are
  the dark `bg` and `text`, its font is `font-body`; without `dark` it is the light `bg`.
- `apps/web/e2e/pwa.spec.ts` (SETUP-07, unchanged) — the manifest colour is the colour the page
  renders.
- Control values from: `docs/design/mockups/README.md` and the `V3-*` boards (§2).

#### 8. Checked against the source

Nothing to check: no rules fact.

#### 9. Not in this ticket

- The slots, the part styles, the motion presets, the shipped fonts — SHEET-03, 04, 05, 06, each
  in its own empty file made here.
- The rings around the token — the token frame, SHEET-03's slot.
- The lint check against a colour written in a component — SHEET-02.
- Switching light and dark from the screen, and the page's `theme-color` following the skin —
  SHEET-13.
- The real base colours, the real dark theme and the heading font — the owner's (BRIEF Part 5).

#### 10. Rake check

- **No look is written in a component:** the shell's classes name tokens only; Tailwind's
  default palette no longer exists, so `bg-red-500` paints nothing.
- **A skin is data, never code:** the values are plain data maps; only `themeCss()` turns them
  into CSS.
- **No external requests:** no font service; the font names fall back to local fonts.
- **Nothing invisible:** no zero-width character, byte-order mark or non-breaking space in the
  changed files (checked with a Python scan).

#### 11. What came out of it

- `pnpm lint`: 212 files, no fixes. `pnpm typecheck`: green.
- `pnpm test`: 891 passed, 0 failed (879 before, plus 12 in `theme.test.ts`), 9.66 s; the speed
  pass 2 passed, 1.61 s.
- `pnpm e2e`: 13 passed, 0 failed, 8.3 s, with the new `SHEET-01` test and SETUP-07's colour
  test on the new dark `bg`.
- Rebased twice onto rows a parallel chat pushed meanwhile, SHEET-07 and SHEET-02. On top of
  both: `pnpm lint` 214 files, no fixes, SHEET-02's check passing on the shell's new classes;
  `pnpm test` 896 passed, 0 failed, 9.72 s; `pnpm e2e` 15 passed, 0 failed, 7.2 s.
- SHEET-02's lint messages named `bg-background`, `text-primary` and `font-sans` as examples;
  this row removed those tokens, so the messages now name `bg-surface`, `text-muted` and
  `font-body` (`biome/no-look-literals.grit`, the message text only).
- Tokens: 19 colours in each mode, 4 shadows in each mode, 2 fonts, 20 sizes, 4 line heights, 8
  corners, 2 control heights.
- Measured contrast, light / dark: text on bg 15.44 / 15.44; muted on surface 6.13 / 6.89; hp on
  surface 5.35 / 5.33; temp on surface 5.25 / 7.13; danger on surface 6.60 / 6.48; warn text on
  warn bg 7.17 / 9.22; text on a filled button 16.85 / 14.13. The lowest pair is muted on soft in
  light, 5.18.
- The built CSS is 9 289 bytes; `.bg-bg` reads `var(--theme-color-bg)`, and
  `--font-weight-semibold: 600` survives the reset.
- Differs from the row: the README's list did not hold everything the boards use. The swipe
  "Actions" colour (`neutral`), the four dimmed-screen levels (`scrimLow` to `scrimHigh`), the
  other corners and the shadows were measured and added to the README, which stays the owner of
  the mockups' tokens. The token's rings were left to SHEET-03.
- Dark placeholders are dark grey, not black: `#131417`, so the icon's background moved from
  `#0a0a0a` with it.

**Found, not fixed:** written into the notes of SHEET-03 (the token frame's rings), SHEET-05
(the boards' one transition) and SHEET-06 (where the `@font-face` rules go), with the file each
fills.

**Changelog:** "The app paints with the mockups' colours: their light values, and placeholder dark
ones, still dark by default; the icon and the splash screen take the new dark background."

---

### SHEET-14 An unmet prerequisite gives a warning

**Hat:** An unmet prerequisite gives a warning
**Depends on:** ENG-04 (prerequisites), ENG-11 (`compute()`, `Computed.entities`), ENG-27 (Tales'
`unmetPrerequisites`), ENG-32 (a class's `multiclass.prerequisites`)
**Size:** S
**Screen:** No
**SPEC:** §5.5 (prerequisites warn, never block), §8.2

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/prerequisites.ts` — new: `prerequisiteWarnings`, the
`PrerequisiteWarning` type.
- `packages/engine/src/compute.ts` — changes: `SystemModule.prerequisitesOf`, the warnings joined to
  `Computed.warnings`.
- `packages/engine/src/gather.ts` — changes: `GatherableEntity.prerequisites`.
- `packages/engine/src/index.ts` — changes: exports the new file.
- `packages/system-5e/src/classes.ts` — changes: `prerequisitesOf`, the multiclass rule.
- `packages/system-5e/src/module.ts` — changes: gives `prerequisitesOf`.

#### 2. What is missing now

- `git grep -n -i prerequisite HEAD -- packages/engine/src` prints nothing: the core never reads a
  prerequisite.
- In `packages/system-5e/src` the only hits are the schema of `multiclass.prerequisites`
  (`entity-types.ts`) and two comments. No code checks one against a character.
- Tales' `unmetPrerequisites` (ENG-27: Brook, `tales-core:talent/iron-will`) is checked only as
  data (`test-system.test.ts`); `compute()` gives no warning for it.

#### 3. What it should look like when done

1. `compute()` gives one warning `unmetPrerequisite` (`entity`, `prerequisite`, `message`) for
   each prerequisite an entity the character has does not meet, in the order of
   `Computed.entities`, then the entity's order of prerequisites.
2. The check reads the computed values: `ability` is met when `abilities.<key>.score` ≥ `min`
   (a manual edit included); `level`, when `level` ≥ `min`; `entity`, when an entity with that id
   is had; `proficiency`, when a grant gives that category and key; `formula`, when it is true.
3. A formula's warnings (a missing path read as 0, a formula that does not parse) are each a
   `prerequisiteFormula` warning; a formula that does not parse is unmet.
4. Nothing is blocked: the entity stays had, its effects and grants apply, no value changes.
5. Tales: Ash has no prerequisite warning; Brook has two, both Iron Will's (level 4; the craft
   `rope`), so the entities warned are ENG-27's `unmetPrerequisites`.
6. A module may give the prerequisites of an entity itself (`prerequisitesOf`); without it, an
   entity's own `prerequisites` are checked.
7. Fifth edition: a character with two or more classes is checked against each class's
   `multiclass.prerequisites`, its first class's included; a character with one class is not.
   Golden C (both editions) meets them all and still has no warning.

#### 4. How to do it

1. `prerequisites.ts`: `prerequisiteWarnings({ entities, proficiencies, values, prerequisitesOf })`,
   one `switch` on the kind. A value that is not a number, or is missing, reads as 0 (a stat the
   character lacks: unmet for any `min` above 0, with no other warning). A formula runs with
   `evaluateCondition` on the computed values.
2. `GatherableEntity` takes `prerequisites?`, so the core reads them as it reads `grants`.
3. `SystemModule.prerequisitesOf?(character, entity)`; `compute()` uses it, or the entity's own
   list, after the derived values. The warnings sit after the phases' and before the module's rule
   warnings, so ENG-35's "after every other warning" still holds.
4. Fifth edition's `prerequisitesOf`: an entity's own list; a class named in `systemData.classes`
   of a character with two or more classes adds `multiclass.prerequisites`. One rule for both
   editions: the texts agree (§8), and the editions differ only in data.
5. The tests that list Brook's every warning now list Iron Will's two as well.

#### 5. Stored data

Nothing stored changes. `Computed` gains warnings; nothing in `CharacterDoc`, `ContentPack` or a
Dexie table.

#### 6. What a person will see

Not a screen. The manual form (SHEET-27) and the choices badge read these warnings; phase 4's
wizard shows them with what is missing.

#### 7. Tests

- `packages/engine/test/prerequisites.test.ts` — `describe('SHEET-14 an unmet prerequisite gives a
  warning')`: Ash and Brook against ENG-27; Brook's two warnings with their messages; Iron Will
  still applies (`skills.steady.total` 7, its `will` step of 2); each kind met and unmet; a manual
  edit read; a formula's missing path and parse error; a module's `prerequisitesOf`; no value
  changes.
- `packages/system-5e/test/prerequisites.test.ts` — `describe('SHEET-14 a multiclass character
  meets each class's multiclass prerequisites')`: golden C 2014 and 2024 with no warning; each
  score below 13 warns, the first class's too; one class asks none; the 2024 fighter's "Strength
  13 or Dexterity 13".
- Control numbers from: ENG-27's `tales/expected.ts`; Tales' data (Brook level 3, nerve 8 at its
  maximum; Ash's lore `stars`, knack `climb`); golden C's scores (SPEC §6.7: Strength 13,
  Intelligence 15, Charisma 14) and the fixtures' 13s (ENG-32 §8). The changed scores are test
  data.

#### 8. Checked against the source

Sources: foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` (the commit ENG-32 read),
`packs/_source/rules/chapter-6-customization-options.yml` (SRD 5.1) and
`packs/_source/content24/chapter-2/character-creation.yml`, `content24/chapter-5/feats.yml`
(SRD 5.2.1), CC-BY-4.0.

- Multiclassing, SRD 5.1, "Prerequisites": "To qualify for a new class, you must meet the ability
  score prerequisites for both your current class and your new one, as shown in the Multiclassing
  Prerequisites table."
- Multiclassing, SRD 5.2.1, "Prerequisites": "To qualify for a new class, you must have a score of
  at least 13 in the primary ability of the new class and your current classes."
- So both check every class of a multiclass character, the first included, and a single class
  asks nothing. The 13s and the fighter's "or" are the fixtures' data (ENG-32 §8).
- Feats, SRD 5.1: "You must meet any prerequisite specified in a feat to take that feat. If you
  ever lose a feat's prerequisite, you can't use that feat until you regain the prerequisite."
- Feats, SRD 5.2.1, "Prerequisite": "To take a feat, you must meet any prerequisite in its
  description unless a feature allows you to take the feat without the prerequisite. If a
  prerequisite includes a class, you must have at least 1 level in that class to take the feat."
  An `entity` prerequisite naming a class is met by having the class, which is at least 1 level.
- SPEC §5.5: prerequisites do not block a choice; they give a warning. This ticket follows it: the
  entity applies whether or not it is met (see §11 for SRD 5.1's second sentence).

#### 9. Not in this ticket

- The words on screen for each warning: the screen rows that show them (SHEET-27, SHEET-36) and
  phase 4's wizard.
- The house rule `multiclass` (whether a second class may be taken at all): phase 4's level-up.
- A proficiency's level: a prerequisite names a proficiency, not a level, so a grant at any level
  meets it. No SRD prerequisite asks for expertise.
- A proficiency an effect gives (SPEC §5.4's target `skills.<key>.prof`) rather than a grant: not
  read, since the core does not know which path a category is. `grep` finds no effect with such a
  target in `packages/` today.

#### 10. Rake check

- **Prerequisites warn; they never block.** The check only adds warnings, after every value is
  computed; a test shows Iron Will's effect and Brook's values unchanged.
- **The core names no game.** The core checks SPEC §5.5's five kinds; the multiclass rule lives in
  the fifth-edition module (`classes.ts`), with no edition check.
- **Formulas never run code.** A `formula` prerequisite runs through `evaluateCondition`; a missing
  path is 0 with a warning, a bad formula is a warning, nothing throws.
- **Missing is not broken.** An `entity` prerequisite naming an id no pack has is unmet, with no
  `missing` warning of its own.
- **Golden values.** No expected value changed; golden C still has no warning.

#### 11. What came out of it

- Quality gate, run on top of SHEET-07, SHEET-02 and SHEET-01: `pnpm lint` clean (217 files);
  `pnpm typecheck` clean; `pnpm test` 916 passed, 0 failed in the unit project (22.4 s), 2 passed
  in the speed project. 20 tests are new (13 in the engine, 7 in the module); without them, 896.
- Coverage of the whole run: statements 99.5 % (3199 / 3215), branches 96.99 %.
- 12 earlier engine tests listed Brook's (or Ash with Iron Will's) every warning; each now lists
  Iron Will's two `unmetPrerequisite` warnings too. ENG-12's stat test now also checks the
  entities warned against ENG-27's `unmetPrerequisites`. No expected value changed.
- Differs from §3: nothing.
- Found, not fixed: SRD 5.1's feats say a feat whose prerequisite is lost "can't" be used until it
  is regained; SPEC §5.5 and §8.2 say prerequisites warn and never block, so the feat still
  applies, with the warning. Whether a feat with an unmet prerequisite stops applying is the
  owner's call; nothing changes until she decides.
- Nothing for the changelog: no screen shows the warnings yet.
