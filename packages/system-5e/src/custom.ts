import {
  type ActionResult,
  type ContentIndex,
  changeTo,
  copyJson,
  type JsonValue,
  type LogStamp,
  withDropped,
} from '@grimoire/engine';
import { CHARACTER_PACK_ID, entityIdSchema } from '@grimoire/schema';
import { INVENTORY_PATH, isWhole, settled, type Unchanged } from './actions';
import type { FifthEditionCharacter } from './character';
import type { FifthEditionEntity } from './entity-types';
import { fifthEditionModule } from './module';

// SHEET-52: the things a person writes in edit mode as free text (ADR 009 item 7, SPEC §12 stage 2;
// with effects they are phase 5's). A custom item is a row of the inventory with `custom` in place
// of an item of a pack: its name, its weight in pounds (SPEC §7.5) and its text in the row's
// `note`. A custom feature is an entity of the character's own (`localEntities`, pack
// `character`), a feat with a name and text and no effect, named in `systemData.feats` so the
// Features tab lists it under the feats. Each is one entry; reversing it takes it away. Removing a
// custom feature ends with `withDropped` (SHEET-22), as any removal of an entity does. Removing a
// custom item is `removeRow`'s.

/** What a custom item is asked: its row's own id (the app makes it), name, weight, count, text. */
export interface CustomItemAsk {
  readonly uid: string;
  readonly name: string;
  /** One item's weight in pounds, when it has one. */
  readonly weight?: number | undefined;
  /** How many: a whole number from 1. */
  readonly qty: number;
  /** The item's own words. */
  readonly text?: string | undefined;
}

/** What a custom feature is asked: the slug of its id (the app makes it), name and text. */
export interface CustomFeatureAsk {
  readonly slug: string;
  readonly name: string;
  readonly text?: string | undefined;
}

/** Why a custom entry was refused. `code` and its data are for the screen. */
export type CustomRefusal = { message: string } & (
  | { code: 'noName' }
  | { code: 'badWeight'; weight: number }
  | { code: 'badQuantity'; qty: number }
  | { code: 'idUsed'; id: string }
  | { code: 'badId'; id: string }
  | { code: 'noFeature'; id: string }
);

type Row = FifthEditionCharacter['systemData']['inventory'][number];
type Result = ActionResult<FifthEditionCharacter, CustomRefusal | Unchanged>;

/** Text that shows a character, trimmed; none when it shows nothing. */
function visible(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/** The id of the custom feature with `slug`. */
export function customFeatureId(slug: string): string {
  return `${CHARACTER_PACK_ID}:feat/${slug}`;
}

/** Puts a row of free text at the end of the inventory. */
export function addCustomItem(
  character: FifthEditionCharacter,
  ask: CustomItemAsk,
  stamp: LogStamp,
): Result {
  const name = visible(ask.name);
  if (name === undefined) return { ok: false, code: 'noName', message: 'An item needs a name.' };
  const { weight } = ask;
  if (weight !== undefined && !(Number.isFinite(weight) && weight > 0)) {
    return {
      ok: false,
      code: 'badWeight',
      weight,
      message: `${weight} is not a weight: a number above 0.`,
    };
  }
  if (!isWhole(ask.qty, 1)) {
    return {
      ok: false,
      code: 'badQuantity',
      qty: ask.qty,
      message: `${ask.qty} is not a whole number of items from 1.`,
    };
  }
  const text = visible(ask.text);
  const row: Row = {
    uid: ask.uid,
    custom: { name, ...(weight !== undefined && { weight }) },
    qty: ask.qty,
    equipped: false,
    attuned: false,
    ...(text !== undefined && { note: text }),
  };
  const rows = listOf([...character.systemData.inventory, row]);
  return settled<CustomRefusal>(
    character,
    stamp,
    {
      action: 'addItem',
      subject: name,
      label: { en: name },
      changes: [changeTo(character, INVENTORY_PATH, rows)],
    },
    'The inventory changes nothing.',
  );
}

/** A list as the log holds it: plain JSON, a copy. */
function listOf(list: readonly unknown[]): JsonValue {
  return copyJson(list) as JsonValue;
}

/** The paths of the two lists a custom feature is written in. */
const LOCAL_ENTITIES_PATH = ['localEntities'];
const FEATS_PATH = ['systemData', 'feats'];

/** Gives the character a feat of its own: a name and text, no effect. */
export function addCustomFeature(
  character: FifthEditionCharacter,
  ask: CustomFeatureAsk,
  stamp: LogStamp,
): Result {
  const name = visible(ask.name);
  if (name === undefined) return { ok: false, code: 'noName', message: 'A feature needs a name.' };
  const id = customFeatureId(ask.slug);
  if (!entityIdSchema.safeParse(id).success) {
    return { ok: false, code: 'badId', id, message: `"${id}" is not an entity id.` };
  }
  if (
    character.localEntities.some((each) => each.id === id) ||
    character.systemData.feats.some((each) => each.id === id)
  ) {
    return { ok: false, code: 'idUsed', id, message: `The character already has "${id}".` };
  }
  const text = visible(ask.text);
  const entity = {
    id,
    type: 'feat',
    ruleset: 'any',
    name: { en: name },
    ...(text !== undefined && { text: { en: text } }),
    source: { pack: CHARACTER_PACK_ID },
  } as FifthEditionEntity;
  return settled<CustomRefusal>(
    character,
    stamp,
    {
      action: 'addFeature',
      subject: id,
      label: { en: name },
      changes: [
        changeTo(character, LOCAL_ENTITIES_PATH, listOf([...character.localEntities, entity])),
        changeTo(character, FEATS_PATH, listOf([...character.systemData.feats, { id }])),
      ],
    },
    'The features change nothing.',
  );
}

/**
 * Takes a feat of the character's own away, from both lists, and what it kept that no longer
 * applies goes with it (`withDropped`).
 */
export function removeCustomFeature(
  character: FifthEditionCharacter,
  index: ContentIndex<FifthEditionEntity>,
  ask: { readonly id: string },
  stamp: LogStamp,
): Result {
  const { id } = ask;
  const found = character.localEntities.find((each) => each.id === id);
  if (found === undefined || !character.systemData.feats.some((each) => each.id === id)) {
    return {
      ok: false,
      code: 'noFeature',
      id,
      message: `"${id}" is not a feat of the character's own.`,
    };
  }
  return withDropped(
    character,
    settled<CustomRefusal>(
      character,
      stamp,
      {
        action: 'removeFeature',
        subject: id,
        label: found.name,
        changes: [
          changeTo(
            character,
            LOCAL_ENTITIES_PATH,
            listOf(character.localEntities.filter((each) => each.id !== id)),
          ),
          changeTo(
            character,
            FEATS_PATH,
            listOf(character.systemData.feats.filter((each) => each.id !== id)),
          ),
        ],
      },
      'The features change nothing.',
    ),
    index,
    fifthEditionModule,
  );
}
