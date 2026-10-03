import { compute, regainResource } from '@grimoire/engine';
import { describe, expect, it } from 'vitest';
import {
  type CastAsk,
  castSpell,
  type FifthEditionCharacter,
  type FifthEditionEntity,
  fifthEditionModule,
  longRest,
  shortRest,
  spellUsesGrants,
} from '../src/index.ts';
import {
  type CharacterInput,
  CONCENTRATION,
  copyOf,
  done,
  frozen,
  indexOf,
  ownSpell,
  refused,
  resource,
  slot,
  stamp,
  withTrackers,
} from './action-checks.ts';
import { goldenA, goldenC2014 } from './golden/index.ts';

// ENG-57: a spell a grant gives with its own uses is cast through them. Golden A (2014): cleric 1,
// proficiency bonus 2, two level 1 slots. Golden C (2014): wizard 3 and paladin 3, level 6,
// proficiency bonus 3. The feat and its spells (`character:`) are made up; their uses take the
// shapes of the SRD traits in ENG-57 §8 (once, back on a long rest; the proficiency bonus times).
// Every value was worked out by hand in ENG-57 §3.

type EntityInput = FifthEditionCharacter['localEntities'][number];
type Grants = NonNullable<Extract<EntityInput, { type: 'feat' }>['grants']>;

const SPARK = ownSpell('spark', 1, false);
const GLIMMER = ownSpell('glimmer', 1, true);
const BLESS = 'srd-2014:spell/bless';
const FEAT = 'character:feat/gifted';
const SPARK_GRANT = `${FEAT}#spark`;
const GLIMMER_GRANT = `${FEAT}#glimmer`;
const longAll = [{ on: 'long' as const, amount: 'all' as const }];

const sparkGrant = {
  id: 'spark',
  kind: 'spell',
  fixed: [SPARK.id],
  key: 'giftedSpark',
  uses: { max: '1', recovery: longAll },
} satisfies Grants[number];
const glimmerGrant = {
  id: 'glimmer',
  kind: 'spell',
  atLevel: 3,
  fixed: [GLIMMER.id],
  key: 'giftedGlimmer',
  uses: { max: '@prof', recovery: longAll },
} satisfies Grants[number];
const plainGrant = { id: 'plain', kind: 'spell', fixed: [SPARK.id] } satisfies Grants[number];

/** The made-up feat with `grants`. */
function gifted(grants: Grants = [sparkGrant, glimmerGrant, plainGrant]) {
  return {
    id: FEAT,
    type: 'feat',
    ruleset: 'any',
    name: { en: 'Gifted' },
    source: { pack: 'character' },
    grants,
  } satisfies EntityInput;
}

/** A golden character with the feat, given by hand, its spells, and its trackers set. */
function withGifted(
  golden: CharacterInput,
  trackers: Parameters<typeof withTrackers>[1] = {},
  feat: EntityInput = gifted(),
  more: Partial<CharacterInput> = {},
): FifthEditionCharacter {
  return withTrackers(golden, trackers, {
    ...more,
    localEntities: [SPARK, GLIMMER, feat],
    systemData: { ...golden.systemData, feats: [...golden.systemData.feats, { id: FEAT }] },
  });
}

/** A cast on `character`, from its edition's pack. */
const cast = (character: FifthEditionCharacter, ask: CastAsk) =>
  castSpell(character, indexOf(character), ask, stamp);

/** `character` computed on its edition's pack. */
const computed = (character: FifthEditionCharacter) =>
  compute(character, indexOf(character), fifthEditionModule);

