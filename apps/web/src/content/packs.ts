// SHEET-09: the packs on the device open at start, each through its system's pack opener, and a
// character's content index loads the ones the character names, in its order (ENG-25). A pack a
// character names that is not on the device is named once, in `notInstalled`, so the sheet can say
// which pack is missing, not only `Missing: <id>` on each of its entries (SPEC §8.2). Where a pack
// came from is the app's to say, never the file's (ADR 003 item 7): built-in is `BUILT_IN_PACKS`.
import { BUILT_IN_PACKS } from '@grimoire/content';
import { type LoadedContent, loadContentIndex } from '@grimoire/engine';
import type { Opened } from '@grimoire/schema';
import { type AppPack, packOpenerOf } from '../systems';

/** Where an installed pack came from. Local and community packs come with their phases. */
export type PackOrigin = 'builtIn';

/** A pack on the device, opened at the current versions. */
export interface InstalledPack {
  origin: PackOrigin;
  pack: AppPack;
}

/** A pack file whose `system` names no system the app carries. */
export interface UnknownPackSystem {
  ok: false;
  code: 'unknownSystem';
  system: unknown;
  message: string;
}

/** A pack file that did not open: the frame's answer, or a system the app does not carry. */
export type UnopenedPack = Exclude<Opened<AppPack>, { ok: true }> | UnknownPackSystem;

/** The packs on the device, and the files that did not open. */
export interface InstalledPacks {
  packs: readonly InstalledPack[];
  unopened: readonly UnopenedPack[];
}

/** An entry of any pack the app carries. */
export type AppEntity = AppPack['entities'][number];

/** A character's content: the loaded index, and the packs it names that are not on the device. */
export interface CharacterContent extends LoadedContent<AppEntity> {
  notInstalled: readonly string[];
}

/** Runs a pack file through the opener of the system it names. */
function openPackFile(file: unknown): Opened<AppPack> | UnknownPackSystem {
  const system =
    typeof file === 'object' && file !== null
      ? (file as Record<string, unknown>).system
      : undefined;
  const open = packOpenerOf(system);
  if (open === undefined) {
    return {
      ok: false,
      code: 'unknownSystem',
      system,
      message: `The pack's system ${JSON.stringify(system)} is not one this app carries.`,
    };
  }
  return open(file);
}

/** Opens the built-in pack files. Pure: the files are read, never changed. */
export function installBuiltInPacks(files: readonly unknown[] = BUILT_IN_PACKS): InstalledPacks {
  const packs: InstalledPack[] = [];
  const unopened: UnopenedPack[] = [];
  for (const file of files) {
    const opened = openPackFile(file);
    if (opened.ok) packs.push({ origin: 'builtIn', pack: opened.value });
    else unopened.push(opened);
  }
  return { packs, unopened };
}

let installed: InstalledPacks = { packs: [], unopened: [] };

/** Opens the packs on the device; the app calls it once, at start. */
export function startPacks(): InstalledPacks {
  installed = installBuiltInPacks();
  return installed;
}

/** The packs `startPacks` opened. */
export function installedPacks(): InstalledPacks {
  return installed;
}

/**
 * Loads the packs `character` names, in its order, into its content index. A named pack not on
 * the device is left out and listed in `notInstalled`; its entries look up as `missing`.
 */
export function contentOf(
  character: { readonly system: string; readonly packs: readonly string[] },
  packs: readonly InstalledPack[] = installed.packs,
): CharacterContent {
  const toLoad: AppPack[] = [];
  const notInstalled: string[] = [];
  for (const id of character.packs) {
    const found = packs.find((installedPack) => installedPack.pack.id === id);
    if (found === undefined) notInstalled.push(id);
    else toLoad.push(found.pack);
  }
  return { ...loadContentIndex(character.system, toLoad), notInstalled };
}
