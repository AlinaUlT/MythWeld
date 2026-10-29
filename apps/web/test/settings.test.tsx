import 'fake-indexeddb/auto';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GrimoireDb } from '../src/db/db';
import '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { SettingsPage } from '../src/pages/SettingsPage';
import {
  applySettings,
  DEFAULT_SETTINGS,
  readSettings,
  saveSetting,
  settingValues,
} from '../src/settings/settings';
import { START_WAIT_MS } from '../src/settings/useSettings';

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-13-${count}`);
  await database.open();
});

afterEach(async () => {
  await database.delete();
});

// The <html> of a page, just enough for applySettings: its classes and its data attributes.
function fakeDocument(classes: string[]) {
  const list = new Set(classes);
  const documentElement = {
    dataset: {} as Record<string, string>,
    classList: {
      toggle(name: string, on: boolean) {
        if (on) list.add(name);
        else list.delete(name);
        return on;
      },
    },
  };
  return { doc: { documentElement } as unknown as Document, list, documentElement };
}

describe('SHEET-13 the display choices', () => {
  it('names each choice and its values, the first its default', () => {
    expect(settingValues).toEqual({
      theme: ['dark', 'light'],
      stillMotion: [false, true],
      distance: ['ft', 'm', 'sq'],
      weight: ['lb', 'kg'],
      rollMyself: [false, true],
    });
    // Dark by default (SPEC §7.2); the stored units, feet and pounds, are shown until changed.
    expect(DEFAULT_SETTINGS).toEqual({
      theme: 'dark',
      stillMotion: false,
      distance: 'ft',
      weight: 'lb',
      rollMyself: false,
    });
    expect(START_WAIT_MS).toBe(500);
  });

  it('reads the defaults from an empty table', async () => {
    expect(await readSettings(database.settings)).toEqual({
      settings: DEFAULT_SETTINGS,
      refused: [],
    });
  });

  it('keeps each choice as one row under its name', async () => {
    await saveSetting('theme', 'light', database.settings);
    await saveSetting('stillMotion', true, database.settings);
    await saveSetting('distance', 'm', database.settings);
    await saveSetting('weight', 'kg', database.settings);
    await saveSetting('rollMyself', true, database.settings);
    expect(await database.settings.orderBy('key').toArray()).toEqual([
      { key: 'distance', value: 'm' },
      { key: 'rollMyself', value: true },
      { key: 'stillMotion', value: true },
      { key: 'theme', value: 'light' },
      { key: 'weight', value: 'kg' },
    ]);
    expect(await readSettings(database.settings)).toEqual({
      settings: {
        theme: 'light',
        stillMotion: true,
        distance: 'm',
        weight: 'kg',
        rollMyself: true,
      },
      refused: [],
    });

    // A second save of one choice replaces its row.
    await saveSetting('theme', 'dark', database.settings);
    expect(await database.settings.count()).toBe(5);
    expect((await readSettings(database.settings)).settings.theme).toBe('dark');
  });

  it('reads a value off its list as the default, and names it', async () => {
    await database.settings.bulkPut([
      { key: 'theme', value: 'sepia' },
      { key: 'rollMyself', value: 'yes' },
      { key: 'weight', value: 'kg' },
    ]);
    expect(await readSettings(database.settings)).toEqual({
      settings: { ...DEFAULT_SETTINGS, weight: 'kg' },
      refused: [
        {
          key: 'rollMyself',
          message: 'Setting rollMyself holds "yes", not one of [false,true]; it reads as false',
        },
        {
          key: 'theme',
          message: 'Setting theme holds "sepia", not one of ["dark","light"]; it reads as "dark"',
        },
      ],
    });
  });

  it('leaves a row it does not know as it is', async () => {
    await database.settings.bulkPut([
      { key: 'language', value: 'ru' },
      { key: 'toString', value: 'x' },
    ]);
    expect(await readSettings(database.settings)).toEqual({
      settings: DEFAULT_SETTINGS,
      refused: [],
    });
    expect(await database.settings.count()).toBe(2);
  });

  it('puts the theme and the motion switch on <html>', () => {
    const { doc, list, documentElement } = fakeDocument(['dark']);
    applySettings({ ...DEFAULT_SETTINGS, theme: 'light', stillMotion: true }, doc);
    expect([...list]).toEqual([]);
    expect(documentElement.dataset).toEqual({ motion: 'still' });
    applySettings(DEFAULT_SETTINGS, doc);
    expect([...list]).toEqual(['dark']);
    expect(documentElement.dataset).toEqual({});
  });

  it('draws every choice with its default checked', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    ).replace(/ data-skin-[a-z]+="[^"]*"/g, '');
    const s = en.settings;
    for (const text of [
      s.title,
      s.units.title,
      s.units.distance,
      s.units.weight,
      s.units.ft,
      s.units.m,
      s.units.sq,
      s.units.lb,
      s.units.kg,
      s.dice.title,
      s.dice.rollMyself,
      s.dice.rollMyselfHint,
      s.theme.title,
      s.theme.mode,
      s.theme.dark,
      s.theme.light,
      s.theme.stillMotion,
      s.theme.stillMotionHint,
    ]) {
      expect(html).toContain(text);
    }
    const checked = [...html.matchAll(/name="(\w+)" checked="" value="(\w+)"/g)];
    expect(checked.map(([, name, value]) => `${name}=${value}`)).toEqual([
      'distance=ft',
      'weight=lb',
      'theme=dark',
    ]);
    expect(html.match(/<input type="radio"/g)).toHaveLength(7);
    expect(html.match(/role="switch" aria-checked="false"/g)).toHaveLength(2);
  });
});
