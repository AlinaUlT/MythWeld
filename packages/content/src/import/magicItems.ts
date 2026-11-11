import type { Importer } from './frame.ts';

// CONT-04: empty until CONT-13 fills it (item: magic items). It names its entity types and its source files,
// then makes the entities; the frame checks each one.
export const magicItems: Importer = {
  types: [],
  files: { '2014': [], '2024': [] },
  run: () => [],
};
