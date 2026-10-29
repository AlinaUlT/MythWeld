// SHEET-13: the person's display choices (SPEC §7.5). Each is one row of `settings`, keyed by its
// name (SHEET-07), so a later choice adds a row, not a database version. Each choice is a list of
// the values it takes, the first its default. A row whose value is not on its list reads as the
// default and is named, not thrown (SPEC §8.2); a row the app does not know is left as it is.
import { db } from '../db/db';
import { setMotionStill } from '../theme/motions';

export const settingValues = {
  theme: ['dark', 'light'],
  stillMotion: [false, true],
  // Shown units only: stored units stay feet and pounds (SPEC §7.5).
  distance: ['ft', 'm'],
  weight: ['lb', 'kg'],
  // "I roll myself" (SPEC §6.5): the person types what their own dice show.
  rollMyself: [false, true],
} as const;

export type SettingKey = keyof typeof settingValues;
export type Settings = { [K in SettingKey]: (typeof settingValues)[K][number] };

const keys = Object.keys(settingValues) as SettingKey[];

export const DEFAULT_SETTINGS = Object.fromEntries(
  keys.map((key) => [key, settingValues[key][0]]),
) as Settings;

/** A stored row that did not read, and why. */
export interface RefusedSetting {
  key: SettingKey;
  message: string;
}

export interface StoredSettings {
  settings: Settings;
  refused: RefusedSetting[];
}

function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(settingValues, key);
}

export async function readSettings(table = db.settings): Promise<StoredSettings> {
  const read: StoredSettings = { settings: { ...DEFAULT_SETTINGS }, refused: [] };
  for (const { key, value } of await table.toArray()) {
    if (!isSettingKey(key)) continue;
    const allowed: readonly unknown[] = settingValues[key];
    if (allowed.includes(value)) Object.assign(read.settings, { [key]: value });
    else {
      read.refused.push({
        key,
        message: `Setting ${key} holds ${JSON.stringify(value)}, not one of ${JSON.stringify(allowed)}; it reads as ${JSON.stringify(DEFAULT_SETTINGS[key])}`,
      });
    }
  }
  return read;
}

export async function saveSetting<K extends SettingKey>(
  key: K,
  value: Settings[K],
  table = db.settings,
): Promise<void> {
  await table.put({ key, value });
}

/** Puts the choices that change the whole page on <html>: the theme's class and the motion switch. */
export function applySettings(settings: Settings, doc: Document = document): void {
  doc.documentElement.classList.toggle('dark', settings.theme === 'dark');
  setMotionStill(settings.stillMotion, doc);
}
