import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { libraryPath, libraryTopics, paths, sheetPath } from '../src/shell/routes';

const localeFiles = readdirSync(new URL('../src/locales/en/', import.meta.url))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

describe('SHEET-11 navigation', () => {
  it('gives every phase 2 and phase 3 screen its own path', () => {
    expect(paths).toEqual({
      start: '/',
      player: '/player',
      settings: '/settings',
      characters: '/characters',
      newCharacter: '/characters/new',
      sheet: '/characters/:id',
      dice: '/dice',
      library: '/library',
      libraryTopic: '/library/:topic',
      quickRules: '/quick-rules',
      bookmarks: '/bookmarks',
      sources: '/sources',
      about: '/about',
    });
    expect(new Set(Object.values(paths)).size).toBe(Object.keys(paths).length);
  });

  it('builds a sheet path that keeps any id in one segment', () => {
    expect(sheetPath('golden-b')).toBe('/characters/golden-b');
    expect(sheetPath('a/b c')).toBe('/characters/a%2Fb%20c');
  });

  it('lists the library topics in the picker order, each one opening the library at it', () => {
    expect(libraryTopics).toEqual([
      'spells',
      'classes',
      'species',
      'backgrounds',
      'feats',
      'armor',
      'weapons',
      'items',
      'magic-items',
      'conditions',
      'monsters',
    ]);
    expect(libraryPath('magic-items')).toBe('/library/magic-items');
    // Every topic fits the route's one segment, so a path built here matches `:topic`.
    for (const topic of libraryTopics) expect(libraryPath(topic)).toMatch(/^\/library\/[a-z-]+$/);
  });

  it('loads every English locale file as a namespace', () => {
    expect(Object.keys(en).sort()).toEqual(localeFiles);
    expect([...(i18n.options.ns as string[])].sort()).toEqual(localeFiles);
    expect(localeFiles).toEqual([
      'about',
      'aboutApp',
      'actions',
      'add',
      'attacks',
      'bookmarkButton',
      'bookmarks',
      'breakdown',
      'cast',
      'characters',
      'checks',
      'choices',
      'coins',
      'common',
      'concentration',
      'conditions',
      'create',
      'deathSaves',
      'description',
      'dice',
      'features',
      'gear',
      'inspiration',
      'libArmor',
      'libBackgrounds',
      'libClass',
      'libClasses',
      'libConditions',
      'libEntry',
      'libFeats',
      'libItems',
      'libMagicItems',
      'libMonsters',
      'libSpecies',
      'libSpellCasters',
      'libSpells',
      'libWeapons',
      'library',
      'notes',
      'numberPad',
      'player',
      'quickRules',
      'rest',
      'roll',
      'rulesRule',
      'rulesTopic',
      'sections',
      'settings',
      'sheet',
      'sources',
      'spells',
      'start',
      'toast',
      'token',
      'turn',
    ]);
  });

  it('titles every page from its own namespace', () => {
    const titles = Object.fromEntries(
      (
        [
          'player',
          'settings',
          'characters',
          'create',
          'sheet',
          'dice',
          'library',
          'quickRules',
          'bookmarks',
          'sources',
          'aboutApp',
        ] as const
      ).map((ns) => [ns, i18n.t('title', { ns })]),
    );
    expect(titles).toEqual({
      player: 'Player',
      settings: 'Settings',
      characters: 'My characters',
      create: 'New character',
      sheet: 'Character',
      dice: 'Dice',
      library: 'Library',
      quickRules: 'Quick rules',
      bookmarks: 'Bookmarks',
      sources: 'Sources',
      aboutApp: 'About',
    });
  });
});
