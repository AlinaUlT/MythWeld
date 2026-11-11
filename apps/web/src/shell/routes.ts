// SHEET-11: the path of every phase 2 screen (ADR 008). Each later row fills its page; none adds a
// route of its own, so the rows of one wave never edit the router together. `/` is the start
// page, shown on every start until the owner decides otherwise (ADR 008 "Still open").
export const paths = {
  start: '/',
  player: '/player',
  settings: '/settings',
  characters: '/characters',
  newCharacter: '/characters/new',
  sheet: '/characters/:id',
  dice: '/dice',
  // CONT-03: the phase 3 screens. The library is one page; the topic picked is a part of its path.
  library: '/library',
  libraryTopic: '/library/:topic',
  quickRules: '/quick-rules',
  bookmarks: '/bookmarks',
  sources: '/sources',
  about: '/about',
} as const;

/**
 * The library's topics, in the order its picker lists them (ADR 010 item 3, with the magic items
 * and conditions SPEC §3.1 adds). Encounter templates come with the DM tools. The topic is the last
 * segment of its path, so a link opens the library at it.
 */
export const libraryTopics = [
  'spells',
  'classes',
  'species',
  'backgrounds',
  'feats',
  'armor',
  'weapons',
  'items',
  'magic-items',
  'conditions',
  'monsters',
] as const;
export type LibraryTopic = (typeof libraryTopics)[number];

/** The library, open at one topic. */
export const libraryPath = (topic: LibraryTopic) => `${paths.library}/${topic}`;

/** The sheet of one saved character. */
export const sheetPath = (id: string) => `${paths.characters}/${encodeURIComponent(id)}`;
