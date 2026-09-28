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
