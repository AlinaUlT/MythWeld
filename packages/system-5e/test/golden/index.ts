// The golden tests' data (SPEC §6.7): the SRD packs and the characters, by edition, golden E's
// homebrew pack (ENG-22), and golden F, which mixes both editions (ENG-37).
// SHEET-08: the SRD packs are the app's built-in packs; the tests read those files.
export { srd2014, srd2024 } from '../../../content/src/index.ts';
export * from './characters-2014.ts';
export * from './characters-2024.ts';
export * from './characters-mixed.ts';
export * from './hb-local.ts';
