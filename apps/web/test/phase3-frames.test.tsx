import { existsSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import '../src/i18n';
import { en } from '../src/i18n/namespaces';
import { AboutPage } from '../src/pages/AboutPage';
import { BookmarksPage } from '../src/pages/BookmarksPage';
import { LibraryPage } from '../src/pages/LibraryPage';
import { QuickRulesPage } from '../src/pages/QuickRulesPage';
import { SourcesPage } from '../src/pages/SourcesPage';
import { libraryTopics, paths } from '../src/shell/routes';

// CONT-03: the phase 3 screens' frames. Each page opens at its route with its title and a back
// arrow, and holds nothing else until its row fills it. The files the later rows fill exist, each
// under the row that owns it (the table in CONT-03 §11).

function drawn(path: string, route: string, Page: () => React.ReactElement): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The page's heading and where its back arrow goes, read from the markup. */
function frame(markup: string) {
  return {
    title: markup.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1],
    back: markup.match(/<a [^>]*aria-label="Back"[^>]*>/)?.[0].match(/href="([^"]*)"/)?.[1],
    headings: (markup.match(/<h[1-6][ >]/g) ?? []).length,
    paragraphs: (markup.match(/<(p|ul|ol|button|input|section)[ >]/g) ?? []).length,
  };
}

describe('CONT-03 the phase 3 pages', () => {
  const cases = [
    ['Library', '/library', paths.library, LibraryPage, '/player'],
    ['Library at a topic', '/library/spells', paths.libraryTopic, LibraryPage, '/player'],
    ['Quick rules', '/quick-rules', paths.quickRules, QuickRulesPage, '/player'],
    ['Bookmarks', '/bookmarks', paths.bookmarks, BookmarksPage, '/player'],
    ['Sources', '/sources', paths.sources, SourcesPage, '/player'],
    ['About', '/about', paths.about, AboutPage, '/settings'],
  ] as const;

  it.each(cases)(
    '%s opens with its title, a back arrow and nothing else',
    (name, at, route, page, back) => {
      const title = name === 'Library at a topic' ? 'Library' : name;
      expect(frame(drawn(at, route, page))).toEqual({ title, back, headings: 1, paragraphs: 0 });
    },
  );

  it('opens the library at every topic of the picker, through the one route', () => {
    for (const topic of libraryTopics) {
      const markup = drawn(`/library/${topic}`, paths.libraryTopic, LibraryPage);
      expect(frame(markup).title).toBe('Library');
    }
  });
});

describe('CONT-03 the empty files of the later rows', () => {
  const root = new URL('../src/', import.meta.url);
  // Each file, with the row that fills it and the namespace that holds its text.
  const owners: Readonly<Record<string, { row: string; namespace: string }>> = {
    'library/topics/spells.ts': { row: 'CONT-43', namespace: 'libSpells' },
    'library/topics/classes.ts': { row: 'CONT-45', namespace: 'libClasses' },
    'library/topics/species.ts': { row: 'CONT-46', namespace: 'libSpecies' },
    'library/topics/backgrounds.ts': { row: 'CONT-47', namespace: 'libBackgrounds' },
    'library/topics/feats.ts': { row: 'CONT-48', namespace: 'libFeats' },
    'library/topics/armor.ts': { row: 'CONT-49', namespace: 'libArmor' },
    'library/topics/weapons.ts': { row: 'CONT-49', namespace: 'libWeapons' },
    'library/topics/items.ts': { row: 'CONT-49', namespace: 'libItems' },
    'library/topics/magicItems.ts': { row: 'CONT-50', namespace: 'libMagicItems' },
    'library/topics/conditions.ts': { row: 'CONT-51', namespace: 'libConditions' },
    'library/topics/monsters.ts': { row: 'CONT-52', namespace: 'libMonsters' },
    'library/windows/EntryWindow.tsx': { row: 'CONT-19', namespace: 'libEntry' },
    'library/windows/SpellCasters.tsx': { row: 'CONT-44', namespace: 'libSpellCasters' },
    'library/windows/ClassWindow.tsx': { row: 'CONT-45', namespace: 'libClass' },
    'quickRules/TopicWindow.tsx': { row: 'CONT-54', namespace: 'rulesTopic' },
    'quickRules/RuleWindow.tsx': { row: 'CONT-54', namespace: 'rulesRule' },
    'shared/BookmarkButton.tsx': { row: 'CONT-55', namespace: 'bookmarkButton' },
  };

  it('has one file for each topic of the library, and one for each window', () => {
    const missing = Object.keys(owners).filter((file) => !existsSync(new URL(file, root)));
    expect(missing).toEqual([]);
    // Eleven topics, three library windows, two Quick rules windows, one shared button.
    expect(Object.keys(owners)).toHaveLength(17);
    expect(libraryTopics).toHaveLength(11);
  });

  it('gives each file a namespace of its own, so two rows of a wave never edit one locale file', () => {
    const namespaces = Object.values(owners).map(({ namespace }) => namespace);
    expect(new Set(namespaces).size).toBe(namespaces.length);
    expect(namespaces.filter((namespace) => !(namespace in en))).toEqual([]);
  });
});
