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
