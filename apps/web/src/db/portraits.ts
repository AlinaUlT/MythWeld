// SHEET-56: the person's portrait lives in the `blobs` table on the device (ADR 005 item 10), as
// the row the character's `portraitBlobId` names: the picture's bytes and media type, and the
// token frame the person picked (ADR 015 item 6). A picture may be animated or a short video
// (ADR 015 item 2). Nothing here leaves the device. A row that does not read as a portrait reads
// as no picture and the default frame, never as an error (SPEC §8.2).
import type { BlobRow } from './db';

/** The frames of board V3-Token, each one slot of the token frame (ADR 015 item 6). */
export const PORTRAIT_FRAMES = ['thin', 'ring', 'double'] as const;
export type PortraitFrame = (typeof PORTRAIT_FRAMES)[number];

/** The frame of a token the person has not picked one for: the board's ring. */
export const DEFAULT_FRAME: PortraitFrame = 'ring';

/** The largest file taken, in bytes: 20 MB, room for a short video, not for a film. */
export const PORTRAIT_MAX_BYTES = 20 * 1024 * 1024;

/** The picture of a portrait row. */
export interface PortraitPicture {
  bytes: ArrayBuffer;
  /** The media type: `image/png`, `video/mp4`. */
  type: string;
}

/** What a portrait row holds, read leniently. */
export interface Portrait {
  frame: PortraitFrame;
  picture?: PortraitPicture;
}

function isFrame(value: unknown): value is PortraitFrame {
  return PORTRAIT_FRAMES.some((frame) => frame === value);
}

/** The portrait a blob row holds: its frame (the default when it names none) and its picture. */
export function portraitOfRow(row: BlobRow | undefined): Portrait {
  const frame = isFrame(row?.frame) ? row.frame : DEFAULT_FRAME;
  const bytes = row?.bytes;
  const type = row?.type;
  const picture =
    bytes instanceof ArrayBuffer && bytes.byteLength > 0 && typeof type === 'string'
      ? { bytes, type }
      : undefined;
  return { frame, ...(picture !== undefined && { picture }) };
}

/** Why a file is not taken as a portrait. */
export type PortraitFileRefusal = 'notMedia' | 'tooBig';

/** `undefined` when a file of this media `type` and `size` may be a portrait, else why not. */
export function checkPortraitFile(file: {
  type: string;
  size: number;
}): PortraitFileRefusal | undefined {
  if (!/^(image|video)\/[^\s/]+$/.test(file.type)) return 'notMedia';
  return file.size > PORTRAIT_MAX_BYTES ? 'tooBig' : undefined;
}

/** The picture is a video, not an image. */
export function isVideo(picture: Pick<PortraitPicture, 'type'>): boolean {
  return picture.type.startsWith('video/');
}
