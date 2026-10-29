# SHEET — The character sheet, made by hand

**Why this theme:** Phase 2 puts the engine on the phone. A person makes a character by hand,
keeps it on the device and plays it from the sheet: trackers, rolls, rests, undo. Every number on
screen comes from `compute()` with its breakdown, and every look comes from a design token or a
skin slot (ADR 015). The screens follow the owner's mockups and the ADRs that placed work here.
**SPEC:** stage 2, sections §5.8, §6.4, §6.5, §7.1, §7.2, §7.4 (manual mode), §7.5, §11;
ADR 005, ADR 008, ADR 009, ADR 010, ADR 011, ADR 013, ADR 015
**Order and status:** [`BACKLOG.md`](BACKLOG.md) — never repeated here.
**Theme is closed when:** every SHEET row is ✅ or ❌, and the phase 2 gate named in `BACKLOG.md`
(SPEC §12 stage 2, as ADR 000 changes it) is proved.
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections and ADRs the
row's note names; for a screen, its boards in `docs/design/mockups/` and that folder's README.
**Closed tickets:** in [`docs/archive/tickets/SHEET_TICKET.md`](../archive/tickets/SHEET_TICKET.md),
moved there when each one closes.

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

- The attribution texts of SPEC Appendix В are `[ПРОВЕРИТЬ]` against the legal page of each SRD
  PDF. Not reachable from the container on 2026-10-29: `media.wizards.com` and
  `media.dndbeyond.com` answer 403 to the proxy's CONNECT, and the fetch tool gets `ENOTFOUND`
  for both. The check waits on the text of each legal page.
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

<!-- Filled at the end. Never left empty. -->
