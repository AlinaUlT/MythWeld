import 'fake-indexeddb/auto';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { copyCharacter, deleteCharacter } from '../src/db/characterActions';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import {
  PORTRAIT_MAX_BYTES,
  portraitRefusal,
  removePortrait,
  setPortrait,
  setTokenFrame,
} from '../src/db/portrait';
import '../src/i18n';
import { TokenFace } from '../src/sheet/header/Token';

// SHEET-56: golden B is the stored character; the files are the app's own, made here.
const b = fifthEditionCharacterSchema.parse(goldenB);
const png = new Blob(['a picture'], { type: 'image/png' });
const gif = new Blob(['an animated picture'], { type: 'image/gif' });
const at = '2026-10-29T12:00:00.000Z';

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-56-${count}`);
  await database.open();
  await saveCharacter(b, database.characters);
});

afterEach(async () => {
  await database.delete();
});

const portraitOf = async (id = b.id) => {
  const opened = await openCharacter(id, database.characters);
  return opened.ok ? opened.value.portraitBlobId : 'not opened';
};

describe('SHEET-56 portrait files', () => {
  it('takes the seven media types and refuses SVG, text and a file over 10 MB', () => {
    for (const type of [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/avif',
      'video/mp4',
      'video/webm',
    ]) {
      expect(portraitRefusal({ type, size: 1 })).toBeUndefined();
    }
    expect(portraitRefusal({ type: 'image/svg+xml', size: 1 })).toBe('type');
    expect(portraitRefusal({ type: 'text/plain', size: 1 })).toBe('type');
    expect(portraitRefusal({ type: 'image/png', size: PORTRAIT_MAX_BYTES })).toBeUndefined();
    expect(portraitRefusal({ type: 'image/png', size: PORTRAIT_MAX_BYTES + 1 })).toBe('size');
  });
});

describe('SHEET-56 storing a portrait', () => {
  it('stores the file with its frame and names it on the character, one revision on', async () => {
    const result = await setPortrait(b.id, png, 'double', at, database);
    expect(result.ok).toBe(true);
    const blobId = result.ok ? result.blobId : undefined;
    expect(blobId).toBeDefined();
    const row = await database.blobs.get(blobId as string);
    expect(row).toMatchObject({ id: blobId, type: 'image/png', frame: 'double' });
    expect(row?.data.size).toBe(png.size);
    const opened = await openCharacter(b.id, database.characters);
    expect(opened.ok && opened.value.portraitBlobId).toBe(blobId);
    expect(opened.ok && [opened.value.rev, opened.value.updatedAt]).toEqual([b.rev + 1, at]);
  });

  it('drops the old file when a new one replaces it', async () => {
    const first = await setPortrait(b.id, png, 'ring', at, database);
    const second = await setPortrait(b.id, gif, 'thin', at, database);
    expect(await database.blobs.count()).toBe(1);
    expect(first.ok && (await database.blobs.get(first.blobId as string))).toBeFalsy();
    expect(second.ok && (await portraitOf())).toBe(second.ok ? second.blobId : '');
  });

  it('refuses a bad file and a missing character, and writes nothing', async () => {
    const svg = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    expect(await setPortrait(b.id, svg, 'ring', at, database)).toMatchObject({
      ok: false,
      code: 'type',
    });
    const missing = '11111111-2222-4333-8444-555555555555';
    expect(await setPortrait(missing, png, 'ring', at, database)).toMatchObject({
      ok: false,
      code: 'notStored',
    });
    expect(await database.blobs.count()).toBe(0);
    expect(await portraitOf()).toBeUndefined();
  });

  it('changes the frame of the stored file only', async () => {
    const stored = await setPortrait(b.id, png, 'ring', at, database);
    await setTokenFrame(b.id, 'thin', database);
    expect(await database.blobs.get(stored.ok ? (stored.blobId as string) : '')).toMatchObject({
      frame: 'thin',
    });
    const opened = await openCharacter(b.id, database.characters);
    expect(opened.ok && opened.value.rev).toBe(b.rev + 1);
  });

  it('removes the portrait: the field and the file go, nothing else', async () => {
    await setPortrait(b.id, png, 'ring', at, database);
    expect(await removePortrait(b.id, at, database)).toEqual({ ok: true, blobId: undefined });
    expect(await portraitOf()).toBeUndefined();
    expect(await database.blobs.count()).toBe(0);
    expect(await removePortrait(b.id, at, database)).toEqual({ ok: true, blobId: undefined });
  });

  it('is copied with the frame, and deleted with its character (SHEET-25)', async () => {
    const stored = await setPortrait(b.id, png, 'double', at, database);
    const copied = await copyCharacter(b.id, 'Copy', at, database);
    const copyBlob = copied.ok ? copied.value.portraitBlobId : undefined;
    expect(copyBlob).toBeDefined();
    expect(copyBlob).not.toBe(stored.ok ? stored.blobId : '');
    expect(await database.blobs.get(copyBlob as string)).toMatchObject({
      type: 'image/png',
      frame: 'double',
    });
    await deleteCharacter(b.id, database);
    expect(await database.blobs.count()).toBe(1);
  });
});

describe('SHEET-56 the token', () => {
  const html = (props: Partial<Parameters<typeof TokenFace>[0]>) =>
    renderToStaticMarkup(<TokenFace name="Iren" face="size-10.5" {...props} />);

  it('shows the first letter in the ring frame until there is a picture', () => {
    const out = html({});
    expect(out).toContain('data-skin-slot="token-frame-ring"');
    expect(out).toContain('data-skin-slot="portrait"');
    expect(out).toContain('>I<');
    expect(out).not.toContain('<img');
  });

  it('draws a picture or a video round in the frame picked', () => {
    const picture = html({ media: { url: 'blob:p', video: false }, frame: 'double' });
    expect(picture).toContain('data-skin-slot="token-frame-double"');
    expect(picture).toContain('<img src="blob:p"');
    expect(picture).toContain('rounded-full');
    expect(picture).not.toContain('>I<');
    const video = html({ media: { url: 'blob:v', video: true }, frame: 'thin' });
    expect(video).toContain('data-skin-slot="token-frame-thin"');
    expect(video).toContain('<video src="blob:v"');
  });
});
