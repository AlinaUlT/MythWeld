// CONT-73: SRD 5.2.1's rules chapters, read from the SRD 5.2.1 PDF (CC-BY-4.0). 5e-database has no
// `Rules` file for 2024, so the fetch derives one from the PDF, in the shape SRD 5.1's has, and the
// rules importer reads it as it reads any source file. This file is the pure part: it takes the
// text items of the pages as the PDF reader gives them, and returns the entries. Reading the PDF is
// `srd-pdf-cli.ts`.

/** One piece of text of a page, as the PDF reader gives it: its string, position and height. */
export interface PdfItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The text of one page of the PDF, by its number from 1. */
export interface PdfPage {
  page: number;
  items: readonly PdfItem[];
}

/** One rule of the derived file: a heading and the words under it, before the next heading. */
export interface PdfRule {
  index: string;
  name: string;
  /** `section` of "Playing the Game", `glossary` entry of the "Rules Glossary". */
  kind: 'chapter' | 'section' | 'glossary';
  /** The bracketed kind a glossary term carries: `Action`, `Condition`, `Area of Effect`. */
  tag?: string;
  /** 0 for the chapter, then 1 to 3 by the heading's size; a glossary entry is 1. */
  depth: number;
  parent?: { index: string };
  page: number;
  desc?: string;
}

/** Where the two parts are in the PDF (CONT-73 §8): pages of "Playing the Game" and the glossary. */
export const PLAYING_THE_GAME = { first: 5, last: 18, title: 'Playing the Game' } as const;
export const RULES_GLOSSARY = { first: 176, last: 191, title: 'Rules Glossary' } as const;

/** Heading sizes in "Playing the Game": the chapter title, then three levels. */
const SECTION_SIZES: readonly (readonly [min: number, depth: number])[] = [
  [24, 0],
  [17, 1],
  [13, 2],
  [11.5, 3],
];
/** A glossary term's size. */
const TERM_SIZE = 11.5;
/** The words under the page's top: the page number and the document's name are above this line. */
const FOOTER_Y = 45;
/** The two columns of a page start at these distances from its left edge (a page is 594 wide). */
const SECOND_COLUMN_X = 300;
/** A paragraph's first line is indented by about 8 more than the lines after it; a list's by more. */
const isIndent = (by: number): boolean => by > 4 && by < 10;
/** A line that starts a list item: a bullet, or a number and a colon ("1: Establish Positions."). */
const LIST_ITEM = /^(•|\d+:)/;
/** Lines of one paragraph are about 12 apart; more than this starts another. */
const PARAGRAPH_GAP = 13;

interface Line {
  page: number;
  column: number;
  x: number;
  y: number;
  height: number;
  text: string;
  /** Where the last piece of the line ends. */
  end: number;
}

/** Pieces of a line apart by more than this have a space between them; by more, a table's cells. */
const WORD_GAP = 1.5;
const CELL_GAP = 12;

/** The lines of a page, column by column, top to bottom. */
function linesOf(page: PdfPage): Line[] {
  const lines: Line[] = [];
  for (const column of [0, 1]) {
    const items = page.items
      .filter((i) => i.y >= FOOTER_Y && (i.x < SECOND_COLUMN_X ? 0 : 1) === column)
      .filter((i) => i.str !== '' || i.height > 0)
      .sort((a, b) => b.y - a.y || a.x - b.x);
    for (const item of items) {
      const last = lines[lines.length - 1];
      if (
        last !== undefined &&
        last.column === column &&
        last.page === page.page &&
        Math.abs(last.y - item.y) <= 2
      ) {
        const gap = item.x - last.end;
        const between =
          item.str.trim() === '' || /\s$/.test(last.text)
            ? ''
            : gap > CELL_GAP
              ? ' | '
              : gap > WORD_GAP
                ? ' '
                : '';
        last.text += between + item.str;
        last.end = item.x + item.width;
        last.height = Math.max(last.height, item.height);
        last.x = Math.min(last.x, item.x);
      } else {
        lines.push({
          page: page.page,
          column,
          x: item.x,
          y: item.y,
          height: item.height,
          text: item.str,
          end: item.x + item.width,
        });
      }
    }
  }
  return lines.filter((l) => l.text.trim() !== '').map((l) => ({ ...l, text: l.text.trimEnd() }));
}

/**
 * A sidebar's title is set in small capitals, which the PDF gives as capitals and lowercase letters
 * mixed in one word ("M arcHinG ordEr"): the line is one, and its words are in capitals and the
 * letter a gap has set apart is joined.
 */
