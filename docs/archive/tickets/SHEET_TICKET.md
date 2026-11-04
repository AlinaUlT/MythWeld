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

### SHEET-15 Resistances, immunities, vulnerabilities are computed from effects

**Hat:** Compute the character's defenses from the effects it has
**Depends on:** Nothing (phase 1 is closed)
**Size:** S
**Screen:** No
**SPEC:** §5.4 (the `defenses.*` targets), §6.1 steps 3, 6 and 7, §6.2, §8.2

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/defenses.ts` — new.
- `packages/system-5e/src/module.ts` — `derive` adds `defenseSteps`, `ruleWarnings` adds
  `defenseWarnings`.
- `packages/system-5e/src/index.ts` — exports `defenses.ts`.
- `packages/engine/src/derived.ts` — `DeriveInput` gains `findKey`.
- `packages/engine/src/compute.ts` — builds `findKey` once and passes one `DeriveInput` to every
  hook.
- `packages/engine/src/effects.ts` — new export `effectApplies`.

#### 2. What is missing now

Measured on `main` at `138757e`, 2026-10-28:
- `grep -rn "defenses" packages/*/src` finds nothing. SPEC §5.4 names `defenses.resist`,
  `immune`, `vuln`, `conditionImmune` (`append`), and the schema accepts such effects
  (`packages/schema/test/mechanics.test.ts` line 49).
- An `append` on `defenses.resist` is gathered and then dropped without a word: `phasesOf().end()`
  skips an op that gives no number on a target no path finished (ENG-17 §3 item 5;
  `packages/engine/test/phases.test.ts`, the `resist` effect).
- A module's `derive` gets `find` (by id) but no way to find an entry by its type and key; only
  `entities()` gets `findKey` (ENG-62).

#### 3. What it should look like when done

1. A character with no effect on a list has no `defenses.*` path (golden C 2014: `{}`).
2. Each key an effect appends to `defenses.<list>` is a number path `defenses.<list>.<key>`: 1
   while an effect appending it applies, else 0. The path exists whatever the effect's `when` or
   switch says now, so a formula reads it either way.
3. Its breakdown has one `effect` step (`op: 'append'`, value 1) for each effect that applies; the
   first changes it by 1, the others by 0. Two sources of one defense give 1.
4. A toggled effect counts by the stored switch, else by its default, as every effect does.
5. An override of 0 takes a defense away; its breakdown ends with the `override` step (−1).
6. A formula reads the path: `when: '@defenses.resist.bludgeoning'` applies while it is 1.
7. A key no entry of its list's type has (`damageType` for `resist`, `immune`, `vuln`;
   `condition` for `conditionImmune`) still counts, and warns `stepRule` `defenseMissing` with
   `{ list, key }` (SPEC §8.2).
8. An effect on a list that gives no key warns `characterRule`: `defenseNotAppended` (an op other
   than `append`, `note` or a number op, with `{ part, list, op }`), or `defenseNotAKey` (an
   `append` whose value is not a key, with `{ part, list }`). A number op on a list warns the
   phases' `noTarget`. A `note` is left alone.
9. `defensesOf(values)` gives `{ resist, immune, vuln, conditionImmune }`, each the keys whose path
   is above 0: what SHEET-16 and the sheet read.
10. The core: `DeriveInput.findKey` finds an entry by type and key (Tales: `condition`/`lost` is
    found, `condition`/`gone` is not); `effectApplies` is `true` or `false` by the `when`, and a
    `when` that does not parse warns `formula` and gives `false`.

#### 4. How to do it

1. The four lists and their entity types are the module's data:
   `DEFENSE_LISTS = { resist: 'damageType', immune: 'damageType', vuln: 'damageType',
   conditionImmune: 'condition' }`. The core names none of them.
2. A defense is a number path per key, not a new kind of list value in `Computed`: the core's
   numbers already give a breakdown, an override that wins, and a formula read. No core shape
   changes.
3. `defenseSteps`: the effects on the lists, as `activeEffects` gives them with every switch on,
   grouped by path; each path's step keeps those active by the real switches whose `when` is true
   (`effectApplies`, through `readBy(part)`).
4. `defenseWarnings` sees the effects that give no key; it runs as `ruleWarnings` because no path
   exists for an effect that names none.
5. `effectApplies(active, reader, warn)` wraps the effects' own `applies`, with the entity's own
   paths, for an effect whose value is no formula. `DeriveInput.findKey` is `keyFinderOf`, built
   once in `compute()`.

#### 5. Stored data

Nothing stored changes. Overrides of `defenses.<list>.<key>` use the existing `overrides` list.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/defenses.test.ts` — `describe('SHEET-15 defenses from effects')`, 10
  tests: §3 items 1–9, on golden C of both editions with made-up feats and a made-up condition.
- `packages/engine/test/derived.test.ts` — `describe('SHEET-15 what a step finds by key, and
  whether an effect applies')`, 2 tests: §3 item 10, on Tales.
- Control numbers from: the made-up entities in the tests, worked out by hand (golden C is level
  6, so `@level >= 20` is false); the SRD packs' damage types (`bludgeoning` in
  `srd-2014.ts`, `slashing` in `srd-2024.ts`). No golden value is read or changed.

#### 8. Checked against the source

Sources, read 2026-10-28: SRD 5.1 as 5e-bits/5e-srd-api quotes it at
`e6edf9a51fad4b59a7e9561fad6c15232caed214` (`packages/5e-database/src/2014/en/5e-SRD-Rules.json`,
`5e-SRD-Conditions.json`; `2024/en/5e-SRD-Conditions.json`); SRD 5.2.1 as foundryvtt/dnd5e at
`7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` quotes it
(`packs/_source/content24/chapter-1/damage-and-healing.yml`, `appendices/rules-glossary.yml`). The
same commits as ENG-62. All CC-BY-4.0.

**One instance.** SRD 5.1 (Damage Resistance and Vulnerability): "Multiple instances of resistance
or vulnerability that affect the same damage type count as only one instance." SRD 5.2.1 (No
Stacking): "Multiple instances of Resistance or Vulnerability that affect the same damage type count
as only one instance." So a path is 1 however many effects give it (§3 item 3).

**The order, for SHEET-16.** SRD 5.1: "Resistance and then vulnerability are applied after all
other modifiers to damage." SRD 5.2.1 (Order of Application): "adjustments such as bonuses,
penalties, or multipliers are applied first; Resistance is applied second; and Vulnerability is
applied third." SRD 5.2.1 rounds the halving down ("halved against you (round down)").

**Immunity.** SRD 5.2.1 (chapter 1, Immunity): "Immunity to a damage type means you don't take
damage of that type, and Immunity to a condition means you aren't affected by it." Rules Glossary
(Immunity): "If you have Immunity to a damage type or a condition, it doesn't affect you in any
way." SRD 5.1's Petrified: "The creature is immune to poison and disease"; SRD 5.2.1's: "You have
Immunity to the Poisoned condition."

**"All damage".** Petrified in both: SRD 5.1 "The creature has resistance to all damage."; SRD
5.2.1 "You have Resistance to all damage." No damage type is "all": a pack writes one `append` per
damage type (§9).

**Bloodied.** SRD 5.2.1 (Rules Glossary, Bloodied): "A creature is Bloodied while it has half its
Hit Points or fewer remaining." SRD 5.1 has no such term. It is not a defense (§9).

#### 9. Not in this ticket

- Applying the defenses to damage: SHEET-16.
- A condition the character is immune to still applies, and can still be set: SHEET-61, new.
- Bloodied gets no path. It is a state of the hit points, not a defense, it exists in one edition
  only, and nothing in phase 2 reads it. A row writes it when something does (a monster in the DM
  phase, a feature in phase 3's import).
- "Resistance to all damage" (Petrified) and the 2014 qualified kinds ("nonmagical" bludgeoning,
  Stoneskin): no key `all` and no qualifier. A pack writes Petrified as one `append` per damage
  type; a qualified one stays a `situational` note until a row needs it (CONT, phase 3).
- Showing the defenses on the sheet: the wave 6 tabs read `defensesOf`.

#### 10. Rake check

- **The core names no game:** the four lists, `damageType` and `defenses` live in
  `system-5e/src/defenses.ts`; the core gains only `findKey` and `effectApplies`, both game-free
  and tested on Tales.
- **Everything is data:** a damage type is any entry of type `damageType`; a pack's own type
  works as an SRD one. No damage type or condition is named in code.
- **No number without a breakdown:** each path's steps name the effects; the tests check that
  every breakdown adds up to its value.
- **Manual overrides always win:** the path is finished by the phases, so an override applies last
  (§3 item 5).
- **Missing is not broken:** a key with no entry still counts and warns; a bad `when` warns and
  does not apply; nothing throws.
- **Formulas never run code:** `when` goes through the formula parser, as every effect's does.
- **No rules text without an open license:** the test entities are made up; the quotes in §8 are
  CC-BY-4.0.

#### 11. What came out of it

Quality gate, 2026-10-28, on `main` at `78390e0` (SHEET-01, 02, 07 landed while this ran):
`pnpm lint` 216 files, no fixes; `pnpm typecheck` 6 projects, no errors; `pnpm test` 66 files,
908 passed, 0 failed, 15.3 s, then the speed project 1 file, 2 passed. Before the rebase: 891
passed, against 879 without this ticket (+12). Coverage: statements 99.53 % (3227/3242), lines
99.92 % (2833/2835). Not `apps/web`, so no `pnpm e2e`.

Differences from §3: none. The first draft gave a path only for an effect switched on, so a
switched-off toggle's key had no path and a formula reading it warned `missingPath`; the test of
§3 item 4 found it, and the paths now come from every switch on.

Re-cut: SHEET-61 is a new row in wave 2, after SHEET-22, with its note in `BACKLOG.md`. SHEET-16's
note now points at `defensesOf` and §8.

Found, not fixed:
- A condition the character is immune to still applies its effects and can still be set
  (SHEET-61).
- `defenseWarnings` are `characterRule` warnings, not the `notAppended` / `notAKey` effect
  warnings: an effect that names no key has no path to carry one. No change needed now.

Nothing for the changelog.

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

- Quality gate, run on top of SHEET-07, SHEET-02, SHEET-01 and SHEET-15: `pnpm lint` clean (219
  files); `pnpm typecheck` clean; `pnpm test` 928 passed, 0 failed in the unit project (22.6 s), 2
  passed in the speed project. 20 tests are new (13 in the engine, 7 in the module); without
  them, 908.
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

---

### SHEET-19 Rolling initiative interrupts a knock-out's rest

**Hat:** Rolling initiative interrupts a knock-out's rest
**Depends on:** ENG-65 (`state.knockedOut`, `KNOCKED_OUT_PATH`, `firstAid`, `shortRest`'s end of
the mark)
**Size:** XS
**Screen:** No
**SPEC:** §6.4 (the tracker actions); ENG-65 §9 and §11 put the row here

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/knock-out.ts` — changes: new `rollInitiative`,
`InitiativeRefusal`.
- `packages/system-5e/test/knock-out.test.ts` — the SHEET-19 tests.

#### 2. What is missing now

Measured on 2026-10-28 at `a500ec0`:
- `grep -rn knockedOut packages/*/src`: the mark is written by `applyDamage` (`resting`, or
  `interrupted` on damage) and removed by `knockOutEnded`; nothing else writes `interrupted`.
- `grep -rni initiative packages/system-5e/src`: only the computed `init.*` numbers and the roll
  mode (`combat.ts`, `rolls.ts`); no action.
- So a knocked-out character who rolls initiative and then takes a short rest has the mark
  removed by `shortRest`, though SRD 5.2.1 says that rest gave nothing.

#### 3. What it should look like when done

"Knocked out" is golden B (2024) at 1 hit point with `knockedOut: 'resting'`, as in ENG-65 §3.
1. `rollInitiative(character, index, stamp)` on a knocked-out character: one change,
   `KNOCKED_OUT` `resting` → `interrupted`; the entry `{ action: 'rollInitiative', subject:
   'knockedOut' }`; hit points stay 1; still knocked out, the Unconscious level 1. The entry
   reversed gives the character before.
2. After it, `shortRest` with no hit die is refused as `unchanged` (ENG-65 §3 item 16's
   `interrupted` case).
3. Golden A (2014) with the mark `resting`: the same as item 1 (the stored mark decides, ENG-65
   §3 item 13).
4. Refused as `unchanged`: knocked out with `interrupted`; golden B at 12 hit points; golden B at
   0 with no mark.
5. Refused as `dead`: golden B at 0 with 3 failures and the mark `resting`.
6. A frozen input: nothing throws, nothing changes.

#### 4. How to do it

1. `knock-out.ts`: `rollInitiative`, one entry through `settled`; the change is `resting` →
   `interrupted`, any other mark kept, so `settled` refuses it as `unchanged`.
2. Tests (§7), then the gate.

Technical choices (ADR 002):
- **The action records that initiative was rolled, not the roll.** The total belongs to the roll
  log (SHEET-37, the device table `rollLog`), and the character stores no initiative. So the
  action takes no number and changes only the mark.
- **`unchanged` is its usual answer.** The roll dialog calls it after every initiative roll; most
  characters are not knocked out, and the refusal changes nothing and goes in no history.
- **The dead are refused**, as `firstAid` refuses them: a dead creature rolls no initiative, and a
  revival removes the mark anyway (ENG-65).
- **No edition check.** Only SRD 5.2.1's knock-out gives the mark, and a stored mark is the truth
  whatever the edition, as `compute()` reads it (ENG-65 §4).

#### 5. Stored data

Nothing stored changes. `state.knockedOut` already holds `interrupted` (ENG-65, version 6).

#### 6. What a person will see

Not a screen. The roll dialog (SHEET-39) calls the action; its note in `BACKLOG.md` says so.

#### 7. Tests

- `packages/system-5e/test/knock-out.test.ts` — `describe('SHEET-19 rolling initiative interrupts
  the knock-out rest')`: items 1–6.
- Control values from: the SRD text of §8; ENG-65 §3 (golden B knocked out at 1, the Unconscious
  level 1, the short rest of an `interrupted` mark refused as `unchanged`).

#### 8. Checked against the source

SRD 5.2.1 as foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` quotes it
(`packs/_source/content24/appendices/rules-glossary.yml`, Short Rest), read again 2026-10-28, the
same file and commit as ENG-65 §8. CC-BY-4.0. "Interrupting the Rest. A Short Rest is stopped by
the following interruptions: Rolling Initiative; Casting a spell other than a cantrip; Taking any
damage. An interrupted Short Rest confers no benefits."

No golden value is touched; no rules source disagrees with the SPEC. Nothing stops.

#### 9. Not in this ticket

- Recording the initiative total: the roll log (SHEET-37) and the roll dialog (SHEET-39).
- Casting a spell other than a cantrip, the third interruption: an unconscious creature takes no
  action; casting's checks are SHEET-17.
- A short rest the person takes, interrupted: the Rest frames (SHEET-45). This action touches
  only the knock-out's rest.

#### 10. Rake check

- **Each system's rules live in its module.** The action is the fifth-edition module's; the core
  changes nothing; no `if (ruleset === …)`.
- **The engine is pure.** The action takes the stamp and returns a new character; the
  frozen-input test.
- **A stored-shape change needs a migration.** None changes (§5).
- **Licensing.** The SRD text is quoted in this ticket only; the test data holds numbers and keys.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-28, on `main` at `a500ec0`:
- Before: `pnpm test` `Tests 928 passed (928)` in the unit project, 2 in the speed project.
- After: `pnpm lint` `Checked 219 files`, no fixes; `pnpm typecheck` 6 of 6 `Done`; `pnpm test`
  `Test Files 68 passed (68)`, `Tests 932 passed (932)`, 18.29 s, and `2 passed` in the speed
  project. 4 tests are new, all in `knock-out.test.ts` (14 → 18). No file in `apps/web` changed,
  so no `pnpm e2e`.
- The tests catch mistakes. 4 breaks, each made alone in `knock-out.ts`, then `knock-out.test.ts`
  run, the file restored and compared equal after each: every mark turned `interrupted`, 1
  failed; nothing interrupted, 2; the mark removed instead, 1; the dead allowed, 1.
- Differs from §3: nothing. Size XS held.
- Found, not fixed: nothing.
- Nothing for the changelog: no screen calls it yet.

---

### SHEET-17 Casting warns of what forbids it

**Hat:** A cast gives the warnings of the rules that forbid it
**Depends on:** ENG-20 (`castSpell`), ENG-46 (`spell.cannotCast`), ENG-62 (the Unconscious
condition at 0 hit points), ENG-11 (`conditions.<key>.level`)
**Size:** S
**Screen:** No
**SPEC:** §6.4 (slots and concentration); §8.2 and `CLAUDE.md` (rules warn, never block); ENG-46 §4

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/casting.ts` — changes: new `INCAPACITATED_CONDITION`,
`CastWarning`, `castWarnings`, `CastResult`; `castSpell` returns `CastResult`, its warnings in
`outcome`.
- `packages/system-5e/test/cast-warnings.test.ts` — new.
- `docs/tickets/BACKLOG.md` — the row closes; SHEET-47's note names what it reads.

#### 2. What is missing now

Measured on `main` at `a500ec0`, in a test written for it, then deleted:
- Golden C (2014) as its wizard 3 alone, in the SRD chain mail (no heavy armor training, so
  `spell.cannotCast` is 1, ENG-46), casting a made-up level 1 spell with a level 1 slot:
  `ok: true`, the keys `ok,character,entry`, the one change `slotsSpent.1` → 1. No warning.
- Golden A (2014) storing a made-up condition of key `incapacitated`, casting Bless with a level 1
  slot: `ok: true`, the keys `ok,character,entry`, the changes `slotsSpent.1` → 1 and
  `concentration` → Bless. No warning.
- `grep -n "cannotCast\|incapacitated" packages/system-5e/src/casting.ts`: nothing.
- `pnpm test`: unit `Test Files 68 passed (68)`, `Tests 928 passed (928)`, 20.87 s; speed
  `Test Files 1 passed (1)`, `Tests 2 passed (2)`, 3.21 s.

#### 3. What it should look like when done

Golden C as its wizard 3 alone (ENG-46's "the wizard"), in the SRD chain mail of its edition; the
SRD shield of 2014. Golden A (2014): cleric 1, two level 1 slots, Bless (concentration). The made-up
spells are `action-checks.ts`'s (`ownSpell`). Two own conditions, numbers and names only:
`character:condition/incapacitated`, key `incapacitated`; `character:condition/unconscious`, key
`unconscious`, with an `entity` grant of the first, as both SRDs' Unconscious gives Incapacitated
(§8). Every value is worked out by hand from §8, ENG-46's test and the data.

1. `INCAPACITATED_CONDITION` is `'incapacitated'`.
2. `castWarnings(computed)` gives, in this order:
   - `{ code: 'cannotCast', steps }` while `spell.cannotCast` is 1 or more, `steps` its breakdown;
   - `{ code: 'incapacitated', condition }` while `conditions.incapacitated.level` is 1 or more,
     `condition` the id of the entry of that key.
3. The 2014 wizard in chain mail: `[{ code: 'cannotCast', steps: [{ kind: 'rule', rule:
   'untrainedArmor', value: 1, change: 1 }] }]`. With the 2014 shield as well: the steps
   `untrainedArmor` 1/1 and `untrainedShield` 1/0. The 2024 wizard in its chain mail: the
   `untrainedArmor` step alone. The 2024 wizard with a shield only gives no warning (2024's
   untrained shield takes its AC, not spells, ENG-46).
4. Golden A storing the Incapacitated condition: `[{ code: 'incapacitated', condition:
   'character:condition/incapacitated' }]`.
5. Golden A at 0 hit points with both own conditions: the Unconscious one is had by ENG-62's rule,
   its grant gives the Incapacitated one: the same warning as item 4. Golden B (2024) as ENG-20's
   hexer 3 wears its chain mail without training (ENG-46 §11: `spell.cannotCast` 1 for golden B as
   the hexer 3): at 0 hit points, the `untrainedArmor` warning and item 4's; at 12, the first
   alone.
6. Golden A at 0 hit points with an Unconscious condition that grants nothing: no warning. The pack
   decides what the Unconscious condition includes.
7. Golden A at 12 hit points with both own conditions, none stored: no warning.
8. The 2014 wizard in chain mail storing the Incapacitated condition: two warnings, `cannotCast`
   first.
9. `castSpell` warns and never blocks: the wizard in chain mail casting the level 1 spell with a
   level 1 slot gives `ok: true`, the change `slotsSpent.1` → 1 as before, and `outcome.warnings`
   item 3's. Golden A storing Incapacitated casting Bless with a level 1 slot: the changes
   `slotsSpent.1` → 1 and `concentration` → Bless as before, `outcome.warnings` item 4's. Golden A
   with nothing: `outcome.warnings` `[]`.
10. A refusal stays as it was: the incapacitated golden A casting a made-up cantrip with no
    concentration is refused `unchanged`; `castWarnings` still gives item 4's warning for the
    screen to show before the cast.
11. Every existing test passes unchanged; the quality gate is green.

#### 4. How to do it

1. `casting.ts`: `INCAPACITATED_CONDITION`, `CastWarning`, `castWarnings(computed)`; `castSpell`
   computes the character before the cast and returns its warnings in `outcome`.
2. Tests (§7), then the gate.

Technical choices (ADR 002):
- **Both warn; none refuses.** The row asks which refuses and which warns. Both SRDs forbid the
  cast in each case (§8), and both are rules, not bookkeeping: `CLAUDE.md` and SPEC §8.2 have rules
  warn and never block, and ENG-46 §4 made `spell.cannotCast` a path for that reason. A cast can
  still be the person's or the table's call (a DM's ruling, a feature the packs do not have yet).
  The refusals `castSpell` already has stay: they are about what is stored (a slot that is not
  there cannot be spent), not about a rule.
- **Incapacitated is read by its key, as data.** The module reads
  `conditions.incapacitated.level`, as ENG-62 reads `unconscious`. Which conditions include it
  (Unconscious, Paralyzed, Petrified, Stunned in both SRDs, §8) is each entry's `entity` grant in
  its pack, never a list in code: a homebrew condition that grants it warns the same way, and
  item 6's entry that grants nothing does not.
- **The "cannot cast" warning carries the path's breakdown**, not a fixed list of rule names: the
  screen shows the steps as any breakdown (`untrainedArmor`, `untrainedShield`), and an effect a
  homebrew entry puts on `spell.cannotCast` warns with its own step.
- **`castWarnings` is exported**, so the cast screen (SHEET-47) shows the warning before the person
  presses Cast, a cantrip included, which `castSpell` refuses as `unchanged` when it changes
  nothing. `castSpell`'s `outcome.warnings` is the same list, for the screen after a cast, as
  `revive`'s `outcome.warnings` (ENG-66).
- **The cast is still the cast.** Its changes do not depend on the warnings: a concentration spell
  cast while incapacitated is still held. Ending concentration because of the Incapacitated
  condition is not a cast's rule (§9).

#### 5. Stored data

Nothing stored changes. The warnings are computed; `castSpell`'s entry is the same entry.

#### 6. What a person will see

Not a screen. SHEET-47 (the cast dialog) shows `castWarnings` before Cast, and the steps of a
`cannotCast` warning as a breakdown.

#### 7. Tests

- `packages/system-5e/test/cast-warnings.test.ts` — `describe('SHEET-17 casting warns of what
  forbids it')`: §3 items 1–10.
- Control values from: ENG-46's test (`training.test.ts`: the steps of `spell.cannotCast` for the
  wizard in chain mail, with the shield, in 2024); ENG-20's test (golden A's two level 1 slots and
  Bless, the hexer's pact slots); ENG-62 (golden A's and B's Unconscious at 0 hit points); §8.

#### 8. Checked against the source

Sources, read 2026-10-28: SRD 5.1 as 5e-bits/5e-srd-api quotes it at
`e6edf9a51fad4b59a7e9561fad6c15232caed214` (`packages/5e-database/src/2014/en/5e-SRD-Conditions.json`,
`5e-SRD-Rules.json`); SRD 5.2.1 as the same commit's `2024/en/5e-SRD-Conditions.json` and
foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` quote it
(`packs/_source/content24/chapter-7/spells.yml`). The same commits as ENG-62. All CC-BY-4.0.

**Armor without training.** ENG-46 §8 quotes both: SRD 5.1 (Armor Proficiency) and SRD 5.2.1
(Armor Training) say "you can't cast spells" for armor worn without its training; 2014 says it of a
shield too, 2024 does not. `spell.cannotCast` already holds this (ENG-46).

**Incapacitated.** SRD 5.1 (Incapacitated): "An incapacitated creature can't take actions or
reactions." SRD 5.2.1 (Incapacitated): "Inactive. You can't take any action, Bonus Action, or
Reaction." and "No Concentration. Your Concentration is broken."

**Every cast takes one of those.** SRD 5.1 (Casting Time): "Most spells require a single action to
cast, but some spells require a bonus action, a reaction, or much more time to cast"; (Longer
Casting Times): "you must spend your action each turn casting the spell". SRD 5.2.1 (Casting
Time): "Most spells require the Magic action to cast, but some spells require a Bonus Action, a
Reaction, or 1 minute or more"; (Longer Casting Times): "you must take the Magic action on each of
your turns". So no cast is possible while incapacitated, in either edition.

**Which conditions include Incapacitated.** SRD 5.1: "A paralyzed creature is incapacitated", "The
creature is incapacitated" (Petrified), "A stunned creature is incapacitated", "An unconscious
creature is incapacitated". SRD 5.2.1: Paralyzed, Petrified and Stunned each "Incapacitated. You
have the Incapacitated condition."; Unconscious "Inert. You have the Incapacitated and Prone
conditions". One rule in both editions; the entries' data (phase 3) carries it.

**Concentration while incapacitated.** SRD 5.1 (Concentration): "You lose concentration on a spell
if you are incapacitated or if you die." SRD 5.2.1: "Your Concentration is broken" (above). Not a
cast's rule (§4, §9).

No golden value is touched; no rules source disagrees with the SPEC. Nothing stops.

#### 9. Not in this ticket

- Showing the warnings: SHEET-47 (the cast dialog).
- Gaining the Incapacitated condition ending concentration (both SRDs, §8): no action ends it
  today but damage to 0 (ENG-20). Found, not fixed (§11).
- Verbal components while the character can't speak (Unconscious, Paralyzed, Petrified, 2024's
  Incapacitated "Speechless"), and the one-slot-a-turn rule of each edition: a turn and a spell's
  components are not tracked; phase 3 or the turn screen.
- A dead character casting: death is not a condition; the sheet's dead state is phase 2's screens.

#### 10. Rake check

- **The core names no game.** Everything is in `system-5e`; the keys `incapacitated` and the path
  `spell.cannotCast` are the module's.
- **Everything is data.** Which conditions include Incapacitated is each entry's grant, not a list
  in code (§4).
- **`compute()` is pure.** `castWarnings` reads a `Computed`; `castSpell` computes and changes
  nothing more than before.
- **Rules warn, never block** (§8.2). No new refusal.
- **Each system's rules live in its module; no `if (ruleset === …)`.** The edition's difference
  (2024's shield) stays in `rulesets/` through ENG-46's `untrained`; the Incapacitated rule is one
  rule in both editions.
- **A stored-shape change needs a migration.** None changes (§5).
- **Licensing.** The rules are quoted from the CC-BY-4.0 SRDs in this ticket only; the test entries
  hold names and numbers, no rules text.

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured:
- Before (`a500ec0`): `pnpm test` unit `Test Files 68 passed (68)`, `Tests 928 passed (928)`,
  20.87 s; speed `Tests 2 passed (2)`, 3.21 s.
- After: `pnpm test` unit `Test Files 69 passed (69)`, `Tests 935 passed (935)`, 21.23 s; speed
  `Tests 2 passed (2)`, 3.65 s. 7 are new, all in `cast-warnings.test.ts`.
- Lint: `Checked 220 files`, no error. Typecheck: `Scope: 6 of 7 workspace projects`, all 6
  `Done`. No file in `apps/web` changed, so no `pnpm e2e`.
- Rebased onto SHEET-19: unit `Test Files 69 passed (69)`, `Tests 939 passed (939)`, 20.99 s;
  speed `Tests 2 passed (2)`, 3.66 s; lint `Checked 220 files`, no error; typecheck 6 of 6 `Done`.
- The 2014 wizard in chain mail casting a level 1 spell: the change `slotsSpent.1` → 1 as before,
  `outcome.warnings` `[{ code: 'cannotCast', steps: [untrainedArmor 1/1] }]`. Golden A storing
  Incapacitated casting Bless: `slotsSpent.1` → 1 and `concentration` → Bless as before,
  `outcome.warnings` `[{ code: 'incapacitated', condition: 'character:condition/incapacitated' }]`.
- The tests catch mistakes. Each change made alone in `casting.ts`, then `cast-warnings.test.ts`
  and `casting.test.ts` run (18 tests); each failed at least one, and the file was restored
  (compared equal to its copy): the outcome always empty, 1 failed; the condition's level ignored,
  4; `spell.cannotCast` never read, 4; the key `unconscious` read for `incapacitated`, 4; a cast
  refused while it warns, 2.

Differences from §3:
- Item 5 first said golden B as the hexer 3 gives the Incapacitated warning alone. Golden B wears
  its chain mail, which the hexer gives no training for, as ENG-46 §11 measured; the first run
  showed the `untrainedArmor` warning too. §3 now says so; the run's value matches ENG-46's.
- Size S held.

Found, not fixed:
- Gaining the Incapacitated condition does not end concentration: `setConditionLevel` (ENG-69)
  leaves `state.concentration`, though both SRDs end it (§8). Damage to 0 and a knock-out already
  end it (`applyDamage`). New row **SHEET-62** (XS), wave 3, after SHEET-61.

Nothing for the changelog: no screen shows the warnings yet (SHEET-47).

---

### SHEET-03 Screens draw named slots the base theme fills

**Hat:** the skin slots as data
**Depends on:** SHEET-01
**Size:** S
**Screen:** Yes — the current shell: its background, its page and its bottom bar become slots;
the values are those of the `V3-*` boards and `docs/design/mockups/README.md`
**SPEC:** ADR 015 items 1, 6 and 13

---

#### 1. Where the code lives

**Main file:** `apps/web/src/theme/slots.ts` — changes (empty since SHEET-01): the slot names,
the CSS properties each sets, and the base theme's values.
- `apps/web/src/theme/Slot.tsx` — new: the component a screen draws a slot with.
- `apps/web/src/shell/AppShell.tsx` — changes: the shell draws the `app`, `page` and `dock`
  slots instead of its own `bg-bg`.
- `apps/web/test/theme.test.ts` — changes: the `index.css` mapping check leaves out slot keys.
- `docs/tickets/BACKLOG.md` — changes: the phase 2 note tells screen rows to draw with `<Slot>`.

#### 2. What is missing now

- `apps/web/src/theme/slots.ts` is `export const slots: ThemePart = {};`.
- A screen paints its background with a Tailwind colour class (`AppShell.tsx`: `bg-bg` twice).
  A background class can only hold a colour, so a skin could not put a gradient or a picture
  there.
- The token's rings exist only on the boards. Measured with `grep -o` over `V3-*.html`:
  `0 0 0 2px #FFFFFF, 0 0 0 4px #1C1D20` 18 times in 16 boards; in `V3-Token`, the frame choice
  "Thin" `0 0 0 1px #5E6269` and "Double" `0 0 0 2px #FFFFFF, 0 0 0 3px #1C1D20, 0 0 0 5px
  #FFFFFF, 0 0 0 6px #1C1D20`, next to "Ring".
- The boards' other slot looks: the sheet's header `#FFFFFF`; the dock `#FFFFFF` with
  `0 -4px 12px rgba(0, 0, 0, 0.05)`; cards and die tiles `#FFFFFF`; a filled button and the
  portrait's circle `#1C1D20`; the page `#F5F5F3`.

#### 3. What it should look like when done

1. 12 slots exist, named in `slotProperties`: `app`, `page`, `character-page`, `header`, `dock`,
   `card`, `button`, `portrait`, `token-frame-thin`, `token-frame-ring`, `token-frame-double`,
   `dice`.
2. Each slot property has one theme key `slot-<slot>-<property>`, filled by the base theme in
   both modes; no other `slot-` key is filled.
3. Each light value, with its tokens read, equals what the board draws (the values of §2).
4. The page slots are `transparent`, so the app background shows through them.
5. `<Slot name as>` draws the element asked for, with `data-skin-slot` and a style whose every
   property reads `var(--theme-slot-…)`; a style the screen passes cannot override the slot's.
6. The built shell has 3 slots: `app` paints the dark `bg`, `page` is clear, `dock` paints the
   dark `surface` with the dark dock shadow.
7. Setting `--theme-slot-app-background` to a gradient at run time paints the gradient, with no
   component changed.

#### 4. How to do it

1. `slotProperties` maps each slot to the CSS properties it sets. `background` (the shorthand,
   so a value may be a colour, a gradient or a `url()` picture, an animated one included) or
   `box-shadow` (the rings).
2. `slots` fills each key in `shared` with a reference to a colour or shadow token, so light and
   dark follow their own colours without a second copy.
3. `slotStyle(name)` builds the inline style; `Slot` spreads the screen's style first, then the
   slot's.
4. Slot keys are not Tailwind utilities, so `index.css` does not map them; SHEET-01's mapping
   test leaves them out.
5. The token frame is three slots, one per frame the person picks on `V3-Token` (SHEET-56 stores
   the choice), so a skin can fill each.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

The current shell at 360×800. No new text, so no i18n key.
- The bottom bar takes the dock's look: dark `surface` `#1C1D21` (was `bg` `#131417`), with the
  dark dock shadow.
- The page and its background look as before.

#### 7. Tests

- `apps/web/test/slots.test.tsx` — the 12 names; every key filled in both modes and no other;
  11 light values against the `V3-Sheet`, `V3-Dice` and `V3-Token` boards; the clear pages;
  `slotStyle('dock')`; `<Slot>` rendered to HTML.
- `apps/web/e2e/theme.spec.ts` — the built shell's 3 slots and their computed colours and
  shadow; a gradient set at run time is painted.
- Control values from: the `V3-*` boards (§2), read by the test itself.

#### 8. Checked against the source

Nothing to check: no rules fact.

#### 9. Not in this ticket

- Drawing the header, cards, buttons, the portrait, the token frame and the dice — the screen
  rows that build them, with `<Slot>` (the phase 2 note in `BACKLOG.md`).
- A part's shape: corners, borders, its style menu — SHEET-04. A slot holds only the fill.
- A video filling a slot, and a frame picture that reaches outside the circle — the skins' phase
  (ADR 015 items 14–16). `Slot` is the one place that will draw them, so no screen changes.
- Animations in a slot, and stopping them — SHEET-05.
- The skin file, its schema and its import — the theme editor's phase (ADR 015 item 14).

#### 10. Rake check

- **No look is written in a component:** `Slot.tsx` and the shell name no colour; every value is
  theme data; SHEET-02's lint passes on both.
- **A skin is data, never code:** a slot is filled by a value in a theme key; a skin cannot add a
  slot, since `slotProperties` is the list.
- **No user-facing string literal:** no new text.
- **Nothing invisible:** no zero-width character, byte-order mark or non-breaking space in the
  changed files (checked with a Python scan).

#### 11. What came out of it

- `pnpm lint`: 221 files, no fixes. `pnpm typecheck`: green.
- `pnpm test`: 948 passed, 0 failed (932 before, plus 16 in `slots.test.tsx`), 17.07 s; the speed
  pass 2 passed, 2.96 s.
- `pnpm e2e`: 16 passed, 0 failed, 12.5 s, with the new `SHEET-03` test.
- Rebased onto SHEET-17, which a parallel chat pushed meanwhile. On top of it: `pnpm lint` 222
  files, no fixes; `pnpm test` 955 passed, 0 failed, 16.89 s, the speed pass 2 passed, 2.62 s;
  `pnpm e2e` 16 passed, 0 failed, 10.0 s.
- Measured in the built app (dark): `app` `#131417`; `page` `rgba(0, 0, 0, 0)`; `dock` `#1C1D21`
  with `rgba(0, 0, 0, 0.3) 0px -4px 12px 0px`. A `linear-gradient(…)` set on
  `--theme-slot-app-background` is the `app` slot's computed `background-image`.
- Differs from the row: the row named "each page background"; ADR 015 item 1 names two kinds,
  the person's pages and the character pages, so there are two page slots, `page` and
  `character-page`. The token frame is three slots, one per board frame.
- The header slot takes the sheet's header (`#FFFFFF` on `V3-Sheet`); the player pages' headers
  on the boards have no background of their own, so they draw no header slot.

**Found, not fixed:** nothing.

**Changelog:** "The bottom bar takes the dock's look: the surface colour with a soft shadow above
it."

---

### SHEET-06 The app's fonts ship inside it, each licence read

**Hat:** the shipped font files
**Depends on:** SHEET-01
**Size:** S
**Screen:** Yes — every screen's text: body text in Inter, headings in EB Garamond, the fonts
`docs/design/mockups/README.md` names
**SPEC:** §11; ADR 005 item 7.5, ADR 015 item 10, BRIEF X1

---

#### 1. Where the code lives

**Main file:** `apps/web/src/theme/fonts.css` — changes (empty since SHEET-01): the `@font-face`
rules.
- `apps/web/src/config/fonts.ts` — new: the font packages the app ships, and where each
  licence goes in the build.
- `apps/web/vite.config.ts` — changes: a build step copies each package's `LICENSE`; the service
  worker precaches `woff2` and `txt` files.
- `apps/web/package.json` — changes: `@fontsource-variable/inter` and
  `@fontsource-variable/eb-garamond`, both 5.3.0.

#### 2. What is missing now

- `apps/web/src/theme/fonts.css` holds only a comment.
- The tokens name `Inter, system-ui, sans-serif` and `'EB Garamond', Georgia, serif`, but no
  font file is in the build: a device without Inter or EB Garamond installed draws its own
  fallback font.
- The built app's precache: 12 entries, 518.63 KiB, no `woff2` file.

#### 3. What it should look like when done

1. `fonts.css` declares exactly two families, `Inter` and `EB Garamond`, the first family of the
   tokens `font-body` and `font-heading`.
2. Every `url()` points into one of the two packages; none is `http(s)://` or `//`.
3. Each family has a face whose range starts `U+0000-00FF` (Latin) and one with `U+0400-045F`
   (Cyrillic).
4. Each package's `package.json` says `OFL-1.1`, and its `LICENSE` is the SIL Open Font License
   1.1 text.
5. The build has `fonts/inter-OFL.txt` and `fonts/eb-garamond-OFL.txt`, each served with status
   200 and the OFL text.
6. In the built app, a Latin and a Cyrillic line in each family load four faces (each family's
   Latin and Cyrillic), every font request goes to the app's own origin, and the service worker's
   cache holds all 8 font files.

#### 4. How to do it

1. Take the font files from the Fontsource npm packages (the Google Fonts files, with their
   `LICENSE` and `metadata.json`), pinned at 5.3.0. A package keeps the binaries out of git and
   names their version in the lockfile.
2. Write the `@font-face` rules by hand, not `@import` the package's CSS: only the upright
   variable face (`wght`), only the subsets `latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`.
   The unicode ranges are copied from the package's `wght.css`. The family names stay `Inter`
   and `EB Garamond`, so the tokens do not change.
3. Vite resolves `url("@fontsource-variable/…/files/….woff2")` from the package and puts each
   file in `assets/` with a hash.
4. A small build plugin reads each package's `LICENSE` (through its `./LICENSE` export) and emits
   it at the path `FONT_PACKAGES` names.
5. Add `woff2` and `txt` to Workbox's `globPatterns`, so the fonts and licences work offline.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Every screen at 360×800: text in Inter, headings in EB Garamond, on any device, online or
offline, in English and in Russian letters. No new text, so no i18n key.

#### 7. Tests

- `apps/web/test/fonts.test.ts` — §3 items 1–4, read from `fonts.css`, the theme tokens and the
  installed packages.
- `apps/web/e2e/theme.spec.ts` — §3 items 5 and 6 in the built app; a screenshot of a Latin and a
  Cyrillic line in each family.
- Control values from: the packages' own `LICENSE`, `package.json` and `wght.css`.

#### 8. Checked against the source

- Licence, read from each package's `LICENSE` file in `node_modules`:
  - Inter: "Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)", then "This
    Font Software is licensed under the SIL Open Font License, Version 1.1.", then the full
    licence text, "SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007".
  - EB Garamond: "Copyright 2017 The EB Garamond Project Authors
    (https://github.com/octaviopardo/EBGaramond12)", then the same licence text (the two files
    differ only in the copyright line, checked with `diff`).
- `package.json` `license` of both: `OFL-1.1`; `metadata.json` `source` of both:
  `https://github.com/google/fonts`, the source ADR 005's sources name.
- The OFL's condition 2: the font may be bundled with software "provided that each copy contains
  the above copyright notice and this license". The build ships each `LICENSE` beside the fonts
  (§4 step 4). The OFL's condition 1 (no selling the font by itself) does not apply: the app is
  not a font.
- Character sets, from `metadata.json`: both list `cyrillic`, `cyrillic-ext`, `latin`,
  `latin-ext`. Weights: Inter variable `wght` 100–900, EB Garamond 400–800; the mockups use 300 to
  800 (counted with `grep` over `docs/design/mockups/`); 300 occurs 4 times, all in Inter text.
- Italic: the mockups' 3 `font-style: italic` are all in `Retro-Parchment` with another font, so
  no italic face ships.

#### 9. Not in this ticket

- The final heading font — the owner's choice (BRIEF X1); EB Garamond is the placeholder. A new
  pick changes `FONT_PACKAGES`, `fonts.css` and the `font-heading` token.
- Showing the font licences on an About screen — not a row yet; the files are in the build for
  it.
- A skin's own fonts — the skins' phase (ADR 015 items 10, 14).
- Greek, Vietnamese and italic faces — nothing on screen needs them yet.

#### 10. Rake check

- **No external requests:** every font request goes to the app's own origin (e2e); no font
  service.
- **Only openly licensed content:** both fonts are OFL-1.1, read from their files; ADR 005 item
  7.5 already approved these families.
- **No look is written in a component:** the families stay in the tokens; `fonts.css` is the
  theme's file, no component changed.
- **Nothing invisible:** no zero-width character, byte-order mark or non-breaking space in the
  changed files (checked with a Python scan).

#### 11. What came out of it

- `pnpm lint`: 224 files, no fixes. `pnpm typecheck`: green.
- `pnpm test`: 959 passed, 0 failed (955 before, plus 4 in `fonts.test.ts`), 14.01 s; the speed
  pass 2 passed, 2.37 s.
- `pnpm e2e`: 17 passed, 0 failed, 16.0 s, with the new `SHEET-06` test.
- The 8 font files: 396,268 bytes. Inter: Latin 48.25 kB, Latin extended 85.06 kB, Cyrillic
  18.74 kB, Cyrillic extended 25.96 kB. EB Garamond: 44.33, 113.92, 26.02, 33.94 kB.
- Precache: 22 entries, 914.40 KiB (12 entries, 518.63 KiB before: plus 8 fonts and 2 licences).
- Loaded in the built app for a Latin and a Cyrillic line per family: `EB Garamond U+0-FF`,
  `EB Garamond U+301`, `Inter U+0-FF`, `Inter U+301` (the browser reports each range's first
  item); the Latin and Cyrillic extended files load only when a page has one of their letters.
- Differs from §4: nothing.

**Found, not fixed:** nothing.

**Changelog:** "Text is set in Inter and headings in EB Garamond on every device, offline too,
with Latin and Cyrillic letters."

---

### SHEET-04 Each part takes its style from a fixed menu

**Hat:** the part styles as a fixed menu
**Depends on:** SHEET-01, SHEET-03
**Size:** M
**Screen:** No — no screen draws a part yet; the base looks are those of the `V3-*` boards and
`docs/design/mockups/README.md`
**SPEC:** ADR 015 items 1, 7 and 13

---

#### 1. Where the code lives

**Main file:** `apps/web/src/theme/parts.ts` — changes (empty since SHEET-01): the parts, each
part's menu of styles, the base theme's picks, and the theme keys a set of picks fills.
- `apps/web/src/theme/Part.tsx` — new: the component a screen draws a part with.
- `apps/web/src/theme/slots.ts` — changes: `camel()` is exported, so `parts.ts` uses the same one.
- `apps/web/test/parts.test.tsx` — new.
- `apps/web/test/theme.test.ts` — changes: the `index.css` mapping check leaves out part keys.
- `apps/web/e2e/theme.spec.ts` — changes: a `SHEET-04` test.
- `docs/tickets/BACKLOG.md` — changes: the phase 2 note tells screen rows to draw parts with
  `<Part>`.

#### 2. What is missing now

- `apps/web/src/theme/parts.ts` is `export const parts: ThemePart = {};`.
- A screen could give a button its corners, border and shadow only with Tailwind classes
  (`rounded-button border border-line`), so a skin can change the token values but never the
  shape: a raised button or a bevelled window cannot be made from data.
- The boards' shapes, measured with a Python count of every `style` attribute in `V3-*.html`:
  - a filled button: `border-radius: 12px; background: #1C1D20; color: #FFFFFF; border: 0`
    (`V3-Rest` and 12 other boards);
  - a second button, beside it: `border-radius: 12px; background: transparent; color: #1C1D20;
    border: 1px solid #5E6269` (7 `<button>`s, and links in 6 boards);
  - an icon button: 44 × 44, `padding: 0; border: 0; background: transparent` (`V3-Player`'s
    settings button), no corner; once with a border: `border-radius: 12px; border: 1px solid
    #E2E2DE` (`V3-SheetDice`, 2);
  - a card: `border: 1px solid #E2E2DE; border-radius: 14px` (94);
  - a panel, a large box: the same border and `border-radius: 16px` (`V3-Player`, `V3-DMHome`);
  - a chip: 30 px tall, `border-radius: 15px`, no border (`V3-Feats`, 24); outlined or dashed
    once each;
  - a bottom sheet: `border-radius: 20px 20px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.18)`
    (7);
  - a toast: 48 px tall, `border-radius: 12px`, no border, no shadow (`V3-Features`, 1).

#### 3. What it should look like when done

1. 8 parts exist: `button`, `button-secondary`, `icon-button`, `card`, `panel`, `chip`, `sheet`,
   `toast`.
2. Each part has a menu of at least 2 styles; each style sets exactly `border`, `border-radius`
   and `box-shadow`, every value read from the tokens.
3. The base theme picks one style per part; it fills one key `part-<part>-<property>` for each
   part and property, and no other `part-` key.
4. Each base pick, its tokens read in light, is the shape the board draws (the values of §2).
5. `partsTheme(picks)` with another pick for one part changes only that part's keys; a pick the
   menu lacks, or a part with no pick, throws.
6. `<Part name fill as>` draws the element asked for, with `data-skin-part`, and a style whose
   every property reads `var(--theme-part-…)`; a style the screen passes cannot override it.
   `fill` takes only a slot that sets nothing but its background (`card`, `button`, …), so the
   slot and the part never set one property twice.
7. In the built app, each part's keys compute to the board's border, corners and shadow; a card's
   keys filled from `raised` at run time give the raised shadow, with no component changed.

#### 4. How to do it

1. `partProperties` is the three shape properties. A slot holds the fill (SHEET-03); a part holds
   the shape.
2. `partStyles` maps each part to its menu: style name → the three values, built from tokens with
   `var(--theme-…)`. A skin changes a style's look through the same tokens (`radius-card`,
   `color-line`, `shadow-raised`); it cannot write a style.
3. `basePicks` is the boards' look. `partsTheme(picks)` writes the chosen styles' values into
   `shared` keys, and `parts = partsTheme(basePicks)` joins the base theme as before.
4. `partStyle(name)` builds the inline style. `Part` spreads the screen's style first, then the
   fill slot's, then the part's.
5. Part keys are not Tailwind utilities, so `index.css` does not map them; SHEET-01's mapping test
   leaves them out.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen: no screen draws a part yet. The screen rows draw buttons, cards, chips, sheets and
toasts with `<Part>`.

#### 7. Tests

- `apps/web/test/parts.test.tsx` — the 8 names; every style sets the 3 properties; every key
  filled in both modes and no other; 8 base looks against the `V3-Rest`, `V3-Player`, `V3-Dice`,
  `V3-Feats`, `V3-Cast` and `V3-Features` boards, read by the test itself; a re-pick changes one
  part; an unknown style and a missing pick throw; `partStyle('card')`; `<Part>` rendered to
  HTML, with and without a fill; a slot that sets a shadow cannot fill a part (a type error).
- `apps/web/test/theme.test.ts` — the mapping check, part keys left out.
- `apps/web/e2e/theme.spec.ts` — each part's computed border, corners and shadow in the built
  app; a skin's re-pick of the card is painted.
- Control values from: the `V3-*` boards (§2).

#### 8. Checked against the source

Nothing to check: no rules fact.

#### 9. Not in this ticket

- Drawing the parts on screens — the screen rows, with `<Part>`.
- A texture inside a part (ADR 015's "parchment" panel): a texture is a picture, the skin's file;
  the fill is the slot's (SHEET-03), and pictures in a skin come with the theme editor's phase
  (ADR 015 item 14). No `parchment` style is in the menu until then.
- Sizes and spacing (the 44 / 48 px heights, padding): tokens the screens use with classes;
  ADR 015 item 1 names borders, corners, shadows and textures for a part's style.
- How a part moves (pressing, opening a sheet) — SHEET-05's presets.
- The skin file that names its picks, and its schema — the theme editor's phase.
- The settings page drawn from these parts — SHEET-13.

#### 10. Rake check

- **No look is written in a component:** `Part.tsx` names no colour, corner or shadow; every
  value is theme data; SHEET-02's lint passes on it.
- **A skin is data, never code:** a skin names a style from the menu and sets token values; a
  name the menu lacks throws, so no stranger's CSS is drawn.
- **No user-facing string literal:** no new text.
- **Nothing invisible:** no zero-width character, byte-order mark or non-breaking space in the
  changed files (checked with a Python scan).

#### 11. What came out of it

**Measured on 2026-10-29, on top of SHEET-03 (`3977c50`):**

- `pnpm lint`: `Checked 224 files in 369ms. No fixes applied.`
- `pnpm typecheck`: every project `Done`.
- `pnpm test`: unit `Test Files 71 passed (71)`, `Tests 971 passed (971)` (955 before, plus 16
  in `parts.test.tsx`), 18.64 s; speed `Tests 2 passed (2)`, 3.30 s. The first run's speed pass
  failed (`its median compute() × 4 is at most 10 ms`) on a container just restarted, with
  dependencies just installed; the next run passed with no change. That is OPS-28's case.
- `pnpm e2e`: `17 passed (20.3s)` on `pixel-7`, with the new `SHEET-04` test.
- Rebased onto SHEET-06, which a parallel chat pushed meanwhile; both rows added a test at the
  end of `apps/web/e2e/theme.spec.ts`, and both are kept. On top of it (`28123fc`): `pnpm lint`
  226 files, no fixes; `pnpm test` 975 passed, 0 failed, 19.80 s, the speed pass 2 passed,
  3.09 s; `pnpm e2e` 18 passed, 0 failed, 16.1 s.
- Measured in the built app (light): `button` `0px none`, corners 12 px, no shadow;
  `button-secondary` `1px solid rgb(94, 98, 105)`, 12 px; `icon-button` no border, 12 px; `card`
  `1px solid rgb(226, 226, 222)`, 14 px; `panel` the same, 16 px; `chip` no border, 9999 px;
  `sheet` no border, 20 px on top and 0 below, `rgba(0, 0, 0, 0.18) 0px -8px 24px 0px`; `toast`
  no border, 12 px. The card re-picked as `raised`: `rgba(0, 0, 0, 0.12) 0px 1px 3px 0px`.
- The menu: 26 styles. `button` and `button-secondary` share one: flat, outlined, raised, bevel;
  `icon-button`: plain, outlined, round; `card`: outlined, flat, raised; `panel`: outlined, flat,
  raised, window; `chip`: flat, outlined, dashed; `sheet`: floating, edged, window; `toast`: flat,
  raised. `bevel` and `window` are the retro looks' raised edge (BRIEF Part 5, "Future skins").
- Differs from the row: the row named one button; the boards draw two kinds side by side (a
  filled one and an outlined one), so `button-secondary` is a part of its own, with the same menu,
  and the base theme picks `outlined` for it. The row's "bottom sheet" is the part `sheet`.
- The icon button's board draws no corner (no border, no fill); the base pick gives it the
  button's 12 px, which shows only once a skin gives it a border or a fill.
- The chip's 15 px on a 30 px chip is the `pill` corner (SHEET-01's rule: half the height).

**Found, not fixed:** `docs/CHANGELOG.md`'s format example reads
`2026-MM-DD · SHEET-04 · Long-press on any number shows where it came from.`; SHEET-04 is now
this row, and the long press is SHEET-33, so a search for SHEET-04 finds a wrong line. New row
OPS-32.

**Changelog:** nothing for the changelog; no screen draws a part yet.

---

### SHEET-10 Characters on the device

**Hat:** Characters are saved on the device, migrated as they open
**Depends on:** SHEET-07, ENG-06
**Size:** S
**Screen:** No
**SPEC:** §5.8 (migrations), §11 (the `characters` table)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/db/characters.ts` — new: `saveCharacter` and `openCharacter`. The
other files it touches:

- `apps/web/src/systems.ts` — new: the system modules the app carries, by system id, with each
  one's character opener.
- `apps/web/src/db/db.ts` — changes: `CharacterRow` is a stored file with an `id`.
- `apps/web/package.json` — changes: `@grimoire/system-5e` moves from `devDependencies` to
  `dependencies` (the app's code now imports it; ADR 004 item 2: core ← module ← `apps/web`);
  `fake-indexeddb` 6.2.5 joins `devDependencies`, for the unit tests.
- `apps/web/test/characters.test.ts` — new.

#### 2. What is missing now

Measured on 2026-10-29, at `3977c50`:

- `apps/web/src/db/db.ts` has the `characters` table (SHEET-07), keyed by `id`; nothing writes or
  reads it: `grep -rn "characters\." apps/web/src` finds nothing.
- The migration frame exists: `openFifthEditionCharacter` (ENG-06, ENG-33) migrates a file of
  any older `schemaVersion` or `systemSchemaVersion` and refuses a newer one. The app never calls
  it.
- No unit test can reach IndexedDB: Vitest runs in Node, and no IndexedDB stand-in is installed.

#### 3. What it should look like when done

1. `saveCharacter(character)` stores the character under its id, as its system's schema reads
   it, and returns the frame's answer: `{ ok: true, value, from }`.
2. `saveCharacter` stores nothing for a character its schema refuses, and returns
   `{ ok: false, code: 'invalid' }`.
3. `openCharacter(id)` opens a row of the current versions as it was saved:
   `from: { schemaVersion: 2, systemSchemaVersion: 8 }`.
4. It opens golden A stored at fifth edition's version 2 (no `languageSource`, no
   `deathSaves.stable`) as golden A at version 8, `from: { schemaVersion: 2,
   systemSchemaVersion: 2 }`, and the row stays at version 2.
5. The next `saveCharacter` of what opened stores version 8 over it; the table still has 1 row.
6. A row of `systemSchemaVersion` 9 is refused with `code: 'newer'`, `found: 9`, `current: 8`; a
   row the schema does not read with `code: 'invalid'`; a row whose `system` is `tales` or
   missing with `code: 'unknownSystem'`. Each row stays as it was.
7. An id with no row gives `code: 'notFound'`.
8. The app carries one system, `5e`; `characterOpenerOf` finds nothing for `tales`, `toString`,
   `__proto__`, `5` or `undefined`.

#### 4. How to do it

1. `apps/web/src/systems.ts`: `CHARACTER_OPENERS`, system id → opener, with `5e` →
   `openFifthEditionCharacter`; `characterOpenerOf(system)` reads it with `Object.hasOwn`, so a
   name on `Object.prototype` finds nothing. `AppCharacter` is a character of any system the app
   carries (today `FifthEditionCharacter`). This is the one place the app picks a system: no
   `if (system === …)` anywhere else.
2. `apps/web/src/db/characters.ts`: one private `openFile(file)` reads the file's `system`, finds
   its opener, and runs it; with no opener it gives `unknownSystem`.
   `openCharacter(id, characters = db.characters)` reads the row and gives `openFile`'s answer,
   or `notFound`. `saveCharacter(character, characters = db.characters)` runs `openFile` first
   and puts the parsed value only when it is `ok`. The table is a parameter so the tests give
   each case its own database.
3. **Opening never writes.** Technical choice (ADR 002 item 1): the migrated character is not
   written back when it opens. Why: ADR 002 keeps "anything that would lose or rewrite data a
   person has already saved" for the owner, and the migrations are pure, so running them on each
   open costs nothing. The stored row moves to the current versions only when the person's own
   change is saved. A refused row (newer, invalid, unknown system) stays as it was, so an app
   update can still open it later. To reverse: write `opened.value` in `openCharacter`.
4. `fake-indexeddb` (Apache-2.0, dev only, not in the build) gives Vitest an IndexedDB, so Dexie
   runs as it does in the browser. Version 6.2.5, from 2025-11-07; 6.2.6, from 2026-10-16, is
   under two weeks old and is not taken.

#### 5. Stored data

Nothing stored changes shape. The `characters` table (SHEET-07) gets its first rows: each row is
the character file itself, at the versions it was saved. No Dexie version bump, no
`schemaVersion` bump.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `apps/web/test/characters.test.ts` — `SHEET-10 characters on the device`: §3 items 1–7, each on
  its own fresh database; `SHEET-10 systems the app carries`: §3 item 8.
- Control numbers from: SPEC §6.7 golden A (`packages/system-5e/test/golden/characters-2014.ts`);
  `FIFTH_EDITION_SCHEMA_VERSION` (8) and `CHARACTER_SCHEMA_VERSION` (2) in the source; the 2014
  ruleset's `languageSource: 'species'` (`packages/system-5e/src/rulesets/2014.ts:19`), which the
  3 → 4 step gives.

#### 8. Checked against the source

Nothing to check: no rules facts.

#### 9. Not in this ticket

- Listing the saved characters: SHEET-24. Copy, export, delete: SHEET-25.
- Importing a character file through its checks: SHEET-26 (it can call `saveCharacter`).
- `rev` and `updatedAt` on a change, and undo: SHEET-23. `saveCharacter` stores what it is given.
- Packs on the device and their opener: SHEET-08, SHEET-09.
- A screen that says why a character does not open: the screens that open one (SHEET-24 on).

#### 10. Rake check

- **A stored-shape change needs a migration**: no shape changes; every row opens through the
  migration frame, and an older row is tested to open at the current versions.
- **Missing is not broken**: a row of an unknown system, a newer row or an id with no row gives
  a result with a code, never an exception; nothing is deleted.
- **Each system's rules live in its own module**: the app names a system only in `systems.ts`'s
  one table; the core imports nothing new.
- **Ids are stable**: a row is keyed by the character's own `id`.
- **No telemetry, no external requests**: IndexedDB only.

#### 11. What came out of it

Measured on 2026-10-29, on top of SHEET-04 (`22de7b9`):

- Whole gate (`lint && typecheck && test && e2e`): exit 0, 49.3 s.
- `pnpm lint`: `Checked 229 files`, 0 errors. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: `Test Files 73 passed (73)`, `Tests 984 passed (984)` (975 before, 9 new). The
  second suite (`Tests 2 passed (2)`) is unchanged.
- `pnpm e2e`: `18 passed (11.1s)` on `pixel-7`, unchanged.
- The tests are live: with `openCharacter` writing the migrated character back, §3 item 4 failed
  (`1 failed | 8 passed (9)`).
- Build: JS 499.66 kB (159.56 kB gzip), the same as at `22de7b9`: nothing on screen imports
  `characters.ts` yet.
- Differs from the row: none.

Found, not fixed:

- No e2e test saves and opens a character in Chromium: no screen does it yet. SHEET-24, the
  first screen that opens saved rows, can carry it (note added to its row).
- SHEET-09's installed packs open through their own system's frame too; their openers can join
  `apps/web/src/systems.ts` (note added to its row).

Nothing for the changelog.

---

### SHEET-20 A use's recovery amount is computed with a breakdown

**Hat:** A use's recovery amount is computed with a breakdown
**Depends on:** ENG-21 (`recoveredOn`), ENG-29 (`resources.<key>.max`), ENG-17 (effects and
overrides on a derived path)
**Size:** S
**Screen:** No
**SPEC:** §6.1 (the UI reads only `Computed` and its breakdown), §6.2 (the breakdown); ENG-21 §11
puts the row here

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/derived.ts` — changes: new `recoveryPath`; each resource's
recovery amounts become derived paths; new warning `recoveryFormula` in `DerivedWarning`.
- `packages/engine/src/trackers.ts` — new `recoveryOf`, `ResourceRecovery`; `recoveredOn` reads
  the computed amounts; `RecoveryWarning` and `Recovered.warnings` are removed.
- `packages/engine/src/compute.ts` — the `derive` doc names the new core paths.
- `packages/system-5e/src/rests.ts` — `RestOutcome.warnings` holds the conditions' warnings only.
- `packages/engine/test/recovery.test.ts` — the SHEET-20 tests; two ENG-21 tests follow the
  moved warning.
- `packages/engine/test/resources.test.ts`, `packages/system-5e/test/rests.test.ts` — follow the
  new paths and the moved warning.

#### 2. What is missing now

Measured on `main` at `3977c50`:
- `git show HEAD:packages/engine/src/derived.ts | grep -c recovery`: `0`. No computed path holds a
  recovery amount.
- `recoveredOn` (`trackers.ts`) evaluates each amount's formula itself, at rest time, on
  `computed.values`. So the amount a label shows ("2 back on a session") has no value in
  `Computed.values` and no entry in `Computed.breakdown`, and an effect or a manual edit cannot
  change it.
- `pnpm test`: unit `Tests 955 passed (955)`, 13.98 s; speed `2 passed`.

#### 3. What it should look like when done

All on the made-up system Tales (ENG-27): Brook's seeker gives `focus`, `2` back on `session`;
Ash's warden gives `luck`, `all` back on `scene`; Ash's nerve modifier is 1; a test spark (a
talent of Ash's own) has maximum `3`.
1. Brook: `values['resources.focus.recovery.session']` is 2; its breakdown is one step `{ kind:
   'grant', part: 'tales-core:calling/seeker#focus', source: 'tales-core:calling/seeker', label:
   { en: 'Seeker' }, formula: '2', value: 2, change: 2 }`. `recoveryOf(computed, 'focus')` is
   `[{ on: 'session', amount: 2, path: 'resources.focus.recovery.session' }]`.
2. Ash: no path holds `.recovery.`; `recoveryOf(computed, 'luck')` is `[{ on: 'scene', amount:
   'all' }]`; a key no grant gives: `[]`.
3. A spark `1` on `scene`, `all` on `session`: `recoveryOf` lists `scene` (1) then `session`
   (`all`), in the grant's order. Two sparks, `1` and `all` on `scene`: `scene` is `all`; the path
   still has the `1` grant's step.
4. Two sparks, `1` and `@abilities.nerve.mod + 1` on `scene`: the path is 2, steps (1, change 1)
   and (2, change 1), as ENG-29's maximum.
5. Counted as a rest gives it: `1.5` → 1; `-1` → 0; `@resources.spark.max` → 3.
6. `@nope`: the path is 0, and `compute()` warns `missingPath` `nope` for
   `resources.spark.recovery.scene`.
7. An effect `add 1` on `resources.spark.recovery.scene` of a `1` amount: the path is 2, the
   effect a step; with 3 spent, `recoveredOn(['scene'])` gives 3 → 1.
8. A manual edit of the path to 3: the path is 3, its last step `override`; with 3 spent,
   `recoveredOn(['scene'])` gives 3 → 0.
9. Every ENG-21 and ENG-61 count stays as it was; a rest's outcome no longer carries a uses'
   formula warning, `compute()` does.

#### 4. How to do it

1. `derived.ts`: the ENG-29 step for "the highest of every grant of a key" becomes one function,
   `highest`; the maximum and each `recoveryPath(key, on)` use it. A grant's amount `all` gives
   no step.
2. `trackers.ts`: `countAt` (rounded down, never below 0) of a computed path; `recoveryOf` for the
   screen; `recoveredOn` takes `all` as every use and anything else as `countAt` of its path.
3. `rests.ts`: drop the uses' warnings from the outcome.
4. Tests (§7), then the gate.

Technical choices (ADR 002):
- **A path, not a field on `Computed.resources`.** Every number on screen lives in
  `Computed.values` with its breakdown, and a path gets effects and overrides from ENG-17 for
  free. Its name, `resources.<key>.recovery.<event>`, sits beside `resources.<key>.max`.
- **The rest reads the path.** Otherwise an effect or a manual edit would change the label and
  not the rest. So the formula runs once, in `compute()`, and its warning is `compute()`'s: the
  sheet shows a broken formula all the time, not only after a rest.
- **`all` is no number.** It stays the grant's own `all`; `recoveryOf` gives it as `'all'`, above
  any count, as `recoveredOn` already did. A screen reads `recoveryOf` and decides nothing.
- **A key's amount is the highest of its grants on that event.** `recoveredOn` keeps ENG-21's
  "each grant by the first of its events" and reads the key's amount on that event. This differs
  from ENG-21 only when two grants of one key name the same event with different amounts and
  one of them gives less on a later event than on an earlier one; no content does.

#### 5. Stored data

Nothing stored changes. The paths are computed; an override names a path, as every override does.

#### 6. What a person will see

Not a screen. The features tab's recovery label (SHEET-48) reads `recoveryOf`; its note in
`BACKLOG.md` says so.

#### 7. Tests

- `packages/engine/test/recovery.test.ts` — `describe('SHEET-20 a recovery amount computed with a
  breakdown')`: items 1–8, 8 tests.
- The ENG-21 tests in the same file and in `packages/system-5e/test/rests.test.ts`: item 9.
- Control values from: Tales' content (`packages/schema/test/tales/content.ts`), worked out by
  hand above; no golden value is read or changed.

#### 8. Checked against the source

Nothing to check. The ticket is game-free and adds no rule: what comes back on which event is
still each pack's data and ENG-21's order of events.

#### 9. Not in this ticket

- The label's words ("1 back on a short rest, all on a long rest"): SHEET-48.
- Overriding `all` into a number: an `all` amount has no path. Nothing asks for it.
- A condition's recovery amount (ENG-61): `conditionsRecoveredOn` still evaluates it at rest
  time; no screen shows it.

#### 10. Rake check

- **The engine names no game.** Tested on Tales only; the paths are built from each grant's
  `key` and `on`, never a list of events.
- **`compute()` is pure.** The steps run inside `computeDerived`, read through `readBy(part)`,
  so a loop names the part.
- **A number shown with no breakdown is a bug.** The amount now has one; `all` is not a number.
- **Manual overrides win.** Item 8: the override wins on the sheet and in the rest.
- **Missing is not broken.** A missing path reads 0 with a warning (item 6).
- **A stored-shape change needs a migration.** None changes (§5).

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-29, on `main` at `3977c50`:
- Before: `pnpm test` unit `Tests 955 passed (955)`, 13.98 s; speed `2 passed`.
- After: `pnpm lint` `Checked 222 files`, no fixes; `pnpm typecheck` green; `pnpm test`
  `Test Files 70 passed (70)`, `Tests 963 passed (963)`, and `2 passed` in the speed project; the
  whole gate 31.3 s. 8 tests are new, all in `recovery.test.ts`. No file in `apps/web` changed, so
  no `pnpm e2e`.
- Again on top of SHEET-10 (`6561bb6`), after `git pull --rebase`: `Checked 229 files`, no fixes;
  typecheck green; `Test Files 73 passed (73)`, `Tests 992 passed (992)`, speed `2 passed`; the
  whole gate 29.5 s.
- The tests catch mistakes. 3 breaks, each made alone, then `recovery.test.ts` run, the file
  restored and compared equal after each: `all` not above a count in `recoveryOf`, 1 failed; no
  rounding in `countAt`, 2; no recovery path computed, 11.
- Differs from §3: a missing path warns `missingPath` (ENG-28's warning, naming the path), not
  `recoveryFormula`, as a resource's maximum does. `recoveryFormula` stays for any other warning
  a formula gives.
- Found, not fixed: nothing.
- Nothing for the changelog: no screen reads it yet.

---

### SHEET-16 Damage applies the character's defenses by its type

**Hat:** Damage applies the character's defenses by its type
**Depends on:** ENG-20 (`applyDamage`), SHEET-15 (`defensesOf`)
**Size:** S
**Screen:** No
**SPEC:** §6.4 (`applyDamage`), §5.4 (the `defenses.*` targets), §8.2

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/defenses.ts` — changes: `defendedDamage`, the three lists
damage meets, in their order.
- `packages/system-5e/src/hit-points.ts` — `DamageAsk.type`, the refusals `badType` and
  `noDamage`, `DamageOutcome.defended`; `applyDamage` takes the damage after the defenses.

#### 2. What is missing now

Measured on `main` at `3977c50`, 2026-10-29:
- `DamageAsk` is `{ amount, critical?, knockOut? }`; its `amount` is documented as "the damage
  taken, resistance, vulnerability and immunity applied" (`hit-points.ts` line 71). The person
  works the defenses out in their head.
- `grep -n "defenses" packages/system-5e/src/hit-points.ts` finds nothing: `applyDamage` never
  reads `defensesOf`.

#### 3. What it should look like when done

1. Damage with no `type` changes as it does today; its outcome has no `defended`.
2. `type` is a damage type's key. A `type` that is not a key is refused: `badType`, with the type.
3. With a type, the character's defenses of that type apply to `amount`, in this order: immunity
   gives 0 and nothing else applies; else resistance halves it, rounded down; then vulnerability
   doubles it. Everything after takes the damage that is left: the temporary hit points, the hit
   points, massive damage, the death save failures, the concentration DC, a knock-out.
4. The outcome's `defended` gives `dealt` (the amount asked), `type`, `steps` (each defense that
   applied: its list, its path, whose breakdown names its sources, and the damage after it),
   `amount` (what the character takes), and `missing` (no entry of type `damageType` has the
   key). A key with no entry still meets the defenses that name it, as SHEET-15 counts it.
5. Defenses that leave 0 change nothing: refused as `noDamage`, with `defended`.
6. A defense switched off, or overridden to 0, does not apply: `applyDamage` reads the computed
   values, so the breakdown's winner is the one used.
7. Control values, worked out by hand from §8:
   - 2014, resistance to bludgeoning, 7 bludgeoning at 12 of 12: takes 3, left at 9.
   - 2024, resistance and vulnerability to slashing, 23 slashing at 40 of 40 (SRD 5.2.1's example
     after its aura): 11, then 22; left at 18.
   - 2014, vulnerability to bludgeoning, 9 bludgeoning at 6 of 12: 18, so 12 left over at 0, equal
     to the maximum: dead. Without the type: 3 left over, down.
   - Concentrating, resistance, 44 at 50 of 50: takes 22, DC 11 (44 and DC 22 without the type).
   - Resistance, 1 damage: 0, `noDamage`. Immunity with resistance and vulnerability: 0, one step.

#### 4. How to do it

1. `defenses.ts`: `DAMAGE_DEFENSES = ['immune', 'resist', 'vuln']`, the order damage meets them;
   `defendedDamage(dealt, type, defenses)` walks them and gives the steps and the amount. Pure,
   no compute.
2. `applyDamage`: refuse a bad amount, a dead character, a bad type; then one `compute()` gives
   the maximum and `defensesOf(values)`; `noDamage` at 0; then the knock-out check and the rest of
   ENG-20's steps on the amount left. The concentration DC takes the amount left too.
3. No edition difference: both SRDs (and dnd5e's one code for both) give the same order and the
   same rounding, so nothing goes in `rulesets/`.

#### 5. Stored data

Nothing stored changes. `DamageAsk` is an argument, not stored.

#### 6. What a person will see

Not a screen. The number pad (SHEET-40) passes the type when the person picks one.

#### 7. Tests

- `packages/system-5e/test/damage-defenses.test.ts` — `describe('SHEET-16 damage by its type')`:
  §3 items 1–7, on golden A (2014, `bludgeoning`) and golden B (2024, `slashing`), hit point
  maximum 12 (SPEC §6.7), with made-up feats.
- Control numbers from: §3 item 7, worked out by hand from §8; SRD 5.2.1's example (28 − 5 = 23,
  11, 22). No golden value is read or changed.

#### 8. Checked against the source

Sources, read 2026-10-29, the commits SHEET-15 read: SRD 5.1 as 5e-bits/5e-srd-api quotes it at
`e6edf9a51fad4b59a7e9561fad6c15232caed214` (`packages/5e-database/src/2014/en/5e-SRD-Rules.json`,
"Damage Resistance and Vulnerability"); SRD 5.2.1 as foundryvtt/dnd5e at
`7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` quotes it
(`packs/_source/content24/chapter-1/damage-and-healing.yml`); dnd5e's code at the same commit
(`module/documents/actor/actor.mjs`, `calculateDamage`). CC-BY-4.0 for the SRDs.

**Order.** SRD 5.1: "Resistance and then vulnerability are applied after all other modifiers to
damage." SRD 5.2.1 (Order of Application): "adjustments such as bonuses, penalties, or
multipliers are applied first; Resistance is applied second; and Vulnerability is applied
third." The amount asked is the damage after the other modifiers: the person types it.

**Rounding.** SRD 5.2.1: "damage of that type is halved against you (round down)", and its
example: "If it takes 28 Fire damage, the damage is first reduced by 5 (to 23), then halved for
the creature's Resistance (and rounded down to 11), then doubled for its Vulnerability (to 22)."
SRD 5.1's text says only "halved"; its example is even (25 − 5 = 20, "takes 10"). dnd5e uses one
code for both editions: `appliedDamage = Math.trunc(appliedDamage / 2)`, then `appliedDamage *= 2`
for vulnerability, so 2014 rounds down too.

**Immunity.** SRD 5.2.1: "Immunity to a damage type means you don't take damage of that type".
dnd5e: a type with immunity gets `d.value = 0` and skips resistance and vulnerability; it does so
for both editions. SRD 5.1's rules text has no immunity paragraph.

**Concentration.** SRD 5.1: "The DC equals 10 or half the damage you take". So the DC takes the
damage after the defenses.

#### 9. Not in this ticket

- One hit of two types (slashing and fire from one weapon) is one source of damage, so one
  concentration save. The ask takes one type; dnd5e takes a list of parts. A row adds parts when
  a screen asks for them.
- Picking the type on the number pad: SHEET-40.
- "Resistance to all damage" and the 2014 qualified kinds: SHEET-15 §9.
- Damage threshold: a property of objects, not of characters.

#### 10. Rake check

- **Everything is data:** no damage type is named in code; `type` is any key, and the defenses are
  SHEET-15's paths.
- **No number without a breakdown:** each step names the path whose breakdown gives its sources.
- **Manual overrides always win:** the defenses are read from the computed values, after the
  overrides (§3 item 6).
- **Each system's rules in its module:** the order lives in `system-5e/src/defenses.ts`; the core
  is not touched; no edition check, since both editions agree.
- **Missing is not broken:** a key with no entry is applied, with `missing: true`; nothing throws.
- **No rules text without an open license:** the test feats are made up; the quotes are
  CC-BY-4.0 SRD text, and dnd5e's code is quoted for its arithmetic only.

#### 11. What came out of it

Quality gate, 2026-10-29, on `main` at `b06c63f` (SHEET-04, 06, 10, 20 landed while this ran):
`pnpm lint` 230 files, no fixes; `pnpm typecheck` 6 projects, no errors; `pnpm test` 74 files, 996
passed, 0 failed, 20.6 s, then the speed project 1 file, 2 passed. Before the rebase, on
`3977c50`: 967 passed, against 955 without this ticket (+12, the new file). Coverage: statements
99.51 % (3316/3332), lines 99.93 % (2913/2915). Not `apps/web`, so no `pnpm e2e`.

Differences from §3: the concentration case of item 7 was first written at 40 of 40; 44 damage
without the type drops 40 to 0 and ends concentration, so there is no DC to compare. The test
found it; the case is now 50 of 50. Item 3, made exact: any defense that leaves 0 ends the walk,
so resistance taking 1 to 0 gives one step, not a vulnerability step of 0 after it.

The existing damage tests (ENG-20, ENG-58, ENG-65, ENG-67) pass unchanged: an ask with no type
gives the same changes and the same outcome as before.

Found, not fixed: nothing.

Nothing for the changelog.

---

### SHEET-18 Attunement past the limit gives a warning

**Hat:** Attunement past the limit gives a warning
**Depends on:** ENG-33 (`systemData.inventory`, a row's `attuned`), ENG-35 (a module's
`ruleWarnings`, warned as `characterRule`), ENG-63 (the SRD text, every attuned row ends at death)
**Size:** XS
**Screen:** No
**SPEC:** §8.2 (prerequisites and limits warn, never block); ENG-63 §11 put the row here

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/attunement.ts` — new: `ATTUNEMENT_LIMIT`,
`attunementWarnings`.
- `packages/system-5e/src/module.ts` — changes: `ruleWarnings` adds `attunementWarnings`.
- `packages/system-5e/src/index.ts` — changes: exports `attunement.ts`.
- `packages/system-5e/test/attunement.test.ts` — new: the SHEET-18 tests.

#### 2. What is missing now

Measured on 2026-10-29 at `3977c50`:
- `grep -rn "attuned" packages/system-5e/src`: `character.ts` (the schema), `equipment.ts` (an
  equipped row's `@attuned` and whether its magic works), `actions.ts` (death unattunes every row).
  Nothing counts the attuned rows.
- So golden B with four attuned rows computes with no warning about it.
- `pnpm test`: unit `Test Files 70 passed (70)`, `Tests 955 passed (955)`, 20.98 s.

#### 3. What it should look like when done

The charms are made up (`character:item/charm-1` … `charm-5`): each needs attunement and gives
+1 AC with no `when`. Golden A (2014) and golden B (2024) keep their own rows, none attuned.
1. `ATTUNEMENT_LIMIT` is 3.
2. Golden A and golden B as they are, and each with three charms equipped and attuned: no
   `attunementLimit` warning.
3. Each with four charms equipped and attuned: one warning, `{ code: 'characterRule', rule:
   'attunementLimit', data: { attuned: 4, limit: 3 } }`, message "The character is attuned to 4
   magic items; no more than 3 at a time." The four still work: AC is 4 higher than the golden's
   own (+1 from each charm).
4. Golden B with five: `data: { attuned: 5, limit: 3 }`.
5. Three attuned and two not: no warning.
6. Golden A with an attuned charm equipped, an attuned charm not equipped, an attuned custom row
   ("Lucky stone", not equipped) and an attuned row whose item no pack has: `attuned: 4`.
7. A frozen character with four: nothing throws, nothing changes, the same warning.
8. The quality gate is green.

#### 4. How to do it

1. `attunement.ts`: count the rows with `attuned: true`; above the limit, one `RuleWarning`.
2. `module.ts`: `ruleWarnings` adds it, after the defenses' warnings.
3. Tests (§7), then the gate.

Technical choices (ADR 002):
- **A character warning, not a step warning.** The limit is about the inventory as a whole, not a
  path, so it is a module `ruleWarnings` entry (`characterRule`), as the ability bonus and the
  languages warn (ENG-35, ENG-56).
- **Every attuned row counts once**, an item or a custom row, equipped or not, its item found or
  missing. Attunement needs no wearing in either SRD; the stored flag is what the person set, and
  death ends every one the same way (ENG-63). A row's `qty` is not read: a row is one attunement.
- **Never a block.** The fourth item's magic still works (§8.2); the screen shows the warning.
- **One constant, no ruleset file.** Both SRDs give three (§8). No house rule changes it yet, so
  nothing stored changes.
- **`data` carries both numbers** (`attuned`, `limit`), so the screen writes its own text.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen. The Gear tab (SHEET-50) sets `attuned` and shows this warning; its note in
`BACKLOG.md` says so.

#### 7. Tests

- `packages/system-5e/test/attunement.test.ts` — `describe('SHEET-18 attunement past the limit
  gives a warning')`: items 1–7.
- Control values from: the SRD text of §8 (three); the charms' +1 AC each, counted by hand.

#### 8. Checked against the source

Read again on 2026-10-29 at the commits ENG-63 named. CC-BY-4.0.
- SRD 5.1, 5e-bits/5e-srd-api `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
  `packages/5e-database/src/2014/en/5e-SRD-Rules.json` (Attunement): "An item can be attuned to
  only one creature at a time, and a creature can be attuned to no more than three magic items at a
  time. Any attempt to attune to a fourth item fails; the creature must end its attunement to an
  item first."
- SRD 5.2.1, foundryvtt/dnd5e `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a`,
  `packs/_source/content24/appendices/rules-glossary.yml` (Attunement): "A creature can have
  Attunement with no more than three magic items at a time."
- SRD 5.1 says the fourth attempt "fails". The app does not refuse it: SPEC §8.2 and the row say
  a warning, never a block, and the person sets the flag by hand. The warning is the app's way of
  saying the fourth fails.

#### 9. Not in this ticket

- The Gear tab's control and the warning on screen: SHEET-50.
- "n of 3 attuned" as a number with a breakdown: not asked; SHEET-50 adds it if the board shows it.
- A house rule or an effect that changes the limit: none in either SRD.
- Two copies of one item attuned (SRD 5.1): found, not fixed (§11).

#### 10. Rake check

- **A rule lives in the module, never in a component:** `attunement.ts`; the screen reads the
  warning.
- **The core names no game:** the engine is unchanged; the rule is fifth edition's.
- **Prerequisites warn, never block (§8.2):** nothing is refused; the fourth charm's AC applies
  (§3 item 3).
- **No ruleset check:** one rule in both editions, one constant.
- **`compute()` is pure:** the warning reads only the character; the frozen test (§3 item 7).
- **No rules text without an open license:** the quotes are CC-BY-4.0; the charms are made up.

#### 11. What came out of it

- `pnpm lint`: `Checked 224 files`, no fixes. `pnpm typecheck`: every project `Done`.
- `pnpm test`: unit `Test Files 71 passed (71)`, `Tests 962 passed (962)`, 22.00 s (955 before,
  plus 7 in `attunement.test.ts`). No file in `apps/web` changed, so no `pnpm e2e`.
- The speed pass is noisy on this machine, with or without this change. `pnpm test` four times
  with the change: the speed pass `2 passed` once, and 3 times `1 failed` (median × 4: 11.67,
  11.35, 10.69 ms against the budget of 10 ms). On `3977c50` without the change, alone, 3 runs
  right after the install: 10.70, 11.74, 10.61 ms, all failed. Alternated, alone, base then this
  change, 4 pairs: medians 2.51 / 2.37, 3.06 / 2.64, 2.58 / 2.26, 1.76 / 2.57 ms. The change adds
  one pass over the inventory rows; the spread is the machine's.
- The tests catch mistakes. Each change made alone, then `attunement.test.ts` run (7 tests), then
  undone (each file compared equal to its copy after): the limit checked with `<` in place of
  `<=`, 2 failed; only equipped rows counted, 1 failed; only rows with an `itemId` counted, 1
  failed; the warning left out of `ruleWarnings`, 4 failed (so, before this ticket, four attuned
  rows gave no warning, §2).
- Rebased onto SHEET-06, SHEET-04 and SHEET-10, which parallel chats pushed meanwhile. On top of
  them: `pnpm lint` `Checked 231 files`, no fixes; `pnpm typecheck` 6 of 6 `Done`; `pnpm test`
  twice: unit `Test Files 74 passed (74)`, `Tests 991 passed (991)`, 21.16 s and 20.92 s; the
  speed pass `1 failed` (10.79 ms), then `2 passed`, 3.11 s.
- Then onto SHEET-20 and SHEET-16, pushed meanwhile too. On top of SHEET-20: unit `Tests 999
  passed (999)`, 21.93 s and 20.10 s; the speed pass `2 passed` both times. On top of SHEET-16:
  `pnpm lint` `Checked 232 files`, no fixes; `pnpm typecheck` 6 of 6 `Done`; `pnpm test` twice:
  unit `Test Files 75 passed (75)`, `Tests 1011 passed (1011)`, 21.26 s and 20.65 s; the speed
  pass `1 failed` (10.61 ms), then `2 passed`, 3.27 s.

Differences from §3: none.

**Found, not fixed:** SRD 5.1 also forbids attuning to more than one copy of an item (the
sentence is quoted in the note of the new row). SRD 5.2.1's Rules Glossary entry does not say it.
A new row in `BACKLOG.md`: SHEET-63.

**Changelog:** nothing; no screen changes.

---

### SHEET-21 Every base AC calculation is computed for the pin

**Hat:** Every base AC calculation is computed for the pin
**Depends on:** ENG-47 (`systemData.acCalc`, the pinned candidate), ENG-14 (`ac.base`,
`appendedNumbers`), ENG-28 (the module's steps)
**Size:** S
**Screen:** No
**SPEC:** §6.1 step 5 (AC: the candidates, then the best one or the one the person pins); §6.1
(the UI reads only `Computed` and its breakdown); §6.2 (the breakdown); ENG-47 §11 puts the row
here

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/combat.ts` — changes: `armorClassBase` gives every
candidate it chose from, with its key, value and steps.
- `packages/engine/src/derived.ts` — new `Candidate`; `Derived.candidates`;
  `DerivedValues.candidates`.
- `packages/engine/src/compute.ts` — `Computed.candidates`.
- `packages/engine/test/derived.test.ts` — a `SHEET-21` block, on Tales.
- `packages/system-5e/test/combat.test.ts` — a `SHEET-21` block.

#### 2. What is missing now

Measured on `main` at `2da9707`:
- `grep -rn "candidates" packages/engine/src`: nothing. `Computed` has `values`, `breakdown`,
  `keys`, `pendingKeys`, `warnings` and what gathering gives; no field lists a path's candidates.
- `armorClassBase` (`combat.ts`) builds every candidate (`Candidate`: `key`, `value`, `steps`)
  and returns only the chosen one's value and steps. Golden B without armor, with feats appending
  `10 + DEX + CON` (13) and `13 + DEX` (14): `ac.base` 14, its breakdown one step, the 14's. The
  module's own 11 and the 13 are in no part of `Computed`, so SHEET-35's control cannot offer them.
- `pnpm test`: `Test Files 75 passed (75)`, `Tests 1011 passed (1011)`; speed `2 passed`.

#### 3. What it should look like when done

1. **The core.** A module's step may give `candidates`, each `{ key, value, steps }`; `compute()`
   gives them as `Computed.candidates[path]`, in the step's order, as the step gave them. A path
   whose step gives none is not in `Computed.candidates`. The path's value and breakdown are the
   step's, then its effects and override, as before; neither changes a candidate.
2. **The base AC's candidates** are `Computed.candidates['ac.base']`: the module's own first,
   key `equipment` (the worn armor's, else 10 + DEX), then each number an `ac.formulas` effect
   appends now, key its part id, in `appendedNumbers`' order. A candidate's steps are its own,
   with no `acCalcChosen`, and add up to its value. Its name is its steps': the armor's entity
   step, the `unarmoredAC` rule step, or the effect's step and its label.
3. **The list does not depend on the pin.** Pinned or not, pinned to one that applies or not, the
   list is the same; a pin that does not apply is not in it (its warning, ENG-47's, says so).
4. **Made-up variants of golden B** (DEX +1, CON +2, chain mail 16; ENG-47's feats `guarded` 10 +
   DEX + CON when no armor is worn, `plated` 13 + DEX, `stance` 12 + DEX switched off by default):

   | Worn | Feats | `acCalc` | Candidates (key: value) | `ac.base` |
   |---|---|---|---|---|
   | nothing | guarded, plated | none | `equipment`: 11, guarded's: 13, plated's: 14 | 14 |
   | nothing | guarded, plated | `equipment` | the same three | 11 |
   | chain mail | guarded, plated | none | `equipment`: 16, plated's: 14 | 16 |
   | chain mail | guarded, plated | guarded's | `equipment`: 16, plated's: 14 | 16 |
   | nothing | stance, off | stance's | `equipment`: 11 | 11 |
   | nothing | stance, switched on | stance's | `equipment`: 11, stance's: 13 | 13 |

5. **An override does not change the list:** chain mail, plated pinned, an override of `ac.base`
   20: the candidates are `equipment` 16 and plated's 14; `ac.base` 20.
6. **Goldens:** each golden's one candidate is `equipment`, its value the golden's `ac.base` and
   its steps the golden's `ac.base` breakdown. No golden value changes.
7. `compute()` stays pure: frozen inputs give equal results, candidates included.
8. The quality gate is green. No file in `apps/web` changes, so no `pnpm e2e`.

#### 4. How to do it

1. `derived.ts`: `Candidate`; `Derived.candidates`; `computeDerived` keeps each step's candidates
   by path and gives them in its result, in the order of the paths.
2. `compute.ts`: `Computed.candidates` from `computeDerived`'s.
3. `combat.ts`: `armorClassBase` uses the core's `Candidate` and returns `candidates` from both
   of its returns.
4. Tests (§7), then the gate.

Technical choices (ADR 002):
- **A core field, not paths.** An effect's candidate is keyed by its part id
  (`<entityId>#<effectId>`), which is not a computed path step (camelCase only), so no stable
  `ac.calc.<key>` path can hold it; a path by position would move when an effect comes or goes.
  "A number chosen from several, each worked out" names no game, so the core carries it, as it
  carries `pendingKeys` for a key still to choose.
- **The step gives the list; the core never re-evaluates.** The formulas run once, inside
  `compute()`, read by their parts; a screen reads the list and decides nothing.
- **No name field.** Every number on screen is named by its breakdown; a candidate's steps already
  name its armor, its rule or its effect's entity, so a second name could only disagree.
- **No "chosen" flag.** The chosen one is the path's breakdown (`acCalcChosen` when pinned); the
  pin is the character's `systemData.acCalc`. A flag would repeat both.
- **Only the candidates that apply now.** A pin that does not apply warns (ENG-47); SHEET-35 shows
  it from that warning, not from a candidate with no value.

#### 5. Stored data

Nothing stored changes. The candidates are computed; the pin is ENG-47's field.

#### 6. What a person will see

Not a screen. SHEET-35's control reads `Computed.candidates['ac.base']`; its note in `BACKLOG.md`
says so.

#### 7. Tests

- `packages/engine/test/derived.test.ts` — `describe('SHEET-21 the candidates a path is chosen
  from')`: §3 item 1, on Tales.
- `packages/system-5e/test/combat.test.ts` — `describe('SHEET-21 every base AC calculation,
  computed for the pin')`: §3 items 2–7.
- Control numbers from: golden B's data and ENG-47's feats, worked out by hand in ENG-47 §3 and
  above; the goldens' `ac.base` from SPEC §6.7, unchanged.

#### 8. Checked against the source

Nothing new to check. The rule is ENG-47's (§8 there: SRD 5.2.1, "you choose which calculation to
use"; SRD 5.1 silent; dnd5e keeps a set of calculations); this ticket only gives the candidates
the step already works out.

#### 9. Not in this ticket

- The control that pins a calculation, its words, and how it shows a pin that does not apply:
  SHEET-35.
- Dropping a pin whose entity is removed: SHEET-22.
- Unarmored Defense, Mage Armor, Draconic Resilience as mechanics: phase 3.

#### 10. Rake check

- **The engine names no game.** `Candidate` is a key, a value and steps; tested on Tales; the AC
  is the module's.
- **`compute()` is pure.** The list is built inside the step, from what it reads; the purity test
  runs it frozen.
- **A number with no breakdown entry is a bug.** Each candidate carries its own steps, which add
  up to its value.
- **Manual overrides always win.** An override changes `ac.base`, not the list (§3 item 5).
- **The golden tests are the truth.** No expected value changes; item 6 reads them.
- **A stored-shape change needs a migration.** Nothing stored changes.
- **Licensing.** The feats are made up (`character:`).

#### 11. What came out of it

<!-- Filled at the end. Never left empty. -->
Measured on 2026-10-29, on `main` at `2da9707`:
- Before: `pnpm test` `Test Files 75 passed (75)`, `Tests 1011 passed (1011)`; speed `2 passed`.
- After: `pnpm lint` `Checked 232 files`, no fixes; `pnpm typecheck` exit 0; `pnpm test`
  `Test Files 75 passed (75)`, `Tests 1018 passed (1018)`, speed `2 passed`; the whole gate
  42.6 s. 7 tests are new: 2 in `derived.test.ts`, 5 in `combat.test.ts`. No file in `apps/web`
  changed, so no `pnpm e2e`.
- Every row of §3 item 4 is met, and items 1–3, 5–7. The golden tests pass unchanged.
- The tests catch mistakes. 4 breaks, each made alone, then `derived.test.ts` and
  `combat.test.ts` run (53 tests), the files restored and compared equal after each: no list when
  a pin applies, 4 failed; the candidates reversed, 6; the core dropping a step's candidates, 7;
  the core listing every path, 2.
- Differs from §4: ENG-47's made-up feats, pins and expected steps in `combat.test.ts` moved from
  inside its `describe` to the file's top level, unchanged, so the SHEET-21 block reads them too.
- Found, not fixed: nothing.
- Nothing for the changelog: no screen reads it yet.

---

### SHEET-61 A condition the character is immune to has no effect

**Hat:** A condition the character is immune to has no effect
**Depends on:** SHEET-15 (`defenses.conditionImmune.<key>`)
**Size:** S
**Screen:** No
**SPEC:** §5.4 (the `defenses.*` targets), §6.1 steps 1–2 and 6, §8.2

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/defenses.ts` — changes: `immuneConditions` (the module's
`withheldEntities`), `immuneConditionWarnings`, the rule `immuneCondition`.
- `packages/engine/src/compute.ts` — the hook `withheldEntities`, the passes, `computeOnce`,
  `MAX_COMPUTE_PASSES`, the warning `withheldUnsettled`.
- `packages/engine/src/gather.ts` — `gather` takes `without`; `Gathered.withheld`.
- `packages/system-5e/src/module.ts` — gives the hook and the warnings.
- `packages/system-5e/src/unconscious.ts` — no `noUnconsciousCondition` for an entry withheld.

#### 2. What is missing now

Measured on `main` at `afc38a5`, 2026-10-29:
- `git grep -n conditionImmune afc38a5 -- packages/engine/src packages/system-5e/src` finds only
  `defenses.ts`: the list's name, its entity type and `defensesOf`'s empty list. Nothing reads it.
- A condition stored for a character immune to it is gathered like any other: its effects apply,
  its grants give, `@conditions.<key>.level` reads its level. `setConditionLevel` sets it with no
  word.
- The module's `suppressedEffects` (ENG-46) runs before any value is computed, so it cannot read
  `defenses.conditionImmune.<key>`, whose effects may have a `when` or a switch.

#### 3. What it should look like when done

1. Setting a condition the character is immune to is not refused: it is stored (§8).
2. While the character is immune to its key, a condition it has is left out by `compute()`: not in
   `entities`, but in `withheld` with each place that gave it. Its effects give nothing, its
   grants give nothing, and `conditions.<key>.level` reads 0 with no step. The values are those of
   the character without the condition.
3. It warns `characterRule` `immuneCondition`, with `{ condition, key }`.
4. The immunity decides as its path does: switched off, or overridden to 0, the condition applies
   again. Nothing stored changes when the immunity comes or goes.
5. A condition another gives (an Incapacitated that a made-up `reeling` gives) is withheld where
   it is given; the giver applies. Casting no longer warns `incapacitated` for it.
6. An immunity that a withheld condition gave is gone: immune to `stone`, which is immune to
   `dazed`, both stored, `dazed` applies.
7. At 0 hit points, immune to the Unconscious condition: no condition, and no
   `noUnconsciousCondition` warning; with no entry at all, ENG-62's warning stays.
8. The core, on Tales: a module's `withheldEntities` names ids by what was computed; `compute()`
   runs again without them until the ids named are those left out. A pass that names none, or no
   hook, gives the result of today. Ids that never settle stop after 8 passes, with
   `withheldUnsettled` and the last pass's ids.

#### 4. How to do it

1. The core: `gather(…, without)` leaves out an id it meets in `without`, after looking it up (so a
   missing id still warns `missing`), and records it in `withheld`, absent when none was met.
2. `compute()` runs `computeOnce` with no ids; with the hook, it asks for ids, and while they
   differ from the last pass's, runs again without them. One pass when the hook names none, so
   the speed of a character with no immune condition is unchanged.
3. The module: `immuneConditions` gives the ids of the conditions had or withheld whose key is in
   `defensesOf(values).conditionImmune`. Each pass computes the immunities from scratch, so an
   immunity a withheld condition gave is gone in the next pass (§3 item 6).
4. `immuneConditionWarnings` reads `gathered.withheld`. `unconsciousWarnings` counts a withheld
   Unconscious entry as there.
5. No edition difference (§8), so nothing goes in `rulesets/`.

#### 5. Stored data

Nothing stored changes. The condition stays in `state.conditions`; `withheld` is computed.

#### 6. What a person will see

Not a screen. The conditions control (SHEET-42) reads `withheld` and the `immuneCondition`
warning to show a condition set but without effect.

#### 7. Tests

- `packages/engine/test/compute.test.ts` — `describe('SHEET-61 entities a module withholds')`, 5
  tests: §3 item 8 on Ash (Weary withheld: every skill 1 higher), a made-up `snared` that gives
  Lost, a missing id, the passes asked, the unsettled stop.
- `packages/system-5e/test/immune-conditions.test.ts` — `describe('SHEET-61 a condition the
  character is immune to')`, 7 tests: §3 items 1–7 on golden C of both editions, with made-up
  feats and conditions.
- Control numbers from: the made-up entities, worked out by hand: `dazed` takes 3 from the
  Dexterity save, `reeling` 2 from the Strength save; Ash's values from ENG-27's `expected.ts`
  less Weary's −1. No golden value is read or changed.

#### 8. Checked against the source

Sources, read 2026-10-29, the commits SHEET-15 read: SRD 5.1 as 5e-bits/5e-srd-api quotes it at
`e6edf9a51fad4b59a7e9561fad6c15232caed214` (`packages/5e-database/src/2014/en/5e-SRD-Rules.json`,
`5e-SRD-Conditions.json`); SRD 5.2.1 as foundryvtt/dnd5e at
`7bfb3f1c03e107bf65942151ef08d50ddb01ba8a` quotes it
(`packs/_source/content24/chapter-1/damage-and-healing.yml`, `appendices/rules-glossary.yml`);
dnd5e's code at the same commit (`module/documents/actor/actor.mjs`). CC-BY-4.0 for the SRDs.

**SRD 5.2.1.** Chapter 1: "Immunity to a condition means you aren't affected by it." Rules
Glossary (Immunity): "If you have Immunity to a damage type or a condition, it doesn't affect you
in any way." So its effects and what it gives stop, and a formula reading its level reads 0.

**SRD 5.1.** Its rules text has no paragraph on condition immunity (a search of the rules file for
"immun" finds objects, diseases and damage thresholds only). Petrified: "The creature is immune to
poison and disease, although a poison or disease already in its system is suspended, not
neutralized." So a condition that immunity meets stays, without effect, until the immunity ends:
it is kept, not removed.

**dnd5e.** One code for both editions. `hasConditionEffect`: "If immune, naturally never
applied" (`imms.has(status)` gives `false`); `conditionRollReductions` takes
`this.statuses.difference(immunities)`. `toggleStatusEffect` does not check immunity: the status
is set and stays on the actor. So setting is not refused, and the condition does nothing.

#### 9. Not in this ticket

- Exhaustion the character is immune to at its highest level: `isDead` (`fatalExhaustion`) reads
  the stored level without `compute()`, and `compute()` itself asks `isDead`, so it still kills.
  New row SHEET-64.
- A withheld condition is not in `entities`, so `conditionsRecoveredOn` keeps it through a rest:
  "suspended, not neutralized" (§8). No change.
- Ending concentration on the Incapacitated condition: SHEET-62, which reads the level, 0 while
  withheld.
- Showing the withheld condition on the sheet: SHEET-42.

#### 10. Rake check

- **The core names no game:** the core gains a game-free hook (entities a rule leaves out) and
  `without`, tested on Tales; immunity, `defenses` and conditions are the module's.
- **Everything is data:** no condition is named in code but Unconscious and Incapacitated, already
  read by their keys (ENG-62, SHEET-17); any condition key a pack immunizes works.
- **`compute()` is pure:** each pass is a pure `computeOnce`; the hook reads only the result.
- **Manual overrides always win:** the immunity is read from the computed values, after overrides
  (§3 item 4).
- **Missing is not broken:** a missing id withheld still warns `missing`; ids that never settle
  warn and give the last pass; nothing throws. Setting is warned, never blocked.
- **No rules text without an open license:** the test entities are made up; the quotes are
  CC-BY-4.0 SRD text, and dnd5e's code is quoted for its logic only.

#### 11. What came out of it

Quality gate, 2026-10-29, on `main` at `a78a8ee` (SHEET-18, SHEET-21 and OPS-30 landed while
this ran): `pnpm lint` 233 files, no fixes; `pnpm typecheck` 6 projects, no errors; `pnpm test` 76
files, 1030 passed, 0 failed, 18.9 s, then the speed project 1 file, 2 passed. Before the rebase,
on `afc38a5`: 1016 passed, against 1004 without this ticket's tests (+12, 5 core and 7 module).
Coverage: statements 99.47 % (3384/3402), lines 99.89 % (2968/2971). Not `apps/web`, so no `pnpm
e2e`.

Differences from the row: the row asked whether setting is refused or warned. It is neither
refused nor warned by the action: it is stored, and every `compute()` warns `immuneCondition`
while the immunity holds, so the warning follows the immunity, not the moment of setting.

The first draft of the module test measured golden C's walk speed; golden C has no species, so its
speed is 0 and a −10 floors to 0 either way. The made-up conditions now change saving throws.

Re-cut: SHEET-64 (XS), wave 3, new (SHEET-18 took SHEET-63 while this ran): exhaustion the character is immune to still kills. SHEET-62's
note now says setting is unchanged and the level reads 0 while withheld.

Found, not fixed:
- Exhaustion at its highest level kills a character immune to it (SHEET-64).

Nothing for the changelog.

---

### SHEET-62 Gaining the Incapacitated condition ends concentration

**Hat:** Gaining the Incapacitated condition ends concentration
**Depends on:** SHEET-17 (`INCAPACITATED_CONDITION`, its §8), SHEET-61 (`Computed.withheld`),
ENG-69 (`setConditionLevel`)
**Size:** XS
**Screen:** No
**SPEC:** §6.4 (the tracker actions); SHEET-17 §9 and §11 put the row here

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/conditions.ts` — changes: `setConditionLevel` ends the
concentration.
- `packages/system-5e/src/casting.ts` — new `incapacitatedBy`, which `castWarnings` now reads too.
- `packages/system-5e/test/incapacitated-concentration.test.ts` — new, the SHEET-62 tests.

#### 2. What is missing now

Measured on 2026-10-29 at `d4bee2f`:
- `setConditionLevel` returns the core's `setCondition` entry, plus `deathChanges` when the level
  kills. Nothing in it reads `state.concentration`.
- `grep -rn "CONCENTRATION_PATH, undefined" packages/system-5e/src`: `applyDamage` (0 hit points
  or a knock-out) and `endConcentration` only.
- So golden A concentrating on Bless and given the Incapacitated condition keeps
  `concentration: 'srd-2014:spell/bless'`.

#### 3. What it should look like when done

Golden A (2014) concentrates on Bless; golden B (2024) on the made-up `ward`. The made-up
conditions: Incapacitated (key `incapacitated`), Unconscious with an `entity` grant of it (as
SHEET-17 §8 quotes both SRDs), Dazed with no effect.
1. Setting Incapacitated, both goldens: changes `state.conditions` `[]` → `[{ id: incapacitated
   }]`, then `concentration` with `before` the spell and no `after`. Action `setCondition`,
   subject the condition. The entry reversed gives the character before.
2. Setting Unconscious that grants it: the same, with the Unconscious id.
3. The same result as the core's `setCondition`: setting Dazed; setting an Unconscious that grants
   nothing; a character concentrating on nothing; a character with a feat immune to
   `incapacitated` (SHEET-61 withholds it, so its level is 0), whose concentration stays Bless.
4. A character storing Incapacitated and still concentrating (a cast while incapacitated warns
   and happens, SHEET-17), given Dazed: the conditions change, then the concentration ends.
5. Golden B storing Incapacitated and exhaustion 5, concentrating, carrying ENG-63's charm and
   stone attuned, set to exhaustion 6: three changes in this order: the conditions, the
   concentration, the inventory unattuned (ENG-69).
6. Refusals stay the core's: setting a condition already stored at that level is `unchanged`.

#### 4. How to do it

1. `incapacitatedBy(computed)` in `casting.ts`: `computed.conditions.incapacitated` while
   `conditions.incapacitated.level` is 1 or more. `castWarnings` reads it, so one function says
   what incapacitated means.
2. `setConditionLevel`: after the core's set, when `state.concentration` is set, compute the
   changed character and ask `incapacitatedBy`. If it is, add
   `changeTo(character, CONCENTRATION_PATH, undefined)` after the core's changes and before
   `deathChanges`. The rule is "incapacitated after the set", not "Incapacitated is the condition
   set": both SRDs end concentration while incapacitated, whatever condition the set changes
   (item 4).

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/system-5e/test/incapacitated-concentration.test.ts` — `describe('SHEET-62 gaining
  the Incapacitated condition ends concentration', …)`: §3 items 1–6.
- Control values: worked out by hand in §3 from the stored data; the rule from SHEET-17 §8.

#### 8. Checked against the source

SHEET-17 §8 quotes both: SRD 5.1 (Concentration): "You lose concentration on a spell if you are
incapacitated or if you die." SRD 5.2.1 (Incapacitated): "No Concentration. Your Concentration is
broken." One rule in both editions, so nothing goes in `rulesets/`. Which conditions include
Incapacitated is each entry's grant (SHEET-17 §8). No golden value is touched. Nothing stops.

#### 9. Not in this ticket

- Death ending concentration ("or if you die", SRD 5.1): SHEET-65 (§11).
- Showing the ended concentration: the trackers' screen rows read the entry.
- A cast while incapacitated still sets concentration with a warning (SHEET-17's choice).

#### 10. Rake check

- **The core names no game.** All of it is in `system-5e`; the core's `setCondition` is unchanged.
- **Everything is data.** Incapacitated is read by its key; which conditions include it is each
  entry's grant.
- **Rulesets in their files.** One rule in both editions: no `if (ruleset …)`.
- **Missing is not broken.** A spell missing from every pack still ends: the change names only the
  stored id.
- **`compute()` is pure.** The action computes the changed character and reads `Computed`.

#### 11. What came out of it

Quality gate, 2026-10-29, on `d4bee2f`: `pnpm lint` 234 files, no fixes; `pnpm typecheck` 6
projects, no errors; `pnpm test` 77 files, 1040 passed, 0 failed, 26.1 s, then the speed project 1
file, 2 passed. 1030 before this ticket's 10 tests. Coverage: statements 99.47 % (3389/3407), lines
99.89 % (2973/2976). Not `apps/web`, so no `pnpm e2e`. Without the `conditions.ts` change, 6 of
the 10 fail (items 1, 2, 4 and 5); the 4 that pass are item 3's and item 6.

Differences from the row: the row says "gaining". The rule is "incapacitated after any set"
(§4 step 2), so a character already incapacitated and still concentrating loses it on the next set
of any condition (§3 item 4).

Found, not fixed:
- Dying keeps concentration. Measured: golden B at exhaustion 5, concentrating on `ward`, set to 6:
  the entry changes `state.conditions` and `systemData.inventory`, and `concentration` stays
  `character:spell/ward`. New row SHEET-65 (XS), wave 4.

Nothing for the changelog.

---

### SHEET-63 Attuning two copies of one item gives a warning

**Hat:** Attuning two copies of one item gives a warning
**Depends on:** SHEET-18 (`attunementWarnings`, the charms of its tests), ENG-33 (a row's
`itemId`, `attuned`)
**Size:** XS
**Screen:** No
**SPEC:** §8.2 (limits warn, never block); SHEET-18 §11 put the row here

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/attunement.ts` — changes: `attunementWarnings` also warns
`attunementCopies`.
- `packages/system-5e/src/module.ts` — changes: two comments name the new warning.
- `packages/system-5e/test/attunement.test.ts` — changes: the SHEET-63 tests.

#### 2. What is missing now

Measured on 2026-10-29 at `d4bee2f`:
- `attunement.ts` counts the attuned rows; `grep -n "itemId" packages/system-5e/src/attunement.ts`
  finds nothing. Two attuned rows of one item give no warning.
- `pnpm test`: unit `Test Files 76 passed (76)`, `Tests 1030 passed (1030)`, 11.84 s.

#### 3. What it should look like when done

The charms are SHEET-18's (`character:item/charm-1`, `charm-2`: each needs attunement, +1 AC).
1. Golden A and golden B, each with two rows of charm 1 equipped and attuned: one warning,
   `{ code: 'characterRule', rule: 'attunementCopies', data: { itemId: 'character:item/charm-1',
   attuned: 2 } }`, message "The character is attuned to 2 copies of character:item/charm-1; no
   more than one copy of an item."; no `attunementLimit`. AC is 1 higher than the golden's own:
   gathering names each entity once, so the charm gives +1 once.
2. One copy attuned and one not: no warning. One row of `qty: 2`, attuned: no warning.
3. Three rows of charm 1, one of them not equipped: `attuned: 3`. Two rows of an item no pack has
   (`character:item/lost`), not equipped: `{ itemId: 'character:item/lost', attuned: 2 }`.
4. Two custom rows, both "Lucky stone", attuned: no warning.
5. Rows charm 2, charm 1, charm 2, charm 1, all attuned: `attunementLimit` (4), then
   `attunementCopies` for charm 2, then for charm 1.
6. A frozen character with two copies: nothing throws, nothing changes, the same warning.
7. The quality gate is green.

#### 4. How to do it

1. `attunement.ts`: after the limit, count the attuned rows by `itemId`; one warning for each id
   counted twice or more, in the order of its first row.
2. Tests (§7), then the gate.

Technical choices (ADR 002):
- **A copy is a row of the same `itemId`.** The id is what makes two rows one item, found or
  missing (a missing item still names its id). A custom row names no item: two of one name may be
  two different things, so it is no one's copy.
- **A row is one attunement**, as in SHEET-18: `qty` is not read, equipped or not counts.
- **In the same function as the limit**, after it: one pass over the attuned rows, both warnings
  about the same flag.
- **Never a block.** No row's `attuned` is changed or refused; what the copies give is gathering's
  (each entity once), unchanged.
- **One rule in both editions** (§8), so no ruleset file.
- **`data` carries `itemId` and `attuned`**, so the screen writes the item's name itself.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen. The Gear tab (SHEET-50) shows the warning; its note in `BACKLOG.md` says so.

#### 7. Tests

- `packages/system-5e/test/attunement.test.ts` — `describe('SHEET-63 attuning two copies of one
  item gives a warning')`: items 1–6.
- Control values from: the SRD text of §8; the charm's +1 AC, counted by hand, once by the rule in
  `gather.ts` ("Each entity once").

#### 8. Checked against the source

Read on 2026-10-29. CC-BY-4.0.
- SRD 5.1, 5e-bits/5e-srd-api `e6edf9a51fad4b59a7e9561fad6c15232caed214`,
  `packages/5e-database/src/2014/en/5e-SRD-Rules.json` (Attunement): "a creature can't attune to
  more than one copy of an item. For example, a creature can't attune to more than one *ring of
  protection* at a time."
- SRD 5.2.1, foundryvtt/dnd5e `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a`,
  `packs/_source/content24/chapter-6/magic-items.yml` (Attunement, "No More Than Three Items"):
  "Additionally, you can't attune to more than one copy of an item. For example, you can't attune
  to more than one Ring of Protection at a time."
- So the rule is one in both. The row's note said SRD 5.2.1 does not say it; that was its Rules
  Glossary entry only. The magic items chapter does.

#### 9. Not in this ticket

- The warning on screen, and the item's name in it: SHEET-50.
- Whether a second copy's effects apply twice: gathering names each entity once (ENG engine
  rule); not changed here.

#### 10. Rake check

- **A rule lives in the module, never in a component:** `attunement.ts`.
- **The core names no game:** the engine is unchanged.
- **Prerequisites warn, never block (§8.2):** nothing is refused; the charm's AC applies (§3
  item 1).
- **No ruleset check:** one rule in both editions.
- **`compute()` is pure:** the warning reads only the character; the frozen test (§3 item 6).
- **No rules text without an open license:** the quotes are CC-BY-4.0; the charms are made up.

#### 11. What came out of it

- `pnpm lint`: `Checked 233 files`, no fixes. `pnpm typecheck`: 6 of 6 `Done`.
- `pnpm test`: unit `Test Files 76 passed (76)`, `Tests 1036 passed (1036)`, 11.57 s (1030
  before, plus 6 in `attunement.test.ts`). No file in `apps/web` changed, so no `pnpm e2e`.
- The tests catch mistakes. Each change made alone, then `attunement.test.ts` run (13 tests), then
  undone (the file compared equal to its copy after): two copies not enough (`< 3` for `< 2`),
  4 failed; only equipped rows counted, 1 failed; custom rows counted by name, 1 failed; the copy
  warning never given, 4 failed.
- Rebased onto SHEET-62, which a parallel chat pushed meanwhile. On top of it: `pnpm lint`
  `Checked 234 files`, no fixes; `pnpm typecheck` 6 of 6 `Done`; `pnpm test`: unit `Test Files 77
  passed (77)`, `Tests 1046 passed (1046)`, 11.88 s; the speed pass `2 passed`.

Differences from §3: none. From the row: SRD 5.2.1 does say the rule (§8), so it is one rule in
both editions, not a 2014 one.

**Found, not fixed:** nothing.

**Changelog:** nothing; no screen changes.

---

### SHEET-05 Animations are presets that stop for reduced motion

**Hat:** the motion presets, stopped for reduced motion
**Depends on:** SHEET-01, SHEET-02
**Size:** S
**Screen:** No — no screen moves anything yet; the one motion the boards draw is the step
chevron's turn in `V3-Create` and `V3-Conflict`
**SPEC:** ADR 015 items 1, 8, 9 and 13

---

#### 1. Where the code lives

**Main file:** `apps/web/src/theme/motions.ts` — new name of SHEET-01's empty `motion.ts`: the
presets, their theme keys, their still values, the app's switch, the style an element wears, and
the off-screen pause.
- `apps/web/src/theme/Motion.tsx` — new: the component a screen moves an element with.
- `apps/web/src/theme/motion.css` — new: the loops' keyframes and the paused rule.
- `apps/web/src/theme/part.ts`, `theme.ts` — change: a theme part may hold `still` values, written
  under `prefers-reduced-motion: reduce` and under the app's switch.
- `apps/web/src/index.css` — changes: imports `motion.css`; clears Tailwind's easings and
  animations.
- `biome/no-look-literals.grit` — changes: SHEET-02's check also fails on Tailwind's transition,
  duration, easing and delay classes.
- `apps/web/test/motion.test.tsx` — new. `apps/web/test/theme.test.ts`,
  `no-look-literals.test.ts`, `apps/web/e2e/theme.spec.ts` — change.

#### 2. What is missing now

- `apps/web/src/theme/motion.ts` is `export const motion: ThemePart = {};`.
- A screen can still write `className="transition duration-200"`: SHEET-02's check fails only on
  Tailwind's four animations and on an inline `transition` or `animation`.
- Nothing reads the phone's "reduce motion" setting, and the app has no switch for it.
- The boards' motion, counted with `grep -o "transition[^;\"]*"`: `transition: transform 0.2s ease`,
  4 times in `V3-Conflict.dc.html` and 6 in `V3-Create.dc.html`; from `turn_arrow()` in
  `docs/design/mockups/generator/gen13.py`, the chevron of a creation step (ADR 013).

#### 3. What it should look like when done

1. 4 presets: `turn` (a transition of `transform`, the boards' 200 ms `ease`), and the loops
   `pulse` (opacity), `float` (position) and `spin` (rotation).
2. Each preset fills `motion-<preset>-duration` (its speed), a loop with a size fills
   `motion-<preset>-size`, and `motion-<preset>` holds the value an element wears, built from
   them. No other `motion-` key.
3. Every keyframe sets only `opacity`, `translate`, `rotate` or `scale`; a transition moves only
   `transform` or `opacity`.
4. Under the phone's reduced motion, and under `data-motion="still"` on `<html>`
   (`setMotionStill(true)`), every `motion-<preset>` is `none`: in the built app the turn computes
   to `none 0s ease` and each loop to `none 0s`, with 0 running animations.
5. `<Motion preset as>` wears `transition` or `animation` from the preset's key, with
   `data-skin-motion`; a style the screen passes cannot override it. A loop is watched: off
   screen, or with the app in the background, it gets `data-motion-paused` and holds still.
6. `motionIsStill()` says whether motion is stopped now, for what CSS cannot stop.
7. The lint fails on `transition`, `transition-colors`, `duration-200`, `ease-in-out`,
   `delay-[50ms]` in a component, and passes `transition-none`.

#### 4. How to do it

1. `motionPresets` lists the presets with their kind, easing and base settings. `motionTheme()`
   writes the shared keys and a `still` key per preset, `none`; `motion = motionTheme()` joins the
   base theme as before.
2. `ThemePart` and `Theme` gain `still`. `mergeParts` refuses a still key filled twice, or one no
   concern fills. `themeCss` writes the still values last: once in
   `@media (prefers-reduced-motion: reduce) { :root { … } }`, once on
   `:root[data-motion='still']`, so they win over `:root`.
3. The loops' keyframes are fixed by the app, in `motion.css`, named `motion-<preset>`; they read
   the skin's size through `var(--theme-motion-<preset>-size)`, and use the individual
   `translate` and `rotate` properties, so an element's own `transform` stays.
4. `watchOnScreen(el)` puts `data-motion-paused` on the element from an `IntersectionObserver` and
   the page's `visibilitychange`; `motion.css` turns it into `animation-play-state: paused`.
5. The lint gets one more pattern in the same file, with its own message.

#### 5. Stored data

Nothing stored changes. The app's switch is a page attribute; keeping the choice is SHEET-13's.

#### 6. What a person will see

Not a screen: nothing moves yet. The first screen to move an element (the creation steps'
chevron, SHEET-27) wears `turn` with `<Motion>`.

#### 7. Tests

- `apps/web/test/motion.test.tsx` — the 4 names; the turn against the `V3-Create` and
  `V3-Conflict` boards, read by the test; every key filled and no other; the keyframes' properties;
  the still blocks in `themeCss`; `mergeParts` refusing a bad still key; `motionStyle`; the switch
  and `motionIsStill` on a fake page; `watchOnScreen` with a fake observer, off screen, hidden,
  stopped; `<Motion>` rendered to HTML.
- `apps/web/test/no-look-literals.test.ts` — three more bad lines, two more good samples.
- `apps/web/test/theme.test.ts` — the mapping check leaves out motion keys; Tailwind's easings and
  animations are cleared.
- `apps/web/e2e/theme.spec.ts` — the presets computed in the built app; the loops move; the
  phone's setting and the app's switch stop them; a paused loop holds; the frames measured.
- Control values from: the boards (§2).

#### 8. Checked against the source

Nothing to check: no rules fact.

#### 9. Not in this ticket

- Glow, sparkle and gradient shift (ADR 015 item 8): glow and sparkle need a layer or a picture
  over the element, and a shifting gradient moves a background, which a phone does not draw
  cheaply (item 9). They come with the animated frames and backgrounds of the skins' sale phase
  (item 16), which measures them.
- Which slot a skin animates with which loop, and a preset's colour setting: the skin file and its
  schema, the theme editor's phase (item 14). No loop has a colour yet.
- Dice effects for roll, land and critical: the dice phase (item 15).
- An animated picture or a video stopped for reduced motion: CSS cannot do it; the portrait row
  reads `motionIsStill()` (new note under SHEET-56).
- The switch on the settings page, and keeping the choice: SHEET-13.

#### 10. Rake check

- **No look is written in a component:** `Motion.tsx` names no duration or easing; every value is
  theme data; the lint now also fails on Tailwind's transition classes.
- **A skin is data, never code:** a skin sets a preset's speed and size through keys; the
  keyframes and the presets' list are the app's.
- **No user-facing string literal:** no new text.
- **Nothing invisible:** no zero-width character, byte-order mark or non-breaking space in the
  changed files (checked with a Python scan).

#### 11. What came out of it

**Measured on 2026-10-29, on top of OPS-28 (`d4bee2f`):**

- `pnpm lint`: `Checked 236 files in 381ms. No fixes applied.`
- `pnpm typecheck`: every project `Done`, exit 0.
- `pnpm test`: unit `Test Files 77 passed (77)`, `Tests 1040 passed (1040)` (1030 before, plus 10
  in `motion.test.tsx`), 16.88 s; speed `Tests 2 passed (2)`, 2.68 s.
- `pnpm e2e`: `19 passed (16.4s)` on `pixel-7`, with the new `SHEET-05` test.
- Rebased onto SHEET-62 and SHEET-63, which a parallel chat pushed meanwhile; both rows appended
  to this archive, and both are kept. On top of them (`0a5608a`): `pnpm lint` 237 files, no
  fixes; `pnpm typecheck` exit 0; `pnpm test` 1056 passed, 0 failed, 17.06 s, the speed pass 2
  passed, 2.54 s; `pnpm e2e` 19 passed, 0 failed, 18.6 s, 122 frames in 2 s, longest gap 16.8 ms.
- Measured in the built app: the turn `transform 0.2s ease`; `motion-pulse 2s`,
  `motion-float 3s`, `motion-spin 8s`; 30 loops running. Reduced motion, then the app's switch:
  `none 0s ease`, `none 0s` each, 0 running.
- Frames on the Pixel 7 profile with 30 loops on screen, three runs: 122 frames in 2 s, longest
  gap 16.8 ms; 121, 33.2 ms; 121, 16.8 ms.
- Differs from the row: the paused rule needs `!important`. The preset's inline `animation`
  shorthand sets the play state to `running`, which beat the plain rule in the first e2e run
  (`state: 'running'`). The suppression of Biome's `noImportantStyles` carries the reason.
- Differs from the row: `motion.ts` is now `motions.ts`. Beside `Motion.tsx`, an import of
  `./Motion` could open `motion.ts` on a disk that ignores case (macOS); the plural matches
  `slots.ts` and `parts.ts`.
- The e2e test draws the presets by hand, as SHEET-04's does, because no screen moves anything.
  The real `IntersectionObserver` path is covered by the unit test's fake, and the paused rule by
  the e2e test; the first screen with a loop shows the two together.
- In Chromium, `transition: none` computes to `none 0s ease`, not to `all 0s ease`.

**Found, not fixed:** an animated picture or a video keeps playing under reduced motion, because
CSS cannot stop it; written into the SHEET-56 note, with `motionIsStill()` for it.

**Changelog:** nothing for the changelog; nothing on screen moves yet.

---

### SHEET-22 Removing an entity drops what was stored for it

**Hat:** Removing an entity drops what was stored for it
**Depends on:** ENG-17 (stored switches), ENG-47 and SHEET-21 (the pinned base AC calculation)
**Size:** S
**Screen:** No
**SPEC:** §5.8 (`state.toggles`), §6.1 step 5 (the AC pin), §8.2

---

#### 1. Where the code lives

**Main file:** `packages/engine/src/trackers.ts` — changes: `droppedChanges`, `withDropped`;
`removeCondition` takes the module and ends with `withDropped`.
- `packages/engine/src/compute.ts` — `SystemModule.storedParts`, `StoredPart`.
- `packages/system-5e/src/combat.ts` — `AC_CALC_PATH`, `acCalcParts`.
- `packages/system-5e/src/module.ts` — `storedParts: acCalcParts`.
- `packages/system-5e/src/rests.ts`, `hit-points.ts` — a rest and a revival end with `withDropped`.

#### 2. What is missing now

Measured on `d4bee2f`:
- A stored switch stays after its entity is removed; `phases.ts` warns `toggleGone` for it on every
  compute (ENG-17 §11).
- A pin (`systemData.acCalc`) naming an effect of a removed entity stays; `combat.ts` warns
  `stepRule` `acCalcNotApplying` on every compute (ENG-47 §11).
- No action drops either. The actions that take an entity away today: the core's
  `removeCondition`, and fifth edition's `shortRest`, `longRest` and `revive`, which take a
  condition to level 0 through `conditionsRecoveredOn`.

#### 3. What it should look like when done

1. `droppedChanges(before, after, index, system)` gives one removal change per stored switch, then
   one per module `storedParts` place, whose part names an effect of an entity `before` has or
   withholds and `after` does not.
2. What names an effect neither side has, or one both have, stays: a switch no entity ever had; an
   item's effect while the item is carried but not equipped (fifth edition names only equipped
   items to `compute()`).
3. `withDropped(before, result, index, system)` adds those changes to the entry and applies them.
   A refusal, or a result with nothing to drop, is returned as the same object.
4. Tales: Brook under a made-up condition Spellbound (a switched `daze`, wits -1; a grant of Night
   Warden). Stored on: `charm`, `daze`, `glow`, and a switch of `gone-missing`. Before: grit 7,
   wits 7. `removeCondition` gives the conditions change, then `daze` and `glow` dropped; `charm`
   and the `gone-missing` switch stay; grit 6, wits 8 (ENG-27's Brook); `toggleGone` only for
   `gone-missing`, as before. Reversing the entry gives the character back.
5. Fifth edition: golden B under a made-up condition Braced (`brace`, switched, appends 13 + DEX to
   `ac.formulas`; ends on `long` and `revive`), `brace` on and pinned. Before: `ac.base` 14,
   `ac.total` 15. `removeCondition`, `longRest` and `revive` each end their entry with the switch
   and the pin dropped: `ac.base` 16, `ac.total` 17, no `acCalcNotApplying`.
6. A pin of a carried, unequipped item's effect stays when Braced is removed (it warns
   `acCalcNotApplying` before and after, as ENG-47 says a pin that does not apply does).

#### 4. How to do it

1. `compute.ts`: `StoredPart { path, part }`; optional `SystemModule.storedParts(character)`.
2. `trackers.ts`: `effectParts(computed)` (entities and `withheld`); `droppedChanges` computes both
   sides and compares; `withDropped` wraps a result. `removeCondition(character, index, system,
   ask, stamp)`.
3. Fifth edition: `acCalcParts` gives the pin unless it is absent or `equipment`; `rested` and
   `revive` wrap `settled` in `withDropped`.
4. Callers of `removeCondition` in the tests pass the module; no expected value changes.

Why a before/after comparison and not "names no effect the character has": fifth edition names
only equipped items to `compute()`, so the plain rule would drop the switches and the pin of an
item put away, which the person still carries.

#### 5. Stored data

Nothing stored changes. The changes remove a key of `state.toggles` and the optional
`systemData.acCalc`; both shapes stay valid.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/engine/test/trackers.test.ts` — `describe('SHEET-22 removing an entity drops what was
  stored for it')`: §3 items 1–4, on Tales; a module place (`notes.pin`) through a Tales module
  with `storedParts`.
- `packages/system-5e/test/dropped.test.ts` — the same `describe`: §3 items 5 and 6.
- Control numbers from: ENG-27's Brook (grit 6, wits 8) and Tales' rules; golden B (SPEC §6.7:
  `ac.base` 16, `ac.total` 17) and ENG-47's `plated` in chain mail (14, 15), worked out by hand.

#### 8. Checked against the source

Nothing to check: no rules facts. What is kept for an entity is the app's own data.

#### 9. Not in this ticket

- Actions that will take other entities away (an inventory row, a feat, a custom entry): their
  rows end them with `withDropped`. Noted on SHEET-50 and SHEET-52.
- Deleting a character, with its rolls and history: SHEET-25 (SHEET-07 §9 named this row too).
- Choices (`choices`, keyed by a grant's part) of a removed entity stay stored. Nothing warns on
  them, and they come back if the entity comes back. No change.

#### 10. Rake check

- **The core names no game:** switches and `storedParts` are game-free; the AC pin is the
  module's. Tested on Tales.
- **`compute()` is pure:** it is not changed; the actions call it on their inputs and outputs.
- **Missing is not broken:** a switch of an entity no pack has is kept and still warns
  `toggleGone`; nothing throws.
- **A stored-shape change needs a migration:** none changes (§5).
- **Undo:** the dropped changes are part of the action's one entry, so one undo brings them back.

#### 11. What came out of it

Quality gate, 2026-10-29, on `main` at `64cf0fc` (SHEET-62, SHEET-63 and SHEET-05 landed while
this ran): `pnpm lint` 238 files, no fixes; `pnpm typecheck` 6 projects, no errors; `pnpm test` 79
files, 1064 passed, 0 failed, 17.6 s, then the speed project 1 file, 2 passed. Coverage:
statements 99.44 % (3422/3441), lines 99.9 % (3002/3005). Before the rebase, on `d4bee2f`: 1038
passed, against 1030 without this ticket's tests (+8: engine 291 → 295, fifth edition 544 → 548).
Not `apps/web`, so no `pnpm e2e`.

Differences from the row: the row said "removing an entity" with no action to remove one. The
removal actions that exist (§2) now drop; the rule is one function the later removals call.

Found, not fixed:
- `toggleGone` reads `gathered.entities` only (`phases.ts`), so a stored switch of a condition
  withheld by immunity (SHEET-61) warns while it is withheld. No row: no SRD condition has a
  switch.

Nothing for the changelog.

---

### SHEET-08 The phase 1 fixtures ship as the built-in mini-pack

**Hat:** The phase 1 fixtures ship as the built-in mini-pack
**Depends on:** ENG-09, ENG-10, ENG-31, ENG-41
**Size:** M
**Screen:** No
**SPEC:** §12 stage 2 ("a mini-pack of the stage 1 fixtures"), §3, §5.3, §5.7; ADR 003, ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/content/src/index.ts` — changes: `BUILT_IN_PACKS`, `srd2014`,
`srd2024`. The other files it touches:

- `packages/content/src/packs/srd-2014.ts`, `srd-2024.ts` — moved (`git mv`) from
  `packages/system-5e/test/golden/`; they gain the simple-type entries of §4 step 3.
- `packages/content/package.json` — `@grimoire/system-5e` and `zod` join `dependencies` (types
  only); `@grimoire/engine` and `@types/node` join `devDependencies`, for the test.
- `packages/content/test/built-in.test.ts`, `test/tsconfig.json` — new.
- `packages/system-5e/src/entity-types.ts` — seven simple entity types.
- `packages/system-5e/src/system.ts`, `character.ts`, `pack.ts` — version 9, one step each.
- `packages/system-5e/test/golden/index.ts` — re-exports the two packs from `content`.
- `packages/system-5e/test/golden/checks.ts` — `keysNamedBy` reads the new keys.
- `biome.json`, `packages/engine/test/purity.test.ts` — the climb rule (§4 step 5).
- `apps/web/public/schema/5e/pack.schema.json` — rewritten by its test (ENG-38).

#### 2. What is missing now

Measured on 2026-10-29, at `d4bee2f`:

- `packages/content/src/index.ts` is `export {};`. The SRD fixtures live only in
  `packages/system-5e/test/golden/srd-2014.ts` and `srd-2024.ts`, which no package exports.
- A spell's `school`, a species' `size` and `creatureType`, an item's `magic.rarity`, a spell
  area's `shape`, a feat's `category` and a rule's `topic` are keys with no entity type, so
  nothing gives their name on screen (ENG-32's note). The module has 18 entity types.
- A file in `packages/schema/src`, `packages/engine/src` or `packages/system-5e/src` (and
  `src/rulesets/`) that imports `../../content/src/index.ts` passes `biome lint`: 0 diagnostics
  on four such sample files.

#### 3. What it should look like when done

1. `@grimoire/content` exports `BUILT_IN_PACKS`, equal to `[srd2014, srd2024]`. Each opens through
   `openFifthEditionPack` as it is, `from: { schemaVersion: 2, systemSchemaVersion: 9 }`.
2. Each carries `spdx: 'CC-BY-4.0'`, the CC legal-code URL and `redistributable: true`; each
   entity's id and `source.pack` name its own pack, and its `ruleset` is the pack's.
3. Both load into one content index: nothing refused, no warning, 140 entries (74 + 66).
4. The golden tests read these two files, through `test/golden/index.ts`; every golden value
   test passes unchanged.
5. The module has 25 entity types; the seven new ones (`size`, `creatureType`, `spellSchool`,
   `itemRarity`, `areaShape`, `featCategory`, `ruleTopic`) need a `key`.
6. SRD 5.1's pack holds the six sizes and the schools `enchantment` and `evocation`; SRD 5.2.1's
   holds the six sizes, `humanoid`, and the feat categories `origin` and `fightingStyle`. Every
   such key a fixture entity names has its entry (`keysNamedBy`: 63 keys in 2014, 89 in 2024).
7. `FIFTH_EDITION_SCHEMA_VERSION` is 9; a character or pack of version 8 opens as it is.
8. Lint refuses `../../…` in a file of `packages/schema/src`, `packages/engine/src` or
   `packages/system-*/src`, with a message naming SHEET-08.

#### 4. How to do it

1. **The packs move, the tests follow.** `git mv` both fixtures into `packages/content/src/packs/`.
   `test/golden/index.ts` re-exports `srd2014` and `srd2024` from
   `../../../content/src/index.ts`, so the tests and the app read one file. Technical choice
   (ADR 002): a relative path from a test, as `apps/web/test/characters.test.ts` already reaches
   the goldens, not a `devDependency` on `@grimoire/content`, which would make
   `content → system-5e → content` a workspace cycle. Lint does not cover test files.
2. **`content` imports the module, as types only.** The packs keep
   `satisfies z.input<typeof fifthEditionPackSchema>`; they are data, opened by the app through
   the module's opener when SHEET-09 loads them. `BUILT_IN_PACKS` is `readonly unknown[]`: a file
   is unknown until it is opened. That a pack is built-in is this list's to say, never the file's
   (ADR 003).
3. **The keys get names from simple types.** Technical choice (ADR 002): a simple entity type
   each, not the module's i18n keys, because these are content, which a pack, a homebrew pack and
   a translation overlay give (D3: everything is data), as `language` and `damageType` already
   are. A rule's `icon` gets no type: it names a picture, and every picture comes from the skin
   (ADR 015), not from a name on screen. The packs get only the entries their entities name, plus
   every size, which SHEET-66 needs.
4. **Version 9.** A version 8 file has none of the new types, so each step returns it as it is;
   a version 9 file that has one is refused as newer by a version 8 app, as ENG-66 did for
   `revive`.
5. **The climb.** Each of the three `noRestrictedImports` overrides gains the group `../../**`.
   From `src/` that leaves the package; from `src/rulesets/` it reaches the package root, which
   `src` never imports. No file in those folders imports `../../` today (`grep`, measured).

#### 5. Stored data

The module's stored shape changes: `FIFTH_EDITION_SCHEMA_VERSION` 8 → 9, one step in
`FIFTH_EDITION_CHARACTER_MIGRATIONS` and one in `FIFTH_EDITION_PACK_MIGRATIONS`, each returning a
copy of the file. Tested in `packages/system-5e/test/character.test.ts`, `SHEET-08 the simple
types that name keys are stored`. The core's `schemaVersion` (2) and Dexie's version do not
change.

#### 6. What a person will see

Not a screen. The packs reach the app with SHEET-09; the names show on the wave 6 tabs.

#### 7. Tests

- `packages/content/test/built-in.test.ts` — `SHEET-08 the built-in mini-pack`: §3 items 1–3, 6.
- `packages/system-5e/test/golden/fixtures-2014.test.ts`, `fixtures-2024.test.ts` — the counts
  and keys of §3 item 6, read through the moved files (item 4).
- `packages/system-5e/test/entity-types.test.ts` — item 5; `character.test.ts` — item 7;
  `packages/engine/test/purity.test.ts` — `SHEET-08 a core or module file never climbs out of its
  package`: item 8.
- Control numbers from: ENG-09 §8 and ENG-10 §8 (66 and 57 entities, 60 and 81 keys), plus the
  entries this ticket adds, counted by hand: 6 + 2 entities and 1 + 2 keys in 2014; 6 + 1 + 2
  entities and 2 + 1 + 3 + 2 keys in 2024 (the human's two sizes, its creature type, three feats'
  categories, two choices filtered by category).

#### 8. Checked against the source

5e-bits/5e-srd-api at `e6edf9a` (the commit ENG-02 measured),
`packages/5e-database/src/{2014,2024}/en/`:

- Sizes: `5e-SRD-Monsters.json`, every `size`: Tiny, Small, Medium, Large, Huge, Gargantuan in
  both editions (2024 also has "Medium or small", two of these).
- Schools: `5e-SRD-Magic-Schools.json`, eight in each edition, the same `index` and `name`;
  `enchantment` "Enchantment" and `evocation` "Evocation" are the two the 2014 spells name.
- Creature type: 2024 `5e-SRD-Species.json`, the human: `"type": "Humanoid"`.
- Feat categories: 2024 `5e-SRD-Feats.json`, `type`: `origin` (4 feats), `fighting-style` (4),
  `general` (2), `epic-boon` (7). Alert and Savage Attacker are `origin`, Defense
  `fighting-style`. The name is the slug's words: "Origin", "Fighting Style".
- The attribution texts of SPEC Appendix В are `[ПРОВЕРИТЬ]` against each PDF's legal page. Not
  reachable: `media.wizards.com` and `media.dndbeyond.com` answer 403 through the container's
  proxy; the 5e-srd-api repository holds neither text. So `license.attribution` stays out, as
  ENG-09 left it (§11).

#### 9. Not in this ticket

- Loading the built-in packs into the content index at start: SHEET-09.
- Every size as a key the `size` path takes: SHEET-66.
- The other schools, creature types, rarities, area shapes, feat categories and rule topics:
  the SRD import, phase 3.
- Showing the names: the wave 6 tabs.

#### 10. Rake check

- **Only openly licensed content**: the packs are SRD 5.1 and 5.2.1 (CC-BY-4.0), names only; no
  rules text is added.
- **A pack with `redistributable: false` never enters the public build**: the test refuses a
  built-in pack that is not `redistributable: true`.
- **Everything is data**: the new names are entries a pack gives, not literals in code.
- **A stored-shape change needs a migration**: version 9, a step in each list, tested.
- **Each system's rules live in its own module; the core never imports one**: the core imports
  nothing new, and lint now also refuses a climb out of a core or module package.
- **Golden tests are the truth**: no golden value changed; only fixture counts grew by the
  entries added.

#### 11. What came out of it

Measured on 2026-10-29, on top of SHEET-22 (`36886de`):

- `pnpm lint`: `Checked 240 files`, 0 errors. `pnpm typecheck`: exit 0.
- `pnpm test`: `Test Files 80 passed (80)`, `Tests 1072 passed (1072)` (1064 before, 8 new:
  5 in `content`, 2 for version 9, 1 for the climb); lines covered 99.9 % (3011/3014). The
  second suite (`Tests 2 passed (2)`) is unchanged. 31.7 s.
- `pnpm e2e`: `19 passed (22.7s)`.
- The tests are live: with SRD 5.2.1's feat categories left out of its pack, `5 failed | 64
  passed (69)` in `content` and the golden tests.
- Build: JS 500.82 kB (159.97 kB gzip), the same file (`index-DWdAgn4f.js`) as before: the app
  imports nothing from `content` yet, so no pack is in the public build until SHEET-09.
- Differs from the row: ENG-48's note (a size type gives every size as the `size` path's keys)
  needs the core to list a type's keys, which a derived step cannot do today; re-cut as
  SHEET-66. A rule's `icon` gets no type (§4 step 3). The ENG-31 note under phase 3 is done here
  and is deleted from the backlog.

Found, not fixed:

- The built-in packs have no `license.attribution` (§8); SHEET-09, which puts them in the public
  build, fills it from the checked texts first (note added to its row).
- A schema file can still name `@grimoire/content` by package name: its lint override refuses
  only the modules by name. It does not resolve (the schema package lists no such dependency), so
  typecheck fails instead of lint: `TS2307: Cannot find module '@grimoire/content'`, measured.

Nothing for the changelog.

---

### SHEET-11 The start page replaces the bottom bar

**Hat:** The start page replaces the bottom bar
**Depends on:** SHEET-03, SHEET-04 (slots and parts the pages draw with)
**Size:** M
**Screen:** Yes — the start page, board `V3-Start`, BRIEF Part 5 row P1; the page header of
`V3-Player` and `V3-Characters` (back arrow, title, gear)
**SPEC:** §7.1 as ADR 008 items 1–2 and ADR 013 item 16 change it; §9 (i18n)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/App.tsx` — changes: the router of every phase 2 screen.
- `apps/web/src/shell/routes.ts` — new: the paths, and `sheetPath(id)`.
- `apps/web/src/shell/AppLayout.tsx` — new, replaces `AppShell.tsx`: no bar; the toast host.
- `apps/web/src/shell/Page.tsx` — new: a page's header (back arrow, title, gear).
- `apps/web/src/pages/StartPage.tsx` — new: board `V3-Start`.
- `apps/web/src/pages/{Player,Settings,Characters,NewCharacter,Sheet,Dice}Page.tsx` — empty pages.
- `apps/web/src/shared/{ToastHost,Description,DicePanel,BreakdownSheet,RollDialog}.tsx` — empty.
- `apps/web/src/i18n/namespaces.ts` — new: the English namespaces; `index.ts`, `i18next.d.ts` read it.
- `apps/web/src/locales/en/*.json` — one file per screen and per shared piece.
- Deleted: `shell/AppShell.tsx`, `shell/tabs.ts`, `pages/PageTitle.tsx`, `pages/LibraryPage.tsx`.

#### 2. What is missing now

- `/` redirects to `/characters`; every page sits above SETUP-04's bottom bar of four tabs
  (`tabs.ts`: `/characters`, `/library`, `/dice`, `/settings`), which ADR 008 item 1 removes.
- No start page, no player page, no route for the manual form or the sheet.
- One i18n namespace, `common`, holding `nav.*`: every screen row of a wave would edit it.
- No file for the toast host, the dice panel, the roll dialog, the breakdown or the description.

#### 3. What it should look like when done

1. `/` shows the start page: the app's name (`APP_NAME`) as the `h1`, the chip "5E compatible ·
   2014 and 2024 rules", the gear, and two squares: Player (a link to `/player`, "Characters,
   sources, library, dice") and DM ("Coming later", not a link). No `navigation` element, no back
   arrow.
2. Every other page has a header: a back arrow (44 × 44 px or more), its title as the `h1`, and the
   gear where the board draws one (Player). The routes and where back goes:
   `/player` → `/`; `/characters` → `/player`; `/characters/new` → `/characters`;
   `/characters/:id` → `/characters`; `/dice` → `/player`; `/settings` → the page it was opened
   from, or `/` when it was the first page opened.
3. An unknown path opens `/`. The start page shows on every start (ADR 008 "Still open").
4. Each screen and each shared piece has its own namespace file: `start`, `player`, `settings`,
   `characters`, `create`, `sheet`, `dice`, `toast`, `roll`, `breakdown`, `description`, plus
   `common` (Back, Settings, Coming later). Every file in `locales/en/` is loaded; a test fails if
   one is not.
5. The five shared pieces exist and render nothing. `ToastHost` is mounted over every page.
6. Nothing is wider than 360 px; dark stays the default.

#### 4. How to do it

1. `routes.ts` holds the paths as data; `App.tsx` maps each to its page under `AppLayout`.
2. `Page` draws the `page` slot, then a `header`: `BackButton`, the `h1` in `font-heading
   text-28`, and `GearLink`. Both icon buttons are `<Part name="icon-button">`. `back="history"`
   steps back with `navigate(-1)` unless React Router's location key is `default` (the first page
   of a visit), in which case it links to `/`.
3. `StartPage` draws the `page` slot, the gear, the name, the chip (`<Part name="chip">` on
   `bg-soft`) and the squares (`<Part name="card" fill="card">`).
4. `namespaces.ts` imports each locale file (with `type: 'json'`, so Playwright's Node loader
   reads it too); `index.ts` loads `Object.keys(en)`; the type declaration takes `typeof en`.
5. Replace the SETUP-04 tests of the bar (`tabs.test.ts`, `shell.spec.ts`) by SHEET-11's; point
   SETUP-05's, SETUP-07's and SHEET-03's tests at the new pages.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

- The app opens on the start page: "GrimoireMancer" in the heading font, the system chip under it,
  the gear top right, the two squares at the bottom. Dark by default, light the same way.
- Player opens an empty page titled "Player" with a back arrow and the gear. The DM square is
  greyed and says "Coming later".
- Every other screen is an empty page with a back arrow and its title, until its row fills it.
- English keys: `common` — `back` "Back", `settings` "Settings", `comingLater` "Coming later";
  `start` — `system` "5E compatible · 2014 and 2024 rules", `player.title` "Player",
  `player.hint` "Characters, sources, library, dice", `dm.title` "DM"; `title` in `player`
  "Player", `settings` "Settings", `characters` "My characters", `create` "New character",
  `sheet` "Character", `dice` "Dice".

#### 7. Tests

- `apps/web/test/navigation.test.tsx` — the paths, `sheetPath`, every locale file loaded as a
  namespace, each page's title, the empty pieces.
- `apps/web/test/i18n.test.ts` — SETUP-05's checks on the new `common` keys.
- `apps/web/e2e/navigation.spec.ts` — the start page, Player and back, every route with its title
  and back target, the gear and Settings' back, an unknown path; screenshots.
- `apps/web/e2e/pwa.spec.ts`, `theme.spec.ts` — the offline check and the slots, on the new pages.
- Control values from: board `V3-Start` and `V3-Player` (text, header), ADR 008, ADR 013.

#### 8. Checked against the source

Nothing to check: no rules fact.

#### 9. Not in this ticket

- The player page's six sections: SHEET-12. Settings' choices: SHEET-13.
- The lists, forms and the sheet's frame and tabs: SHEET-24, 27, 30 (SHEET-30 gives each tab its
  file and decides the tabs' namespaces).
- What each shared piece does, and where it is mounted: SHEET-23, 31, 33, 38, 39.
- The system picker before the start page (ADR 013 item 15) and the DM side: later phases.
- Loading the built-in packs at start: SHEET-09 (`main.tsx` is untouched).

#### 10. Rake check

- **No look written in a component**: every colour, font and size is a token class; the squares,
  the chip and the icon buttons are `<Part>`, the backgrounds `<Slot>`; lint is green.
- **No user-facing string literal**: every visible string is an i18n key; the app's name comes
  from `APP_NAME`; lint is green.
- **"5E compatible" is the only phrase for fifth edition**: the chip says exactly that; no other
  name.
- **No external requests**: no new request; SETUP-07's offline test still sees only the app's own
  origin.

#### 11. What came out of it

Measured on 2026-10-29, on top of SHEET-08 (`8bb21cd`):

- `pnpm lint`: `Checked 260 files`, 0 errors. `pnpm typecheck`: exit 0.
- `pnpm test`: `Test Files 80 passed (80)`, `Tests 1073 passed (1073)`, 23.35 s; the second
  suite `Tests 2 passed (2)`. Unit tests in `apps/web`: 91 (SETUP-04's 4 tab tests gone,
  SHEET-11's 5 new).
- `pnpm e2e`: `20 passed (23.2s)` (SETUP-04's 4 bar tests gone, SHEET-11's 5 new).
- Build: `index-BAupy7B3.js`, 475,470 bytes; 150,187 bytes through `gzip -c`.
- Screenshots at 360 × 800: the start page dark and light, the player page, Settings; the name
  "GrimoireMancer" at `text-48` fits the width (`scrollWidth` 360).
- Differs from the board: the start page has no back arrow (the board's leads to the system
  picker, which ADR 013 item 15 keeps for a second system). The chip is filled with `soft`
  instead of the board's muted outline: the base pick for `chip` is `flat` (SHEET-04), and a page
  cannot re-pick a part. The name is `text-48`, not the board's 54 px: "GrimoireMancer" is longer
  than the board's "Grimoire". The page header is not the `header` slot: the boards draw it with
  no fill, and the `header` slot paints `surface` (the sheet's pinned header, SHEET-30).
- Decided here (ADR 002): Settings' back arrow steps back through history, since the gear opens
  it from several pages. The Library route is gone; Library opens with phase 3 (ADR 013
  item 17). SHEET-03's e2e test now counts the start page's slots: `app`, `page`, `card`, `card`.

Found, not fixed:

- SHEET-02's lint reads `fill="card"` on `<Part>` as an SVG colour and fails it, so a page cannot
  write SHEET-04's `fill` prop as a string. `StartPage.tsx` passes it through a constant. New row
  SHEET-67.

Changelog: "The app opens on a start page with Player and DM instead of the bottom bar; every page
has a back arrow."

---

### SHEET-37 Rolls are kept in the roll log

**Hat:** Rolls are kept in the roll log
**Depends on:** SHEET-07, ENG-26, ENG-06
**Size:** S
**Screen:** No
**SPEC:** §6.5 (the log of a character's last 100 rolls), §5.8 (migrations), §11 (the `rollLog`
table)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/db/rollLog.ts` — new: `logRoll`, `readRollLog`, `ROLL_LOG_LIMIT`. The
other files it touches:

- `packages/schema/src/roll.ts` — changes: `ROLL_LOG_SCHEMA_VERSION`, `rollLogRowSchema`,
  `rollLogRowOf`, `openRollLogRow`.
- `apps/web/src/db/db.ts` — changes: `RollLogRow` is a stored object, at whatever version.
- `packages/schema/test/roll.test.ts` — changes: the row's tests.
- `apps/web/test/rollLog.test.ts` — new.

#### 2. What is missing now

Measured on 2026-10-29, at `84f423c`:

- `grep -rn "rollLog" apps/web/src` finds only `db.ts`: the table exists (SHEET-07), keyed by `id`
  with the index `[characterId+rolledAt]`; nothing writes or reads it.
- `rollRecordSchema` (ENG-26) is strict and has no version field, so a record stored as it is
  could never migrate (ENG-26 §11, "Found, not fixed").
- Nothing keeps a log to 100 rolls.

#### 3. What it should look like when done

1. `logRoll(record)` stores the row `{ schemaVersion: 1, id, characterId, rolledAt, record }` and
   returns `{ ok: true, record }`. `characterId` is the record's `by.actorId`, absent when it has
   none; `rolledAt` is the record's time as `toISOString` writes it.
2. After 101 rolls of one character, the table holds 100 rows; roll 1 is gone; `readRollLog`
   lists rolls 101 down to 2, newest first.
3. A roll logged after 100 newer ones is dropped as it is logged; the table holds 100.
4. One character's 101st roll drops none of another character's rolls nor of the rolls made off
   a sheet: 100 + 1 + 3 = 104 rows.
5. The rolls made off a sheet (no `actorId`) are kept to 100 the same way.
6. Rolls at `18:00:00.500Z`, `18:00:00Z`, `18:00:01Z`, logged in that order, read back newest
   first by time: the third, the first, the second.
7. A record whose total is not the sum of its breakdown is not stored: `{ ok: false, code:
   'invalid' }`, 0 rows.
8. A row at `schemaVersion` 2 and a row whose record does not add up are listed in `refused`
   (`newer`, `invalid`), not thrown, and stay as they were.
9. `rollLogRowSchema` refuses a key that is not the record's (`id`, `characterId`, `rolledAt`), an
   unknown field, and a missing version.

#### 4. How to do it

1. `packages/schema/src/roll.ts`: the row schema wraps the record unchanged, so the record stays
   what the table link sends (ADR 005 item 5.6), and the version belongs to the log. The row's
   `id`, `characterId` and `rolledAt` repeat the record's for the table's keys; a `superRefine`
   refuses a row where they differ. `openRollLogRow` is `openerOf` with an empty chain, so
   version 2 is one step away.
2. **The time is stored in one form.** Technical choice (ADR 002 item 1): the index sorts
   `rolledAt` as text, and `z.iso.datetime()` accepts `18:00:00Z` and `18:00:00.500Z`, which sort
   the wrong way round as text (`.` before `Z`). The row's `rolledAt` is
   `new Date(record.rolledAt).toISOString()`, always three decimals; the record keeps its own text.
3. `apps/web/src/db/rollLog.ts`: `logRoll` builds the row, opens it through the frame (a record
   the schema refuses is not stored), then in one `rw` transaction puts it and deletes the oldest
   of that character's rows past 100. One character's rows come from the compound index; the
   rows made off a sheet are not in it (Dexie leaves out a key with an undefined part), so they
   are filtered and sorted by `rolledAt`.
4. `readRollLog(characterId)` reads the same rows newest first, at most 100, and opens each; a
   refused row goes into `refused` with its id, code and message. Opening never writes, as
   SHEET-10 chose for characters.
5. **The rolls made off a sheet are kept to 100 too.** Technical choice: SPEC §6.5 names a
   character's log only; the dice page (SHEET-38) rolls for no character, and its rolls would
   otherwise grow without end.

#### 5. Stored data

The `rollLog` table (SHEET-07) gets its first rows, shape version 1 (`ROLL_LOG_SCHEMA_VERSION`),
with an empty migration chain. No Dexie version bump: the table, its key and its index stay as
SHEET-07 made them. `CharacterDoc`, `ContentPack` and `RollRecord` do not change.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/schema/test/roll.test.ts` — `SHEET-37 the roll log row`: §3 items 1 and 9 on the
  row, and a version 2 row refused as `newer` (`found: 2`, `current: 1`).
- `apps/web/test/rollLog.test.ts` — `SHEET-37 the roll log`: §3 items 1–8, each on a fresh
  database.
- Control numbers from: SPEC §6.5 (100); ENG-26's record fixtures; the rolls' times and ids are
  written by hand from their number n (n seconds after 18:00, uuid ending in n).

#### 8. Checked against the source

Nothing to check: no rules facts.

#### 9. Not in this ticket

- Rolling, and showing the log ("History" on board `V3-SheetDice`): SHEET-38; the roll dialog
  that logs a sheet's roll: SHEET-39. Each calls `logRoll`; the panel reads `readRollLog`.
- Dropping a deleted character's rolls: SHEET-25 (its note already names `rollLog`).
- A version on what the table link sends: the table link's phase (ENG-26 §11).
- Vibration on Android (SPEC §6.5): phase 7, Android.

#### 10. Rake check

- **A stored-shape change needs a migration**: the row carries `schemaVersion` from its first
  write and opens through the migration frame; a newer row is tested to be refused and kept.
- **Missing is not broken**: a row that does not open is named in `refused`, never thrown; a
  refused record gives a code, not an exception.
- **Ids are stable**: a row is keyed by the record's own `id`.
- **No telemetry, no external requests**: IndexedDB only.
- **Everything is data**: the log names no game; the fixtures are a made-up game's rolls.

#### 11. What came out of it

Measured on 2026-10-29, on top of SHEET-11 (`d14400f`):

- `pnpm lint`: `Checked 262 files`, 0 errors. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: `Test Files 81 passed (81)`, `Tests 1084 passed (1084)` (1073 before, 11 new:
  3 in the schema, 8 in the app), 23.7 s. The second suite: `Tests 2 passed (2)`, unchanged.
- `pnpm e2e`: `20 passed (16.8s)` on `pixel-7`, unchanged.
- The tests are live: with the trimming removed, 4 of the 8 app tests failed; with `rolledAt`
  stored as the record's text, §3 item 6 and the row's first schema test failed.
- Differs from §3: none. Differs from the row: the rolls made off a sheet are kept to 100 too
  (§4 item 5).

Found, not fixed:

- Rolls with the same `rolledAt` to the millisecond sort by their uuid, not by the order they
  were made. The app writes one roll at a time from `new Date()`, so two in one millisecond are
  unlikely; nothing to do now.

Nothing for the changelog.

---

### SHEET-66 An effect may set the size to any size the packs hold

**Hat:** the size path takes every size the packs hold
**Depends on:** ENG-48, SHEET-08
**Size:** S
**Screen:** No
**SPEC:** §5.4 (key paths), §6.1 steps 6–8, §8.2

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/size.ts` — changes: the size path's keys are every size.
- `packages/engine/src/gather.ts` — new: `KeysOfType` and `keysOfTypeOf`, the keys of a type as
  the character finds them.
- `packages/engine/src/derived.ts` — `DeriveInput` gains `keysOf`; `KeyPath` gains `options`,
  the keys a pending choice is made among; `computeDerived` lists them as the pending options.
- `packages/engine/src/compute.ts` — builds `keysOf` and passes it with `find` and `findKey`.
- `packages/engine/test/derived.test.ts`, `packages/system-5e/test/size.test.ts` — the tests.

#### 2. What is missing now

Measured on `84f423c`:
- `sizeKeys` (`size.ts`) gives `keys: sizes`, the species' or lineage's own sizes. Golden B (the
  2024 human, `['medium', 'small']`) with an effect `set` `large` warns `unknownKey` with
  `keys: ['medium', 'small']` and keeps `small` (`size.test.ts`, "sets one of the species'
  sizes"). An override `large` warns `overrideNotAKey` the same way.
- The built-in packs hold all six sizes as `size` entries (SHEET-08), but `DeriveInput` gives a
  step only `find(id)` and `findKey(type, key)`: one entry each, never a list.
- `KeyPath.keys` is both what an effect may set and what a pending choice offers
  (`computeDerived`, `pendingKeys.push({ path, options: own.keys })`), so widening the keys would
  widen the choice too.

#### 3. What it should look like when done

1. `DeriveInput.keysOf(type)` gives each key of the type's entries, each once: the packs' in load
   order, then the character's own, only those `findKey(type, key)` finds (its rules base, or any
   when it mixes rulesets). Ash (Tales, `first-age`): `keysOf('skill')` is
   `['climb', 'sneak', 'steady']`; with an own `skill` `leap` (`any`) and `drift` (`second-age`),
   `['climb', 'sneak', 'steady', 'leap']`; mixing rulesets adds `drift`; a type with no entry
   gives `[]`.
2. `KeyPath.options`, when given, are a pending path's options in place of `keys`. A path without
   it is pending with its `keys`, as before (ENG-48's test unchanged).
3. The `size` path's `keys` are the sizes `keysOf('size')` gives, then any size of the species or
   lineage not among them. On SRD 5.2.1's pack that is `['tiny', 'small', 'medium', 'large',
   'huge', 'gargantuan']`; its `options` are the species' or lineage's own sizes.
4. Golden B with an effect `set` `large`: the size is `large`, with no warning. An override
   `large` wins the same way. A size no pack holds (`colossal`) still warns `unknownKey` /
   `overrideNotAKey`, listing the six.
5. The stored choice stays among the species' sizes: golden B storing `large` still warns
   `sizeNotOffered` and is pending with `['medium', 'small']`.
6. Every golden's values, keys and warnings are as before.

#### 4. How to do it

1. `gather.ts`: `export type KeysOfType = (type: string) => readonly string[]` and
   `keysOfTypeOf(character, index, findKey)`: walk `index.entities`, then
   `character.localEntities`, collect each key of the type once, keep those `findKey` finds.
   Technical choice (ADR 002): read `index.entities` rather than add a method to `ContentIndex`;
   the list is built once per call, and the size path calls it once per pass.
2. `derived.ts`: `DeriveInput.keysOf: KeysOfType`; `KeyPath.options?: readonly string[]`;
   `pendingKeys.push({ path, options: own.options ?? own.keys })`.
3. `compute.ts`: `const keysOf = keysOfTypeOf(character, index, findKey)`, added to the input of
   `suppressedEffects` and to `DeriveInput`.
4. `size.ts`: `keys: [...new Set([...input.keysOf(SIZE_TYPE), ...sizes])]`, `options: sizes`. The
   type name `size` is the module's (`sizeDefSchema`), named once in `size.ts`.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen. The size shows on the wave 6 tabs.

#### 7. Tests

- `packages/engine/test/derived.test.ts` — `SHEET-66 the keys of a type, and a choice among
  fewer`: §3 items 1–2.
- `packages/system-5e/test/size.test.ts` — the ENG-48 effect and override tests change to §3
  item 4; a new test for item 3; the stored-size test (item 5) is unchanged.
- Control numbers from: the Tales data (`tales/content.ts`: the three skill keys, `climb` once per
  edition); SHEET-08 §8 (the six sizes, in the packs' order); ENG-48 §8 (golden B's sizes).

#### 8. Checked against the source

- ENG-48 §8: SRD 5.2.1's goliath, Large Form, changes the character's size to Large, a size its
  species does not offer; so an effect must be able to name every size, not only the species'.
- SHEET-08 §8: six sizes in both editions, Tiny to Gargantuan, which the packs hold.
- ENG-48 §8: the size chosen with the species is one of the species' sizes; so the choice keeps
  its own list.

#### 9. Not in this ticket

- The goliath and its Large Form as content: the SRD import, phase 3.
- An effect one size larger or smaller (Enlarge/Reduce): ENG-48 §9.
- What a size changes (carrying capacity, space): ENG-48 §9.
- The screen that shows or asks for the size: the wave 6 tabs.

#### 10. Rake check

- **Everything is data**: the sizes come from the packs' `size` entries, not a list in code.
- **The core names no game**: `keysOf` takes any type; only `size.ts` names `size`.
- **`compute()` is pure**: `keysOf` reads the character and the index and changes neither; the
  frozen-input test still runs.
- **Missing is not broken**: a size no pack holds warns and is not applied; it never throws.
- **Golden tests are the truth**: no golden value changes (§3 item 6).

#### 11. What came out of it

Measured on 2026-10-29, on top of SHEET-37 (`b80ee14`):

- `pnpm lint`: `Checked 262 files`, 0 errors. `pnpm typecheck`: exit 0.
- `pnpm test`: `Test Files 80 passed (80)`, `Tests 1088 passed (1088)` (1084 before, 4 new: 2 in
  `derived.test.ts`, 2 in `size.test.ts`; 2 ENG-48 tests in `size.test.ts` rewritten to §3
  item 4); lines covered 99.9 % (3018/3021). The second suite (`Tests 2 passed (2)`) is
  unchanged. 18.7 s.
- No `pnpm e2e`: nothing in `apps/web` changed.
- The tests are live: with the size's keys put back to the species' own, `4 failed | 5 passed
  (9)` in `size.test.ts`; with the pending options put back to `keys`, `5 failed | 25 passed
  (30)` in `derived.test.ts` and `size.test.ts`.
- §3 as written. One test more than §7 named: a species size no entry names (`wee`) is listed
  after the packs' six.
- No golden value changed.

Found, not fixed: nothing.

Nothing for the changelog: not a screen.

---

### SHEET-09 Built-in packs load into the content index at start

**Hat:** Built-in packs load into the content index at start
**Depends on:** SHEET-08, SHEET-10, ENG-25
**Size:** S
**Screen:** No
**SPEC:** §3, §5.7, §6.1, §8.2, Appendix В; ADR 003 items A3, A7, B1; ADR 004

---

#### 1. Where the code lives

**Main file:** `apps/web/src/content/packs.ts` — new: `installBuiltInPacks`, `startPacks`,
`installedPacks`, `contentOf`. The other files it touches:

- `apps/web/src/systems.ts` — changes: `AppPack`, `PACK_OPENERS`, `packOpenerOf`, beside the
  character openers.
- `apps/web/src/main.tsx` — changes: opens the packs before the first render.
- `packages/content/src/packs/srd-2014.ts`, `srd-2024.ts` — each pack's `license.attribution`.
- `packages/content/test/built-in.test.ts` — the attribution is checked.
- `apps/web/test/packs.test.ts` — new.

#### 2. What is missing now

Measured on 2026-10-29, at `8bb21cd`:

- Nothing in `apps/web/src` imports `@grimoire/content` or `loadContentIndex`, or opens a pack:
  `grep` finds no such line. The build's JS is 500.82 kB (159.97 kB gzip, `index-DWdAgn4f.js`),
  the same file as before SHEET-08: no pack is in the build.
- `apps/web/src/systems.ts` has character openers only; a pack file has no way to its system's
  opener.
- A character's `packs` that is not on the device never reaches `loadContentIndex`, so nothing
  names it; each of its entries would show only `Missing: <id>` (ENG-25's note).
- The two built-in packs carry no `license.attribution` (SHEET-08 §8, §11).

#### 3. What it should look like when done

1. `installBuiltInPacks()` opens `BUILT_IN_PACKS` through each file's system opener:
   `[['builtIn', 'srd-2014'], ['builtIn', 'srd-2024']]`, nothing unopened.
2. A file of system `tales`, one of version 10 and one with `entities: 'none'` are left out with
   `unknownSystem`, `newer` and `invalid`; the file after them still opens.
3. `main.tsx` calls `startPacks()` before the first render; `installedPacks()` gives what it opened.
4. `contentOf(goldenA)`: `loaded` `['srd-2014']`, nothing refused, warned or not installed, 74
   entries; golden A's species is found.
5. `contentOf(goldenE)`: `loaded` `['srd-2024']`, `notInstalled` `['hb-local']`, 66 entries;
   `hb-local:feat/arcane-scholar` gives `missing`.
6. The index loads in the character's order: `['srd-2024', 'srd-2014']` gives that `loaded`, 140
   entries.
7. The app carries one pack opener, `5e`; `packOpenerOf` finds nothing for `tales`, `toString`,
   `__proto__`, `5` or `undefined`.
8. Each built-in pack's `license.attribution` is SPEC Appendix В's text for its SRD, as checked
   in §8.

#### 4. How to do it

1. `systems.ts`: `PACK_OPENERS`, system id → pack opener, with `5e` → `openFifthEditionPack`;
   `packOpenerOf` reads it with `Object.hasOwn`, as `characterOpenerOf` does.
2. `content/packs.ts`: `installBuiltInPacks(files = BUILT_IN_PACKS)` runs each file through its
   system's opener and records it as `builtIn` (ADR 003 item A7: the app says where a pack came
   from). `startPacks()` keeps the result; `installedPacks()` reads it. `contentOf(character,
   packs)` takes the character's `packs` in order, finds each among the installed packs, lists
   the rest in `notInstalled`, and runs `loadContentIndex(character.system, found)`.
3. `main.tsx`: `startPacks()` before the first render; a file that does not open is logged.
4. Each pack's `license.attribution` from §8's checked text.

Technical choices (ADR 002):
- **The packs open at start; the index is built per character.** `loadContentIndex` takes the
  character's system and its packs in its order (ENG-25), and `compute()` takes the character's
  index (SPEC §6.1). No character is open at start, so start opens the packs, and the screen that
  opens a character builds its index with `contentOf`. Opening is pure and the built-in packs are
  in the build, so it runs before the first render, with no loading state.
- **A pack not on the device is named, not refused.** It is only missing (SPEC §8.2):
  `notInstalled` holds its id once, for the sheet, and its entries look up as `missing`.
- **Packs are found by id only.** A pack of another system with the same id reaches the loader,
  which refuses it as `otherSystem` (ENG-25); the check stays in one place.
- **Installed packs in the `packs` table are not read yet.** Nothing writes that table before
  pack import (phase 5); `InstalledPack.origin` has only `builtIn` until then.

#### 5. Stored data

Nothing stored changes. The packs are read from the build; no Dexie table is written, no
`schemaVersion` changes. `license.attribution` is an optional field the pack schema already has.

#### 6. What a person will see

Not a screen. The attribution shows with the library (phase 3); the missing-pack message with the
sheet that opens a character.

#### 7. Tests

- `apps/web/test/packs.test.ts` — `SHEET-09 the built-in packs open at start`: §3 items 1–3;
  `SHEET-09 a character's content index`: items 4–6; `SHEET-09 pack openers the app carries`:
  item 7.
- `packages/content/test/built-in.test.ts` — item 8.
- Control numbers from: SHEET-08 §7 (74 and 66 entries); SPEC §6.7 golden A and golden E
  (`packages/system-5e/test/golden/`); SPEC Appendix Д (`hb-local`).

#### 8. Checked against the source

- The attribution texts of SPEC Appendix В, `[ПРОВЕРИТЬ]` against the legal page of each SRD PDF.
  Downloaded on 2026-10-29, once the owner allowed both hosts:
  `https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf` (HTTP 200, 3158713 bytes, 403
  pages) and `https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf` (HTTP 200,
  6031375 bytes, 364 pages). Each statement is on page 1, read with `pdftotext`, its line breaks
  joined. Both name the statement to include ("the following attribution statement"), and ask
  for no other attribution to Wizards.
- The words of both texts are Appendix В's, word for word. The quote marks differ: the PDFs have
  curly quotes (U+201C, U+201D) around "SRD 5.1" and "SRD 5.2.1", Appendix В straight ones. The
  packs carry the PDFs' text exactly; no other character outside ASCII is in either text.
- No rules fact is used.

#### 9. Not in this ticket

- Showing the attribution: the library and its About (phase 3, CONT).
- The sheet's message for a pack not installed: the screen that opens a character (SHEET-30 on).
- Packs imported into the `packs` table, and their origins `local` and `community`: phase 5.
- Building the index once per character and keeping it while the sheet is open: the sheet.

#### 10. Rake check

- **A pack with `redistributable: false` never enters the public build**: only `BUILT_IN_PACKS`
  enters it, and SHEET-08's test refuses one that is not `redistributable: true`.
- **Every pack carries license metadata**: CC-BY-4.0 needs attribution; the packs enter the build
  with it (§3 item 8).
- **Missing is not broken**: a pack not installed and a file that does not open give data, never
  an exception; the app starts without them.
- **Each system's rules live in its own module**: the app names a system only in `systems.ts`.
- **No external requests**: the packs come from the build.

#### 11. What came out of it

Measured on 2026-10-29, on top of SHEET-66 (`dd2cb04`):

- Whole gate (`lint && typecheck && test && e2e`): exit 0, 61.2 s.
- `pnpm lint`: `Checked 264 files`, 0 errors. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: `Test Files 82 passed (82)`, `Tests 1095 passed (1095)`, 7 of them new in
  `apps/web/test/packs.test.ts`; lines covered 99.9 % (3018/3021). The second suite (`Tests 2
  passed (2)`) is unchanged. 19.2 s.
- `pnpm e2e`: `20 passed (15.9s)`.
- The tests are live: with SRD 5.2.1's `attribution` left out, `pnpm test` gives 1 failed.
- Build: JS 620.97 kB (192.58 kB gzip), up from 475.47 kB (151.79 kB) at `dd2cb04`: the two packs
  and the module's schemas that open them are now in the public build, each pack with its
  attribution (`grep` finds the 5.2.1 statement in the built JS).
- Differs from the row: the index is built per character, not once at start (§4).
- The ticket waited on the owner: the container could not reach the SRD PDFs until the owner
  added `media.wizards.com` and `media.dndbeyond.com` to the environment's allowed domains.

Found, not fixed:

- Nothing.

### SHEET-64 Exhaustion the character is immune to does not kill · XS

**Hat:** death by exhaustion reads the immunity
**Where:** `packages/system-5e/src/dead.ts` (new), `unconscious.ts`, the actions that refuse the
dead; `packages/engine/src/compute.ts` (`entities` gets the ids a pass leaves out)
**Depends on:** SHEET-61, ENG-67
**Screen:** No

**Now (measured, `13c1f2d`):** `isDead` asks `fatalExhaustion` (`exhaustion.ts`), which reads the
stored level through the plain finder. A stored exhaustion the character is immune to is withheld by
`compute()` (SHEET-61), but the finder still finds it, so at its highest level the character is dead:
every action refuses `dead`, and `compute()`'s own `entities` hook (`unconsciousNamed`) names no
Unconscious condition at 0 hit points.

**How:** the immunity comes from `compute()`, and `compute()` asks `isDead`, so the answer is a fixed
point, as SHEET-61's withheld ids are.
- The core passes each pass's `without` ids to the module's `entities` hook (game-free: "the ids this
  pass leaves out"). The module reads the dead and the down through a finder that does not find those
  ids, so the first pass (nothing withheld) finds the character dead, the next one (the exhaustion
  withheld) finds it alive, and that pass settles.
- An action reads the dead through `applyingFinderOf(character, index)` (`dead.ts`): one `compute()`,
  and a finder that does not find what it withheld. A withheld entry is "not found" only for this
  question; `fatalExhaustion` already skips an id it does not find.
- To keep the module free of an import loop (`dead.ts` imports the module), `isDead` moves from
  `death-saves.ts` and `isKnockedOut` from `knock-out.ts` into `unconscious.ts`, which the module
  reads. Their names and signatures stay; `index.ts` still exports them.

**What it should look like when done:**
1. Golden B (2024, 12 hit points) with the 2024 exhaustion at 6 and a feat of its own immune to
   `exhaustion`: not dead through `applyingFinderOf`; dead through the plain finder (the stored
   level, unchanged).
2. That character at 0 hit points computes `conditions.unconscious.level` 1 with the Unconscious
   entry in reach, and `conditions.exhaustion.level` 0; at 6 hit points, 5 damage leaves 1 hit point
   (6 - 5), not `dead`.
3. At 0 hit points a death save of 10 is one success, not `dead`; `stabilize` happens; knocked out at
   1 hit point, `firstAid` happens; a short and a long rest are not refused `dead`; `revive` is
   refused `notDead`.
4. Setting that exhaustion to 6 through `setConditionLevel` on the immune character ends no
   attunement: its entry is the core's `setCondition` entry.
5. With the feat's effect switched off (an override of `defenses.conditionImmune.exhaustion` to 0),
   the same character is dead again and every action above refuses `dead`.
6. A Tales module's `entities` hook gets the ids each pass leaves out: an empty set, then the ids.

**Tests:** `packages/system-5e/test/exhaustion.test.ts` (`SHEET-64`) and
`packages/engine/test/compute.test.ts` (`SHEET-64`), control numbers: golden B's 12 hit points
(SPEC §6.7) and the hand subtraction above; the rules are SHEET-61 §8's (immunity: "it doesn't
affect you in any way") and ENG-67 §8's (level 6 is death).
**What came out of it:** Quality gate, 2026-10-29, on `d4bee2f`: `pnpm lint` 234 files, no fixes;
`pnpm typecheck` 6 projects, no errors; `pnpm test` 76 files, 1036 passed, 0 failed, 24.0 s, then the
speed project 1 file, 2 passed. Against 1030 before (+6: 5 module, 1 core). Coverage: statements
99.47 % (3392/3410), lines 99.89 % (2975/2978). Not `apps/web`, so no `pnpm e2e`. With
`applyingFinder` made to return the plain finder, 4 of the 5 module tests fail (the fifth, the
immunity ended, passes either way, as it should).

Differences from §3: a short rest that spends no Hit Die is refused `unchanged`, not done; item 3
asked only that it not be refused `dead`, and the test names it. The core's `entities` gets
`without` as a required fourth argument, so five Tales test modules in `compute.test.ts` and
`phases.test.ts` and one call in `module.test.ts` pass it through.

No import loop: the module's imports (`module.ts` and every file it reaches) include none of
`dead.ts`, `death-saves.ts`, `knock-out.ts`, `conditions.ts`, `rests.ts`, `hit-points.ts`.

Found, not fixed:
- Every action that refuses the dead now runs one more `compute()` (`applyingFinderOf`), two for
  `setConditionLevel` and `revive` (before and after). No speed test times actions; none failed.
- `isDead`, `isStable`, `isDown` and `isKnockedOut` still take any finder: one given the plain
  `finderOf` reads immune exhaustion as death. Every caller in `src` passes `applyingFinderOf` or,
  inside `compute()`, the pass's `without`.

Nothing for the changelog.

---

### SHEET-12 The player page shows its six sections

**Hat:** The player page shows its six sections
**Depends on:** SHEET-11 (the page and its header), SHEET-10 (the characters table)
**Size:** S
**Screen:** Yes — the player page, board `V3-Player`, BRIEF Part 5 row P17
**SPEC:** §7.1 as ADR 008 items 3–4 and ADR 013 item 17 change it; §9 (i18n)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/pages/PlayerPage.tsx` — changes: the six tiles under the header.
- `apps/web/src/db/characters.ts` — changes: `countCharacters`.
- `apps/web/src/locales/en/player.json` — changes: the tiles' keys.
- `apps/web/test/player.test.tsx` — new.
- `apps/web/test/characters.test.ts` — changes: the count's test.
- `apps/web/e2e/navigation.spec.ts` — changes: the player page's test.

#### 2. What is missing now

Measured on 2026-10-29, at `3b027bd`:

- `PlayerPage.tsx` renders `<Page title={t('title')} back={paths.start} gear />` and nothing
  under the header.
- `player.json` holds one key, `title`.
- `characters.ts` has no way to count the stored characters.

#### 3. What it should look like when done

1. Under the header, six tiles in two columns, in the board's order: Characters, Sources,
   Library, Dice roll, Quick rules, Bookmarks. Each has an icon, its title and one second line.
2. Characters is a link to `/characters`. Its second line is the number of stored characters:
   "No characters yet" (0), "1 character" (1), "2 characters" (2). No "of 3": no limit applies
   before the payment phase (ADR 005 item 2).
3. The other five are not links. Each is muted and its second line is "Coming later".
4. The count counts every stored row, also one that does not open (SHEET-10): nothing a person
   made is hidden (ADR 005 item 2).
5. The page has exactly three links: the back arrow, the gear, Characters.
6. Each tile is 44 px tall or more; nothing is wider than 360 px.

#### 4. How to do it

1. `countCharacters(characters = db.characters)` returns `characters.count()`.
2. `PlayerPage` reads the count once in an effect; until it arrives (or if the read fails) the
   Characters line is empty. `PlayerSections({ characters })` draws the grid from a list of
   sections (`key`, icon, link or none), so the unit test renders it with any count.
3. Each tile is `<Part name="card" fill="card">` (through a constant, SHEET-67), 128 px tall, the
   content at the bottom: icon `size-[30px]`, title `text-16 font-bold`, line `text-12
   text-muted`. A coming-later tile adds `text-muted`, as the start page's DM square does.
4. The count line uses i18next plurals: `characters.count_zero`, `_one`, `_other`.

#### 5. Stored data

Nothing stored changes. The page reads the `characters` table; it writes nothing.

#### 6. What a person will see

- Player opens the page titled "Player", with the back arrow and the gear, and six tiles in a
  2 × 3 grid. Characters shows how many characters are saved; the other five are greyed and say
  "Coming later".
- English keys in `player`: `characters.title` "Characters", `characters.count_zero` "No
  characters yet", `characters.count_one` "{{count}} character", `characters.count_other`
  "{{count}} characters", `sources.title` "Sources", `library.title` "Library", `dice.title`
  "Dice roll", `quickRules.title` "Quick rules", `bookmarks.title` "Bookmarks".

#### 7. Tests

- `apps/web/test/player.test.tsx` — the six tiles in order; one link, to `/characters`; the count
  at 0, 1, 2; "Coming later" on the other five; no line while the count is unknown.
- `apps/web/test/characters.test.ts` — `countCharacters` counts 0, then 2 after two saves, and a
  row that does not open.
- `apps/web/e2e/navigation.spec.ts` — the page in Chromium: the six titles, the links, the count
  after a row is put into the table, the tile height, the width; screenshots dark and light.
- Control values from: board `V3-Player` (order, titles), ADR 013 item 17, the row in
  `BACKLOG.md`.

#### 8. Checked against the source

Nothing to check: no rules fact.

#### 9. Not in this ticket

- What each section opens: Sources, Library, Quick rules and Bookmarks (phase 3), Dice roll
  (SHEET-38; the `/dice` route stays, with nothing linking to it from here).
- The last opened character (ADR 008 item 3): nothing stores which one was opened last; SHEET-24
  or SHEET-30 decides whether the list or the sheet keeps it.
- The list of characters: SHEET-24. Settings: SHEET-13.

#### 10. Rake check

- **No look written in a component**: tiles are `<Part>`, every size and colour a token class;
  lint is green.
- **No user-facing string literal**: every line is an i18n key; lint is green.
- **No external requests**: the count reads the device's own database.
- **Nothing locked or hidden**: the count includes rows that do not open, and no limit is shown.

#### 11. What came out of it

Measured on 2026-10-29, on top of SHEET-64 (`3b027bd`):

- `pnpm lint`: `Checked 266 files`, 0 errors. `pnpm typecheck`: exit 0.
- `pnpm test`: `Test Files 83 passed (83)`, `Tests 1107 passed (1107)`, 14.01 s; the second
  suite `Tests 2 passed (2)`. New: 5 tests in `player.test.tsx`, 1 in `characters.test.ts`.
- `pnpm e2e`: `21 passed (14.0s)` (1 new).
- Build: `index-CZbh3nLW.js`, 623.97 kB (193.70 kB gzip); before this ticket 620.97 kB
  (192.58 kB gzip), measured on the same machine.
- Screenshots at 360 × 800, dark and light, with two rows in the table: the six tiles in a 2 × 3
  grid, Characters "2 characters", the other five greyed with "Coming later";
  `scrollWidth` 360.
- Differs from the board: the tiles' corner is the `card` token (14 px), not the board's 16 px
  (the board writes both, 16 last); a page cannot set a part's radius. The icons are the closest
  in the app's icon set: `Users`, `BookOpen`, `Search`, `Dices`, `ScrollText`, `Bookmark`.
- Decided here (ADR 002): the Characters line counts the stored characters (ADR 008 item 3 asks
  for the count), with no limit; the count includes rows that do not open, so nothing made is
  hidden (ADR 005 item 2). The Dice roll tile is not a link to the empty `/dice` page; it opens
  with SHEET-38, as the row says.

Found, not fixed: nothing.

Changelog: "The player page shows six sections: Characters, with how many are saved, opens the
list; Sources, Library, Dice roll, Quick rules and Bookmarks are marked as coming later."

---

### SHEET-67 A part names its fill slot without a lint finding · XS

**Hat:** the look check reads a component's `fill` as a slot name
**Where:** `biome/no-look-literals.grit` (the attribute branch); `apps/web/src/pages/StartPage.tsx`,
`PlayerPage.tsx`
**Depends on:** SHEET-02, SHEET-04, SHEET-11, SHEET-12
**Screen:** No

**Now (measured, `3b027bd`):** the attribute branch fails any `fill="…"` that is not `currentColor`,
`transparent`, `inherit`, `none`, `var(--…)` or `url(#…)`, on any element. `<Part fill="card">`
(SHEET-04's slot name) is one finding, so `StartPage.tsx` and SHEET-12's `PlayerPage.tsx` pass
`fill={cardFill}` through a const.

**How:** `fill` is checked as a colour unless its attribute sits on an element whose name is a
`JsxReferenceIdentifier` (a capitalised component, such as `Part`). The search for that element
stops at a `JsxExpressionAttributeValue`, so a `<path fill="…">` written inside a component's prop
is still checked. `stroke`, `color` and the other paints stay checked on every element. A member
name such as `<motion.path>` is not exempt. The colour-in-any-string branch still fails a hex or a
colour function in a component's `fill`. Both pages write `fill="card"` in place.

**What it should look like when done:**
1. `<Part name="card" fill="card">` and `<Part as="svg" name="chip" fill={'surface'} />` give no
   finding.
2. `<Part fill="#fff" />`, `<Part render={<path fill="tomato" />}>`, `<path fill="black" />` inside a
   `<Part>`, and `<motion.path fill="tomato" />` each give one finding.
3. SHEET-02's samples give the same findings as before: `[3, 3, 3, 4, 5, 6, 7, 8, 8, 9, 9, 9, 10,
   12, 14, 15, 16, 17, 18, 19, 20]` and none.
4. Neither `StartPage.tsx` nor `PlayerPage.tsx` has a `cardFill` const; `pnpm lint` passes on both.

**Tests:** `apps/web/test/no-look-literals.test.ts` (`SHEET-67`), control numbers: the sample
lines, counted in the samples themselves.
**What came out of it:** Quality gate, 2026-10-29, on `376135f` (SHEET-12): `pnpm lint` 266
files, no fixes; `pnpm typecheck` no errors; `pnpm test` 83 files, 1109 passed, 0 failed, 24.0 s,
then the speed project 1 file, 2 passed (the SHEET-67 file: 5 tests, 3 before); `pnpm e2e` 21
passed (18.1 s). With the
grit change undone, the passing SHEET-67 test fails (1 failed, 4 passed in the file), so the test
reads the change. Items 1 to 4 hold as written.

Differs from the row: SHEET-12 landed while this ran and wrote the same const in `PlayerPage.tsx`;
it is removed here too. Nothing found, not fixed.

---

### SHEET-65 Dying ends concentration · XS

**Hat:** death ends the concentration
**Where:** `packages/system-5e/src/actions.ts` (`deathChanges`); `conditions.ts`
(`setConditionLevel`) and `hit-points.ts` (`applyDamage`) stop listing the change themselves when
the character dies
**Depends on:** SHEET-62, SHEET-64, ENG-63
**Screen:** No

**Now (measured, `3b027bd`):** `deathChanges` changes only `systemData.inventory`. Its three
callers: `rollDeathSave` (the third failure), `applyDamage`, `setConditionLevel` (exhaustion at its
highest level). `applyDamage` already ends concentration at 0 hit points, so a death by damage ends
it; the other two keep it. The new tests, run without the source change: 3 of 7 fail (the third
death save in both editions, and exhaustion 6).

**How:** `deathChanges` returns the concentration's change first, then the inventory's. A caller
that also ends concentration for its own reason (`applyDamage` at 0 hit points or a knock-out,
`setConditionLevel` while incapacitated) does so only when the character does not die, so an entry
never lists the same path twice. The rule is one in both editions, as ENG-20 §8 quotes them: SRD
5.1 "You lose concentration on a spell if you are incapacitated or if you die"; SRD 5.2.1 "Your
Concentration ends if you have the Incapacitated condition or you die". So nothing goes in
`rulesets/`.

**What it should look like when done:** golden A (2014) concentrates on Bless, golden B (2024) on
the made-up `ward`; both carry ENG-63's charm and stone attuned.
1. Each golden at 0 hit points with 2 failures, a death save of 5: changes `failure` 2 → 3, then
   `concentration` with `before` the spell and no `after`, then the inventory unattuned.
2. Each golden at 6 hit points, 18 damage (6 to 0, 12 left over, the maximum 12): `hp` 6 → 0,
   `failure` 0 → 3, `concentration` once, the inventory. At 0 hit points with 2 failures, 1 damage:
   `failure` 2 → 3, `concentration` once, the inventory.
3. Each golden at 0 hit points, a death save of 5: only `failure` 0 → 1; the concentration stays.
4. Golden B at the 2024 exhaustion 5, concentrating, set to 6 through `setConditionLevel`: the
   conditions, `concentration`, the inventory, in that order.
5. SHEET-62's item 5 (incapacitated and killed by the same set) still lists `concentration` once.

**Tests:** `packages/system-5e/test/death.test.ts` (`SHEET-65`): items 1–4; item 5 is SHEET-62's
test, unchanged. Control numbers: golden B's 12 hit points (SPEC §6.7) and the hand arithmetic
above; the rule from ENG-20 §8.
**What came out of it:** Quality gate, 2026-10-29, on `3b027bd`: `pnpm lint` 265 files, no fixes;
`pnpm typecheck` 6 projects, no errors; `pnpm test` 82 files, 1108 passed, 0 failed, 19.7 s, then
the speed project 1 file, 2 passed. 1101 before this ticket's 7 tests. Coverage: statements 99.45 %
(3448/3467), lines 99.9 % (3024/3027). Again after SHEET-12 and SHEET-67 landed, on `22211de`:
`pnpm lint` 266 files, no fixes; `pnpm typecheck` 6 projects, no errors; `pnpm test` 83 files, 1116
passed, 0 failed, 20.0 s, then the speed project 1 file, 2 passed; the same coverage. Not `apps/web`, so no `pnpm e2e`. With the source change
stashed, 3 of the 7 fail (items 1 and 4); the damage tests (item 2) pass either way, since damage
already ended concentration at 0, and they now guard against the change being listed twice.

Differences from the row: none. The row's measured case (exhaustion 6) is item 4.

Found, not fixed: nothing.

Nothing for the changelog.

---

### SHEET-24 My characters lists the saved characters

**Hat:** My characters lists the saved characters
**Depends on:** SHEET-10 (`openCharacter`, the `characters` table), SHEET-09 (`contentOf`, the
built-in packs at start), SHEET-11 (the page, its route and namespace)
**Size:** S
**Screen:** Yes — My characters, board `V3-Characters`; BRIEF Part 2 P2 and its Part 5 row
**SPEC:** §7.1 as ADR 008 item 4 changes it; §5.8 (a row opens through its migration frame);
§8.2 (missing is not broken); §9 (i18n)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/pages/CharactersPage.tsx` — changes: the list, its empty, loading and
failed states.
- `apps/web/src/db/characters.ts` — changes: `listCharacters`, every row opened, newest change first.
- `packages/system-5e/src/list-line.ts` — new: the entities a list card names under a fifth-edition
  character's name (its species, its classes with their levels).
- `packages/system-5e/src/index.ts` — exports it.
- `apps/web/src/systems.ts` — changes: each system's list line, by system id, beside its opener.
- `apps/web/src/locales/en/characters.json` — the page's strings.

#### 2. What is missing now

- `/characters` shows only its header: `CharactersPage.tsx` is `<Page title back />` with nothing
  under it ("empty until SHEET-24 fills it").
- `apps/web/src/db/characters.ts` opens one row by id (`openCharacter`); nothing reads every row.
- Nothing names a character's species and classes for a list: `characterLevel` gives the level
  only, and the app may not read a system's `systemData` itself (ADR 004, `systems.ts`).
- No e2e test saves a character in Chromium and opens it (SHEET-10 §11, "Found, not fixed").

#### 3. What it should look like when done

1. `listCharacters()` gives one entry per row of the `characters` table: the row's id, its stored
   name when it holds one, and what opening it gave (`openCharacter`'s answer). Newest
   `updatedAt` first; a row without a readable `updatedAt` goes last; equal times by id. No row
   is written.
2. `listLineOf(character)` gives fifth edition's line: the species' id, then each class's id with
   its level, in the order taken. Golden B (2024): `srd-2024:species/human`, then
   `srd-2024:class/fighter` at 1. Golden C (2014): no species; `srd-2014:class/wizard` at 3, then
   `srd-2014:class/paladin` at 3.
3. The page lists every saved character as a card: a round portrait with the name's first letter,
   the name, the edition badge (`2014` or `2024`, the character's `ruleset`), the line
   ("Human · Fighter 1", each name from the character's own packs, or "Missing: <id>"), and
   "Created <date>". A card is a link to `/characters/<id>`.
4. A "+" in the header (44 × 44 px or more, label "New character") links to `/characters/new`.
   No counter and no limit (ADR 005 item 2).
5. No character: the line "No characters yet. Make one with +, or bring one from a file.", a
   "New character" button to `/characters/new`, and "Import file", shown as coming later until
   SHEET-26.
6. A row that does not open is a card that is not a link: its stored name (or "Unnamed
   character") and why — newer app, unreadable data, or a game system the app does not carry.
   The page never crashes on it, and the other cards still open.
7. While the rows are read the page shows nothing under the header; if the database cannot be
   read it says so in one line.
8. Nothing is wider than 360 px. Dark by default; light the same.
9. e2e: a character saved into the app's own database in Chromium is listed, opens its sheet's
   path, and a newer row beside it shows its reason.

#### 4. How to do it

1. `list-line.ts`: `listLineOf(character)` → `ListLinePart[]` (`{ id, level? }`) from
   `systemData.species` and `systemData.classes`. A lineage stays out: the board names the species.
2. `systems.ts`: `CHARACTER_LIST_LINES` by system id, and `listLineOf(character)` that reads it.
3. `characters.ts`: `listCharacters(characters = db.characters)` reads `toArray()`, runs each row
   through `openFile`, sorts as §3 item 1 says.
4. `CharactersPage`: reads `listCharacters()` once in an effect (a later row's Delete reads it
   again), then draws the states. Names come from `contentOf(character).index.get(id)`; a
   `missing` lookup draws `Missing: <id>`. The card is `<Part name="card" fill="card">`, the
   portrait `<Slot name="portrait">`, the badge `<Part name="chip">`, the "+" `<Part
   name="icon-button">` on `<Slot name="button">`.
5. The date goes through i18next's `datetime` formatter, so it follows the language.

#### 5. Stored data

Nothing stored changes. The list reads rows and writes none.

#### 6. What a person will see

- From Player's "My characters" (SHEET-12) or `/characters`: the header (back arrow, "My
  characters", the round "+"), then one card per character, newest change first, and under them
  "Tap a character to open it."
- Empty: the friendly line, "New character" and "Import file" (greyed, "Coming later").
- A card that does not open: greyed text, no link, the reason in place of the line.
- English keys in `characters`: `title` "My characters", `new` "New character", `empty` "No
  characters yet. Make one with +, or bring one from a file.", `import` "Import file", `hint`
  "Tap a character to open it.", `created` "Created {{date, datetime}}", `classLevel`
  "{{name}} {{level}}", `separator` " · ", `missing` "Missing: {{id}}", `unnamed` "Unnamed
  character", `failed` "Your characters could not be read on this device.",
  `unopened.newer` "Saved by a newer version of the app. Update the app to open it.",
  `unopened.invalid` "Its saved data could not be read.", `unopened.unknownSystem` "Made for a
  game system this app does not have."

#### 7. Tests

- `packages/system-5e/test/list-line.test.ts` — §3 item 2 on goldens A, B, C.
- `apps/web/test/characters.test.ts` — `SHEET-24 listing`: §3 item 1 (order, the stored name,
  refused rows listed with their code, nothing written, an empty table).
- `apps/web/test/characters-page.test.tsx` — the line's text from the built-in packs, and
  `Missing: <id>` for an id no pack holds.
- `apps/web/e2e/characters.spec.ts` — §3 items 3–9 in Chromium at 360 × 800; screenshots.
- Control values from: SPEC §6.7 goldens A, B, C (`packages/system-5e/test/golden/`); the names in
  the built-in packs (`srd-2014`, `srd-2024`, SHEET-08).

#### 8. Checked against the source

Nothing to check: no rules fact.

#### 9. Not in this ticket

- A swipe or "⋯" for Actions, Copy, Export, Delete: SHEET-25. Importing a file: SHEET-26.
- The manual form "+" opens: SHEET-27. The sheet a card opens: SHEET-30.
- The player page's card with the count and the last opened character: SHEET-12.
- The portrait picture (SHEET-56); a card shows the first letter until then.
- The paid limit and its counter: the payment phase (ADR 005 item 2).

#### 10. Rake check

- **Missing is not broken**: a row that does not open, and an id no pack holds, each show a
  reason; nothing throws, and no row is changed or deleted.
- **Each system's rules live in its own module**: the line comes from the module through
  `systems.ts`'s table; the page never reads `systemData`.
- **No look written in a component**: token classes, `<Part>` and `<Slot>` only; lint is green.
- **No user-facing string literal**: every string is a `characters` key; the name, the badge and
  the entity names are data.
- **Entity names stay bilingual**: the line reads `name.en`, the only filled locale.
- **No external requests**: IndexedDB and the built-in packs only.

#### 11. What came out of it

Measured on 2026-10-29, on top of SHEET-65 (`759442e`; built on `3b027bd`, then SHEET-12,
SHEET-67 and SHEET-65 landed and the gate ran again):

- `pnpm lint`: `Checked 270 files`, 0 errors. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: `Test Files 85 passed (85)`, `Tests 1126 passed (1126)`, 28.93 s (1116 on the
  base, 10 new: 3 in `list-line.test.ts`, 4 in `characters.test.ts`, 3 in
  `characters-page.test.tsx`); lines covered 99.9 % (3026 / 3029). The second suite
  `Tests 2 passed (2)`, unchanged.
- `pnpm e2e`: `23 passed (22.1s)` on `pixel-7` (2 new in `characters.spec.ts`).
- The tests are live: with the sort turned oldest first, `characters.test.ts` gave
  `2 failed | 11 passed (13)`.
- Build: `index-*.js` 632,821 bytes (194,153 through `gzip -c`); at `759442e`, 623,971
  (191,566): 8,850 bytes more.
- Screenshots at 360 × 800, dark and light: golden B ("Human · Fighter 1", `2024`, "Created
  Oct 2, 2026"), golden C ("Wizard 3 · Paladin 3", `2014`), and a newer row with its reason;
  the empty state. `scrollWidth` 360 on both.
- Differs from the board: the "+" is a rounded square, not a circle: the base pick for
  `icon-button` is `plain` (SHEET-04), and a page cannot re-pick a part. The edition badge is a
  filled chip, not the board's outline, for the same reason (as SHEET-11's chip). No hit point bar
  on the card (BRIEF P2 asks one; the newer V3 board draws none). The hint says "Tap a character
  to open it." without the swipe: swiping comes with SHEET-25.
- Decided here (ADR 002): the list is ordered by the newest change (`updatedAt`), since no row
  records when it was last opened. `Page` takes an `action` for a page's own header control.
  "Import file" shows in the empty state only, greyed with "Coming later", until SHEET-26.

Found, not fixed:

- Nothing.

Changelog: "My characters lists the characters saved on the device, newest change first, each
with its edition, species and classes; a character that cannot open says why."

---

### SHEET-23 An undo toast reverses the last change

**Hat:** An undo toast reverses the last change
**Depends on:** SHEET-07, SHEET-10, SHEET-11, ENG-30
**Size:** S
**Screen:** Yes — the toast over every page; board `V3-Features` (the "Second Wind used" toast);
BRIEF Part 2 ("After every change, a small 'Undo' message appears at the bottom")
**SPEC:** §7.2 ("Undo": a toast after every change, the last 50 states of the character), §5.8
(`rev`, `updatedAt`, migrations), §11 (the `history` table)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/db/history.ts` — new: `recordChange`, `undoChange`, `readHistory`,
`HISTORY_LIMIT`. The other files it touches:

- `packages/schema/src/log.ts` — changes: `HISTORY_SCHEMA_VERSION`, `historyRowSchema`,
  `historyRowOf`, `openHistoryRow`.
- `apps/web/src/db/db.ts` — changes: `HistoryRow` is a stored object, at whatever version.
- `apps/web/src/shared/undo.ts` — new: the toast store and `changeCharacter`, `undoToast`.
- `apps/web/src/shared/ToastHost.tsx` — changes: fills SHEET-11's empty host.
- `apps/web/src/locales/en/toast.json` — changes: the toast's English text.
- `packages/schema/test/log.test.ts`, `apps/web/test/history.test.ts`,
  `apps/web/test/toast.test.tsx` — the tests; `apps/web/test/navigation.test.tsx` — `ToastHost`
  is no longer an empty piece.

#### 2. What is missing now

Measured on 2026-10-29, at `3b027bd`:

- `grep -rn "history" apps/web/src/db` finds only `db.ts`: the table exists (SHEET-07), keyed by
  `id` with the index `[characterId+at]`; nothing writes or reads it.
- `apps/web/src/shared/ToastHost.tsx` returns `null`; `locales/en/toast.json` is `{}`.
- `applyEntry` and `reverseEntry` (ENG-30) exist, but nothing stores their result; `saveCharacter`
  stores what it is given, so `rev` and `updatedAt` never move (SHEET-10 §9 gave both to this row).

#### 3. What it should look like when done

1. `recordChange(characterId, entry, now)` applies the entry to the character as stored, stores it
   with `rev` one higher and `updatedAt` `now`, and keeps the row `{ schemaVersion: 1, id,
   characterId, at, entry }`; it returns `{ ok: true, character, entry }`.
2. After 51 changes of one character the history holds 50; change 1 is gone; `readHistory` lists
   51 down to 2; the character's `rev` is 51.
3. One character's 51st change drops none of another character's changes: 50 + 1 = 51 rows.
4. A change made over a newer one (the store holds 11, the entry says 12) is refused as `changed`
   with `expected: 12`, `found: 11`; nothing is written.
5. A change to no stored character is `notFound`; an entry the schema refuses is `badEntry`; a
   result the character's schema refuses (1.5 hit points) is `invalid`; nothing is written.
6. `undoChange(entryId, now)` reverses the kept change, stores the character one revision on,
   and drops the change from the history; a second undo of it is `noEntry`.
7. Undoing a change a later change wrote over is `changed` (`expected: 11`, `found: 10`); nothing
   is written.
8. A history row at version 2 is listed in `refused` (`newer`), stays as it was, and its undo is
   `badEntry`.
9. `historyRowSchema` refuses a key that is not the entry's (`id`, `at`), an unknown field, a
   broken entry, a character id that is not a uuid, and a missing version.
10. After a written change the toast shows the action's text with the entry's name and "Undo":
    `useResource` on "Second Wind" reads "Second Wind used", as board `V3-Features` draws it. A
    refused change shows no toast; a newer change replaces the toast.
11. "Undo" reverses the toast's own change and the toast goes; a refused undo shows "Not undone:
    it changed since", with no button.
12. Every action key of the core and the fifth-edition module has its own text; any other action
    reads "Change made".

#### 4. How to do it

1. `packages/schema/src/log.ts`: the history's row wraps the entry unchanged, as SHEET-37's roll
   log row wraps a roll, with its own `schemaVersion` and an empty migration chain. The entry's
   `by` is who made the change, not the character changed, so the row carries `characterId`
   itself. `at` is the entry's time as `toISOString` writes it (SHEET-37 §4 item 2).
2. **The entry applies to the stored character.** Technical choice (ADR 002): `recordChange`
   takes the character's id and the entry, not the screen's changed copy. In one `rw` transaction
   over `characters` and `history` it opens the stored character, applies the entry, saves the
   result and keeps the row, then drops that character's oldest rows past 50. Because
   `applyEntry` checks every `before` value, a change made from a stale copy is refused instead
   of writing over a newer one.
3. **Undoing drops the change from the history.** Technical choice: the history holds the
   changes in effect, so an undone change leaves it; the undo is not a new entry. `undoChange`
   finds the row by the entry's id, so the toast undoes its own change, not whatever is newest.
4. **Every write moves `rev` and `updatedAt`.** `rev` counts one on and `updatedAt` is `now` for a
   change and for its undo alike; neither is in the entry, so undo never moves them back.
5. `apps/web/src/shared/undo.ts`: `changeCharacter` is the one call a screen makes for a change;
   it records it and, when it is written, shows the toast. The store is module state read with
   `useSyncExternalStore`. `undoToast` undoes the toast's entry.
6. `ToastHost`: a `role="status"` region at the page's bottom edge, 16 px in on each side. The
   toast is the `toast` part (SHEET-04) on `bg-strong` with `text-on-strong`, 48 px high, the
   "Undo" button 44 px high (BRIEF: touch targets of at least 44 px; the board draws 40). It goes
   after `TOAST_MS` = 5000 ms, a technical choice; while the person's focus is in it, it stays.
   The text is `toast:done.<action>` with `{{name}}`: the label in the app's language, in English,
   or the entry's subject.

#### 5. Stored data

The `history` table (SHEET-07) gets its first rows, shape version 1 (`HISTORY_SCHEMA_VERSION`),
with an empty migration chain. No Dexie version bump: the table, its key and its index stay as
SHEET-07 made them. `CharacterDoc` and `LogEntry` do not change; a change now writes the
character's `rev` and `updatedAt`, fields it already has.

#### 6. What a person will see

The toast over the bottom of any page, after a change a screen makes. No screen makes one yet:
the first are SHEET-40 onward. English keys (`toast`):

- `undo`: "Undo"
- `notUndone`: "Not undone: it changed since"
- `done.<action>`, 22 of them, for example `useResource`: "{{name}} used", `applyDamage`:
  "Damage taken", `longRest`: "Long rest taken"; `done.other`: "Change made".

#### 7. Tests

- `packages/schema/test/log.test.ts` — `SHEET-23 the history row`: §3 item 9, and the row of an
  entry at `18:30:00Z` keyed `18:30:00.000Z`.
- `apps/web/test/history.test.ts` — `SHEET-23 the history`: §3 items 1–8, each on a fresh
  database.
- `apps/web/test/toast.test.tsx` — `SHEET-23 the undo toast`: §3 items 10–12.
- Control numbers from: SPEC §7.2 (50); SPEC §6.7 golden A (12 hit points, `rev` 0) and golden C
  (30 hit points); board `V3-Features` ("Second Wind used", "Undo"); the action keys read from
  `packages/engine/src/trackers.ts` and `packages/system-5e/src/*.ts`.

#### 8. Checked against the source

Nothing to check: no rules facts.

#### 9. Not in this ticket

- The screens that make changes: each calls `changeCharacter` (SHEET-40 onward).
- The change history in "⋯", and undoing an older change: SHEET-59 (`readHistory`,
  `undoChange`).
- The toast above the sheet's dock: SHEET-30 (its note).
- Delete with Undo, and dropping a deleted character's changes: SHEET-25.
- A game master's pending change (ADR 014 item 10): the table link's phase.

#### 10. Rake check

- **A stored-shape change needs a migration**: the row carries `schemaVersion` from its first
  write and opens through the migration frame; a newer row is tested to be refused and kept.
- **Missing is not broken**: a missing character, a missing change, a row that does not open and
  a place that changed each give a code, never an exception; nothing is half written.
- **No user-facing string literal**: every text is a `toast` key; the label comes from the entry.
- **No look is written in a component**: the toast is the `toast` part with colour tokens.
- **Each system's rules live in its own module**: the store applies entries and names no system;
  the action keys are only the locale's.
- **No telemetry, no external requests**: IndexedDB only.

#### 11. What came out of it

Measured on 2026-10-29, on the base it landed on, SHEET-24 (`4a89c54`):

- `pnpm lint`: `Checked 274 files`, 0 errors. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: `Test Files 87 passed (87)`, `Tests 1144 passed (1144)` (1126 on the base, 18 new:
  3 in the schema, 8 for the history, 7 for the toast), 20.9 s. The second suite: `Tests 2 passed
  (2)`, unchanged.
- `pnpm e2e`: `23 passed (22.4s)` on `pixel-7`; this ticket adds no e2e test.
- The tests are live: with the trimming removed, 2 of the 8 history tests failed.
- Screenshots at 360×800, dark and light, in the chat: a change written in the dev server
  ("Second Wind used") shows the toast; "Undo" set the resource back to `{}`, `rev` to 2, and the
  toast went.
- Differs from §3: none. Differs from the row: the toast's undo drops the change from the
  history instead of adding one (§4 item 3).

Found, not fixed:

- The toast sits 16 px over the page's bottom edge; on the sheet it must sit above the dock.
  Written into SHEET-30's note.

Nothing for the changelog: no screen makes a change yet.

---

### SHEET-13 Settings keep the person's display choices

**Hat:** keep the person's display choices
**Depends on:** SHEET-04 (parts), SHEET-05 (`setMotionStill`), SHEET-07 (the `settings` table),
SHEET-11 (the Settings route)
**Size:** S
**Screen:** Yes — Settings; BRIEF P10 frame 1, not drawn yet, so it is built from SHEET-04's parts
**SPEC:** §7.5 (units, "I roll myself", theme), §6.5 ("I roll myself"), §7.2 (dark by default)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/settings/settings.ts` — new: each choice's values, the defaults, the
read and the save of the `settings` table, and `applySettings`.
- `apps/web/src/settings/useSettings.ts` — new: the choices in memory, `startSettings`,
  `changeSetting`, `useSettings`.
- `apps/web/src/pages/SettingsPage.tsx` — the page (was empty).
- `apps/web/src/main.tsx` — the first render waits for `startSettings`.
- `apps/web/src/db/db.ts` — `SettingRow` gets its `value`.
- `apps/web/src/locales/en/settings.json` — the page's strings.
- `apps/web/e2e/theme.spec.ts` — two tests wait for the page to be drawn (see §11).

#### 2. What is missing now

- `SettingsPage.tsx` draws only the header: `<Page title={t('title')} back="history" />`.
- `index.html` puts `class="dark"` on `<html>`; nothing removes it, so the light theme cannot be
  reached from the screen (SHEET-01 §11).
- `setMotionStill` (SHEET-05) has no caller in `src`.
- The `settings` table exists (SHEET-07) and nothing writes to it. `SettingRow` holds only `key`.

#### 3. What it should look like when done

1. The choices and their values, the first being the default: `theme` dark / light,
   `stillMotion` false / true, `distance` ft / m, `weight` lb / kg, `rollMyself` false / true.
2. An empty table reads as the defaults. Each saved choice is one row `{ key, value }`, and a second
   save replaces it.
3. A row whose value is not on its list reads as the default, and its message names the key, the
   value and the list: `Setting theme holds "sepia", not one of ["dark","light"]; it reads as
   "dark"`. A row with an unknown key is left in the table and ignored.
4. Light removes `dark` from `<html>`, and the body paints `#F5F5F3`. "Stop animations" sets
   `data-motion="still"` on `<html>`.
5. After a reload, every choice holds, and the app's first frame already wears the theme and the
   motion switch.
6. Settings shows three groups, Units (Distance, Weight), Dice (I roll myself) and Theme (Colours,
   Stop animations). Each control is at least 44 px high; the page is 360 px wide with no
   horizontal scroll.

#### 4. How to do it

1. `settingValues` lists each choice's values; `Settings` and `DEFAULT_SETTINGS` are derived from
   it, so a new choice is one line.
2. `readSettings(table)` reads every row and checks its value against its list (no Zod in
   `apps/web`; a list check is enough). `saveSetting` puts `{ key, value }`.
3. `applySettings` toggles the `dark` class and calls `setMotionStill`.
4. A small store (`useSyncExternalStore`) holds the choices. `changeSetting` shows the change at
   once and then saves it; a failed save is logged.
5. Technical choice (ADR 002): `main.tsx` renders after `startSettings()`, which waits at most
   `START_WAIT_MS` (500 ms) and never fails. Without the wait, a person who chose Light sees one
   dark frame on every start. The cap means a hung IndexedDB (for example an upgrade blocked by
   another tab) cannot keep the app from starting. A read that lands after the cap is still
   applied, but it never undoes a choice the person made meanwhile.
6. The page draws a choice as native radio buttons inside `chip` parts, and a switch as a native
   checkbox with `role="switch"` and a `chip` part for its track. Colours come from tokens:
   `strong` / `on-strong` when on, `soft`, `track` and `muted` when off.

#### 5. Stored data

The first rows of the `settings` table: `{ key: <choice name>, value: <one of its values> }`.
There is no database version and no `schemaVersion`: SHEET-07 keyed the table by name so that a
choice adds a row. Each value is checked as it is read, so a value the app no longer takes reads as
the default and is named, not thrown. A choice whose meaning changes later takes a new key, or a
migration with its own test. `CharacterDoc`, `ContentPack` and the stored units (feet and pounds)
do not change.

#### 6. What a person will see

Settings opens from the gear (SHEET-11). At 360×800:
- Units: Distance — Feet / Metres; Weight — Pounds / Kilograms.
- Dice: "I roll myself", hint "Type what your own dice show; the app adds the rest."
- Theme: Colours — Dark / Light; "Stop animations", hint "Nothing on screen moves, as when the
  phone asks for reduced motion."
- The picked value is filled with `strong`; a switch that is on is `strong` with its knob at the
  right.
- There is no empty, loading or error state. Before the read, and if it fails, the defaults show.

English keys (`settings` namespace): `units.title|distance|weight|ft|m|lb|kg`,
`dice.title|rollMyself|rollMyselfHint`, `theme.title|mode|dark|light|stillMotion|stillMotionHint`.

#### 7. Tests

- `apps/web/test/settings.test.tsx` — `SHEET-13 the display choices`: the values and defaults; an
  empty table; one row per choice and a replacing save; a value off its list; an unknown key; the
  `<html>` class and motion attribute; the page's strings, its three radios checked by default, two
  switches off.
- `apps/web/e2e/settings.spec.ts` — `SHEET-13`: defaults; 44 px controls; 360 px width; each choice
  changing the page; the five stored rows; after a reload the choices hold and the first frame
  wears them; a stored `sepia` theme opens dark with its warning.
- Control numbers from: SPEC §7.2 (dark by default), §7.5 (stored units are feet and pounds), the
  base theme's `color-bg` (`colors.ts`).

#### 8. Checked against the source

Nothing to check: no rules facts. "I roll myself" is only kept here; what it does is SHEET-38's
and SHEET-39's.

#### 9. Not in this ticket

- Showing a distance or a weight in the chosen unit, and the conversion: the first screen that
  shows one (the sheet's rows). The setting is read with `useSettings()`.
- The roll dialog and the dice panel taking typed results: SHEET-38, SHEET-39.
- Squares as a distance unit (SPEC §7.5): SHEET-68.
- Language, dice notation, backup, packs, AI, purchases, About, modes and the theme editor (BRIEF
  P10): their phases.

#### 10. Rake check

- **No look written in a component**: every colour, corner and size comes from a token class or a
  part; no transition is written (the switch's knob jumps, as SHEET-05 allows only presets).
- **No user-facing string literal**: every string is a `settings` key; SHEET-02's lint and the
  literal check pass.
- **Stored units are feet and pounds**: the choice is a display setting only; nothing stored is
  converted.
- **A stored-shape change needs a migration**: see §5; the table's rows are new, and each value is
  checked as it is read.
- **Missing is not broken**: a bad or unknown row never throws, and a failed read leaves the
  defaults.
- **No telemetry, no external requests**: the choices stay in IndexedDB on the device.

#### 11. What came out of it

Measured on 2026-10-29, on `683cc8c` (SHEET-23, the base it landed on):

- Whole gate (`lint && typecheck && test && e2e`): exit 0, 58 s.
- `pnpm lint`: `Checked 278 files`, no fixes. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: 88 files, 1151 passed, 0 failed, 18.6 s, then the speed project 2 passed. That is
  87 files and 1144 tests before, plus 1 file and 7 tests.
- `pnpm e2e`: 25 passed, 0 failed, 17.1 s (23 before, plus 2). The whole suite with
  `--repeat-each=5`, on `4a89c54`: 125 passed, 0 failed.
- The app's first frame after a reload, with the choices on it: 144 ms after navigation (107 ms,
  132 ms, 141 ms and 142 ms in earlier runs). So the read finishes far inside the 500 ms cap.
- SHEET-67 landed while this row ran, so `<Part fill="card">` is written in place.

Differences from §3: none.

Changed outside the hat, because this ticket broke it: the first gate run had 1 failure in 22,
`SHEET-04 every part takes its base style` (expected shadow `rgba(0, 0, 0, 0.12)`, got the dark
`0.4`). That test removed `dark` right after `goto`, and the stored-settings read, landing after
it, put `dark` back. `SHEET-01` and `SHEET-04` in `theme.spec.ts` now wait for the page heading
before touching the class. After that: `theme`, `settings` and `navigation` specs with
`--repeat-each=10`, 120 passed, 0 failed.

Found, not fixed:
- SPEC §7.5 also lists squares as a distance unit. The row and BRIEF P10 named feet or metres:
  SHEET-68.
- The metre value of 5 feet (1.5 m, the usual table value, or 1.524 m) is not written anywhere yet.
  It is decided by the first screen that shows a distance.

Changelog: "Settings chooses dark or light colours, stops animations, picks feet or metres and
pounds or kilograms, and turns on "I roll myself"; each choice is kept on the device and already
holds when the app opens."

---

### SHEET-31 An entry's description opens in place

**Hat:** An entry's description opens in place
**Depends on:** SHEET-05 (the `turn` preset), SHEET-09 (the installed packs), SHEET-11 (the
empty `Description` and its `description` namespace)
**Size:** S
**Screen:** Yes — a piece every tab's entry uses; the chevron of boards `V3-Create` and
`V3-Conflict`, the summary and "See full description" of board `V3-Cast`; BRIEF P4 (ADR 011,
ADR 013 item 7)
**SPEC:** §7.2 (the sheet's entries), §8.2 (missing is not broken), §3 (only openly licensed text);
ADR 011, ADR 013 item 7

---

#### 1. Where the code lives

**Main file:** `apps/web/src/shared/Description.tsx` — changes: fills SHEET-11's empty piece with
`Description` (an entry's row that opens in place) and `DescriptionBody` (the summary and "See
full description", which the cast panel shows without the row).
- `apps/web/src/content/descriptions.ts` — new: `textIn`, `descriptionOf`, the description of an
  entry read from the entity and the installed packs.
- `apps/web/src/shared/Chevron.tsx` — new: the turning chevron in a circle (ADR 013 item 7), its
  own file, so the creation steps (SHEET-27, phase 4) use the same control.
- `apps/web/src/locales/en/description.json` — the piece's English text.
- `apps/web/test/description.test.tsx` — new; `apps/web/test/navigation.test.tsx` — the piece is
  no longer empty.

#### 2. What is missing now

Measured on 2026-10-29, at `ed11c6f`:

- `apps/web/src/shared/Description.tsx` returns `null`; `locales/en/description.json` is `{}`.
- `grep -rn "Chevron" apps/web/src` finds only `ChevronLeft` in `Page.tsx`: no turning chevron.
- The `turn` preset (SHEET-05) exists; nothing wears it (`grep -rn "preset=\"turn\"" apps/web/src`
  finds nothing).
- The built-in packs' entities carry no `summary` and no `text`: `grep -c "summary\|text:"` on
  `packages/content/src/packs/srd-2014.ts` and `srd-2024.ts` gives 0 and 0.

#### 3. What it should look like when done

1. A closed entry shows its name and the chevron pointing down (`transform: none`); its button
   says `aria-expanded="false"`, and nothing of the description is drawn.
2. An open entry's chevron points up (`rotate(180deg)`), turning with the `turn` preset; its
   button says `aria-expanded="true"` and names the region it opened with `aria-controls`.
3. Open, it shows the entry's summary, when it has one, and a "See full description" button,
   itself closed (`aria-expanded="false"`), with its own turning chevron.
4. "See full description" open shows the entry's `text` as written, line breaks kept, and under
   it the source line: "Source: <book> · version <version> · <license>", with ", page <page>"
   after the book when the entity names a page; under that the pack's attribution, when it has
   one.
5. An entry with no `text` shows, instead of a text, "Its source has no full text for this entry.",
   with the source line under it. Every entry of the built-in packs is one today: SRD 5.1's
   Dwarf reads "Source: SRD 5.1 · version 0.1.0 · CC-BY-4.0" and the SRD's attribution.
6. A character's own entry (pack id `character`) reads "Source: your own entry", with no license
   and no attribution.
7. An entry whose source pack is not on the device reads "Source: <pack>, not on this device", and
   nothing breaks.
8. Text is read in the app's language, then English, then any language the entry has.
9. `DescriptionBody` alone draws 3–7, without the row, for the cast panel.
10. Each button is at least 44 px high; the lint finds no look and no visible literal.

#### 4. How to do it

1. `descriptionOf(entity, packs, language)` is pure: the name, the summary and the text in the
   language (`textIn`), and the source as one of three kinds: `pack` (book, version, license,
   attribution, page), `own`, `notInstalled`. The book is the entity's `source.book`, else the
   pack's title; the license is the pack's `spdx`, else its `name`. An entity whose id is of
   `character` is `own`, whatever its `source.pack` says: the person wrote or changed it.
2. Technical choice (ADR 002): each piece keeps whether it is open in its own state, starting
   closed, with `defaultOpen` and `defaultFull` to start it open, as a native `<details open>`
   does. Nothing is stored; a reopened sheet starts closed.
3. The row is one button holding the name, an optional line under it (the tab's), and the chevron,
   so tapping anywhere on it opens it (ADR 011 item 2). A tab's own buttons (Use, Cast) sit outside
   it.
4. Technical choice: "See full description" opens in place with the same turning chevron, not a
   window, because ADR 013 item 7 gives every open-and-close control that chevron; board
   `V3-Cast` draws the text opening in place under it.
5. `Chevron` is lucide's `CircleChevronDown` (an outline in `currentColor`, the board's
   `circlechev`) inside `<Motion preset="turn" as="span">`, with `transform: rotate(180deg)` when
   open.
6. The text keeps its line breaks (`whitespace-pre-line`); it is plain text until phase 3 decides
   how the SRD texts are marked up.

#### 5. Stored data

Nothing stored changes. Whether an entry is open is the piece's state on screen only.

#### 6. What a person will see

No tab shows an entry yet: each tab's row (SHEET-32 onward) draws its entries with `Description`,
and the cast panel (SHEET-47) with `DescriptionBody`. At 360×800 the piece is a card row: the name
in 15 px bold, an optional line in 12 px muted, the chevron at the right in a 44 px square. Open,
the summary, then a 44 px "See full description" row on `bg-soft`; open, the text, then the source
line and the attribution in 12 px muted. There is no loading or error state: the entity is already
loaded, and a missing source is a line, not an error.

English keys (`description`):
- `seeFull`: "See full description"
- `noText`: "Its source has no full text for this entry."
- `source`: "Source: {{book}}", `sourcePage`: "Source: {{book}}, page {{page}}"
- `version`: "version {{version}}", `separator`: " · "
- `own`: "Source: your own entry"
- `notInstalled`: "Source: {{pack}}, not on this device"

#### 7. Tests

- `apps/web/test/description.test.tsx` — `SHEET-31 an entry's description`: §3 items 1–9, drawn
  with `renderToStaticMarkup` at each starting state; `descriptionOf` on golden A's Dwarf from the
  built-in SRD 5.1 pack, on a test pack with a summary, a text and a page, on a character's own
  entry, on a missing pack, and in each language order.
- `apps/web/test/navigation.test.tsx` — `Description` leaves the list of empty pieces.
- `apps/web/e2e` — no new test: no page draws the piece yet. The whole suite runs as the gate.
- Control values from: the built-in packs' `title`, `version` and `license`
  (`packages/content/src/packs/srd-2014.ts`, `srd-2024.ts`); board `V3-Create`'s chevron
  (`turn_arrow()` in `docs/design/mockups/generator/gen13.py`: `rotate(180deg)` when open).
  The test pack's texts are invented for the test, never rules text.

#### 8. Checked against the source

Nothing to check: no rules facts. No rules text is written: the built-in packs have none, and the
test's texts are invented.

#### 9. Not in this ticket

- The tabs' entries that use the piece: SHEET-32 (stats, skills), SHEET-44 (attacks), SHEET-46
  and SHEET-47 (spells, the cast panel), SHEET-48 (features), SHEET-50 (items).
- The SRD's texts in the built-in packs: phase 3's import (ADR 011, by phase).
- Terms inside a text as links, and tappable dice: phase 3 (ADR 013 items 6 and 18).
- A free-text entry's form: SHEET-52.
- The creation steps' chevron: SHEET-27 and phase 4 use `Chevron`.

#### 10. Rake check

- **No look is written in a component**: colours, sizes and corners are token classes and parts;
  the chevron's turn is the `turn` preset, only its end angle is written.
- **No user-facing string literal**: every text is a `description` key or the entity's own data.
- **Only openly licensed text**: the piece shows only the entity's own `text`; with none, it says
  so. Nothing is fetched.
- **Missing is not broken**: a source pack not on the device is a line, not an exception.
- **Entity names stay bilingual**: `textIn` reads both languages; nothing is dropped.
- **Everything is data**: the piece names no game, no stat and no entity type.

#### 11. What came out of it

Measured on 2026-10-29, on `ed11c6f` (SHEET-13, the base it landed on):

- Whole gate (`lint && typecheck && test && e2e`): exit 0, 74 s.
- `pnpm lint`: `Checked 281 files`, no fixes. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: 89 files, 1161 passed, 0 failed, 22.2 s, then the speed project 2 passed. That is
  88 files and 1151 tests before, plus 1 file and 10 tests.
- `pnpm e2e`: 25 passed, 0 failed, 21.7 s; this ticket adds no e2e test.
- The tests are live: with the own-entry rule removed and the chevron left unturned, 2 of the 10
  failed.
- Screenshots at 360×800, dark and light, in the chat, from a page drawn in the dev server and
  then deleted: SRD 5.1's Dwarf closed, and open with "Its source has no full text for this
  entry.", "Source: SRD 5.1 · version 0.1.0 · CC-BY-4.0" and the attribution; an own entry open
  with its two lines of text. Measured there: every button 44 px or taller (the rows 62.5 px, the
  "See full description" rows 44 px); the chevron's transition `transform 0.2s`; a tap on the
  closed row set `aria-expanded="true"`; `scrollWidth` 360; no console error.
- Differs from §3: none. Differs from the row: none.

Found, not fixed:
- The built-in packs have no summary and no text, so every built-in entry says its source has
  none until phase 3's import fills them (ADR 011, by phase).

Nothing for the changelog: no page draws the piece yet.

---

### SHEET-38 The dice panel rolls any formula fairly

**Hat:** The dice panel rolls any formula fairly
**Depends on:** ENG-08 (`rollFormula`, `fairDie`, `randomSourceOf`), ENG-26 (`recordRoll`, the
roll record), SHEET-37 (`logRoll`, `readRollLog`), SHEET-13 ("I roll myself"), SHEET-11 (the
`/dice` route, the empty `DicePanel`, the `dice` namespace), SHEET-12 (the Dice roll tile)
**Size:** M
**Screen:** Yes — the dice page and the half-screen dice panel; boards `V3-Dice` and
`V3-SheetDice`; BRIEF Part 2 P9 and its Part 5 row
**SPEC:** §6.5 (`d` and `к`, "I roll myself", the roll log); ADR 009 item 1; ADR 010 items 4
and 5; §8.2 (missing is not broken); §9 (i18n)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/shared/DicePanel.tsx` — changes: fills SHEET-11's empty panel; adds
`DiceSheet`, the half-screen frame, and `EditDiceButton`.
- `apps/web/src/shared/dice.ts` — new: the panel's pure parts: the standard dice, the formula the
  picker builds, the fair die, the typed die of "I roll myself", the roll's record.
- `apps/web/src/db/customDice.ts` — new: the person's own dice, one row of `settings`.
- `apps/web/src/pages/DicePage.tsx` — changes: the dice page holds the panel.
- `apps/web/src/pages/PlayerPage.tsx` — changes: the Dice roll tile links to `/dice`.
- `apps/web/src/locales/en/dice.json` — the panel's strings.
- Tests: `apps/web/test/dice.test.ts`, `apps/web/test/dice-panel.test.tsx`,
  `apps/web/e2e/dice.spec.ts`; `apps/web/test/player.test.tsx` and
  `apps/web/test/navigation.test.tsx` change.

#### 2. What is missing now

Measured on 2026-10-29, at `ed11c6f`:

- `apps/web/src/shared/DicePanel.tsx` returns `null`; `DicePage.tsx` is `<Page title back />`
  with nothing under it; `locales/en/dice.json` holds only `title`.
- The Dice roll tile on the player page is not a link and reads "Coming later" (`PlayerPage.tsx`,
  `{ key: 'dice', icon: Dices }` with no `to`).
- `grep -rn "rollFormula\|fairDie\|logRoll" apps/web/src` finds only `logRoll` in
  `db/rollLog.ts`: nothing in the app rolls a die, and nothing writes the roll log.
- The `rollMyself` setting is stored (SHEET-13) and read by nothing.

#### 3. What it should look like when done

1. `/dice` shows the dice page: header "Dice" with "Edit dice"; under it the panel. The player
   page's Dice roll tile links to `/dice`, with no "Coming later" and no count.
2. The panel, top to bottom: "Last roll" (the dice faces, the total large; "No rolls yet" before
   any); the standard dice d4, d6, d8, d10, d12, d20, d100 as chips, one picked; "Custom:" and the
   person's own dice; "How many" with − and + and a number field; "Modifier" with − and +; the
   formula field; "Roll <formula>"; then "History", the earlier rolls of the log.
3. Picking d6, setting "How many" to 37 and the modifier to 3 writes `37d6 + 3` in the field and
   on the button. "How many" stays from 1 to 999 (`DICE_LIMITS.count`).
4. The formula field takes any roll formula: `2к6+1` rolls as `2d6+1` (SPEC §6.5), `2d20kh1 + 1d4`
   rolls both terms. A formula that does not parse shows why, in words, under the field, and the
   Roll button is off. Picking a die or changing a stepper writes the built formula again.
5. Each roll uses `fairDie(randomSourceOf((a) => crypto.getRandomValues(a)))`; over 70,000 rolls
   of a d7 that die passes the engine's chi-square test at p = 10^-9 (threshold 53.34).
6. A roll is a record `recordRoll` builds (one breakdown entry, the formula), logged with
   `logRoll`: on the dice page with no `actorId`; on a sheet with the character's id. The last
   roll shows each term's faces, a die a `kh`/`kl` term drops struck through, and the total; its
   total is the sum of the kept faces plus the modifier.
7. A path in a typed formula that the panel cannot read (`1d4 + @level` on the dice page) counts
   as 0, and the last roll says so; nothing throws (SPEC §8.2).
8. "Edit dice" turns on the edit mode: a faces field (2 to 1000, `DICE_LIMITS.faces`) with "Add
   die", and a remove button on each custom die. A custom d7 is kept on the device and is there
   after a reload; a standard die or one already there is not added twice.
9. With "I roll myself" on, the panel shows one number field per die of the formula, labelled
   with its die, and the button reads "Count <formula>". It is off until every field holds a face
   from 1 to that die's faces. `1d20 + 2` with 14 typed gives 16, logged as a roll.
10. "History" lists the log's earlier rolls, newest first: formula and total. A roll just made
    moves the last one into it.
11. `DiceSheet` is the half-screen frame of ADR 009 item 1: a dialog over a scrim, at most half the
    screen high (`max-h-[50dvh]`), the title "Dice" with "Edit dice", the panel scrolling inside;
    the scrim, the close button and Escape close it.
12. Nothing is wider than 360 px. Dark by default; light the same.

#### 4. How to do it

1. `dice.ts`: `STANDARD_DICE = [4, 6, 8, 10, 12, 20, 100]`; `builtFormula(count, faces, modifier)`
   (`37d6 + 3`, `1d20 - 1`, `2d8`); `panelDie()` over `crypto.getRandomValues`; `typedDie(faces)`,
   a die that hands out the typed faces in order; `diceFields(parsed)`, one field per die of
   `diceOf`, in written order; `rollWith({ formula, read, die, roller, now, id })` → the record
   and its warnings, from `recordRoll`.
2. Typed faces go out in the order the formula is written. A term in a `?:` branch the roll does
   not take is still asked for; the dice the roll reaches take the first faces typed. The panel's
   own controls never build a `?:`. Technical choice: the engine's `DieSource` names only the
   faces, not the term.
3. `customDice.ts`: the row `{ key: 'customDice', value: number[] }` in `settings`, read by
   `readCustomDice()` (whole numbers 2 to 1000, no standard die, no repeat, sorted; anything else
   is dropped and named, not thrown) and written by `saveCustomDice(list)`. `readSettings` leaves
   a key it does not know as it is, so the row sits beside the display choices.
4. `DicePanel({ roller, read, editing })`: reads the custom dice and the log on open; keeps
   `faces`, `count`, `modifier` and `typed` (the field's text when the person typed one); the
   field shows `typed ?? builtFormula(...)`. The faces boxes are `<Slot name="dice">`, the chips
   `<Part name="chip">`, the buttons `<Part name="button">`/`button-secondary`.
5. The roller: a sheet passes `{ actorId, name }`; the dice page passes none, and the record's
   `by.name` is the `dice:roller` text ("Player"). Technical choice: `by.name` must hold visible
   text (ENG-26).
6. Words for a parse error and a warning come from the error's `code` (`errors.<code>`,
   `warnings.<code>`), never from the engine's `message`, which is for logs.
7. `DiceSheet({ open, onClose, roller, read })`: `role="dialog"`, `aria-modal`, the `sheet` part
   on the `surface` colour, the scrim `bg-scrim`. The sheet's dice button that opens it is
   SHEET-30's.
8. `DicePage`: `<Page title back={paths.player} action={<EditDiceButton />}>` and the panel.

#### 5. Stored data

- `rollLog`: rows written by `logRoll` (SHEET-37), shape version 1, unchanged.
- `settings`: a new row keyed `customDice`, a list of whole numbers. No `schemaVersion` and no
  migration: a settings row is checked as it is read and a bad value reads as the default, as
  SHEET-13 does for every choice; nothing was stored under this key before. No Dexie version bump.
- `CharacterDoc`, `ContentPack` and `RollRecord` do not change.

#### 6. What a person will see

- From the player page's Dice roll tile, or `/dice`: header (back to the player page, "Dice",
  "Edit dice"), then the panel of §3 item 2. From a sheet (once SHEET-30 adds the button): the same
  panel in the half-screen frame.
- Empty log: "No rolls yet" in the Last roll card, no History.
- A formula that does not parse: the reason under the field; the button off.
- "I roll myself": the dice fields above the button, which reads "Count …".
- English keys in `dice`: `title` "Dice", `edit` "Edit dice", `editDone` "Done", `lastRoll` "Last
  roll", `noRolls` "No rolls yet", `custom` "Custom:", `noCustom` "None yet", `newFaces` "Faces",
  `addDie` "Add die", `removeDie` "Remove {{die}}", `howMany` "How many", `modifier` "Modifier",
  `less` "One less", `more` "One more", `formula` "Formula", `roll` "Roll {{formula}}", `count`
  "Count {{formula}}", `typed` "What your dice show", `typedDie` "{{die}}, die {{n}}", `history`
  "History", `total` "Total", `dropped` "dropped", `roller` "Player", `close` "Close", and
  `errors.<code>` and `warnings.<code>` for each code.

#### 7. Tests

- `apps/web/test/dice.test.ts` — `SHEET-38`: `builtFormula`; the typed die; `diceFields`; a roll's
  record and its total (`37d6 + 3` with a scripted die); a missing path warns and counts 0; the
  chi-square of `panelDie()`; `readCustomDice`/`saveCustomDice` (kept, sorted, a bad row dropped
  and named).
- `apps/web/test/dice-panel.test.tsx` — the panel's first markup (the chips, `1d20`, "No rolls
  yet"); `DiceSheet` open and closed.
- `apps/web/test/player.test.tsx` — Characters and Dice roll are links; the dice tile has no count.
- `apps/web/e2e/dice.spec.ts` — §3 items 1–4, 6, 8–10, 12 in Chromium at 360 × 800; screenshots.
- Control numbers from: the chi-square threshold of `packages/engine/test/dice.test.ts` (scipy
  `chi2.ppf(1 - 1e-9, 6)` = 53.34); the faces the scripted die gives; `DICE_LIMITS`.

#### 8. Checked against the source

Nothing to check: no rules facts. `d` and `к` both parse (ENG-08, `formula.ts` `DICE`).

#### 9. Not in this ticket

- The sheet's dice button that opens `DiceSheet`: SHEET-30 (the sheet's frame does not exist yet).
- The roll dialog of a number on the sheet, advantage, criticals: SHEET-39.
- The throw that looks real, dice skins ("Skins ★" on `V3-Dice`), the "Flat dice" setting:
  the dice phase (ADR 009 item 10, ADR 005 item 11).
- The person's own modifiers as marked `own` entries of a sheet's roll (ADR 009 item 11): the
  dice phase; the panel's modifier is part of its own formula.
- Sending a roll over the table link, secret rolls: the table link's phase.
- Vibration on Android (SPEC §6.5): phase 7.

#### 10. Rake check

- **Formulas never run code**: the panel passes text to `parseRoll`/`recordRoll`; no `eval`.
- **Missing is not broken**: a formula that does not parse shows a reason; a missing path counts
  0 with a warning; a bad `customDice` row reads as none and is named.
- **The engine is pure**: the random source is the app's, passed in; the engine is not changed.
- **No look written in a component**: token classes, `<Part>` and `<Slot>`; lint is green.
- **No user-facing string literal**: every string is a `dice` key; formulas and numbers are data.
- **The dice parser accepts both `d` and `к`**: the field goes through `parseRoll`; e2e types `к`.
- **No external requests**: IndexedDB and `crypto` only.

#### 11. What came out of it

Measured on 2026-10-29, on top of SHEET-31 (`d1cd153`; built on `ed11c6f`, then SHEET-31
landed and the gate ran again):

- `pnpm lint`: `Checked 286 files`, 0 errors. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: `Test Files 91 passed (91)`, `Tests 1180 passed (1180)`, 19.63 s (19 new: 15 in
  `dice.test.ts`, 4 in `dice-panel.test.tsx`; `player.test.tsx` and `navigation.test.tsx`
  changed, not added); lines covered 99.9 % (3026 / 3029). The second suite
  `Tests 2 passed (2)`, unchanged.
- `pnpm e2e`: `27 passed (17.9s)` on `pixel-7` (2 new in `dice.spec.ts`; `navigation.spec.ts`
  now counts 4 links and 4 "Coming later").
- The tests are live: with `builtFormula` dropping the modifier, `dice.test.ts` gave
  `1 failed | 14 passed (15)`.
- The chi-square of `panelDie()` over 70,000 rolls of a d7 is under 53.34 on every run.
- Screenshots at 360 × 800: the empty page (dark); 37d6 + 3 rolled, 37 faces and the total
  (dark); `2к20kh1 + 1` with the dropped d20 greyed and struck, History, a parse error, the edit
  mode with a d7 (dark); "I roll myself" with 14 typed (light). `scrollWidth` 360 on each.
- Differs from the boards: one panel serves both places, so the dice page draws the builder of
  `V3-SheetDice` (die chips, "How many", the formula field) instead of `V3-Dice`'s "tap a die to
  add it" chips, and the sheet panel gets `V3-Dice`'s "Last roll" card. The modifier is a −/+
  stepper, not a "+ Modifier" button. The total sits under the faces, not beside them: beside
  them the 37 faces fit 4 to a row in 193 px (measured), under them 7. No "Skins ★" (the dice
  phase).
- Decided here (ADR 002): the roller off a sheet is named "Player" (`dice:roller`); custom dice
  are one `settings` row; typed faces go out in written order (§4 item 2); a parse error's
  position is shown counted from 1.
- Not proved in a browser: `DiceSheet` is drawn by nothing yet. Its markup is tested
  (`dice-panel.test.tsx`); SHEET-30 mounts it and its e2e taps it.

Found, not fixed:

- The SHEET-38 row's note said the panel's "History" is on board `V3-SheetDice`; the "History"
  there is the skill on the sheet behind the panel. The panel's History is built anyway, as the
  note asked.

Changelog: "The dice page rolls any count of any die, a modifier, or any formula typed with d or
к, fairly; it keeps the person's own dice, shows the last roll's faces and the earlier rolls, and
with "I roll myself" on counts the faces the person types."

---

### SHEET-27 The manual form makes a character

**Hat:** The manual form makes a character
**Depends on:** SHEET-09, SHEET-10, SHEET-11, ENG-19, ENG-56
**Size:** M
**Screen:** Yes — P3 New character; boards `V3-Create` (and `V2-Create` for the live bar) in
`docs/design/mockups/`; BRIEF Part 5 row "P3 Character creation"
**SPEC:** §7.4 (manual mode), §8.2, §5.8

---

#### 1. Where the code lives

**Main file:** `apps/web/src/pages/NewCharacterPage.tsx` — changes (was SHEET-11's empty page).
- `packages/system-5e/src/manual.ts` — new: `manualCharacter`, `madeByHand`, `manualHitPoints`.
- `apps/web/src/pages/create/` — new, one file per step: `RulesStep`, `NameStep`, `OriginStep`,
  `ClassesStep`, `AbilitiesStep`, and the empty `EquipmentStep` (SHEET-28) and
  `AbilityBonusWindow` (SHEET-29); `Fields.tsx` the shared pieces; `draft.ts` the form's state;
  `warnings.ts` which warning shows under which pick.
- `apps/web/src/systems.ts` — `MANUAL_FORM_SYSTEMS`: a system's rules bases, words, highest level
  and maker.
- `apps/web/src/theme/parts.ts` — a `field` part for text fields and pickers.
- `apps/web/src/content/packs.ts` — `contentOf` takes any system id and pack list.
- `apps/web/src/locales/en/create.json` — the form's words.

#### 2. What is missing now

`/characters/new` showed only the header "New character" (SHEET-11: "empty until SHEET-27 fills
it"). `grep -rn "compute(" apps/web/src` found nothing: no screen computed a character. No
function in `packages/` built a new character: `grep -rn "DEFAULT_HOUSE_RULES" packages/*/src`
found only its definition.

#### 3. What it should look like when done

1. `/characters/new` shows one scrolling form in BRIEF P3's order: Rules (system "5E compatible",
   rules base 2014 / 2024, the content packs, "My packs" coming later, "Mix editions"), Name,
   Origin (Race on 2014, Species on 2024; Background), Classes and levels, Ability scores,
   Equipment (coming later, SHEET-28).
2. A new form is on 2024 rules with SRD 5.2.1 ticked, mixing off, and every score 10.
3. A bar pinned at the bottom shows AC, HP and Init from `compute()`, changed at each keystroke,
   and "Create".
4. Golden B's inputs (human, Soldier, fighter 1, 15 13 14 8 12 10) give HP 12, AC 11, Init +1;
   fighter 4 gives HP 36.
5. A pick of the other edition, a prerequisite not met, or a pick no ticked pack holds shows an
   amber line under that pick. Nothing blocks "Create"; an empty name is saved as "Unnamed
   character".
6. "Create" saves the character at full hit points and opens its sheet's address; My characters
   then lists it ("Human · Fighter 1", 2024).
7. The stats are the packs' (D3): none are named in the form's code.

#### 4. How to do it

1. Module: `manualCharacter(ask)` writes the core and `systemData` from what was typed:
   `DEFAULT_HOUSE_RULES`, the edition's `abilityBonusSource` and `languageSource` (ENG-19,
   ENG-56), no choices, items or coins, `mode: 'manual'`, score method `manual`, advancement by
   milestone with 0 XP. `manualHitPoints` writes the first class's level 1 as `max`, every other
   level as `avg` (§8). `madeByHand(ask, index)` computes the maximum, writes it as the current
   hit points, and computes again.
2. App: `MANUAL_FORM_SYSTEMS` gives the form its system through `systems.ts`, the only file that
   imports a module.
3. `draft.ts` holds the form; a rules base change without mixing takes that base's packs; a pick
   that is no longer offered stays, shown by name or as `Missing: <id>`, and warns.
4. The stats come from the engine's own key finder (`keyFinderOf`, `keysOfTypeOf`) on the ticked
   packs.
5. `warningsAbout(computed, id)` turns `missing`, `otherRuleset`, `unmetPrerequisite` and
   `noStartingLanguages` about a picked id into i18n keys.
6. A `field` part (outlined, underlined, window) shapes inputs and pickers, so a skin re-picks it.

#### 5. Stored data

Nothing stored changes. The form writes a character of the current versions (core 2, fifth
edition 9) through `saveCharacter`, which opens it through its schema first.

#### 6. What a person will see

From My characters' "+": the form above, at 360×800, dark and light. States: empty (AC 10, HP 0,
Init 0); filled with Iren (AC 11, HP 12, Init +1); a warning shown (a 2014 dwarf and wizard on 2024
rules with mixing on). Keys in `create.json`: `rules.*`, `name.*`, `origin.race|species|background`,
`classes.*`, `abilities.*`, `bar.*`, `warn.*`, `create` ("Create"), `failed` ("The character could
not be saved on this device. Nothing was saved; try again."), `unnamed` ("Unnamed character").

#### 7. Tests

- `packages/system-5e/test/manual.test.ts` — `describe('SHEET-27 the manual form makes a
  character')`: the goldens' hit point entries (A, B, B4, C 2014 and 2024); house rules and
  sides; nothing picked for the person; full hit points (B 12, B4 36); golden B with its picks and
  gear: HP 12, AC 17, Init +3; golden A: HP 12, AC 18, Init +0.
- `apps/web/test/create.test.ts` — `describe('SHEET-27 the manual form')`: the new form, packs per
  rules base, options per edition, subclasses, stats in order, score parsing, the level total,
  golden B's inputs, each warning under its pick.
- `apps/web/e2e/create.spec.ts` — the empty form, golden B typed in and created, the warning state.
- Control numbers from: SPEC §6.7 goldens A, B, B4; unarmored AC 10 + Dex modifier and level 1 hit
  points, §8.

#### 8. Checked against the source

Source: foundryvtt/dnd5e at `7bfb3f1c03e107bf65942151ef08d50ddb01ba8a`,
`packs/_source/rules/chapter-6-customization-options.yml` (SRD 5.1) and
`packs/_source/content24/chapter-2/character-creation.yml` (SRD 5.2.1), CC-BY-4.0.

- SRD 5.1, Multiclassing, "Hit Points and Hit Dice": "You gain the hit points from your new class
  as described for levels after 1st. You gain the 1st-level hit points for a class only when you
  are a 1st-level character."
- SRD 5.2.1, Multiclassing, "Hit Points and Hit Point Dice": "You gain the Hit Points from your new
  class as described for levels after 1. You gain the level 1 Hit Points for a class only when your
  total character level is 1."
- SRD 5.2.1, character creation: level 1 hit points are "shown on the Level 1 Hit Points by Class
  table"; on later levels, "Instead of rolling, you can use the fixed value shown in the Fixed Hit
  Points by Class table."
- So the first class's level 1 is `max` and every other level `avg` (dnd5e's fixed value), as the
  goldens already store them (A, B, B4, C).

#### 9. Not in this ticket

- The equipment step: SHEET-28 (its file is here, empty).
- The window for ability score increases from two editions: SHEET-29 (its file is here, empty).
- Grant picks (skills, a lineage, a feat, a size): the choices badge, SHEET-36; phase 4's wizard.
- The portrait picker of BRIEF P3 step 4: the round token, SHEET-56.
- Steps that open and close, score methods, the roll calculator: phase 4 (ADR 010, ADR 013).
- The sheet the created character opens to: SHEET-30.
- Hit points per level typed by hand: a manual edit of the maximum, SHEET-34.

#### 10. Rake check

- **Everything is data**: the score fields are the packs' stats, found by the engine's key
  finder; no stat or skill is named in the form.
- **The core names no game; each system's rules live in its module**: the new character is built
  in `system-5e`; the app reaches it only through `systems.ts`. No `if (ruleset === …)`: the words
  come from `terms`, the sides from `rulesOf`.
- **compute() is pure; the UI reads only Computed**: the bar reads `ac.total`, `hp.max`,
  `init.total`, each with a breakdown; the ability lines read `abilities.<key>.score` and `.mod`.
- **Missing is not broken; warnings never block**: a pick no pack holds shows `Missing: <id>`;
  "Create" is always on.
- **No look in a component / no visible literal**: tokens and parts only; every string is a
  `create` key; SHEET-02's and SETUP-05's checks pass.
- **A stored-shape change needs a migration**: nothing stored changes (§5).

#### 11. What came out of it

Measured on 2026-10-29, on `536ce1b` (SHEET-38, the base it landed on):

- Whole gate (`lint && typecheck && test && e2e`): exit 0, 73 s.
- `pnpm lint`: `Checked 300 files`, no fixes. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: 93 files, 1200 passed, 0 failed, 22.0 s, then the speed project 2 passed. Lines
  covered 99.9 % (3041 / 3044). New: `manual.test.ts` 10 tests, `create.test.ts` 10 tests.
- `pnpm e2e`: 30 passed, 0 failed, 25.2 s; `create.spec.ts` adds 3.
- The bar, measured in Chromium: empty form `10 · 0 · 0`; golden B's inputs `11 · 12 · +1`;
  fighter 4 `11 · 36 · +1`.

Differences from §3: none. Beyond the row: a subclass picker per class, since golden A's cleric
takes its subclass at level 1 and the form must be able to enter it.

Changed outside the hat, because this ticket broke it: `navigation.spec.ts` found "Back" by a
partial label, which now also matched the "Background" picker (`exact: true` added);
`theme.spec.ts` lists every part's base style, so it lists `field`; `parts.test.tsx` lists the new
part.

Found, not fixed:
- On 2024 rules a 2014 race and a 2024 background that both raise scores stay silent in this form
  until SHEET-29 draws its window; `compute()` already gives `abilityBonusConflict`.
- A long class name with its edition ("Wizard · 2014") is cut short in the class picker at
  360 px. Nothing to do now; phase 3's longer names may need the row laid out on two lines.

Changelog: "New character makes a character by hand: rules base and packs, name, race or species,
background, classes and levels, and any ability scores, with the live AC, hit points and
initiative pinned at the bottom; warnings show in amber and never block Create."

---

### SHEET-30 The sheet's frame pins the header above the dock

**Hat:** The sheet's frame pins the header above the dock
**Depends on:** SHEET-09, SHEET-10, SHEET-11, SHEET-13, SHEET-23, SHEET-38 (`DiceSheet`)
**Size:** M
**Screen:** Yes — the character sheet; board `V3-Sheet` (and `V3-TempHP` for the bar), BRIEF P4,
its row in `docs/design/BRIEF.md` Part 5 ("P4 Character sheet, since 2026-10-01")
**SPEC:** §7.2 (the pinned header, the tabs, play mode), §6.1 (the UI reads only `Computed`),
§7.5 (units shown), §8.2; ADR 009 item 4, ADR 013 items 1 and 2

---

#### 1. Where the code lives

**Main file:** `apps/web/src/pages/SheetPage.tsx` — changes (it was SHEET-11's empty page).
- `packages/system-5e/src/sheet-header.ts` — new: what the header names for fifth edition.
- `packages/system-5e/src/classes.ts` — `classesOf` takes anything with `entities`, so `Computed`.
- `apps/web/src/systems.ts` — `SHEET_SYSTEMS`, each system's module and header parts.
- `apps/web/src/sheet/` — new: `SheetContext.ts`, `SheetHeader.tsx`, `SheetDock.tsx`,
  `SheetNumber.tsx`, `tabs.ts`, `SheetDice.tsx`, `header/`, `sections/`, `panels/`.
- `apps/web/src/settings/units.ts` — new: a distance in feet, shown in the chosen unit.
- `apps/web/src/shared/RollDialog.tsx`, `BreakdownSheet.tsx` — take the number's path.
- `apps/web/src/shared/ToastHost.tsx` — the toast sits above the dock.
- `apps/web/src/locales/en/` — `sheet.json` filled; 18 new empty namespaces.

#### 2. What is missing now

Measured on `d1cd153`: `/characters/<id>` draws `<Page title="Character">` and nothing else,
for any id. `SheetPage.tsx` is 9 lines with the comment "empty until SHEET-30 fills it". No code
in `apps/web` calls `compute()`. The toast sits at `bottom-4` (16 px) on every page.

#### 3. What it should look like when done

1. Golden B (SPEC §6.7) saved and opened: the header shows "Golden B", "Fighter 1", "2024", and
   the row 17 AC, +3 Init, 30 ft Speed, +2 Prof, 13 Passive, each read from `Computed`.
2. Golden A's header adds the spellcasting line: WIS, Save DC 13, Attack +5.
3. The dock shows "12 / 12" and, with 5 temporary hit points, "+5" in the `temp` colour, and
   a bar of 70.6 % `hp` and 29.4 % `temp` (board `V3-TempHP`); Damage and Heal; eight tabs:
   Main, Turn, Combat, Spells, Gear, Features, About, Notes.
4. The header's top is at y 0 and the dock's bottom at y 800; the tab scrolls between them;
   the page is 360 px wide.
5. The Edit switch is off (a lock) each time the sheet opens; a tap turns it on.
6. A tap on a tab, or a sideways swipe of 56 px on the tab, changes the tab; `?tab=` keeps it.
7. Every number of the header is one `SheetNumber`: a tap calls the roll (SHEET-39) when it
   rolls, a long press of 500 ms or the context menu calls the breakdown (SHEET-33).
8. Each tab's sections, and the number pad, the Rest frames, the "⋯" menu and the choices
   list, are their own empty files, each with its own namespace.
9. A character not on the device, one that does not open, and a pack not on the device each say
   so in words; nothing throws.
10. The toast sits 16 px above the dock on the sheet, and 16 px above the bottom elsewhere.
11. A round 56 px dice button sits 16 px above the dock; it opens SHEET-38's `DiceSheet`, at most
    400 px high, with the character as `roller` and its computed paths as `read` (SHEET-38's
    note for this row).

#### 4. How to do it

1. In the module, `sheet-header.ts`: the stats row as paths (`ac.total`, `init.total`,
   `speed.walk`, `prof`, `skills.perception.passive`), the class line, each casting class's
   stat with its `classes.<key>.spell.dc` and `.attack`, and the stored hit points.
2. In `systems.ts`, `SHEET_SYSTEMS` by system id, as `CHARACTER_LIST_LINES` is.
3. `SheetPage` watches the row with Dexie's `liveQuery`, so each change and undo shows; it loads
   the packs once per pack list and runs `compute()` once per stored version.
4. `SheetContext` hands the character, content, `Computed`, edit mode and the two openers to
   every piece; the frame mounts the open panel.
5. The dock writes its height into `--dock-height`; the toast's `bottom` and the dice button's
   read it.

#### 5. Stored data

Nothing stored changes. Edit mode and the open panel live only while the sheet is open; the tab
lives in the address.

#### 6. What a person will see

The sheet opens from a card of My characters. While the row is read, the page frame shows
with nothing in it. Ready: the header, the empty tab, the dock. The messages: `sheet.notFound`
"This character is not on this device.", `sheet.failed`, `sheet.unopened.*` (the list's three
reasons), `sheet.noSheet`, `sheet.notInstalled` "The pack {{id}} is not on this device: its
entries show as missing." The labels: `sheet.numbers.*`, `sheet.casting.dc` "Save DC",
`sheet.casting.attack` "Attack", `sheet.hp.label` "Hit points", `sheet.damage`, `sheet.heal`,
`sheet.rest`, `sheet.edit`, `sheet.actions`, `sheet.tabs.*`, `sheet.choices` "{{count}}
choices to make" with the badge `!{{count}}`.

#### 7. Tests

- `packages/system-5e/test/sheet-header.test.ts` — the row's values on golden B, each with a
  breakdown; golden A's DC and attack; golden C's two casting classes; the class line; the hit
  points.
- `apps/web/test/sheet.test.tsx` — the header and the dock drawn from golden A, B and C; the
  temporary hit points; the choices badge; the formats; the swipe; every empty piece.
- `apps/web/e2e/sheet.spec.ts` — the frame at 360×800 in Chromium; edit mode, tabs, swipe and
  reload; the dice button and its panel; the caster line; a missing character; a missing pack;
  the toast above the dock.
- Control numbers from: SPEC §6.7 goldens A and B, as the golden tests state them (AC 17,
  initiative +3, speed 30, proficiency +2, passive Perception 13, 12 hit points; AC 18, DC 13,
  attack +5).

#### 8. Checked against the source

No rules fact is new. The paths are those the golden tests already read. Passive Perception is
both SRDs' passive check of the Perception skill (`skills.perception.passive`, ENG-13).

#### 9. Not in this ticket

- What each section and panel shows: the rows named in their files (SHEET-32 to SHEET-58).
- Squares as a distance: SHEET-68, in `apps/web/src/settings/units.ts`.
- Custom sections as extra tabs: SHEET-57.

#### 10. Rake check

- **The UI reads only `Computed`**: every header number is a `SheetNumber` at a path with a
  breakdown (checked on golden B); the stored current and temporary hit points are trackers.
- **Own fields only**: `numberAt` reads `Object.hasOwn`, so `toString` reads as no value.
- **Each system's rules live in its module**: the paths and the casting classes come from
  `system-5e`; the frame asks `SHEET_SYSTEMS`, never a system id.
- **Stored units are feet**: speed is converted only on screen (`units.ts`).
- **No look in a component, no visible literal**: tokens, slots and parts only; every string is
  a `sheet` key; lint passes.
- **Missing is not broken**: a missing row, a refused row, a missing pack and a missing value
  are each a line of text or "—".

#### 11. What came out of it

Measured on 2026-10-29, on `24050f9` (SHEET-27, the base it landed on; SHEET-31, SHEET-38 and
SHEET-27 landed while this row ran):

- Whole gate (`lint && typecheck && test && e2e`): exit 0, 89 s.
- `pnpm lint`: `Checked 350 files`, no fixes. `pnpm typecheck`: 6 projects `Done`.
- `pnpm test`: 95 files, 1222 passed, 0 failed, 27.11 s, then the speed project 2 passed. 22
  of the tests are new here: 6 in `sheet-header.test.ts`, 16 in `sheet.test.tsx`.
- `pnpm e2e`: 36 passed, 0 failed, 27.2 s; 6 of them are new (`sheet.spec.ts`).
  `sheet.spec.ts`, `navigation.spec.ts` and `dice.spec.ts` with `--repeat-each=5`: 70 passed,
  0 failed.

Which row fills which file (each with its own namespace in `apps/web/src/locales/en/`):

| File in `apps/web/src/sheet/` | Row | Namespace |
|---|---|---|
| `sections/Abilities.tsx`, `SavingThrows.tsx`, `Skills.tsx` | SHEET-32 | `checks` |
| `sections/Conditions.tsx` (on Main and Combat) | SHEET-42 | `conditions` |
| `sections/TurnList.tsx` | SHEET-49 | `turn` |
| `sections/Attacks.tsx` | SHEET-44 | `attacks` |
| `sections/Concentration.tsx` | SHEET-41 | `concentration` |
| `sections/DeathSaves.tsx` | SHEET-43 | `deathSaves` |
| `sections/SpellList.tsx` | SHEET-46 | `spells` |
| `sections/Items.tsx` | SHEET-50 | `gear` |
| `sections/Coins.tsx` | SHEET-51 | `coins` |
| `sections/FeatureList.tsx` | SHEET-48 | `features` |
| `sections/AboutList.tsx` | SHEET-53 | `about` |
| `sections/NotesText.tsx` | SHEET-54 | `notes` |
| `header/Inspiration.tsx` | SHEET-55 | `inspiration` |
| `header/Token.tsx` (draws the first letter now) | SHEET-56 | `token` |
| `panels/NumberPad.tsx` (`mode` damage or heal) | SHEET-40 | `numberPad` |
| `panels/RestPanel.tsx` | SHEET-45 | `rest` |
| `panels/ActionsMenu.tsx` | SHEET-58 | `actions` |
| `panels/ChoicesPanel.tsx` | SHEET-36 | `choices` |

A section reads the sheet with `useSheet()`; a panel gets `onClose`. `RollDialog` and
`BreakdownSheet` get the number's `path` and `onClose` from the frame.

Differences from §3 and from the board:
- The class line stands on the second line, before the edition badge, not beside the name: at
  360 px, beside the name, both "Golden B" and "Fighter 1" were cut ("Golde…", "Fight…") in the
  first screenshot. The board's second line holds the inspiration stars; they follow the badges.
- The board's fifth number, Passive, is kept, although the row named four.
- The Edit switch shows a lock in play mode and a pencil in edit mode (BRIEF P4: "A lock icon in
  the header shows play mode"; Part 5: Edit stays a header button).
- Decided here (ADR 002): metres are shown at 5 ft to 1.5 m (30 ft is 9 m), rounded to a
  tenth; this was left open by SHEET-13 §11.

- SHEET-38 closed while this row ran and left it a note: the dice button opens `DiceSheet` with
  the character as `roller`. `SheetDice.tsx`, first made empty for SHEET-38, now holds the
  button and the panel (§3 item 11).

Changed outside the hat, because this ticket changed it: `toast.test.tsx` expected the toast's
old `bottom-4` class; `navigation.test.tsx` lists the 18 new namespaces and passes the roll
dialog and the breakdown a path.

Found, not fixed:
- The header's spellcasting line names casting classes only. A spell a feat or a species gives
  with its own stat has its DC at `abilities.<stat>.spell.dc` (ENG-51) and is not in the line;
  SHEET-46 decides whether the Spells tab's line shows it.
- Dexie's `liveQuery` sees only writes made through Dexie; every write in the app is one. The
  e2e tests write rows before the sheet opens, so they do not rely on it.

Changelog: "A character opens its sheet: the name, class and level, edition, AC, initiative,
speed, proficiency, passive Perception and, for a caster, the spell save DC and attack pinned
at the top; hit points with temporary ones in their own colour, Damage, Heal and eight tabs
pinned at the bottom. The tabs are still empty."

---

### SHEET-68 Distances can be shown in squares · XS

**Hat:** Show a distance in squares
**Where:** `apps/web/src/settings/units.ts` — `shownDistance`; `settings.ts` — `settingValues.distance`
**Depends on:** SHEET-13, SHEET-30
**Screen:** P10 Settings (not drawn yet, BRIEF Part 5)

**What it should look like when done:**
1. `settingValues.distance` is `['ft', 'm', 'sq']`; feet stay the default. No stored row changes.
2. Settings shows a third distance option, "Squares".
3. `shownDistance(30, 'sq')` is `{ value: 6, unit: 'sq' }`; the sheet writes it "6 sq".
4. One square is 5 feet, fixed. A leftover under 5 feet is dropped: 25 ft is 5 sq, 4 ft is 0 sq.
5. Settings stays 360 px wide at 360×800.

**Tests:** `apps/web/test/sheet.test.tsx` (`SHEET-68 squares`) — 30, 5, 0, 25 and 4 feet in
squares, and `formatNumber` writing "6 sq"; `apps/web/test/settings.test.tsx` — the list and seven
radios; `apps/web/e2e/sheet.spec.ts` — Squares picked in Settings, golden B's speed reads "6 sq".
Control numbers: SRD 5.2.1, "Playing on a Grid" (PDF page 13): "Squares. Each square represents 5
feet." and "a Speed of 30 feet translates into 6 squares". SRD 5.1 has no grid section (its rule
sections checked: none names a grid). Foundry dnd5e `system.json`: `"grid": { "distance": 5,
"units": "ft" }`.

**What came out of it:**
- Decided here (ADR 002): a square is 5 feet and a person cannot change it; both rulesets' grid
  is 5 feet, and nothing in SPEC §7.5 asks for another size. Rounding is down, because SRD 5.2.1
  moves Speed "in 5-foot segments".
- `ShownDistance.unit` is now `Settings['distance']`, so a new unit is one list entry.
- Differed from §3: with three options the Distance row was 363 px wide at 360 px (the SHEET-13
  e2e caught it). `Choice` in `SettingsPage.tsx` now wraps: the options move under the label when
  they do not fit. Weight and Colours stay on one line (screenshot shown in the chat).
- Gate: lint 350 files clean; typecheck clean; `pnpm test` 1223 + 2 passed, 0 failed, 23.2 s
  (1 test new); `pnpm e2e` 37 passed, 0 failed, 24.7 s (1 new).
- Found, not fixed: BRIEF P10's design prompt still names "feet or metres"; the screen is not
  drawn yet, and the prompt is the owner's text.
- Changelog: "Settings can show distances in squares of 5 feet; the sheet's speed follows."

---

### SHEET-25 A character's Actions copy, export or delete it

**Hat:** A character's Actions copy, export or delete it
**Depends on:** SHEET-10, SHEET-22, SHEET-23, SHEET-24
**Size:** S
**Screen:** Yes — My characters; boards `V3-Characters` (the swiped card) and `V3-Actions` (the
list), BRIEF P2, its row in `docs/design/BRIEF.md` Part 5 ("P2 Characters list")
**SPEC:** §11 (the tables), §12 stage 2 (export of a character in JSON); ADR 008 item 4

---

#### 1. Where the code lives

**Main file:** `apps/web/src/shared/CharacterActions.tsx` — new: the Actions list and its rows.
- `apps/web/src/db/characterActions.ts` — new: copy, export, delete and restore on the device.
- `apps/web/src/shared/saveFile.ts` — new: hands a file to the browser's download.
- `apps/web/src/shared/undo.ts`, `ToastHost.tsx` — a deleted character's toast, with Undo.
- `apps/web/src/pages/CharactersPage.tsx` — the swipe, the card's "⋯", the list watched.
- `apps/web/src/theme/motions.ts` — a `slide` preset for the swiped card.
- `apps/web/src/locales/en/actions.json` (filled), `toast.json`, `characters.json` (the hint).

#### 2. What is missing now

Measured on `84167f7`: a card on My characters is a link and nothing else; no swipe, no "⋯".
`actions.json` is `{}`. No code deletes a `characters` row, and nothing drops a character's
`rollLog` or `history` rows (SHEET-07 §9, SHEET-22 §9 name this row for it). No file is made
anywhere in `apps/web/src`.

#### 3. What it should look like when done

1. A card dragged left by 56 px or more slides 240 px open over four actions, 60 px each: Copy,
   DM link (disabled), Delete, More. Dragged right by 56 px it closes. A drag never opens the
   sheet; a tap on an open card closes it.
2. Each card has a "⋯" button (44 px or more, label "Actions") that opens the Actions list; so
   does More. The list is a sheet from the bottom: the name, the card's line, then Link for the
   DM ("Coming later", disabled), Export, Copy, Transfer ("Coming later", disabled), Delete.
3. Copy stores a new character: a new id, `rev` 0, `createdAt` and `updatedAt` now, the name
   "<name> (copy)", its own copy of the portrait blob. Its rolls and changes stay with the first.
   It lists first, and opens its own sheet.
4. Export saves `<name>.json` (characters a file name cannot hold become `_`): the stored row as
   it was saved, at its versions, 2-space JSON. A row that does not open exports too.
5. Delete drops the character, its rolls, its changes and its portrait (unless another character
   names it) in one transaction. The toast says "<name> deleted" with Undo; Undo puts every row
   back as it was. A failed undo says "<name> could not be brought back", with no Undo.
6. A row that does not open (SHEET-24) offers Export and Delete; Copy is disabled.

#### 4. How to do it

1. `characterActions.ts`: `copyCharacter`, `exportCharacter`, `deleteCharacter`,
   `restoreCharacter`, `characterFileName`; each takes the database, as `history.ts` does.
2. `undo.ts`: the toast kinds `deleted` and `notRestored`; `deleteWithUndo`; `undoToast` restores.
3. `CharacterActions.tsx`: `ActionRows` (the rows and what they run) and `CharacterActions` (the
   sheet around them), so SHEET-58's menu reuses the rows.
4. `CharactersPage.tsx`: `SwipeRow` around each card; the list read through `liveQuery`.

#### 5. Stored data

Nothing stored changes shape. Copy writes a new row of the current versions; Delete and Undo
remove and put back rows as they were.

#### 6. What a person will see

My characters at 360×800. The hint reads "Tap to open. Swipe left, or tap ⋯, for actions."
Keys in `actions`: `title` "Actions", `close` "Close", `dmLink` "Link for the DM", `export`
"Export", `exportNote` "A file of this character", `copy` "Copy", `copyName` "{{name}} (copy)",
`noCopy` "Only a character that opens can be copied", `transfer` "Transfer", `delete` "Delete",
`deleteNote` "Undo stays available for a moment", `swipe.copy` "Copy", `swipe.dmLink` "DM link",
`swipe.delete` "Delete", `swipe.more` "More". In `toast`: `deleted` "{{name}} deleted",
`notRestored` "{{name}} could not be brought back". "Coming later" is `common`'s.

#### 7. Tests

- `apps/web/test/character-actions.test.tsx` — `SHEET-25 Copy`, `Export`, `Delete`, `the Actions
  list and the swipe`: 18 tests, on golden A and golden B of SPEC §6.7 with rolls, changes and a
  portrait row made in the test.
- `apps/web/e2e/characters.spec.ts` — two tests: the swipe, Copy; the "⋯", Export (the
  downloaded file equals golden B), Delete, Undo.
- `apps/web/test/motion.test.tsx`, `toast.test.tsx` — the preset list and the toast's type.
- Control numbers from: board `V3-Characters` (four actions of 60 px, 84 px high); golden B.

#### 8. Checked against the source

Nothing to check: no rules facts.

#### 9. Not in this ticket

- Importing a file: SHEET-26. The sheet's "⋯": SHEET-58, which reuses `ActionRows`.
- Link for the DM and Transfer: the table link's phase (ADR 005).
- "Export all" of SPEC §11 (characters and packs in one file): not a phase 2 row.
- The free limit's counter "1 of 3": the payment phase (ADR 005 item 2).

#### 10. Rake check

- **A person's saved data:** Delete keeps every row it drops and Undo puts them back; a row
  that does not open is never rewritten, and exports as it was.
- **No look in a component:** the colours are tokens (`bg-strong`, `bg-danger`, the `neutral`
  token through its variable), the corner is the card part's, the slide is a motion preset.
- **No visible literal:** every string is an `actions`, `toast` or `common` key.
- **No external requests:** the file is made in memory and saved by the browser's download.
- **Ids are stable:** the copy gets a new id; the first keeps its own.

#### 11. What came out of it

Quality gate, 2026-10-29, on `80c9538` (SHEET-68 landed while this ran) plus this ticket:
`pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` exit 0 in 84.6 s. `pnpm lint` 354 files,
no fixes. `pnpm test` 96 files, 1241 passed, 0 failed (18 new), then the speed project 1 file,
2 passed. Coverage: statements 99.45 % (3478/3497), lines 99.9 % (3051/3054). `pnpm e2e` 39
passed, 0 failed, 27.6 s (2 new). Before the rebase, on `84167f7`: 1240 and 38 passed.

Differences from §3 and the board:
- The board has no "⋯" on the card; ADR 008 item 4 and BRIEF P2 name one, and without it the
  Actions cannot be reached without a swipe (a keyboard, a screen reader). It sits on the card's
  right; the card keeps 56 px free for it.
- The actions under a closed card are hidden: the first screenshot showed their edge as a thin
  line past the card's rounded corners.
- The card takes the pointer only once a drag turns sideways; a tap keeps its link. A vertical
  drag still scrolls the list.

Found, not fixed: nothing.

Changelog: "A character on My characters swiped left, or its ⋯, opens its Actions: Copy makes a
copy, Export saves it as a file, and Delete removes it with Undo; Link for the DM and Transfer
are marked as coming later."

### SHEET-54 The Notes tab keeps free text · XS

**Hat:** Keep the Notes tab's free text
**Where:** `apps/web/src/sheet/sections/NotesText.tsx` — the field and `noteEntry`;
`apps/web/src/sheet/changes.ts` — new: `playerEntry`, the entry every sheet change is built with
**Depends on:** SHEET-23, SHEET-30
**Screen:** Notes tab of the sheet; board `V3-Sheet`, BRIEF Part 5 sheet row (Notes: plain text)

**What it should look like when done:**
1. The Notes tab shows one labelled text field, "Notes", with the placeholder "Write anything
   about this character."; it holds `notes.free` (SPEC §5.8), empty when the key is not there.
2. Typing saves nothing. When the field loses focus with a different text, one change is stored
   (`changeCharacter`, action `setNote`) and the toast says "Note saved" with Undo.
3. Text with no visible character is no note (the schema refuses it): the key is removed, and
   Undo puts the old text back. The same text again makes no change.
4. The text is on the device after a reload. Undo takes the text back; a change made over a newer
   note is refused and writes nothing.
5. The field is written in play mode and in edit mode: a note is the person's words, not a number
   the rules compute.

**Tests:** `apps/web/test/notes.test.tsx` (`SHEET-54 the Notes tab`, `SHEET-54 saving the note`) —
the field's markup, `noteEntry` for add, change, clear and same text, store, toast, Undo and the
refused change on a fake database, on golden B of SPEC §6.7; `apps/web/e2e/sheet.spec.ts` — type,
leave the field, toast, reload, Undo; `apps/web/test/sheet.test.tsx`, `toast.test.tsx` — the
empty-section list and the toast's key list know the new section and `setNote`. Control numbers:
the texts are the tests' own; no rules number is involved.

**What came out of it:**
- Decided here (ADR 002): `notes.free` is the only key this tab writes, so SPEC §5.8's other keys
  (`appearance` and the rest) are for the rows that show them. The save is on blur, so one Undo
  reverses a whole writing, not one key press.
- `playerEntry` is new and general: it builds a log entry from the player with a place's value
  before and after. The rows after this one (inspiration, hit points, rests) build theirs with it.
- Gate: lint 356 files clean; typecheck clean; `pnpm test` 97 files, 1249 passed, 0 failed, 32.8 s
  (8 new), speed project 2 passed; coverage statements 99.45 %, lines 99.9 %; `pnpm e2e` 40
  passed, 0 failed, 32.4 s (1 new). Screenshot at 360×800 shown in the chat.
- Found, not fixed: nothing.
- Changelog: "The Notes tab keeps free text: it is saved when the field loses focus, with a "Note
  saved" toast and Undo."

---

### SHEET-55 Inspiration is tracked as stars

**Hat:** Track inspiration as stars
**Depends on:** SHEET-23, SHEET-30
**Size:** S
**Screen:** Yes — the sheet's header; board `V3-Sheet`, its row in `docs/design/BRIEF.md` Part 5
("P4 Character sheet")
**SPEC:** §6.4 (trackers), §7.2; ADR 009 item 5

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/header/Inspiration.tsx` — changes (was an empty stub): the stars.
- `packages/system-5e/src/inspiration.ts` — `fifthEditionInspiration`: what the stars show.
- `apps/web/src/systems.ts` — `SheetSystem.inspiration`, `gainInspiration`, `spendInspiration`.
- `apps/web/src/sheet/changes.ts` — `perform` and `playerStamp`: run a module's action as the
  player and store its entry with its toast.
- `apps/web/src/sheet/SheetHeader.tsx` — the stars get a row of their own.
- `apps/web/src/locales/en/inspiration.json` (filled).

#### 2. What is missing now

Measured on `2a3ba95`: `Inspiration()` returns `null`; `inspiration.json` is `{}`. The engine
holds `gainInspiration` and `spendInspiration` (ENG-59), and the toast has their texts, but no
screen calls them. `SheetSystem` has nothing for inspiration, and no sheet code runs a module's
action.

#### 3. What it should look like when done

1. The header shows one eight-pointed star per house-rules maximum (`houseRules.inspirationMax`):
   golden B shows 1 empty star; a character with maximum 3 and 2 held shows 2 filled, 1 empty.
2. A tap on an empty star gains one (`gainInspiration`); a tap on a filled star spends one
   (`spendInspiration`). Each is one change with its toast, "Inspiration gained" or "Inspiration
   spent", and Undo. A refusal (`atMax`, `noInspiration`) writes nothing.
3. When the house maximum is not the edition's own (`rulesOf(...).inspiration.max`, 1 in both
   SRDs), "Rules: 1" stands beside the stars; when they are equal it is not shown.
4. The group is named "Inspiration 2 of 3", or "Heroic Inspiration 2 of 3" for a 2024 character
   (`terms.inspiration`).
5. Each star is 20 px wide with a touch area 48 px tall; the polygon is the board's.
6. The header stays 360 px wide at 360×800 and the class line stays visible.

#### 4. How to do it

1. `fifthEditionInspiration(character)` gives `{ held, max, rules: { max, use }, term }`.
2. `SheetSystem` gets `inspiration`, `gainInspiration`, `spendInspiration`; the component asks the
   sheet's system, never the edition.
3. `perform(character, action)` stamps the action as the player, and stores its entry through
   `changeCharacter`.
4. `Inspiration` draws a `fieldset` with a hidden legend and one button per star.

#### 5. Stored data

Nothing stored changes. `state.inspiration` and `houseRules.inspirationMax` are ENG-33's.

#### 6. What a person will see

The sheet at 360×800, under the name and above the stats row: a row 32 px high with the stars at
the left and, only when needed, "Rules: 1" in muted text. States: none held (all empty), some,
all filled. Keys in `inspiration`: `label.inspiration` "Inspiration {{held}} of {{max}}",
`label.heroicInspiration` "Heroic Inspiration {{held}} of {{max}}", `gain` "Gain inspiration",
`spend` "Spend inspiration", `rules` "Rules: {{max}}".

#### 7. Tests

- `packages/system-5e/test/inspiration.test.ts` — `SHEET-55 the inspiration the sheet shows`: 3
  tests, golden A, golden B and the owner's 3.
- `apps/web/test/inspiration.test.tsx` — `SHEET-55 the inspiration stars`, `SHEET-55 gaining and
  spending`: 8 tests: the markup, the board's polygon, gain, spend, Undo, refusals, the stamp.
- `apps/web/e2e/sheet.spec.ts` — one test: 2 of 3 filled and "Rules: 1", the touch area, a tap
  gains, a tap spends, Undo, the state after a reload, 360 px wide.
- Control numbers from: SPEC §6.7 golden A and B (none held, house maximum 1); the polygon's
  points copied from board `V3-Sheet`.

#### 8. Checked against the source

ADR 009 item 5 marks the SRD's rule `[ПРОВЕРИТЬ]`; it was checked by ENG-19 §8 and ENG-59: SRD 5.1
"Inspiration": "You either have inspiration or you don't", so the edition's maximum is 1 (spent as
advantage); SRD 5.2.1 "Heroic Inspiration": the same maximum 1 (spent as a reroll). Both are in
`rulesets/2014.ts` and `2024.ts`. The default of 3 is the owner's house rule, so the edition's
number is shown beside it, as ADR 009 item 5 asks.

#### 9. Not in this ticket

- What a spent inspiration does to a roll (advantage, a reroll): SHEET-39's roll dialog.
- The DM's control of the maximum: the table link (ADR 009 item 13).
- The house rules' editor for `inspirationMax`: phase 4 (house rules).
- Inspiration gained by a long rest (`inspiration.longRest`): SHEET-45's Rest frames.

#### 10. Rake check

- **Engine is pure, core names no game:** the component reads `SheetSystem`; the 5e numbers come
  from `packages/system-5e`.
- **Rules live in the module:** the maximum, the use and the word come from the edition's rules,
  not an `if (ruleset === …)` in a component.
- **No look in a component:** colours are tokens (`text-text`, `text-muted`, `border-line`).
- **No visible literal:** every string is an `inspiration` key.
- **A person's saved data:** a refused change writes nothing; every change is undoable.

#### 11. What came out of it

Quality gate, 2026-11-03, on `2a3ba95` plus this ticket: `pnpm lint` 357 files, no fixes;
`pnpm typecheck` clean; `pnpm test` 98 files, 1260 passed, 0 failed, 33.1 s (11 new), then the
speed project 2 passed; coverage statements 99.45 % (3481/3500), lines 99.9 % (3054/3057);
`pnpm e2e` 41 passed, 0 failed, 33.6 s (1 new). Screenshot at 360×800 shown in the chat.

Differences from §3 and the board:
- The board puts the stars on the name's second line, as SHEET-30 expected. With the class line,
  the edition badge and "Rules: 1" they left no room at 360 px: the first screenshot showed the
  class line cut to nothing and "Rules: 1" over the Rest button. The stars have a row of their own
  (32 px), between the name and the stats row. Every character's header is 32 px taller.
- Decided here (ADR 002): a tap on any filled star spends one and a tap on any empty star gains
  one, since the engine's actions move by one. The star's size is the board's 18 px; its touch
  area is 20 × 48 px, which the row's height allows.
- `INNER` radius of the polygon is 5.2, read from the board's points, not 7 as first guessed.

Found, not fixed: nothing.

Changelog: "The header shows inspiration as stars; a tap on an empty star gains one and a tap on a
filled star spends one, with Undo; the edition's own maximum shows beside the stars when the house
rule allows more."

---

### SHEET-53 The About tab shows the origin details

**Hat:** Show the origin details on the About tab
**Depends on:** SHEET-30, SHEET-54
**Size:** S
**Screen:** Yes — the sheet's About tab; board `V3-About`, its row in `docs/design/BRIEF.md` Part 5
("P4 Character sheet")
**SPEC:** §5.8 (`notes`), §6.2 (`Computed.keys`, `proficiencies`), §7.2; ADR 009 item 3

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/sections/AboutList.tsx` — changes (was an empty stub): the tab.
- `packages/system-5e/src/about.ts` — new: `fifthEditionAbout`, `ABOUT_LISTS`.
- `apps/web/src/systems.ts` — `SheetSystem.about`, `aboutLists`, `terms`.
- `apps/web/src/sheet/changes.ts` — `noteEntry` moves here from the Notes tab, with a key.
- `apps/web/src/sheet/names.ts` — new: `nameIn`, shared with the header.
- `apps/web/src/locales/en/about.json` (filled).

#### 2. What is missing now

Measured on `483d642`: `AboutList()` returns `null`; `about.json` is `{}`. `Computed.proficiencies`
holds every proficiency a grant gave, as `{ category, key, level, from }`, and
`Computed.keys['size']` the chosen size, but nothing on the sheet reads them. The stored character
has no alignment field: `CharacterDoc.notes` holds visible text under any entity key.

#### 3. What it should look like when done

1. The tab is a card headed "About <name>" with rows: the species (the word is "Race" in 2014,
   "Species" in 2024), the lineage ("Subrace" / "Lineage", only when one is gathered), the
   background, the size, the alignment, the languages; then "Proficiencies": Armor, Weapons, Tools,
   and Skills.
2. Golden A (hill dwarf cleric 1, Acolyte): Race Dwarf, Subrace Hill Dwarf, Background Acolyte,
   Size Medium; languages Common, Dwarvish, Celestial, Elvish; armor Light, Medium, Heavy, Shield;
   weapons Simple weapons, Battleaxe, Handaxe, Light hammer, Warhammer; tools Masons tools; skills
   Insight, Religion, Medicine, Persuasion.
3. A name is the pack entry's. A key no entry names is `about.json`'s words (armor groups, weapon
   categories) or the key's own words ("lightHammer" is "Light hammer"). A species or background
   id its pack no longer has reads "Missing: <id>". A list with nothing in it reads "None".
4. The alignment is `notes.alignment`: in play mode text ("Not set" until written); in edit mode a
   field, saved when it loses focus as one change with the "Note saved" toast and Undo. Text with no
   visible character removes the note.
5. No number is shown, so nothing here needs a breakdown. The tab stays 360 px wide.

#### 4. How to do it

1. `fifthEditionAbout(character, computed)`: the species, background, lineages (gathered entities
   of type `lineage`), the size key, and for each list the keys of its proficiency category, each
   once, with a level above 0. `ABOUT_LISTS` gives each list's category and the entity type whose
   `byKey` entries name its keys.
2. `SheetSystem` carries them, so the tab never names the edition.
3. `noteEntry(character, text, now, key)` is the Notes tab's change with the key as a parameter.
4. `AboutList` draws the rows; `Alignment` is the one that can be a field.

#### 5. Stored data

Nothing stored changes shape. The alignment is a note under `notes.alignment`, a place the stored
shape already has (`notes` is a record of visible text), so no `schemaVersion` bump and no
migration. This is the second of the two ways the row named; see §11.

#### 6. What a person will see

The sheet's About tab at 360×800, opened from the dock. States: a character with no species or
background (rows "None"), a pack not installed ("Missing: <id>", beside the sheet's own banner),
full. Keys in `about`: `title` "About {{name}}", `terms.race|species|subrace|lineage`,
`background`, `size`, `alignment`, `alignmentNone` "Not set", `languages`, `proficiencies`,
`armor`, `weapons`, `tools`, `skills`, `none`, `separator`, `missing`, and `keys.armor.*`,
`keys.weapon.*`.

#### 7. Tests

- `packages/system-5e/test/about.test.ts` — `SHEET-53 the origin details of golden A`, `…of other
  characters`: 6 tests. Golden A's lists were read off the grants in `srd-2014.ts`, not from a run.
- `apps/web/test/about.test.tsx` — 9 tests: the rows of golden A and B, the words of a key,
  "Missing", the alignment in play and edit mode, and its note stored and undone.
- `apps/web/e2e/sheet.spec.ts` — one test: the rows of golden A, edit mode, the alignment saved
  and still there after a reload, 360 px wide.
- Control numbers from: SPEC §6.7 golden A and B; the grants of `srd-2014.ts` / `srd-2024.ts`.

#### 8. Checked against the source

Nothing to check: no rules facts are decided here. Which proficiencies a character has is
`compute()`'s (ENG-09, ENG-46); this tab lists them.

#### 9. Not in this ticket

- A breakdown of the size: `BreakdownSheet` shows numbers (SHEET-33); a key's steps
  (`Computed.keys['size'].steps`) have no screen yet.
- Choosing an unmade size or language: SHEET-36 (pending choices).
- Tool kind entries in the pack: no `toolKind` entry exists in `srd-2014.ts` or `srd-2024.ts`, so
  Mason's tools reads "Masons tools" (see §11).
- The alignment in the manual form and the creation wizard: SHEET-27 is closed without it; phase 4.

#### 10. Rake check

- **Everything is data, the core names no game:** the tab reads `SheetSystem`; the lists, the
  terms and the entity types come from the fifth-edition module.
- **Ids are stable, missing is not broken:** an id a pack lacks shows "Missing: <id>".
- **No look in a component:** tokens and parts only (`card`, `field`, `divide-line`).
- **No visible literal:** every string is an `about` key; the words of a key come from the data.
- **A person's saved data:** the alignment is one undoable change; no stored shape changes.

#### 11. What came out of it

Quality gate, 2026-11-03, on `483d642` plus this ticket: `pnpm lint` 361 files, no fixes;
`pnpm typecheck` clean; `pnpm test` 100 files, 1275 passed, 0 failed, 33.1 s (15 new), then the
speed project 2 passed; coverage statements 99.45 % (3495/3514), lines 99.9 % (3068/3071);
`pnpm e2e` 42 passed, 0 failed, 35.3 s (1 new). Screenshot at 360×800 shown in the chat.

Differences from §3 and the board:
- Decided here (ADR 002): the alignment stays in `notes`, as the row allowed, not in a new field.
  It adds no migration, so it cannot touch a saved character; a phase that wants it first-class
  (the wizard, the PDF) adds the field and a migration that moves `notes.alignment`. Free text,
  because SRD 5.1 and 5.2.1 name nine alignments only as examples.
- The alignment is written in edit mode only (play mode changes only the trackers, SPEC §7.2);
  the Notes tab of SHEET-54 is written in both.
- The board shows "Skills" under Proficiencies and a species line; the size row is added from the
  row's note.

Found, not fixed:
- Neither SRD pack has `toolKind` entries (the fifth-edition module defines the type), so a tool
  proficiency such as `masonsTools` is named by its key's words ("Masons tools", not "Mason's
  tools"). The content phase (CONT, not open yet) adds them; this tab then shows their names
  with no change.
- A weapon or armor proficiency by an item's own key shows the pack item's name only for the
  items the pack holds (the Warhammer); the others show the key's words ("Battleaxe",
  "Light hammer").

Changelog: "The About tab shows the species and lineage, background, size, alignment, languages
and the armor, weapon, tool and skill proficiencies; the alignment is written in edit mode."

---

### SHEET-56 The portrait makes a round token

**Hat:** Make a round token from the person's image
**Depends on:** SHEET-03, SHEET-05, SHEET-07, SHEET-25, SHEET-30
**Size:** S
**Screen:** Yes — the portrait panel and the header's token; board `V3-Token`, its row in
`docs/design/BRIEF.md` Part 5 ("P4 Character sheet")
**SPEC:** §11 (the `blobs` table); ADR 005 item 10, ADR 009 item 6, ADR 015 items 2 and 6

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/panels/TokenPanel.tsx` — new: the panel and `TokenFace`.
- `apps/web/src/shared/Portrait.tsx` — new: `PortraitView`, `usePortrait`, `useStill`.
- `apps/web/src/db/portraits.ts` — new: the portrait row, its frames, `checkPortraitFile`.
- `apps/web/src/sheet/portrait.ts` — new: `savePortrait`.
- `apps/web/src/shared/BottomSheet.tsx` — new: the shell a sheet panel is drawn in.
- `apps/web/src/sheet/header/Token.tsx`, `apps/web/src/pages/CharactersPage.tsx` — draw the token.
- `apps/web/src/db/db.ts` — `BlobRow` names the portrait's fields. `locales/en/token.json`,
  `common.json`, `toast.json`.

#### 2. What is missing now

Measured on `895f404`: `Token()` draws the first letter of the name in the `token-frame-ring`
slot and nothing opens from it; `token.json` is `{}`. `BlobRow` is `{ id: string }`; no code
writes a `blobs` row. `Character.portraitBlobId` is in the schema (SHEET-25 copies and drops the
row it names) and is never set. A card on My characters shows the letter.

#### 3. What it should look like when done

1. A tap on the header's token opens the Portrait panel: the title, a round preview, "Choose an
   image of <name>" with "Stays on this device", "Token" with its note, three frames (Thin, Ring,
   Double), and "Use as token".
2. A chosen image, animated picture or short video is a draft: the preview and the frames show it
   at once; closing the panel drops it. A file that is not an image or a video, or is over 20 MB,
   is refused with its reason and nothing is stored.
3. "Use as token" stores the bytes and the frame in the `blobs` table, in the row
   `portraitBlobId` names (made, and named in the character, when there was none), and closes the
   panel. Naming the row is one change with the toast "Portrait set" and Undo. A later picture or
   frame replaces what the row holds, in place, with no toast.
4. The header's token and the card on My characters show the picture, cut round, in the picked
   frame (the header only): each frame is its own slot, `token-frame-thin|ring|double`. Ring is
   the default.
5. While motion is stopped (`motionIsStill()`: Settings' still motion, or the system's reduced
   motion) an image shows as one still frame on a canvas, a video as its first frame, paused.
6. Copy keeps the picture and the frame; Delete drops them (SHEET-25, unchanged).
7. Nothing is sent anywhere: the picture is made from the bytes on the device.

#### 4. How to do it

1. `portraits.ts`: the frames, the default, the 20 MB limit, `portraitOfRow` (a row that does not
   read gives the default frame and no picture), `checkPortraitFile`.
2. `savePortrait(characterId, { frame, picture? })`: merge into the row, put it, and when the
   character had no `portraitBlobId`, name it through `changeCharacter`; drop the row if that
   is refused.
3. `Portrait.tsx`: `usePortrait(blobId)` watches the row (`liveQuery`) and makes an object URL
   from the bytes; `PortraitView` draws the letter, `img`, `video` or a still canvas.
4. `TokenPanel` in `BottomSheet`; `Token` opens it.

#### 5. Stored data

No stored shape of a character changes: `portraitBlobId` is already in the schema. The `blobs`
row gains optional fields (`kind`, `bytes`, `type`, `frame`); the table's key and indexes do not
change, so no Dexie version bump. The bytes are an `ArrayBuffer`, not a `Blob`, which every
browser's IndexedDB stores alike. The frame is kept in the portrait row, not in the character, so
it needs no migration; Copy and Delete move the whole row.

#### 6. What a person will see

The sheet at 360×800: the token in the header, 48 px to touch. The panel is a sheet from the
bottom (85 % of the height at most). States: no picture (the letter), a draft, the saved picture,
an error line in red. Keys in `token`: `open` "Change portrait", `alt` "Portrait of {{name}}",
`title`, `choose`, `stays`, `tokenTitle`, `tokenNote`, `frame`, `frames.thin|ring|double`, `use`,
`tooBig` "That file is over {{max}} MB.", `notMedia` "Choose an image or a short video.", `failed`.
`common.close` "Close"; `toast.done.setPortrait` "Portrait set".

#### 7. Tests

- `apps/web/test/portrait.test.tsx` — `SHEET-56 the portrait row`, `…drawing the portrait`,
  `…storing the portrait`: 16 tests: reading a row, the file check, the markup of each state, the
  panel, storing with its toast and Undo, replacing in place, a frame alone, a missing character,
  Copy and Delete.
- `apps/web/e2e/sheet.spec.ts` — two tests: choose, pick Double, refuse a PDF, use, the header
  and the list show it round, reload; reduced motion shows a canvas, not an image.
- `apps/web/test/toast.test.tsx` — the toast key list knows `setPortrait`.
- Control numbers from: board `V3-Token` (three frames: Thin, Ring, Double); the limit is
  decided here (§11).

#### 8. Checked against the source

Nothing to check: no rules facts.

#### 9. Not in this ticket

- Removing a picture (back to the letter): not asked by the row or the board.
- Cropping and moving the picture inside the circle: `object-cover` centres it.
- The token in the initiative tracker: phase 7's tracker (ADR 009).
- The picture in the creation form's step 4: SHEET-27 is closed without it; phase 4's wizard.
- A picture shared inside a campaign: the table link (ADR 005 item 10).

#### 10. Rake check

- **No look in a component:** the frames are the three slots of SHEET-03; the circle and the fit
  are theme classes; no colour is written.
- **No visible literal:** every string is a `token`, `common` or `toast` key, `alt` included.
- **No external requests:** `URL.createObjectURL` over bytes already on the device.
- **A person's saved data:** a picture is replaced in place, never deleted by choosing another; a
  row that does not read gives the letter, not an error; Undo of the first picture leaves the
  row (the person may choose again).
- **Reduced motion:** `motionIsStill()` decides, as SHEET-05 wrote.

#### 11. What came out of it

Quality gate, 2026-11-03, on `895f404` plus this ticket: `pnpm lint` 367 files, no fixes;
`pnpm typecheck` clean; `pnpm test` 101 files, 1291 passed, 0 failed, 34.0 s (16 new), then the
speed project 2 passed; coverage statements 99.45 % (3495/3514), lines 99.9 % (3068/3071);
`pnpm e2e` 44 passed, 0 failed, 38.4 s (2 new). Screenshots at 360×800 shown in the chat.

Differences from §3 and the board:
- Decided here (ADR 002): the frame is kept in the portrait's blob row, so a frame can be chosen
  before an image and no character migration is needed (SHEET-53 owns the wave's one stored-shape
  change). The limit is 20 MB, room for a short loop and not for a film.
- The first screenshot showed the preview's double ring cut at the top of the panel; the body now
  has 8 px above it.
- A token in the list has no frame ring; the board's list shows the plain circle.
- Undo of the first picture removes the name from the character and leaves the blob row, so
  choosing again reuses nothing; one unused row at most per Undo.
- An animated picture's still frame is the whole picture's first frame, drawn on a canvas; a
  video's is its first frame (`#t=0.001`).

Found, not fixed:
- A video's frame at `#t=0.001` and `autoplay` of a muted loop were not run in a browser here (the
  e2e uses a PNG); the markup is tested, the playback is not.
- SHEET-25's tests store `bytes: 'the portrait'` (text). `portraitOfRow` reads such a row as no
  picture, and its tests still pass.

Changelog: "Tap the token on the sheet to choose an image of your character, an animated picture
or a short video included, and a frame; it is cut round and stays on the device. My characters
shows it too."

---

### SHEET-26 A character file imports through its checks

**Hat:** Import a character file through its checks
**Depends on:** SHEET-10, SHEET-24, SHEET-25
**Size:** S
**Screen:** Yes — My characters; its row in `docs/design/BRIEF.md` Part 5 ("P2 Characters list":
"Import file" as a smaller action, and in the empty state). No board draws it.
**SPEC:** §5.8 (an older file migrates on import), §12 stage 2 (export and import of a character
in JSON); ADR 002 (a person's saved data), ADR 008 item 4

---

#### 1. Where the code lives

**Main file:** `apps/web/src/db/importCharacter.ts` — new: `importCharacterFile`.
- `apps/web/src/pages/ImportFile.tsx` — new: the button, the file input, the refusal line.
- `apps/web/src/pages/CharactersPage.tsx` — the empty state's greyed button becomes the real one;
  the list gets it under its hint.
- `apps/web/src/db/characters.ts` — `openFile` is exported for the import.
- `apps/web/src/shared/undo.ts`, `ToastHost.tsx` — the toast kind `imported`.
- `locales/en/characters.json` (`importRefused.*`), `toast.json`.

#### 2. What is missing now

Measured on `cfaf733`: "Import file" in the empty state is `disabled` with "Coming later"; the
list with characters has none. Export (SHEET-25) saves `<name>.json`, and nothing reads one back.
`openFile` (the opener of the system a file names) is private to `characters.ts`.

#### 3. What it should look like when done

1. "Import file" is an enabled button in the empty state and under the hint of a list; it opens
   the file picker for JSON. The file is read on the device and goes nowhere else.
2. A file that passes opens as a character at the current versions: an older file migrates
   (`schemaVersion`, `systemSchemaVersion`), and the result of golden B's file with its later
   fields taken out is golden B. The new character's sheet opens, with the toast "<name> imported".
3. The text SHEET-25's Export made, imported after Delete, stores the same row, with the same id.
4. A file whose id is already on the device never replaces that character: it is stored under a
   new id, with `updatedAt` now; the toast says "<name> imported as a new character: its id was
   already here". The first character is untouched.
5. A file that fails is refused with its reason, in a red line on the page, and nothing is stored:
   not JSON (`notJson`), JSON that is not one object (`notACharacter`), over 5 MB (`tooBig`),
   saved by a newer version of either version field (`newer`), a system the app does not have or
   names none (`unknownSystem`), a schema failure (`invalid`, with the first lines of the checks'
   own text under it).
6. The file brings no rolls, no changes and no picture. A picture id it names stays as it is.
7. The page stays 360 px wide.

#### 4. How to do it

1. `importCharacterFile(text, database, now)`: size, `JSON.parse`, object check, `openFile`,
   then one transaction: when the id exists, a new id and `updatedAt`; `saveCharacter`.
2. `ImportFile`: a button that clicks a hidden file input; read the text, run it, show the
   refusal's key, or `showImported` and navigate to the sheet.
3. `showImported` puts the toast `imported` on screen, with no "Undo" (the character is deleted
   like any other, SHEET-25).

#### 5. Stored data

Nothing stored changes shape. An import writes one `characters` row of the current versions; it
changes no other table.

#### 6. What a person will see

My characters at 360×800: an outlined button with an upload icon, "Import file". States: empty
list (under "New character"), list with characters (under the hint), a refusal (red line, and
for `invalid` a small grey line with the checks' text), success (the sheet, with the toast).
Keys in `characters`: `importRefused.tooBig|notJson|notACharacter|newer|invalid|unknownSystem|
failed`; in `toast`: `imported`, `importedAgain`.

#### 7. Tests

- `apps/web/test/import-character.test.tsx` — `SHEET-26 importing a character file`, `…what a
  person sees`: 12 tests: the exported text restored exactly; an older golden B migrated to golden
  B; golden A; the same id stored as a new one; no rolls, changes or picture; each refusal, with
  the table empty after it; the markup; the toast.
- `apps/web/e2e/characters.spec.ts` — two tests: an older file imports and opens its sheet, the
  same file again is a second character; four refused files, each with its line, nothing stored.
  The SHEET-24 test now expects the button enabled.
- Control numbers from: SPEC §6.7 golden B and golden A (the file is the golden; an older file is
  the golden with `systemSchemaVersion` 2 and the two fields of ENG-56 and ENG-58 taken out).

#### 8. Checked against the source

Nothing to check: no rules facts. The migration steps are ENG-56 and ENG-58's (`systemSchemaVersion`
2 to 4); this ticket only runs them.

#### 9. Not in this ticket

- "Export all" and importing characters and packs together (SPEC §11): not a phase 2 row.
- Importing a pack file: the homebrew phase (HB).
- Importing a file from Foundry or another tool: phase L1.
- The free limit's counter and its paid offer after an import: the payment phase (ADR 005 item 2).
- A picture with the file: Export saves the character row only, so a portrait travels as the id.

#### 10. Rake check

- **A person's saved data:** a refused file stores nothing; a file with a known id never replaces
  the character; an older file is migrated in memory and stored once, valid.
- **A stored-shape change needs a migration:** none changes; the import uses the existing chains.
- **No visible literal:** every string is a `characters` or `toast` key.
- **No external requests:** `File.text()` on the device.
- **Missing is not broken:** a picture id with no row shows the letter (SHEET-56).

#### 11. What came out of it

Quality gate, 2026-11-03, on `cfaf733` plus this ticket: `pnpm lint` 370 files, no fixes;
`pnpm typecheck` clean; `pnpm test` 102 files, 1303 passed, 0 failed, 35.6 s (12 new), then the
speed project 2 passed; coverage statements 99.45 % (3495/3514), lines 99.9 % (3068/3071);
`pnpm e2e` 46 passed, 0 failed, 40.1 s (2 new). Screenshot at 360×800 shown in the chat.

Differences from §3:
- Decided here (ADR 002): a file with a known id becomes a new character, never an overwrite or
  a question; the limit is 5 MB; the new character's sheet opens at once, so it is not lost under
  older ones in the list.
- A file's `rev` and `createdAt` are kept; only a same-id file gets `updatedAt` now.
- The first run of the e2e found the file input read as a second "Import file" button; it is
  `aria-hidden` now (the same was done for the portrait's input, SHEET-56).

Found, not fixed:
- A picture does not travel with Export (the file is the row), so an imported character's
  `portraitBlobId` names nothing on a new device. Carrying the picture needs a file shape that
  holds bytes: a decision for the owner (ADR 002, "what the app does for a person"), not made here.

Changelog: "My characters has Import file: it reads a character file, migrates an older one,
refuses one that fails its checks with the reason, and never replaces a character it already has."

---

### SHEET-28 The manual form's equipment step adds items

**Hat:** The manual form's equipment step adds items
**Depends on:** SHEET-27 (the manual form), ENG-49 (the `missing` warning for looked-up ids)
**Size:** S
**Screen:** Yes — `V3-Create` in `docs/design/mockups/`; `docs/design/BRIEF.md` Part 2 P3 step 9 and Part 5 "P3 Character creation"
**SPEC:** §7.4 (manual mode); ADR 005 item 3 (mixed editions)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/pages/create/EquipmentStep.tsx` — changes: the step lists items and picks more.
- `apps/web/src/pages/create/draft.ts` — changes: `Draft.items`, `withItem`, `withItemQty`, `withoutItem`, `askOf` gives `inventory`.
- `apps/web/src/pages/create/warnings.ts` — changes: `itemWarnings`.
- `packages/system-5e/src/manual.ts` — changes: `ManualItem`, `ManualCharacterAsk.inventory`; the maker writes the rows.
- `apps/web/src/locales/en/create.json` — changes: the `equipment` keys.

#### 2. What is missing now

Measured on `688eb74`: `EquipmentStep` shows the text "Coming later"; `madeByHand` always writes `inventory: []`; the form has no way to hold an item. `compute()` looks an item up only once it is worn (`equipmentOf`), so a starting item of the other edition, or one no ticked pack holds, gets no warning at all.

#### 3. What it should look like when done

1. The step offers the items of the ticked packs: the rules base's, or every edition's when "Mix editions" is on, sorted by name then id. With the 2024 pack alone: Chain Mail, Glaive, Greataxe, Greatsword, Halberd. With both packs and mixing: the 2014 Chain Mail first, then the five of 2024, then Shield and Warhammer.
2. A picked item is a row with its name, a quantity from 1 to 999 with − and + buttons, and a remove button. The same item picked again adds one to its row.
3. With mixing on, each row's name carries its edition (`Shield · 2014`). An item of the other edition shows the amber warning `otherRuleset` (mixing on) or `otherRulesetNotMixing` (off). An item no ticked pack holds shows `Missing: <id>`. Nothing blocks "Create".
4. "Create" stores each row as `{ uid, itemId, qty, equipped: false, attuned: false }`, in the order listed. Nothing is worn, so no number changes (the bar's AC stays); wearing is SHEET-50.
5. With no pack ticked the step says so.
6. The gate is green: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`.

#### 4. How to do it

1. `manual.ts`: `ManualItem { uid, itemId, qty }`; `ManualCharacterAsk.inventory` (optional); `manualCharacter` maps it to rows, unworn and unattuned. The app makes the `uid`, as it makes the character's id.
2. `draft.ts`: `DraftItem`, `Draft.items`, three pure edits; `withItem` takes the new row's `uid` so it stays pure.
3. `warnings.ts`: `itemWarnings(entities, draft, id)` — not found: `missing`; found and `shareRuleset` false: the two edition keys. It uses the engine's `shareRuleset`, so the rule is not written again.
4. `EquipmentStep.tsx`: the rows and the picker, built from `Part` and the shared `Picker`/`Warnings`.

Technical choices (ADR 002): one row per item with a quantity, not one row per copy; a stepper, not a typed field, so no "not a number" state exists; the check is in the form, because `compute()` does not look up an unworn item and the ticket's job is the starting list.

#### 5. Stored data

Nothing stored changes. `inventory` and its row shape exist (ENG-63); the form fills a list that was always empty.

#### 6. What a person will see

The Equipment card at the end of the form (360×800). Empty: only "Add an item" with "Pick an item". Filled: rows, then the picker. Warning: an amber line in the row. No pack: "No ticked pack holds items. Tick a content pack above."
Keys in `create`: `equipment.add` "Add an item", `pick` "Pick an item", `none`, `more` "One more {{name}}", `less` "One less {{name}}", `remove` "Remove {{name}}"; warnings reuse `warn.*`.

#### 7. Tests

- `apps/web/test/create.test.ts` — `SHEET-28 the equipment step`, 4 tests: the options per rules base and mixing; adding, counting, clamping, removing; the rows made; the three warnings.
- `packages/system-5e/test/manual.test.ts` — 1 test: the rows, and none by default.
- `apps/web/e2e/create.spec.ts` — 1 test: add, count, remove, then a 2014 item with the warning, and Create.
- Control numbers from: the packs' own item lists (source files), golden B's inputs for the character.

#### 8. Checked against the source

Nothing to check: no rules facts. ADR 005 item 3.5's "a badge shows each entry's edition" is shown when mixing, as the other pickers do.

#### 9. Not in this ticket

- Wearing, attuning, weight, containers, coins: SHEET-50, SHEET-51.
- A custom item as free text: SHEET-52.
- Starting equipment from a class or background: phase 4's wizard.
- The spell side of ENG-49's note: SHEET-46.

#### 10. Rake check

- **Missing is not broken:** a missing item shows `Missing: <id>` and the form still creates.
- **No visible literal:** every string is a `create` key.
- **No look in a component:** parts and tokens only.
- **Edition rule in one place:** `shareRuleset` from the engine.

#### 11. What came out of it

Quality gate, 2026-11-03: `pnpm lint` 370 files, no fixes; `pnpm typecheck` clean; `pnpm test` 102 files, 1308 passed, 0 failed, 22.7 s (5 new, from 1303 on `688eb74`), then speed 2 passed; coverage statements 99.45 % (3496/3515), lines 99.9 % (3069/3072); `pnpm e2e` 47 passed, 0 failed, 49.5 s (1 new). Screenshot at 360×800 shown in the chat.

Differences from §3: none.

Found, not fixed: a starting item is never worn, so the form's AC bar ignores armor. Wearing is SHEET-50.

Changelog: "The new-character form's Equipment step adds items with a quantity and warns when an item is of the other edition or in no ticked pack."

---

### SHEET-32 The Main tab shows every check bonus

**Hat:** The Main tab shows every check bonus
**Depends on:** SHEET-30 (the frame and `SheetNumber`), ENG-13 (check totals), ENG-43 (a skill's stat is a key path)
**Size:** S
**Screen:** Yes — board `V3-Sheet` in `docs/design/mockups/`; `docs/design/BRIEF.md` Part 2 P4 (Main) and Part 5 "P4 Character sheet"
**SPEC:** §7.2 (the Main tab), §6.2 (every number has a breakdown)

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/sheet-checks.ts` — new: `fifthEditionChecks(computed)` names the stats, saves, skills and passives and their paths.
- `apps/web/src/sheet/sections/Abilities.tsx`, `SavingThrows.tsx`, `Skills.tsx` — change: filled.
- `apps/web/src/sheet/ProfDot.tsx` — new: the proficiency dot.
- `apps/web/src/systems.ts` — changes: `SheetSystem.checks`.
- `apps/web/src/locales/en/checks.json` — changes: the words.

#### 2. What is missing now

Measured on `0e8a6b4`: the three sections return `null`; the Main tab shows only the header's numbers and the conditions.

#### 3. What it should look like when done

1. Ability tiles, one per stat of the packs in their entries' order: the abbreviation, the check bonus large (`checks.<key>.total`), the score small (`abilities.<key>.score`). Golden B: STR +3 17, DEX +1 13, CON +2 15, INT −1 8, WIS +1 12, CHA +0 10.
2. Saving throws: one chip for each stat that has a save, with its proficiency dot and `abilities.<key>.save`. Golden B: STR +5, CON +4 (dots filled), the rest equal to the modifier.
3. Skills grouped under the stat each is rolled with, taken from `Computed.keys['skills.<key>.ability']`, never from the skill's own `ability`; each with its dot (none, half, proficient, expertise) and `skills.<key>.total`. Golden B: Athletics +5, Intimidation +2, Perception +3, Survival +3, Insight +3.
4. Passive values: one chip for each skill that has `skills.<key>.passive`. Golden B: Passive Perception 13.
5. Every number is a `SheetNumber`, so each has a handler for a tap (roll, SHEET-39) and a long press (breakdown, SHEET-33).
6. No pack, no stat: the sections draw nothing and nothing throws.
7. The gate is green.

#### 4. How to do it

1. `sheet-checks.ts` reads `Computed.byKey.ability` and `.skill`; a save exists where `abilities.<key>.save` is in `values`; the skill's stat is the key path's `key`; groups and skills are sorted (stat `order`, then name).
2. `SheetSystem.checks`, so the app asks the module and writes no stat or skill itself.
3. The three sections and `ProfDot`, with parts and tokens only.

Technical choices (ADR 002): the tile's large number is the check total, which equals the modifier until a d20 bonus is added, so "every check bonus" is always the one on screen; the modifier itself stays in the score's breakdown path chain. The module names the paths, as `sheet-header.ts` does for the header.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

The Main tab at 360×800, under the conditions: Abilities (six tiles in a row), Saving throws (3 × 2 chips), Skills by stat in two columns, Passive checks. Keys in `checks`: `abilities`, `score`, `saves`, `skills`, `passives`, `passive`, `prof.*`.

#### 7. Tests

- `packages/system-5e/test/sheet-checks.test.ts` — 4 tests: the stats and their paths; the groups, passive and golden B's numbers; a skill moved by an override of its stat; empty packs.
- `apps/web/test/checks.test.tsx` — 7 tests: golden B's tiles, saves, skills, dots, 37 distinct number buttons; golden A's Insight +5; no pack.
- `apps/web/e2e/sheet.spec.ts` — 1 test; the SHEET-30 test now looks for the header's passive number inside the header, since the Main tab shows it too.
- `apps/web/test/sheet.test.tsx` — the three sections joined the `filled` list.
- Control numbers from: SPEC §6.7 golden A and B (`golden-values.test.ts`, `fixtures-2024.test.ts`).

#### 8. Checked against the source

Nothing to check: no rules facts. The proficiency levels (0, 0.5, 1, 2) are `sumOf`'s own reading of `profLevel`.

#### 9. Not in this ticket

- The roll dialog: SHEET-39. The breakdown sheet: SHEET-33.
- An advantage or disadvantage mark on a skill: SHEET-39 (`skills.<key>.mode`).
- Overriding a number by hand: SHEET-34.

#### 10. Rake check

- **Everything is data:** no stat or skill key is written in the app; they come from `byKey`.
- **A shown number has a breakdown:** every number is a `SheetNumber` with a path.
- **Skill stat from the key path:** `computed.keys`, tested with an override.
- **No visible literal, no look literal:** `checks` keys; tokens and parts.

#### 11. What came out of it

Quality gate, 2026-11-03: `pnpm lint` 374 files, no fixes; `pnpm typecheck` clean; `pnpm test` 104 files, 1319 passed, 0 failed, 23.7 s (11 new, from 1308), then speed 2 passed; coverage statements 99.4 % (3524/3545), lines 99.9 % (3094/3097); `pnpm e2e` 48 passed, 0 failed, 39.3 s (1 new). Screenshots at 360×800 shown in the chat.

Differences from §3: none.

Found, not fixed: nothing.

Changelog: "The Main tab shows the six ability tiles, the saving throws, the skills grouped by their stat with proficiency dots, and passive Perception."

---

### SHEET-33 A long press opens a number's breakdown

**Hat:** A long press opens a number's breakdown
**Depends on:** SHEET-30 (`SheetNumber`, the frame's `breakdown`), SHEET-11 (the empty `BreakdownSheet`), ENG-17 (the `override` step), ENG-40 (reserved path names)
**Size:** S
**Screen:** Yes — board `V3-Roll` in `docs/design/mockups/`; `docs/design/BRIEF.md` Part 2 P5 "Sheet 2" and Part 5 "P5 Roll dialog and breakdown"
**SPEC:** §7.2, §6.2 (every number has a breakdown), §6.1 step 7 (manual edits)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/shared/BreakdownSheet.tsx` — changes: the sheet itself.
- `apps/web/src/sheet/breakdown.ts` — new: `breakdownOf`, `pathName`, `stepsAt`.
- `packages/system-5e/src/sheet-paths.ts` — new: `fifthEditionPathParts`, which parts of a path name an entry.
- `apps/web/src/systems.ts` — changes: `SheetSystem.pathParts`.
- `apps/web/src/sheet/SheetContext.ts`, `SheetNumber.tsx`, `apps/web/src/pages/SheetPage.tsx` — change: the breakdown opens with its number's format.
- `apps/web/src/shared/BottomSheet.tsx` — changes: the title wraps instead of being cut.
- `apps/web/src/locales/en/breakdown.json` — changes: the words.

#### 2. What is missing now

Measured on `240ad12`: `BreakdownSheet` returns `null`; a long press on any number opens nothing, although `SheetNumber` already calls `sheet.breakdown(path)`.

#### 3. What it should look like when done

1. A long press (500 ms) or the context menu on a `SheetNumber` opens "Where this number comes from" over the sheet; Escape, the close button and the dim close it. A tap does not.
2. Its summary line: golden B's Athletics reads `Athletics +5 = Strength modifier +3, Proficiency bonus +2`; Strength's score reads `Strength score 17 = Base 15, Soldier +2` (SPEC §6.7). Each part is also its own line with its source.
3. A zero-valued path step (a bonus slot nothing filled) is left out, unless nothing else is left.
4. An override step shows as "Manual edit", with "Replaces the computed number" and the person's note.
5. The number is written as it was on the sheet (signed, plain or a distance), because the sheet passes the number's format.
6. A path with no steps, including `toString`, `constructor` and `__proto__`, shows "No steps are kept for this number." and nothing throws: `Computed.breakdown` is read as an own field only.
7. The gate is green.

#### 4. How to do it

1. `fifthEditionPathParts(path)`: `abilities.<k>`, `checks.<k>`, `skills.<k>`, `classes.<k>` name the entry; every other segment is a word; `prof` is one word.
2. `breakdownOf` makes a line for each step kind: base, default, grant, effect, entity, condition, cap, level, formula, path (named by its parts), rule (by its name), override.
3. `BreakdownSheet` draws the summary and the lines in a `BottomSheet`.

Technical choices (ADR 002): the module says which segments of a path are keys, so the app writes no stat or skill name (D3); words for the rest are locale keys with the key's own words as the fallback, so a new rule never shows blank; the format travels with the open sheet so the breakdown never guesses it.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

A bottom sheet at 360×800 over the dimmed sheet: the title (two lines at this width), the summary, one row for each part. Empty: the "no steps" line. Keys in `breakdown`: `title`, `summary`, `summaryNone`, `separator`, `none`, `manual`, `manualHint`, `step.*`, `word.*`, `rule.*`.

#### 7. Tests

- `apps/web/test/breakdown.test.tsx` — 7 tests: Athletics' parts; the summary and lines; Strength's base and the Soldier's +2; a manual edit with its note; reserved paths; path names; Passive Perception 13.
- `packages/system-5e/test/sheet-paths.test.ts` — 3 tests.
- `apps/web/e2e/sheet.spec.ts` — 1 test: long press, context menu, a tap that opens nothing, a header number in feet.
- `apps/web/test/navigation.test.tsx` — the breakdown left the "empty pieces" list.
- Control numbers from: SPEC §6.7 golden B (Athletics +5, Strength 17 = 15 + 2, passive Perception 13).

#### 8. Checked against the source

Nothing to check: no rules facts.

#### 9. Not in this ticket

- Overriding a number by hand: SHEET-34. Pinning the AC calculation: SHEET-35.
- Opening a part's own breakdown from its line.
- The roll dialog: SHEET-39.

#### 10. Rake check

- **A shown number has a breakdown:** every `SheetNumber` opens one; a path without steps says so.
- **Manual overrides win and are labelled:** "Manual edit".
- **Everything is data:** names come from `byKey` and the module's path parts.
- **Own fields only:** `Object.hasOwn` on `breakdown` and `byKey`.
- **No visible literal:** `breakdown` keys.

#### 11. What came out of it

Quality gate, 2026-11-03: `pnpm lint` 378 files, no fixes; `pnpm typecheck` clean; `pnpm test` 106 files, 1329 passed, 0 failed, 24.2 s (10 new, from 1319), then speed 2 passed; coverage statements 99.41 % (3544/3565), lines 99.9 % (3110/3113); `pnpm e2e` 49 passed, 0 failed, 38.9 s (1 new). Screenshots at 360×800 shown in the chat.

Differences from §3: the shared sheet's title was cut ("Where this number comes …") at 360 px; it wraps now for every panel that uses `BottomSheet`.

Found, not fixed: nothing.

Changelog: "Long-press a number on the sheet to see where it comes from: each part with its source, and a manual edit marked as one."

---

### SHEET-39 Tapping a number rolls it in the roll dialog

**Hat:** Tapping a number rolls it in the roll dialog
**Depends on:** SHEET-30, SHEET-32, SHEET-37 (the roll log), SHEET-38 (the fair die and the record), SHEET-19 (`rollInitiative`), SHEET-55 (inspiration), ENG-34 (roll modes, `attackOutcome`, `criticalDamage`)
**Size:** M
**Screen:** Yes — board `V3-Roll` in `docs/design/mockups/`; `docs/design/BRIEF.md` Part 2 P5 "Sheet 1" and Part 5 "P5 Roll dialog and breakdown"
**SPEC:** §7.2, §6.5 (dice), §6.4 (rolls and modes)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/shared/RollDialog.tsx` — changes: the dialog itself.
- `apps/web/src/sheet/roll.ts` — new: the mode, the formula, the kept face, `rollTestWith`.
- `packages/system-5e/src/sheet-roll.ts` — new: `fifthEditionRollTest`, `fifthEditionSituational`.
- `apps/web/src/systems.ts` — changes: `SheetSystem` carries the test, the situational list, `rollModeOf`, `d20Formula`, `attackOutcome`, `criticalDamage`, `rollInitiative`.
- `apps/web/src/shared/dice.ts`, `DicePanel.tsx` — change: `rollWith` takes a label and a path; `Faces` is exported.
- `apps/web/src/sheet/breakdown.ts` — changes: `stepLabel` is shared with the dialog.
- `apps/web/src/locales/en/roll.json` — changes: the words.

#### 2. What is missing now

Measured on `fd2ce18`: `RollDialog` returns `null`; a tap on Athletics, a save, a skill, a stat or initiative does nothing, although `SheetNumber` already calls `sheet.roll(path)`.

#### 3. What it should look like when done

1. A tap on a number that rolls opens "Roll" over the sheet. Golden B's Athletics shows `1d20 + 5 (Athletics)` and "A straight d20".
2. The mode is the sign of every source of the number's mode path (`skills.athletics.mode`, ENG-34) and the dialog's own: the Advantage and Disadvantage switches, a situational effect switched on, and, in 2014 only, a spent inspiration. Any advantage and any disadvantage cancel. Advantage rolls `2d20kh1`, disadvantage `2d20kl1`. Golden B4's Athletics opens in advantage: `2d20kh1 + 6`, with "Remarkable Athlete: advantage" as a source; golden B's Stealth opens in disadvantage (chain mail).
3. "Roll" rolls the formula with the fair die, shows each die (a die not kept is struck through), the natural face and the total, and the button becomes "Roll again". Total = kept face + the number shown on the sheet.
4. Every roll is logged with the character as `by.actorId`, the test's name as its label and the number's path.
5. Initiative: after each roll the dialog calls `rollInitiative`, which interrupts a knock-out's short rest; its refusals (`unchanged`, `dead`) are not shown.
6. 2014: the inspiration chip appears while one is held; a roll made with it on spends one (one change with its Undo toast) and switches it off. 2024: no chip.
7. A weapon or spell attack shows "Critical hit" for a 20 or a face at or above `crit.range`, "Automatic miss" for a 1. A weapon attack offers "Roll damage", or "Roll critical damage" after a critical hit, which rolls each dice term of the damage formula twice.
8. A path that does not roll, including `toString`, shows "This number does not roll." and nothing throws.
9. The gate is green.

#### 4. How to do it

1. The module says which numbers are d20 tests and where their mode and targets are (`fifthEditionRollTest`), and which situational effects name a test's targets (`fifthEditionSituational`); the app asks through `SheetSystem` and writes no path.
2. `signsOf` joins the steps' `value`s with the dialog's own signs; `system.rollMode` decides.
3. `rollTestWith` builds `d20Formula(mode) ± number`, rolls it with `rollWith` and reads the kept face and the outcome.
4. `RollDialog` holds the switches and the last roll; logging and the two actions run after the roll.

Technical choices (ADR 002): one dialog for every kind of test, the kind decided by the module; the roll is never replayed, "Roll again" is a new roll; the damage roll is offered only for a weapon attack with a damage path.

#### 5. Stored data

Nothing stored changes. Rolls go to the existing roll log.

#### 6. What a person will see

A bottom sheet at 360×800: the formula, the two switches (and inspiration, and the situational chips), the mode in words, the sources from the sheet as chips, the result card with the dice, the natural face and a large total, "Roll"/"Roll again" and "Done". Keys in `roll`: `title`, `formula`, `advantage`, `disadvantage`, `inspiration`, `mode.*`, `source.*`, `situational`, `roll`, `again`, `done`, `outcome.*`, `rollDamage`, `rollCritical`, `damageTotal`, `doesNotRoll`, `failed`.

#### 7. Tests

- `packages/system-5e/test/sheet-roll.test.ts` — 7 tests: each test kind, a skill's stat from its key path, the greatsword attack, paths that do not roll, Remarkable Athlete's mode steps, situational effects.
- `apps/web/test/roll.test.tsx` — 13 tests: the mode with and without switches; the rolls with scripted dice (a 14 gives 19; advantage keeps the higher, disadvantage the lower); the attack outcomes; the doubled damage dice; the dialog's markup for B, B4, 2014 and 2024 inspiration, and a path that does not roll.
- `apps/web/e2e/sheet.spec.ts` — 4 tests: a real roll (total = face + 5, the advantage pair, the log holds 2 rolls), Remarkable Athlete's source, initiative's interruption with its toast, 2014 inspiration spent; the SHEET-33 test now expects a tap to open the roll dialog.
- Control numbers from: SPEC §6.7 golden B (Athletics +5, greatsword 2d6, Strength +3 and proficiency +2 to hit), golden B4 (Athletics +6, advantage), golden A.

#### 8. Checked against the source

- SRD 5.1 and 5.2.1, "Advantage and Disadvantage": any advantage and any disadvantage cancel, however many of each (ENG-34 §8, which this ticket reads, not re-derives).
- Inspiration: 2014's gives advantage (`rulesOf(...).inspiration.use`, ENG-59); 2024's rerolls a die, which this ticket does not do.

#### 9. Not in this ticket

- "I roll myself" in the dialog: the dice panel counts typed faces (SHEET-38); the dialog always rolls with the fair die.
- 2024's heroic inspiration reroll.
- Situational numeric bonuses; only advantage and disadvantage ones are offered.
- "Send to DM" and "Secret to DM": the table link (ADR 005 item 6).
- The Combat tab's attack rows (SHEET-44), the death save tracker (SHEET-43) and the cast panel (SHEET-47), which open this dialog with their own paths.

#### 10. Rake check

- **Everything is data:** no stat, skill or path name in the app; the module names the tests.
- **A rule in one place:** the cancelling rule is `rollModeOf`, the outcome `attackOutcome`, the doubling `criticalDamage`.
- **Missing is not broken:** a path that does not roll says so.
- **No visible literal, no look literal:** `roll` keys; parts and tokens.
- **No external request:** the die is the platform's.

#### 11. What came out of it

Quality gate, 2026-11-03: `pnpm lint` 382 files, no fixes; `pnpm typecheck` clean; `pnpm test` 108 files, 1348 passed, 0 failed, 23.5 s (19 new, from 1329; the navigation test of empty pieces left), then speed 2 passed; coverage statements 99.27 % (3585/3611), lines 99.87 % (3146/3150); `pnpm e2e` 53 passed, 0 failed, 42.7 s (4 new). Screenshots at 360×800 shown in the chat.

Differences from §3: none.

Found, not fixed:
- The dialog does not honor the setting "I roll myself" (§9): a person with it on still gets a fair roll here. Own row needed.
- An `<output>` has the role `status`, as the toast does; the e2e finds the toast by its text.

Changelog: "Tap an ability, save, skill or initiative on the sheet to roll it: the d20 of its mode (advantage, disadvantage, inspiration in 2014), the dice shown, the total, every roll kept in the log."

---

### SHEET-36 The choices badge opens every pending choice

**Hat:** The choices badge opens every pending choice
**Depends on:** SHEET-30 (the badge and the panel's place), ENG-11 and ENG-48 (`pendingChoices`, `pendingKeys`), SHEET-23 (Undo)
**Size:** M
**Screen:** Yes — board `V3-Sheet` in `docs/design/mockups/` (the `[!1]` badge); `docs/design/BRIEF.md` Part 2 P4 and Part 5 "P4 Character sheet"
**SPEC:** §7.2 "What needs choosing", §8.2 (an unmade choice is a pending choice, not an error)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/panels/ChoicesPanel.tsx` — changes: the panel itself.
- `apps/web/src/sheet/choices.ts` — new: picks needed, names, the entry a pick makes.
- `packages/system-5e/src/sheet-choices.ts` — new: `fifthEditionPendingKey`, where a pending key's answer is stored.
- `apps/web/src/systems.ts` — changes: `SheetSystem.pendingKey`.
- `apps/web/src/locales/en/choices.json`, `toast.json`, `breakdown.json` — change: the words, the toast `setChoice`, the word "size".
- `apps/web/test/sheet.test.tsx`, `toast.test.tsx` — change: the panel left the empty list; `setChoice` joined the sheet's actions.

#### 2. What is missing now

Measured on `836ad78`: `ChoicesPanel` returns `null`; the header's badge counts `pendingChoices.length + pendingKeys.length` and opens nothing.

#### 3. What it should look like when done

1. Tapping the badge opens "What needs choosing". Golden B with its seven choices taken out and its size taken out shows 8 sections, as the badge says: `!8`.
2. Each grant's pending choice shows the entry that gives it ("Fighter", "Soldier"), what it gives ("Skill proficiency: choose 2 more"), the picks made as chips (tap one to take it back) and the options left, each named from the packs. Soldier's ability scores also say they give +2 +1 or +1 +1 +1 "in the order you pick".
3. A pick is stored as `choices[<part>]`, the picks in the order made; taking back the last one removes the stored choice (the schema holds no empty list). Each is one change with its Undo toast "Choice made".
4. A pending key, the size of a species that offers several (Small or Medium for the 2024 human), is answered from its list and stored where the module keeps it, `systemData.species.size`; a key the module cannot answer says so and its options are off.
5. Picks show on the sheet at once: Survival goes from +1 to +3 when the fighter picks it; Undo brings +1 back and the badge its count.
6. Nothing pending: "Nothing is left to choose."; an entry a pack no longer has shows "Missing: <id>".
7. The gate is green.

#### 4. How to do it

1. `fifthEditionPendingKey(path)` gives the entry type that names a key and the change that stores it; only `size` today.
2. `choices.ts`: `picksOf` (the count, or the longest pattern's), `picksLeft`, `patternsOf`, `pickName` (an entry's name, else the key's name among the entries of the grant's type, else the key's words), `choiceEntry`, `storedPicks`.
3. The panel lists `computed.pendingChoices`, then `computed.pendingKeys`.

Technical choices (ADR 002): each pick is written at once, not collected and confirmed, so Undo is per pick and a half-made choice stays visible; the answer of a pending key is the module's, as ENG-48 decided (the size is not in `choices`); a part's source entry is read from the part id's text before `#`.

#### 5. Stored data

Nothing stored changes. `choices` and `systemData.species.size` exist.

#### 6. What a person will see

A bottom sheet at 360×800: a section for each pending choice with its heading, a grey line, picked chips, then the options as 44 px rows. Keys in `choices`: `title`, `nothing`, `need`, `needOne`, `cannotAnswer`, `patterns`, `picked`, `pick`, `remove`, `missing`, `kind.*`.

#### 7. Tests

- `apps/web/test/choices.test.tsx` — 11 tests: nothing left; golden B's seven choices pending; what a choice gives and its options; a pick made as a chip; the size as a pending key; the entry a pick makes, the removal of the last one, own-field reading, the module's answer for the size; the counts, the patterns and the names.
- `apps/web/e2e/sheet.spec.ts` — 1 test: `!8`, the panel, a size pick, two skill picks, the badge's count, Survival +3, Undo.
- Control numbers from: SPEC §6.7 golden B (its seven choices; Wisdom 12; proficiency +2) and SRD 5.2.1's background ability score patterns.

#### 8. Checked against the source

SRD 5.2.1, Backgrounds: the ability score increase is +2 and +1, or +1 to each of three of its scores (the grant's `patterns`, ENG-37).

#### 9. Not in this ticket

- A jump from each choice to the place it affects: the choice is answered in the list.
- Changing a choice already made that is no longer pending: the About tab and later rows.
- Level-up choices: phase 4.

#### 10. Rake check

- **Missing is not broken:** a missing entry shows "Missing: <id>"; an unmade choice is listed, not an error.
- **A person's saved data:** each pick is a logged, undoable change.
- **Everything is data:** names from the packs; the size's place is the module's.
- **No visible literal:** `choices` keys.

#### 11. What came out of it

Quality gate, 2026-11-03: `pnpm lint` 385 files, no fixes; `pnpm typecheck` clean; `pnpm test` 109 files, 1359 passed, 0 failed, 24.9 s (11 new, from 1348), then speed 2 passed; coverage statements 99.28 % (3590/3616), lines 99.87 % (3150/3154); `pnpm e2e` 54 passed, 0 failed, 47.3 s (1 new). Screenshot at 360×800 shown in the chat.

Differences from §3: none.

Found, not fixed: with the choices badge in the header, the class line is cut to "Fig…" at 360 px. The header's layout is SHEET-30's.

Changelog: "The choices badge on the sheet opens a list of every choice still to make; each is answered in place, with Undo."

---

### SHEET-48 The Features tab groups features by source

**Hat:** The Features tab groups features by source
**Depends on:** SHEET-30 (the tab's place), SHEET-31 (descriptions in place), SHEET-20 (`recoveryOf`), ENG-17 (uses, switches), SHEET-23 (Undo)
**Size:** M
**Screen:** Yes — board `V3-Features` in `docs/design/mockups/`; `docs/design/BRIEF.md` Part 2 P4 (Features) and Part 5 "P4 Character sheet"
**SPEC:** §7.2 (the Features tab); ADR 009 item 2

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/sections/FeatureList.tsx` — changes: the tab itself.
- `packages/system-5e/src/sheet-features.ts` — new: `fifthEditionFeatures`, the groups.
- `apps/web/src/systems.ts` — changes: `SheetSystem.features`.
- `apps/web/src/locales/en/features.json` — changes: the words.

#### 2. What is missing now

Measured on `65dec65`: `FeatureList` returns `null`; the Features tab is empty.

#### 3. What it should look like when done

1. Golden B's tab shows three cards in this order: Human (species), Fighter (class · level 1) and Soldier (background); golden A's shows Dwarf (race), Cleric and Acolyte.
2. A feature a feature gives, or a feat a feature gives, stays in the card of the one that gave it: Versatile's Alert is in Human's card, Soldier's Savage Attacker in Soldier's, Fighting Style's Defense in Fighter's. A lineage's traits (Hill Dwarf's Dwarven Toughness) are in the species' card; a subclass's features (Life's Disciple of Life) are in its class's card.
3. The class card names its subclass on the line below: "Subclass: Life" for golden A, "Subclass: chosen at level 3" for golden B (the level is the class entry's `subclassLevel`).
4. The character's own feats (`systemData.feats`) are a last card, "Feats".
5. Each feature opens its description in place (SHEET-31).
6. A feature with uses shows one circle for each use (filled while left), "2 of 2 left" and a "Use" button, which is disabled with none left. Second Wind reads "1 back on a short rest, all on a long rest" (SRD 5.2.1); the count is a number with its own breakdown path. A use is one change with its Undo toast.
7. A feature with a toggled effect shows its switch in its stored state, else its default; a tap is one change with its Undo toast.
8. No feature at all: "No features yet."
9. The gate is green.

#### 4. How to do it

1. The module finds each feature's root: it follows `HadEntity.from` up to the first entity the character itself names, and maps that entity's type to a group; items and spells have none.
2. Each row carries the resource keys its entity's grants give and its toggled effects, so the screen asks nothing else.
3. The tab reads names from the gathered entities, so a character's own entries show too (they are not in the packs).

Technical choices (ADR 002): the grouping rule is the module's, since the group kinds are fifth edition's; a use and a switch are the core's actions (`useResource`, `setToggle`) run through `perform`; more than 12 uses show the number alone.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Cards at 360×800, each with its name, a grey source line, and rows that open in place; Second Wind's circles, count and "Use" under its row. Keys in `features`: `none`, `missing`, `separator`, `group.*`, `source.*`, `subclass.*`, `left`, `use`, `useButton`, `recovery.*`.

#### 7. Tests

- `packages/system-5e/test/sheet-features.test.ts` — 7 tests: golden B's groups and rows, Alert with Versatile, Second Wind's resource, the subclass level; golden A's lineage and subclass; a made-up feat's own group with its switch; no group at all.
- `apps/web/test/features.test.tsx` — 8 tests: both goldens' headings and source lines, the subclass line, Second Wind's circles and recovery text, a use spent and none left, a switch stored and by default, no features.
- `apps/web/e2e/sheet.spec.ts` — 1 test: the groups, a use and its Undo, a description opened, a switch.
- Control numbers from: SPEC §6.7 golden A and B and the SRDs' class tables (Fighter's subclass at level 3, Second Wind's 2 uses).

#### 8. Checked against the source

SRD 5.2.1, Fighter: Second Wind, two uses at level 1, one use back on a short rest and all on a long rest; subclass at level 3. SRD 5.1, Cleric: the Divine Domain at level 1.

#### 9. Not in this ticket

- Regaining a single use by hand: a rest gives them back (SHEET-45).
- Each feature's action timing and "Always on": the Turn tab (SHEET-49).
- Features of an item or a spell: the Gear and Spells tabs.
- Custom features written as text: SHEET-52.

#### 10. Rake check

- **Everything is data:** names from the packs and the character's entries; the groups from `from`.
- **Missing is not broken:** an id that is not gathered shows "Missing: <id>".
- **A shown number has a breakdown:** the recovery count is a `SheetNumber`.
- **No visible literal, no look literal:** `features` keys; tokens and parts.

#### 11. What came out of it

Quality gate, 2026-11-03: `pnpm lint` 388 files, no fixes; `pnpm typecheck` clean; `pnpm test` 111 files, 1374 passed, 0 failed, 22.8 s (15 new, from 1359), then speed 2 passed; coverage statements 99.15 % (3644/3675), lines 99.81 % (3199/3205); `pnpm e2e` 55 passed, 0 failed, 45.0 s (1 new). Screenshots at 360×800 shown in the chat.

Differences from §3: none. The first draft read each feature from the packs' index, which has no character's own entries; it reads the gathered entities now (a test caught it).

Found, not fixed: nothing.

Changelog: "The Features tab groups features under the species, each class with its subclass, the background and your own feats; each opens its description, and uses and switches work in place."

---

### SHEET-50 The Gear tab equips items

**Hat:** The Gear tab equips items
**Depends on:** SHEET-30 (the tab's place), SHEET-31 (descriptions in place), SHEET-18 and SHEET-63 (attunement warnings), SHEET-22 (`withDropped`), ENG-44 (worn items), ENG-63 (the inventory's rows), SHEET-23 (Undo)
**Size:** M
**Screen:** Yes — board `V3-Sheet` in `docs/design/mockups/`; `docs/design/BRIEF.md` Part 2 P4 (Equipment) and Part 5 "P4 Character sheet"
**SPEC:** §7.2 (the Equipment tab), §7.5 (stored units are pounds)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/sections/Items.tsx` — changes: the tab itself.
- `packages/system-5e/src/inventory.ts` — new: `setRowEquipped`, `setRowAttuned`, `setRowQuantity`, `setRowContainer`, `removeRow`.
- `packages/system-5e/src/sheet-gear.ts` — new: `fifthEditionGear`, the rows in order, the weight, the rules broken.
- `apps/web/src/sheet/SwitchRow.tsx` — new: the labelled switch; the Features tab (SHEET-48) uses it too.
- `apps/web/src/settings/units.ts` — changes: `shownWeight`.
- `apps/web/src/systems.ts` — changes: `SheetSystem.gear` and the five actions.
- `apps/web/src/locales/en/gear.json`, `toast.json` — change: the words, five toast keys.

#### 2. What is missing now

Measured on `328abaa`: `Items` returns `null`; the Gear tab shows nothing but the coins' empty place; no code turns a row's `equipped` or `attuned` on from the sheet.

#### 3. What it should look like when done

1. The tab lists the inventory in the order kept: golden B shows Chain Mail ×1 · 55 lb and Greatsword ×1 · 6 lb, and "Carrying 61 lb" (SRD 5.2.1 weights). Each row opens its description in place.
2. A "Worn" switch on each item row. Taking golden B's chain mail off changes the header's AC from 17 to 11 (10 + Dexterity 1, SPEC §6.7) at once; Undo puts 17 back.
3. An "Attuned" switch on a row whose item asks for attunement (or is attuned). A fourth attunement is never refused: the tab warns in amber, "Attuned to 4 magic items: no more than 3 at a time"; so does a second armor worn.
4. A quantity stepper (a whole number from 1); the weight follows: a row weighs its item's weight times its quantity, a custom row its own.
5. "Kept in": a row may be put inside another row, drawn under it and indented, with "N inside" on the container; never inside itself or inside what it holds. Its weight still counts.
6. A remove button: the row goes, the rows inside it go to where it was, and what its item gave that no longer applies goes with it (`withDropped`). Undo brings the row back.
7. A row whose item no pack holds shows "Missing: <id>" and can still be removed; an empty inventory says "Nothing is carried."
8. Every change is one change with its toast and Undo. Weight shows in pounds or, with the setting, in kilograms to a tenth.
9. The gate is green.

#### 4. How to do it

1. The module's five actions write the whole inventory list as one change (ENG-63: a log path steps only through objects); `removeRow` ends with `withDropped`.
2. `fifthEditionGear` walks the rows, each under its container, sums the weight and gives the equipment's warnings (`attunementLimit`, `attunementCopies` as character rules, `oneAtATime` as a step rule).
3. The tab runs each action through `perform`, with the row's name as the entry's label.

Technical choices (ADR 002): a row taken away puts its contents where it was, not away with it, since a person who drops a backpack still holds what was in it; any row may be a container, as the stored shape says; the kilogram is the pound's own definition, 0.45359237 kg, since the SRDs give no table rate for weight as they do for distance.

#### 5. Stored data

Nothing stored changes. `inventory` and its row shape exist (ENG-63).

#### 6. What a person will see

A card at 360×800 headed "Items" with "Carrying 61 lb", amber warnings, and for each row its name and "×1 · 55 lb", then Worn, Attuned (when it applies), How many with − and +, "Kept in" with its list and a remove button. Keys in `gear`: `title`, `none`, `missing`, `carrying`, `weight.*`, `qty`, `inside`, `worn`, `attuned`, `quantity`, `less`, `more`, `keptIn`, `noContainer`, `remove`, `warn.*`; in `toast`: `setEquipped`, `setAttuned`, `setQuantity`, `moveItem`, `removeItem`.

#### 7. Tests

- `packages/system-5e/test/inventory.test.ts` — 15 tests: the view, with weights, nesting and the rules broken; each action with Undo, refusals and `unchanged`; AC 17 → 11 with the armor off; removing a row with its contents moved.
- `apps/web/test/gear.test.tsx` — 10 tests: golden B's rows, weights and switches; a nested row; the attunement switch, the amber warning, a missing row, the empty tab; kilograms.
- `apps/web/e2e/sheet.spec.ts` — 1 test: AC 17 → 11 → 17, a charm's attunement (+1), a quantity, a container, a removal with Undo.
- Control numbers from: SPEC §6.7 golden B (AC 17, 11 unarmored), SRD 5.2.1's chain mail (55 lb) and greatsword (6 lb), and the pound's definition (61 lb = 27.7 kg, 55 lb = 24.9 kg, 6 lb = 2.7 kg).

#### 8. Checked against the source

- SRD 5.1 and 5.2.1, Attunement: three items at a time, and one copy of an item (SHEET-18 §8, SHEET-63 §8, which this ticket reads).
- SRD 5.1 and 5.2.1, armor: one armor and one shield at a time (ENG-44 §8).
- Weights: the packs' own (`srd-2024.ts`), which the ticket reads, not re-types.
- The kilogram: no SRD rate; the international pound is exactly 0.45359237 kg.

#### 9. Not in this ticket

- Adding an item from the packs after creation: the library (phase 3); a free-text item: SHEET-52.
- Coins: SHEET-51.
- A capacity for a container, or the encumbrance rules.
- Which weapon is held in which hand.

#### 10. Rake check

- **Stored units are pounds:** conversion only on screen (`shownWeight`).
- **A person's saved data:** every change is logged and undoable; a refused action writes nothing.
- **Missing is not broken:** a missing item shows its id and can be removed.
- **Rules warn, never block:** attunement and armor limits are amber lines.
- **No visible literal, no look literal:** `gear` keys; parts and tokens.

#### 11. What came out of it

Quality gate, 2026-11-03: `pnpm lint` 393 files, no fixes; `pnpm typecheck` clean; `pnpm test` 113 files, 1399 passed, 0 failed, 26.3 s (25 new, from 1374), then speed 2 passed; coverage statements 99.09 % (3724/3758), lines 99.81 % (3267/3273); `pnpm e2e` 56 passed, 0 failed, 45.8 s (1 new). Screenshots at 360×800 shown in the chat.

Differences from §3: none.

Found, not fixed: a person cannot add a pack item to a character after it is made, except by the form (SHEET-28) or a file. The library's "Add to character" belongs to phase 3.

Changelog: "The Gear tab lists what you carry with its weight; switch an item worn or attuned and AC and attacks change at once, set how many, put an item inside another, or remove it, each with Undo."

---

### SHEET-46 The Spells tab shows the slot grid

**Hat:** The Spells tab shows the slot grid
**Depends on:** SHEET-30 (the tab's place, the header's casting row), SHEET-31 (descriptions in place), SHEET-28 (the edition note of ENG-49), ENG-57 (a granted spell's own uses), ENG-20 (`spendSlot`, `regainSlot`), SHEET-23 (Undo)
**Size:** M
**Screen:** Yes — board `V3-Spells` in `docs/design/mockups/`; `docs/design/BRIEF.md` Part 2 P4 (Spells) and Part 5 "P4 Character sheet"
**SPEC:** §7.2 (the Spells tab); ADR 010 items 9 and 10, ADR 009 item 4

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/sections/SpellList.tsx` — changes: the tab itself.
- `packages/system-5e/src/sheet-spells.ts` — new: `fifthEditionSpells`: the slot columns, the class lists, the granted spells.
- `apps/web/src/systems.ts` — changes: `SheetSystem.spells`, `spendSlot`, `regainSlot`.
- `apps/web/src/locales/en/spells.json` — changes: the words.

#### 2. What is missing now

Measured on `0272d8f`: `SpellList` returns `null`; the Spells tab is empty, though the header already shows a caster's DC and attack.

#### 3. What it should look like when done

1. At the top, spellcasting at a glance for each casting class: "Cleric · WIS", Save DC and Attack, each a number with its breakdown; golden A shows Save DC 13 and Attack +5 (SPEC §6.7). The attack rolls (SHEET-39).
2. The slot grid: a column for each spell level the character has slots of, two circles to a row, filled while one is left, "N of M left" under it. Golden A has one column, Level 1, two circles; golden C (wizard 3, paladin 3) has Level 1 with four and Level 2 with three (SRD 5.1's multiclass table). Pact magic's slots are a column of their own, "Pact · level N".
3. A tap on a filled circle spends a slot, on a hollow one gives one back; each is one change with its Undo toast.
4. Each class or subclass the character stores spells for is a card with "Prepared" and "Known" (a known spell that is not prepared), sorted by level and name; a cantrip is "Cantrip".
5. Spells the features grant are a card "From your features": golden A's Bless and Cure Wounds read "Level 1 · from Life · always prepared".
6. A granted spell with uses of its own reads "Level 1 · 1/LR · no spell slot · from <source>" and "1 of 1 uses left", the uses being the resource of its grant's key.
7. Every spell shows its edition when the character mixes editions or the spell is of the other one; a spell of the other edition warns in amber (with mixing on or off). A spell no pack holds, or a class that is not there, shows "Missing: <id>".
8. Each spell opens its description in place (SHEET-31). A character who casts nothing: "No spells yet."
9. The gate is green.

#### 4. How to do it

1. `fifthEditionSpells` reads the slot maximums at `slotsPath(level)` and pact's two paths, the spent counts from the trackers, the stored lists, and the `spell` grants `compute()` reached (`fixed` and chosen).
2. The tab reads each spell through the character's finder (its own entries first, then the packs).
3. Slots run `spendSlot` and `regainSlot` through `perform`.

Technical choices (ADR 002): a circle is a button, with a hit area of 44 px around a 28 px circle; the grant's own uses are told apart by its key, as ENG-57 §11 says; the "Cast" button is not here: it opens the cast panel (SHEET-47).

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Cards at 360×800: Spellcasting, Spell slots, one card for each class with spells, From your features. Keys in `spells`: `none`, `missing`, `casting`, `castingOf`, `saveDc`, `attack`, `slots`, `level`, `pact`, `slotsLeft`, `spend`, `regain`, `cantrip`, `prepared`, `known`, `granted`, `from`, `alwaysPrepared`, `noSlot`, `limit`, `or`, `usesLeft`, `separator`, `recovery.*`, `otherRuleset`, `otherRulesetNotMixing`.

#### 7. Tests

- `packages/system-5e/test/sheet-spells.test.ts` — 8 tests: golden A's column, a spent slot, a multiclass caster's four and three, spent never above the maximum, pact magic's column, no slots, the Life domain's granted spells, the stored lists, a grant's own uses by key.
- `apps/web/test/spells.test.tsx` — 10 tests: golden A's glance, slots and granted spells; a spent slot; golden C's columns; the lists' order; the edition warnings with mixing on and off; missing ids; a spell with uses of its own; no spells.
- `apps/web/e2e/sheet.spec.ts` — 1 test: DC 13 and +5, the grid, a tap that spends and Undo, a tap that gives back, a description opened.
- Control numbers from: SPEC §6.7 golden A (DC 13, attack +5, 2 slots), SRD 5.1's multiclass spellcaster table (caster level 4: four level 1 and three level 2 slots).

#### 8. Checked against the source

SRD 5.1, Multiclassing, "Spell Slots": the caster level is the full casters' levels plus half the half casters', rounded down: 3 + 1 = 4 for golden C; level 4 has four first-level and three second-level slots. SRD 5.1, Cleric: two first-level slots at level 1; the Life domain's Bless and Cure Wounds are always prepared.

#### 9. Not in this ticket

- Casting: the cast panel and its "Don't use a spell slot" (SHEET-47).
- Preparing and learning spells: phase 4's level-up and the library.
- Slots a magic item gives: they come into the grid when an effect adds to the level's slots; no pack has one yet.
- The 2024 pack holds no spell yet (phase 3).

#### 10. Rake check

- **Everything is data:** levels, names and ownership from `Computed` and the packs; no spell or class is written in the app.
- **A shown number has a breakdown:** DC and attack are `SheetNumber`s.
- **Missing is not broken:** a missing spell or owner says so.
- **A person's saved data:** a slot tap is a logged, undoable change.
- **No visible literal, no look literal:** `spells` keys; parts and tokens.

#### 11. What came out of it

Quality gate, 2026-11-03: `pnpm lint` 396 files, no fixes; `pnpm typecheck` clean; `pnpm test` 115 files, 1417 passed, 0 failed, 26.9 s (18 new, from 1399), then speed 2 passed; coverage statements 99.1 % (3746/3780), lines 99.81 % (3285/3291); `pnpm e2e` 57 passed, 0 failed, 45.6 s (1 new). Screenshot at 360×800 shown in the chat.

Differences from §3: none.

Found, not fixed: nothing.

Changelog: "The Spells tab shows spellcasting at a glance, the slot grid (tap a circle to spend or give back a slot), each class's prepared and known spells and the spells your features grant, with their edition."

---

### SHEET-41 Concentration shows until it ends · XS

**Hat:** The Combat tab shows the concentration until it ends
**Where:** `apps/web/src/sheet/sections/Concentration.tsx` — the section SHEET-30 left empty; `packages/system-5e/src/casting.ts` — `concentrationOf`; `apps/web/src/systems.ts` — `SheetSystem.concentration`, `endConcentration`
**Depends on:** SHEET-30 (the section's place), SHEET-31 (descriptions in place), SHEET-23 (Undo), ENG-20 (`endConcentration`)
**Screen:** Yes — the Combat tab of `docs/design/BRIEF.md` Part 2 P4 ("concentration"); board `V3-Sheet` draws only the Main tab, so the card follows the other tabs' cards. SPEC §6.4, §7.2.

**What it should look like when done:**
1. A character whose stored state names a spell it concentrates on sees a card "Concentration" on the Combat tab: the spell's name, opening its description in place, with "Level 1" (or "Cantrip") under it, and a button "End concentration".
2. The card shows until the concentration ends: no spell held, no card.
3. "End concentration" is one change with its "Undo" toast, "Concentration ended"; Undo brings the card back.
4. A spell no pack holds reads "Missing: <id>" and can still be ended (SPEC §8.2).
5. The gate is green.

**Tests:** `apps/web/test/concentration.test.tsx` — 3 tests: Bless held by golden A (SPEC §6.7, a 2014 cleric 1), nothing held, a missing spell; `packages/system-5e/test/casting.test.ts` — 1 test: `concentrationOf` names the spell or none; `apps/web/e2e/sheet.spec.ts` — 1 test: the card, End, the toast, Undo. Control values: Bless is level 1 and a concentration spell in SRD 5.1.
**What came out of it:**
Quality gate, 2026-11-04: `pnpm lint` 397 files, no fixes; `pnpm typecheck` clean; `pnpm test` 116 files, 1421 passed, 0 failed, 26.8 s (4 new, from 1417), then speed 2 passed; coverage statements 99.1 % (3747/3781), lines 99.81 % (3286/3292); `pnpm e2e` 58 passed, 0 failed, 53.0 s (1 new). Screenshot at 360×800 shown in the chat.

Differences from the row: none. Technical choices (ADR 002): no confirmation on "End concentration" (SPEC asks one only for a new concentration replacing the old one, SHEET-47); the card is hidden, not an empty line, when nothing is held; the sheet reads the held spell through the module (`concentrationOf`), not from the stored shape.

Found, not fixed: nothing.

Changelog: "The Combat tab shows the spell you concentrate on until it ends, with a button to end it (and Undo)."

---

### SHEET-42 Conditions are set from the sheet

**Hat:** The sheet sets and ends a condition
**Depends on:** SHEET-30 (the section's place), SHEET-31 (descriptions in place), SHEET-23 (Undo), SHEET-61 (a condition the character is immune to), ENG-69 (`setConditionLevel`), ENG-67 (exhaustion at its highest level is death)
**Size:** S
**Screen:** Yes — board `V3-Sheet` in `docs/design/mockups/` ("No conditions", "Add"); `docs/design/BRIEF.md` Part 2 P4 (Combat: conditions) and Part 5 "P4 Character sheet"
**SPEC:** §7.2 (the conditions on the sheet), §8.2 (missing is not broken)

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/sections/Conditions.tsx` — changes: the section on Main and Combat.
- `apps/web/src/sheet/panels/ConditionPanels.tsx` — new: one condition's panel, and the list to add from.
- `packages/system-5e/src/sheet-conditions.ts` — new: `fifthEditionConditions`, `conditionsToAdd`, `fatalLevelOf`.
- `packages/system-5e/src/conditions.ts` — changes: `removeConditionOf`, the core's `removeCondition` with this module.
- `apps/web/src/systems.ts` — changes: `SheetSystem.conditions`, `conditionsToAdd`, `fatalLevel`, `setConditionLevel`, `removeCondition`.
- `apps/web/src/locales/en/conditions.json` — changes: the words.

#### 2. What is missing now

Measured on `be02a01`: `Conditions` returns `null`; the sheet shows none, and a person cannot set or end one.

#### 3. What it should look like when done

1. The card "Conditions" with an "Add" button; with none it says "No conditions" (board V3-Sheet).
2. A chip for each condition the character has, in the order stored, then the ones given: "Exhaustion 2" for a condition with levels, the name alone for one without.
3. "Add" opens "Add a condition": every condition entry of the packs and of the character's own not stored yet, own first. A tap stores it at level 1 (`setConditionLevel`), with the toast "Exhaustion applied" and Undo. A condition of the other edition shows its edition and warns in amber (mixing on or off).
4. A chip opens its panel: the description in place, the levels 1 to its highest (the current one marked), and "Remove" (`removeCondition`: "Exhaustion ended", Undo). A level tap is one change (`setConditionLevel`), so a level that kills ends every attunement in the same entry (ENG-69).
5. Exhaustion at its highest level (6 in both editions) is death and gives no number: the chip reads "Exhaustion · death", its level button "6 · death", and the panel says "Exhaustion at this level is death. It gives no number."
6. A condition another entry gives (not stored) has a chip too; its panel names what gives it and has no level buttons and no "Remove". A condition `compute()` withholds (SHEET-61) reads "<name> · no effect", with the reason in its panel.
7. A stored condition no pack holds reads "Missing: <id>" and can still be removed.
8. The gate is green.

#### 4. How to do it

1. `fifthEditionConditions` reads the stored list and `computed.entities`: the stored ones in order (found, or missing), then the given ones with the entries that give them, from each entity's `from`.
2. `removeConditionOf` is the core's `removeCondition` with `fifthEditionModule`.
3. The section holds which panel is open; both panels run the module's actions through `perform`.

Technical choices (ADR 002): a panel stays open after a level tap, so the person steps through levels; it closes after "Add" and "Remove"; a given condition is not changed here, as nothing stored holds it; which condition is death is the module's (`fatalLevelOf`: key `exhaustion` with more than one level, ENG-67), not the app's.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Cards at 360×800: Conditions with its chips, a bottom panel for a condition, a bottom panel to add. Keys in `conditions`: `title`, `none`, `add`, `addTitle`, `noneToAdd`, `missing`, `chipLevel`, `chipDeath`, `chipNoEffect`, `levelHeading`, `levelDeath`, `setLevel`, `remove`, `immune`, `death`, `givenBy`, `givenByRule`, `and`, `otherRuleset`, `otherRulesetNotMixing`.

#### 7. Tests

- `packages/system-5e/test/sheet-conditions.test.ts` — 9 tests: none; a stored condition without levels; exhaustion 2 and 5 against 6 (death); `fatalLevelOf`; a given condition with what gives it; an immune one; a missing one; the list to add; removing a stored one whether or not a pack holds it.
- `apps/web/test/conditions.test.tsx` — 8 tests: "No conditions" and "Add"; "Exhaustion 2" and the death chip; a missing chip; the panel's six levels; the death note; a missing condition's panel; the list to add and its empty state; the other-edition warning.
- `apps/web/e2e/sheet.spec.ts` — 1 test: add Exhaustion, raise it to 3, to 6 (death), Undo, Remove, Undo.
- Control values: the 2024 pack's Exhaustion has `maxLevel: 6` (ENG-10's fixture, SRD 5.2.1 "You die if your Exhaustion level is 6"); every other condition is made up.

#### 8. Checked against the source

SRD 5.2.1, Exhaustion: level 6 is death; SRD 5.1, Conditions, "Exhaustion": the table's level 6 is "Death" (ENG-67 §8 has both). Nothing else rests on a rule.

#### 9. Not in this ticket

- Conditions' text and effects for the other conditions: phase 3's content. The built-in packs hold only the 2024 Exhaustion today, so that is the one the list offers.
- A timer on a condition (end of turn, one minute): not in the stored shape; later.
- Changing a given condition: end what gives it.

#### 10. Rake check

- **Everything is data:** conditions, levels and names come from entries; the one rule the app needs, which level is death, is the module's.
- **Missing is not broken:** a stored condition no pack holds is shown and can be removed.
- **A shown number has a breakdown:** the section shows levels, not computed numbers.
- **A person's saved data:** every change is a logged, undoable entry.
- **No visible literal, no look literal:** `conditions` keys; parts and tokens.

#### 11. What came out of it

Quality gate, 2026-11-04: `pnpm lint` 401 files, no fixes; `pnpm typecheck` clean; `pnpm test` 118 files, 1438 passed, 0 failed, 25.9 s (17 new, from 1421), then speed 2 passed; coverage statements 99.11 % (3790/3824), lines 99.81 % (3322/3328); `pnpm e2e` 59 passed, 0 failed, 52.1 s (1 new). Screenshot at 360×800 shown in the chat.

Differences from §3: none.

Found, not fixed: a bottom panel covers the Undo toast (the panel sits above it), so a change made inside a panel is undone only after the panel is closed; SHEET-36's panel has the same fault. New row SHEET-71. The built-in 2014 pack holds no condition (only the 2024 Exhaustion): phase 3 (CONT) fills it.

Changelog: "Conditions can be added to the character from the sheet and ended, each with its level and description; exhaustion at its highest level says it is death."

---

### SHEET-40 The number pad changes the hit points

**Hat:** The number pad changes the hit points
**Depends on:** SHEET-30 (the dock's Damage and Heal, the pad's place), SHEET-23 (Undo), SHEET-39 (the roll dialog), SHEET-41 (the concentration), ENG-20 (`applyDamage`, `applyHealing`, `setTempHp`, `endConcentration`), ENG-65 (the knock-out)
**Size:** M
**Screen:** Yes — boards `V3-Keypad` and `V3-TempHP` in `docs/design/mockups/`; `docs/design/BRIEF.md` Part 2 P6 and Part 5 "P6 Damage, healing and rests"
**SPEC:** §6.4 (hit points, concentration), §7.2; ADR 010 item 6, ADR 013 item 1

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/panels/NumberPad.tsx` — changes: the pad, empty since SHEET-30.
- `packages/system-5e/src/sheet-hit-points.ts` — new: `knockOutOffered`, `concentrationSavePath`.
- `apps/web/src/systems.ts` — changes: `SheetSystem.applyDamage`, `applyHealing`, `setTempHp`, `knockOutOffered`, `concentrationSave`.
- `apps/web/src/locales/en/numberPad.json` — changes: the words.

#### 2. What is missing now

Measured on `0673a76`: `NumberPad` returns `null`; the dock's Damage and Heal open nothing, so a person cannot change the hit points from the sheet.

#### 3. What it should look like when done

1. The dock's Damage and Heal open one pad with three modes, "Damage", "Heal" and "Temp HP", the mode of the button first; the person can switch (board V3-Keypad).
2. The pad shows the hit points before and after the amount typed, "12 / 12 → 7 / 12", the temporary ones in their own colour, "+5" (ADR 013 item 1, board V3-TempHP), and the amount in large type.
3. Twelve keys: 1 to 9, "C" (clear), 0, delete the last digit; at most four digits.
4. The apply button is named by the mode and amount, "Take 5 damage", "Heal 4", "Add 5 temporary HP". Tapping it is one change with its "Undo" toast, "Damage taken", "Healed", "Temporary hit points set", and the pad closes.
5. The "after" is what the module's own action gives on a copy of the character, so no hit point rule is in the screen: healing at the maximum, and any action on a dead character, are refused, and the button is off (the dead: "The character is dead: it has no hit points.").
6. Where the edition knocks out to 1 hit point (2024) and the damage typed would drop the character from above 0 to 0, a switch "Knock out instead: leaves 1 hit point" appears; on, the after reads "→ 1 / 12", and the follow-up says "Knocked out at 1 hit point." (ENG-65).
7. Temporary hit points never add up: when the amount is lower than the temporary hit points held, a switch "Replace my N temporary HP" is offered (`replace`).
8. Damage that leaves a concentrating character above 0 hit points asks for the Constitution save: "Constitution save, DC 10, to keep concentrating on Bless." (the higher of 10 and half the damage, ENG-20), with "Roll the save" (opens the roll dialog of the save, SHEET-39), "Kept it" and "Lost it: end concentration" (`endConcentration`, one change with Undo).
9. Damage that drops the character to 0 says "Dropped to 0 hit points." (or "The character is dead."), and when it ended the concentration, "Concentration on Bless ended."
10. The gate is green.

#### 4. How to do it

1. `knockOutOffered` and `concentrationSavePath` in the module; `SheetSystem` carries them and the three actions.
2. The pad previews with `act(playerStamp(character))` and applies the same call through `perform`, keeping the damage outcome for the follow-up.
3. The follow-up is the pad's own second view, not a second panel, so the DC stays while the roll dialog is open over it.

Technical choices (ADR 002): at most four digits; the pad closes after an apply that has nothing to ask or tell, and stays for the follow-up; the roll dialog is drawn by the pad, because the sheet frame shows one panel at a time; the save's result is read by the person, the dialog does not compare it with the DC (SHEET-39's dialog has no target).

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

A bottom panel at 360×800: the mode switch, the summary and amount, the keys, the apply button; after damage with something to ask or tell, "After the damage". Keys in `numberPad`: `title`, `modes`, `mode.*`, `summary`, `temp`, `noMax`, `apply.*`, `key.*`, `knockOut`, `replace`, `dead`, `followTitle`, `status.*`, `ended`, `save`, `roll`, `kept`, `lost`, `done`.

#### 7. Tests

- `packages/system-5e/test/sheet-hit-points.test.ts` — 4 tests: the knock-out offered at 12 damage on 12 hit points and not at 11, past 5 temporary hit points at 17 and not at 16, never at 0 hit points or in 2014; the Constitution save's path.
- `apps/web/test/number-pad.test.tsx` — 5 tests: the mode of the button, the summary before a digit, "+5" in its colour, the twelve keys, the apply button named and off at 0.
- `apps/web/e2e/sheet.spec.ts` — 4 tests: damage 5 (12 → 7, Undo), heal off at the maximum, heal 4 from 6, temporary hit points with Clear and Delete, the replace switch; the knock-out; the concentration save, its roll dialog and losing it; 12 damage to 0 hit points.
- Control values: golden B (SPEC §6.7), 12 hit points; golden A (2014) with Bless held, 12 hit points. Amounts worked out by hand: 12 − 5 = 7; 10 + 5 temporary; 4 damage → DC max(10, 2) = 10.

#### 8. Checked against the source

SRD 5.1, "Concentration": a Constitution save, DC 10 or half the damage, whichever is higher. SRD 5.2.1, "Concentration": the same, the DC at most 30. SRD 5.2.1, "Knocking Out a Creature": the attacker may reduce a creature to 1 hit point instead of 0 with a melee attack (ENG-65 §8). SRD 5.1 and 5.2.1, "Temporary Hit Points": they do not add up; replace or keep (ENG-20 §8).

#### 9. Not in this ticket

- The damage's type and a critical hit: `applyDamage` takes both (SHEET-16, ENG-20), but the board's pad has neither; their control is a later row.
- Death saves at 0 hit points: SHEET-43.
- A number the dialog compares with a DC: the roll dialog shows the total only.

#### 10. Rake check

- **Everything is data / the module owns the rules:** the after, the refusals, the DC and the knock-out come from the module.
- **Manual overrides win:** the maximum shown is `hp.max` from `Computed`.
- **A person's saved data:** each apply is one logged, undoable entry.
- **No visible literal, no look literal:** `numberPad` keys; tokens and parts (the temporary colour is `text-temp`).

#### 11. What came out of it

Quality gate, 2026-11-04: `pnpm lint` 404 files, no fixes; `pnpm typecheck` clean; `pnpm test` 120 files, 1447 passed, 0 failed, 28.4 s (9 new, from 1438), then speed 2 passed; coverage statements 99.11 % (3796/3830), lines 99.81 % (3327/3333); `pnpm e2e` 63 passed, 0 failed, 55.5 s (4 new). Screenshots at 360×800 shown in the chat.

Differences from §3: none.

Found, not fixed: the toast's Undo is hidden under an open panel (SHEET-71 has it); the "Roll the save" dialog and the pad close together on Escape, because every `BottomSheet` listens to the key (the e2e closes the dialog with its Close button); no row yet offers the damage type and critical hit on the pad.

Changelog: "The Damage and Heal buttons open a number pad: type an amount, see the hit points before and after, and apply it, with Undo; Temp HP too, a knock-out where your rules have it, and the concentration save after damage."

---

### SHEET-43 The death saves tracker follows a dying character

**Hat:** The death saves tracker follows a dying character
**Depends on:** SHEET-30 (the section's place), SHEET-39 (the roll dialog), SHEET-23 (Undo), SHEET-40 (the damage that brings a character down), ENG-58 (`rollDeathSave`, `stabilize`, `revive`), ENG-65 (the knock-out, `firstAid`), ENG-67 (exhaustion is death)
**Size:** S
**Screen:** Yes — the Combat tab of `docs/design/BRIEF.md` Part 2 P4 ("death saves"); board `V3-Sheet` draws only the Main tab, so the card follows the other tabs' cards. SPEC §6.4, §7.2.

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/sections/DeathSaves.tsx` — changes: the section SHEET-30 left empty.
- `packages/system-5e/src/sheet-death-saves.ts` — new: `fifthEditionDeathSaves` (where the character stands), `DEATH_SAVE_PATH`.
- `packages/system-5e/src/sheet-roll.ts` — changes: the death save is a d20 test on its mode's path, with no number added (`RollKind` `deathSave`, `RollTest.bonus` optional).
- `apps/web/src/shared/RollDialog.tsx`, `apps/web/src/sheet/roll.ts` — change: a death save's roll is applied with `rollDeathSave` and says what it did.
- `apps/web/src/systems.ts` — changes: `SheetSystem.deathSaves`, `deathSavePath`, `rollDeathSave`, `stabilize`, `firstAid`, `revive`.
- `apps/web/src/locales/en/deathSaves.json`, `roll.json` — the words.

#### 2. What is missing now

Measured on `f29a0a7`: `DeathSaves` returns `null`; a character at 0 hit points has no tracker, no way to roll a death save, stabilize, revive or give first aid from the sheet.

#### 3. What it should look like when done

1. The card "Death saves" shows on the Combat tab for a character that is dying, stable, dead or knocked out, and for no one else.
2. Dying (0 hit points, not stable): "Successes" and "Failures", three circles each, filled by the stored counts; "Roll death save" and "Stabilize".
3. "Roll death save" opens the roll dialog on the death save's mode, `1d20 (Death save)`, with the mode's sources and the effects that name a death save (`roll.deathSave`, `roll.save.all`). Its Roll applies `rollDeathSave` with the kept d20 face and the total: a natural 1 is two failures ("Natural 1: two failures."), a 20 is 1 hit point back, 10 or more a success, below 10 a failure; the third success says "stable", the third failure "dead". The dialog names the result under the dice, and the card follows at once.
4. "Stabilize" is `stabilize` (first aid, Spare the Dying, 2014's knock-out): one change with its Undo toast, and the card reads "Stable": "It makes no death saves. After 1d4 hours it regains 1 hit point."
5. Stable: "Regain 1 hit point" is the person's `applyHealing` of 1 (nothing keeps the time); the card goes.
6. Dead (three failures, or exhaustion at its highest level, ENG-67): "Dead", and "Revive with 1 hit point" and "Revive with full hit points" (`revive`). A 2024 revival lowers exhaustion by one level (SRD 5.2.1), so a character dead of it is back; a revival `revive` refuses says so ("Exhaustion is still at its highest level: the character is still dead.").
7. Knocked out at 1 hit point (2024): "Knocked out at 1 hit point" and "First aid given" (`firstAid`), recorded as a success of someone else's DC 10 Wisdom (Medicine) check.
8. Each change is one entry with its Undo toast: "Death save rolled", "Stabilized", "Healed", "Revived", "First aid given".
9. The gate is green.

#### 4. How to do it

1. `fifthEditionDeathSaves` reads the stored hit points, counts and knock-out mark through the finder of what `compute()` left in (`applyingFinder`, so exhaustion the character is immune to kills no one, SHEET-64): dead, dying, stable, knocked out, or up.
2. `fifthEditionRollTest` answers the path `deathSave.mode` with a test of kind `deathSave` and no `bonus`; `rollTestWith` adds 0 and logs the roll under the mode's path.
3. `RollDialog`, after a death save's roll, runs `system.rollDeathSave` with the kept face and the total through `perform`, and shows the sentence for the outcome.

Technical choices (ADR 002): the roll uses the roll dialog, so the mode, its sources and the situational effects are SHEET-39's, not a second copy; a death save adds no number, as both SRDs say; the dialog allows another roll, each one a save, and a refusal (stable, dead) is said in its place; the card is hidden above 0 hit points, so a healthy character's Combat tab has no empty card.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

The card on the Combat tab at 360×800; the dialog's "Natural N" and the sentence. Keys in `deathSaves`: `title`, `successes`, `failures`, `count`, `roll`, `stabilize`, `stabilizeHint`, `stable`, `stableHint`, `regain`, `knockedOut`, `knockedOutHint`, `firstAid`, `dead`, `deadHint`, `reviveOne`, `reviveMax`, `stillDead`, `refused`; in `roll`: `deathSave`, `deathResult.*`, `deathRefused.*`.

#### 7. Tests

- `packages/system-5e/test/sheet-death-saves.test.ts` — 7 tests: up above 0 hit points; dying with the stored counts; stable; dead at three failures; knocked out with the mark; dead of exhaustion 6 and not at 5; the death save's roll test on `deathSave.mode` with the save targets.
- `apps/web/test/death-saves.test.tsx` — 7 tests: no card above 0; the dying card's circles (2 of 3, 1 of 3) and buttons; stable; dead; dead of exhaustion; knocked out; the dialog's `1d20 (Death save)`.
- `apps/web/e2e/sheet.spec.ts` — 4 tests: a natural 1 (a zero from the secure source gives face 1) is two failures, a second roll is death, a revival and Undo; stabilize and regain 1 hit point; first aid; exhaustion 6 and a 2024 revival to 5.
- Control values: SRD 5.1 and 5.2.1 "Death Saving Throws" (ENG-58 §8): 10 or higher a success, a 1 is two failures, three of either ends it; golden B (SPEC §6.7), 12 hit points.

#### 8. Checked against the source

SRD 5.1, "Death Saving Throws" and "Stabilizing a Creature": a DC 10 Wisdom (Medicine) check stabilizes; a stable creature regains 1 hit point after 1d4 hours. SRD 5.2.1, the same, and "Knocking Out a Creature": first aid ends it. SRD 5.2.1, Exhaustion: a revived creature has 1 fewer level (ENG-66 §8).

#### 9. Not in this ticket

- A flat bonus the person adds to a death save (Bless): the sheet has no number for it; only effects that name a death save apply.
- The time of 1d4 hours: nothing keeps it.
- The roll's target: the dialog shows the total; the module applies the 10.

#### 10. Rake check

- **The module owns the rules:** the states, the faces and the counts are the module's actions; the screen only calls them.
- **Missing is not broken:** no entry is needed; exhaustion is read by its key.
- **A person's saved data:** each change is a logged, undoable entry.
- **No visible literal, no look literal:** `deathSaves` and `roll` keys; parts and tokens.

#### 11. What came out of it

Quality gate, 2026-11-04: `pnpm lint` 407 files, no fixes; `pnpm typecheck` clean; `pnpm test` 122 files, 1461 passed, 0 failed, 29.6 s (14 new, from 1447), then speed 2 passed; coverage statements 99.08 % (3810/3845), lines 99.82 % (3338/3344); `pnpm e2e` 67 passed, 0 failed, 1.0 min (4 new). Screenshot at 360×800 shown in the chat.

Differences from §3: none. The e2e for exhaustion shows a revival does not stay refused in 2024 (it lowers the level to 5), so the `stillDead` message is tested only in the module (ENG-67), not on the screen.

Found, not fixed: the roll dialog and the toast: a revival's Undo toast is under the Roll dialog while it is open (SHEET-71's fault again).

Changelog: "The Combat tab follows a dying character: death save circles, a roll in the roll dialog that applies the result, Stabilize, first aid for a knocked-out character, and a revival for the dead."

---

### SHEET-44 The Combat tab lists the attacks

**Hat:** The Combat tab lists the attacks
**Depends on:** SHEET-30 (the section's place), SHEET-31 (descriptions in place), SHEET-39 (a tap rolls a number), SHEET-50 (equipping a weapon), ENG-16 (`attacks.<key>.*`)
**Size:** S
**Screen:** Yes — board `V3-Sheet` and `docs/design/BRIEF.md` Part 2 P4 ("the greatsword attack row: +5, 2d6+3 slashing, Graze"); the board draws the Main tab only, so the card follows the other tabs' cards. SPEC §7.2.

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/sections/Attacks.tsx` — changes: the section SHEET-30 left empty.
- `packages/system-5e/src/sheet-attacks.ts` — new: `fifthEditionAttacks`.
- `apps/web/src/systems.ts` — changes: `SheetSystem.attacks`.
- `apps/web/src/locales/en/attacks.json` — changes: the words.

#### 2. What is missing now

Measured on `9f75a4b`: `Attacks` returns `null`; the Combat tab shows no attack, though `compute()` has each equipped weapon's `attacks.<key>.hit`, `.damage` and `.mastery` (ENG-16).

#### 3. What it should look like when done

1. The card "Attacks" has a row for each equipped weapon that has an attack, each weapon once, in the order `compute()` has them.
2. A row shows the weapon's name, opening its description in place (SHEET-31), with "Melee" or "Ranged"; in 2024 its mastery property: "Mastery: Graze" while the character uses it, "Graze, not mastered" when it does not.
3. Under it, "Damage 2d6 +3 Slashing": the weapon's own dice, the damage bonus as a number (a long press opens its breakdown), and the damage type by its entry's name.
4. At the right, "Attack +5": the attack bonus, a number a tap rolls through the roll dialog (SHEET-39), which rolls the damage after a hit.
5. Golden B (SPEC §6.7) shows the greatsword at +5 with 2d6 +3 slashing and Graze; golden A the warhammer at +3 with 1d8 +1 bludgeoning and no mastery (2014 has none).
6. With no weapon equipped: "No attack. Equip a weapon on the Gear tab."
7. The gate is green.

#### 4. How to do it

1. `fifthEditionAttacks` reads `computed.entities`: each weapon item with a key and an `attacks.<key>.hit` value, once by key (as ENG-16 gives paths), with its dice and type and whether `attacks.<key>.mastery` is 1.
2. The card reads each weapon through the character's finder and its damage type and mastery names from `computed.byKey`; a key no entry names shows as its words.

Technical choices (ADR 002): the name's row and the attack number are two controls, so the tap on a number never opens a description; the attack and the damage bonus are `SheetNumber`s, so no number is shown without its breakdown; a weapon with no key has no attack path, so it is not listed (ENG-16 §8).

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

One card at 360×800. Keys in `attacks`: `title`, `none`, `attack`, `damage`, `damageBonus`, `kind.*`, `mastery`, `notMastered`, `separator`.

#### 7. Tests

- `packages/system-5e/test/sheet-attacks.test.ts` — 4 tests: golden B's greatsword (+5, +3, 2d6 slashing, Graze used); golden A's warhammer (+3, +1, 1d8 bludgeoning, no mastery); listed only while equipped; golden B4 at +6 and +4.
- `apps/web/test/attacks.test.tsx` — 3 tests: golden B's row; golden A's row without a mastery; the empty card.
- `apps/web/e2e/sheet.spec.ts` — 2 tests: the row's texts and numbers, the description opened, a tap that opens the roll dialog at `1d20 + 5`; the empty card with the weapon unequipped.
- Control numbers from: SPEC §6.7 and ENG-16's goldens (`golden-values.test.ts`): golden B greatsword +5 and 3, golden A warhammer +3 and 1, golden B4 +6 and 4.

#### 8. Checked against the source

SRD 5.2.1, "Weapon Mastery Properties" and "Mastery": a character uses a weapon's mastery only for the kinds of weapons it has chosen (ENG-16 §8: `attacks.<key>.mastery` is 1 then). SRD 5.1 has no mastery property.

#### 9. Not in this ticket

- Unarmed strikes and attacks no equipped weapon gives (a spell attack, a feature's attack): the Turn tab (SHEET-49) and the cast panel (SHEET-47) own them.
- Rolling the damage by itself: the roll dialog offers it after the attack roll (SHEET-39).
- A weapon equipped with no key: it has no attack paths, and its kind's attack bonus warns of it; the Gear tab shows the warning.
- The names of Graze and the damage types come from the packs; the built-in 2024 pack has no weapon mastery entry yet, so Graze reads as its key's words (phase 3).

#### 10. Rake check

- **Everything is data:** weapons, types and masteries come from entries and `Computed`; nothing is typed in the screen.
- **A shown number has a breakdown:** the attack and the damage bonus are `SheetNumber`s.
- **Missing is not broken:** a mastery or damage type no pack names shows as its words.
- **No visible literal, no look literal:** `attacks` keys; parts and tokens.

#### 11. What came out of it

Quality gate, 2026-11-04: `pnpm lint` 410 files, no fixes; `pnpm typecheck` clean; `pnpm test` 124 files, 1468 passed, 0 failed, 28.6 s (7 new, from 1461), then speed 2 passed; coverage statements 99.06 % (3823/3859), lines 99.82 % (3350/3356); `pnpm e2e` 69 passed, 0 failed, 1.0 min (2 new). Screenshot at 360×800 shown in the chat.

Differences from §3: none.

Found, not fixed: the built-in 2024 pack holds no `weaponMastery` entry and the 2024 damage types are named, but Graze's own text is not in the pack (phase 3 content); the row's description is the weapon's.

Changelog: "The Combat tab lists your equipped weapons' attacks: tap the attack bonus to roll it, with the damage dice, damage bonus, type and weapon mastery."

---

---

### SHEET-71 The undo toast shows above an open panel · XS

**Hat:** The undo toast shows above an open panel
**Where:** `apps/web/src/shared/ToastHost.tsx` — the toast host's place in the stack and on the screen
**Depends on:** SHEET-23 (the toast), SHEET-30 (the dock height it sits above), SHEET-42 (found it)
**Screen:** The toast of `docs/design/mockups/` board `V3-Features`; the panels' own boards (`V3-Keypad`, `V3-Rest`, `V3-Cast`) are not changed.

**What it should look like when done:**
1. A change made inside an open panel (a condition's level, a choice) shows its toast above the panel's dim, and "Undo" is tapped with the panel still open.
2. While a panel is open the toast sits at the top of the screen, so it covers none of the panel's own buttons. With no panel open it sits 16 px above the dock, as before.
3. Undo reverses that change and the panel stays open.
4. The gate is green.

**Tests:** `apps/web/e2e/sheet.spec.ts` — 1 new test: set Exhaustion to level 2 in its panel, the toast is above the panel's top edge, nothing covers "Undo", Undo is tapped with the panel open and the level goes back to 1; the SHEET-42 test no longer closes the panel before Undo. `apps/web/test/toast.test.tsx` — the host's class list. Control values: none; the numbers are the exhaustion levels the SHEET-42 test already uses.
**What came out of it:**
Quality gate, 2026-11-04: `pnpm lint` 410 files, no fixes; `pnpm typecheck` clean; `pnpm test` 124 files, 1468 passed, 0 failed, 27.4 s, then speed 2 passed; coverage statements 99.06 % (3823/3859), lines 99.82 % (3350/3356); `pnpm e2e` 70 passed, 0 failed, 1.0 min (1 new). Screenshot at 360×800 shown in the chat.

Differs from the row: the row said the toast "shows above the panel's dim". First build, the toast above the dim at its usual place (16 px above the dock) covered the level buttons 1 to 5 of the condition panel for its 5 seconds. So while a panel is open (any `aria-modal` dialog in the page) the toast moves to the top of the screen. Technical choice (ADR 002); the e2e test checks the toast ends above the panel's top edge.

Found, not fixed: a condition's level change shows the text "Exhaustion applied" (`toast.done.setCondition`), the same as adding it. Wording only, no new row.

Changelog: "A change made inside an open panel shows its Undo toast at the top of the screen, above the panel, so you can undo it without closing the panel."

---

### SHEET-73 A key closes the panel on top, not every panel · XS

**Hat:** Escape closes the panel on top
**Where:** `apps/web/src/shared/escape.ts` — new: `useEscapeClose`; used by `shared/BottomSheet.tsx`, `shared/DicePanel.tsx` (`DiceSheet`) and `shared/CharacterActions.tsx`, the three panels that listened on `window` by themselves
**Depends on:** SHEET-40 (found it: the pad's roll dialog)
**Screen:** No — the panels look as before.

**What it should look like when done:**
1. With a panel over a panel (the number pad, and over it the roll dialog of the concentration save), one Escape closes the roll dialog only; the pad stays open with its state.
2. A second Escape closes the pad. With no panel open the key does nothing.
3. A panel alone closes on Escape as before, and a tap on the dim or the close button still closes it.
4. The gate is green.

**Tests:** `apps/web/e2e/sheet.spec.ts` — 1 new test (pad, roll dialog, two presses, a third with nothing open), which fails on the old code at the first press (0 dialogs left, 1 expected); the SHEET-40 test closes the roll dialog with Escape instead of its Close button. Control values: none; the counts are open dialogs.
**What came out of it:**
Quality gate, 2026-11-04: `pnpm lint` 411 files, no fixes; `pnpm typecheck` clean; `pnpm test` 124 files, 1468 passed, 0 failed, 30.3 s, then speed 2 passed; coverage statements 99.06 % (3823/3859), lines 99.82 % (3350/3356); `pnpm e2e` 71 passed, 0 failed, 1.0 min (1 new).

Differs from the row: the row names `BottomSheet` only. `DiceSheet` and the Actions list had the same window listener, so all three use the one hook; a panel of one kind over a panel of another now also closes one at a time. Technical choice (ADR 002).
Why one listener: a listener for each panel is not enough. After the top panel's listener runs, the browser can render the close before the next listener runs, and that one then finds itself on top and closes too. The stack has one `window` listener and calls only the top entry.

Found, not fixed: nothing.

Changelog: "The Escape key closes only the panel on top: with the roll dialog over the number pad, the first press closes the dialog and the second closes the pad."

---

### SHEET-45 The Rest frames show what comes back

**Hat:** The Rest panel lists what each rest gives back
**Depends on:** SHEET-30 (the panel's place and the header's Rest button), SHEET-23 (Undo), SHEET-38 (the fair die), SHEET-42 (the condition levels a rest lowers), ENG-21 (`shortRest`, `longRest`), ENG-61 (conditions' recovery)
**Size:** M
**Screen:** Yes — the Rest panel; board `V3-Rest` in `docs/design/mockups/`, its row in `docs/design/BRIEF.md` Part 5 ("P6 Damage, healing and rests"), frames 2 and 3 of BRIEF Part 2 P6. SPEC §6.4, §7.2.

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/panels/RestPanel.tsx` — changes: the panel SHEET-30 left empty.
- `packages/system-5e/src/sheet-rest.ts` — new: `fifthEditionRestDice` (the hit dice a short rest can spend), `fifthEditionRestLines` (what a rest changed, line by line, from the character before and after), `restNeedsFood`.
- `packages/system-5e/src/rulesets/edition-rules.ts`, `2014.ts`, `2024.ts` — change: the rule `longRestNeedsFood`.
- `apps/web/src/systems.ts` — change: `SheetSystem.restDice`, `restLines`, `restNeedsFood`, `shortRest`, `longRest`.
- `apps/web/src/locales/en/rest.json` — the panel's text (the namespace SHEET-30 made empty).

#### 2. What is missing now

The header's Rest button opens a panel that draws nothing: `RestPanel` returns `null`, and `apps/web/test/sheet.test.tsx` expects the empty string from it. `shortRest` and `longRest` (ENG-21) exist and are tested, and no screen runs them.

#### 3. What it should look like when done

1. The header's Rest button opens one panel, "Rest", with the board's two cards. "Short rest" (clock icon) lists what a short rest with no hit die gives back and "Spend hit dice to heal" while a hit die is left; "Long rest" (moon icon) lists what a long rest gives back. Each card has a button named like it.
2. Golden B (2024: fighter 1, one d10, CON +2, 12 hit points, Second Wind 2 uses) at 4 hit points with 2 uses of Second Wind spent: the short card says "Second Wind: 1 use back, 1 of 2 left"; the long card says "Hit points back to 12" and "Second Wind: 2 uses back, 2 of 2 left".
3. The short frame lists the hit dice ("d10: 1 of 1 left") with "Spend a d10 hit die". A spend rolls a fair d10 (logged in the roll log as any roll); with face 1 the row says "d10 rolled 1: 3 hit points" (1 + CON 2) and the list says "Hit points 4 → 7 of 12". "Take back" removes a spent die from the list. A die left at 0 cannot be spent again.
4. "Confirm" runs the rest as one change, closes the panel and shows the toast "Short rest taken" with Undo; Undo brings back the 4 hit points. "Cancel" goes back to the cards and changes nothing.
5. The long frame lists exactly what comes back before "Confirm", and then the same: "Long rest taken", Undo.
6. A rest that gives nothing says "Nothing comes back." and its Confirm is off. A dead character, or one under the edition's hit point minimum, gets the reason, and Confirm is off.
7. The 2014 long rest frame says "A long rest lowers exhaustion by one level only if the character also ate and drank. If it did not, set the level back on the Conditions card."; the 2024 frame says nothing of food.
8. The gate is green.

#### 4. How to do it

1. Add `longRestNeedsFood` to `EditionRules` (2014 true, 2024 false); `restNeedsFood(character)` reads it through `rulesOf` (no `if (ruleset …)`).
2. `fifthEditionRestLines(before, computed, result)`: the lines are the difference between the character before and the one the rest returned (hit points, temporary hit points ending, each hit die spent with its roll, hit dice back, slots, pact slots, uses with their label and what is left, conditions lowered or ended, concentration ending, inspiration given, a knock-out ending). A thing that did not change has no line. Nothing re-derives a rest rule.
3. `RestPanel`: three views kept in the panel's own state (cards, short frame, long frame). Every list is the module's rest run on a copy with `playerStamp`, as `NumberPad` previews; Confirm runs it through `perform`.
4. A hit die spent is `rollWith` with `1d<N>` and `panelDie()`, logged with `logRoll`; the roll's total is the `roll` of `HitDieAsk`.

#### 5. Stored data

Nothing stored changes. The Rest panel keeps its state in memory; a rest is the log entry ENG-21 already makes (`shortRest`, `longRest`, with their toast texts).

#### 6. What a person will see

At 360×800, from the moon button of the header: a bottom panel. Views: the two cards; "Short rest" with "Hit dice" rows, the spent dice, "What comes back", Confirm, Cancel; "Long rest" with "What comes back", the 2014 food note, Confirm, Cancel. Empty: "Nothing comes back." Error: the refusal's text in a warning box. Keys: `rest.json` (title, short.*, long.*, food, diceHeading, left, spend, spent, takeBack, takeBackShort, willBack, line.*, refused.*, confirm, cancel). Screenshots in the chat.

#### 7. Tests

- `packages/system-5e/test/sheet-rest.test.ts` — 9 tests: the dice listed by size with what is left (B, B4, C 2014), `restNeedsFood` (A true, B false), a short rest's lines (hit points, the die, a use of Second Wind, pact slots, a knock-out ending), a long rest's lines for 2024 and 2014, exhaustion lowered and ended, concentration ending in 2024 and kept in 2014.
- `packages/system-5e/test/rulesets.test.ts` — the new rule in each edition.
- `apps/web/test/rest.test.tsx` — 4 tests: the two cards, the short card's use of Second Wind and the dice hint, the long card's lines, nothing coming back.
- `apps/web/e2e/sheet.spec.ts` — 2 tests: the cards, the short frame (spend, take back, spend, Confirm, toast, Undo), the long frame (list, Cancel, Confirm, toast, Undo); the 2014 food note.
- Control numbers from: SPEC §6.7 golden B (12 hit points, CON +2, one d10) and golden A (12 hit points); Second Wind's uses from ENG-21's tests (`rests.test.ts`): one back on a short rest, all on a long rest.

#### 8. Checked against the source

- SRD 5.1, Exhaustion (`5e-SRD-Conditions.json`), as quoted in ENG-61 §8: "Finishing a long rest reduces a creature's exhaustion level by 1, provided that the creature has also ingested some food and drink." So 2014 `longRestNeedsFood` is true.
- SRD 5.2.1, Exhaustion, as quoted in ENG-61 §8: "Finishing a Long Rest removes 1 of your Exhaustion levels." No condition on food: 2024 is false.
- The rest rules themselves (hit dice, recoveries, the edition's shares) are ENG-21's §8, not repeated here.
- No `[ПРОВЕРИТЬ]` is open for this ticket.

#### 9. Not in this ticket

- Typed faces for a hit die ("I roll myself", SPEC §6.5): the panel rolls the fair die. New row SHEET-74.
- The recovery events `dawn`, `turn` and `manual` (a magic item's charges at dawn): no frame offers them; no action triggers them (ENG-21 §11).
- The condition list showing a level go down is the Conditions card of SHEET-42, which reads the stored change.
- A person who did not eat sets the exhaustion level back by hand (SHEET-42's panel) or takes the rest back with Undo.

#### 10. Rake check

- **`compute()` is pure; the UI reads only `Computed`:** the lists read `Computed` and the module's actions run on copies; no number is made in a component.
- **Each system's rules live in its own module:** the food rule is `longRestNeedsFood` in `rulesets/2014.ts` and `2024.ts`; no `ruleset ===` check anywhere.
- **No user-facing string literal in a component:** every text is an i18next key in `rest.json`; "d10" is built from the die's faces, the rest is keys.
- **No look in a component:** classes are the sheet's existing tokens and `Part` names.
- **Stored units and shapes:** nothing stored changes.
- **Golden values:** none touched.

#### 11. What came out of it
Quality gate, 2026-11-04: `pnpm lint` 414 files, no fixes; `pnpm typecheck` clean; `pnpm test` 126 files, 1481 passed, 0 failed, 29.0 s (13 new, from 1468), then speed 2 passed; coverage statements 99.05 % (3876/3913), lines 99.82 % (3395/3401); `pnpm e2e` 73 passed, 0 failed, 1.1 min (2 new). Screenshots at 360×800 shown in the chat.

Differs from §3: nothing. Technical choices (ADR 002):
- The board has one button on each card; here each button opens that rest's frame (BRIEF P6 frames 2 and 3, "Confirm" and "Cancel"), where the short frame spends the dice.
- The lists are the difference between the character before and after the module's own rest, not a second list of rules (`restLines`).
- The 2014 food note shows in every 2014 long rest frame, not only with exhaustion: the built-in 2014 pack has no exhaustion entry yet (phase 3), and the note is short.
- `rulesets.test.ts` lists each edition's rules; it gained the new rule `longRestNeedsFood` (SRD text in §8), no existing value changed.

Found, not fixed: a typed face for a hit die ("I roll myself") is not offered; new row SHEET-74 (S).

Changelog: "The Rest button opens the two rests: each lists what comes back before you confirm, a short rest spends hit dice you roll, a long rest in the 2014 rules reminds you that exhaustion goes down only if the character ate and drank; each rest is one change with Undo."

---

### SHEET-47 The cast panel casts a spell

**Hat:** The cast panel casts a spell
**Depends on:** SHEET-46 (the Spells tab and its rows), SHEET-31 (descriptions: `DescriptionBody`), SHEET-23 (Undo), SHEET-17 (`castWarnings`), ENG-20 and ENG-57 (`castSpell`), ENG-50 and ENG-53 (the spell's dice), SHEET-41 (the concentration it replaces)
**Size:** M
**Screen:** Yes — the cast panel; board `V3-Cast` in `docs/design/mockups/` and its row in `docs/design/BRIEF.md` Part 5 ("P6"). ADR 010 item 10, ADR 011 item 2. SPEC §6.4.

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/panels/CastPanel.tsx` — new.
- `packages/system-5e/src/sheet-cast.ts` — new: `spellCastingStat`, the stat a spell is cast with.
- `apps/web/src/systems.ts` — change: `SheetSystem.castSpell`, `castWarnings`, `spellDice`, `spellCastingStat`.
- `apps/web/src/pages/SheetPage.tsx`, `sheet/SheetContext.ts` — change: the frame opens the panel through `SheetValue.cast(spell, part?)`.
- `apps/web/src/sheet/sections/SpellList.tsx` — change: a spell row opens the panel instead of the in-place description.
- `apps/web/src/locales/en/cast.json` and `i18n/namespaces.ts` — the panel's text.

#### 2. What is missing now

A spell row of the Spells tab opens its description in place and nothing casts: `castSpell` (ENG-20) has no screen. `SpellList.tsx`'s header says "Casting is SHEET-47's".

#### 3. What it should look like when done

1. A tap on a spell of the Spells tab (prepared, known or granted) opens the cast panel, titled with the spell's name, with its edition chip and the line "Level 1 · Evocation · Slots left: Level 1 4 of 4 · Level 2 3 of 3" (a cantrip: "Cantrip · Evocation").
2. Under the line: the spell's summary and "See full description" (ADR 011 item 2); "See full description" opens the source's text, or says it has none.
3. Before "Cast", a warning for each rule that forbids a cast now (`castWarnings`): the Incapacitated condition, or a rule on `spell.cannotCast` with the steps of its number. Each says the cast still works.
4. The dice at the slot picked: golden C (2014: wizard 3, paladin 3, Charisma 14) with Cure Wounds from its paladin's list reads "Healing: 1d8 + 2" at a level 1 slot and "Healing: 2d8 + 2" at level 2 (SRD 5.1: 1d8 + the spellcasting modifier, plus 1d8 for each slot level above 1st). A spell with damage shows "Damage: <dice> <type>". "Damage" or "Healing" rolls them with the fair die, logs each roll, and shows what came up.
5. "Slot level": a chip for each slot the character has of the spell's level or higher, pact slots included; one with none left is off; the lowest one with a slot left is picked at first. A cantrip has no slots to pick.
6. "Don't use a spell slot" ("for a free cast from a feature or an item"): on, the cast spends nothing; opened from a granted spell that has uses of its own, it is on and the cast spends one use of that grant (ENG-57); a cantrip has no switch.
7. "Cast" is one change with its "Undo" toast ("Cure Wounds cast"): at level 2 the level 2 slots go from 3 of 3 to 2 of 3, and Undo gives it back. A cast that changes nothing (no slot, no use, no new concentration) closes the panel and stores nothing.
8. A concentration spell cast while another is held does not cast at once: the panel says "Casting Haze ends your concentration on Bless." with "End it and cast" and "Back". Back leaves the concentration as it was; "End it and cast" casts, and Undo brings the old concentration back. Casting the spell already held asks nothing.
9. A cast the module refuses says why, and "Cast" is off; the buttons stay in view over a long description.
10. The gate is green.

#### 4. How to do it

1. `spellCastingStat(character, computed, spell)`: the stat of the class (or subclass) whose list holds the spell; else the stat of the one casting class; else none.
2. `SheetValue.cast(spell, part?)` and an `open` kind `cast` in the frame; the Spells tab calls it, with `part` for a granted spell that has uses.
3. `CastPanel`: the ask is built from the state (slot, switch, grant); `castSpell` runs on a copy (`playerStamp`) to say if it is refused, and for real through `perform`. The dice are `spellDice(spell, computed.values, { slot, stat })`; the formulas are shown with each `@path` written as its current number.
4. The concentration confirmation is a state of the panel; nothing is written until "End it and cast". The cast itself already replaces the concentration (ENG-20), so the panel adds no rule.

#### 5. Stored data

Nothing stored changes. A cast is the log entry ENG-20 already makes (`castSpell`).

#### 6. What a person will see

At 360×800: a bottom panel from a spell row. States: the spell; a missing spell ("Missing: <id>"); warnings; a refusal in a warning box; the concentration question in place of the buttons. "Cast", "Damage", "Healing" stay at the bottom of the panel. Keys: `cast.json` (line, slot labels, "Don't use a spell slot" and its hints, dice lines, roll buttons, `warning.*`, `concentration.*`, `refused.*`).

#### 7. Tests

- `packages/system-5e/test/sheet-cast.test.ts` — 4 tests: the stat from the class whose list holds the spell (golden C: Intelligence, Charisma), none for a spell in no list with two casters, the single caster's stat (golden A: Wisdom), none with no class.
- `apps/web/test/cast.test.tsx` — 8 tests: the line and slots, 1d8 + 2 and the chips, the buttons and "See full description", a spell with no dice, a cantrip, the two warnings, a missing spell.
- `apps/web/e2e/sheet.spec.ts` — 2 new tests (the dice at level 1 and 2, the cast at level 2 with Undo, the free cast; the concentration question, Back, confirm, Undo); the SHEET-46 test now expects the cast panel from a spell row.
- Control numbers from: SPEC §6.7 golden C (slots 4 and 3, Charisma 14, Intelligence 15), golden A; Cure Wounds' dice from SRD 5.1 (§8).

#### 8. Checked against the source

- SRD 5.1, Cure Wounds: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. … When you cast this spell using a spell slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st." So level 1: 1d8 + 2, level 2: 2d8 + 2 for Charisma +2.
- SPEC §6.4 (`setConcentration`): a new concentration spell ends the previous one, with a confirmation.
- SRD 5.1, Concentration: casting another spell that requires concentration ends the first. No `[ПРОВЕРИТЬ]` is open for this ticket.

#### 9. Not in this ticket

- Typed faces ("I roll myself") for the spell's dice: the panel rolls the fair die. SHEET-74 covers hit dice; a spell's dice are the same change and are added to its row.
- A spell's damage as a roll with advantage, a critical hit or a saving throw's result: the panel rolls the dice only.
- Preparing or learning spells (phase 4); a tap on a dice number to open its breakdown.
- The spell card in the Library (phase 3).

#### 10. Rake check

- **No rule in a component:** the cast, the concentration it replaces and the warnings are the module's; the panel asks the module and shows what it says.
- **`compute()` is the UI's only source:** the dice are `spellDice` over `Computed`; a formula's number is a computed path read at the moment.
- **Missing is not broken:** a spell no pack holds reads "Missing: <id>".
- **Prerequisites and warnings never block:** the warnings show and the cast still happens.
- **No user-facing string literal:** every text is an i18next key in `cast.json`.
- **Stored shape:** nothing changes. **Golden values:** none touched.

#### 11. What came out of it
Quality gate, 2026-11-04: `pnpm lint` 419 files, no fixes; `pnpm typecheck` clean; `pnpm test` 128 files, 1493 passed, 0 failed, 31.4 s (12 new, from 1481), then speed 2 passed; coverage statements 99.05 % (3888/3925), lines 99.82 % (3405/3411); `pnpm e2e` 75 passed, 0 failed, 1.2 min (2 new). Screenshots at 360×800 shown in the chat.

Differs from §3: nothing. Technical choices (ADR 002):
- The spell row of the Spells tab no longer opens its description in place: ADR 011 item 2 says the cast panel holds it, with no separate spell card. The SHEET-46 e2e test's last step now expects the panel.
- The first build put "Cast" below the long description; the buttons are now stuck to the panel's bottom, and the e2e test checks "Cast" is in view with the full text open.
- A cast that changes nothing (a cantrip with no concentration, "Don't use a spell slot" on a plain spell) closes the panel and stores nothing, since `castSpell` refuses it as `unchanged` and there is no entry to keep.
- The school has no entry in the packs yet, so the line shows its key with a capital: "Evocation".
- A formula's `@path` is shown as the number it is now ("1d8 + 2").

Found, not fixed: a long attribution address in "See full description" runs past the card's edge (new row SHEET-75, XS); the spell's typed faces ("I roll myself") are added to SHEET-74's row.

Changelog: "A tap on a spell opens the cast panel: its summary and full text, what forbids a cast now, the dice at the slot you pick, the slot or no slot, and Cast with Undo; a new concentration spell asks before it ends the old one."

---

### SHEET-49 The Turn tab lists actions by timing

**Hat:** The Turn tab lists the features by when they are used
**Depends on:** SHEET-48 (the features and their groups), SHEET-44 (the attacks), SHEET-31 (descriptions in place)
**Size:** S
**Screen:** Yes — the Turn tab; board `V3-Turn` in `docs/design/mockups/`, its row in `docs/design/BRIEF.md` Part 5 ("P4"). ADR 010 item 8.

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/sections/TurnList.tsx` — changes: the section SHEET-30 left empty.
- `packages/system-5e/src/sheet-turn.ts` — new: `fifthEditionTurn`, `TURN_TIMINGS`.
- `apps/web/src/systems.ts` — change: `SheetSystem.turn`.
- `apps/web/src/sheet/sections/FeatureList.tsx` — change: `Recovery` is exported, to show when uses come back.
- `packages/content/src/packs/srd-2024.ts` — change: Second Wind's `activation`.
- `apps/web/src/locales/en/turn.json` — the tab's text (the namespace SHEET-30 made empty).

#### 2. What is missing now

The Turn tab draws nothing: `TurnList` returns `null`, and `apps/web/test/sheet.test.tsx` expects the empty string from it. No pack entry sets `activation` (SPEC §5.2's `FeatureDef.activation`), so the field is read by nothing and filled by nothing.

#### 3. What it should look like when done

1. The Turn tab opens with "On your turn" and "a reminder, from your features".
2. Features are grouped by their `activation`, in the board's order: Action, Bonus action, Reaction, No action (`free`), Always on (`passive`), Other (`special`); a feature with no timing and uses of its own is under Limited uses; a feature that says neither is not listed.
3. The equipped weapons' attacks are the first lines of "Action": golden B (SPEC §6.7) shows "Attack: Greatsword", "+5 to hit · 2d6 +3 Slashing · Mastery: Graze"; the bonus is the Combat tab's number (a tap rolls it).
4. Golden B shows Second Wind under "Bonus action" (SRD 5.2.1: "As a Bonus Action, you can ..."), with "Fighter · 2 of 2 left" and "1 back on a short rest, all on a long rest".
5. A feature opens its description in place. A character with nothing to list sees "Nothing to remind you of yet. This list fills as your features say when they are used."
6. The gate is green.

#### 4. How to do it

1. `fifthEditionTurn(character, computed)`: for each row of the Features tab's groups (`fifthEditionFeatures`), the timing is the entity's `activation`, else `limited` when it has uses, else none; groups come out in `TURN_TIMINGS` order, none empty; each row keeps the kind and entity of the group that gave it.
2. `TurnList`: one card, one section per group; "Action" also draws the attacks of `system.attacks` and exists for them when no feature is an action. A feature line is `Description` with its source name and its uses; `Recovery` under it.
3. Second Wind gets `activation: 'bonus'` in the 2024 pack (hand-written mechanics, no new field).

#### 5. Stored data

Nothing stored changes, and no field is new: `activation` is in the pack schema already. The one data change is one value in the built-in 2024 pack.

#### 6. What a person will see

At 360×800, the Turn tab: one card, "On your turn" with its hint, then each group's heading in small capitals and its lines. Empty: one line of text. Keys: `turn.json` (title, hint, none, missing, group.*, source.*, attack, toHit, damageBonus, mastery, left, separator). Screenshot in the chat.

#### 7. Tests

- `packages/system-5e/test/sheet-turn.test.ts` — 4 tests: Second Wind under bonus actions with its uses key; every timing in the board's order from made-up features (and the one that says nothing left out); where a feature comes from and its uses; nothing to list.
- `apps/web/test/turn.test.tsx` — 4 tests: title and hint; the attack first under Action and Second Wind under Bonus action (golden B); a character whose features name no action still has the Action group for its attack (golden A: a warhammer); nothing to list.
- `apps/web/e2e/sheet.spec.ts` — 1 test: the tab on golden B, the attack's numbers, Second Wind, its description in place, a tap rolling the attack.
- Control numbers from: SPEC §6.7 golden B (greatsword +5, 2d6 +3 slashing, Graze; Second Wind 2 uses) and golden A (warhammer).

#### 8. Checked against the source

- SRD 5.2.1, Fighter, Second Wind: "As a Bonus Action, you can use it to regain Hit Points equal to 1d10 plus your Fighter level." So `activation: 'bonus'`.
- SPEC §5.2: `FeatureDef.activation` is one of `action`, `bonus`, `reaction`, `free`, `passive`, `special`. ADR 010 item 8 names the groups: action, bonus action, reaction, once per turn, always on, limited uses.
- No `[ПРОВЕРИТЬ]` is open for this ticket.

#### 9. Not in this ticket

- The board's "Once per turn" group and its feats (Savage Attacker) and its "Always on" feats with their numbers (Alert's initiative, Defense's AC): `activation` is on features only, and has no once-per-turn value. New row SHEET-76.
- Spells: a spell opens from the Spells tab (SHEET-47).
- A use button on this tab: uses are spent on the Features tab (SHEET-48).
- More groups filled: that is content (phase 3).

#### 10. Rake check

- **Everything is data; nothing typed twice:** the groups come from each feature's `activation`, the attacks from the Combat tab's list.
- **The UI reads only `Computed`:** the attack bonuses are the same numbers of `Computed` as on the Combat tab.
- **Missing is not broken:** a feature the packs no longer have reads "Missing: <id>".
- **No user-facing string literal in a component, no look in a component:** keys in `turn.json`; the sheet's tokens.
- **Rules text:** none added; Second Wind's name and timing only.

#### 11. What came out of it
Quality gate, 2026-11-04: `pnpm lint` 422 files, no fixes; `pnpm typecheck` clean; `pnpm test` 130 files, 1501 passed, 0 failed, 29.7 s (8 new, from 1493), then speed 2 passed; coverage statements 99.06 % (3902/3939), lines 99.82 % (3418/3424); `pnpm e2e` 76 passed, 0 failed, 1.2 min (1 new). Screenshot at 360×800 shown in the chat.

Differs from the board: it lists feats and a "Once per turn" group, and numbers on "Always on" lines. The data cannot say that yet (`activation` is on features only, with no once-per-turn value), and adding it changes the pack's shape, which is not this ticket's size. New row SHEET-76 (S). The attack lines under "Action" are from the board and not from the row's note; they come from the Combat tab's list, so nothing is typed twice.

Technical choices (ADR 002): a feature with uses and no timing is listed under "Limited uses" (ADR 010 item 8's last group); a feature or feat that says neither is left out, since the tab shows only what the data says; `free` is headed "No action", `special` "Other".
Changed data: Second Wind got `activation: 'bonus'` in the built-in 2024 pack; the pack test and the golden values did not change.

Found, not fixed: SHEET-76 above; the long attribution address (SHEET-75, found by SHEET-47).

Changelog: "The Turn tab lists what you can do on your turn from your features, grouped by when you use them, with your weapon attacks under Action and the uses a feature has left."

---

### SHEET-51 Coins change by quick steps · XS

**Hat:** The Gear tab changes each coin by steps
**Where:** `apps/web/src/sheet/sections/Coins.tsx` — the section SHEET-30 left empty; `packages/system-5e/src/coins.ts` — new: `changeCoin`, `fifthEditionCoins`, `COIN_STEPS`; `apps/web/src/systems.ts` — `SheetSystem.coins`, `changeCoin`
**Depends on:** SHEET-30 (the section's place), SHEET-50 (the Gear tab), SHEET-23 (Undo)
**Screen:** Yes — the Gear tab of `docs/design/BRIEF.md` Part 2 ("coins cp sp ep gp pp with + and −"); board `V3-Sheet` draws only the Main tab, so the card follows the Items card. SPEC §7.2.

**What it should look like when done:**
1. Under the Items card the Gear tab shows a card "Coins": one row each for cp, sp, ep, gp and pp, from the lowest, each with its count between a "−10" and "−1" on the left and a "+1" and "+10" on the right.
2. A tap changes that coin by the step. It is one change with its "Undo" toast, "Coins changed"; Undo gives back that step only.
3. A − that would take a count below 0 is off (`disabled`). The action refuses it too, and writes nothing.
4. Which coins exist and which steps are offered come from the module (`system.coins`), not from the component.
5. The count is stored in `systemData.currency` (SPEC §5.8), so it survives a reload.
6. The gate is green.

**Tests:** `packages/system-5e/test/coins.test.ts` — 8 tests: the five coins in order with the steps 1 and 10; a step up, a step down, down to exactly 0; the refusals (below 0, not a whole number, past the largest whole number, a step of 0 as unchanged); the entry applies again and reverses. `apps/web/test/gear.test.tsx` — 3 tests: the coins and their counts (with the thousands apart), the four buttons named by the coin, the − turned off below 0. `apps/web/e2e/sheet.spec.ts` — 1 test: golden B with 12 gp and 3 sp: 12 + 10 = 22, 22 − 1 = 21, Undo back to 22, silver down 3 → 0 and stopped, a reload. Control values: golden B holds no coins (`character-parts.ts`: all five are 0); every count in a test is written by hand from the start and the steps.
**What came out of it:**
Quality gate, 2026-11-04: `pnpm lint` 424 files, no fixes; `pnpm typecheck` clean; `pnpm test` 131 files, 1512 passed, 0 failed, 31.3 s (11 new, from 1501), then speed 2 passed; coverage statements 99.06 % (3914/3951), lines 99.82 % (3430/3436); `pnpm e2e` 77 passed, 0 failed, 1.3 min (1 new). After the full e2e run, one line was added to the test (a scroll to the card before the screenshot) and that test ran again alone: 1 passed. Screenshots at 360×800 shown in the chat.

Differences from the row: none. Technical choices (ADR 002): the steps are 1 and 10, both ways (the SPEC says "quick +/−" and does not name a step); the steps and the coins come from the module, so a system with other coins changes no component; a − that would go below 0 is off, not clamped to 0; no coin is converted into another; a typed amount is not in this ticket.

Found, not fixed: a disabled button looks the same as an enabled one (the Items card's "One less" at quantity 1, and the coins' "−10" at a count under 10): new row SHEET-77, XS.

Changelog: "The Gear tab shows your coins, cp sp ep gp pp, each with − and + buttons for steps of 1 and 10, and Undo."

---

### SHEET-34 A manual edit overrides a number

**Hat:** A number is set by hand from its breakdown
**Depends on:** SHEET-33 (the breakdown sheet), SHEET-23 (Undo), ENG-17 (overrides in `compute()`)
**Size:** S
**Screen:** Yes — sheet 2 of `docs/design/BRIEF.md` Part 2 P5 ("an 'Override by hand' field with a note; when overridden, the number shows a 'Manual edit' label"); board `V3-Roll` draws the breakdown. SPEC §6.1 step 7, §7.2.

---

#### 1. Where the code lives

**Main file:** `apps/web/src/shared/OverrideEditor.tsx` — new: the form under a breakdown.
- `packages/engine/src/overrides.ts` — new: `setOverride`, `clearOverride`, `OverrideRefusal`; exported from `index.ts`. The core has it, not the module: every system has overrides (SPEC §5.8, ADR 004).
- `apps/web/src/shared/BreakdownSheet.tsx` — change: draws the form under the lines.
- `apps/web/src/locales/en/breakdown.json` (`override.*`) and `toast.json` (`setOverride`, `clearOverride`) — the text.

#### 2. What is missing now

`compute()` applies a stored override (ENG-17: `phases.ts`, `finish`, step kind `override`) and the breakdown already labels one "Manual edit" (SHEET-33), but nothing writes one: `grep -rni override apps/web/src` finds only `draft.ts` (an empty list) and `breakdown.ts` (reading the step). The breakdown sheet has no field.

#### 3. What it should look like when done

1. In edit mode the breakdown of a number the character has shows "Override by hand": a "Number" field holding the number now, a "Note" field, "Save", and — when an edit is stored — "Remove manual edit".
2. Save is one change with its "Undo" toast, "Manual edit saved". On golden B (SPEC §6.7), Strength 17 set to 20 reads "Strength score 20 = Base 15, Soldier +2, Manual edit +3"; the Strength check is +5, the save +7, Athletics +7.
3. Undo gives 17 back and Athletics +5. "Remove manual edit" is one change with its toast, "Manual edit removed".
4. A text that is not a number ("abc", "1e3", "1,5") shows "Type a number, like 12 or -1." and Save is off. A minus sign "−" is read as "-".
5. Play mode shows "Turn on Edit to override this number by hand." and no field. The level, and a path `compute()` has no number for, show neither.
6. The edit is stored (it is there after a reload), one for each path; a new save on a path replaces its edit where it stands.
7. The gate is green.

#### 4. How to do it

1. `setOverride(character, computed, { path, value, note }, stamp)`: refuses the level (`fixedPath`), a value that is not a finite number (`badValue`) and a path whose computed value is not a number (`notANumber`: ENG-17 does not apply an edit there); replaces the edit of the path in place or adds it; the note is trimmed and left out when it shows no character (the schema's `visibleTextSchema`); one entry whose one change is the whole list at `['overrides']` (a log path steps only through objects). `unchanged` when the list does not change. `clearOverride(character, path, stamp)`: `noOverride` when there is none.
2. `OverrideEditor` reads `character.overrides` and `computed` from the sheet; its form is keyed by the stored edit, so a save or an Undo draws it again. `perform` (SHEET-55) stores the entry with its toast.
3. A distance (`format="distance"`) says "Type feet: the number is kept in feet" (SPEC §7.5: stored units are feet).

#### 5. Stored data

Nothing stored changes: `overrides` is in the character's core already (`overrideSchema`, SPEC §5.8). No `schemaVersion` bump.

#### 6. What a person will see

At 360×800, the breakdown sheet, under its lines: a rule, "Override by hand", "Number" with its field, "Note" with its field, then "Save" and "Remove manual edit" side by side. Play mode: one line of muted text. Keys: `breakdown.json` `override.title`, `locked`, `value`, `feet`, `notANumber`, `note`, `notePlaceholder`, `save`, `remove`. Screenshots in the chat.

#### 7. Tests

- `packages/engine/test/overrides.test.ts` — 8 tests on Tales' Ash (ENG-27): the edit stored and every number following (wits score 5 → 12, modifier 2 → 6, climbing 6 → 10); replaced in place with the others kept and the note trimmed; no note when it shows no character; the refusals (a path with no number, `constructor`, the level, NaN and infinity); the same edit again as unchanged; apply again and reverse; `clearOverride` and its refusal.
- `apps/web/test/override.test.tsx` — 6 tests on golden B: the form in edit mode, the locked line in play mode, a stored edit (field, note, label, total), no form for the level or a path with no number, `typedNumber` on what it reads and what it does not.
- `apps/web/e2e/sheet.spec.ts` — 1 test: locked in play mode; edit mode; "abc" and its alert; Save 20 with a note; the summary, the label and the toast; Strength +5, save +7, Athletics +7; Undo; a new save of 8 (−9) and Remove; a save of 20 and a reload.
- Control numbers from: SPEC §6.7 golden B (Strength 17 = 15 + 2, check +3, save +5, Athletics +5, proficiency +2), hand-computed from them: modifier floor((20 − 10) / 2) = 5, save 5 + 2 = 7, Athletics 5 + 2 = 7, an edit of 8 moves 17 by −9; ENG-27's Ash for the engine.

#### 8. Checked against the source

The engine's own rules: ENG-17 (`phases.ts`): an edit applies only to a number on a number path, else `overrideNotANumber`; the level is read before any edit, so an edit of it is `fixedPath`. SPEC §6.1 step 7: edits apply last and win. The formula for a modifier, floor((score − 10) / 2), is read from the 5e module's own output on golden B (modifier +3 at 17), not written here. Nothing else to check.

#### 9. Not in this ticket

- An edit of a key path (a skill's stat: ENG-43, `overrideNotAKey`): the screen opens no key path's breakdown, and `Computed.keys` does not hold the keys a path may take. New row SHEET-79.
- A boolean or text edit: the schema allows them, no number path uses one.
- An edit made by a DM's approval (ADR 009, the table link): it does not replace this rule.

#### 10. Rake check

- Manual overrides always win: the edit is stored in `overrides` and applied by `compute()` in the final phase; the screen reads only `Computed` and its breakdown, which labels it a manual edit.
- The core names no game: `setOverride` is in `packages/engine`, with no fifth-edition word; the form reads paths from `Computed`.
- Missing is not broken: a path with no number draws no form.
- No look in a component, no user-facing literal: tokens, parts and `breakdown.json` keys only.
- Stored units are feet: the distance hint says so; nothing is converted.

#### 11. What came out of it

Quality gate, 2026-11-04: `pnpm lint` 428 files, no fixes; `pnpm typecheck` clean; `pnpm test` 133 files, 1526 passed, 0 failed, 32.1 s (14 new, from 1512), then speed 2 passed; coverage statements 99.07 % (3946/3983), lines 99.82 % (3459/3465); `pnpm e2e` 78 passed, 0 failed, 1.3 min (1 new). Screenshots at 360×800 shown in the chat.

Differences from the row: none. Technical choices (ADR 002): the edit is made in edit mode only, as it changes the sheet's structure (SPEC §7.2); Save is off when the field and note equal the stored edit; the number field is text with a decimal keypad, read by `typedNumber`, so "−" and "+" work and "1e3" does not.

Found, not fixed: a second context menu on the same number opens nothing, since `usePress` clears its long-press flag only on a left press or click (`SheetNumber.tsx`): new row SHEET-78, XS. No screen edits a key path: new row SHEET-79, S.

Changelog: "Open a number's breakdown in edit mode and set it by hand with a note, or take the edit away, each with Undo; the breakdown shows it as a manual edit and every number that reads it follows."

---

### SHEET-58 The sheet's "⋯" menu opens the character's actions

**Hat:** The sheet's "⋯" opens the list of the character's actions
**Depends on:** SHEET-30 (the empty panel and its open state), SHEET-25 (`ActionRows`), SHEET-56 (`BottomSheet`)
**Size:** S
**Screen:** Yes — the sheet's "⋯" menu; board `V3-Actions` in `docs/design/mockups/` and its row in `docs/design/BRIEF.md` Part 5 ("P4"). ADR 013 item 2.

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/panels/ActionsMenu.tsx` — changes: the panel SHEET-30 left empty.
- `apps/web/src/shared/CharacterActions.tsx` — change: `ActionRow` is exported; `ActionRows` takes `first`, `beforeDelete` and `afterDelete`.
- `apps/web/src/locales/en/actions.json` — change: `levelUp`, `rules`, `history`.

#### 2. What is missing now

The "⋯" button in the header (`onActions`) sets `open` to `actions` and the frame mounts `ActionsMenu`, which returns `null`: nothing opens. `apps/web/test/sheet.test.tsx` expects the empty string from it.

#### 3. What it should look like when done

1. "⋯" on the sheet opens a sheet from the bottom titled with the character's name ("Golden B"), with a close button, over a dimmed screen. Escape and a tap on the dim close it.
2. The rows, top to bottom (ADR 013 item 2, BRIEF P4): Level up, Link for the DM, Export, Copy, Transfer, Rules options, Change history, Delete.
3. Level up, Link for the DM, Transfer, Rules options and Change history show "Coming later" and cannot be tapped. Export, Copy and Delete run SHEET-25's actions.
4. Export saves `Golden B.json` and closes the menu. Copy stores "Golden B (copy)" and the sheet stays open on the same character.
5. Delete closes the menu, goes back to My characters, and the toast "Golden B deleted" offers "Undo"; Undo brings the character back.
6. Rest and Edit stay header buttons.
7. The gate is green.

#### 4. How to do it

1. `ActionRows` gets `first` (above the list), `beforeDelete` (between Transfer and Delete) and `afterDelete`. Delete runs `onClose()`, `afterDelete?.()`, then deletes: the sheet leaves first, so it never draws a character that is gone. My characters passes none of them.
2. `ActionsMenu` is a `BottomSheet` with the character's name; its body is `ActionRows` with Level up as `first`, Rules options and Change history as `beforeDelete`, and `afterDelete` navigating to `paths.characters`.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

At 360×800, a sheet with the name as its title, then eight rows of an icon, the name of the action and a line under it: "Coming later" in muted text on five, "A file of this character" under Export, "Undo stays available for a moment" under Delete (in the danger colour). Keys: `actions.json` `levelUp`, `rules`, `history` with SHEET-25's; `comingLater` from `common.json`. Screenshots in the chat.

#### 7. Tests

- `apps/web/test/sheet-actions.test.tsx` — 2 tests on golden B: the dialog is named by the character; the eight rows in order with the five that wait disabled.
- `apps/web/test/sheet.test.tsx` — the panel list of empty files loses `ActionsMenu` (it is filled).
- `apps/web/e2e/sheet.spec.ts` — 1 test: the rows and their order, the five disabled, Export's file name, Copy staying on the sheet, Delete going to My characters with the toast, Undo bringing it back.
- Control values: the ADR 013 order; golden B's name and the file name `Golden B.json` (SHEET-25's own).

#### 8. Checked against the source

ADR 013 item 2 and `docs/design/BRIEF.md` P4: the order and the five rows that wait. Nothing else to check.

#### 9. Not in this ticket

- Level up (phase 4), Link for the DM and Transfer (the table link, ADR 005), Rules options (phase 4's house rules): shown as coming later. The board's "Fighter 1 → 2" line under Level up waits with Level up.
- Change history's list and its undo: SHEET-59. The row shows as coming later until then.
- Export as PDF (BRIEF P4: "Export (file, PDF)"): phase 6.

#### 10. Rake check

- No look in a component, no literal string: parts, tokens and `actions.json` keys only; the rows are SHEET-25's.
- Nothing hard-codes a system: the menu reads the character from the sheet and asks the module for nothing.
- A person's saved data: Delete is the one destructive row and has "Undo" through the toast, as SHEET-25 made it.

#### 11. What came out of it

Quality gate, 2026-11-04: `pnpm lint` 429 files, no fixes; `pnpm typecheck` clean; `pnpm test` 134 files, 1528 passed, 0 failed, 33.3 s (2 new, from 1526), then speed 2 passed; coverage statements 99.07 % (3946/3983), lines 99.82 % (3459/3465); `pnpm e2e` 79 passed, 0 failed, 1.3 min (1 new). Screenshots at 360×800 shown in the chat.

Differences from the row: Change history shows as coming later too: the row names four rows that wait and SHEET-59, which builds the list, is not closed. Technical choices (ADR 002): Delete navigates before it deletes, so the sheet never shows a missing character; the menu's title is the character's name, as My characters' Actions are.

Found, not fixed: nothing.

Changelog: "The sheet's ⋯ menu lists the character's actions: Export, Copy and Delete work from it (Delete goes back to My characters, with Undo); Level up, Link for the DM, Transfer, Rules options and Change history show as coming later."

---

### SHEET-29 The manual form shows the ability bonus window

**Hat:** The manual form's Origin step shows the ability bonus window
**Depends on:** SHEET-27 (the form and its empty `AbilityBonusWindow`), ENG-35 and ENG-68 (`abilities.bonusSource`, `abilityBonusConflict`), ADR 017
**Size:** S
**Screen:** Yes — step 5 of the manual form, `docs/design/BRIEF.md` Part 5 ("P3", step 6); board `V3-Conflict` in `docs/design/mockups/`. ADR 017.

---

#### 1. Where the code lives

**Main file:** `apps/web/src/pages/create/AbilityBonusWindow.tsx` — changes: the file SHEET-27 left empty.
- `packages/system-5e/src/manual-ability-bonus.ts` — new: `manualAbilityBonus`, `AbilityBonusShown`, `BonusGiverShown`.
- `packages/system-5e/src/manual.ts` — change: `ManualCharacterAsk.bonusSource` (the rules base's source when absent).
- `packages/system-5e/src/ability-bonus.ts`, `module.ts` — change: `bonusGivers` and `ruledGrants` are exported.
- `apps/web/src/pages/create/draft.ts` — change: `Draft.bonusSource`, `StepProps.bonus`, `askOf` passes the pick.
- `apps/web/src/pages/NewCharacterPage.tsx`, `apps/web/src/systems.ts` — change: the form asks its system for the window's content (`ManualFormSystem.abilityBonus`).
- `apps/web/src/locales/en/create.json` — `window.*`.

#### 2. What is missing now

`AbilityBonusWindow` returns `null`, and `OriginStep` already draws it. A Dwarf (2014) with a Soldier (2024) gives `abilityBonusConflict` in `computed.warnings` (golden F, `golden-values.test.ts`), but the form never shows it and always stores the rules base's source: `manualCharacter` has no way to take another.

#### 3. What it should look like when done

1. With a species or race and a background that both raise ability scores, the Origin step shows an amber group "Two sources raise your abilities", a line saying so, a line "Using: …" and a "Choose" button. With one side only, or none, nothing shows.
2. "Choose" opens a popup of the same title: "The species and the background both give ability bonuses. Use:", two tick boxes, "Species · Dwarf · 2014" with "CON +2" under it, and "Background · Soldier · 2024" with "+2 +1 or +1 +1 +1 over STR, DEX, CON" under it; then "In a campaign, the DM decides: one, or both." and "Apply".
3. The ticks are the stored source: one, both or neither (ADR 017 item 2). The 2024 rules base starts with the background ticked, the 2014 one with the species (ADR 017 item 5).
4. Each tick changes the live bar at once. Constitution typed as 14 on a fighter: hit points 10 + 2 = 12 with the background or neither; 10 + 3 = 13 with the species or both (the Dwarf's +2 makes 16).
5. Both ticked says "Both are on. Each ruleset expects only one of them. You can keep both."; neither says "Neither is on. You can keep it that way."
6. The warning stays whatever is ticked (ADR 017 item 4), and "Create" stays on (item 3). The saved character keeps the pick: its Constitution reads 16 for the species.
7. The gate is green.

#### 4. How to do it

1. `manualAbilityBonus(character, index)` (module): the givers of each side by `bonusGivers` (ENG-35), each with the fixed increases and the patterns its grants hold at the character's level, and the stored source. `undefined` when a side gives none.
2. `ManualCharacterAsk.bonusSource` is stored as `abilities.bonusSource`; absent, the rules base's (ENG-19).
3. The form keeps the pick in `Draft.bonusSource` (absent until the person picks), passes it in `askOf`, and `NewCharacterPage` gives the window `form.abilityBonus(made.character, index)` as `bonus`.
4. The window draws the group and, on "Choose", a `BottomSheet` with two `Tick`s. A tick stores the source of the sides ticked (`sourceOf`); the preview follows. Stat names come from the form's own stats.

#### 5. Stored data

Nothing stored changes shape: `systemData.abilities.bonusSource` has the four values since ENG-68. The form's draft is not stored.

#### 6. What a person will see

At 360×800, under the Background picker, an amber group: the title in bold, the warning, "Using: the background bonuses", and "Choose". The popup is a bottom sheet: the title, the intro, two tick rows (the label, the bonuses under it), the note that fits the ticks, the campaign line, and a full-width "Apply". Keys: `create.json` `window.title`, `warn`, `using.*`, `choose`, `intro`, `side`, `fixed`, `spread`, `plus`, `or`, `both`, `neither`, `campaign`, `apply`. Screenshots in the chat.

#### 7. Tests

- `packages/system-5e/test/manual-ability-bonus.test.ts` — 5 tests on golden F's mix: each side's givers and what they give; nothing for one side; the rules base's source by default; each of the four stored sources and the Constitution it gives (16, 14, 16, 14); the warning stays and nothing blocks.
- `apps/web/test/create.test.ts` — 3 tests: the ask carries a source only when picked; the stored source; the window's content for a mix and none for one side.
- `apps/web/test/ability-bonus-window.test.tsx` — 3 tests: the warning's text and "Choose"; the four "Using" lines and the rules base's word; nothing for one side or none.
- `apps/web/e2e/create.spec.ts` — 1 test: the warning appears only with both sides; the popup's labels and bonuses; both, species only, neither and background in turn with the hit points 12 / 13 / 13 / 12 / 12; the warning stays; Create keeps the species' pick (Constitution 16 on the sheet).
- Control numbers from: `srd-2014.ts` (Dwarf `con +2`), `srd-2024.ts` (Soldier `distribute` over str, dex, con with `[2, 1]` and `[1, 1, 1]`), golden B's base Constitution 14 (SPEC §6.7), hit points = the d10's maximum 10 + the Constitution modifier (floor((16 − 10) / 2) = 3, floor((14 − 10) / 2) = 2).

#### 8. Checked against the source

ADR 017 (items 1 to 5) and ENG-35's own rules (`ability-bonus.ts`): which side applies for each source, and the warning for every mix. The increases of the two entities are read from the packs' grants. The hit points follow the engine's own computation, hand-checked above. Nothing else to check.

#### 9. Not in this ticket

- The creation wizard's own window (phase 4): it shows the same thing.
- In a campaign the DM decides (ADR 013 item 10): the popup says so; the table link makes it so.
- A lineage the person has not chosen (a Hill Dwarf's +1 Wisdom): the form makes no choices, so the window shows what is known now. The choice is the sheet's badge (SHEET-36).

#### 10. Rake check

- Every rule lives in the module: which side gives, what each grants, and the stored source are `system-5e`'s; the window only draws them.
- The core names no game: `StepProps.bonus` is the module's shape; the stats' names come from the packs' entries, not from a list in the component.
- Prerequisites and warnings never block: "Create" stays on with every source; the warning stays (ADR 017 items 3, 4).
- No look in a component, no literal string: parts, tokens and `create.json` keys only.

#### 11. What came out of it

Quality gate, 2026-11-04: `pnpm lint` 432 files, no fixes; `pnpm typecheck` clean; `pnpm test` 136 files, 1539 passed, 0 failed, 34.1 s (11 new, from 1528), then speed 2 passed; coverage statements 99.07 % (3961/3998), lines 99.82 % (3471/3477); `pnpm e2e` 80 passed, 0 failed, 1.3 min (1 new). Screenshots at 360×800 shown in the chat.

Differences from the row: none. Technical choices (ADR 002): the ticks write the stored source at once, so "Apply" only closes the popup (the board draws it, and a person can still leave with Escape or the close button); the group shows "Using: …" so the choice is visible without opening the popup (ADR 017 item 1's "sign"); the word for the species is the rules base's (`terms`), as the Origin step's picker uses it.

Found, not fixed: nothing.

Changelog: "When your species or race and your background both raise ability scores, the new-character form warns and a popup lets you take one, both or neither; the live numbers follow each tick, and Create stays on."

---

### SHEET-52 Custom entries are added as free text

**Hat:** Edit mode adds a custom item and a custom feature as text
**Depends on:** SHEET-50 (the Gear tab), SHEET-48 (the Features tab), SHEET-22 (`withDropped`), SHEET-23 (Undo)
**Size:** S
**Screen:** Yes — edit mode's "Add to the sheet"; board `V3-Add` in `docs/design/mockups/`, its row in `docs/design/BRIEF.md` Part 5 ("P4"). ADR 009 item 7, SPEC §12 stage 2.

---

#### 1. Where the code lives

**Main file:** `apps/web/src/sheet/panels/AddPanel.tsx` — new: the list and the two forms.
- `packages/system-5e/src/custom.ts` — new: `addCustomItem`, `addCustomFeature`, `removeCustomFeature`, `customFeatureId`.
- `apps/web/src/sheet/SheetAdd.tsx` — new: the "+" in edit mode; `apps/web/src/pages/SheetPage.tsx` — change: mounts it and the panel.
- `apps/web/src/sheet/sections/Items.tsx` — change: a row's words show under its name. `apps/web/src/sheet/sections/FeatureList.tsx` — change: a "Remove" button on a feat of the character's own in edit mode.
- `apps/web/src/settings/units.ts` — change: `storedWeight`. `apps/web/src/systems.ts` — change: `SheetSystem.addCustomItem`, `addCustomFeature`, `removeCustomFeature`.
- `apps/web/src/locales/en/add.json` — new namespace; `toast.json`, `sheet.json`, `features.json` — new keys.

#### 2. What is missing now

The stored shape holds both already: an inventory row's `custom` (`inventoryRowSchema`) and the character's own entities (`localEntities`, pack `character`). Nothing writes either: `grep -rn "custom:" apps/web/src` finds no writer, and the Gear tab draws a custom row's name (SHEET-50) but a person cannot make one.

#### 3. What it should look like when done

1. In edit mode a round "+" ("Add to the sheet") shows at the left, 16 px above the dock, on every tab. Play mode shows none.
2. It opens a sheet "Add to the sheet" with two rows: "Custom item" ("Armor, weapon or gear of your own") and "Custom feature" ("A trait or feat of your own, as text").
3. Custom item: fields Name, Weight (in the person's unit), How many (1 to 999, starting at 1), Description. "Add" is off until the name shows a character, the weight (when typed) is a number above 0 and the count is a whole number from 1.
4. The item is a new last row of the Gear tab: its name, "×2 · 20 lb" for two of 10 lb, its words under the name. Chain mail 55 lb + greatsword 6 lb + two ropes of 10 lb is "Carrying 81 lb". It has no "Worn" switch; the stepper, "Kept in" and "Remove" work as on any row.
5. Custom feature: fields Name and Description. It appears under "Feats" on the Features tab, opens its description in place, and "See full description" shows its words with "Source: your own entry". In edit mode it has "Remove <name>".
6. Each add and the removal is one change with its "Undo" toast ("Rope added", "Keen Eyes added", "Keen Eyes removed"); Undo reverses it. Both are stored: a reload keeps them.
7. Text only: no number changes (golden B keeps AC 17 and 12 hit points).
8. The gate is green.

#### 4. How to do it

1. `addCustomItem`: a row with `custom: { name, weight? }`, the words in `note`, not worn, not attuned; refused as `noName`, `badWeight`, `badQuantity`. The weight is stored in pounds (SPEC §7.5); the form converts what is typed in kilograms with `storedWeight` (the pound's own definition, 0.45359237 kg, to a hundredth).
2. `addCustomFeature`: an entity `character:feat/<slug>` (type `feat`, ruleset `any`, name and text in English, no effect) added to `localEntities` and named in `systemData.feats`; one entry, two changes. The slug is made by the app (`custom-` and 8 hex digits) so an id never changes with the name (SPEC §5.1). Refused as `noName`, `badId`, `idUsed`.
3. `removeCustomFeature` takes it from both lists and ends with `withDropped` (SHEET-22). Removing a custom item is `removeRow` (SHEET-50).
4. `SheetAdd` and `AddPanel` hold the UI; `FeatureList` and `Items` show the results.

#### 5. Stored data

Nothing stored changes shape: `inventory[].custom` and `note`, `localEntities` and `systemData.feats` exist. No `schemaVersion` bump.

#### 6. What a person will see

At 360×800: the "+" over the dock at the left, mirroring the dice button; the panel as a bottom sheet; the item form is Name, then Weight and How many side by side, a hint under them, Description, and "Back" and "Add"; the feature form is Name, Description, "Back", "Add". A refusal shows in an amber line. Keys: `add.json` (`title`, `item.*`, `feature.*`, `name`, `weight`, `weightHint`, `quantity`, `text`, `textPlaceholder`, `add`, `back`, `refused.*`), `sheet.json` `add`, `features.json` `remove`, `toast.json` `addItem`, `addFeature`, `removeFeature`. Screenshots in the chat.

#### 7. Tests

- `packages/system-5e/test/custom.test.ts` — 13 tests on golden B: the row and its fields; carried (71 lb, 81 lb for two); AC 17 and 12 hit points unchanged; no weight, no words; the refusals; reverse. The feature's entity and both lists; the Features tab's "feats" group; no number or warning changes; the refusals; removal back to the start; reverse.
- `apps/web/test/add.test.tsx` — 5 tests: the "+" in edit mode only; the panel's two rows; the remove button only on a feat of its own in edit mode; the feat listed under "Feats"; `storedWeight`.
- `apps/web/test/gear.test.tsx` — 2 tests: a custom row's name, "×2 · 20 lb", its words and the 81 lb total; no "Worn" switch, but a stepper and "Remove".
- `apps/web/e2e/sheet.spec.ts` — 1 test: no "+" in play mode; the list; the item form's three checks on "Add"; two ropes, 81 lb, its words; Undo; a feature, its description and its source line; a reload; Remove and Undo.
- Control numbers from: SPEC §6.7 golden B (chain mail 55 lb, greatsword 6 lb, AC 17, 12 hit points), hand-added: 55 + 6 + 10 = 71, + 2 × 10 = 81; 2 kg ÷ 0.45359237 = 4.409 lb, which is 4.41; 0.5 kg is 1.102 lb, which is 1.1.

#### 8. Checked against the source

Nothing rules-bound: free text changes no number (ADR 009 item 7). The weight rate is the pound's definition (SHEET-50 §8). Nothing else to check.

#### 9. Not in this ticket

- Custom items and features with effects: phase 5 (HB).
- Custom sections and companions: SHEET-57, which adds its rows to this panel's list.
- A custom stat: later (ADR 009 item 9).
- Editing an entry's name, weight or words after it is added: new row SHEET-80. A typing error means remove and add again.

#### 10. Rake check

- Everything is data: a custom feature is an entity like any other; the sheet names no game, and `SheetSystem` carries the actions.
- Ids are stable: the feature's id is made once and never from its name.
- Stored units are pounds: kilograms are converted on the way in, and shown back by `shownWeight`.
- Missing is not broken: a custom feature whose entity is missing shows `Missing: <id>` as any entry does.
- Formulas never run code: none here; the text is plain text, shown as text.
- No look in a component, no literal string: parts, tokens and `add.json` keys only. Entity names stay bilingual: `name.en` is written; `name.ru` waits for the Russian phase.

#### 11. What came out of it

Quality gate, 2026-11-04: `pnpm lint` 438 files, no fixes; `pnpm typecheck` clean; `pnpm test` 138 files, 1559 passed, 0 failed, 34.2 s (20 new, from 1539), then speed 2 passed; coverage statements 99.05 % (4000/4038), lines 99.8 % (3506/3513); `pnpm e2e` 81 passed, 0 failed, 1.4 min (1 new). Screenshots at 360×800 shown in the chat.

Differences from the row: none. Technical choices (ADR 002): the board draws the "Add to the sheet" list but not what opens it, so a round "+" over the dock opens it, in edit mode only (the header is full at 360 px: SHEET-70); a custom feature is a feat of the character's own, so the Features tab's existing "Feats" group lists it; the words of a custom item are the row's `note`, as the stored shape has no other place; the form's count runs 1 to 999 as the creation form's stepper does.

Found, not fixed: an entry cannot be edited after it is added (new row SHEET-80, S).

Changelog: "In edit mode a + button adds a custom item (name, weight, how many, description) to the Gear tab or a custom feature (name, description) to the Features tab, as text only; each has Undo, and a custom feature can be removed."

---

### SHEET-57 Custom sections hold the person's own lists

**Hat:** A character keeps its own named lists as tabs
**Depends on:** SHEET-52 (the "+" and `AddPanel`), SHEET-30 (the tabs), SHEET-23 (Undo)
**Size:** S
**Screen:** Yes — edit mode's "Add to the sheet" and a section's tab; board `V3-Add` in `docs/design/mockups/`, its row in `docs/design/BRIEF.md` Part 5 ("P4"). ADR 009 items 7 and 8.

---

#### 1. Where the code lives

**Main file:** `packages/schema/src/character.ts` — changes: `sections` in the core part, `CHARACTER_SCHEMA_VERSION` 3, the 2 → 3 step.
- `packages/engine/src/sections.ts` — new: `addSection`, `removeSection`, `addSectionEntry`, `removeSectionEntry`, `SectionRefusal`; exported from `index.ts`.
- `apps/web/src/sheet/sections/SectionList.tsx` — new: a section's tab. `apps/web/src/sheet/tabs.ts`, `SheetDock.tsx`, `apps/web/src/pages/SheetPage.tsx` — change: a tab for each section; `tabIdsOf`; `swipedTab` takes the ids.
- `apps/web/src/sheet/panels/AddPanel.tsx` — change: "New section" and "Companion" rows, and the entry form.
- `packages/system-5e/src/manual.ts` — change: a new character has `sections: []`.
- `apps/web/src/locales/en/sections.json` — new namespace; `add.json`, `toast.json` — new keys.
- Test fixtures: the goldens, Tales' characters and the 5e character literal are at version 3 with `sections` (see §5).

#### 2. What is missing now

The core holds no lists of the person's own: `grep -rn sections packages/schema/src` finds none. ADR 009 item 8 asks for them "next to the built-in tabs"; SHEET-52 left the "+" panel with two rows.

#### 3. What it should look like when done

1. In edit mode "+" → "New section" (a name; "Mounts, Pets, Familiars, Notes, or any list") adds a tab after the built-in ones, named by the person, and opens it. A name that shows nothing leaves "Add" off.
2. The tab shows a card with the section's name and its entries: each entry's name, and under it its words, kept in lines. An empty section says "Nothing here yet."
3. In edit mode the card has "Add an entry" (opens the entry form for that section), a remove button on each entry, and "Remove section". Play mode only reads: no button.
4. "+" → "Companion" ("Familiar, pet or mount, with a small stat block") opens the same entry form with a Section picker; the entry goes to the section picked and its tab shows. With no section, the form says "Add a section first, such as Mounts." and "Add" is off.
5. Each add and remove is one change with its "Undo" toast ("Mounts added", "Dapple added", "Dapple removed", "Mounts removed"). Removing the section whose tab is open goes back to Main; Undo brings the tab back.
6. A swipe sideways moves along the tabs into the sections and back; the arrow keys too.
7. Everything is stored; a character saved before this opens with no sections, and saves as version 3.
8. The gate is green.

#### 4. How to do it

1. `sectionSchema`: `{ id (uuid), name, entries: [{ id (uuid), name, text? }] }`, ids unique; `sections` is a required list of the core part. `CHARACTER_MIGRATIONS` gets the step `(file) => ({ sections: [], ...file })`: pure, a file that holds sections keeps them.
2. The four actions work on the whole list at `['sections']` (a log path steps only through objects, ENG-63), as `setOverride` does; ids are the app's; a name is trimmed and must show a character; no id is used twice across sections and entries.
3. Tabs: `tabIdsOf(sections)` is the built-in ids then the sections'; `tabOf(value, sections)` finds one; the dock draws a tab for each; the frame draws `SectionList` for a section's tab.
4. `AddPanel` gets `section` and `entry` views; a new section or an entry made from the panel opens that tab (`?tab=`).

#### 5. Stored data

`CharacterDoc` changes: `sections` is new (SPEC §5.8 lists the core's fields; ADR 009 item 8 adds this one). The core's `schemaVersion` goes **2 → 3**, with a step that returns the file with `sections: []`. Tests: `packages/schema/test/migration.test.ts` — a character of version 2 opens as version 3 with no sections and every other field as it was; the step is pure (a frozen file is not changed, a new object comes back, held sections stay); a character of version 1 opens through both steps; version 4 is refused as newer. `packages/schema/test/character.test.ts` — the section's shape. The golden characters, Tales' characters and the 5e test character are stored files, so they are at version 3 with `sections: []`: a change of shape, not of value (ENG-61 did the same for version 2); no expected value of a golden changed. The pack's version is not touched (a pack has no sections).

#### 6. What a person will see

At 360×800: a tab named by the person after Notes (the tab strip scrolls sideways); its card with the name as a heading, the entries (bold name, muted words), and in edit mode a full-width "Add an entry" and "Remove section" under them, the entries' ✕ on the right. The forms are SHEET-52's panel: "New section" is one field; "New entry" is Section, Name and "Stat block or description". Keys: `sections.json` (`none`, `addEntry`, `removeEntry`, `removeSection`), `add.json` (`section.*`, `entry.*`, `refused.noSection`, `refused.idUsed`), `toast.json` (`addSection`, `removeSection`, `addEntry`, `removeEntry`). Screenshots in the chat.

#### 7. Tests

- `packages/engine/test/sections.test.ts` — 10 tests on Tales' Ash: a section at the end as one entry that changes only the lists; order kept; refusals (no name, id used by a section or an entry); apply again and reverse; an entry to its own section only, its words trimmed, none when blank; refusals; removing an entry, a section with its entries, and what is not there.
- `packages/schema/test/migration.test.ts` — 4 new tests (version 3), and the version 1 and "newer" tests moved to the current numbers; `packages/schema/test/character.test.ts` — 1 new test on the section's shape, the full character has two sections.
- `apps/web/test/sections.test.tsx` — 9 tests on golden B: the tab ids and `tabOf`; a swipe into and out of the sections; a tab for each section in the dock; the card's entries and words; an empty section; play and edit mode; a missing section; the panel's four rows; the entry form opened for a section.
- `apps/web/e2e/sheet.spec.ts` — 1 test: a character saved at version 2 opens with 8 tabs; a section; its tab, open; an entry from its button; a companion from the panel; a reload; play mode reads only; remove an entry, remove the section, Undo.
- Control values: the tab counts (8 built-in, 9 with a section, 10 in the unit test with two) from `SHEET_TABS`; Tales' Ash for the engine; golden B for the screen. No rules number is involved: golden values are unchanged and their tests pass untouched.

#### 8. Checked against the source

ADR 009 items 7 and 8 and SPEC §5.8 (the migration rule: a pure `vN → vN+1` step with its own test). The wave rule in `BACKLOG.md`: this is the one row of its batch that changes a stored shape. Nothing rules-bound to check.

#### 9. Not in this ticket

- A companion with a sheet of its own: the table link (ADR 014 item 9). A companion here is an entry with its stat block as text.
- Renaming a section, editing an entry, putting entries in another order: not asked; they join SHEET-80's editing row (custom entries) if wanted.
- A section's entries with effects: phase 5 (HB).

#### 10. Rake check

- A stored-shape change needs a migration: `schemaVersion` 3 and a pure step with its own test (§5).
- The core names no game: the lists are the core's (`schema`, `engine`); no system module knows them.
- Ids are stable: a section's and an entry's id never change with a name.
- Missing is not broken: a `?tab=` naming a section that is gone shows Main; a section that is not there draws nothing.
- No look in a component, no literal string: parts, tokens and `sections.json`, `add.json` keys; a name the person typed is shown as typed.
- Nothing invisible: names and text must show a character (`visibleTextSchema`).

#### 11. What came out of it

Quality gate, 2026-11-04: `pnpm lint` 443 files, no fixes; `pnpm typecheck` clean; `pnpm test` 140 files, 1583 passed, 0 failed, 34.6 s (24 new, from 1559), then speed 2 passed; coverage statements 99.04 % (4051/4090), lines 99.77 % (3551/3559); `pnpm e2e` 82 passed, 0 failed, 1.5 min (1 new). Screenshots at 360×800 shown in the chat.

Differences from the row: none. Technical choices (ADR 002): a section is a tab (ADR 009 item 8: "next to the built-in tabs"), so the tab list is built from the character's sections; a companion is the entry form with a Section picker, since the row makes it "such an entry"; the `sections` field is the core's, so every system has it, and it goes in the core's version, not the module's; removing a section removes its entries (one Undo brings both back).

Found, not fixed: (1) the toast sits over both round buttons, the dice and the "+" (the screenshot of the entry shows it), for its 5 seconds: new row SHEET-81, XS. (2) After a tap on the toast's "Undo", the next toast stayed on screen for over 10 seconds in this test, past `TOAST_MS`; `ToastHost` pauses the timer while the toast has focus and a button that is removed sends no blur, which is the likely cause (not checked): new row SHEET-82, XS.

Changelog: "In edit mode you can add a section of your own, such as Mounts or Pets, as a tab after the built-in ones, with entries of a name and free text (a companion's stat block among them); each add and remove has Undo."

---

### SHEET-82 The toast goes after its time once Undo was tapped · XS

**Hat:** The toast's hold follows where the focus is
**Where:** `apps/web/src/shared/ToastHost.tsx` — `ToastHost`
**Depends on:** SHEET-23 (the toast and its timer)
**Screen:** No — the toast keeps its look (board `V3-Features`).

**What it should look like when done:**
1. After a tap on the toast's "Undo", the toast of the next change goes after `TOAST_MS` (5 s), like any other.
2. A toast whose own button has the focus still stays while the focus is there (SHEET-23).
3. The gate is green.

**Tests:** `apps/web/e2e/sheet.spec.ts` — 1 test on golden B: add 1 gold, tap "Undo", add 1 gold again; the second toast is gone within 7 s. The unit tests draw to a string and have no focus, so the focus is checked in the browser only. Control value: `TOAST_MS` = 5000.
**What came out of it:**
Cause checked: the test was written first and failed on the old code (the second toast's "Undo" was still visible after 7 s). `onBlur` never ran for the tapped button, because the browser sends no blur for an element that is removed. The new code reads the focus itself each time the toast changes (`host.contains(document.activeElement)`), so the hold ends with the button; the same test then passed.

Quality gate, 2026-11-04: `pnpm lint` 443 files, no fixes; `pnpm typecheck` clean; `pnpm test` 140 files, 1583 passed, 0 failed, 40.7 s (0 new), then speed 2 passed; coverage statements 99.04 % (4051/4090), lines 99.77 % (3551/3559); `pnpm e2e` 83 passed, 0 failed, 1.7 min (1 new).

Differences from the row: none. The focus events stay for the case where the focus moves in or out while one toast shows.

Found, not fixed: nothing.

Changelog: "The toast after a change goes after 5 seconds also when the toast before it was undone."

---

### SHEET-81 The toast stops covering the round buttons · XS

**Hat:** The toast sits above the round buttons
**Where:** `apps/web/src/shared/ToastHost.tsx` — the toast's `bottom`; `apps/web/src/sheet/SheetDock.tsx` — writes `--toast-lift` while the sheet is open
**Depends on:** SHEET-30 (the dock and the dice button), SHEET-52 (the "+"), SHEET-82 (the timer)
**Screen:** Yes — the sheet's toast (board `V3-Features` draws the toast and the dice button at the same height, 132 px from the bottom, so the board does not settle it; the choice is in §11).

**What it should look like when done:**
1. On the sheet the toast sits 64 px higher than before: its bottom edge is above the top edges of the dice button and the "+" (16 px above the dock, 56 px high, plus an 8 px gap).
2. While the toast shows, a tap on the dice button and a tap on the "+" work at once.
3. Off the sheet (no dock) the toast stays where it was.
4. With a panel open the toast still moves to the top (SHEET-71).
5. The gate is green.

**Tests:** `apps/web/e2e/sheet.spec.ts` — 1 new test on golden B in edit mode: after a coin change the toast's bottom edge is at or above both buttons' top edges, its width is 328, and a click on each button (1 s limit) opens its panel; it failed on the old code (toast bottom 670, buttons' top 614). The SHEET-30 e2e test now expects the toast at 16 + 64 px above the dock. `apps/web/test/sheet.test.tsx`, `toast.test.tsx` — the toast's class string. Control values: 56 px is `size-14` of the two buttons; 16 px their gap above the dock, both from their own files.
**What came out of it:**
Quality gate, 2026-11-04: `pnpm lint` 443 files, no fixes; `pnpm typecheck` clean; `pnpm test` 140 files, 1583 passed, 0 failed, 38.4 s (0 new), then speed 2 passed; coverage statements 99.04 % (4051/4090), lines 99.77 % (3551/3559); `pnpm e2e` 84 passed, 0 failed, 1.8 min (1 new). Screenshot at 360×800 shown in the chat.

Differences from the row: none. Technical choice (ADR 002): the row offers "one moves, or the toast leaves their columns"; the toast moves up, because it keeps its full width and the "+" is in the left column and the dice button in the right one, so no column is free. The dock writes the lift (`--toast-lift`, removed when the sheet closes), so a page with no round buttons keeps the old place. Nothing is hard-coded in a skin-able look: it is a position, not a colour or a font.

Found, not fixed: nothing.

Changelog: "On the sheet the toast with Undo now sits above the dice button and the + button, so both can be tapped while it shows."

---

### SHEET-78 A second context menu on the same number opens its breakdown · XS

**Hat:** A mouse's context menu leaves no long-press flag behind
**Where:** `apps/web/src/sheet/SheetNumber.tsx` — `usePress`
**Depends on:** SHEET-33 (the breakdown), SHEET-30 (`usePress`)
**Screen:** No — the breakdown sheet does not change.

**What it should look like when done:**
1. A right-click on a number opens its breakdown every time, also the second and third, with the sheet closed between them.
2. A touch long press still opens the breakdown once; the browser's context menu that follows it does not open it twice; the click that ends the press is not a tap.
3. After a right-click a left click is a tap again.
4. The gate is green.

**Tests:** `apps/web/test/press.test.tsx` — 4 tests: the handlers are taken from one render and called as the browser would (fake timers): three right-clicks open three times and never tap; a left click after a right-click taps; a touch long press opens once, the following context menu does not, the click is no tap, the next tap taps; a context menu before the timer on touch opens once and swallows the click. `apps/web/e2e/sheet.spec.ts` — 1 test on golden B: three right-clicks on Strength, each followed by Escape. Control value: "Strength score 17 = Base 15, Soldier +2", as the SHEET-33 test has it.
**What came out of it:**
Cause checked: the row is right. A right-click gives a pointer down with button 2, which returned before the flag was reset; the context menu then set the flag, and a right-click has no click after it, so nothing cleared it. The new unit test failed on the old code at the second right-click ("called 2 times, but got 1 times").

Quality gate, 2026-11-04: `pnpm lint` 444 files, no fixes; `pnpm typecheck` clean; `pnpm test` 141 files, 1587 passed, 0 failed, 35.9 s (4 new, from 1583), then speed 2 passed; coverage statements 99.04 % (4051/4090), lines 99.77 % (3551/3559); `pnpm e2e` 85 passed, 0 failed, 1.8 min (1 new).

Differences from the row: the row says the flag is cleared when the breakdown opens or closes. Technical choice (ADR 002): it is cleared where it ends. Every pointer down now clears it, and a context menu that comes from a mouse's other button clears it at once, because no click follows it. So the hook does not need to know when the breakdown closes.

Found, not fixed: nothing.

Changelog: "A right-click on a number on the sheet opens its breakdown every time, not only the first."

---

### SHEET-77 A disabled button looks different from an enabled one · XS

**Hat:** A disabled button part is drawn fainter, from a token
**Where:** `apps/web/src/theme/shape.ts` — the token `opacity-disabled`; `apps/web/src/index.css` — the rule on the button parts
**Depends on:** SHEET-04 (the button parts)
**Screen:** Yes — every button part; no board draws a disabled button, so the look is the one the panels already used (half opacity). `docs/design/BRIEF.md` Part 5 has no row for it.

**What it should look like when done:**
1. A `button`, `button-secondary` or `icon-button` part with `disabled` is drawn at the token's opacity (0.5) and shows the not-allowed cursor; an enabled one is at 1.
2. The Items card's "One less" at quantity 1, the Coins card's "−10" and "−1" under their amounts, and the override form's Save with nothing to save are drawn so.
3. The opacity is the theme token `opacity-disabled` (Tailwind `opacity-disabled`, CSS `--theme-opacity-disabled`): a skin that sets it changes every disabled button.
4. The panels that wrote `disabled:opacity-50` use the token (`disabled:opacity-disabled`), so one value governs them.
5. The gate is green.

**Tests:** `apps/web/test/theme.test.ts` — 1 new test: the token is 0.5; the rule is written for the three parts, reads the token and sets the cursor; `index.css` maps it (the existing "maps every key once" test also passes). `apps/web/e2e/sheet.spec.ts` — 1 test on golden B with 12 gold: "Take 1 copper" (disabled) has computed opacity 0.5 and cursor not-allowed; "Take 10 gold" (enabled) 1 and default; setting `--theme-opacity-disabled` to 0.2 on the root makes the disabled one 0.2. Control value: 0.5, the value the panels' own `disabled:opacity-50` already used, so no screen that looked right changes.
**What came out of it:**
Quality gate, 2026-11-04: `pnpm lint` 444 files, no fixes; `pnpm typecheck` clean; `pnpm test` 141 files, 1588 passed, 0 failed, 36.3 s (1 new, from 1587), then speed 2 passed; coverage statements 99.04 % (4051/4090), lines 99.77 % (3551/3559); `pnpm e2e` 86 passed, 0 failed, 1.8 min (1 new). Screenshot at 360×800 shown in the chat.

Differences from the row: none on what is drawn. The "no press" part of the row: the app has no pressed look for a button, so the not-allowed cursor is the only other sign; a disabled button already takes no click. Technical choices (ADR 002): the token is a plain theme key (not a part's style pick), because a pick is a shape (border, corner, shadow) and this is a value; the rule sits in `index.css`'s base layer and selects the part by `data-skin-part`, so each button part gets it with no change in its component. Four panels' `disabled:opacity-50` became `disabled:opacity-disabled` (the same 0.5).

Found, not fixed: nothing. Two button parts (`FeatureList`'s "Use", `DicePanel`'s "Done") also wrote `disabled:text-muted`, which would have faded them twice under the new rule; the class is removed from both, so the token alone shows it (second commit of this ticket).

Changelog: "A button that cannot be pressed now (Items' One less at 1, a coin's − at 0, a form's Save with nothing to save) is drawn faint, with a not-allowed cursor."

---

### SHEET-75 A long attribution line wraps in a description · XS

**Hat:** The attribution line breaks inside a long word
**Where:** `apps/web/src/shared/Description.tsx` — `FullText`
**Depends on:** SHEET-47 (the description's full text)
**Screen:** Yes — "See full description" of any entry; no board draws the attribution, so the line keeps its size and colour and only breaks.

**What it should look like when done:**
1. The attribution of the SRD 5.2.1 pack, whose last address (`https://creativecommons.org/licenses/by/4.0/legalcode`) is wider than the card at 360 px, wraps inside the card: no line of the full text is wider than its box.
2. The page stays 360 px wide.
3. The gate is green.

**Tests:** `apps/web/e2e/sheet.spec.ts` — 1 test on golden B: the Features tab, Second Wind, "See full description"; every paragraph of the row has `scrollWidth` not above `clientWidth`, and the page's `scrollWidth` is 360. It failed on the old code (a line was wider than its box) and passed after. Control value: the attribution text is the pack's own (`srd-2024.ts`).
**What came out of it:**
Quality gate, 2026-11-04: `pnpm lint` 444 files, no fixes; `pnpm typecheck` clean; `pnpm test` 141 files, 1588 passed, 0 failed, 36.2 s (0 new), then speed 2 passed; coverage statements 99.04 % (4051/4090), lines 99.77 % (3551/3559); `pnpm e2e` 87 passed, 0 failed, 1.8 min (1 new). Screenshot at 360×800 shown in the chat.

Differences from the row: none. Technical choice (ADR 002): the class is Tailwind's `wrap-anywhere` (`overflow-wrap: anywhere`) on the attribution paragraph only; it breaks a long address at the edge and changes no other line.

Found, not fixed: the entry's text and the "Source:" line have the same plain break rule; no text of the packs has a word that long today, so no row.

Changelog: "A long web address in a pack's attribution, under See full description, now wraps inside the card."

---

### SHEET-70 The header keeps the class line whole beside the choices badge · XS

**Hat:** The class line is never cut
**Where:** `apps/web/src/sheet/SheetHeader.tsx` — the class line's row
**Depends on:** SHEET-36 (the choices badge), SHEET-30 (the header)
**Screen:** Yes — the header of board `V3-Sheet` (the board draws "Fighter 1" with no badge; the badges' place is the row's).

**What it should look like when done:**
1. At 360×800, with the choices badge shown (golden B with its choices taken out: "!8"), the class line reads "Fighter 1" in full, with no "…".
2. The edition chip and the choices badge sit beside the class line when they fit, and on a line under it when they do not; neither runs under the Rest button.
3. With no choices badge the header is the height it was (64 px) and nothing moves.
4. The page stays 360 px wide.
5. The gate is green.

**Tests:** `apps/web/e2e/sheet.spec.ts` — 2 tests: the first, on the character of SHEET-36's test: the badge reads "!8"; the class line's `scrollWidth` is not above its `clientWidth` (it was 18 px above before the change, the "Fig…" of the row); the badge ends before the Rest button begins; the page is 360 px; the badge still opens the choices panel; the second, on golden B with no badge: the header's first row is 64 px. Control values: the text "Fighter 1" and "!8" are the sheet's own and SHEET-36's.
**What came out of it:**
Quality gate, 2026-11-04: `pnpm lint` 444 files, no fixes; `pnpm typecheck` clean; `pnpm test` 141 files, 1588 passed, 0 failed, 38.0 s (0 new), then speed 2 passed; coverage statements 99.04 % (4051/4090), lines 99.77 % (3551/3559); `pnpm e2e` 88 passed, 0 failed, 1.8 min (1 new); a second test added after, measuring the header's first row at 64 px with no badge, run alone: 2 passed. Screenshot at 360×800 shown in the chat.

Differences from the row: none. Technical choice (ADR 002): the row offers "the line and the badges wrap or the badge moves"; the row of the class line and the badges wraps (the class line is not cut and may itself wrap, which a character with several classes needs), and the header's height is a minimum (`min-h-16`), so it grows by one line only while the badges do not fit. The header's 64 px with no badge is unchanged (the unit and browser tests that measure it pass untouched).

Found, not fixed: nothing.

Changelog: "On a narrow phone the sheet's header no longer cuts the class line when the choices badge shows; the badges go under the class line when they do not fit beside it."
