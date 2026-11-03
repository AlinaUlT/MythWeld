// SHEET-56: a character's portrait, cut round: the person's picture, or its first letter until
// there is one (board V3-Token). An animated picture or a short video keeps playing (ADR 015 item
// 2); while motion is stopped it shows one still frame, because CSS cannot stop a picture or a
// video (`motionIsStill()`, SHEET-05). The picture is made from the bytes on the device; it is
// never fetched. The sheet's header and My characters draw it.
import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { isVideo, type Portrait, type PortraitFrame, portraitOfRow } from '../db/portraits';
import { motionIsStill } from '../theme/motions';
import { Slot } from '../theme/Slot';

/** A picture ready to draw: a URL made on the device, and whether it is a video. */
export interface PortraitSource {
  url: string;
  video: boolean;
}

/** One still frame of an image, drawn on a canvas as soon as the image has loaded. */
function StillFrame({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const target = canvas.current;
      if (target === null) return;
      target.width = image.naturalWidth;
      target.height = image.naturalHeight;
      target.getContext('2d')?.drawImage(image, 0, 0);
    };
    image.src = url;
  }, [url]);
  return <canvas ref={canvas} className="size-full object-cover" />;
}

export interface PortraitViewProps {
  name: string;
  source?: PortraitSource;
  /** Motion is stopped: show one frame. */
  still?: boolean;
  className: string;
}

/** The round portrait: the picture, or the first letter of `name`. */
export function PortraitView({ name, source, still = false, className }: PortraitViewProps) {
  const { t } = useTranslation('token');
  return (
    <Slot
      as="span"
      name="portrait"
      className={`flex items-center justify-center overflow-hidden rounded-full font-bold text-on-strong ${className}`}
    >
      {source === undefined ? (
        Array.from(name)[0]?.toLocaleUpperCase()
      ) : source.video ? (
        <video
          src={`${source.url}#t=0.001`}
          autoPlay={!still}
          loop
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
        />
      ) : still ? (
        <StillFrame url={source.url} />
      ) : (
        <img src={source.url} alt={t('alt', { name })} className="size-full object-cover" />
      )}
    </Slot>
  );
}

/** What the portrait row `blobId` holds now: its frame, and its picture as a URL when it has one. */
export function usePortrait(blobId: string | undefined): {
  frame: PortraitFrame;
  source?: PortraitSource;
} {
  const [portrait, setPortrait] = useState<Portrait>(() => portraitOfRow(undefined));
  const [source, setSource] = useState<PortraitSource | undefined>(undefined);
  useEffect(() => {
    if (blobId === undefined) {
      setPortrait(portraitOfRow(undefined));
      return;
    }
    const watched = liveQuery(() => db.blobs.get(blobId)).subscribe({
      next: (row) => setPortrait(portraitOfRow(row)),
      error: (error: unknown) => console.error(error),
    });
    return () => watched.unsubscribe();
  }, [blobId]);
  const picture = portrait.picture;
  useEffect(() => {
    if (picture === undefined) {
      setSource(undefined);
      return;
    }
    const url = URL.createObjectURL(new Blob([picture.bytes], { type: picture.type }));
    setSource({ url, video: isVideo(picture) });
    return () => URL.revokeObjectURL(url);
  }, [picture]);
  return { frame: portrait.frame, ...(source !== undefined && { source }) };
}

/** Whether motion is stopped now, for the picture to show a still frame. */
export function useStill(): boolean {
  return typeof window !== 'undefined' && motionIsStill();
}
