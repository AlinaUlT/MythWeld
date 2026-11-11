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

---

### CONT-04 The import frame maps both SRDs' entries to our ids

**Hat:** The import frame names, reads and checks the entries every importer makes
**Depends on:** CONT-01 (the fetched files)
**Size:** S
**Screen:** No
**SPEC:** §3.2 (the two text shapes), §5.1 (ids), §5.7 (the pack); ENG-02 §11

---

#### 1. Where the code lives

**Main file:** `packages/content/src/import/frame.ts` — new: the slug mapping, the text reader, the importer shape, `runImport`.
- `packages/content/src/import/source.ts` — new: reads a fetched file (Node only).
- `packages/content/src/import/registry.ts` — new: every importer, by file.
- `packages/content/src/import/{spells,classes,species,backgrounds,feats,equipment,magicItems,smallTypes,rules,monsters}.ts` — new, empty.
- `vitest.config.ts`, `vitest.fetch-source.ts` — the unit tests put the fetched source in place first. `docs/RUNNING.md`.

#### 2. What is missing now

Measured on `6695af0`: `packages/content/src` has `index.ts` and two hand-written pack files; no `import/`. Nothing turns a source entry into an entity input. The source at `e6edf9a` (fetched by CONT-01): 4,428 entries in 49 files; 11 indexes are not slugs (ENG-02 §11); `desc` is a list of paragraphs in most SRD 5.1 entries and one string in 206 of them; SRD 5.2.1 uses `description`, and its magic items still use `desc`; `Levels` has no `name`; one SRD 5.1 spell (Scrying) has an empty paragraph.

#### 3. What it should look like when done

1. `slugOf(index)` leaves 4,417 indexes as they are and maps the 11: `dragon-ancestor-<color>---<damage>-damage` → `dragon-ancestor-<color>-<damage>-damage` (10) and `stone-of-good-luck-(luckstone)` → `stone-of-good-luck-luckstone`. It throws for an index it cannot map to a slug.
2. `entityIdOf(pack, type, index)` gives `<pack>:<type>/<slug>`.
3. `textOf(entry)` reads `desc` as a list or a string and `description` as a string, joins paragraphs with a blank line, drops empty paragraphs, and gives `undefined` for no words.
4. `runImport` runs each importer for one ruleset, checks every entity it returns with the fifth-edition entity schema, and returns the entities that pass and a list of problems: a schema refusal (each issue with its path), an id of another pack, a type the importer does not name, an id made twice.
5. Ten importer files exist, each empty (no types, no files, makes nothing), and a registry lists them.
6. Run over the registry, both rulesets give no entity and no problem.
7. Over the 4,428 entries: every slug maps; none repeats in its file; the text of each entry that has any reads as text.

#### 4. How to do it

