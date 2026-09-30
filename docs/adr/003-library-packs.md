# ADR 003 — Library packs, and keeping the owner clear of content rights

**Status:** accepted · **Date:** 2026-09-28 · **Decided by:** The owner

## Context

The owner wrote a note, "GrimoireMancer — Library / Compendium Architecture" (2026-09-28). It asks for
three separate layers: the app, the rules content in packs, and content people make themselves.
Most of it is already in the SPEC:

| The note asks for | Already in the SPEC |
|---|---|
| Engine separate from the UI; rules as data | D2, D3 |
| Content in packs with license metadata; the default build holds only open content | D4, §3.3 |
| People type in content from their own books, in forms, not raw JSON | §3.1, §8.3 |
| Our own format; Foundry is an exporter, not the storage format | D10, §5, stages L1–L2 |
| Stable ids; pack version; pack dependencies | §5.1, §5.7 |
| Imports are checked; formulas never run code | §5.6, §8.3 |
| Offline first | D5 |
| Schema versions with migrations | §5.8 |

The owner added one requirement: people may type content word for word from books they own, and may
share their libraries in a community place around the app. The owner does not add that content,
and must not carry the rights risk for it.

## Decision

### Part A — packs

1. **The pack stays our own format**, checked by the Zod schemas. Every exporter (Foundry, later
   Fantasy Grounds) is a separate package that maps our entities to its format. The core entity
   holds no field of any other tool: `meta.foundry` (SPEC §5.2) moves out, into the Foundry
   exporter's mapping.
2. **A pack names its game system** (`system`, see ADR 004) and its **source details**:
   `homepage`, `repository`, `copyrightNotice`, next to `license` and `authors`. An entry's
   `source` gains `book`, `author` and `license`, next to `pack`, `page` and `links`.
3. **Dependencies are checked.** A missing dependency gives a warning and `Missing: <id>` places,
   never a crash. A loop of dependencies (A needs B, B needs A) refuses the pack, with a message
   that names the loop. A pack never replaces another pack's entry: ids carry the pack id, and a
   changed copy of an entry is a new entry with `variantOf` (SPEC §5.2).
4. **More than one pack of one's own** (phase 5). The SPEC has one shared homebrew pack,
   `hb-local`. Instead, a person makes as many packs as they like ("My spells", "My campaign"),
   and moves entries between them.
5. **A pack file is `.gmpack`.** How it is stored inside the file (plain JSON, or a ZIP with the
   JSON and pictures) is decided in the phase 5 ticket that builds export. Import also accepts
   plain JSON.
6. **An imported pack is untrusted data.**
   - It is checked against the schema before anything is stored.
   - Size limits: the whole file, and each part of it. The numbers are set in the phase 5 ticket.
   - In a ZIP, no path points outside the pack.
   - Text is Markdown, shown without raw HTML.
   - Formulas keep their length and depth limits (SPEC §5.6); no code ever runs.
   - A pack from a newer app (`schemaVersion` higher than the app knows) is refused with a clear
     message. An older one is migrated (SPEC §5.8).
7. **Where a pack came from is set by the app, never read from the file.** The app records it
   when the pack is installed:
   - **built-in** — shipped inside the app's build;
   - **local** — imported from a file, or made on this device;
   - **community** — downloaded from the community place, once it exists.

   A file that says "official" about itself changes nothing.

### Part B — The owner stays clear of content rights

1. **The app ships only openly licensed content.** Today that is SRD 5.1 and SRD 5.2.1
   (CC-BY-4.0). The open content of any other system joins only after its license has been read
   from the publisher's own legal text, in the ticket's §8, and the owner has approved it.
2. **Everything a person makes is personal by default.** A new pack is `redistributable: false`.
   It stays on the device. The app never uploads it by itself, and no build ever includes it.
3. **Export says what it means.** Exporting a personal pack is allowed; it is the person's own
   backup, or a file for their own devices. The export screen says, in plain words, that the pack
   is for personal use and that sharing text from books is up to the rights holder.
4. **The community place is a separate layer**, built later, with its own ADR. It needs accounts
   (SPEC stage L5). The app works fully without it. Before it opens it must have:
   - terms of use accepted before the first upload, in which the uploader confirms they hold the
     rights to the content or that the content is under an open license;
   - uploads refused for any pack marked personal;
   - author, license and source shown on every community pack;
   - a "report" button on every community pack, and a written takedown process: remove on a
     valid notice, tell the uploader, allow a counter-notice, block people who repeat;
   - Built-in, Community and Local shown apart everywhere;
   - community packs never moved into the built-in set.
5. **No tools that pull text from closed sources.** No scraper, and no importer for websites or
   for PDFs of commercial books. The assistant's "paste text from your book" (SPEC §13.1) makes
   personal packs only.
6. **Publishers' names are trademarks.** No publisher's name or logo is used in the app's name,
   icon or store listing. How each game system may be named on screen is checked against that
   publisher's trademark or compatibility policy before the name appears.
7. **This is not legal advice.** These rules lower the risk; they do not remove it. Before the
   community place opens, and before any store release, a lawyer in the owner's country checks the
   terms of use, the takedown process and the system names. Hosting rules differ by country; the
   US DMCA "safe harbor" and the EU Digital Services Act, for example, both depend on a working
   notice-and-takedown process. This check is the gate of the phase that builds the community
   place.

## What this changes in the SPEC

| SPEC | Was | Now |
|---|---|---|
| §5.2 `meta.foundry` | A Foundry field on every entity | Moves into the Foundry exporter's mapping |
| §5.2 `source` | `pack`, `page`, `links` | Adds `book`, `author`, `license` |
| §5.7 `ContentPack` | `license`, `authors`, `dependsOn` | Adds `system`, `homepage`, `repository`, `copyrightNotice`; the dependency checks of item A3 |
| §8.3 storage | One shared pack `hb-local` | Any number of personal packs |
| §8.3 export | JSON through Web Share | `.gmpack`, with the import checks of item A6 |
| §3 | SRD 5.1 and 5.2.1 only | The same, plus each system's open content once checked (item B1) |
| — | Nothing on sharing | Part B |

## What does not change

- D1–D11, except as ADR 004 widens D3 and D4 to more game systems.
- The golden tests (SPEC §6.7) and their values.
- The formula language (SPEC §5.6).
- Phase 0: SETUP-08 and SETUP-09.

## Consequences

- ADR 003's schema items are built from the start in the phase 1 schema tickets, so no migration
  is ever needed for them. See the phase 1 note in `docs/tickets/BACKLOG.md`.
- Phase 5 grows: several personal packs, `.gmpack` files and the import checks.
- Two later phases, opened only when the owner opens them: the Fantasy Grounds exporter, and the
  community place (with Part B item 4 as its gate).
