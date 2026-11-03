import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { copyCharacter, deleteCharacter } from '../src/db/characterActions';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import {
  checkPortraitFile,
  DEFAULT_FRAME,
  isVideo,
  PORTRAIT_FRAMES,
  PORTRAIT_MAX_BYTES,
  portraitOfRow,
} from '../src/db/portraits';
import i18n from '../src/i18n';
import { PortraitView } from '../src/shared/Portrait';
import { currentToast, hideToast, undoToast } from '../src/shared/undo';
import { FRAME_SLOTS, TokenFace, TokenPanel } from '../src/sheet/panels/TokenPanel';
import { savePortrait } from '../src/sheet/portrait';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { type AppCharacter, sheetSystemOf } from '../src/systems';

// SHEET-56: golden B of SPEC §6.7 holds no portrait. The pictures are the tests' own bytes: a
// picture's content is never read, so any bytes with a media type stand for one.

const b: AppCharacter = fifthEditionCharacterSchema.parse(goldenB);
const t = i18n.getFixedT('en', 'token');
const bytes = () => new Uint8Array([137, 80, 78, 71, 1, 2, 3]).buffer;
const png = { bytes: bytes(), type: 'image/png' };
const now = '2026-11-03T14:00:00.000Z';

describe('SHEET-56 the portrait row', () => {
  it('reads a row as its frame and its picture', () => {
    expect(
      portraitOfRow({
        id: 'x',
        kind: 'portrait',
        frame: 'double',
        bytes: png.bytes,
        type: 'image/png',
      }),
    ).toEqual({ frame: 'double', picture: png });
  });

  it('reads a row with no picture, or no row, as the default frame and no picture', () => {
    expect(DEFAULT_FRAME).toBe('ring');
    expect(portraitOfRow(undefined)).toEqual({ frame: 'ring' });
    expect(portraitOfRow({ id: 'x', frame: 'thin' })).toEqual({ frame: 'thin' });
  });

  it('never throws on a row it does not read: an unknown frame, bytes that are text', () => {
    // The SHEET-25 tests store `bytes: 'the portrait'`.
    const odd = portraitOfRow({
      id: 'x',
      frame: 'gold',
      bytes: 'the portrait' as never,
      type: 'image/png',
    });
    expect(odd).toEqual({ frame: 'ring' });
  });

  it('has the three frames of board V3-Token, each its own slot', () => {
    expect(PORTRAIT_FRAMES).toEqual(['thin', 'ring', 'double']);
    expect(FRAME_SLOTS).toEqual({
      thin: 'token-frame-thin',
      ring: 'token-frame-ring',
      double: 'token-frame-double',
    });
  });

  it('takes an image or a video up to 20 MB, and refuses anything else', () => {
    expect(PORTRAIT_MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(checkPortraitFile({ type: 'image/gif', size: 1000 })).toBeUndefined();
    expect(checkPortraitFile({ type: 'video/mp4', size: PORTRAIT_MAX_BYTES })).toBeUndefined();
    expect(checkPortraitFile({ type: 'video/mp4', size: PORTRAIT_MAX_BYTES + 1 })).toBe('tooBig');
    expect(checkPortraitFile({ type: 'application/pdf', size: 10 })).toBe('notMedia');
    expect(checkPortraitFile({ type: '', size: 10 })).toBe('notMedia');
    expect(isVideo({ type: 'video/webm' })).toBe(true);
    expect(isVideo({ type: 'image/webp' })).toBe(false);
  });
});

describe('SHEET-56 drawing the portrait', () => {
  const draw = (node: ReactElement) => renderToStaticMarkup(node);

  it('draws the first letter of the name until there is a picture', () => {
    const html = draw(<PortraitView name="golden B" className="size-10" />);
    expect(html).toContain('>G</span>');
    expect(html).not.toContain('<img');
  });

  it('draws an image as a picture named for the character, a video as a silent loop', () => {
    const image = draw(
      <PortraitView name="Golden B" className="size-10" source={{ url: 'blob:a', video: false }} />,
    );
    expect(image).toContain('<img src="blob:a"');
    expect(image).toContain(`alt="${t('alt', { name: 'Golden B' })}"`);
    const video = draw(
      <PortraitView name="Golden B" className="size-10" source={{ url: 'blob:v', video: true }} />,
    );
    expect(video).toContain('<video src="blob:v#t=0.001"');
    expect(video).toContain('autoPlay');
    expect(video).toMatch(/loop/);
    expect(video).toMatch(/muted/);
  });

  it('shows one frame while motion is stopped: a canvas for an image, a paused video', () => {
    const image = draw(
      <PortraitView name="G" className="size-10" source={{ url: 'blob:a', video: false }} still />,
    );
    expect(image).toContain('<canvas');
    expect(image).not.toContain('<img');
    const video = draw(
      <PortraitView name="G" className="size-10" source={{ url: 'blob:v', video: true }} still />,
    );
    expect(video).toContain('<video');
    expect(video).not.toContain('autoPlay');
  });

  it('puts the token in the slot of its frame', () => {
    for (const frame of PORTRAIT_FRAMES) {
      const html = draw(<TokenFace name="G" frame={frame} className="size-10" />);
      expect(html).toContain(`data-skin-slot="${FRAME_SLOTS[frame]}"`);
    }
  });

  it('draws the panel: title, choose button, the note, three frames, "Use as token"', () => {
    const system = sheetSystemOf(b);
    if (system === undefined) throw new Error('no sheet');
    const content = contentOf(b, installBuiltInPacks().packs);
    const sheet: SheetValue = {
      character: b,
      content,
      computed: compute(b, content.index, system.module),
      system,
      editing: false,
      roll: () => {},
      breakdown: () => {},
    };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SheetContext value={sheet}>
          <TokenPanel onClose={() => {}} />
        </SheetContext>
      </MemoryRouter>,
    );
    expect(html).toContain(`>${t('title')}</h2>`);
    expect(html).toContain(t('choose', { name: 'Golden B' }));
    expect(html).toContain(t('stays'));
    for (const frame of PORTRAIT_FRAMES) expect(html).toContain(t(`frames.${frame}`));
    expect(html).toContain(`>${t('use')}</button>`);
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).toContain('checked=""');
  });
});

