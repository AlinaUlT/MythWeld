// The golden tests' data (SPEC §6.7): the SRD packs and the characters, by edition, golden E's
// homebrew pack (ENG-22), and golden F, which mixes both editions (ENG-37).
// SHEET-08: the SRD packs are the app's built-in packs, kept in `packages/content`. The module's
// package never depends on `content` (it depends on the module), so its tests read the two files
// by their path, here and nowhere else.

export * from '../../../content/src/packs/srd-2014.ts';
export * from '../../../content/src/packs/srd-2024.ts';
export * from './characters-2014.ts';
export * from './characters-2024.ts';
export * from './characters-mixed.ts';
export * from './hb-local.ts';
