import { readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { BreakdownSheet } from '../src/shared/BreakdownSheet';
import { paths, sheetPath } from '../src/shell/routes';

const localeFiles = readdirSync(new URL('../src/locales/en/', import.meta.url))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

describe('SHEET-11 navigation', () => {
  it('gives every phase 2 screen its own path', () => {
    expect(paths).toEqual({
      start: '/',
      player: '/player',
      settings: '/settings',
      characters: '/characters',
      newCharacter: '/characters/new',
      sheet: '/characters/:id',
      dice: '/dice',
    });
    expect(new Set(Object.values(paths)).size).toBe(Object.keys(paths).length);
  });

  it('builds a sheet path that keeps any id in one segment', () => {
    expect(sheetPath('golden-b')).toBe('/characters/golden-b');
    expect(sheetPath('a/b c')).toBe('/characters/a%2Fb%20c');
  });

  it('loads every English locale file as a namespace', () => {
    expect(Object.keys(en).sort()).toEqual(localeFiles);
    expect([...(i18n.options.ns as string[])].sort()).toEqual(localeFiles);
    expect(localeFiles).toEqual([
      'about',
      'actions',
      'attacks',
      'breakdown',
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
      'notes',
      'numberPad',
      'player',
      'rest',
      'roll',
      'settings',
      'sheet',
      'spells',
      'start',
      'toast',
      'token',
      'turn',
    ]);
  });

  it('titles every page from its own namespace', () => {
    const titles = Object.fromEntries(
      (['player', 'settings', 'characters', 'create', 'sheet', 'dice'] as const).map((ns) => [
        ns,
        i18n.t('title', { ns }),
      ]),
    );
    expect(titles).toEqual({
      player: 'Player',
      settings: 'Settings',
      characters: 'My characters',
      create: 'New character',
      sheet: 'Character',
      dice: 'Dice',
    });
  });

  it('creates the shared pieces empty, for the rows that fill them', () => {
    // SHEET-30: the sheet passes the breakdown its number's path. The roll dialog is SHEET-39's.
    expect(renderToStaticMarkup(<BreakdownSheet path="init.total" onClose={() => {}} />)).toBe('');
  });
});
