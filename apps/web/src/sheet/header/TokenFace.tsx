// SHEET-56: what fills a token's circle: the person's picture or video cut round, or the
// character's first letter while there is none (or while its file is missing, SPEC §8.2). A video
// plays muted and in a loop; while motion is stopped (`motionIsStill()`), a video shows its first
// frame and an animated picture its first frame too (ADR 015 item 9). Used by the header's token
// and by the portrait panel's preview.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { portraitKind, stillFrameOf } from '../../db/portraits';
import { motionIsStill, watchMotionStill } from '../../theme/motions';
import { Slot } from '../../theme/Slot';

/** Whether motion is stopped now; it follows the phone's setting and the app's switch. */
function useMotionStill(): boolean {
  return useSyncExternalStore(
    (onChange) => watchMotionStill(onChange),
    () => motionIsStill(),
    () => false,
  );
}

/** An address for `file` while the face shows it; the browser lets go of it afterwards. */
function useFileUrl(file: Blob | undefined): string | undefined {
  const [made, setMade] = useState<{ file: Blob; url: string } | undefined>(undefined);
  useEffect(() => {
    if (file === undefined) return;
    const url = URL.createObjectURL(file);
    setMade({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // The address of an earlier file is let go of already: it is never drawn.
  return made !== undefined && made.file === file ? made.url : undefined;
}

export interface TokenFaceProps {
  /** The person's file; none shows the letter. */
  file: Blob | undefined;
  name: string;
  /** The size and the letter's size, as classes. */
  className: string;
}

export function TokenFace({ file, name, className }: TokenFaceProps) {
  const still = useMotionStill();
  const kind = file === undefined ? undefined : portraitKind(file.type);
  // An animated picture stands still as its first frame; a video needs no copy.
  const [frame, setFrame] = useState<Blob | undefined>(undefined);
  useEffect(() => {
    setFrame(undefined);
    if (file === undefined || kind !== 'image' || !still) return;
    let current = true;
    stillFrameOf(file).then((made) => {
      if (current) setFrame(made);
    });
    return () => {
      current = false;
    };
  }, [file, kind, still]);
  const shown = kind === 'image' && still ? frame : file;
  const url = useFileUrl(kind === undefined ? undefined : shown);
  return (
    <Slot
      as="span"
      name="portrait"
      className={`flex items-center justify-center overflow-hidden rounded-full font-heading font-bold text-on-strong ${className}`}
    >
      {kind === 'video' && url !== undefined ? (
        <video
          key={url}
          src={url}
          className="size-full object-cover"
          muted
          loop={!still}
          autoPlay={!still}
          playsInline
          preload="auto"
          aria-hidden
        />
      ) : kind === 'image' && url !== undefined ? (
        <img src={url} alt={name} className="size-full object-cover" />
      ) : (
        Array.from(name)[0]?.toLocaleUpperCase()
      )}
    </Slot>
  );
}
