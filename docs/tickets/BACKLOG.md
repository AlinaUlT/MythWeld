# Backlog

**The one place a ticket is ticked off.** Order, size and status for every ticket live here and
nowhere else. The expanded tickets live in `docs/tickets/<AREA>_TICKET.md`. How a ticket runs is in
[`README.md`](README.md).

| Column | Meaning |
|---|---|
| **ID** | `<AREA>-<NN>`, never reused. Areas are in [`README.md`](README.md). |
| **Hat** | One phrase, no "and". |
| **Size** | XS up to 1 h · S 1–3 h · M half a day. |
| **Status** | 🔲 not started · 🚧 in work · ✅ with the date · ❌ cancelled with a reason |

**Rows are written when a phase opens, not earlier.** A cut is a first guess: re-cut it when the
work shows it is wrong, and say so in the ticket's §11.

**Notes under a table are for open rows only.** When a row closes, its note is deleted; the
ticket in `docs/archive/tickets/` holds it.

**A phase closes** when all its rows are closed **and** that stage's "Готово, когда" list in
SPEC §12 has been shown true in the chat. The list is not copied here; SPEC §12 owns it.

---

## Phase 0 — The scaffold (SPEC stage 0)

Gate: SPEC §12 stage 0, with the English-only screenshot from ADR 000.

**Closed 2026-09-28.** The gate's proof is in SETUP-09 §11, in
[`docs/archive/tickets/SETUP_TICKET.md`](../archive/tickets/SETUP_TICKET.md).

| ID | Hat | Size | Status |
|---|---|---|---|
| SETUP-01 | An empty pnpm monorepo with the six packages builds and lints | S | ✅ 2026-09-27 |
| SETUP-02 | Vitest and Playwright (Pixel 7) each run one passing test | S | ✅ 2026-09-27 |
| SETUP-03 | CI runs lint, typecheck, test and build on every push to `main` | XS | ✅ 2026-09-27 |
| SETUP-04 | The app shell shows the bottom bar with four empty tabs | S | ✅ 2026-09-27 |
| SETUP-05 | Every visible string goes through an i18next key, enforced by lint | S | ✅ 2026-09-27 |
| SETUP-06 | Dexie opens its database and asks for persistent storage | XS | ✅ 2026-09-28 |
| SETUP-07 | The app installs to the home screen and opens offline | S | ✅ 2026-09-28 |
| SETUP-08 | Every push to `main` deploys to a public link | S | ✅ 2026-09-28 |
| SETUP-09 | `docs/RUNNING.md` and `docs/adr/001-platform.md` exist | XS | ✅ 2026-09-28 |

---

## Phase 1 — Schemas and the engine (SPEC stage 1)

Gate: SPEC §12 stage 1, widened by ADR 004 and ADR 005 — golden tests A, B, B4, C, D, E, F pass;
the made-up test system passes through the core; CI fails if the core imports a system module;
coverage of `engine` and of the fifth-edition module ≥ 90 %; the benchmark is within 10 ms; a
formula cycle stops with a readable message. No UI, no SRD import.

**Re-cut on 2026-09-30 by OPS-05** (ADR 003, ADR 004, ADR 005), approved by the owner before it was
written. The game-free core comes first, and its compute rows are tested on the made-up test
system. The fifth-edition module follows, as its own package. The table is in work order, which
since the re-cut is not number order. An old row kept its id where its meaning stayed; a part
split off an old row got a new id.

