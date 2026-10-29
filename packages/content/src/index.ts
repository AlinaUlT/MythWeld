// SRD import, hand-written mechanics, the glossary and the built packs.
// SHEET-08: the app's built-in packs are phase 1's golden fixtures, the mini-pack of SPEC §12 stage
// 2: each SRD's entities the golden characters need, as a file holds them. The golden tests read
// these same files. That a pack is built-in is the app's to say, by this list, never the file's.

import { srd2014 } from './packs/srd-2014';
import { srd2024 } from './packs/srd-2024';

export { srd2014, srd2024 };

/** The packs the app carries, as files: each is opened by its system's opener when it loads. */
export const BUILT_IN_PACKS: readonly unknown[] = [srd2014, srd2024];
