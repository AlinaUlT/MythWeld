# OPS — Around the code

**Why this theme:** Some work changes no feature: CI, deploy, tooling and the project's documents.
It still needs an id, so that every commit starts with one and `git log --grep` finds it.
**SPEC:** none by default; each ticket names what it touches.
**Order and status:** [`BACKLOG.md`](BACKLOG.md) — never repeated here.
**Theme is closed when:** never. `OPS` stays open (see [`README.md`](README.md)).
**Read before starting:** `CLAUDE.md`, `docs/tickets/README.md`.

---

### OPS-01 The library-packs and game-systems decisions · XS

**Hat:** ADR 003 and ADR 004 record the library packs and the game systems
**Where:** `docs/adr/003-library-packs.md`, `docs/adr/004-game-systems.md` — new; `CLAUDE.md`,
`docs/tickets/BACKLOG.md`, `docs/tickets/README.md` — changed
**Depends on:** Nothing

**What it should look like when done:**
1. ADR 003 says what Alina's note "GrimoireMancer — Library / Compendium Architecture"
   (2026-09-28) changes in the SPEC (packs), and how the owner stays clear of content rights.
2. ADR 004 says how the app grows past fifth edition: a game-free core, and one module per system.
3. `CLAUDE.md`: the opening line and the hard invariants on data, rulesets and licensing follow
   the two ADRs.
4. `BACKLOG.md`: phase 1 is marked for a re-cut before ENG-01; phase 5 grows; the `SYS` phase and
   the later Fantasy Grounds and community phases are listed; `README.md` has the `SYS` area.
5. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts before and after (lint files, test count).

**What came out of it:** Alina accepted both decisions on 2026-09-28, and asked that sharing
personal libraries never puts the rights risk on her as the owner (ADR 003, Part B). Checked
before writing: `packages/schema/src/index.ts` and `packages/engine/src/index.ts` export nothing
yet, so ADR 003's schema items and ADR 004's split cost no migration. The ADRs say plainly that
they are not legal advice; a lawyer's check is the gate of the future community-place phase. Not
done here, on purpose: the phase 1 re-cut (shown to Alina first) and any license check of another
system's content (each system's own ticket). Found, not fixed: nothing. Nothing for the
changelog; a person sees no change.

### OPS-02 The product decisions of 2026-09-29 · XS

**Hat:** ADR 005 records the product decisions of 2026-09-29
**Where:** `docs/adr/005-modes-free-version-table-link.md` — new; `CLAUDE.md`,
`docs/tickets/BACKLOG.md` — changed
**Depends on:** OPS-01

**What it should look like when done:**
1. ADR 005 records Alina's seven answers of 2026-09-29: 3 free characters; 1 free campaign with
   the table link; no limit on homebrew or packs; AI with the person's own key, free and off by
   default; the ITS colour values reused in our own code; campaign sync by the table link
   (peer-to-peer); partial mixing of the two editions, with golden F.
2. It also records what the discussion settled around them: the two modes, the free and paid
   table, no D&D Beyond link, dice skins, roll tables and generators, the DM tools, images, PDF
   extras, the fonts. It lists what it changes in the SPEC, what does not change, what is still
   open, and its sources.
3. `CLAUDE.md`: the external-requests invariant names the features a person turns on.
4. `BACKLOG.md`: the phase 1 re-cut note carries ADR 005's three phase 1 items; the later-phase
   paragraph names what ADR 005 reshapes and adds; OPS-03 is listed.
5. No code changes. The quality gate stays green.

**Tests:** none new; the quality gate is run to show nothing else changed. Control numbers: the
gate's counts.

**What came out of it:** The gate is green: lint checked 52 files; typecheck passed in every
package; 6 test files, 18 tests passed, 0 failed, 577 ms. Measured for the ADR, not remembered:
the ITS colours from its `theme.css` (main branch), its license (GPL-2.0) from its `LICENSE`, and
each font's license (`OFL`) and Cyrillic support from Google Fonts' metadata and CSS API. Some
sources were blocked from the work environment (dndbeyond.com, dmheroes.com, the app stores,
supabase.com, cloudflare.com, shieldmaiden.app); the ADR marks those facts as coming from search
results, and names no server price. Differs from the chat: the fonts ship inside the app, because
SPEC §11 forbids loading them from a font server (found in SETUP-04's rake check). Found, not
fixed: nothing. Nothing for the changelog; a person sees no change.