| ID | Hat | Size | Status |
|---|---|---|---|
| **Core** | **schemas** | | |
| ENG-01 | CI fails if `engine` imports React, DOM, Dexie or the network | XS | ✅ 2026-09-30 |
| ENG-02 | The entity base has a core Zod schema, ids included | S | ✅ 2026-09-30 |
| ENG-03 | The core entity types have Zod schemas | S | ✅ 2026-09-30 |
| ENG-04 | Effects, grants, prerequisites have game-free Zod schemas | S | ✅ 2026-09-30 |
| ENG-24 | A system module adds its entity types to the schemas | S | ✅ 2026-10-01 |
| ENG-05 | The content pack has a schema, exported as JSON Schema | S | ✅ 2026-10-01 |
| ENG-06 | The core character document has a schema, with the migration frame | S | ✅ 2026-10-01 |
| ENG-39 | A pack records the schema version of its system's module | S | ✅ 2026-10-01 |
| ENG-25 | Packs are checked as they load into the content index | S | ✅ 2026-10-01 |
| **Core** | **formulas, dice** | | |
| ENG-07 | Formulas evaluate safely, returning the paths they read | M | ✅ 2026-10-01 |
| ENG-08 | Dice notation is rolled, in `d` or `к` | S | ✅ 2026-10-01 |
| ENG-26 | A roll result has the shape the table link will send | XS | ✅ 2026-10-01 |
| **Core** | **compute, tested on the made-up system** | | |
| ENG-27 | The made-up test system exists as core test data | S | ✅ 2026-10-01 |
| ENG-11 | `compute()` gathers every entity a character has, grants included | M | ✅ 2026-10-01 |
| ENG-12 | Stat scores are computed in the base phase | S | ✅ 2026-10-01 |
| ENG-28 | `compute()` runs the derived-value steps a system module supplies | S | ✅ 2026-10-01 |
| ENG-29 | Resource maximums are computed from their formulas | XS | ✅ 2026-10-01 |
| ENG-17 | Derived-phase effects, toggles, overrides apply with a breakdown | M | ✅ 2026-10-01 |
| ENG-18 | A formula cycle stops with a message naming the paths | S | ✅ 2026-10-01 |
| ENG-30 | Tracker actions return a log entry that undoes them | S | ✅ 2026-10-01 |
| ENG-40 | A content key never reads a field every object has | XS | ✅ 2026-10-01 |
| **Fifth edition** | **its own package** | | |
| ENG-31 | The fifth-edition module is a package the core cannot import | XS | ✅ 2026-10-01 |
| ENG-41 | Lint holds the fifth-edition module to the engine's purity rules | XS | ✅ 2026-10-01 |
| ENG-42 | A test holds the module's tsconfig to the language alone | XS | ✅ 2026-10-01 |
| ENG-32 | The fifth-edition entity types have Zod schemas | M | ✅ 2026-10-01 |
| ENG-33 | The fifth-edition part of the character document has a schema | S | ✅ 2026-10-01 |
| ENG-38 | The fifth-edition pack's JSON Schema is published as a file | S | ✅ 2026-10-02 |
| ENG-09 | 2014 fixtures: every SRD entity golden A or C needs | M | ✅ 2026-10-02 |
| ENG-10 | 2024 fixtures: every SRD entity golden B, B4, C or D needs | M | ✅ 2026-10-02 |
| ENG-13 | Check bonuses are computed: modifiers, proficiency, saves, skills, passives | M | ✅ 2026-10-02 |
| ENG-43 | An effect sets the stat a skill uses | S | ✅ 2026-10-02 |
| ENG-14 | Combat numbers are computed: hit points, armor class, initiative, speed | M | ✅ 2026-10-02 |
| ENG-44 | Equipped items count only as the rules allow | S | ✅ 2026-10-02 |
| ENG-45 | Heavy armor's Strength requirement slows its wearer | S | ✅ 2026-10-02 |
| ENG-47 | The person picks which base AC calculation counts | S | ✅ 2026-10-02 |
| ENG-48 | The character's size comes from its species | S | ✅ 2026-10-02 |
| ENG-15 | Spellcasting numbers are computed, multiclass slots included | M | ✅ 2026-10-02 |
| ENG-16 | Weapon attacks are computed, weapon mastery included | M | ✅ 2026-10-02 |
| ENG-49 | A spell or item a grant names that no pack has gives a warning | S | ✅ 2026-10-02 |
| ENG-52 | A roll formula's average is computed, kept dice included | S | ✅ 2026-10-02 |
| ENG-50 | A spell's dice are computed for the character's level | S | ✅ 2026-10-02 |
| ENG-51 | A spell a grant gives with its own stat has its casting numbers | S | ✅ 2026-10-02 |
| ENG-53 | A spell's healing is a roll formula of its own | S | ✅ 2026-10-03 |
| ENG-55 | A spell's damage adds `damage.spell.bonus` | S | ✅ 2026-10-03 |
| ENG-60 | A spell's healing adds what a feature gives it | S | ✅ 2026-10-03 |
| ENG-34 | Advantage, disadvantage, critical hits apply to fifth-edition rolls | M | ✅ 2026-10-03 |
| ENG-19 | The ruleset files hold every 2014/2024 rules difference | M | ✅ 2026-10-02 |
| ENG-46 | Armor worn without training has its edition's penalties | S | ✅ 2026-10-03 |
| ENG-35 | The ability-bonus source is a choice, the rules base by default | S | ✅ 2026-10-03 |
| ENG-56 | A mixed character's starting languages come from one place | S | ✅ 2026-10-03 |
| ENG-54 | The house rule's highest score caps every stat | S | ✅ 2026-10-03 |
| ENG-20 | Damage, healing, slots, concentration change by fifth-edition rules | M | ✅ 2026-10-03 |
| ENG-57 | A spell a grant gives is cast through its own uses | S | ✅ 2026-10-03 |
| ENG-58 | A death save roll changes the character by fifth-edition rules | S | ✅ 2026-10-03 |
| ENG-62 | Dropping to 0 hit points gives the Unconscious condition | S | ✅ 2026-10-03 |
| ENG-65 | Knocking a creature out leaves it unconscious at 1 hit point | S | 🔲 |
| ENG-63 | Death ends attunement to magic items | XS | ✅ 2026-10-03 |
| ENG-59 | Inspiration is gained or spent up to its maximum | XS | ✅ 2026-10-03 |
| ENG-21 | A rest changes the character by its edition's rules | S | ✅ 2026-10-03 |
| ENG-61 | A long rest lowers a condition's level as its entry says | S | ✅ 2026-10-03 |
| ENG-66 | Coming back to life lowers a condition's level as its entry says | S | 🔲 |
| ENG-67 | Exhaustion at level 6 makes the character dead | S | 🔲 |
| ENG-64 | A long rest gives the inspiration a trait names | S | ✅ 2026-10-03 |
| ENG-36 | Level-up changes the character through an undoable action | S | ✅ 2026-10-02 |
| ENG-22 | Golden E: the homebrew pack from Appendix Д changes character B | S | ✅ 2026-10-02 |
| ENG-37 | Golden F: a character mixing both editions passes | M | 🔲 |
| ENG-23 | The phase 1 gate is shown true: coverage, speed, every golden | S | 🔲 |

- **ENG-66** — re-cut from ENG-61 (ENG-61 §4), found by ENG-58: SRD 5.2.1 (Rules Glossary,
  Dead) "If the creature died with any Exhaustion levels, it returns with 1 fewer level"; `revive`
  (`hit-points.ts`) lowers none. No sentence of SRD 5.1's rules, spells or conditions ties
  exhaustion to a return to life (ENG-58 §11). ENG-61's condition `recovery` (`{ on, amount }`,
  lowered by the core's `conditionsRecoveredOn`) can say it with an event, but fifth edition's
  recovery events (`short`, `long`, `dawn`, `turn`, `manual`) have none for coming back to life;
  adding one changes the module's shape (a version and its migrations). The 2024 exhaustion of
  `test/golden/srd-2024.ts` then names it; ENG-19's 2014 one does not.