1. `frame.ts` is pure; it reads no file. `source.ts` reads a file by its short name (`Spells` is `5e-SRD-Spells.json`) and says to run `pnpm fetch-source` when it is missing.
2. An `Importer` names its entity `types` and, for each ruleset, its source `files`. `runImport` reads those files and calls `run`. A row fills one file and never edits the registry or the frame.
3. Importer files are cut by the row that fills them, not by entity type. The row says "one for each type", but CONT-12 and CONT-13 both make `item`, and CONT-08 makes two types; a file per type would put two wave 2 rows in one file, which the wave rule forbids. Ten files: seven rows of wave 2, CONT-14 (all the small types), CONT-15 (rules) and CONT-20 (monsters, wave 3; the `monster` type is CONT-06's).
4. The frame stops at entities. The pack's own fields (id, title, license) are CONT-61's.
5. The source is not committed (CONT-01), so the unit pass of Vitest fetches it before the tests run when it is not there (a global setup), and fetches nothing when it is.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/content/test/import-frame.test.ts` — 22: the 11 slugs by name; a slug left as it is; refusals; the id; the text in each shape, both fields, empty paragraphs; `runImport` with made-up importers (damage types, no rules text) for a pass, a schema refusal with its path, another pack, an undeclared type, a repeated id, the files read per ruleset; the registry's ten names and shape; the registry over the real source for each ruleset; the real source's counts and text.
- Control numbers from: ENG-02 §11 (4,428 indexes, 4,417 slugs, 11 mapped), SPEC §3.2, and §8 below (206).

#### 8. Checked against the source

Measured 2026-11-11 on the files CONT-01 fetched (5e-bits/5e-srd-api at `e6edf9a`), read by a script outside the repository:
- 4,428 entries; 11 indexes do not fit the slug pattern, the 11 of ENG-02 §11; after the mapping none repeats in its file.
- Text in SRD 5.1: `desc` as a list of strings, and, for 206 entries, as one string (134 rules, 45 monsters, 9 alignments, 8 schools of magic, 6 languages, 4 subraces). SRD 5.2.1: `description`, except that its 262 magic items keep `desc`. No entry has both. SPEC §3.2 names only `desc: string[]` and `description: string`; the frame reads the third shape as well.
- One empty paragraph in one list: SRD 5.1 `scrying`.
- 290 `Levels` entries have `index` and no `name`; no other entry lacks a name.
- No rules fact beyond the source's shape is used.

#### 9. Not in this ticket

- What any importer makes: CONT-07 to CONT-15 and CONT-20.
- The pack's header (title, license, attribution) and the build that writes the packs: CONT-61.
- The count of each type against the source: CONT-21.
- The `monster` type: CONT-06.

#### 10. Rake check

- **Licensing:** the frame and its tests carry no rules text; the made-up entities are named "Made up".
- **Ids are stable:** the 11 are mapped once, here, by a rule; an index it cannot map is refused.
- **Missing is not broken:** an entry with no text or no name is read, not refused; the importer decides.
- **The engine stays pure:** the frame is in `packages/content`; only `source.ts` reads a file.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 519 files, no fixes; `pnpm typecheck` clean; `pnpm test` 148 files, 1713 passed, 0 failed, 27.4 s (22 new, from 1691), then speed 2 passed; coverage statements 99.01 % (4142/4183), lines 99.78 % (3629/3637). `pnpm e2e` not run: `apps/web` is not touched. With `packages/content/.source` removed, `pnpm vitest run packages/content/test/import-frame.test.ts` fetched it and passed (3.6 s).

**Measured, not in the row:** the three text shapes of §8; the empty paragraph; 290 `Levels` entries with no `name`. The frame reads the first two and leaves a missing `name` to the importer.

**Difference from the row:** ten importer files cut by row, not one per type (§4 item 3).

**Found, not fixed:** 2024's magic items keep `desc`, so a row that reads "2014 `desc`, 2024 `description`" from SPEC §3.2 alone would lose their text; `textOf` reads both for every file, and CONT-13's §8 should check the text of each ruleset's magic items against it.

**Changelog:** Nothing for the changelog.

---

### CONT-05 The fifth-edition schemas hold the SRD values found so far

**Hat:** The fifth-edition schemas gain optional fields for the SRD values phase 1 found they could not hold
**Depends on:** CONT-04 (wave 1 order only)
**Size:** M
**Screen:** No
**SPEC:** §3.2, §5.3, §5.5; ADR 004; ENG-32, ENG-50, ENG-53, ENG-16, ENG-33, ENG-10 (their §8 and §11)

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/entity-types.ts` — changes: item category, weapon base, spell duration, scaling, upgrades, healing.
- `packages/system-5e/src/system.ts` — `HEALING_KINDS`, the `spell` grant's `abilityFrom`.
- `packages/system-5e/src/pack.ts` — one more check the JSON Schema cannot say.
- `packages/schema/src/grant.ts` (a choice filter's `proficient`), `prerequisite.ts` (a `featureNamed` kind) — the core, because both are game-free and shared by every system.
- `packages/engine/src/prerequisites.ts` — reads the new kind.
- `apps/web/public/schema/5e/pack.schema.json` — regenerated.

#### 2. What is missing now

Measured on `8efafd7`: no field holds any of §3's values; a pack that wrote one would be refused (`strictObject`). The row's note lists them; ENG-32 §11, ENG-50 §11, ENG-53 §11, ENG-16 §11, ENG-33 §11 and ENG-10 §11 measured each.

#### 3. What it should look like when done

Each line is a field, optional (no migration), with its source value, in both the Zod schema and the published JSON Schema, which agree on every case of `cont-05.test.ts`:
1. `ItemDef.category` takes `transport`: 2014 `mounts-and-vehicles`, 40 entries (9 mounts and animals, 25 tack, harness and drawn vehicles, 6 waterborne vehicles).
2. A spell's `duration.kind` takes `untilDispelledOrTriggered`: SRD 5.2.1 Glyph of Warding and Symbol (2 spells).
3. A `spell` grant takes `abilityFrom`, two or more stats (not with `ability`): 2024 `elven-lineage`, `gnomish-lineage`, `magic-initiate`, Intelligence, Wisdom or Charisma.
4. `scaling.every` (2 or more, `slot` only): SRD 5.1 Flame Blade (2: 3d6, 4: 4d6, 6: 5d6, 8: 6d6) and Spiritual Weapon, "for every two slot levels". `scaling.damageTypes` and `scaling.pickOne`: SRD 5.1 Flame Strike, fire or radiant at the caster's choice (SRD 5.2.1 grows both).
5. A cantrip's `upgrades`, by character level, each step with one of `beams`, `die`, `range` (feet), `extraDamage`; a level once; cantrips only: Eldritch Blast 2, 3, 4 beams at 5, 11, 17; Shillelagh d10, d12, 2d6; Spare the Dying 30, 60, 120 feet from 15; True Strike Radiant 1d6, 2d6, 3d6 and nothing before 5 (all SRD 5.2.1).
6. `healing.kind` takes `maxHp`: Aid (both SRDs, 5 per slot level from 2nd: 5 … 40), Heroes' Feast (both). `healing.hitDice`: Arcane Vigor, 2. A spell's `healingEachTurn`: Heroism (temporary hit points equal to the modifier), Regenerate (1 hit point, beside its 4d8 + 15).
7. A weapon's `baseKey`: a "Longsword, +1" is a `longsword` (dnd5e `type.baseItem`).
8. A choice filter's `proficient`: SRD 5.2.1 paladin, ranger and rogue mastery. "Melee weapons" (the barbarian) is a `tag`, which the filter already had.
9. A prerequisite kind `featureNamed`: 5e-database 2024 `prerequisites.feature_named`, "Fighting Style" (archery, defense, great-weapon-fighting, two-weapon-fighting) and "Spellcasting" (boon-of-spell-recall). The engine checks it.
10. Held already, shown by a test and no change: a species with `size: ['medium', 'small']` (the 2024 human); `feat.repeatable` (Ability Score Improvement, Magic Initiate, Skilled); a class with four `entity` grants of one feat at levels 4, 8, 12, 16.

#### 4. How to do it

1. Each field is added where its value lives: the spell, the grant, the weapon, the filter, the prerequisite.
2. A check a JSON Schema can say (`every` only with `slot`, `pickOne` with two or more types, a step with something in it, `upgrades` only on a cantrip, `ability` not with `abilityFrom`) is also written in `.meta()`, as ENG-38 does, so the published file refuses what Zod refuses (`anyOf` and `not`, since the linter refuses a key named `then`). A level once in `upgrades` cannot be said, so it joins the published description's list.
3. The engine gets only what the build needs: the new prerequisite kind is checked and described, since its `switch` is exhaustive. Nothing else in `engine` or the sheet reads a new field (§9).
4. The published file is regenerated with `pnpm vitest run apps/web/test/pack-schema.test.ts --update`.
5. Core or module: `proficient` and `featureNamed` are game-free (a flag on a filter, a name), so they sit in the core as `tag` and `entity` do; the rest name fifth-edition values and sit in the module.

#### 5. Stored data

A stored shape widens and nothing narrows: every new field is optional, and `HEALING_KINDS`, the item category list and the duration kinds only gain a value. A pack of version 10 stays valid, so `FIFTH_EDITION_SCHEMA_VERSION` and `PACK_SCHEMA_VERSION` do not change and no migration is added (SPEC §5.8: ENG-06's frame needs a step only where an old file would be refused). A character is not touched.

#### 6. What a person will see

Not a screen. The published JSON Schema (`schema/5e/pack.schema.json`) accepts the new fields; the cast panel shows a `maxHp` healing as plain healing until CONT-65.

#### 7. Tests

- `packages/system-5e/test/cont-05.test.ts` — 20: one describe for each of §3's lines 1 to 10, each source value written into a made-up entity and judged by both schemas, which must agree; a wrong form each (a step of 1, a pick of one type, a step with nothing, a cantrip field on a level 2 spell, a key not in camelCase).
- `packages/engine/test/prerequisites.test.ts` — 1 new: `featureNamed` is met by a name the character has and unmet, with a warning and its text, otherwise.
- `packages/schema/test/mechanics.test.ts` and `packages/system-5e/test/entity-types.test.ts`, `pack-json-schema.test.ts` — three pinned counts and types move with the schemas (prerequisite kinds 5 to 6; the healing type; the checks list 4 to 5).
- Control numbers from: §8, the source values, never a run's output.

#### 8. Checked against the source

Sources: 5e-bits/5e-srd-api at `e6edf9a`, `packages/5e-database/src/{2014,2024}/en/`, read on 2026-11-11 from the files CONT-01 fetched; foundryvtt/dnd5e at `7bfb3f1` (CC-BY-4.0), cited as ENG-50 §8, ENG-53 §8 and ENG-16 §11 read it on 2026-10-02 and 2026-10-03, and not read again here.
- **Equipment.** 2014 `5e-SRD-Equipment.json`: 40 entries with `equipment_category` `mounts-and-vehicles`, each with a `vehicle_category`: "Tack, Harness, and Drawn Vehicles" 25, "Mounts and Other Animals" 9, "Waterborne Vehicles" 6; none has a `gear_category`. 2024 equipment has no such category.
- **Duration.** 2024 `5e-SRD-Spells.json`: `glyph-of-warding` and `symbol` have "Until dispelled or triggered"; SRD 5.1 has 12 "Until dispelled" spells and none "or triggered"; SRD 5.2.1 has 12 "Until dispelled" besides those two.
- **Scaling.** 2014 Flame Blade: `damage_at_slot_level` 2: 3d6, 4: 4d6, 6: 5d6, 8: 6d6; higher level "1d6 for every two slot levels above 2nd". Spiritual Weapon: 1d8 + MOD at 2 and 3, 2d8 + MOD at 4 and 5 …, "1d8 for every two slot levels above the 2nd". 2014 Flame Strike: two damages (fire, radiant), `4d6 OR 5d6` from slot 6, "the fire damage or the radiant damage (your choice) increases by 1d6 for each slot level above 5th"; 2024: "The Fire damage and the Radiant damage increase by 1d6 for each spell slot level above 5".
- **Cantrip upgrades**, 2024 `description`: Eldritch Blast "two beams at level 5, three beams at level 11, and four beams at level 17"; Shillelagh "levels 5 (d10), 11 (d12), and 17 (2d6)"; Spare the Dying "The range doubles when you reach levels 5 (30 feet), 11 (60 feet), and 17 (120 feet)", range 15 feet; True Strike "extra Radiant damage when you reach levels 5 (1d6), 11 (2d6), and 17 (3d6)".
- **Healing.** 2014 Aid `heal_at_slot_level` 2: 5 … 9: 40; 2024 Aid "Hit Point maximum and current Hit Points increase by 5 for the duration"; 2024 Heroes' Feast "Hit Point maximum also increases by 2d10"; 2014 Heroes' Feast has the same (text); 2014 Regenerate `heal_at_slot_level` 7: "4d8 + 15", "1 hit point at the start of each of its turns"; Heroism, both: temporary hit points "equal to your spellcasting ability modifier at the start of each of its turns". Arcane Vigor (SRD 5.2.1) is not in 5e-database; its "one or two unexpended Hit Dice" is from ENG-53 §8 (dnd5e `spells24`).
- **Feats.** 2024 `5e-SRD-Feats.json`: `archery`, `defense`, `great-weapon-fighting`, `two-weapon-fighting` have `prerequisites.feature_named` "Fighting Style"; `boon-of-spell-recall` has "Spellcasting" with `minimum_level` 19.
- **Species.** 2024 `human`: `size` "Medium" (one value); `tiefling`: `size_options` choose 1 of Small, Medium. The human's "Medium or Small" is ENG-10 §11's reading of the SRD text, as dnd5e quotes it; not re-read here.
- **Mastery, magic weapon, repeatable feats:** as ENG-16 §11 and ENG-33 §11 state them; not re-read here.
- No `[ПРОВЕРИТЬ]` is involved.

#### 9. Not in this ticket

- Reading any new field outside the prerequisite: CONT-63 (the stat pick), CONT-64 (`proficient`), CONT-65 (growth and healing), CONT-66 (a feat taken twice), CONT-67 (`baseKey`). Until each, a field is data the engine ignores.
- Writing the SRD's spells, items and feats into the fields: CONT-07, CONT-12, CONT-11 and the mechanics rows.
- A SPEC §5.3 edit: the fields are written in the schemas and here; SPEC is the owner's document (a change to it is an ADR).

#### 10. Rake check

- **Everything is data, the core names no game:** `proficient` and `featureNamed` name no stat, skill or edition; the core gained two optional things.
- **Missing is not broken:** an unread field is ignored, never an error; a prerequisite is a warning, never a block.
- **A stored shape change needs a migration:** every field is optional and each list only gains a value, so no old pack or character is refused (§5).
- **Formulas never run code:** `die`, `formula` and `extraDamage.formula` are formulas checked as text by the same schema as the existing ones.
- **No rules text:** the entities are made up; the numbers are the source's.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 520 files, no fixes; `pnpm typecheck` clean; `pnpm test` 149 files, 1734 passed, 0 failed, 27.0 s (21 new, from 1713: 20 in `cont-05.test.ts` and 1 in `prerequisites.test.ts`; three existing tests only changed a pinned count or type), then speed 2 passed; coverage statements 99.02 % (4154/4195), lines 99.78 % (3640/3648); `pnpm e2e` 106 passed, 0 failed, 1.7 min (the published schema file is in `apps/web`).

**Published JSON Schema:** regenerated; 467 lines added and 259 removed, most of them `$defs` numbers that shifted. `text.length` stays under ENG-38's 100,000 limit.

**Difference from the row:** three of the row's items needed no field. The 2024 human's Medium or Small is a species `size` list, which the schema already held (the tiefling's is one); the feat taken twice is `repeatable`, already there, and its per-take choices are the engine's; a class that gives Ability Score Improvement at four levels is four grants of one feat, already allowed. §3 item 10 tests each. "Melee weapons" is a tag, so only "with which you have proficiency" needed a field.

**Found, not fixed:** the engine reads none of the new fields yet, and an unread field gives a quiet wrong number. New rows CONT-63 to CONT-67 in `BACKLOG.md`, wave 2, each before the mechanics row that writes data in its field. The cast panel shows a `maxHp` healing as plain healing; CONT-65 owns it. The spell grant with `abilityFrom` names no casting stat until CONT-63.

**Changelog:** one line, as ENG-53's was: the published JSON Schema is a public file.

---

### CONT-06 Monsters have an entity type

**Hat:** The fifth-edition module has a `monster` entity type that holds both SRDs' stat blocks
**Depends on:** CONT-05 (the only schema row of wave 2; it ran first)
**Size:** S
**Screen:** No
**SPEC:** §3.1 (monsters in both SRDs), §5.3, §5.8; ADR 004; ADR 010 item 3

---

#### 1. Where the code lives

**Main file:** `packages/system-5e/src/entity-types.ts` — changes: `monsterDefSchema`, in the union.
- `packages/system-5e/src/system.ts` — `FIFTH_EDITION_SCHEMA_VERSION` 10 to 11. `character.ts` and `pack.ts` — one no-op step each.
- `packages/content/src/packs/srd-2014.ts`, `srd-2024.ts` and the golden fixtures' `systemSchemaVersion` — 11.
- `apps/web/public/schema/5e/pack.schema.json` — regenerated.

#### 2. What is missing now

Measured on `2149c0b`: no `monster` in `packages/schema/src` or `packages/system-5e/src`; a pack with a monster is refused (`strictObject`, unknown type). The source at `e6edf9a` has 334 monsters in SRD 5.1 and 341 in SRD 5.2.1.

#### 3. What it should look like when done

1. `fifthEditionEntitySchema` has a `monster` option; `FifthEditionEntity['type']` names it; the published JSON Schema has one more strict option.
2. A monster holds: `size` (a list, since 30 SRD 5.2.1 monsters are "Medium or small"), `creatureType`, `subtype`, `alignment`, `armorClass` (one or more of value, kind, note), `hitPoints` (`average`, `formula`), `speed` in feet with `hover`, `scores` by stat key (at least one), `saves` and `skills` (the monster's own bonus), `vulnerabilities`, `resistances` and `immunities` (text, since the SRDs write sentences), `conditionImmunities` (keys), `senses` in feet with `passivePerception`, `languages`, `challengeRating` (0, 0.125, 0.25, 0.5 or a whole number), `proficiencyBonus`, `xp`, `xpInLair`, `traits`, `actions`, `bonusActions`, `reactions`, `legendaryActions`, `forms` (ids).
3. An ability of a monster is a name and words with, where the SRDs give them, `attackBonus`, `damage` (formula and damage type), `save` (stat and DC) and `usage` (a number of times a day and in its lair, a recharge die, or a rest).
4. Every one of the 675 stat blocks, mapped by the test's own mapping, passes the schema.
5. A monster missing its creature type, scores, armor class, hit points or challenge rating is refused.
6. Version 10 characters and packs open as they are and then at version 11, through a no-op step; one saved by version 12 is refused.

#### 4. How to do it

1. A number a table reads is a number; what the SRDs write as a sentence (damage resistances such as "bludgeoning from nonmagical weapons", languages, alignment) is text, as it stays a sentence in the source. Stat keys are open keys (D3), so a custom stat is a score like Strength.
2. Abilities are cut as the source cuts them, by their list, in the five lists the SRDs use.
3. Adding a type changes the stored shape of a pack and of a character's own entities, so the module version goes up, as SHEET-08 did for seven simple types: a pack saved by this version must not open in an older app that would refuse its type. Each chain gets a step that returns the file as it is, and its test (SHEET-76's shape).
4. Where an SRD gives the field in the shape a test needs, the made-up entity and the mapping use it; the mapping stays in the test, since CONT-20 writes the importer.

#### 5. Stored data

`FIFTH_EDITION_SCHEMA_VERSION` 10 to 11 (the module's number, carried by a pack and a character). A pack of version 10 has no monster, and a character's own entities have none either, so each step returns the file as it is: `FIFTH_EDITION_PACK_MIGRATIONS[9]` and `FIFTH_EDITION_CHARACTER_MIGRATIONS[9]`, each with its test. `schemaVersion` of the core does not change. The built-in packs and the golden files name version 11; no expected value of a golden test changed.

#### 6. What a person will see

Not a screen. The published JSON Schema accepts a `monster`.

#### 7. Tests

- `packages/content/test/monster-schema.test.ts` — 3: all 334 and all 341 stat blocks of the fetched source, mapped to the schema's shape, pass; five missing fields and an empty `scores` are each refused.
- `packages/system-5e/test/character.test.ts` — 2: version 10 opens as it is then at 11, for a character and a pack, the step returns an equal copy and does not change what it is given. Seven pinned numbers and types moved (version, number of steps, number of types).
- `packages/system-5e/test/entities.ts` — a made-up monster (no rules text) joins `everyEntity`, so the round trip, the JSON Schema agreement and Ajv acceptance cover it.
- Control numbers from: §8.

#### 8. Checked against the source

5e-bits/5e-srd-api at `e6edf9a`, `5e-SRD-Monsters.json`, measured 2026-11-11:
- 334 monsters (2014) and 341 (2024). Common keys: `size`, `type`, `alignment`, `armor_class`, `hit_points`, `hit_points_roll`, `speed`, the six scores, `proficiencies` (each `{proficiency, value}`: 321 saves and 393 skills in 2014, 279 and 447 in 2024), the four damage lists (strings), `condition_immunities` (objects with an `index`), `senses`, `languages`, `challenge_rating`, `proficiency_bonus`, `xp`.
- Sizes: Tiny, Small, Medium, Large, Huge, Gargantuan; 2024 also "Medium or small" (30). Types include "swarm of Tiny beasts" (2014: 10; 2024: 6) and "swarm of tiny undead" (1).
- Speeds are strings ("40 ft.") under walk, fly, swim, climb, burrow, plus `hover` as a boolean (7 and 17). Challenge ratings 0, 0.125, 0.25, 0.5, 1 to 30.
- 2014 `armor_class` entries carry `type` (natural 180, dex 119, armor 37, spell 4, condition 1); 2024's carry only `value` and sometimes `armor`.
- 2014 `languages` is empty for 134 monsters; 2024 for none.
- Abilities: `special_abilities`, `actions`, `legendary_actions`, `reactions` and, in 2024 only, `bonus_actions`. Their `usage` is "per day" (times, and in 2024 `times_in_lair`), "recharge on roll" (`dice`, `min_value`) or "recharge after rest" (`rest_types`); `dc` has `dc_type`, `dc_value`, `success_type` (2024: two without a value); a damage part has `damage_dice` and `damage_type`; 16 2014 damage parts are a `choose` with no dice (the mapping leaves them to the text).
- Six SRD 5.1 monsters list Blinded twice in `condition_immunities` (flying-sword, ochre-jelly, rug-of-smothering, shambling-mound, shrieker, violet-fungus).
- `forms`: 18 monsters in each ruleset have it, 36 entries each, each an `index`.
- No `[ПРОВЕРИТЬ]` is involved; no rules fact beyond the shape.

#### 9. Not in this ticket

- The importer (CONT-20) and the Monsters topic (CONT-52); a stat block's screen.
- Structured attack, multiattack and spellcasting: the words are held; CONT-20 decides what else it keeps.
- The encounter tools: the DM phase (SPEC L3).

#### 10. Rake check

- **A stored-shape change needs a migration:** version 11, a step in each chain, a test for each (§5).
- **Everything is data:** scores, saves, skills and senses are keyed by open keys; no stat is named in code.
- **Stored units are feet:** speeds and senses are feet; the mapping converts "40 ft." only in the test.
- **No rules text:** the made-up monster says "A made-up attack"; the test reads the source's numbers and words only in memory.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 521 files, no fixes; `pnpm typecheck` clean; `pnpm test` 150 files, 1739 passed, 0 failed, 27.0 s (5 new, from 1734), then speed 2 passed; coverage statements 99.02 % (4162/4203), lines 99.78 % (3648/3656); `pnpm e2e` 106 passed, 0 failed, 1.7 min (the published schema file and the built-in packs are in `apps/web`).

**First run found two things:** six SRD 5.1 monsters list Blinded twice, which a `uniqueList` refuses, so the mapping (and CONT-20) removes the repeat; and `pnpm typecheck` found two pinned types (`version 10`, the type list) that Vitest does not check.

**Published JSON Schema:** regenerated, 105,077 bytes. ENG-38's test limit of 100,000 bytes was a technical choice (its own words); it is now 150,000, because the monster type is the first to cross it.

**Difference from the row:** none. The row said the type lives in the fifth-edition module (ADR 004); it does.

**Found, not fixed:** nothing outside the hat. For CONT-20: the 16 `choose` damage parts, the repeated Blinded, the 134 empty 2014 `languages`, and `size` as a list.

**Changelog:** one line (the published JSON Schema is a public file).

---

### CONT-14 The small rule types are imported from both SRDs

**Hat:** The small rule types of both SRDs become entities
**Depends on:** CONT-04 (the frame), CONT-05 (wave 1 order only)
**Size:** S
**Screen:** No
**SPEC:** §3 (both SRDs), §5.1 (ids), §5.3 (the simple types), §5.7 (the pack); ADR 003, ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/content/src/import/smallTypes.ts` — changes: from the empty importer to the real one.
- `packages/content/test/import-small-types.test.ts` — new.

#### 2. What is missing now

Measured on `77b6707`: `smallTypes` has no types, no files and makes nothing. The source at `e6edf9a` has the small files (SRD 5.1 / SRD 5.2.1): ability scores 6 / 6, skills 18 / 18, conditions 15 / 15, damage types 13 / 13, languages 16 / 19, magic schools 8 / 8, weapon properties 11 / 10, weapon mastery properties 0 / 8, proficiencies 117 / 74. Seven types that other entities name by key have no file: `size`, `creatureType`, `spellSchool` (has one), `itemRarity`, `areaShape`, `featCategory`, `toolKind`.

#### 3. What it should look like when done

1. The importer makes `ability`, `skill`, `condition`, `damageType`, `language`, `weaponProperty`, `weaponMastery` (2024 only), `spellSchool`, `toolKind`, `size`, `creatureType`, `itemRarity`, `areaShape` and `featCategory` (2024 only). Run through the frame over the real source, it gives 0 problems in both rulesets.
2. Counts, SRD 5.1 / SRD 5.2.1: ability 6 / 6, skill 18 / 18, condition 15 / 15, damageType 13 / 13, language 16 / 19, weaponProperty 11 / 10, weaponMastery 0 / 8, spellSchool 8 / 8, toolKind 37 / 37, size 6 / 6, creatureType 14 / 14, itemRarity 7 / 7, areaShape 5 / 6, featCategory 0 / 4. Total 156 / 171.
3. An entity made from a file has the id `<pack>:<type>/<slug>` of its entry and the key in camelCase (`deep-speech` is `deepSpeech`).
4. A stat is named by its `full_name`, has the source's short form as `abbr` and the file's order. A skill names its stat's key. Only Perception is `passive`.
5. A tool kind is made for each proficiency of a tool group, named by the item it is a proficiency of.
6. Every value the source uses for a size, a creature type, a rarity, a school, an area shape and a feat category has an entity (the test reads each set from the source).
7. Each small entity the hand-written packs hold has, in the import, the same id, key and name.

#### 4. How to do it

1. A file's entries become entities with the frame's `baseOf` and a `key`. A stat's name and `abbr` swap the source's two fields.
2. A type with no file is a table in the importer, one row of slug and name, from the values measured in the source (§8). Names are the source's spelling.
3. `keyOf` is written here and exported, since the frame is not edited in wave 2.
4. Tool kinds read `Proficiencies` (the proficiencies of tools and vehicles) and take the id and name of `reference`, so a tool item (CONT-12) and its kind share a key.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/content/test/import-small-types.test.ts` — 33: `keyOf`; for each ruleset, 0 problems, the count of each type, the id and key of each entity, the ids of each file's entities against its entries, the stats' names and order, the skills' stats and the one passive skill, unique keys; the sizes, creature types, rarities and schools against what the source uses; the area shapes (SRD 5.1's `area_of_effect.type`, SRD 5.2.1's spell texts); the feat kinds; 37 tool kinds in each ruleset and the golden characters' tool keys; the hand-written packs' small entities against the import. No rules text is written in the test.
- Control numbers from: §8, measured by a script outside the repository.

#### 8. Checked against the source

5e-bits/5e-srd-api at `e6edf9a`, measured 2026-11-11:
- **Files:** the counts in §2. 2024 `Languages` has `common-sign-language`, `druidic` and `thieves-cant`, which 2014 does not. 2014 `Weapon-Properties` has `monk` and `special`; 2024 has `range` and no `special`.
- **Sizes:** both rulesets' monsters use Tiny, Small, Medium, Large, Huge, Gargantuan; 2024 also has "Medium or small" (30), which is two of them.
- **Creature types:** 14 in each ruleset (aberration, beast, celestial, construct, dragon, elemental, fey, fiend, giant, humanoid, monstrosity, ooze, plant, undead), and the swarm types ("swarm of Tiny beasts" 10 in 2014 and 6 in 2024, "swarm of tiny undead" 1) are a beast or an undead. 2024 species: `type` "Humanoid" for 9.
- **Rarities:** 2014: Common, Uncommon, Rare, Very Rare, Legendary, Artifact, Varies. 2024 has the same and writes "Rarity Varies", and 9 items whose rarity is one of 6 other strings ("Uncommon (+1), Rare (+2), or Very Rare (+3)" on 4 of them); CONT-13 reads each into one key.
- **Area shapes:** 2014 `area_of_effect.type` on 88 spells: cube 26, sphere 39, line 8, cone 6, cylinder 9. 2024 spells have no such field; their texts name Sphere, Cube, Emanation, Cone, Cylinder and Line.
- **Feat kinds:** 2024 `Feats.type`: origin 4, general 2, fighting-style 4, epic-boon 7; 2014's one feat has none.
- **Tool proficiencies:** types "Artisan's Tools", "Gaming Sets", "Musical Instruments", "Other", "Vehicles" (2014: 19, 2, 10, 4, 2) and "Artisan's Tools", "Tools", "Musical Instruments", "Other" (2024: 18, 8, 10, 1), 37 each. 2024's `tool-dice` is a proficiency of `dice`; the key is the `reference`'s. Two 2014 entries are vehicles (`land-vehicles`, `waterborne-vehicles`) and are kept as kinds.
- **Passive:** 5e-database has no passive flag; Perception is the one passive skill as the hand-written packs have it (ENG-09, SPEC §8).
- No `[ПРОВЕРИТЬ]` is involved.

#### 9. Not in this ticket

- Conditions' levels and effects (`maxLevel`, exhaustion): mechanics, CONT-16 and the rows after it.
- Alignments (9 and 10) and poisons (14, SRD 5.2.1): no entity type takes them; CONT-69.
- A language's kind (standard or exotic, rare) and its speakers: the source's `type`, `typical_speakers` and `note` are not read, since no field holds them.
- Which rarity a composite string means: CONT-13.

#### 10. Rake check

- **Everything is data:** the six stats and 18 skills come from the source's files, never from the code; a skill's stat is read from the entry.
- **Ids are stable:** an id is the source's slug, as the hand-written packs have it; the test compares them.
- **No rules text:** the test asserts ids, keys and counts; the tables hold names only.
- **Names:** the entities hold no trademarked name.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 522 files, no fixes; `pnpm typecheck` clean; `pnpm test` 151 files, 1772 passed, 0 failed, 36.6 s (33 new, from 1739), then speed 2 passed; coverage statements 99.02 % (4162/4203), lines 99.78 % (3648/3656). No `pnpm e2e`: `apps/web` is not touched.

**Keys the later rows name, which this ticket makes** (the id is `<pack>:<type>/<slug>`, the key is the slug in camelCase):
- `size`: tiny, small, medium, large, huge, gargantuan.
- `creatureType`: aberration, beast, celestial, construct, dragon, elemental, fey, fiend, giant, humanoid, monstrosity, ooze, plant, undead.
- `spellSchool`: abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy, transmutation.
- `itemRarity`: common, uncommon, rare, veryRare (slug `very-rare`), legendary, artifact, varies.
- `areaShape`: cone, cube, cylinder, line, sphere; and `emanation` in SRD 5.2.1.
- `featCategory` (SRD 5.2.1): origin, general, fightingStyle (slug `fighting-style`), epicBoon (slug `epic-boon`).
- `toolKind`: the camelCase of the equipment item's index: `smithsTools`, `brewersSupplies`, `diceSet` (2014) and `dice`, `playingCards`, `threeDragonAnte` (2024), and `landVehicles`, `waterborneVehicles` (2014). A tool item (CONT-12) uses the same key.
- `keyOf(slug)` is exported from `smallTypes.ts`.

**Difference from the row:** the row says "proficiencies". There is no proficiency entity type: a proficiency names a skill, stat, language, tool kind, armor group or weapon key, so only tool kinds needed entities. The other kinds name entities that already exist.

**Found, not fixed:** `keyOf` is not in the frame (CONT-68, XS). Alignments and poisons have no importer (CONT-69, S). A language's standard or exotic kind, and its speakers, are in the source and in no field.

**Changelog:** nothing for the changelog; a person sees nothing yet.

---

### CONT-09 Species are imported with their subraces

**Hat:** SRD 5.1's races and subraces and SRD 5.2.1's species and subspecies become entities, with their traits
**Depends on:** CONT-14 (the keys of sizes and creature types, `keyOf`), CONT-05
**Size:** S
**Screen:** No
**SPEC:** §3 (both SRDs), §5.1, §5.3, §5.5 (grants), §6.8 (what the source gives and what it does not); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/content/src/import/species.ts` — changes: from the empty importer to the real one.
- `packages/content/test/import-species.test.ts` — new.

#### 2. What is missing now

Measured on `9380ebf`: `species` has no types, no files and makes nothing. The source at `e6edf9a` has 9 races, 4 subraces and 38 traits (SRD 5.1) and 9 species, 24 subspecies and 67 traits (SRD 5.2.1), and `Proficiencies` (117 and 74 entries).

#### 3. What it should look like when done

1. The importer makes `species`, `lineage` and `feature`. Run through the frame over the real source it gives 0 problems in both rulesets, and counts of 9, 4 and 38 (SRD 5.1) and 9, 24 and 67 (SRD 5.2.1). Each id is the source's slug.
2. A species has its `size` (a list), `speed` in feet (`walk`), and, in SRD 5.2.1, `creatureType`. SRD 5.2.1's human is `['medium', 'small']`, and its tiefling `['small', 'medium']`, from its `size_options`. Every other one is its one size.
3. A species and a lineage hold grants for what the source structures: `ability-scores` (fixed increases), `ability-score-choice` (the half-elf: two of five stats by 1), `languages` (the fixed ones and a pick from a list), `traits` (an `entity` grant of its trait ids, in the source's order), and `subrace` (SRD 5.1) or `lineage` (SRD 5.2.1): one pick from its lineages.
4. The high elf's Extra Language: its `languages` grant is on the lineage (a pick from 14), and the `extra-language` trait has no grant.
5. A trait is a `feature` with its words, and grants for its proficiencies (`weapons`, `skills`, `tools`: fixed and a pick from a list) and, for the dragonborn's Draconic Ancestry (SRD 5.1), `subtraits`: one of its ten traits.
6. SRD 5.2.1's Draconic Ancestry, which names the dragonborn and is in no species' or subspecies' trait list, is added to the dragonborn's traits. No trait of either ruleset is left that nothing gives.
7. The hand-written packs' species, lineages and traits are imported under the same ids, and a species or lineage has the same size, speed, creature type and grants as the pack's (the dwarf, the hill dwarf, the 2024 human).

#### 4. How to do it

1. A race's `ability_bonuses`, `languages`, `language_options` and `traits`, and a subrace's, become grants as §3 says. A `Proficiencies` entry maps to the category and key of what it is a proficiency of (`reference`): a skill's, a weapon's (by item, so `light-hammers` is `lightHammer`), a tool's.
2. SRD 5.1's races have no text of their own: the four fields (`age`, `alignment`, `size_description`, `language_desc`) become the species' text, each under the label the SRD prints it with (`**Age.** …`).
3. What the source gives as structure is imported; what it gives as an effect, a resource or a spell is not (SPEC §6.8): CONT-34 and CONT-35.
4. SRD 5.2.1 has no language on any species (the row's note), so its species have no `languages` grant.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/content/test/import-species.test.ts` — 29: for each ruleset, 0 problems, the counts, one entity for each entry under its slug, every entity grant naming an imported entity and every trait and lineage named by one, the words of every trait; SRD 5.1: sizes and speeds, the race text, the fixed stat increases of the races and subraces, the half-elf's choice, the languages of each race, the high elf's language on the lineage, the traits and the subrace choice, the proficiencies of seven traits, the ten dragonborn ancestries; SRD 5.2.1: creature type, sizes and speeds, the human and the tiefling, no stat or language grant, the lineages offered, Draconic Ancestry, the skill choices of two traits; the hand-written packs' ids and grants.
- Control numbers from: §8, measured by a script outside the repository.

#### 8. Checked against the source

5e-bits/5e-srd-api at `e6edf9a`, measured 2026-11-11:
- **Counts:** SRD 5.1 `Races` 9, `Subraces` 4, `Traits` 38; SRD 5.2.1 `Species` 9, `Subspecies` 24, `Traits` 67. SRD 5.1: 2 races are Small (halfling, gnome), 7 are Medium. SRD 5.2.1: `size` is Medium for 6, Small for 2 (halfling, gnome), and absent for the tiefling, whose `size_options` lists Small and Medium. All 9 species have `type` "Humanoid"; SRD 5.1 races have none.
- **Speeds:** SRD 5.1: 25 for the dwarf, halfling and gnome, 30 for the rest. SRD 5.2.1: 35 for the goliath, 30 for the rest.
- **The human's size (the row's note, found by ENG-10 §11, not re-read here):** 5e-database gives the SRD 5.2.1 human `Medium`; the SRD's text is Medium or Small. The importer follows the note, for the human alone (`SIZE_BY_SPECIES`).
- **Stat increases (SRD 5.1):** `ability_bonuses` on all 9 races (the human: six of +1; the half-elf: Charisma +2) and all 4 subraces; the half-elf has `ability_bonus_options`: choose 2, five stats (all but Charisma), each +1. SRD 5.2.1 has none (SPEC §3.1: the stats come from the background).
- **Languages (SRD 5.1):** `languages` on all 9; `language_options` on the human (1 of 15) and the half-elf (1 of 14); the trait `extra-language` has `language_options` (1 of 14) and belongs to the high elf. SRD 5.2.1 species have none (the row's note).
- **Proficiencies:** 5 SRD 5.1 traits list `proficiencies` (`dwarven-combat-training`, `keen-senses`, `elf-weapon-training`, `tinker`, `menacing`); 2 have `proficiency_choices` (`tool-proficiency`: 1 of 3, `skill-versatility`: 2 of 18). SRD 5.2.1: `keen-senses` (1 of 3 skills) and `skillful` (1 of 18); the options name the skill itself, not its proficiency. Every proficiency's `reference` is the skill, the weapon or the tool.
- **Traits:** `draconic-ancestry` (SRD 5.1) has `trait_specific.subtrait_options`: 1 of 10 traits (`draconic-ancestry-<color>`). In SRD 5.2.1 the trait `draconic-ancestry` has `species: dragonborn` and is in none of the 33 `traits` lists. SRD 5.1 has no trait that nothing lists. `Traits` and `Features` share no index.
- **Not imported, as effects or spells:** SRD 5.1 `trait_specific` on 12 traits (the high elf's cantrip choice, ten ancestries' damage types and breath weapons); SRD 5.2.1 `spells` on 20 traits, `speed` on `wood-elf-speed-increase` (35), `damage_type` on the 10 dragonborn subspecies.
- No `[ПРОВЕРИТЬ]` is involved.

#### 9. Not in this ticket

- The races' and species' effects, resources and spells (Dwarven Toughness, Lucky, Breath Weapon, Infernal Legacy, Elven Lineage): CONT-34 and CONT-35.
- A species' words in SRD 5.2.1: the source has none for a species or a lineage.
- The Species topic and the words "Race" and "Species": CONT-46.

#### 10. Rake check

- **Everything is data:** no stat, skill or language is named in the code; a stat key is read from the entry's link.
- **Ids are stable:** every id is the source's slug, and the hand-written packs' ids are the same (§7).
- **No ruleset checks scattered:** the two sources' shapes are read in one place each (`speciesOf`, `lineagesOf`), by the file names; the human's size is a table keyed by species.
- **No rules text:** the test asserts ids, keys, counts and shapes.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 523 files, no fixes; `pnpm typecheck` clean; `pnpm test` 152 files, 1801 passed, 0 failed, 33.6 s (29 new, from 1772), then speed 2 passed; coverage statements 99.02 % (4162/4203), lines 99.78 % (3648/3656). No `pnpm e2e`: `apps/web` is not touched.

**First run found two things in my own test, none in the importer:** the human's language list has 15 options, not 14 (the half-elf's and the high elf's have 14), and the hand-written packs hold features of classes and backgrounds, which are other importers'. It also found Draconic Ancestry (SRD 5.2.1), in no trait list (§3 item 6).

**Difference from the row:** none. The row's note on the human's size and the high elf's language is followed.

**Found, not fixed:**
- `species.ts` keeps its own map from a `Proficiencies` entry to a grant's category and key, for the kinds a species' traits need. CONT-08 and CONT-10 need all kinds (armor, saving throws, the weapon groups). It is part of CONT-68, with `keyOf`.
- A trait's proficiency choice is the source's list of 18 skills, where the hand-written 2024 `skillful` uses the filter `{ type: 'skill' }`. The two differ until CONT-35 merges its mechanics, which should choose one.
- SRD 5.2.1's 10 dragonborn subspecies carry `damage_type`, which no field holds. The trait ids (`draconic-breath-weapon-acid`) say it, and CONT-35 writes the effect.

**Changelog:** nothing for the changelog; a person sees nothing yet.

---

### CONT-11 Feats are imported from both SRDs

**Hat:** The feats of both SRDs become `feat` entities with their category and prerequisites
**Depends on:** CONT-14 (the feat categories), CONT-05 (`featureNamed`, `repeatable`)
**Size:** S
**Screen:** No
**SPEC:** §3.1 (the feats of both SRDs), §5.1, §5.3, §5.5 (prerequisites); ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/content/src/import/feats.ts` — changes: from the empty importer to the real one.
- `packages/content/test/import-feats.test.ts` — new.

#### 2. What is missing now

Measured on `c94d33e`: `feats` has no types, no files and makes nothing. The source at `e6edf9a` has 1 feat in SRD 5.1 and 17 in SRD 5.2.1.

#### 3. What it should look like when done

1. The importer makes `feat`: 1 for SRD 5.1 (Grappler) and 17 for SRD 5.2.1 (4 origin, 2 general, 4 fighting style, 7 epic boons), 0 problems in both rulesets. Each id is the source's slug, each has its name and words.
2. SRD 5.2.1's `category` is the feat's `type` as a key (`fightingStyle`, `epicBoon`), and each names a `featCategory` entity CONT-14 made. SRD 5.1's Grappler has none.
3. `repeatable` is `true` on Ability Score Improvement, Magic Initiate and Skilled, and absent on the other fourteen.
4. Prerequisites: SRD 5.1's Grappler: `ability` Strength 13. SRD 5.2.1: `level` 4 on Ability Score Improvement and Grappler, `level` 19 on the 7 epic boons, `featureNamed` "Fighting Style" on the 4 fighting style feats and "Spellcasting" on Boon of Spell Recall. Grappler's "Strength or Dexterity 13+" is a `formula` prerequisite, `@abilities.str.score >= 13 || @abilities.dex.score >= 13`, with the source's words as its label.
5. The hand-written packs' feats (Alert, Savage Attacker, Defense) are imported with the same id, name and category.

#### 4. How to do it

1. The prerequisites are read in the source's two shapes: SRD 5.1's list of stat minimums, and SRD 5.2.1's object (`minimum_level`, `feature_named`) with `prerequisite_options`.
2. "One of several stats" is a formula joined by `||`, as the hand-written multiclass prerequisite of the 2024 fighter is; the label is the source's `desc`. Options of any other kind throw, so a shape this ticket did not meet is never read wrongly.
3. What a feat gives (its stat increase, its grants, its effects, `activation`) is not in the source: CONT-37.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/content/test/import-feats.test.ts` — 13: for each ruleset, 0 problems and one feat for each entry with its name and words; SRD 5.1's Grappler; SRD 5.2.1's counts by category, that each category exists, the three repeatable feats, the levels, the feature names, Grappler's formula; the hand-written packs' feats.
- Control numbers from: §8, measured by a script outside the repository.

#### 8. Checked against the source

5e-bits/5e-srd-api at `e6edf9a`, measured 2026-11-11:
- **Counts:** SRD 5.1 `Feats` 1 (`grappler`); SRD 5.2.1 17, with `type`: origin 4, general 2, fighting-style 4, epic-boon 7.
- **Prerequisites:** SRD 5.1 `grappler`: `prerequisites` is a list of one: Strength, `minimum_score` 13. SRD 5.2.1 gives an object with two keys at most: `minimum_level` (4 on `ability-score-improvement` and `grappler`; 19 on the 7 boons) and `feature_named` ("Fighting Style" on 4; "Spellcasting" on `boon-of-spell-recall`, which has both). `grappler` also has `prerequisite_options`: `choose` 1 of two `score_prerequisite` options, Strength 13 and Dexterity 13, `desc` "Strength or Dexterity 13+". No other feat has it.
- **`repeatable`:** present on 3 SRD 5.2.1 feats, and a string, the rule's words ("You can take this feat more than once", with, for Magic Initiate, a different spell list each time). It is not a flag, so the importer reads its presence as `true`.
- No `[ПРОВЕРИТЬ]` is involved.

#### 9. Not in this ticket

- What a feat gives or changes (grants, effects, `activation`): CONT-37.
- That each take of a repeatable feat has its own choices, and Magic Initiate's different spell list: CONT-66.
- A feat the SRD text has and 5e-database does not: none; SPEC §3.1 counts 18 and the source has 18.

#### 10. Rake check

- **Prerequisites warn, never block:** the formula and `featureNamed` are checked by the engine as warnings.
- **Everything is data:** no stat is named in the code; the formula's keys are read from the options.
- **No ruleset checks scattered:** the two shapes are read by what the entry holds, not by the ruleset.
- **No rules text:** the test asserts ids, keys, counts and shapes; the label of a formula is the source's words and is asserted in one test, as the hand-written pack does.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 524 files, no fixes; `pnpm typecheck` clean; `pnpm test` 153 files, 1814 passed, 0 failed, 34.2 s (13 new, from 1801), then speed 2 passed; coverage statements 99.02 % (4162/4203), lines 99.78 % (3648/3656). No `pnpm e2e`: `apps/web` is not touched.

**First run found one thing:** `repeatable` is the rule's words, not `true` (§8). My first reading found none of the three.

**Difference from the row:** the row's count of 17 and its four categories are as measured. The row's "SPEC §3.1" lists no feat outside the 18.

**Found, not fixed:** nothing outside the hat. For CONT-66: Magic Initiate's "different spell list each time" is in the words only.

**Changelog:** nothing for the changelog; a person sees nothing yet.

---

### CONT-13 Magic items are imported from both SRDs

**Hat:** The magic items of both SRDs become `item` entities with a `magic` block
**Depends on:** CONT-14 (the rarity keys), CONT-05 (`magic.bonus` and the item fields)
**Size:** S
**Screen:** No
**SPEC:** §3.1 (magic items in both SRDs), §5.1, §5.3 (`ItemDef`), §6.8; ADR 003

---

#### 1. Where the code lives

**Main file:** `packages/content/src/import/magicItems.ts` — changes: from the empty importer to the real one.
- `packages/content/test/import-magic-items.test.ts` — new.

#### 2. What is missing now

Measured on `fd44abf`: `magicItems` has no types, no files and makes nothing. The source at `e6edf9a` has 362 magic items in SRD 5.1 and 262 in SRD 5.2.1.

#### 3. What it should look like when done

1. The importer makes `item`: 362 and 262, 0 problems in both rulesets. Each has its name, its words, the source's equipment category as a tag, and a `magic` block with a `rarity` key CONT-14 made.
2. Rarity: one rarity is its key; an item that comes in several (`Uncommon (+1), Rare (+2), or Very Rare (+3)`) or says it varies is `varies`. SRD 5.1: common 4, uncommon 94, rare 119, very rare 90, legendary 43, artifact 1, varies 11. SRD 5.2.1: 1, 74, 87, 54, 32, 1, 13.
3. Attunement: `true` when anyone may, or the words of who may. SRD 5.1: 146 and 29 (read from the first line of the words); SRD 5.2.1: 113 and 23 (`attunement` and `limited-to`). An item with no attunement has none.
4. Category: `consumable` for potions and scrolls (51; 20), `ammunition` (5; 5), `shield` (4; 8), and `gear` for the other 302 and 229. No item has a `weapon` or an `armor` block.
5. A variant ("Armor, +1") has `meta.variantOf`, the id of its parent: 123 and 19. It takes its kind from its parent's first line, and has `magic.bonus` 1, 2 or 3: 12 and 15, from its rarity ("Uncommon (+1)") or the end of its name.
6. SRD 5.2.1's magic `shield` has the slug `shield-magic`, since `shield` is the equipment's, which the hand-written pack names. No other id of either ruleset differs from the source's slug.

#### 4. How to do it

1. The magic item and the equipment of a ruleset share the type `item`, so the importer reads `Equipment` for its slugs, and a magic item whose slug an equipment item has takes `-magic`. The equipment keeps the source's slug. It is 1 item in SRD 5.2.1 and none in SRD 5.1.
2. A magic weapon or armor is `gear` with its category as a tag, because the schema asks a `weapon` block (a group, a kind) of the category `weapon` and an `armor` block of `armor`, and the source says only "any sword" or "light, medium, or heavy". CONT-39 gives a block, and so the category, to an item that needs one. A technical choice (ADR 002).
3. The first line of SRD 5.1's words is where it writes the kind, the rarity and "(requires attunement …)". SRD 5.2.1 has the flag and `limited-to`.
4. No `key` is set: an item's key is for a formula to read, and the mechanics rows add one.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/content/test/import-magic-items.test.ts` — 25: for each ruleset, 0 problems, one item for each entry, the slugs and the one `-magic`, words and a magic block and no weapon or armor block, the four categories' counts, the tags, each rarity's count and that each key exists, the variants and their parents, the bonuses, the two kinds of attunement; SRD 5.1's first lines (a ring, a bag, the Holy Avenger, the Ring of Shooting Stars), ammunition by its parent, a potion, a shield; SRD 5.2.1's flag and `limited-to`, the magic shield and its three variants, bonuses from rarity and name; the hand-written packs' items are not made here.
- Control numbers from: §8, measured by a script outside the repository.

#### 8. Checked against the source

5e-bits/5e-srd-api at `e6edf9a`, measured 2026-11-11:
- **Counts and shape:** 362 and 262 entries; `equipment_category` (SRD 5.1: wondrous-items 177, weapon 30, armor 29, potion 40, ring 36, wand 16, staff 12, scroll 11, rod 6, ammunition 5; SRD 5.2.1: wondrous-items 133, weapons 36, armor 23, rings 22, potions 20, wands 16, staffs 12); `variant` true on 123 and 19, each listed by exactly one parent's `variants`; no parent is missing.
- **Rarity:** SRD 5.1 has 7 names (`Varies` on 11). SRD 5.2.1 has 12 strings, 6 of them composite or bracketed: `Rarity Varies` (7), `Uncommon (+1), Rare (+2), or Very Rare (+3)` (4), `Rare (+1), Very Rare (+2), or Legendary (+3)` (1), `Rare (Silver or Brass), Very Rare (Bronze), or Legendary (Iron)` (1), and `Uncommon (+1)`, `Rare (+2)`, `Very Rare (+3)` (one each, the variants).
- **Attunement:** SRD 5.1 has none as a field; 175 first lines say "(requires attunement …)": 146 plain and 29 with who or when ("by a spellcaster", "outdoors at night"). SRD 5.2.1 has `attunement` (136 true) and `limited-to` on 23, all with `attunement` true.
- **The id clash:** SRD 5.2.1 `Magic-Items` `shield` (the parent of Shield +1, +2, +3, category armor) and `Equipment` `shield` (the plain shield). SRD 5.1 has none.
- **A gap:** SRD 5.1 `hammer-of-thunderbolts`: its first line is "Weapon (maul), legendary", and its words say "While attuned to it". Imported as the source gives it, without attunement.
- No `[ПРОВЕРИТЬ]` is involved.

#### 9. Not in this ticket

- What an item does (effects, charges, spells, resources): CONT-39.
- A `weapon` or `armor` block, and so the category, for a magic weapon or armor: CONT-39. A magic weapon counting as the weapon it is a kind of: CONT-67.
- The plain weapons, armor and gear: CONT-12.
- An item's price and weight: the source has neither.

#### 10. Rake check

- **Ids are stable:** an id is the source's slug; the one that clashes takes a suffix and is written in §3 and in CONT-39's note, and the hand-written `shield` is untouched (the last test).
- **Missing is not broken:** an item without a block is still an item; no field is read that is not there.
- **Everything is data:** no stat or ability is named in the code.
- **No rules text:** the test asserts ids, keys, counts and shapes; the one phrase it reads ("a paladin") is who may attune, as a value of the field.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 525 files, no fixes; `pnpm typecheck` clean; `pnpm test` 154 files, 1839 passed, 0 failed, 35.3 s (25 new, from 1814), then speed 2 passed; coverage statements 99.02 % (4162/4203), lines 99.78 % (3648/3656). No `pnpm e2e`: `apps/web` is not touched.

**Difference from the row:** none. The row says "the import only".

**Found, not fixed** (all three are in CONT-39's note in `BACKLOG.md`):
- A magic weapon or armor is `gear` with a tag until CONT-39 gives it a block (§4.2).
- The id `srd-2024:item/shield-magic`.
- `hammer-of-thunderbolts` has no attunement in the source while its words speak of being attuned: to be checked against SRD 5.1's own text.

**Changelog:** nothing for the changelog; a person sees nothing yet.

---

### CONT-12 Equipment is imported from both SRDs

**Hat:** The armor, weapons, gear, tools, packs, mounts and vehicles of both SRDs become `item` entities
**Depends on:** CONT-14 (the keys of damage types, properties, masteries and tool kinds), CONT-05 (`transport`), CONT-13 (the one id it shares)
**Size:** M
**Screen:** No
**SPEC:** §3 (both SRDs), §5.1, §5.3 (`ItemDef`), §5.5 (an item grant); ADR 003, ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/content/src/import/equipment.ts` — changes: from the empty importer to the real one.
- `packages/content/test/import-equipment.test.ts` — new.

#### 2. What is missing now

Measured on `9d0137f`: `equipment` has no types, no files and makes nothing. The source at `e6edf9a` has 237 equipment entries in SRD 5.1 and 182 in SRD 5.2.1.

#### 3. What it should look like when done

1. The importer makes `item`: 237 and 182, 0 problems in both rulesets, one for each entry under the entry's slug, with its name, a `key` (the slug in camelCase, unique) and its words where it has any.
2. Categories, SRD 5.1 / SRD 5.2.1: weapon 37 / 38, armor 12 / 12, shield 1 / 1, tool 35 / 37, pack 7 / 7, ammunition 4 / 5, focus 12 / 10, transport 40 / 0, gear 89 / 72.
3. A weapon has a `weapon` block: its group (simple or martial), its kind (melee or ranged), its damage as a formula and a damage type key, `versatile` (the two-handed die), `properties` as keys, `range` in feet, and in SRD 5.2.1 its `mastery`. Each is tagged `melee` or `ranged`, the tag the barbarian's "Melee weapons" choice reads (CONT-05 §3 item 8).
4. An armor has an `armor` block: 3 light, 5 medium, 4 heavy; `dexCap` null for light, 2 for medium, 0 for heavy; `strRequirement` for the 3 that have one; `stealthDisadvantage` for the 7.
5. A shield has no armor block and the effect SPEC §5.3 writes: `ac.bonus`, `add`, its armor class, `when` `@equipped`.
6. A pack's contents are an `item` grant `contents` with each item's id and quantity; every item named exists.
7. SRD 5.1's 40 mounts and vehicles are `transport`, tagged with the source's kind: 9, 25 and 6.
8. A price or a weight of 0 is left out (7 free items in SRD 5.1 have no price; 52 and 22 items have no weight).
9. The hand-written packs' items (chain mail, shield, warhammer in SRD 5.1; chain mail, greatsword and the others in SRD 5.2.1) are imported with the same key, name, category, price, weight, armor block and effects, and a weapon block that contains the pack's.

#### 4. How to do it

1. The category comes from the source's lists, first that fits: a pack, a weapon, a shield, an armor, a tool, a mount or vehicle, ammunition, a focus, else gear. A weapon is first, so SRD 5.2.1's quarterstaff, which is also a focus, is a weapon.
2. The source's lists are both read. SRD 5.2.1's entries and its `Equipment-Categories` file disagree on 6 items (§8): an item is in a category when either lists it, a pack is any entry with `contents`, and an armor whose own list names two groups takes the one the categories file gives. The categories file is also what SRD 5.1 and the AC of the armor agree with.
3. A tool is an item that a tool proficiency is of (`Proficiencies`' `reference`), so the four SRD 5.1 kits that are tools are tools, and each tool kind CONT-14 made has an item with its key.
4. A weapon's kind and group, and an armor's group, are read from the categories, not from a ruleset's own field, so the two SRDs go through one path.
5. What the schema cannot hold is left out and named in §11 (CONT-70).

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/content/test/import-equipment.test.ts` — 27: for each ruleset, 0 problems, one item for each entry under its slug and name, unique keys, each category's count, the blocks only where a category has them and a shield's effect, no price or weight of 0 and the number without either, the words, the weapons by group, kind, versatile and mastery with their tags, damage types, properties and masteries that exist, the armor groups and caps, the packs and what they name; SRD 5.1: the 40 transport items by kind, the four kits, a longsword, a longbow, a net, the free items; SRD 5.2.1: no transport, the packs and the disguise kit, a longsword with its mastery, the quarterstaff, the lance; the hand-written packs' items.
- The registry test of CONT-04 now runs `equipment` and `magicItems` together over the real source: 0 problems, so no id is made twice.
- Control numbers from: §8, measured by a script outside the repository.

#### 8. Checked against the source

5e-bits/5e-srd-api at `e6edf9a`, measured 2026-11-11:
- **Counts:** SRD 5.1 237 entries: weapon 37 (simple 14, martial 23), armor 12 and shield 1, tools 31 (artisan's 17, gaming sets 2, musical instruments 10, other 2), `mounts-and-vehicles` 40, packs 7 (each with `contents`), adventuring gear 116 (standard 86, kits 7, packs 7, ammunition 4, holy symbols 3, arcane foci 5, druidic foci 4). SRD 5.2.1 182 entries: weapons 38 (simple 14, martial 24), armor 12 and shield 1, tools 36, packs 7 with `contents`, ammunition 5; it has no mount or vehicle.
- **Two lists:** each SRD 5.2.1 entry lists its `equipment_categories`, and `Equipment-Categories` lists its `equipment`. They differ for `hide-armor` (the entry: light armor; the file: medium), `disguise-kit` (the file: tools; the entry: adventuring gear), `forgery-kit` (the entry: tools; the file: other tools only), `explorers-pack` (the file: packs; the entry: gear only), `entertainers-pack` (the entry: gear), `longsword` (the entry: martial melee; the file: not), `spellbook` (the entry: gear). SRD 5.1's two lists agree. The importer follows §4.2. Hide Armor has AC 12 with Dexterity capped at 2, as the three other medium armors of the SRD 5.2.1 file have, where the three light ones have no cap.
- **Tool kits (SRD 5.1):** the disguise, forgery, herbalism and poisoner's kits are the `reference` of tool proficiencies and have `gear_category` "Kits", so the source files them under gear.
- **Weapons:** 36 of 37 SRD 5.1 weapons have `damage` (the net has none), all 38 in SRD 5.2.1; `two_handed_damage` on 6 and 7 (each has the `versatile` property); `range` `{ normal, long? }` in feet (5 for most melee weapons); `mastery` on 38 SRD 5.2.1 weapons (8 kinds); `properties` 11 kinds in SRD 5.1 and 9 in SRD 5.2.1 (as CONT-14 lists them).
- **Armor:** `armor_class` `{ base, dex_bonus, max_bonus? }`: `dex_bonus` false for the heavy armors and the shield, true for the others, `max_bonus` 2 for the 5 medium armors, absent for light ones (SRD 5.2.1's heavy armors carry `max_bonus` 0). `str_minimum` 13 (1) and 15 (2). `stealth_disadvantage` true on 7.
- **Costs and weights:** `cost` `{ quantity, unit }` in cp, sp or gp, 0 for 7 SRD 5.1 items (`alms-box`, `block-of-incense`, `censer`, `little-bag-of-sand`, `small-knife`, `string-10-feet`, `vestments`); no `weight` on 22 and weight 0 on 30 SRD 5.1 items, none and 0 on 1 and 21 SRD 5.2.1 items; 6 and 5 weights have fractions.
- **What the schema has no field for:** `throw_range` on 8 and 7 weapons; `quantity` on 4 and 5 bundles of ammunition; `speed` on 15 and `capacity` on 9 mounts and vehicles; SRD 5.2.1's tool `ability` (37), `craft` (20) and `utilize` (36), `storage` (5), `don_time` and `doff_time` (12 armors), `ammunition` (9).
- No `[ПРОВЕРИТЬ]` is involved.

#### 9. Not in this ticket

- The values of §8's last bullet: CONT-70.
- A weapon's, armor's or tool's effects other than the shield's: the mechanics rows.
- The magic items: CONT-13. The poisons of SRD 5.2.1 and the alignments: CONT-69.
- Reading `baseKey`, `proficient` or the `melee` tag in the engine: CONT-64, CONT-67; the filter reads the tag already.

#### 10. Rake check

- **Ids are stable:** an id is the source's slug, as the hand-written packs have it; the last test compares.
- **Everything is data:** the six stats and the damage types are never named in the code; a damage type, a property and a mastery are read from the entry and exist as CONT-14's entities (a test).
- **Stored units are feet and pounds:** a weapon's range is the source's feet, a weight its pounds; no conversion.
- **No ruleset checks scattered:** the two SRDs go through one path, by the categories each lists; the only edition-specific field read is none.
- **No rules text:** the test asserts ids, keys, counts and shapes.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 526 files, no fixes; `pnpm typecheck` clean; `pnpm test` 155 files, 1866 passed, 0 failed, 35.0 s (27 new, from 1839), then speed 2 passed; coverage statements 99.02 % (4162/4203), lines 99.78 % (3648/3656). No `pnpm e2e`: `apps/web` is not touched.

**First run found five things in the source, none in the code's first guess:**
1. A price of 0 on 7 SRD 5.1 items: the schema asks an amount above 0, so it is left out.
2. SRD 5.2.1's entries and its categories file disagree for 6 items (§8). My first rule (the entry's own list) made Hide Armor a light armor with a Dexterity cap of 2, and two packs and the disguise kit gear. Both lists now count, and §4.2 decides between two groups.
3. Four SRD 5.1 kits are tools by proficiency and gear by category: they are tools (§4.3).
4. A pack is an entry with `contents`, since two SRD 5.2.1 packs lack the pack category.
5. The `shield` of SRD 5.2.1 is the equipment's; CONT-13 gave the magic one `shield-magic`.

**Difference from the row:** the row says nothing of the two lists or the kits. Mounts and vehicles are `transport` as it says, and weapons are tagged `melee` or `ranged`.

**To check (the owner's, if it differs from the SRD):** SRD 5.2.1 `hide-armor` is imported as medium armor (the categories file, and the SRD 5.1 table), where the entry says light; the importer follows the file. If SRD 5.2.1's armor table says otherwise, the one place is `armorOf` in `equipment.ts`.

**Found, not fixed:** the values of §8's last bullet, which the item schema has no field for: CONT-70 (M, wave 3's schema row). Nothing else.

**Changelog:** nothing for the changelog; a person sees nothing yet.

---

### CONT-10 Backgrounds are imported from both SRDs

**Hat:** The backgrounds of both SRDs become `background` entities
**Depends on:** CONT-14 (the tool kinds, languages and skills it names), CONT-11 (the feats a 2024 background gives), CONT-12 (the items SRD 5.1's gives)
**Size:** S
**Screen:** No
**SPEC:** §3 (both SRDs), §5.1, §5.5 (grants), §6.3 (the ruleset difference); ADR 003, ADR 004

---

#### 1. Where the code lives

**Main file:** `packages/content/src/import/backgrounds.ts` — changes: from the empty importer to the real one.
- `packages/content/test/import-backgrounds.test.ts` — new.

#### 2. What is missing now

Measured on `d7f2648`: `backgrounds` has no types, no files and makes nothing. The source at `e6edf9a` has 1 background in SRD 5.1 (Acolyte) and 4 in SRD 5.2.1 (Acolyte, Criminal, Sage, Soldier).

#### 3. What it should look like when done

1. The importer makes `background`: 1 and 4, 0 problems in both rulesets, one for each entry under its slug and name, each with words. SRD 5.1's Acolyte also makes the `feature` entity `srd-2014:feature/shelter-of-the-faithful`, which its `feature` grant names (the hand-written pack holds the same id).
2. SRD 5.2.1: each background has an `abilityScore` grant `ability-scores` in `distribute` mode over its three stats with the patterns `[2, 1]` and `[1, 1, 1]`, an `entity` grant `feat` of its origin feat, a `skill` grant of two skills and a `tool` grant (a fixed tool, or for the Soldier one of four gaming sets).
3. SRD 5.2.1: each background has a `language` grant with Common fixed and two to choose among the nine other Standard Languages (§8). ENG-56 reads them as 2024's starting languages (`languageSource: 'background'`).
4. SRD 5.1: the Acolyte has a `skill` grant (insight, religion), a `language` grant of two to choose from `{ type: 'language' }`, an `entity` grant of its feature and `item` grants: Clothes, common and a Pouch fixed, one item to choose from the three holy symbols.
5. The words of a 2024 background are its five lines of SRD 5.2.1 page 83, in its order (§8). The words of SRD 5.1's Acolyte are its proficiencies, languages, equipment, feature name and the four tables of suggested characteristics (8, 6, 6 and 6 rows), each ideal ending in its alignment word.
6. Every id a grant names exists: feats, features, items, skills, languages. Each background the two hand-written packs hold (the 2014 Acolyte, the 2024 Soldier) is imported under the same id with every grant the pack holds, each equal.

#### 4. How to do it

1. A complete map from each entry of `Proficiencies` to a category and keys: a skill by its key, a stat by its key (`save`), an armor by group (`light`, `medium`, `heavy`; `all-armor` by the three; `shield`; another armor by its item key), a weapon by group (`simple`, `martial`) or item key, and every tool, game, instrument and vehicle by CONT-14's tool kind key. It is this file's own (`CONT-68` moves it into the frame); a kind it does not name throws.
2. SRD 5.1's equipment: fixed items become one `item` grant with quantities; a choice of one item from a category becomes a `choose` over the category's items, read from `Equipment-Categories`.
3. SRD 5.2.1's languages: Common fixed, and a choice of two of the nine Standard Languages besides Common, a list in the importer with its page (the source has no such field).
4. The words of a 2024 background come from its structured fields in the SRD's order; the equipment line is the source's own `desc`.
5. What no grant can hold is left out and named in §11.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/content/test/import-backgrounds.test.ts` — 22: for each ruleset, 0 problems (the whole registry runs), one background for each entry under its slug and name with words, every named entity exists; SRD 5.1: the one background and its feature, the five grants, the characteristic tables by row count and alignment word, the equipment line; SRD 5.2.1: the four ids, each one's stats, feat, skills and tool, the Soldier's gaming-set choice, the languages on all four with the nine keys existing, no item grant, the five labels in order and the equipment line equal to the source's; the two hand-written packs' backgrounds and the features they name.
- Control numbers from: §8, measured by a script outside the repository.

#### 8. Checked against the source

5e-bits/5e-srd-api at `e6edf9a`, measured 2026-11-11, and SRD 5.2.1 (CC-BY-4.0):
- **Counts:** SRD 5.1 `Backgrounds` 1 entry (Acolyte: 2 skills, `language_options` choose 2 from all languages, 2 fixed items, 15 gp, one choice of a holy symbol, a `feature` of a name and 2 paragraphs, 8 personality traits, 6 ideals each with its alignments, 6 bonds, 6 flaws). SRD 5.2.1 `Backgrounds` 4 entries, each with `ability_scores` (3), `feat`, `proficiencies`, `equipment_options` (one `desc`); the Soldier also has `proficiency_choices`. The 2024 entries have no text and no language.
- **The words of SRD 5.2.1's backgrounds** are from the SRD 5.2.1 PDF, page 83 ("Background Descriptions": Acolyte, Criminal, Sage, Soldier), read from `https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf`, D&D Beyond's own SRD file (the SRD page `https://www.dndbeyond.com/srd` named in the pack's attribution answered 403 from the container). Each of the five lines of each background was compared with the PDF's text by a script outside the repository: 20 of 20 equal once the quotation marks and the "(see “Feats”)" cross-references are set aside.
- **One gap in the source:** the PDF prints the Sage's feat as "Magic Initiate (Wizard)" and the Acolyte's as "Magic Initiate (Cleric)". The source's `feat` has `note: "Cleric"` for the Acolyte and no note for the Sage. The importer takes the Sage's note from the PDF (a one-entry table, `FEAT_NOTE_2024`, with the page).
- **Languages:** "Your character knows at least three languages: Common plus two languages you roll or choose from the Standard Languages table" (SRD 5.2.1, page 20). The table: Common, Common Sign Language, Draconic, Dwarvish, Elvish, Giant, Gnomish, Goblin, Halfling, Orc. `Languages` in the source (19) has no standard or rare field, so the list is the importer's. SRD 5.1's Acolyte: "Two of your choice" (the source's `language_options`).
- **Ability scores:** "Increase one by 2 and another one by 1, or increase all three by 1" (SRD 5.2.1 page 83): the same patterns the hand-written Soldier has.
- **Proficiency kinds in the source:** SRD 5.1 has Armor 17, Weapons 39, Artisan's Tools 19, Gaming Sets 2, Musical Instruments 10, Other 4, Vehicles 2, Saving Throws 6, Skills 18; SRD 5.2.1 has Armor 5, Weapons 8, Skills 18, Artisan's Tools 18, Tools 8, Saving Throws 6, Musical Instruments 10, Other 1. The map names them all.
- No `[ПРОВЕРИТЬ]` is involved.

#### 9. Not in this ticket

- A starting package or 50 gp as a choice, and SRD 5.1's 15 gp: no grant holds them (CONT-71).
- The spell list a feat names for a background (Magic Initiate (Cleric), (Wizard)): CONT-36, CONT-37.
- Any effect of a background: CONT-36. The feat's own mechanics: CONT-37.
- The suggested characteristics as data a sheet can roll on: not planned; they are in the words.

#### 10. Rake check

- **Everything is data:** a stat, a skill, a tool kind, a language are read from the source and named by key; no list of the six stats or the 18 skills is in the code. The one list the importer owns is the Standard Languages table, which the source lacks.
- **No ruleset checks scattered:** the two rulesets' backgrounds are different shapes in the source, so two functions of one file; no check of the ruleset reaches another file.
- **Ids are stable:** a background's id is the source's slug; the feature's is the slug of its name, as the hand-written pack has it. A test compares.
- **No rules text in a test:** the tests assert ids, keys, counts, shapes and labels.
- **Licensing:** the words of the four backgrounds are SRD 5.2.1 (CC-BY-4.0); no other source was read.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 527 files, no fixes; `pnpm typecheck` clean; `pnpm test` 156 files, 1888 passed, 0 failed, 34.5 s (22 new, from 1866), then speed 2 passed; coverage statements 99.02 % (4162/4203), lines 99.78 % (3648/3656). No `pnpm e2e`: `apps/web` is not touched.

**Results:** SRD 5.1 imports 1 background and 1 feature; SRD 5.2.1 imports 4 backgrounds. Both rulesets run the whole registry with 0 problems.

**Differences from the row's note:**
- The row says the 2024 text comes from the PDF. The PDF's text for a background is exactly the five lines the source's structured fields hold, so the importer builds the lines from the fields and the PDF checks them (§8): there is no PDF text in the repository, and the import needs no network. The Sage's "(Wizard)" is the one thing the source lacks.
- The row asks for the languages "there, or changes that field". They are there, as dnd5e has them: Common fixed and two of nine, so `languageSource` stays `background`. The Soldier in the 2024 hand-written pack has no language grant; the test requires the pack's grants to be equal to the import's, not the reverse.

**Source disagreed with the SRD, resolved from the SRD, not a stop:** the Sage's feat note (§8). The row names the PDF as the source of the words, so the PDF decides; I name it here.

**Own, complete map, in this file:** `proficienciesOf` maps every kind of `Proficiencies` to a category and keys (§4.1). `species.ts` has an incomplete private one. Moving both into the frame is CONT-68 (its note now names this copy).

**Found, not fixed:**
- No grant holds a starting package or gold: SRD 5.1's `starting_gold` (15 gp) and SRD 5.2.1's "Choose A or B: (A) items; or (B) 50 GP". The 2024 backgrounds give no item grant, since a fixed grant would give the package to a person who takes the gold; the words keep the line. CONT-08's classes have the same gap. New row CONT-71.
- The spell list a background's feat names has no field: the Acolyte's feat is Magic Initiate (Cleric) and the Sage's Magic Initiate (Wizard), and the `feat` grant names only the feat. It is in the words. Added to the notes of CONT-36 and CONT-37.

**Changelog:** nothing for the changelog; a person sees nothing yet.

---

### CONT-07 Spells are imported from both SRDs

**Hat:** The spells of both SRDs become `spell` entities
**Depends on:** CONT-05 (the fields for growth, healing and duration), CONT-14 (the school, damage type and area shape keys)
**Size:** M
**Screen:** No
**SPEC:** §3 (both SRDs), §5.1, §5.3 (`SpellDef`); ADR 004, ADR 014 items 6 and 7

---

#### 1. Where the code lives

**Main file:** `packages/content/src/import/spells.ts` — changes: from the empty importer to the real one.
- `packages/content/test/import-spells.test.ts` — new.

#### 2. What is missing now

Measured on `4c59ec9`: `spells` has no types, no files and makes nothing. The source at `e6edf9a` has 319 spells in SRD 5.1 and 339 in SRD 5.2.1 (339 spell headings in the SRD 5.2.1 PDF too).

#### 3. What it should look like when done

1. The importer makes `spell`: 319 and 339, 0 problems in both rulesets, one for each entry under its slug, with its name, its words (with the higher-level words after them) and its fields.
2. The fields the source holds are read: level, school key, casting time (`1 action` and `Action` both are `{ value: 1, unit: 'action' }`; SRD 5.2.1's trigger words are the `note`), range in feet (a mile is 5280), components (a material's words, its price when they name one amount, `mConsumed`), duration, `concentration`, `ritual`, `classes`, `attack`.
3. SRD 5.1's `dc` is the `save`, its `area_of_effect` is `range.area`, its damage tables give the `damage` at the spell's own level, its `heal_at_slot_level` the `healing`. SRD 5.2.1 has none of these fields, so its `save` is the first "<stat> saving throw" of the words, its healing is read from the words of the 11 spells that heal, and it has no `area` (§8).
4. A slot `scaling` is read from the words of the higher level (the field, or after "Using a Higher-Level Spell Slot" in SRD 5.2.1's entries) when they name one die or number for each slot level (`every` for "every two"), and the spell has a damage or a healing to grow. A growth of two dice, or of a damage the spell does not list, gives none. A cantrip's `scaling` is the die that joins at levels 5, 11 and 17.
5. `upgrades` (CONT-05): Eldritch Blast's beams (both rulesets), Shillelagh's die, Spare the Dying's range and True Strike's extra damage (SRD 5.2.1).
6. `healingEachTurn`: Heroism and Regenerate. `healing.kind`: `maxHp` for Aid and Heroes' Feast, `tempHp` for False Life.
7. The two hand-written spells (SRD 5.1's Bless and Cure Wounds) are imported with every field the pack holds, each equal.

#### 4. How to do it

1. Each field is read where it lives; a form the importer cannot read (a casting time, a range, a duration, a material that does not match its component list) throws, so no spell is imported under a wrong value.
2. A roll is the source's, with `MOD` as `@mod`, and "4d6 OR 5d6" as its first roll. The damage is the roll at the lowest level of its table.
3. SRD 5.2.1's save and healing come from the words by patterns anchored on the SRD's own phrasing; the healing reads only the 11 spells SRD 5.1 gives a healing roll (ten of its tables, and Heroes' Feast), since a healing that is one choice of a list (Conjure Celestial) or a side effect is not the spell's healing.
4. What the source has no field for and the words do not say in one pattern is left out, and named in §11.

#### 5. Stored data

Nothing stored changes.

#### 6. What a person will see

Not a screen.

#### 7. Tests

- `packages/content/test/import-spells.test.ts` — 39: for each ruleset, 0 problems, one spell for each entry under its slug and name with words, the school and classes exist, the damage types, shapes and `damageTypes` exist; the counts of levels, schools, casting units, range kinds, duration kinds, rituals, concentration, attacks, materials, V, S, class pairs, areas, saves by stat and damages against the source's own; a mile in feet; areas of SRD 5.1; the casting notes of SRD 5.2.1; the nine spells whose components are in the range's tail; durations; materials priced and consumed (and the two amounts that give no price); the saves; the damage; the two lists of slot scalings, the die of a growth, `every`, `damageTypes` and `pickOne`, the typo of Moonbeam, the garbled words of Shatter, the growth in the entry's words, the cases that give none, and SRD 5.1's growth against its own damage tables; the cantrips' growth and `upgrades`; the 11 healings of each ruleset by value and kind, `healingEachTurn`, and the healings left out; the hand-written pack.
- The registry test of CONT-04 runs `spells` with the others over the real source: 0 problems, so no id is made twice.
- Control numbers from: §8, measured by a script outside the repository from the source files, not from the importer's output.

#### 8. Checked against the source

5e-bits/5e-srd-api at `e6edf9a`, measured 2026-11-11, and SRD 5.2.1 (CC-BY-4.0) PDF page and text:
- **Counts:** SRD 5.1 319 spells (cantrips 24, then 49, 54, 42, 31, 37, 31, 20, 16, 15); SRD 5.2.1 339 (27, 57, 57, 42, 34, 38, 31, 20, 17, 16). The SRD 5.2.1 PDF has 339 spell headings, equal to the source.
- **SRD 5.1's fields:** `dc` on 92, `area_of_effect` on 88 (sphere 39, cube 26, cylinder 9, line 8, cone 6), `damage` on 66, `heal_at_slot_level` on 10, `attack_type` on 16, `higher_level` on 90. SRD 5.2.1's entries have none of `dc`, `area_of_effect` and `heal_at_slot_level`; `damage` is one object on 89, `higher_level` a string on 103.
- **Two damages of SRD 5.1 name no type** (`sleep`, `prismatic-spray`: a roll alone), so they are left out.
- **SRD 5.2.1 puts the components of 9 spells in the range** ("Touch Component: V, S", `contagion`, `divine-smite`, `find-steed`, `guidance`, `power-word-heal`, `power-word-kill`, `resistance`, `searing-smite`, `sorcerous-burst`) and gives them an empty `components`. The source disagrees with itself; its other field, the range's tail, is the list, and what is left is the range. In SRD 5.2.1 casting times, a reaction or bonus action has its trigger after a comma (9 spells), and Plant Growth "Action (Overgrowth) or 8 hours (Enrichment)".
- **Areas of SRD 5.2.1:** none in the source; the words name an area phrase in 72 spells, some of them an object ("a 5-foot Cube") and not the spell's area, and not all spells with an area say it. An area read from words would be wrong for some, so it is left out (§11).
- **Saves:** SRD 5.1 has 92 `dc` and 25 spells whose words name a save with none; 117 in all (dex 34, wis 35, con 29, cha 13, str 4, int 2). SRD 5.2.1's words give 134 (dex 38, wis 40, con 31, cha 12, str 10, int 3). The two editions differ for real (Black Tentacles is Strength now, Poison Spray an attack, Sleep a Wisdom save). Where `dc` and the first mention of the words differ, `dc` wins: Hold Monster only (the words say no stat).
- **Growth:** SRD 5.1's `higher_level` and SRD 5.2.1's `higher_level` or its tail of the words. Of the entries that name a die, the importer reads those with exactly one die and one "for each slot level". The source's own damage tables agree for every SRD 5.1 case that has one (a test checks it). Moonbeam's words say "1dl0" (a letter l) while its table goes 2d10, 3d10: the importer reads 1d10. Shatter's words say "for each level of higher spell slot 2" and its table gains 1d8: read as 1d8.
- **Healing:** SRD 5.1's tables: aid 5 (hit point maximum), cure-wounds 1d8 + MOD, false-life 1d4 + 4 (temporary), heal 70, healing-word 1d4 + MOD, mass-cure-wounds 3d8 + MOD, mass-heal 700, mass-healing-word 1d4 + MOD, prayer-of-healing 2d8 + MOD, regenerate 4d8 + 15; Heroes' Feast's "hit point maximum also increases by 2d10" is in its words in both. SRD 5.2.1's words: cure-wounds 2d8 plus the modifier, healing-word and mass-healing-word 2d4 plus it, mass-cure-wounds 5d8 plus it, prayer-of-healing 2d8 (no modifier), false-life 2d4 + 4, heal 70, mass-heal 700, regenerate 4d8 + 15, aid 5. Heroism "gains Temporary Hit Points equal to your spellcasting ability modifier at the start of each of its turns" (both); Regenerate "regains 1 Hit Point at the start of each of its turns" (both).
- **Cantrip upgrades (CONT-05 §8, read again from the source):** Eldritch Blast "two beams at 5th level, three beams at 11th level, and four beams at 17th level" (SRD 5.1), the same at levels 5, 11, 17 (SRD 5.2.1); Shillelagh d10, d12, 2d6; Spare the Dying 30, 60, 120 feet; True Strike Radiant 1d6, 2d6, 3d6. A test checks the numbers are in the words.
- **Arcane Vigor** (CONT-05 §3 item 6, `healing.hitDice`) is not in the source and not in the SRD 5.2.1 PDF (the word "Vigor" is there only in Fiendish Vigor): `hitDice` is used by no SRD spell.
- **Source typos in the words kept as they are** (the words are the SRD's, the importer does not edit them): stray commas in SRD 5.2.1's materials ("which the, spell consumes"), and the like.
- No `[ПРОВЕРИТЬ]` is involved.

#### 9. Not in this ticket

- SRD 5.2.1's areas, and the damages the source lists no field for: CONT-72.
- Reading `abilityFrom`, `healing`, `scaling.every`, `damageTypes`, `pickOne`, `upgrades` and `healingEachTurn` in the engine's cast panel: CONT-63 and CONT-65.
- Which spells give features, their effects and their mechanics: CONT-38.
- The class spell lists as `spellList` of a class, and each class's spells by level: CONT-08.

#### 10. Rake check

- **Everything is data:** the six stats come from `Ability-Scores`, the damage types from `Damage-Types`; no list of either is in the code. The two lists the importer owns are the spells whose words are read for healing (§4.3) and the cantrip upgrades, each by the spell's index.
- **No ruleset checks scattered:** the two SRDs go through one path where their fields allow; the places they differ (a table or the words, the label of a higher-level paragraph, the upgrades) are named in the file.
- **Stored units are feet:** a mile is converted at import (`FEET_IN_A_MILE`), as SPEC §7.5 says.
- **Formulas never run code:** the formulas are the source's rolls with `@mod`; none is built from text the importer does not match.
- **No rules text in a test:** the tests assert ids, keys, counts, shapes and numbers.
- **Missing is not broken:** a growth the importer cannot read is left out; it does not stop the import.

#### 11. What came out of it

**Gate, 2026-11-11:** `pnpm lint` 528 files, no fixes; `pnpm typecheck` clean; `pnpm test` 157 files, 1927 passed, 0 failed, 34.0 s (39 new, from 1888), then speed 2 passed; coverage statements 99.02 % (4162/4203), lines 99.78 % (3648/3656). No `pnpm e2e`: `apps/web` is not touched.

**Results:** SRD 5.1 imports 319 spells and SRD 5.2.1 339, 0 problems. Of them with a slot scaling: 38 and 45; with a cantrip scaling: 9 and 11; with a healing: 11 and 11; with a `save`: 117 and 134; with a damage: 64 and 89; with an area: 88 and 0; with a priced material: 47 and 55.

**Differences from the row's note:**
- "5e-database gives 2024 spells no table by slot": the growth is read from the words of the higher level, which both SRDs have, for both rulesets, so the editions go through one reader. SRD 5.1's own tables check it (a test).
- The row says healing and growth come "from the text or from dnd5e's data". The text is used; dnd5e's data is not read, since it is not in the pinned source (CONT-01) and an unpinned file would make the import differ from run to run.

**Source disagreed with itself, resolved from its other field, not a stop:** SRD 5.2.1's empty `components` of 9 spells (§8), Moonbeam's "1dl0" and Shatter's garbled words (§8).

**Found, not fixed:**
- SRD 5.2.1's spells have no `area` (0 of 339; the words name an area in 72), and about 19 spells of each SRD (by a pattern over the words) roll a damage in the words that no `damage` field lists (SRD 5.1's Sleep and Prismatic Spray have a roll and no type). A growth that joins such a damage is left out too: SRD 5.1's Arcane Hand, Color Spray, Glyph of Warding, Sleep, Spirit Guardians and Wall of Ice, and about as many of SRD 5.2.1's (Arcane Hand, Chromatic Orb, Conjure Elemental and Fey, Delayed Blast Fireball, Disintegrate, Dragon's Breath, Flame Blade, Glyph of Warding, Ice Knife, Spiritual Weapon, Wall of Ice, and others). New row CONT-72.
- A growth that is not dice (one more dart, a target, a longer duration, a bigger area) is not a field of the schema, 46 spells of SRD 5.1 and 47 of SRD 5.2.1: Magic Missile's darts, Bless's targets. Nothing to fix until the schema has a place for it; the words carry it.
- SRD 5.2.1's Flame Strike lists one damage (fire); its words give fire and radiant. The importer follows the source's list.
- A spell with more than one save takes the first (Prismatic Spray and Wall of Force have none that matters); a `save` of the first mention can be a rider's, not the spell's: the words carry the rest.
- CONT-05's Arcane Vigor is not an SRD spell (§8); `healing.hitDice` stays unused.
- The stray commas of SRD 5.2.1's material text (§8).

**Changelog:** nothing for the changelog; a person sees nothing yet.
