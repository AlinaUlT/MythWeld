# CONT — The SRDs and the library

**Why this theme:** Phase 3 puts the two open rulebooks, SRD 5.1 (the 2014 rules) and SRD 5.2.1 (the
2024 rules), into the app as built-in packs, and a library to read them in. The import turns the
5e-database files into packs the schemas check. Hand-written mechanics give the features of levels
1 to 5 their effects. The library, search, Quick rules, Bookmarks, Sources and the attribution
screen show it all.
**SPEC:** stage 3, sections §3, §5.7, §6.8, §7.3, §9 (search); ADR 003, ADR 009, ADR 010,
ADR 011, ADR 012, ADR 013, ADR 014
**Order and status:** [`BACKLOG.md`](../../tickets/BACKLOG.md) — never repeated here.
**Theme is closed when:** every CONT row is ✅ or ❌, and the phase 3 gate named in `BACKLOG.md`
(SPEC §12 stage 3, as ADR 000 and OPS-35 change it) is proved.
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`, the SPEC sections and ADRs the
row's note names; for a screen, its boards in `docs/design/mockups/` and that folder's README.
**This file:** the theme's closed tickets, moved here as each one closed. Open tickets are in
[`docs/tickets/CONT_TICKET.md`](../../tickets/CONT_TICKET.md).

---

### CONT-01 One command fetches the import source at a pinned commit

**Hat:** One command puts the import source's files, at one pinned commit, on the machine
**Depends on:** Nothing (phase 2 is closed)
**Size:** S
**Screen:** No
**SPEC:** §3.2 (the source table); ADR 003; ADR 007

---

#### 1. Where the code lives

**Main file:** `packages/content/src/source/fetch-source.ts` — new. `pin.ts` (the repository, the
commit, the folders) and `fetch-source-cli.ts` (the command) beside it. Also: `package.json` and
`packages/content/package.json` (the `fetch-source` script), `packages/content/tsconfig.json`
(Node types for `src/source`), `.gitignore`, `docs/RUNNING.md`.

#### 2. What is missing now

- Measured 2026-11-11: `packages/content/src` holds `index.ts` and two pack files. Nothing fetches
  5e-database; ENG-02 and ENG-32 read it by hand at `e6edf9a`.
- Later rows (CONT-04, wave 2) read the files and need the same commit every time.

#### 3. What it should look like when done

1. `pnpm fetch-source` fetches 5e-bits/5e-srd-api at commit
   `e6edf9a51fad4b59a7e9561fad6c15232caed214` and writes `packages/content/.source/5e-database/`.
2. The folder holds `2014/` and `2024/` with only the files of `src/<year>/en`, the data package's
   `LICENSE.md`, and `SOURCE.json` (repository, commit, and path, size and SHA-256 of each file).
3. Nothing is taken from `src/*/ru`, ttg.club or wikidot.
4. The folder is git-ignored; no raw copy of the source is committed.
5. A second run with every file as fetched fetches nothing and says "already there".
6. A changed, missing or extra file is named by `verifySource` and put right by a new fetch.
7. A folder with other files and no `SOURCE.json` is refused and not touched.
8. A commit the remote does not give, or a commit with no data files for a ruleset, fails and
   leaves the folder as it was.
9. `docs/RUNNING.md` has the command.

#### 4. How to do it

1. `pin.ts` holds the repository, the commit and the folder of each ruleset.
2. `fetchSource` runs `git init` in a temporary folder, then
   `git fetch --depth 1 --filter=blob:none <repo> <commit>`, checks that `FETCH_HEAD` is the commit,
   sets a sparse checkout of the two `en` folders and the license, and checks the commit out. The
   files come in one batch, not one request each.
3. It copies those files into a staging folder, builds the manifest from them, and only then
   replaces the target, so a failed fetch leaves the old folder.
4. Where the files live is decided here (ADR 002): `packages/content/.source/5e-database/`, ignored
   by git. Reason in §8.
5. The command is a Node script: Node 22 (`.nvmrc`) runs `.ts` files that use only erasable
   syntax, so there is no new tool. Root `pnpm fetch-source` calls it.

#### 5. Stored data

Nothing stored changes. No `CharacterDoc`, `ContentPack` or Dexie table is touched.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/content/test/fetch-source.test.ts` — 10 tests, against a git repository the test builds
  in a temporary folder (made-up files, no rules text), so the gate needs no network: both English
  folders and the license are copied with a manifest; `ru` and files beside the data are not;
  "already there" with the remote hidden; changed, missing and extra files are named and put right;
  a folder with no manifest is refused; a missing commit and a commit with no data files fail and
  leave the folder; the pin's shape; the folder is git-ignored.
- Control numbers from: the made-up fixture's own text (sizes and SHA-256 are computed from the
  literals in the test); the pin is ENG-02's.

#### 8. Checked against the source

- 5e-bits/5e-srd-api at `e6edf9a`, `LICENSE.md` and `packages/5e-database/LICENSE.md`: the MIT
  license of 2018-2020, covering "the Software". Neither says anything about the SRD text in the
  data files.
- `packages/5e-database/README.md`, "License": "This project is licensed under the terms of the MIT
  license. The underlying material is released using the Open Gaming License Version 1.0a". So the
  source's own legal text names the OGL for the material, not the CC-BY-4.0 the SRD PDFs carry.
- SPEC §3.2 says "code MIT, content SRD". The SRD's CC-BY-4.0 is in the SRD PDFs (SHEET-09 §8).
- CLAUDE.md: raw copies are committed only if the source's own legal text allows it. That text is
  an MIT license for code and an OGL line for the material, and the two do not agree with the
  CC-BY-4.0 the packs carry, so the raw copies are not committed. That choice needs no stop: the
  data is fetched, and the packs the importers write (ADR 003) are what the repository carries.
- The commit exists and is reachable from the cloud container (checked 2026-11-11).

#### 9. Not in this ticket

- Reading the files and mapping them to our ids: CONT-04.
- Running the fetch in CI before an importer's test: CONT-04 decides when the first importer needs
  it.
- Moving the pin to a newer commit: a ticket with its own measurement.

#### 10. Rake check

- **Licensing.** No raw copy of the source is committed; `src/*/ru` is not fetched; the license
  file travels with the files.
- **No external requests.** The app does not call it; the command is run by hand and touches no
  app code.
- **Measure, never estimate.** The counts in §11 are the command's own.
- **Nothing invisible, no names.** Checked by the gate's lint and by a search of the new files.

#### 11. What came out of it

**Measured:** first run 3.0 s, second run 0.8 s ("already there"). 50 files: 24 for 2014, 25 for
2024, `LICENSE.md`; 7,205,835 bytes; `.source` is 7.0 MB on disk.

**Where the files live, and why:** `packages/content/.source/5e-database/`, git-ignored. The only
legal text that comes with the files is an MIT license for the code and a README line that puts the
material under the OGL 1.0a (§8). Neither is the CC-BY-4.0 the packs carry, so the raw copies are
not committed (CLAUDE.md). The cost is that a test that
reads them needs `pnpm fetch-source` first. CONT-04 and the first importer decide where CI runs it.

**Difference from the row:** none. The row says "one command"; it is `pnpm fetch-source`.

**Gate, 2026-11-11:** `pnpm lint` 459 files, no fixes; `pnpm typecheck` clean; `pnpm test` 146
files, 1678 passed, 0 failed, 26.8 s (10 new, from 1668), then speed 2 passed; coverage statements
99.01 % (4142/4183), lines 99.78 % (3629/3637). `pnpm e2e` not run: `apps/web` is not touched.

**Found, not fixed:** the source's README puts the underlying material under the OGL 1.0a, and
SRD 5.2.1 (2024) is CC-BY-4.0 only. The packs' license metadata is not changed by this row (it
comes from the SRD PDFs, ADR 003). If the owner wants the source's own wording to count, that is
hers to decide before CONT-61 puts the built packs in the public build. Written here and in the
report; no row.

**Changelog:** Nothing for the changelog.

---

### CONT-02 Phase 3's device tables arrive in one database version · XS

**Hat:** The database gets the tables phase 3 stores into, in one version
**Where:** `apps/web/src/db/db.ts` — version 3, `BookmarkRow`, `EntityIndexRow`; `apps/web/test/storage.test.ts` and `apps/web/e2e/storage.spec.ts` — the tables and the upgrade; `characters.spec.ts` and `sheet.spec.ts` — the version they pin
**Depends on:** CONT-01 (wave 1 order only; no code depends on it)
**Screen:** No

**What it should look like when done:**
1. The database is at Dexie version 3 (IndexedDB version 30) with eight tables: SHEET-07's six as version 2 made them, and two new ones.
2. `bookmarks`: primary key `id` (the id of the entry or rule it marks, so one bookmark per entry), index `addedAt` (an ISO time, for the Bookmarks page's order). Bookmarks stay on the device, outside any character (ADR 014 item 13).
3. `entityIndex`: primary key `id` (the entity's id), indexes `packId` (a pack's rows go together when the packs in use change) and `type` (a search narrowed to one kind of entry).
4. No other table is claimed. Every setting phase 3 stores ("prefer 2014", books in use) fits the existing `settings` and `packs` tables, which take new fields and need no version.
5. A version 2 database with rows opens at version 3 with every row kept and both new tables empty; a database that never existed opens straight at version 3.
6. No auto-increment key; `schemaVersion` of a character or a pack does not change.

**Tests:** `apps/web/test/storage.test.ts` — the eight tables with their keys and indexes; the upgrade test (a version 2 database written out in the test, with one row in each of its six tables, opened by `GrimoireDb`: rows equal, both new tables empty); a fresh database at version 3; the new indexes read back. `apps/web/e2e/storage.spec.ts` — Chromium opens at IndexedDB version 30 with the eight tables; a version 1 and a version 2 database (with a character) upgrade to it and keep the row. Control numbers: the keys and indexes of items 2 and 3 above; the version numbers are Dexie's (3 is IndexedDB's 30).
**What came out of it:**
Quality gate, 2026-11-11: `pnpm lint` 459 files, no fixes; `pnpm typecheck` clean; `pnpm test` 146 files, 1681 passed, 0 failed, 26.5 s (3 new, from 1678), then speed 2 passed; coverage statements 99.01 % (4142/4183), lines 99.78 % (3629/3637); `pnpm e2e` 105 passed, 0 failed, 1.7 min (1 new, from 104).

Design choices (ADR 002): `bookmarks` is keyed by the id of what it marks, so one entry has one bookmark and a second tap finds the first; it has an `addedAt` index for the page's order. `entityIndex` is keyed by the entity's id, with `packId` and `type` indexes: a pack's rows go together when the packs in use change (CONT-41), and a search can narrow to one type. Both are fixed now because an index, like a key, can only be added by a version. The search words themselves are not indexed in Dexie; MiniSearch holds them (SPEC §4, search row), and CONT-41 decides what the row carries beyond these three fields.

Measured: no other table is needed. "Prefer 2014" (CONT-58) is a setting and "in use" (CONT-57) is a field of a pack's row, in tables that exist.

Found in the same change, inside the hat: `characters.spec.ts` and `sheet.spec.ts` waited for IndexedDB version 20, so the first full e2e run of this row passed only 38 of 105 until they read 30. Both are changed. Nothing else pins the version.

Found, not fixed: nothing.

Changelog: Nothing for the changelog (no screen reads the tables yet).

---

### CONT-03 Every phase 3 screen has its own empty file

**Hat:** Every phase 3 screen has a route, an empty page file and its own text namespace
**Depends on:** CONT-02 (wave 1 order only)
**Size:** S
**Screen:** No — the pages are empty frames (a title and a back arrow, as SHEET-11 made them); the boards are drawn into them by the rows in §11. The player page's tiles change from "Coming later" to links.
**SPEC:** §7.3, §9; ADR 010 items 2 and 3, ADR 012, ADR 013 items 17 and 18

---

#### 1. Where the code lives

**Main file:** `apps/web/src/shell/routes.ts` — changes: six paths, the library's topics.
- `apps/web/src/App.tsx` — six routes. `apps/web/src/pages/` — `LibraryPage`, `QuickRulesPage`, `BookmarksPage`, `SourcesPage`, `AboutPage`: new.
- `apps/web/src/pages/PlayerPage.tsx` — four tiles get their `to`.
- `apps/web/src/library/topics/` (11), `library/windows/` (3), `quickRules/` (2), `shared/BookmarkButton.tsx` — new, empty.
- `apps/web/src/locales/en/` and `i18n/namespaces.ts` — 22 new namespaces.

#### 2. What is missing now

Measured on `763d6cd`: `paths` has 7 entries, all phase 2. `/library`, `/quick-rules`, `/bookmarks`, `/sources` and `/about` open the start page (the `*` route). The player page's Sources, Library, Quick rules and Bookmarks tiles show "Coming later" and link nowhere (`player.test.tsx`, `navigation.spec.ts` pin it). `apps/web/src` has no `library/` or `quickRules/` folder.

#### 3. What it should look like when done

1. These paths open a page of their own, with the title and a back arrow, and nothing else: `/library`, `/library/<topic>`, `/quick-rules`, `/bookmarks`, `/sources`, `/about`. Back goes to `/player`, except About, which goes to `/settings` (BRIEF: About is a Settings item).
2. The library is one page. The topic is the last segment of its path: `libraryTopics` lists 11 (spells, classes, species, backgrounds, feats, armor, weapons, items, magic-items, conditions, monsters), and `libraryPath(topic)` builds the path. Encounter templates come with the DM tools (ADR 010 item 3).
3. The player page's six tiles all link: Sources `/sources`, Library `/library`, Quick rules `/quick-rules`, Bookmarks `/bookmarks`. None says "Coming later".
4. Each page has its namespace with one key, `title`: `library` "Library", `quickRules` "Quick rules", `bookmarks` "Bookmarks", `sources` "Sources", `aboutApp` "About" (`about` is the sheet's About tab).
5. 17 empty files exist: 11 topic lists, 3 library windows, 2 Quick rules windows, the bookmark button. Each holds a comment naming the row that fills it and `export {}`; each has its own empty namespace, so no two rows of a wave edit one locale file.
6. The page is 360 px wide; nothing else changes.

#### 4. How to do it

1. `routes.ts`: the paths, `libraryTopics`, `libraryPath`.
2. Pages as SHEET-11 made them: `<Page title back />` and nothing under it. `LibraryPage` serves both library routes and ignores the topic until CONT-18.
3. The empty files carry no shape. A topic's "markers" (CONT-18) and a window's props are the filling row's to decide, so a file exports nothing yet.
4. A namespace for each page and each empty file, as SHEET-30 did, each `{}` except the pages' `title`.
5. The player tiles' `to`. Tests follow.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

At 360×800: the player page's four tiles open pages that show a title and a back arrow, and nothing below. Keys: `library.title`, `quickRules.title`, `bookmarks.title`, `sources.title`, `aboutApp.title`. No empty, loading or error state exists yet; the rows in §11 add them.

#### 7. Tests

- `apps/web/test/phase3-frames.test.tsx` — 9: each page renders its title, its back target and no other element; the library at each of the 11 topics; the 17 files exist, each with a namespace of its own that `en` holds.
- `apps/web/test/navigation.test.tsx` — the 13 paths, the 11 topics in order, `libraryPath`, the 55 namespace files, the five titles. `apps/web/test/player.test.tsx` — six links, no "Coming later".
- `apps/web/e2e/navigation.spec.ts` — the six paths open with title and back arrow in Chromium; each of the four tiles opens its page, shows nothing under the header, is 360 px wide, and back returns to `/player`.
- Control numbers from: the row's list of screens, ADR 010 item 3 (the topic names), BRIEF P10 (About inside Settings).

#### 8. Checked against the source

Nothing to check: no rules fact is used. ADR 010 item 3 names Armor, Backgrounds, Classes, Encounter templates, Feats, Items, Monsters, Species, Spells and Weapons; the rows CONT-50 and CONT-51 add Magic items and Conditions.

#### 9. Not in this ticket

- What any page or window shows, and the topic picker: the rows in §11.
- A Settings row that opens About: CONT-59.
- A redirect or a message for an unknown topic (`/library/xyz`): CONT-18.
- The Russian locale: its own phase (ADR 000).

#### 10. Rake check

- **No look in a component, no visible literal:** the pages use `Page` and a namespace key; no colour, size or string is written in them.
- **Ids are stable, missing is not broken:** an unknown path still opens the start page; `/library/xyz` opens the library.
- **Nothing stored changes**, no rules, no content, no external request.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 504 files, no fixes; `pnpm typecheck` clean; `pnpm test` 147 files, 1691 passed, 0 failed, 27.7 s (10 new, from 1681), then speed 2 passed; coverage statements 99.01 % (4142/4183), lines 99.78 % (3629/3637); `pnpm e2e` 106 passed, 0 failed, 1.8 min (1 new, from 105).

**Which row fills which file** (each text in the namespace named, in `apps/web/src/locales/en/`):

| File in `apps/web/src/` | Row | Namespace |
|---|---|---|
| `pages/LibraryPage.tsx` | CONT-18 | `library` |
| `library/windows/EntryWindow.tsx` | CONT-19 | `libEntry` |
| `library/topics/spells.ts` | CONT-43 | `libSpells` |
| `library/windows/SpellCasters.tsx` | CONT-44 | `libSpellCasters` |
| `library/topics/classes.ts`, `library/windows/ClassWindow.tsx` | CONT-45 | `libClasses`, `libClass` |
| `library/topics/species.ts` | CONT-46 | `libSpecies` |
| `library/topics/backgrounds.ts` | CONT-47 | `libBackgrounds` |
| `library/topics/feats.ts` | CONT-48 | `libFeats` |
| `library/topics/armor.ts`, `weapons.ts`, `items.ts` | CONT-49 | `libArmor`, `libWeapons`, `libItems` |
| `library/topics/magicItems.ts` | CONT-50 | `libMagicItems` |
| `library/topics/conditions.ts` | CONT-51 | `libConditions` |
| `library/topics/monsters.ts` | CONT-52 | `libMonsters` |
| `pages/QuickRulesPage.tsx` | CONT-53 | `quickRules` |
| `quickRules/TopicWindow.tsx`, `RuleWindow.tsx` | CONT-54 | `rulesTopic`, `rulesRule` |
| `shared/BookmarkButton.tsx` | CONT-55 | `bookmarkButton` |
| `pages/BookmarksPage.tsx` | CONT-56 | `bookmarks` |
| `pages/SourcesPage.tsx` | CONT-57 | `sources` |
| `pages/AboutPage.tsx` | CONT-59 | `aboutApp` |

**Decisions (ADR 002):** the topic is a path segment of one library page, not a page of its own, because ADR 010 item 3 says "one library page" with the topic picked on top. The empty files export nothing, because their shape (a topic's markers, a window's props) belongs to CONT-18 and CONT-19. Each empty file got its own namespace, 17 beyond the row's five, because the wave-3 rows CONT-43 to 52 would all have added keys to one `library.json`, and CONT-53 with CONT-54 and CONT-55 with CONT-56 would have shared `quickRules.json` and `bookmarks.json`. `CONT-58` ("prefer 2014") has no file of its own: it fills a switch in `library`, `sources` and `settings`, and runs after the rows that own those.

**Difference from the row:** the row names five namespaces; there are 22. Nothing else.

**Screenshots:** the player page, dark and light, 360×800, with the four tiles now links (`player-dark.png`, `player-light.png`, from the SHEET-12 e2e test), sent in the chat as files. The new pages are empty frames and have none of their own.

**Found, not fixed:** nothing.

**Changelog:** one line.