- **ENG-67** — found by ENG-61 (ENG-61 §8): exhaustion 6 is death in both SRDs (SRD 5.1 "6 -
  Death"; SRD 5.2.1 "You die if your Exhaustion level is 6"; dnd5e's exhaustion `conditions: { 6:
  ["dead"] }`). `isDead` (`death-saves.ts`) reads only the death saves, so a long rest at
  exhaustion 6 is not refused, and since ENG-61 it lowers the level to 5. The row decides where
  the death is said (the condition's entry, as ENG-61's `recovery`; or the module, by the key
  `exhaustion`, as ENG-62's `unconscious`) and makes `isDead` read it, so the actions refuse as
  for 3 failed death saves. ENG-66 then brings such a character back at level 5.
- **ENG-65** — re-cut from ENG-62 (ENG-62 §4). SRD 5.2.1 only: "When you would reduce a creature
  to 0 Hit Points with a melee attack, you can instead reduce the creature to 1 Hit Point and give
  it the Unconscious condition. It then starts a Short Rest, at the end of which that condition
  ends on it. The condition ends early if the creature regains any Hit Points or if someone takes
  an action to administer first aid to it" (chapter 1). Its Rules Glossary entry says it "remains
  Unconscious until it regains any Hit Points or until someone uses an action to administer first
  aid to it", with no end at the short rest: the row says which end it follows, and why.
  `compute()` gives the condition only at 0 hit points (`unconscious.ts`), so at 1 it is stored, and
  it must end on these events only: a stored Unconscious condition from a spell's sleep ends on
  damage, not healing. A mark of its own is a stored-shape change (a version and its migrations).
  SRD 5.1's knocking out is damage to 0 and `stabilize` (ENG-62 §8): nothing to add.
- **ENG-37** — ADR 005 item 3.6; the fixture states its ability bonus source (ADR 014 item 1).
  Found by ENG-35: a source of `both`, with increases from both sides, warns `characterRule`
  `abilityBonusesFromBoth`, so a golden storing it expects that warning. Found by ENG-56: the
  fixture states its languages' place too (`languageSource`); a mix whose species and background
  give no starting languages warns `characterRule` `noStartingLanguages`.
  The ticket stops to show the character and its hand-computed values to the owner (golden
  values are hers); the test is written only after her yes. No golden F value is written before
  that.
- **ENG-23** — the phase's last ticket. Its §11 carries the proof of the stage 1 gate.

---

## Phases 2–7 — cut when the phase before closes

| Phase | SPEC stage | Area | What it delivers |
|---|---|---|---|
| 2 | 2 | `SHEET` | Character list, manual creation, the sheet with every tab, trackers, rolls, rests, undo, JSON export; screens built on design tokens (ADR 005) |
| 3 | 3 | `CONT` | SRD 2014 and 2024 import, mechanics for levels 1–5, the library, search, attribution |
| 4 | 4 | `WIZ` | The creation wizard, the level-up wizard, house rules |
| 5 | 5 | `HB` | The homebrew editor, the effect builder, before/after preview, several personal packs, `.gmpack` import and export with the import checks (ADR 003) |
| 6 | 6 | `PDF` | Own template (6a), filling an uploaded sheet (6b) |
| 7 | 7 | `POL` | Accessibility, performance, onboarding, optional Android |
| RU | — | `RU` | Russian locale, glossary check, Russian overlays for SRD texts (ADR 000); placed when phase 3 closes |
| SYS | — | `SYS` | More game systems: other D&D editions, Pathfinder, later others (ADR 004); placed when phase 2 closes |

- **Phase 2** — found by ENG-46: `spell.cannotCast` is 1 while armor worn without training
  forbids spells (ENG-46 §4), with an `untrainedArmor` or `untrainedShield` warning; `castSpell`
  (ENG-20) does not read it. The sheet's cast button reads it, or the action refuses then.
- **Phase 2** — found by ENG-57: a granted spell's own uses are the resource of its `spell` grant's
  `key` (`resources.<key>.max`, spent in `state.resources`); `castSpell` takes the grant's part as
  `grant`. The sheet shows them on the spell's row ("1/LR, no spell slot", ADR 010 item 10). The
  resource's label is its entity's name, so two spell grants of one entity (a trait's spells at
  levels 3 and 5) give two resources with one label: the sheet pairs each with its spell through
  the grant's `key`.
- **Phase 3** — found by ENG-57: the SRD traits that cast a spell with no slot (SRD 5.1 Infernal
  Legacy; SRD 5.2.1 Elven Lineage, Fiendish Legacy, Gnomish Lineage, Magic Initiate; ENG-57 §8)
  are one `spell` grant per spell, each with its `atLevel`, its `uses` and a `key`.
- **Phase 3** — found by ENG-02: 11 of 4,428 5e-database slugs do not fit the entity id's slug
  pattern; the import maps them. ENG-02 §11 lists them.
- **Phase 3** — found by ENG-31: a core file may climb into a sibling package other than a
  module (`../../content/src/index.ts` passes lint, measured). The row that first makes
  `content`, `pdf` or `foundry` import the module also refuses that climb in `packages/schema/src`
  and `packages/engine/src`, or the core reaches the module through it with no error. Found by
  ENG-41: a module file climbs the same way (`../../content/src/index.ts`,
  `../../system-tales/src/index.ts` pass lint in `packages/system-5e/src`, measured); that row
  refuses it in `packages/system-*/src` too.
- **Phase 3** — found by ENG-32: SRD values the fifth-edition schemas cannot hold yet, measured
  at 5e-database `e6edf9a` (ENG-32 §8, §11): 2014's `mounts-and-vehicles` equipment (40 entries)
  has no `ItemDef.category`; 2024's "Until dispelled or triggered" (2 spells) has no place for
  "or triggered"; 2024's `elven-lineage`, `gnomish-lineage` and `magic-initiate` let the person
  choose the spellcasting stat among three, and a `spell` grant's `ability` takes one stat. The
  import widens the schema for each (no migration) or maps the value. The stat a grant casts
  with is read in one place, `grantCastingStat` (ENG-51), which then reads the choice.
- **Phase 3** — found by ENG-33: an entity two grants give is gathered once, with one choice
  per grant (ENG-11). That is right for a trait two sources give, and wrong for a feat taken
  twice: of 2024's feats, `ability-score-improvement`, `magic-initiate` and `skilled` say "You
  can take this feat more than once" (ENG-33 §8), and Magic Initiate can come twice at level 1
  (the Acolyte's, and a human's Versatile origin feat). 2024 gives its Ability Score Improvement feature at several levels under
  one id, so each level's choice needs its own class grant. The import, or a core row before it,
  gives a feat taken twice its own choices.
- **Phase 3** — found by ENG-10: 5e-database at `e6edf9a` gives the 2024 human one size,
  `Medium`, where the SRD's text, as dnd5e quotes it, is Medium or Small, chosen (ENG-10 §8). Its
  `prerequisites.feature_named` (the four fighting style feats: "Fighting Style"; Boon of Spell
  Recall: "Spellcasting") has no prerequisite kind: `entity` names one entity. The import decides
  each. No 2024 species or background gives a language; dnd5e puts Common and two standard
  languages on each background, and ENG-56 reads a 2024 background's `language` grants as 2024's
  starting languages (`languageSource` in `rulesets/2024.ts`), so the import puts them there, or
  changes that field. ENG-56 reads a side's own grants: 5e-database's high elf Extra Language is a
  trait (`extra-language`'s `language_options`). The import puts its grant on the high elf
  lineage; left on the trait, it is never left out, and adds to a 2024 background's three.
- **Phase 3** — found by ENG-29: two `resource` grants of one key give one resource, with the
  highest of their maximums. Mechanics that give one key from two classes (a multiclass) check
  in their §8 what the SRD says for that case; uses that add up are an effect `add` on
  `resources.<key>.max`.
- **Phase 3** — found by ENG-12: a stat's maximum caps its score after every base-phase effect
  (SPEC §6.1 step 4), so an item whose mechanics put a score above the maximum must raise
  `abilities.<key>.max` too (SPEC §5.4's belt, `max 21`). The mechanics' §8 checks which items
  do this.
- **Phase 3** — found by ENG-46: SPEC §5.4's targets `prof.armor`, `prof.weapon`, `prof.tool`,
  `prof.language` are computed by no path, so an effect on one changes nothing; proficiencies
  come only from grants (`gathered.proficiencies`, read by ENG-13, ENG-16, ENG-46). The mechanics
  that give a proficiency by an effect, if the SRDs have any, decide: a computed list, or grants.
- **Phase 3** — found by ENG-16, three things the weapons of the import and its mechanics meet:
  - Shillelagh (SRD 5.1, SRD 5.2.1) lets a club or a quarterstaff attack and deal damage with the
    spellcasting stat instead of Strength, and makes its die a d8; in 2024 the die grows at levels
    5, 11 and 17 (d10, d12, 2d6). ENG-16's attack stat is the weapon's kind's, or the higher with
    finesse, and its dice are the item's; a key path for the stat (ENG-43's road) would hold the
    stat. ENG-50's `scaling` adds dice and never changes a die's faces, so the growing die needs
    its own field.
  - A magic weapon has no kind of its own: dnd5e keeps `type.baseItem`, which its proficiency and
    mastery read. ENG-16 reads a weapon proficiency by key and a `mastery` kind by the item's own
    `key`, so a "Longsword, +1" with a key of its own loses both.
  - A `mastery` choice's filter (`type`, `tag`, `category`) cannot say the barbarian's "Melee
    weapons" nor the paladin's, ranger's and rogue's "with which you have proficiency" (ENG-16
    §8). The import widens the filter, tags the weapons, or lists them.
- **Phase 3** — found by ENG-50: growth a spell's `scaling` cannot hold (one formula, added to
  the first damage once per step; ENG-50 §8). SRD 5.1: Flame Blade and Spiritual Weapon grow every
  two slot levels; Flame Strike's die goes to the fire or the radiant damage, the caster's choice.
  SRD 5.2.1: Eldritch Blast gains beams, Shillelagh's die changes, Spare the Dying's range grows,
  True Strike gains extra damage it has none of at first. 5e-database `e6edf9a` gives the 2024
  spells no table by slot (one entry each), so the import reads 2024's growth from the text or
  dnd5e's data. The import widens the field (no migration) or maps each.
- **Phase 3** — found by ENG-53: healing a spell's `healing` (`{ formula, kind }`, `hp` or
  `tempHp`) cannot hold (ENG-53 §8): Aid (both SRDs) and 2014 Heroes' Feast raise the hit point
  maximum; 2024 Arcane Vigor heals by the hit die spent (dnd5e: one activity per die size);
  Regenerate's hit point each turn and Heroism's temporary hit points each turn. 5e-database's 2024
  spells have no `heal_at_slot_level`, so 2024's healing is read from dnd5e's data or the text. The
  import maps or widens each. A pack writes the spellcasting modifier as `@mod` (5e-database:
  `MOD`).
- **Phase 3** — found by ENG-51: SRD items that cast a spell "using your spell save DC" (2014
  Staff of Fire, Staff of Healing, Staff of Power, among others) do not say which DC when a
  character has more than one: a class's (`classes.<key>.spell.dc`) and a stat's a grant names
  (`abilities.<stat>.spell.dc`). The mechanics of those items pick one, or let the person pick.
- **Phase 3** — found by ENG-55: every spell's first damage adds `damage.spell.bonus`
  (`spellDice`, `spell-dice.ts`), so an effect on it cannot be limited to some spells. Each SRD
  bonus to a spell's damage is limited (ENG-55 §8): to a damage type (Elemental Affinity), a school
  (Empowered Evocation), one cantrip (Agonizing Blast: 2014 Eldritch Blast, 2024 a chosen one), a
  class's cantrips (2024 Potent Spellcasting); and "one damage roll of that spell" is one ray of a
  spell that rolls several (Scorching Ray). The mechanics of those features add a narrower target,
  or a condition an effect's `when` can test.
- **Phase 3** — found by ENG-60: Disciple of Life's mechanics are two effects in each SRD (ENG-60
  §3): SRD 5.1's `healing.spell.bonus` 2 and `healing.spell.bonusPerLevel` 1, SRD 5.2.1's the same
  on `healing.slot.*`. The Life domain's other healing features have no target: Blessed Healer
  (both SRDs, level 6) heals the caster 2 + the level when a spell heals another creature, and
  Supreme Healing (both, level 17) uses each healing die's highest number. The mechanics that
  reach those levels add what they need.
- **Phase 3** — found by ENG-13: a half proficiency that rounds up (2014's Remarkable Athlete:
  "half your proficiency bonus (round up)") and half a proficiency on every ability check (2014's
  Jack of All Trades). `skills.<key>.prof` 0.5 rounds down (`checkSteps`), and an ability check
  (`checks.<key>.total`) has no proficiency level. The mechanics of those features add what they
  need.
- **Phase 5** — found by ENG-39: a locale overlay keys its texts by field name, but carries only
  the core's `schemaVersion`. When a module renames a text field, a stored overlay keeps the old
  name and its text is no longer shown. The row that stores imported overlays gives them the
  module's version, or ties each to its pack's.
- **Phase 5** — found by ENG-38: a pack refuses unknown fields, so a pack file cannot name the
  published schema in a `$schema` field (`schema/5e/pack.schema.json`); an editor finds the schema
  only through its own setting. The row that writes the import checks decides: the pack takes an
  optional `$schema` (an optional field needs no migration), or the import removes it.
- **Phase 5** — found by ENG-12: a stat distribution's pattern is picked by its count of items,
  so of two patterns with one length (`[[2, 1], [1, 1]]`) the second is never used. The import
  checks or the editor warn.
- **Phase 5** — found by ENG-07: a pack's formulas are only text to the schema, which cannot
  import the engine, so a formula past ENG-07's limits, or one that does not parse, loads and
  warns only when it is evaluated. The import checks (ADR 003 item A6) parse each formula with
  `parseFormula`. Found by ENG-08: a roll formula with `parseRoll`, since `parseFormula` refuses
  dice.
- **Phase 5** — found by ENG-18: `compute()` warns of a formula loop only when its reads happen,
  so a loop on a branch a formula does not take today (`@level > 3 ? @a : 0`) gives no warning
  until it is taken. The effect builder's live preview (SPEC §8.3) shows the warning for the chosen
  character; the import checks can look for one in ENG-07's `paths`.
- **Phase 5** — found by ENG-18: `missingPath` names the path whose computing read the missing
  one, not the effect or grant whose formula did, so a typo in an effect's formula points at its
  target's own step. `valueAt` in `derived.ts` knows that part (`by`); the warning can carry it
  before the effect builder shows it.
- **Phase 5** — found by ENG-34: an `advantage` or `disadvantage` on a `roll.*` target that no
  d20 test reads (a typo such as `roll.skil.athletics`, or `roll.save.san` on a character without
  `san`) warns nowhere, as an `append` on a list no step reads (ENG-14). The targets each test
  reads are `ROLL_TARGETS` (`rolls.ts`); the effect builder and the import checks compare a target
  with them.
- **Phases 2, 3** — found by ENG-32: some fifth-edition keys have no entity type to give their
  name on screen: a spell's `school`, a species' `size` and `creatureType`, an item's `rarity`,
  a spell area's `shape`, a feat's `category`, a rule's `topic` and `icon`. The first screen
  that shows one gives them names: a simple entity type each, or the module's i18n keys. Found by
  ENG-48: the key path `size` takes only the species' own sizes, so an effect or an override
  naming another warns and is not applied (SRD 5.2.1's goliath, Large Form: "you can change your
  size to Large"). A size type would give every size as its keys.
- **Phases 2, 4** — found by ENG-04: no row checks a prerequisite against a character (SPEC §5.5,
  §8.2: a warning, never a block). The row is cut with the first phase that lets a person pick an
  entity with prerequisites. Found by ENG-11: Tales' `unmetPrerequisites` (ENG-27) are its test
  data; `Computed.entities` gives the entities to check.
- **Phase 2** — found by ENG-40: an override's path or an effect's target may be one step such
  as `toString` (`computedPathSchema`). `compute()` handles it (`overrideNoPath`), but
  `Computed.values` and `Computed.breakdown` are plain objects, so `values['toString']` gives a
  function, not `undefined`. The first screen that reads `Computed` by a stored path reads only
  own fields, or the path schema refuses ENG-40's `RESERVED_KEYS` as a step.
- **Phase 2** — found by ENG-08: the engine has no random source of its own (lint refuses
  `Math.random` in it). The dice panel passes `fairDie(randomSourceOf((a) =>
  crypto.getRandomValues(a)))` to `rollFormula`; "I roll myself" (SPEC §6.5) passes the faces
  the person typed as the die.
- **Phase 2** — found by ENG-26: the roll log (SPEC §6.5) keeps `RollRecord`s, built with
  `recordRoll`. `rollRecordSchema` refuses an unknown field and carries no version of its own, so
  the table that keeps the log gives each record one; the table link does the same for what it
  sends.
- **Phase 2** — found by ENG-17: a stored switch (`state.toggles`) stays after its entity is
  removed and warns `toggleGone` on every compute, so removing an entity drops its switches. An
  override applies only when its value is a number on a number path (`overrideNotANumber`
  otherwise), so the override editor stores a number there. The breakdown's kind `override` is
  shown as "Manual edit" (SPEC §6.1 step 7).
- **Phase 2** — found by ENG-48: the size shown is `Computed.keys.size`, with steps naming the
  species or lineage, each effect and a manual edit. A size not chosen is in
  `Computed.pendingKeys` (`{ path, options }`), beside the grants' `pendingChoices`; the answer is
  written to `systemData.species.size`, not to `choices`. A stored size the species does not offer
  warns `stepRule` `sizeNotOffered`.
- **Phase 2** — found by ENG-47: the pinned base AC calculation is `systemData.acCalc`:
  `equipment` (the armor worn, else 10 + DEX) or an `ac.formulas` effect's part id; without it the
  highest counts. The control that pins one needs each candidate's key, name and value, and
  `Computed` gives only the chosen one's breakdown (`acCalcChosen` first when pinned); the row
  that builds it gives `Computed` the candidates. A pin that does not apply warns `stepRule`
  `acCalcNotApplying` on every compute, so removing its entity clears it, as a switch is cleared.
- **Phase 2** — found by ENG-43: a skill's stat is `Computed.keys['skills.<key>.ability']`, with
  steps naming the skill, each effect and a manual edit; the sheet shows that key, never the
  skill's own `ability`. An override of it applies only when its value is one of its keys (a
  stat's key, `overrideNotAKey` otherwise), so the override editor stores a stat's key there.
- **Phase 2** — found by ENG-19: where the editions use different words, the sheet reads
  `rulesOf(character).terms` (race or species, subrace or lineage, inspiration or heroic
  inspiration), each an i18n key's last part. The inspiration stars hold the house rule's
  `inspirationMax` and show the edition's `inspiration.max` (1 in both SRDs) next to it (ADR 009
  item 5); spending one does `inspiration.use` (advantage in 2014, a reroll of one die in 2024).
  A new character is written with `DEFAULT_HOUSE_RULES` and its edition's `abilityBonusSource`
  and `languageSource` (ENG-56).
  Exhaustion 6 is death in both editions and gives no number; the sheet says so.
- **Phase 2** — found by ENG-20: `applyDamage` takes the damage the person types, resistance,
  immunity and vulnerability already applied; no code computes `defenses.*` (SPEC §5.4). The row
  that shows the defenses computes them, and the Damage pad (ADR 010 item 6) applies them in the
  engine. SRD 5.2.1's Bloodied (half the hit points or fewer, "no game effect on its own but which
  might trigger other game effects") has no path. Damage returns the concentration save's DC
  (`outcome.concentrationDc`); the screen rolls it and calls `endConcentration` on a failure.
- **Phase 2** — found by ENG-21: a rest is one action and one entry, `shortRest` or `longRest`
  (`rests.ts`), pure, so the Rest frames (BRIEF P6) call it to show what comes back and keep its
  result on "Confirm"; the short rest takes every die spent, `{ die, roll }`, the face from the
  dice panel or the person's own throw, and its `outcome.hitDice` gives each die's hit points.
  The hit dice are `hitDice.d<N>.max` (with a breakdown) less `systemData.state.hitDiceSpent`.
  The uses' label ("1 back on a short rest, all on a long rest") reads
  `Computed.resources[].uses.recovery`; an amount that is a formula has no computed value with a
  breakdown, so the row that shows one computes it. The recovery events `dawn`, `turn` and
  `manual` are triggered by no action (a magic item's charges at dawn). Found by ENG-61: a long
  rest lowers exhaustion in both editions, but SRD 5.1's only "provided that the creature has also
  ingested some food and drink"; the 2014 Rest frame says so, and a person whose character did not
  eat sets the level back with `setCondition` (ENG-61 §4). Found by ENG-64: a long rest gains
  `inspiration.longRest` (SRD 5.2.1's Resourceful) up to `houseRules.inspirationMax`, and its
  `outcome.inspirationLost` is what was above it, which the Rest frame names; SRD 5.2.1's Champion,
  Heroic Warrior (fighter 10), gives Heroic Inspiration at the start of a turn, which no action
  triggers either.
- **Phase 2** — found by ENG-58: the death save tracker calls `rollDeathSave` (`death-saves.ts`)
  with the kept d20 face and the total the dice panel gives (`d20Formula(deathSave.mode)`, with
  the person's bonuses); its outcome's `status` (`dying`, `stable`, `dead`, `up`) says what to
  show, and `isStable`, `isDead` give the state at any time. First aid's Medicine check, Spare the
  Dying and 2014's knocking out call `stabilize`; a revival spell calls `revive` with `1` or
  `max`. A stable character's 1 hit point after 1d4 hours is the person's `applyHealing` of 1:
  nothing keeps the time.
- **Phase 2** — found by ENG-63: the inventory sets a row's `attuned` by hand; death clears every
  one (`deathChanges`, `actions.ts`). Nothing counts the attuned rows: both SRDs allow "no more
  than three magic items at a time" (ENG-63's ticket quotes both). A warning, never a block
  (§8.2), computed by the module, not the screen.
- **Phase 2** — found by ENG-34: each d20 test's roll mode is a number path, 1 advantage, −1
  disadvantage, 0 neither, with a step per source: `checks.<stat>.mode`,
  `abilities.<stat>.saveMode`, `skills.<key>.mode`, `init.mode`, `attacks.<key>.mode`,
  `spell.attackMode`, `deathSave.mode` (`rolls.ts`, `attacks.ts`). Every step's `value` is its
  source's sign, so the roll dialog adds its own sources to those values with `rollModeOf` (2014
  inspiration's advantage, a situational effect switched on, matched to the test by `ROLL_TARGETS`),
  rolls `d20Formula(mode)`, reads the kept d20 face with `attackOutcome(face, range)` (a weapon's
  `crit.range`, a spell's 20) and, on a critical hit, rolls `criticalDamage` of the damage dice. An
  override of a mode is a manual edit of it. ENG-20's concentration save is the Constitution save:
  its mode is `abilities.con.saveMode`.
- **Phase 2** — found by ENG-25: a character's active pack that is not installed on the device
  never reaches `loadContentIndex`; the sheet says which pack is missing, not only `Missing: <id>`
  on each of its entries.
- **Phase 2** — found by ENG-49: a spell or item a grant names (a `spell` or `item` grant's
  `fixed` ids, and its chosen ones) is looked up, not gathered, so one of the other edition gets
  no `otherRuleset` warning, which a gathered entity gets. The Spells tab and the starting
  inventory, which list them, show each one's edition (ADR 005 item 3.5) or warn there.
- **Phase 2** — found by OPS-08: ADR 008 replaces the SETUP-04 bottom bar with a start page, a
  player page and My characters. The phase 2 rows build that navigation instead of the bar.
- **Phases 2–5** — added by OPS-22: each screen is built from its mockup in
  `docs/design/mockups/` and its row in BRIEF Part 5; a design change made during a phase is
  made in the mockup and the canvas too.
- **ADR 009, by phase** — added by OPS-09. Phase 2: the dice panel on the sheet, features by
  source, the About tab, the spellcasting line, Inspiration, portrait and token, custom items,
  companions and sections. Phase 3: several rulebooks at once, the source on every entry.
  Phase 5: custom stats, the person's packs next to the books, custom entries with effects. The
  dice phase (with ADR 005 item 11): the honest animated roll, custom roll modifiers. The table
  link's phase: the campaign copy, the DM's changes, approval of important changes.
- **Phase 4** — found by ENG-33: SPEC §8.4's point-buy budget is the point-buy method's (ADR 010
  item 12), not a house rule: `houseRulesSchema` has no field for it. A method is a key in
  `systemData.abilities.method`, with its rolls as ENG-26 roll records.
- **Phase 4** — found by ENG-13: a feat's `replaces` (ENG-33) leaves out the grant it names
  (`ruledGrants` in `module.ts`); one naming a grant the character does not reach is unused with
  no warning. The level-up wizard writes `replaces` only for a grant it shows, or the module
  gains a warning: since ENG-35 a module has warnings about the whole character
  (`SystemModule.ruleWarnings`, warned `characterRule`).
- **Phase 4** — found by ENG-35 (ENG-35 §8): SRD 5.1 says "If a character would gain the same
  proficiency from two different sources, he or she can choose a different proficiency of the
  same kind (skill or tool) instead"; SRD 5.2.1 has no such text. An edition difference the
  creation wizard offers; its value joins `rulesets/` (ENG-19).
- **Phase 4** — found by ENG-58: `levelUp` (`level-up.ts`) at 0 hit points raises them and keeps
  the death saves: golden A at 0 with 1 success and 2 failures, a 2014 cleric level at `avg`,
  gives 9 hit points and death saves `{ success: 1, failure: 2 }` (measured, ENG-58 §11). Hit
  points regained from 0 reset them in both SRDs. The level-up wizard offers no level-up at 0 hit
  points, or `levelUp` writes `deathSavesReset` (`actions.ts`) as healing does.
- **Phase 4** — found by ENG-56: where the starting languages come from is the person's pick
  when the species' side and the background both give some (ADR 005 item 3.4; no `both`, ADR
  014 item 1): `systemData.languageSource`, its rules base's by default. The creation wizard
  offers it then; `leftOutLanguageSide` (`languages.ts`) says when, as ENG-35's `leftOutSide`
  does for the ability bonus conflict window.
- **Phase 4** — found by ENG-19: a subclass chosen below its class's `subclassLevel` (2014: 1, 2
  or 3 by class; 2024: 3) gives no warning, and its spellcasting counts. The level-up wizard
  offers the subclass at that level, or the module gains a warning.
- **Phase 4** — found by ENG-45: SRD 5.1's variant encumbrance says "When you use this variant,
  ignore the Strength column of the Armor table" (`5e-SRD-Rules.json`). That is the house rule
  `encumbrance: 'variant'`, which no code reads; ENG-45's `speed.armorReduction` (`combat.ts`)
  reads no house rule. The row that makes the encumbrance house rule work gives it 0 under the
  variant.
- **ADR 010, by phase** — added by OPS-10. Phase 2: custom dice and any count of dice, the
  Damage and Heal number pad, the Turn tab, the spell slot grid, casting without a slot. Phase
  3: the one-page library with topics and full entries, the All sources list. Phase 4: steps
  that open and close, ability score methods, level-up by XP or milestone. Phase 5: adding
  packs from "Books in use". DM tools: encounter templates. The table link's phase: the DM's
  level-up control, changes reviewed together.
- **ADR 012** — added by OPS-14. Phase 3: the library's list page and its floating entry window.
- **ADR 013, by phase** — added by OPS-15 to OPS-19. Phase 2: temporary hit points in their
  own colour, the class line as the level with Level up in "⋯", the Player and DM squares, the
  home page's sections. Phase 3: classes and subclasses per ruleset, one entry per ruleset, the spell's description
  layout, Sources with the SRDs built in, Quick rules with every SRD rule and linked terms,
  Bookmarks. Phase 4: the turning arrow on creation steps, the roll calculator, optional feats, the ability
  bonus conflict window. The dice phase: the roll that looks like a real throw. The table link's
  phase: level-up approval in a campaign, the DM's edit before approving, the approvals tab, the
  DM's setting for the conflict window. The DM tools' phase: actors with types. A second system:
  the system preview.
- **ADR 015** — added by OPS-26. Phase 2 opens with the skin layer, before the first screen:
  the full token set, the slots, the part styles, the motion settings, the lint check; the
  portrait takes animated pictures and video. The theme editor's phase: the skin schema, import,
  export. The dice phase: dice skins and their effects. The purchases phase: frames, backgrounds,
  seasons.
- **ADR 014** — added by OPS-20. Phase 3: the import brings in both SRDs' rules chapters as
  `rule` entries with topics, for Quick rules; bookmarks are a table on the device.
- **ADR 011, by phase** — added by OPS-12. Phase 2: descriptions open and close, from fixtures
  and free text. Phase 3: the SRD texts. Phase 5: the person's packs.

Phases L1–L6 (Foundry, game master tools, assistant, accounts, shared room) are in SPEC §12 and
get rows only when the owner opens them. ADR 003 adds two more of that kind: the Fantasy Grounds
exporter, and the community place for sharing packs (its gate is a lawyer's check). ADR 005
reshapes three of them: L3 gains roll tables, generators and a fuller tool list; L4 is the
person's own AI key, free; L5's campaign sync becomes the table link. It adds three more: payments
(one payment, no subscription; its gate is a lawyer's check), dice skins, and the theme editor.

---

## Order

**Phase 0 → phase 1 → phase 2 → phase 3 → phase 4 → phase 5 → phase 6 → phase 7.** Inside a
phase, rows go in the order of its table unless a row's "Depends on" allows otherwise.

Three things can change this order, and all are the owner's decision (SPEC §14):
- if she plays in Foundry now, L1 can move ahead of phase 6;
- the Russian phase is placed when phase 3 closes;
- the more-systems phase is placed when phase 2 closes (ADR 004).

---

## OPS — around the code (never closes)

| ID | Hat | Size | Status |
|---|---|---|---|
| OPS-01 | ADR 003 and ADR 004 record the library packs and the game systems | XS | ✅ 2026-09-28 |
| OPS-02 | ADR 005 records the product decisions of 2026-09-29 | XS | ✅ 2026-09-30 |
| OPS-03 | The design brief for the screens exists | S | ✅ 2026-09-30 |
| OPS-04 | ADR 006 removes the stops that protect nothing | XS | ✅ 2026-09-30 |
| OPS-05 | Phase 1 is re-cut to follow ADRs 003–005 | XS | ✅ 2026-09-30 |
| OPS-06 | ADR 007 limits stops to the owner's decisions | XS | ✅ 2026-09-30 |
| OPS-07 | The design brief records the owner's choices of 2026-09-30 | XS | ✅ 2026-09-30 |
| OPS-08 | ADR 008 records the navigation the owner chose | XS | ✅ 2026-09-30 |
| OPS-09 | ADR 009 records the owner's sheet, dice, rulebook and campaign requirements | XS | ✅ 2026-09-30 |
| OPS-10 | ADR 010 records the owner's library, dice, creation, level and spell requirements | XS | ✅ 2026-09-30 |
| OPS-11 | `CLAUDE.md` says every detail the owner gives is recorded in the same chat | XS | ✅ 2026-09-30 |
| OPS-12 | ADR 011 records full descriptions on the sheet | XS | ✅ 2026-09-30 |
| OPS-13 | No personal name for the owner appears in the repository | XS | ✅ 2026-09-30 |
| OPS-14 | ADR 012 records the library's look on the phone | XS | ✅ 2026-09-30 |
| OPS-15 | ADR 013 records the owner's requests of 2026-10-01 | XS | ✅ 2026-10-01 |
| OPS-16 | ADR 013 records the spell description's layout | XS | ✅ 2026-10-01 |
| OPS-17 | ADR 013 records what Quick rules holds | XS | ✅ 2026-10-01 |
| OPS-18 | ADR 013 records Level up in the sheet's "⋯" menu | XS | ✅ 2026-10-01 |
| OPS-19 | ADR 013 takes the owner's three corrections to the mockups | XS | ✅ 2026-10-01 |
| OPS-20 | ADR 014 records what the design decisions change in the engine | S | ✅ 2026-10-01 |
| OPS-21 | The design brief records the current design, kept open | XS | ✅ 2026-10-01 |
| OPS-22 | The current mockups are kept in the repository | S | ✅ 2026-10-01 |
| OPS-23 | The design reference lists its tokens and its undrawn parts | XS | ✅ 2026-10-01 |
| OPS-24 | The whole design canvas is kept in the repository | XS | ✅ 2026-10-01 |
| OPS-25 | Every ticket that builds a screen names its mockup boards | XS | ✅ 2026-10-01 |
| OPS-26 | ADR 015 makes every look a skin's data | XS | ✅ 2026-10-01 |
| OPS-27 | Closed tickets leave the files a new chat reads | XS | ✅ 2026-10-01 |
