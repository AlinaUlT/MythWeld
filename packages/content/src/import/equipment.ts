import type { Importer } from './frame.ts';

// CONT-04: empty until CONT-12 fills it (item: armor, weapons, gear, tools, packs, mounts and vehicles). It names its entity types and its source files,
// then makes the entities; the frame checks each one.
export const equipment: Importer = {
  types: [],
  files: { '2014': [], '2024': [] },
  run: () => [],
};
