// SHEET-30: the header's portrait token, the character's first letter in a round frame (board
// V3-Sheet).
// SHEET-56: the person's portrait cut round in the frame they picked (board V3-Token, ADR 009
// item 6); the first letter shows until there is a picture. Its i18n namespace is `token`.
import { useTranslation } from 'react-i18next';
import type { TokenFrame } from '../../db/db';
import { Slot } from '../../theme/Slot';
import { useSheet } from '../SheetContext';
import {
  DEFAULT_FRAME,
  type Media,
  useMedia,
  useMotionStill,
  useStoredPortrait,
} from './portraitMedia';

interface TokenFaceProps {
  name: string;
  media?: Media | undefined;
  frame?: TokenFrame;
  /** The size of the face and of its letter, as classes. */
  face: string;
  /** What is around the frame: its margin, or its room for the rings. */
  className?: string;
}

/** A token: the media cut round, or the name's first letter, in the frame `frame`. */
export function TokenFace({ name, media, frame = DEFAULT_FRAME, face, className }: TokenFaceProps) {
  return (
    <Slot
      as="span"
      name={`token-frame-${frame}`}
      className={`flex shrink-0 rounded-full ${className ?? ''}`}
    >
      <Slot
        as="span"
        name="portrait"
        className={`flex items-center justify-center overflow-hidden rounded-full font-heading font-bold text-on-strong ${face}`}
      >
        {media === undefined ? (
          Array.from(name)[0]?.toLocaleUpperCase()
        ) : media.video ? (
          <video
            src={media.url}
            aria-hidden
            muted
            loop
            playsInline
            autoPlay
            className="size-full object-cover"
          />
        ) : (
          <img src={media.url} alt={name} className="size-full object-cover" />
        )}
      </Slot>
    </Slot>
  );
}

/** A stored portrait's token. */
export function StoredToken({
  name,
  blobId,
  face,
  className,
}: { name: string; blobId: string | undefined } & Pick<TokenFaceProps, 'face' | 'className'>) {
  const stored = useStoredPortrait(blobId);
  const media = useMedia(stored?.data, useMotionStill());
  return (
    <TokenFace name={name} media={media} frame={stored?.frame} face={face} className={className} />
  );
}

export function Token({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation('token');
  const { character } = useSheet();
  return (
    <button
      type="button"
      aria-label={t('open')}
      onClick={onOpen}
      className="mr-2.5 ml-0.5 flex shrink-0 rounded-full"
    >
      <StoredToken
        name={character.name}
        blobId={character.portraitBlobId}
        face="size-10.5 text-21"
      />
    </button>
  );
}
