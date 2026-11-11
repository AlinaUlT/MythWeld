// CONT-04: every importer, by the file it lives in. Each wave 2 and wave 3 row fills its own file
// and never edits this one. `runImport` runs them in this order.

import { backgrounds } from './backgrounds.ts';
import { classes } from './classes.ts';
import { equipment } from './equipment.ts';
import { feats } from './feats.ts';
import type { Importer } from './frame.ts';
import { magicItems } from './magicItems.ts';
import { monsters } from './monsters.ts';
import { rules } from './rules.ts';
import { smallTypes } from './smallTypes.ts';
import { species } from './species.ts';
import { spells } from './spells.ts';

export const importers: Readonly<Record<string, Importer>> = {
  spells,
  classes,
  species,
  backgrounds,
  feats,
  equipment,
  magicItems,
  smallTypes,
  rules,
  monsters,
};
