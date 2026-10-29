import type { Computed } from '@grimoire/engine';
import type { FifthEditionCharacter } from './character';
import { PROF_PATH } from './checks';
import { classesOf } from './classes';
import type { FifthEditionEntity } from './entity-types';
import type { ListLinePart } from './list-line';

// SHEET-30: what the sheet's pinned header names for a fifth-edition character (board `V3-Sheet`,
// BRIEF P4, ADR 013 items 1 and 2): each class with its level, the paths of the stats row, each
// casting class's ability with its spell save DC and spell attack (ADR 009 item 4), and the hit
// points of the dock. The screen reads every number from `Computed` at these paths.

/** How the screen writes a header number: as it is, with its sign, or as a distance in feet. */
export type HeaderNumberFormat = 'plain' | 'signed' | 'distance';

/** A number of the header's stats row: its label's key, its computed path, how it is written. */
export interface HeaderNumber {
  key: 'ac' | 'init' | 'speed' | 'prof' | 'passive';
  path: string;
  format: HeaderNumberFormat;
  /** A tap rolls it (SHEET-39). */
  rolls?: true;
}

/** The skill whose passive value the header shows: passive Perception (both SRDs). */
export const HEADER_PASSIVE_SKILL = 'perception';

/** The stats row, left to right, as board `V3-Sheet` draws it. */
export const FIFTH_EDITION_HEADER_NUMBERS: readonly HeaderNumber[] = [
  { key: 'ac', path: 'ac.total', format: 'plain' },
  { key: 'init', path: 'init.total', format: 'signed', rolls: true },
  { key: 'speed', path: 'speed.walk', format: 'distance' },
  { key: 'prof', path: PROF_PATH, format: 'signed' },
  { key: 'passive', path: `skills.${HEADER_PASSIVE_SKILL}.passive`, format: 'plain' },
];

/** Each class with its level, in the order taken: the level the sheet shows (ADR 013 item 2). */
export function fifthEditionClassLine({
  systemData,
}: Pick<FifthEditionCharacter, 'systemData'>): ListLinePart[] {
  return systemData.classes.map(({ id, level }) => ({ id, level }));
}

/** A casting class's spellcasting at a glance: its stat's key, and the paths of its DC and attack. */
export interface HeaderCasting {
  /** The class's id. */
  source: string;
  /** The key of the stat it casts with. */
  ability: string;
  dc: string;
  attack: string;
}

/**
 * Each class that casts now, in the order taken: a class the spellcasting steps gave a DC to
 * (ENG-15), with the stat of its own spellcasting, else of its subclass's.
 */
export function fifthEditionCasting(
  character: FifthEditionCharacter,
  computed: Computed<FifthEditionEntity>,
): HeaderCasting[] {
  return classesOf(character, computed).flatMap(({ entity, subclass }) => {
    const path = `classes.${entity.key}.spell`;
    const def = entity.spellcasting ?? subclass?.spellcasting;
    if (def === undefined || !Object.hasOwn(computed.values, `${path}.dc`)) return [];
    return [
      { source: entity.id, ability: def.ability, dc: `${path}.dc`, attack: `${path}.attack` },
    ];
  });
}

/** The dock's hit points: the stored current and temporary ones, and the path of the maximum. */
export interface HeaderHitPoints {
  current: number;
  temp: number;
  maxPath: string;
}

export function fifthEditionHitPoints({
  systemData,
}: Pick<FifthEditionCharacter, 'systemData'>): HeaderHitPoints {
  const { current, temp } = systemData.state.hp;
  return { current, temp, maxPath: 'hp.max' };
}
