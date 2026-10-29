// SHEET-13: the choices in memory, read once at start and changed from the Settings page. A change
// shows at once and is saved after; a save that fails is logged, and the choice still holds until
// the app closes.
import { useSyncExternalStore } from 'react';
import {
  applySettings,
  DEFAULT_SETTINGS,
  readSettings,
  type SettingKey,
  type Settings,
  saveSetting,
} from './settings';

/** How long the first render waits for the stored choices, so a light theme does not flash dark. */
export const START_WAIT_MS = 500;

let current: Settings = DEFAULT_SETTINGS;
// The choices changed since start: a read that lands late never undoes one.
const changed = new Set<SettingKey>();
const listeners = new Set<() => void>();

function show(next: Settings) {
  current = next;
  applySettings(current);
  for (const listener of listeners) listener();
}

/**
 * Reads the stored choices and puts them on the page. It never fails: a read that fails leaves
 * the defaults, and one slower than `wait` lets the app start and applies when it lands.
 */
export function startSettings(wait = START_WAIT_MS): Promise<void> {
  const read = readSettings()
    .then(({ settings, refused }) => {
      for (const { message } of refused) console.warn(message);
      const kept = Object.fromEntries([...changed].map((key) => [key, current[key]]));
      show({ ...settings, ...kept });
    })
    .catch((error: unknown) => console.error(error));
  return Promise.race([read, new Promise<void>((done) => setTimeout(done, wait))]);
}

export function changeSetting<K extends SettingKey>(key: K, value: Settings[K]): void {
  changed.add(key);
  show({ ...current, [key]: value });
  saveSetting(key, value).catch((error: unknown) => console.error(error));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => current;

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
