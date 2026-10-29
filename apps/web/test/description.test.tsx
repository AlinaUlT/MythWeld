import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { type Described, descriptionOf, textIn } from '../src/content/descriptions';
import { type InstalledPack, installBuiltInPacks } from '../src/content/packs';
import '../src/i18n';
import { Description, DescriptionBody } from '../src/shared/Description';

// The built-in packs carry no summary and no text (SHEET-31 §2), so their entries say the source
// has none. The test pack's and the own entry's texts are invented here, never rules text.

const builtIn = installBuiltInPacks().packs;
const srd2014 = builtIn.find((installed) => installed.pack.id === 'srd-2014');
if (srd2014 === undefined) throw new Error('The built-in SRD 5.1 pack did not open.');
const dwarf = srd2014.pack.entities.find((entity) => entity.id === 'srd-2014:species/dwarf');
if (dwarf === undefined) throw new Error('The SRD 5.1 pack has no Dwarf.');

const testPack: InstalledPack = {
  origin: 'builtIn',
  pack: {
    ...srd2014.pack,
    id: 'test-pack',
    version: '2.0.0',
    title: { en: 'Test Book', ru: 'Тестовая книга' },
    license: { name: 'Test License', redistributable: true },
  },
};
const packs = [...builtIn, testPack];

const lantern: Described = {
  id: 'test-pack:feature/lantern',
  name: { en: 'Lantern Trick', ru: 'Фонарь' },
  summary: { en: 'A small light.' },
  text: { en: 'First line.\nSecond line.', ru: 'Первая строка.' },
  source: { pack: 'test-pack', page: '12' },
};

const charm: Described = {
  id: 'character:feature/lucky-charm',
  name: { en: 'Lucky Charm' },
  text: { en: 'A pebble from home.' },
  source: { pack: 'srd-2014' },
};

const stray: Described = {
  id: 'srd-2014:feature/stray',
  name: { en: 'Stray' },
  source: { pack: 'gone-pack' },
};

/** The drawn HTML, and its text with the tags taken out. */
function draw(node: ReactElement) {
  const html = renderToStaticMarkup(node);
  return { html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') };
}

describe("SHEET-31 an entry's description", () => {
  it('reads a text in the language, then English, then any language', () => {
    expect(textIn({ en: 'One', ru: 'Один' }, 'ru')).toBe('Один');
    expect(textIn({ en: 'One', ru: 'Один' }, 'de')).toBe('One');
    expect(textIn({ ru: 'Один' }, 'en')).toBe('Один');
  });

  it("names a built-in pack's book, version and license, and says it has no text", () => {
    const description = descriptionOf(dwarf, 'en', builtIn);
    expect(description).toEqual({
      name: 'Dwarf',
      source: {
        kind: 'pack',
        book: 'SRD 5.1',
        version: '0.1.0',
        license: 'CC-BY-4.0',
        attribution: srd2014.pack.license.attribution,
      },
    });
    const { text } = draw(<Description entity={dwarf} packs={builtIn} defaultOpen defaultFull />);
    expect(text).toContain('Its source has no full text for this entry.');
    expect(text).toContain('Source: SRD 5.1 · version 0.1.0 · CC-BY-4.0');
    expect(text).toContain(
      'This work includes material taken from the System Reference Document 5.1',
    );
  });

  it("reads a pack's summary, text and page, its license by name when it has no SPDX id", () => {
    expect(descriptionOf(lantern, 'en', packs)).toEqual({
      name: 'Lantern Trick',
      summary: 'A small light.',
      text: 'First line.\nSecond line.',
      source: {
        kind: 'pack',
        book: 'Test Book',
        version: '2.0.0',
        license: 'Test License',
        page: '12',
      },
    });
    expect(descriptionOf(lantern, 'ru', packs)).toMatchObject({
      name: 'Фонарь',
      summary: 'A small light.',
      text: 'Первая строка.',
      source: { book: 'Тестовая книга' },
    });
    expect(
      descriptionOf({ ...lantern, source: { pack: 'test-pack', book: 'Own Title' } }, 'en', packs)
        .source,
    ).toMatchObject({ book: 'Own Title' });
  });

  it("calls a character's own entry the person's, whatever pack it names", () => {
    expect(descriptionOf(charm, 'en', packs).source).toEqual({ kind: 'own' });
    const { text } = draw(<Description entity={charm} packs={packs} defaultOpen defaultFull />);
    expect(text).toContain('A pebble from home.');
    expect(text).toContain('Source: your own entry');
    expect(text).not.toContain('version');
  });

  it('names a source pack that is not on the device, and draws without breaking', () => {
    expect(descriptionOf(stray, 'en', packs).source).toEqual({
      kind: 'notInstalled',
      pack: 'gone-pack',
    });
    const { text } = draw(<Description entity={stray} packs={packs} defaultOpen defaultFull />);
    expect(text).toContain('Source: gone-pack, not on this device');
    expect(text).toContain('Its source has no full text for this entry.');
  });

  it('draws a closed entry with its name, the chevron down and nothing of the description', () => {
    const { html, text } = draw(
      <Description entity={lantern} packs={packs}>
        Once a day
      </Description>,
    );
    expect(text.trim()).toBe('Lantern Trick Once a day');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('transform:none');
    expect(html).toContain('data-skin-motion="turn"');
    expect(html).not.toContain('See full description');
  });

  it('opens with the chevron up, the summary and a closed "See full description"', () => {
    const { html, text } = draw(<Description entity={lantern} packs={packs} defaultOpen />);
    const expanded = [...html.matchAll(/aria-expanded="(\w+)" aria-controls="([^"]+)"/g)];
    expect(expanded.map((m) => m[1])).toEqual(['true', 'false']);
    for (const [, , id] of expanded) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('transform:rotate(180deg)');
    expect(text).toContain('A small light.');
    expect(text).toContain('See full description');
    expect(text).not.toContain('First line.');
  });

  it('opens the full text with its line breaks, the source and its page', () => {
    const { html, text } = draw(
      <Description entity={lantern} packs={packs} defaultOpen defaultFull />,
    );
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(2);
    expect(html).toContain('First line.\nSecond line.');
    expect(html).toContain('whitespace-pre-line');
    expect(text).toContain('Source: Test Book, page 12 · version 2.0.0 · Test License');
  });

  it('draws the body alone for the cast panel, with no row', () => {
    const { html, text } = draw(
      <DescriptionBody description={descriptionOf(lantern, 'en', packs)} defaultFull />,
    );
    expect(text).not.toContain('Lantern Trick');
    expect(text).toContain('A small light.');
    expect(text).toContain('First line.');
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it('gives every button the control height', () => {
    const { html } = draw(<Description entity={lantern} packs={packs} defaultOpen />);
    const buttons = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]);
    expect(buttons).toHaveLength(2);
    for (const name of buttons) expect(name).toContain('min-h-control');
  });
});