describe('SHEET-56 storing the portrait', () => {
  let database: GrimoireDb;
  let count = 0;

  beforeEach(async () => {
    count += 1;
    database = new GrimoireDb(`sheet-56-${count}`);
    await database.open();
    await saveCharacter(b, database.characters);
  });

  afterEach(async () => {
    const toast = currentToast();
    if (toast !== undefined) hideToast(toast);
    await database.delete();
  });

  async function stored() {
    const opened = await openCharacter(b.id, database.characters);
    if (!opened.ok) throw new Error('does not open');
    return opened.value;
  }

  it('makes the row and names it in the character, with the "Portrait set" toast and Undo', async () => {
    const saved = await savePortrait(b.id, { frame: 'double', picture: png }, database, now);
    if (!saved.ok) throw new Error('not saved');
    const character = await stored();
    expect(character.portraitBlobId).toBe(saved.id);
    expect(portraitOfRow(await database.blobs.get(saved.id))).toEqual({
      frame: 'double',
      picture: png,
    });
    expect((await database.blobs.get(saved.id))?.kind).toBe('portrait');
    const toast = currentToast();
    if (toast === undefined) throw new Error('no toast');
    expect(toast.kind === 'changed' && toast.entry.action).toBe('setPortrait');
    expect(i18n.getFixedT('en', 'toast')('done.setPortrait')).toBe('Portrait set');
    await undoToast(toast, now, database);
    expect((await stored()).portraitBlobId).toBeUndefined();
  });

  it('replaces the picture and the frame in place: same row, no new toast', async () => {
    const first = await savePortrait(b.id, { frame: 'thin', picture: png }, database, now);
    if (!first.ok) throw new Error('not saved');
    const toast = currentToast();
    if (toast !== undefined) hideToast(toast);
    const gif = { bytes: bytes(), type: 'image/gif' };
    const second = await savePortrait(b.id, { frame: 'ring', picture: gif }, database, now);
    expect(second).toEqual({ ok: true, id: first.id });
    expect(portraitOfRow(await database.blobs.get(first.id))).toEqual({
      frame: 'ring',
      picture: gif,
    });
    expect(currentToast()).toBeUndefined();
    expect(await database.blobs.count()).toBe(1);
  });

  it('keeps the picture when only the frame is chosen', async () => {
    const first = await savePortrait(b.id, { frame: 'ring', picture: png }, database, now);
    if (!first.ok) throw new Error('not saved');
    await savePortrait(b.id, { frame: 'double' }, database, now);
    expect(portraitOfRow(await database.blobs.get(first.id))).toEqual({
      frame: 'double',
      picture: png,
    });
  });

  it('makes a row with a frame and no picture, when a frame is chosen first', async () => {
    const saved = await savePortrait(b.id, { frame: 'thin' }, database, now);
    if (!saved.ok) throw new Error('not saved');
    expect(portraitOfRow(await database.blobs.get(saved.id))).toEqual({ frame: 'thin' });
  });

  it('refuses a character that is not stored, and writes no row', async () => {
    const result = await savePortrait(
      '00000000-0000-4000-8000-00000000dead',
      { frame: 'ring' },
      database,
    );
    expect(result).toMatchObject({ ok: false, code: 'notFound' });
    expect(await database.blobs.count()).toBe(0);
  });

  it('copies the picture and the frame with Copy, and drops them with Delete (SHEET-25)', async () => {
    const saved = await savePortrait(b.id, { frame: 'double', picture: png }, database, now);
    if (!saved.ok) throw new Error('not saved');
    const copied = await copyCharacter(b.id, 'Golden B (copy)', now, database);
    if (!copied.ok) throw new Error('not copied');
    const copy = await openCharacter(copied.value.id, database.characters);
    if (!copy.ok || copy.value.portraitBlobId === undefined) throw new Error('no portrait copied');
    expect(copy.value.portraitBlobId).not.toBe(saved.id);
    expect(portraitOfRow(await database.blobs.get(copy.value.portraitBlobId))).toEqual({
      frame: 'double',
      picture: png,
    });
    await deleteCharacter(copied.value.id, database);
    expect(await database.blobs.get(copy.value.portraitBlobId)).toBeUndefined();
    expect(await database.blobs.get(saved.id)).toBeDefined();
  });
});
