import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n';
import { defaultTabPath, tabs } from '../src/shell/tabs';

describe('SETUP-04 tabs', () => {
  it('has the four tabs of SPEC §7.1 in order', () => {
    expect(tabs.map((tab) => tab.path)).toEqual(['/characters', '/library', '/dice', '/settings']);
  });

  it('has unique paths', () => {
    expect(new Set(tabs.map((tab) => tab.path)).size).toBe(tabs.length);
  });

  it('has an English label for every tab', () => {
    for (const tab of tabs) expect(i18n.exists(tab.labelKey, { lng: 'en' })).toBe(true);
  });

  it('opens the first tab by default', () => {
    expect(defaultTabPath).toBe(tabs[0]?.path);
  });
});
