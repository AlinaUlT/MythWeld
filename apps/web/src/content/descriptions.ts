// SHEET-31: what an entry's description shows (ADR 011): its summary and its exact text, each in
// the app's language when the entry has it, and the source the text was taken from, named with its
// book, version and license. The piece shows only the entry's own text; with none, it says so.
import { CHARACTER_PACK_ID, type EntityBase, type L10n, parseEntityId } from '@grimoire/schema';
import { type InstalledPack, installedPacks } from './packs';

/** Where an entry's text comes from. */
export type DescriptionSource =
  | {
      kind: 'pack';
      book: string;
      version: string;
      license: string;
      attribution?: string;
      page?: string;
    }
  /** A character's own entry: the person wrote it, or changed a pack's. */
  | { kind: 'own' }
  /** The pack the entry names as its source is not on the device (SPEC §8.2). */
  | { kind: 'notInstalled'; pack: string };

/** An entry's description, read and ready to show. */
export interface EntryDescription {
  name: string;
  summary?: string;
  text?: string;
  source: DescriptionSource;
}

/** The fields of an entity a description reads; every system's entities have them. */
export type Described = Pick<EntityBase, 'id' | 'name' | 'summary' | 'text' | 'source'>;

/** A text in `language`, else in English, else in any language it has. */
export function textIn(text: L10n, language: string): string {
  const known = text as Partial<Record<string, string>>;
  return (
    known[language] ?? text.en ?? Object.values(text).find((value) => value !== undefined) ?? ''
  );
}

function sourceOf(entity: Described, packs: readonly InstalledPack[], language: string) {
  if (parseEntityId(entity.id)?.pack === CHARACTER_PACK_ID) return { kind: 'own' } as const;
  const pack = packs.find((installed) => installed.pack.id === entity.source.pack)?.pack;
  if (pack === undefined) return { kind: 'notInstalled', pack: entity.source.pack } as const;
  const { attribution, spdx, name } = pack.license;
  return {
    kind: 'pack',
    book: entity.source.book ?? textIn(pack.title, language),
    version: pack.version,
    license: spdx ?? name,
    ...(attribution !== undefined && { attribution }),
    ...(entity.source.page !== undefined && { page: entity.source.page }),
  } as const;
}

/** What `entity`'s description shows, its source looked up among the packs on the device. */
export function descriptionOf(
  entity: Described,
  language: string,
  packs: readonly InstalledPack[] = installedPacks().packs,
): EntryDescription {
  return {
    name: textIn(entity.name, language),
    ...(entity.summary !== undefined && { summary: textIn(entity.summary, language) }),
    ...(entity.text !== undefined && { text: textIn(entity.text, language) }),
    source: sourceOf(entity, packs, language),
  };
}
