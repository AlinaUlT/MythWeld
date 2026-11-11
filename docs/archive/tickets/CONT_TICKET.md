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
