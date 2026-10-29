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
} as const;

/** The sheet of one saved character. */
export const sheetPath = (id: string) => `${paths.characters}/${encodeURIComponent(id)}`;
