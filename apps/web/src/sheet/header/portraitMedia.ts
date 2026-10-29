// SHEET-56: a portrait's picture or video as the screen draws it. A stored blob becomes an object
// URL while it is shown, and is freed after. CSS cannot stop an animated picture or a video, so
// while `motionIsStill()` is true an animated picture is drawn once to a canvas and shows that
// frame, and a video is left at its first frame, paused (SHEET-05).
import { liveQuery } from 'dexie';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { db, type TokenFrame } from '../../db/db';
import { motionIsStill } from '../../theme/motions';

/** What a token draws: the file, as a URL, and whether it is a video. */
export interface Media {
  url: string;
  video: boolean;
}

/** The frame a token wears until the person picks one. */
export const DEFAULT_FRAME: TokenFrame = 'ring';

/** What is stored for a portrait: its file and the token's frame. */
export interface StoredPortrait {
  data: Blob;
  type: string;
  frame: TokenFrame;
}

function subscribeStill(onChange: () => void): () => void {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const watch = new MutationObserver(onChange);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  query.addEventListener('change', onChange);
  return () => {
    watch.disconnect();
    query.removeEventListener('change', onChange);
  };
}

/** Whether motion is stopped now; it follows the app's switch and the phone's setting. */
export function useMotionStill(): boolean {
  return useSyncExternalStore(
    subscribeStill,
    () => motionIsStill(),
    () => false,
  );
}

/** The stored portrait `blobId`, watched; `undefined` while it reads or when none is stored. */
export function useStoredPortrait(blobId: string | undefined): StoredPortrait | undefined {
  const [stored, setStored] = useState<StoredPortrait | undefined>(undefined);
  useEffect(() => {
    setStored(undefined);
    if (blobId === undefined) return;
    const watched = liveQuery(() => db.blobs.get(blobId)).subscribe({
      next: (row) =>
        setStored(
          row?.data === undefined
            ? undefined
            : { data: row.data, type: row.type, frame: row.frame ?? DEFAULT_FRAME },
        ),
      error: (error: unknown) => console.error(error),
    });
    return () => watched.unsubscribe();
  }, [blobId]);
  return stored;
}

/** One frame of an animated picture, as a PNG file; the picture itself when it cannot be drawn. */
async function stillOf(data: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(data);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise<Blob>((done) =>
      canvas.toBlob((png) => done(png ?? data), 'image/png'),
    );
  } catch {
    return data;
  }
}

/** The URL to draw `file`, still when `still`; `undefined` until it is ready. */
export function useMedia(file: Blob | undefined, still: boolean): Media | undefined {
  const [media, setMedia] = useState<Media | undefined>(undefined);
  useEffect(() => {
    setMedia(undefined);
    if (file === undefined) return;
    const video = file.type.startsWith('video/');
    let url: string | undefined;
    let gone = false;
    (async () => {
      const shown = still && !video ? await stillOf(file) : file;
      if (gone) return;
      url = URL.createObjectURL(shown);
      setMedia({ url, video });
    })();
    return () => {
      gone = true;
      if (url !== undefined) URL.revokeObjectURL(url);
    };
  }, [file, still]);
  return media;
}
