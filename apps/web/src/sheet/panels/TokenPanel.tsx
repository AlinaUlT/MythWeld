// SHEET-56: the portrait and its token (board V3-Token, ADR 009 item 6): choose an image (an
// animated picture or a short video included), see it cut round, pick one of three frames, "Use
// as token". The choice is a draft until "Use as token"; closing drops it. The picture is read
// into the device's blobs table and goes nowhere else (ADR 005 item 10).
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  checkPortraitFile,
  isVideo,
  PORTRAIT_FRAMES,
  PORTRAIT_MAX_BYTES,
  type PortraitFrame,
  type PortraitPicture,
} from '../../db/portraits';
import { BottomSheet } from '../../shared/BottomSheet';
import { type PortraitSource, PortraitView, usePortrait, useStill } from '../../shared/Portrait';
import { Part } from '../../theme/Part';
import { Slot } from '../../theme/Slot';
import { savePortrait } from '../portrait';
import { useSheet } from '../SheetContext';

/** The slot each frame is drawn in: one per frame of the board (ADR 015 item 6). */
export const FRAME_SLOTS = {
  thin: 'token-frame-thin',
  ring: 'token-frame-ring',
  double: 'token-frame-double',
} as const satisfies Record<PortraitFrame, string>;

/** A round token: the portrait inside its frame. */
export function TokenFace({
  name,
  frame,
  source,
  still,
  className,
}: {
  name: string;
  frame: PortraitFrame;
  source?: PortraitSource;
  still?: boolean;
  className: string;
}) {
  return (
    <Slot as="span" name={FRAME_SLOTS[frame]} className="flex shrink-0 rounded-full">
      <PortraitView
        name={name}
        className={className}
        {...(source !== undefined && { source })}
        {...(still !== undefined && { still })}
      />
    </Slot>
  );
}

/** The picture chosen and not yet used, with the address its preview is drawn from. */
interface Draft {
  picture: PortraitPicture;
  source: PortraitSource;
}

const MB = 1024 * 1024;

export function TokenPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('token');
  const { character } = useSheet();
  const saved = usePortrait(character.portraitBlobId);
  const still = useStill();
  const [frame, setFrame] = useState<PortraitFrame | undefined>(undefined);
  const [draft, setDraft] = useState<Draft | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // A draft's preview address is made here and let go when the draft changes or the panel closes.
  useEffect(() => () => draft && URL.revokeObjectURL(draft.source.url), [draft]);

  const shownFrame = frame ?? saved.frame;
  const source = draft?.source ?? saved.source;

  const choose = async (file: File | undefined) => {
    if (file === undefined) return;
    const refused = checkPortraitFile(file);
    if (refused !== undefined) {
      setMessage(t(refused, { max: PORTRAIT_MAX_BYTES / MB }));
      return;
    }
    setMessage(undefined);
    const picture = { bytes: await file.arrayBuffer(), type: file.type };
    const url = URL.createObjectURL(new Blob([picture.bytes], { type: picture.type }));
    setDraft({ picture, source: { url, video: isVideo(picture) } });
  };

  const use = async () => {
    const result = await savePortrait(character.id, {
      frame: shownFrame,
      ...(draft !== undefined && { picture: draft.picture }),
    });
    if (result.ok) onClose();
    else setMessage(t('failed'));
  };

  return (
    <BottomSheet title={t('title')} onClose={onClose}>
      <div className="flex flex-col gap-4 py-2">
        <div className="flex items-center gap-4">
          <TokenFace
            name={character.name}
            frame={shownFrame}
            {...(source !== undefined && { source })}
            still={still}
            className="size-24 text-40"
          />
          <div className="flex min-w-0 grow flex-col gap-1">
            <Part
              as="button"
              type="button"
              name="button-secondary"
              onClick={() => input.current?.click()}
              className="flex min-h-control items-center justify-center px-3 text-15 font-semibold text-text"
            >
              {t('choose', { name: character.name })}
            </Part>
            <span className="text-13 text-muted">{t('stays')}</span>
          </div>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
        {message !== undefined && (
          <p role="alert" className="text-14 text-danger">
            {message}
          </p>
        )}
        <section className="flex flex-col gap-1">
          <h3 className="text-17 font-bold">{t('tokenTitle')}</h3>
          <p className="text-13 text-muted">{t('tokenNote')}</p>
        </section>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-13 font-semibold text-muted">{t('frame')}</legend>
          <div className="flex gap-2">
            {PORTRAIT_FRAMES.map((each) => (
              <Part
                as="label"
                key={each}
                name="chip"
                className="flex grow basis-0 cursor-pointer flex-col items-center gap-2 py-3 text-14 font-semibold text-muted has-checked:bg-soft has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-strong"
              >
                <input
                  type="radio"
                  name="token-frame"
                  value={each}
                  checked={each === shownFrame}
                  onChange={() => setFrame(each)}
                  className="sr-only"
                />
                <TokenFace
                  name={character.name}
                  frame={each}
                  {...(source !== undefined && { source })}
                  still={still}
                  className="size-10.5 text-21"
                />
                {t(`frames.${each}`)}
              </Part>
            ))}
          </div>
        </fieldset>
        <Part
          as="button"
          type="button"
          name="button"
          fill="button"
          onClick={() => void use()}
          className="flex min-h-control items-center justify-center px-4 text-16 font-semibold text-on-strong"
        >
          {t('use')}
        </Part>
      </div>
    </BottomSheet>
  );
}