describe("ENG-57 a spell cast through its grant's uses", () => {
  it('gives a resource beside each spell grant with uses, of the same id and level', () => {
    const feat = gifted() as FifthEditionEntity;
    const grants = feat.grants ?? [];
    expect(spellUsesGrants(feat, grants)).toEqual([
      sparkGrant,
      {
        id: 'spark',
        kind: 'resource',
        key: 'giftedSpark',
        label: { en: 'Gifted' },
        uses: sparkGrant.uses,
      },
      glimmerGrant,
      {
        id: 'glimmer',
        kind: 'resource',
        key: 'giftedGlimmer',
        label: { en: 'Gifted' },
        uses: glimmerGrant.uses,
        atLevel: 3,
      },
      plainGrant,
    ]);
    const none = [plainGrant] as typeof grants;
    expect(spellUsesGrants(feat, none)).toBe(none);
  });

  it("computes the uses' maximum as a resource's, with its breakdown", () => {
    const a = computed(withGifted(goldenA));
    expect(a.resources).toEqual([
      { key: 'giftedSpark', label: { en: 'Gifted' }, uses: sparkGrant.uses, from: SPARK_GRANT },
    ]);
    expect(a.values['resources.giftedSpark.max']).toBe(1);
    expect(a.breakdown['resources.giftedSpark.max']).toEqual([
      {
        kind: 'grant',
        part: SPARK_GRANT,
        source: FEAT,
        label: { en: 'Gifted' },
        formula: '1',
        value: 1,
        change: 1,
      },
    ]);
    // The `glimmer` grant reaches a character from level 3; A is level 1.
    expect(Object.hasOwn(a.values, 'resources.giftedGlimmer.max')).toBe(false);

    const c = computed(withGifted(goldenC2014));
    expect(c.values.prof).toBe(3);
    expect(c.values['resources.giftedGlimmer.max']).toBe(3);
    expect(c.breakdown['resources.giftedGlimmer.max']).toMatchObject([
      { kind: 'grant', part: GLIMMER_GRANT, formula: '@prof', value: 3, change: 3 },
    ]);

    const overrides = [{ path: 'resources.giftedSpark.max', value: 2 }];
    const twice = computed(withGifted(goldenA, {}, gifted(), { overrides }));
    expect(twice.values['resources.giftedSpark.max']).toBe(2);
  });

  it('spends one use for a cast through the grant, and none for a cast with a slot', () => {
    const a = withGifted(goldenA);
    const first = done(a, cast(a, { spell: SPARK.id, grant: SPARK_GRANT }));
    expect(first.entry).toMatchObject({
      action: 'castSpell',
      subject: SPARK.id,
      label: { en: 'spark' },
    });
    expect(first.entry.changes).toEqual([{ path: resource('giftedSpark'), after: 1 }]);
    expect(refused(cast(first.character, { spell: SPARK.id, grant: SPARK_GRANT }))).toEqual({
      code: 'noUseLeft',
      grant: SPARK_GRANT,
      key: 'giftedSpark',
      max: 1,
      spent: 1,
    });
    const slotted = done(
      first.character,
      cast(first.character, { spell: SPARK.id, slot: { level: 1 } }),
    );
    expect(slotted.entry.changes).toEqual([{ path: slot(1), after: 1 }]);

    // The override is read: two uses.
    const overrides = [{ path: 'resources.giftedSpark.max', value: 2 }];
    const two = withGifted(goldenA, { resources: { giftedSpark: 1 } }, gifted(), { overrides });
    const second = done(two, cast(two, { spell: SPARK.id, grant: SPARK_GRANT }));
    expect(second.entry.changes).toEqual([{ path: resource('giftedSpark'), before: 1, after: 2 }]);
    expect(refused(cast(second.character, { spell: SPARK.id, grant: SPARK_GRANT }))).toEqual({
      code: 'noUseLeft',
      grant: SPARK_GRANT,
      key: 'giftedSpark',
      max: 2,
      spent: 2,
    });
  });

  it('holds a concentration spell cast through the uses', () => {
    const c = withGifted(goldenC2014);
    const glimmer = done(c, cast(c, { spell: GLIMMER.id, grant: GLIMMER_GRANT }));
    expect(glimmer.entry.changes).toEqual([
      { path: resource('giftedGlimmer'), after: 1 },
      { path: CONCENTRATION, after: GLIMMER.id },
    ]);
    const spent = withGifted(goldenC2014, { resources: { giftedGlimmer: 3 } });
    expect(refused(cast(spent, { spell: GLIMMER.id, grant: GLIMMER_GRANT }))).toEqual({
      code: 'noUseLeft',
      grant: GLIMMER_GRANT,
      key: 'giftedGlimmer',
      max: 3,
      spent: 3,
    });
  });

  it('casts a spell the grant chooses only once it is chosen', () => {
    const pick = {
      id: 'pick',
      kind: 'spell',
      choose: { count: 1, from: [SPARK.id, GLIMMER.id] },
      key: 'giftedPick',
      uses: { max: '1', recovery: longAll },
    } satisfies Grants[number];
    const part = `${FEAT}#pick`;
    const choices = { ...goldenA.choices, [part]: [SPARK.id] };
    const chosen = withGifted(goldenA, {}, gifted([pick]), { choices });
    const spark = done(chosen, cast(chosen, { spell: SPARK.id, grant: part }));
    expect(spark.entry.changes).toEqual([{ path: resource('giftedPick'), after: 1 }]);
    expect(refused(cast(chosen, { spell: GLIMMER.id, grant: part }))).toEqual({
      code: 'notGiven',
      grant: part,
      id: GLIMMER.id,
    });
    const unchosen = withGifted(goldenA, {}, gifted([pick]));
    expect(refused(cast(unchosen, { spell: SPARK.id, grant: part }))).toEqual({
      code: 'notGiven',
      grant: part,
      id: SPARK.id,
    });
  });

  it('refuses a slot with a grant, a grant with no uses that reaches, a spell not given', () => {
    const a = withGifted(goldenA);
    expect(refused(cast(a, { spell: SPARK.id, slot: { level: 1 }, grant: SPARK_GRANT }))).toEqual({
      code: 'slotAndGrant',
      slot: { level: 1 },
      grant: SPARK_GRANT,
    });
    for (const grant of [`${FEAT}#nope`, `${FEAT}#plain`, GLIMMER_GRANT, 'nothing']) {
      expect(refused(cast(a, { spell: GLIMMER.id, grant })), grant).toEqual({
        code: 'noSpellUses',
        grant,
      });
    }
    expect(refused(cast(a, { spell: BLESS, grant: SPARK_GRANT }))).toEqual({
      code: 'notGiven',
      grant: SPARK_GRANT,
      id: BLESS,
    });
    expect(refused(cast(a, { spell: 'character:spell/nothing', grant: SPARK_GRANT }))).toEqual({
      code: 'missing',
      id: 'character:spell/nothing',
    });
  });

  it("gives the uses back by the core's resource actions and by a rest", () => {
    const a = withGifted(goldenA, { resources: { giftedSpark: 1 } });
    const regained = regainResource(a, computed(a), { key: 'giftedSpark', amount: 'all' }, stamp);
    expect(done(a, regained).entry.changes).toEqual([
      { path: resource('giftedSpark'), before: 1, after: 0 },
    ]);

    // Back on a long rest only.
    expect(refused(shortRest(a, indexOf(a), {}, stamp))).toEqual({ code: 'unchanged' });
    const rested = done(a, longRest(a, indexOf(a), stamp));
    expect(rested.entry.changes).toEqual([{ path: resource('giftedSpark'), before: 1, after: 0 }]);

    // One back on a short rest, and so on a long one (`REST_EVENTS`).
    const short = {
      ...sparkGrant,
      uses: { max: '2', recovery: [{ on: 'short', amount: '1' }] },
    } satisfies Grants[number];
    const b = withGifted(goldenA, { resources: { giftedSpark: 2 } }, gifted([short]));
    for (const result of [shortRest(b, indexOf(b), {}, stamp), longRest(b, indexOf(b), stamp)]) {
      expect(done(b, result).entry.changes).toEqual([
        { path: resource('giftedSpark'), before: 2, after: 1 },
      ]);
    }
  });

  it('changes nothing it is given', () => {
    const a = frozen(withGifted(goldenA));
    const ask = frozen({ spell: SPARK.id, grant: SPARK_GRANT });
    const ice = frozen(stamp);
    const result = castSpell(a, indexOf(a), ask, ice);
    expect(result.ok).toBe(true);
    expect(a).toEqual(copyOf(withGifted(goldenA)));
    expect(ask).toEqual({ spell: SPARK.id, grant: SPARK_GRANT });
    expect(ice).toEqual(stamp);
  });
});
