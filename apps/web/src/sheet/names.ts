// SHEET-46: an entity's name as the sheet shows it, shared by the header and the Spells tab.
import type { L10n } from '@grimoire/schema';

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
export function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}
