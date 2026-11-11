import { describe, expect, it } from 'vitest';
import { type PdfItem, type PdfPage, rulesOfPdf } from '../src/source/srd-pdf.ts';

// CONT-73: the reader of the SRD 5.2.1 PDF's text items, on made-up pages: a heading by its size, the
// two columns, a paragraph by its indent or gap, a word broken by a hyphen, a table's cells, a
// sidebar's small-capital title, two entries of one name. Every string is made up.

const item = (str: string, x: number, y: number, height = 10, width = str.length * 5): PdfItem => ({
  str,
  x,
  y,
  width,
  height,
});

/** A page of the part "Playing the Game" (pages 5 to 18) or of the glossary (176 to 191). */
const page = (n: number, items: PdfItem[]): PdfPage => ({ page: n, items });

describe('CONT-73 rulesOfPdf', () => {
  it('makes an entry of each heading, by size, with the words under it and its parent', () => {
    const rules = rulesOfPdf([
      page(5, [
        item('Made-up Chapter', 63, 700, 26),
        item('First Section', 63, 680, 18),
        item('Words of the first section.', 63, 660),
        item('A Sub-section', 63, 640, 14),
        item('Words of the sub-section.', 63, 620),
      ]),
    ]);
    const mine = rules.filter((r) => r.kind === 'section');
    expect(mine.map((r) => [r.index, r.depth, r.parent?.index, r.desc])).toEqual([
      ['first-section', 1, 'playing-the-game', 'Words of the first section.'],
      ['a-sub-section', 2, 'first-section', 'Words of the sub-section.'],
    ]);
    expect(rules[0]).toMatchObject({
      index: 'playing-the-game',
      kind: 'chapter',
      depth: 0,
      page: 5,
    });
  });

  it('reads the left column, then the right, and leaves out the footer', () => {
    const rules = rulesOfPdf([
      page(5, [
        item('System Reference Document 5.2.1', 63, 28),
        item('A', 63, 700, 18),
        item('left words', 63, 680),
        item('right words', 313, 700),
        item('B', 313, 680, 18),
        item('more right words', 313, 660),
      ]),
    ]);
    expect(rules.filter((r) => r.kind === 'section').map((r) => [r.name, r.desc])).toEqual([
      ['A', 'left words right words'],
      ['B', 'more right words'],
    ]);
  });

  it('starts a paragraph at an indent of about 8 or a gap, joins a word a hyphen broke, and keeps a hanging indent', () => {
    const [, entry] = rulesOfPdf([
      page(5, [
        item('H', 63, 700, 18),
        item('first line of one para-', 63, 680),
        item('graph and its end.', 63, 668),
        item('  second paragraph', 71, 656),
        item('goes on here.', 63, 644),
        item('after a gap', 63, 620),
        item('1:', 63, 600, 10, 8),
        item('Step one text', 74.5, 600),
        item('step one goes on', 74.5, 588),
        item('2:', 63, 576, 10, 8),
        item('Step two', 74.5, 576),
      ]),
    ]);
    expect(entry?.desc?.split('\n\n')).toEqual([
      'first line of one paragraph and its end.',
      'second paragraph goes on here.',
      'after a gap',
      '1: Step one text step one goes on',
      '2: Step two',
    ]);
  });

  it('puts a space between pieces of a line apart, and a bar between a table’s cells', () => {
    const [, entry] = rulesOfPdf([
      page(5, [
        item('H', 63, 700, 18),
        item('Size', 63, 680, 10, 20),
        item('Water', 90, 680, 10, 25),
        item('Tiny', 63, 668, 10, 20),
        item('1 gallon', 200, 668, 10, 40),
      ]),
    ]);
    expect(entry?.desc).toBe('Size Water Tiny | 1 gallon');
  });

  it('reads a title in small capitals as a heading one level below the open one', () => {
    const rules = rulesOfPdf([
      page(5, [
        item('H', 63, 700, 18),
        item('words', 63, 680),
        item('M arcHinG ordEr', 63, 660, 11),
        item('sidebar words', 63, 640),
      ]),
    ]).filter((r) => r.kind === 'section');
    expect(rules.map((r) => [r.name, r.depth, r.parent?.index, r.desc])).toEqual([
      ['H', 1, 'playing-the-game', 'words'],
      ['Marching Order', 2, 'h', 'sidebar words'],
    ]);
  });

  it('reads a glossary term with its bracketed kind, and gives a name that comes twice another id', () => {
    const rules = rulesOfPdf([
      page(6, [item('Cover', 63, 700, 18), item('words of the section', 63, 680)]),
      page(176, [
        item('Cover', 63, 700, 12),
        item('words of the term', 63, 680),
        item('Dash [Action]', 63, 660, 12),
        item('dash words', 63, 640),
      ]),
    ]);
    expect(
      rules
        .filter((r) => r.kind !== 'chapter')
        .map((r) => [r.index, r.name, r.tag, r.kind, r.page]),
    ).toEqual([
      ['cover', 'Cover', undefined, 'section', 6],
      ['cover-rules-glossary', 'Cover', undefined, 'glossary', 176],
      ['dash', 'Dash', 'Action', 'glossary', 176],
    ]);
  });
});
