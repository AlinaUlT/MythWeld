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

Quality gate, 2026-10-28: `pnpm lint` 203 files, no fixes; `pnpm typecheck` 6 projects, no
errors; `pnpm test` 64 files, 891 passed, 0 failed (879 before, +12), then the speed project 1
file, 2 passed. Coverage: statements 99.53 % (3227/3242), lines 99.92 % (2833/2835). Not
`apps/web`, so no `pnpm e2e`.

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
