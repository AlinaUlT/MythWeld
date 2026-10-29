// SRD import, hand-written mechanics, the glossary and the built packs.
// SHEET-08: the built-in packs. Phase 2's mini-pack is the phase 1 fixtures (SPEC §12 stage 2),
// the SRD 5.1 and SRD 5.2.1 entries the golden characters need, each pack with its CC-BY-4.0
// licence. Each is a pack as a file holds it; the app opens it as it opens any pack.
import { srd2014 } from './packs/srd-2014';
import { srd2024 } from './packs/srd-2024';

export { srd2014, srd2024 };

/** The packs shipped inside the app's build, in load order (ADR 003 item 7). */
export const BUILT_IN_PACKS = [srd2014, srd2024] as const;
