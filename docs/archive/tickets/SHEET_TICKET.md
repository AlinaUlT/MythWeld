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

**Measured on 2026-10-28:**

- `pnpm lint`: `Checked 203 files in 409ms. No fixes applied.`, exit 0.
- `pnpm typecheck`: every project `Done`.
- `pnpm test`: unit `Test Files 64 passed (64)`, `Tests 882 passed (882)`, 21.24 s; speed
  `Tests 2 passed (2)`, 3.40 s.
- `pnpm e2e`: `12 passed (18.4s)` on `pixel-7`.
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