function smallCapsTitle(text: string): string | undefined {
  if (text.length > 60 || !/\b[A-Za-z]*[a-z][A-Z][A-Za-z]*\b/.test(text)) return undefined;
  const tokens = text.split(/\s+/);
  const joined: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] ?? '';
    const next = tokens[i + 1];
    if (/^[A-Z]$/.test(token) && next !== undefined && /^[a-z]/i.test(next) && next.length > 1) {
      joined.push(token + next);
      i += 1;
    } else joined.push(token);
  }
  const small = new Set(['a', 'an', 'and', 'of', 'on', 'the', 'to', 'in', 'or']);
  return joined
    .map((word, i) => {
      const lower = word.toLowerCase();
      return i > 0 && small.has(lower) ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** The slug of a name: lowercase words joined by hyphens, apostrophes dropped. */
export function slugOfName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** `Dash [Action]` as its name and its tag. */
function splitTag(heading: string): { name: string; tag?: string } {
  const match = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(heading);
  return match === null ? { name: heading.trim() } : { name: match[1] ?? '', tag: match[2] };
}

/** The words of a paragraph's lines: a word broken by a hyphen at the line's end is joined. */
function joinLines(lines: readonly string[]): string {
  let text = '';
  for (const line of lines) {
    if (text === '') text = line.trim();
    else if (/[a-z]-$/.test(text) && /^[a-z]/.test(line)) text = text.slice(0, -1) + line.trim();
    else text = `${text} ${line.trim()}`;
  }
  return text;
}

/** The entries of one part: its headings and the paragraphs under each. */
function partOf(
  pages: readonly PdfPage[],
  part: { first: number; last: number; title: string },
  kind: 'section' | 'glossary',
  used: Set<string>,
): PdfRule[] {
  const lines = pages.filter((p) => p.page >= part.first && p.page <= part.last).flatMap(linesOf);
  const rules: PdfRule[] = [];
  const chapterIndex = slugOfName(part.title);
  rules.push({
    index: chapterIndex,
    name: part.title,
    kind: 'chapter',
    depth: 0,
    page: part.first,
  });
  used.add(chapterIndex);
  const open: PdfRule[] = [];
  let paragraphs: string[][] = [];
  let current: PdfRule | undefined;
  let previous: Line | undefined;
  const close = () => {
    if (current !== undefined && paragraphs.length > 0) {
      current.desc = paragraphs
        .map(joinLines)
        .join('\n\n')
        .replace(/([a-z])-\n\n([a-z])/g, '$1$2');
    }
    paragraphs = [];
  };
  const depthOf = (line: Line): number | undefined => {
    if (kind === 'section' && smallCapsTitle(line.text) !== undefined) {
      return Math.min(3, (open[open.length - 1]?.depth ?? 0) + 1);
    }
    if (kind === 'glossary') return line.height >= TERM_SIZE && line.height < 17 ? 1 : undefined;
    return SECTION_SIZES.find(([min]) => line.height >= min)?.[1];
  };
  for (const line of lines) {
    const depth = depthOf(line);
    // The part's own title is the chapter, not an entry.
    if (depth !== undefined && line.text.trim() === part.title) continue;
    if (depth === 0 && kind === 'section') continue;
    if (depth !== undefined) {
      // A heading that goes on in the next line (same size, next line) is one heading.
      if (
        current !== undefined &&
        previous?.height === line.height &&
        paragraphs.length === 0 &&
        previous.column === line.column &&
        previous.y - line.y < 16 &&
        current.depth === depth &&
        current.desc === undefined &&
        !/\]\s*$/.test(current.name + (current.tag ? `[${current.tag}]` : ''))
      ) {
        const joined = splitTag(
          `${current.name}${current.tag ? ` [${current.tag}]` : ''} ${line.text.trim()}`,
        );
        current.name = joined.name;
        if (joined.tag !== undefined) current.tag = joined.tag;
        previous = line;
        continue;
      }
      close();
      const { name, tag } = splitTag(smallCapsTitle(line.text) ?? line.text);
      const rule: PdfRule = {
        index: '',
        name,
        kind,
        depth,
        page: line.page,
        ...(tag !== undefined && { tag }),
      };
      while (open.length > 0 && (open[open.length - 1]?.depth ?? 0) >= depth) open.pop();
      const parent = open[open.length - 1]?.index ?? chapterIndex;
      rule.parent = { index: parent };
      // The id is the slug of the name; a name that comes twice has its tag's or its parent's too.
      let slug = slugOfName(name);
      if (used.has(slug)) {
        slug = `${slug}-${tag !== undefined ? slugOfName(tag) : parent}`;
        for (let n = 2; used.has(slug); n += 1) slug = `${slug}-${n}`;
      }
      used.add(slug);
      rule.index = slug;
      open.push(rule);
      rules.push(rule);
      current = rule;
    } else if (current !== undefined) {
      const sameColumn =
        previous !== undefined && previous.column === line.column && previous.page === line.page;
      const startsParagraph =
        paragraphs.length === 0 ||
        (sameColumn && isIndent(line.x - (previous?.x ?? line.x))) ||
        LIST_ITEM.test(line.text) ||
        (previous !== undefined &&
          previous.column === line.column &&
          previous.page === line.page &&
          previous.y - line.y > PARAGRAPH_GAP);
      if (startsParagraph) paragraphs.push([line.text]);
      else paragraphs[paragraphs.length - 1]?.push(line.text);
    }
    previous = line;
  }
  close();
  return rules;
}

/**
 * The rules of the two parts: the chapter "Playing the Game" and the "Rules Glossary". `parent` is
 * resolved to the ids of the entries.
 */
export function rulesOfPdf(pages: readonly PdfPage[]): PdfRule[] {
  const used = new Set<string>();
  return [
    ...partOf(pages, PLAYING_THE_GAME, 'section', used),
    ...partOf(pages, RULES_GLOSSARY, 'glossary', used),
  ];
}
