import 'fake-indexeddb/auto';
import { compute } from '@grimoire/engine';
import { fifthEditionCharacterSchema } from '@grimoire/system-5e';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goldenA } from '../../../packages/system-5e/test/golden/characters-2014.ts';
import { goldenB } from '../../../packages/system-5e/test/golden/characters-2024.ts';
import { contentOf, installBuiltInPacks } from '../src/content/packs';
import { openCharacter, saveCharacter } from '../src/db/characters';
import { GrimoireDb } from '../src/db/db';
import {
  clearPortrait,
  PORTRAIT_MAX_BYTES,
  portraitKind,
  readPortrait,
  refusalFor,
  setPortrait,
} from '../src/db/portraits';
import i18n from '../src/i18n';
import { Token } from '../src/sheet/header/Token';
import { PortraitPanel } from '../src/sheet/panels/PortraitPanel';
import { SheetContext, type SheetValue } from '../src/sheet/SheetContext';
import { sheetSystemOf } from '../src/systems';
import { watchMotionStill } from '../src/theme/motions';

// SHEET-56: the portrait on the device. Golden A and golden B of SPEC §6.7 are the stored
// characters; the picture files are small blobs made here. What a browser draws (a picture cut
// round, a still frame, a video) is proved in `e2e/portrait.spec.ts`.

const a = fifthEditionCharacterSchema.parse(goldenA);
const b = fifthEditionCharacterSchema.parse(goldenB);
const at = '2026-10-30T12:00:00.000Z';
const picture = (type = 'image/webp', size = 8) => new Blob([new Uint8Array(size)], { type });
const t = i18n.getFixedT('en', 'token');

let database: GrimoireDb;
let count = 0;

beforeEach(async () => {
  count += 1;
  database = new GrimoireDb(`sheet-56-${count}`);
  await database.open();
  await saveCharacter(a, database.characters);
  await saveCharacter(b, database.characters);
});

afterEach(async () => {
  await database.delete();
});

describe('SHEET-56 what a portrait file may be', () => {
  it('takes a picture or a video by its media type, and nothing else', () => {
    expect(portraitKind('image/png')).toBe('image');
    expect(portraitKind('image/gif')).toBe('image');
    expect(portraitKind('video/mp4')).toBe('video');
    expect(portraitKind('application/pdf')).toBeUndefined();
    expect(portraitKind('')).toBeUndefined();
  });

  it('refuses a file that is no picture or video, and one over 10 MB', () => {
    expect(refusalFor(picture('text/plain'))).toEqual({ ok: false, code: 'notMedia' });
    expect(refusalFor(picture('image/png', PORTRAIT_MAX_BYTES + 1))).toEqual({
      ok: false,
      code: 'tooBig',
    });
    expect(refusalFor(picture('video/webm', PORTRAIT_MAX_BYTES))).toBeUndefined();
    expect(PORTRAIT_MAX_BYTES).toBe(10_485_760);
  });
});

