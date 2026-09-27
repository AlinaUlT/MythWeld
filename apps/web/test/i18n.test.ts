import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n';

describe('SETUP-05 i18n', () => {
  it('starts in English', () => {
    expect(i18n.language).toBe('en');
  });

  it('gives the English text of the tab labels', () => {
    expect(i18n.t('nav.characters')).toBe('Characters');
    expect(i18n.t('nav.library')).toBe('Library');
    expect(i18n.t('nav.dice')).toBe('Dice');
    expect(i18n.t('nav.settings')).toBe('Settings');
  });

  it('rejects an unknown key at compile time', () => {
    // @ts-expect-error `nav.nope` is not in the English locale.
    expect(i18n.t('nav.nope')).toBe('nav.nope');
  });
});
