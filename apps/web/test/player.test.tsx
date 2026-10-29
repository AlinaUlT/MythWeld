import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { PlayerSections, sections } from '../src/pages/PlayerPage';

const render = (characters: number | undefined) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <PlayerSections characters={characters} />
    </MemoryRouter>,
  );

/** Each tile's text lines, read from the markup: the title, then the second line. */
function lines(markup: string) {
  const spans = [...markup.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map(([, text]) => text);
  return Array.from({ length: spans.length / 2 }, (_, i) => spans.slice(2 * i, 2 * i + 2));
}

/** Each link's target and text. */
const links = (markup: string) =>
  [...markup.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)].map(([, href, inner]) => [
    href,
    lines(inner ?? '')[0],
  ]);

describe('SHEET-12 the player page', () => {
  it("shows the board's six sections in its order", () => {
    expect(sections.map(({ key }) => key)).toEqual([
      'characters',
      'sources',
      'library',
      'dice',
      'quickRules',
      'bookmarks',
    ]);
    expect(lines(render(2)).map(([title]) => title)).toEqual([
      'Characters',
      'Sources',
      'Library',
      'Dice roll',
      'Quick rules',
      'Bookmarks',
    ]);
  });

  it('links only Characters, to the list', () => {
    expect(links(render(0))).toEqual([['/characters', ['Characters', 'No characters yet']]]);
  });

  it('counts the stored characters, with no limit', () => {
    expect(lines(render(0))[0]).toEqual(['Characters', 'No characters yet']);
    expect(lines(render(1))[0]).toEqual(['Characters', '1 character']);
    expect(lines(render(2))[0]).toEqual(['Characters', '2 characters']);
    expect(lines(render(4))[0]).toEqual(['Characters', '4 characters']);
  });

  it('leaves the line empty until the count is read', () => {
    expect(lines(render(undefined))[0]).toEqual(['Characters', '']);
  });

  it('shows the other five as coming later', () => {
    expect(
      lines(render(2))
        .slice(1)
        .map(([, line]) => line),
    ).toEqual(Array(5).fill(en.common.comingLater));
  });
});
