// SHEET-30: the sheet's tabs, in the order board V3-Sheet draws them: the six of SPEC §7.2 (Gear
// is its Equipment), About (ADR 009 item 3) and Turn (ADR 010 item 8). Each tab is its sections,
// top to bottom; each section is its own file, which its row fills. Conditions stand at the top of
// Main, as the board draws them, and on Combat, as BRIEF P4 lists them.
import type { ComponentType } from 'react';
import { Abilities } from './sections/Abilities';
import { AboutList } from './sections/AboutList';
import { Attacks } from './sections/Attacks';
import { Coins } from './sections/Coins';
import { Concentration } from './sections/Concentration';
import { Conditions } from './sections/Conditions';
import { DeathSaves } from './sections/DeathSaves';
import { FeatureList } from './sections/FeatureList';
import { Items } from './sections/Items';
import { NotesText } from './sections/NotesText';
import { SavingThrows } from './sections/SavingThrows';
import { Skills } from './sections/Skills';
import { SpellList } from './sections/SpellList';
import { TurnList } from './sections/TurnList';

export const SHEET_TABS = [
  { id: 'main', sections: [Conditions, Abilities, SavingThrows, Skills] },
  { id: 'turn', sections: [TurnList] },
  { id: 'combat', sections: [Attacks, Conditions, Concentration, DeathSaves] },
  { id: 'spells', sections: [SpellList] },
  { id: 'gear', sections: [Items, Coins] },
  { id: 'features', sections: [FeatureList] },
  { id: 'about', sections: [AboutList] },
  { id: 'notes', sections: [NotesText] },
] as const satisfies readonly { id: string; sections: readonly ComponentType[] }[];

export type SheetTabId = (typeof SHEET_TABS)[number]['id'];

/** The tab a `tab` search value names; Main for none or an unknown one. */
export function tabOf(value: string | null): SheetTabId {
  return SHEET_TABS.find(({ id }) => id === value)?.id ?? 'main';
}