describe('SHEET-56 setting and clearing a portrait', () => {
  it('keeps the file in the blobs table and names it on the character, one revision on', async () => {
    const saved = await setPortrait(a.id, picture('video/mp4', 12), at, database);
    if (!saved.ok) throw new Error('not saved');
    const id = saved.value.portraitBlobId as string;
    expect(saved.value.rev).toBe(a.rev + 1);
    expect(saved.value.updatedAt).toBe(at);
    const row = await readPortrait(id, database);
    expect(row?.type).toBe('video/mp4');
    expect(row?.data.size).toBe(12);
    expect((await openCharacter(a.id, database.characters)).ok).toBe(true);
    expect(await database.blobs.count()).toBe(1);
  });

  it('drops the file it replaces, and keeps one another character names too', async () => {
    const first = await setPortrait(a.id, picture(), at, database);
    if (!first.ok) throw new Error('not saved');
    const old = first.value.portraitBlobId as string;
    await saveCharacter({ ...b, portraitBlobId: old }, database.characters);
    const second = await setPortrait(a.id, picture('image/png'), at, database);
    if (!second.ok) throw new Error('not saved');
    expect(second.value.portraitBlobId).not.toBe(old);
    expect(await database.blobs.get(old)).toBeDefined();
    const third = await setPortrait(b.id, picture('image/gif'), at, database);
    expect(third.ok).toBe(true);
    expect(await database.blobs.get(old)).toBeUndefined();
    expect(await database.blobs.count()).toBe(2);
  });

  it('writes nothing for a refused file or a character that is not stored', async () => {
    const refused = await setPortrait(a.id, picture('text/plain'), at, database);
    expect(refused).toEqual({ ok: false, code: 'notMedia' });
    const missing = await setPortrait(
      '00000000-0000-4000-8000-000000000001',
      picture(),
      at,
      database,
    );
    expect(missing.ok === false && 'code' in missing && missing.code).toBe('notFound');
    expect(await database.blobs.count()).toBe(0);
    const stored = await openCharacter(a.id, database.characters);
    expect(stored.ok && stored.value.rev).toBe(a.rev);
  });

  it('takes the portrait off, one revision on, and drops its file', async () => {
    await setPortrait(a.id, picture(), at, database);
    const cleared = await clearPortrait(a.id, '2026-10-30T13:00:00.000Z', database);
    if (!cleared.ok) throw new Error('not cleared');
    expect(cleared.value.portraitBlobId).toBeUndefined();
    expect(cleared.value.rev).toBe(a.rev + 2);
    expect(await database.blobs.count()).toBe(0);
  });

  it('clears nothing when there is no portrait, and reads a missing blob as none', async () => {
    const same = await clearPortrait(a.id, at, database);
    expect(same.ok && same.value.rev).toBe(a.rev);
    expect(await readPortrait('0f1e2d3c-4b5a-4697-8877-665544332211', database)).toBeUndefined();
  });
});

describe('SHEET-56 the token and its panel', () => {
  const packs = installBuiltInPacks().packs;
  const sheet: SheetValue = (() => {
    const system = sheetSystemOf(b);
    if (system === undefined) throw new Error('no sheet');
    const content = contentOf(b, packs);
    return {
      character: b,
      content,
      computed: compute(b, content.index, system.module),
      system,
      editing: false,
      roll: () => {},
      breakdown: () => {},
    };
  })();
  const draw = (node: ReactNode) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <SheetContext value={sheet}>{node}</SheetContext>
      </MemoryRouter>,
    );

  it('shows the first letter in a button that opens the panel, while there is no file', () => {
    const html = draw(<Token onPortrait={() => {}} />);
    expect(html).toContain(`aria-label="${t('open')}"`);
    expect(html).toContain('data-skin-slot="token-frame-ring"');
    expect(html).toContain('>G</span>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<video');
  });

  it('says what the board says: the image, where it stays, the token and its button', () => {
    const html = draw(<PortraitPanel onClose={() => {}} />);
    expect(html).toContain('>Portrait</h1>');
    expect(html).toContain('Choose an image of Golden B');
    expect(html).toContain('stays on this device');
    expect(html).toContain('accept="image/*,video/*"');
    expect(html).toContain('>Use as token</button>');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain(t('remove'));
  });
});

describe('SHEET-56 watching the motion switch', () => {
  it('tells when the phone setting or the app switch changes, and stops when told to', () => {
    const calls: string[] = [];
    const query = new EventTarget();
    let observed: (() => void) | undefined;
    let off = false;
    const win = {
      matchMedia: () => query,
      document: { documentElement: {} },
      MutationObserver: class {
        constructor(onChange: () => void) {
          observed = onChange;
        }
        observe() {}
        disconnect() {
          off = true;
        }
      },
    } as unknown as Window & typeof globalThis;
    const stop = watchMotionStill(() => calls.push('changed'), win);
    query.dispatchEvent(new Event('change'));
    observed?.();
    expect(calls).toEqual(['changed', 'changed']);
    stop();
    query.dispatchEvent(new Event('change'));
    expect(calls).toHaveLength(2);
    expect(off).toBe(true);
  });
});
