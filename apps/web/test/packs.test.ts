import { srd2014, srd2024 } from '@grimoire/content';
import { FIFTH_EDITION_SCHEMA_VERSION, FIFTH_EDITION_SYSTEM } from '@grimoire/system-5e';
import { describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenE } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks, installedPacks, startPacks } from '../src/content/packs';
import { PACK_OPENERS, packOpenerOf } from '../src/systems';

// Golden A names SRD 5.1's pack; golden E names SRD 5.2.1's and `hb-local`, SPEC Appendix Д's pack,
// which no device has until a person imports it. Counts are SHEET-08 §7's: 74 and 66 entries.

describe('SHEET-09 the built-in packs open at start', () => {
  it('opens both SRD packs as built-in, in their order, with nothing left unopened', () => {
    const { packs, unopened } = installBuiltInPacks();
    expect(packs.map(({ origin, pack }) => [origin, pack.id])).toEqual([
      ['builtIn', 'srd-2014'],
      ['builtIn', 'srd-2024'],
    ]);
    expect(unopened).toEqual([]);
  });

  it('leaves out a file it cannot open and opens the rest', () => {
    const { packs, unopened } = installBuiltInPacks([
      { ...srd2014, system: 'tales' },
      { ...srd2014, systemSchemaVersion: FIFTH_EDITION_SCHEMA_VERSION + 1 },
      { ...srd2014, entities: 'none' },
      srd2024,
    ]);
    expect(packs.map(({ pack }) => pack.id)).toEqual(['srd-2024']);
    expect(unopened.map((failed) => failed.code)).toEqual(['unknownSystem', 'newer', 'invalid']);
    expect(unopened[0]).toMatchObject({ system: 'tales' });
  });

  it('keeps what it opened at start for later readers', () => {
    expect(startPacks()).toBe(installedPacks());
    expect(installedPacks().packs).toHaveLength(2);
  });
});

describe("SHEET-09 a character's content index", () => {
  const { packs } = installBuiltInPacks();

  it("loads the pack golden A names and finds the golden's entries", () => {
    const content = contentOf(goldenA, packs);
    expect(content.loaded).toEqual(['srd-2014']);
    expect([content.refused, content.warnings, content.notInstalled]).toEqual([[], [], []]);
    expect(content.index.entities).toHaveLength(74);
    expect(content.index.get(goldenA.systemData.species.id).ok).toBe(true);
  });

  it('names a pack the character has that is not on the device, once', () => {
    const content = contentOf(goldenE, packs);
    expect(content.loaded).toEqual(['srd-2024']);
    expect(content.notInstalled).toEqual(['hb-local']);
    expect(content.index.entities).toHaveLength(66);
    expect(content.index.get('hb-local:feat/arcane-scholar')).toMatchObject({
      ok: false,
      code: 'missing',
    });
  });

  it("loads in the character's order and reads what start opened when given nothing", () => {
    startPacks();
    const content = contentOf({ system: FIFTH_EDITION_SYSTEM, packs: ['srd-2024', 'srd-2014'] });
    expect(content.loaded).toEqual(['srd-2024', 'srd-2014']);
    expect(content.index.entities).toHaveLength(66 + 74);
  });
});

describe('SHEET-09 pack openers the app carries', () => {
  it('carries one system, 5e, and finds nothing for any other name', () => {
    expect(Object.keys(PACK_OPENERS)).toEqual([FIFTH_EDITION_SYSTEM]);
    expect(packOpenerOf(FIFTH_EDITION_SYSTEM)).toBe(PACK_OPENERS[FIFTH_EDITION_SYSTEM]);
    for (const name of ['tales', 'toString', '__proto__', 5, undefined]) {
      expect(packOpenerOf(name), String(name)).toBeUndefined();
    }
  });
});
