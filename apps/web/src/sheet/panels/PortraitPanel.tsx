// SHEET-56: the portrait and token screen (board V3-Token, ADR 009 item 6, BRIEF P3 step 4),
// opened from the header's token over the sheet. The person picks an image, an animated picture
// or a short video, sees it cut round in a frame, picks the frame and saves it as the token. The
// file stays on the device (ADR 005 item 10). Its i18n namespace is `token`.
import { ChevronLeft, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TOKEN_FRAMES, type TokenFrame } from '../../db/db';
import {
  PORTRAIT_TYPES,
  type PortraitResult,
  portraitRefusal,
  removePortrait,
  setPortrait,
  setTokenFrame,
} from '../../db/portrait';
import { Part } from '../../theme/Part';
import {
  DEFAULT_FRAME,
  useMedia,
  useMotionStill,
  useStoredPortrait,
} from '../header/portraitMedia';
import { TokenFace } from '../header/Token';
import { useSheet } from '../SheetContext';
import type { PanelProps } from './panel';

type Refusal = Extract<PortraitResult, { ok: false }>['code'];

export function PortraitPanel({ onClose }: PanelProps) {
  const { t } = useTranslation('token');
  const { character } = useSheet();
  const stored = useStoredPortrait(character.portraitBlobId);
  const [picked, setPicked] = useState<File | undefined>(undefined);
  const [frame, setFrame] = useState<TokenFrame | undefined>(undefined);
  const [refused, setRefused] = useState<Refusal | undefined>(undefined);
  const inputId = useId();

  const shownFrame = frame ?? stored?.frame ?? DEFAULT_FRAME;
  const media = useMedia(picked ?? stored?.data, useMotionStill());
  // The picked file is not stored until "Use as token", so its frame waits with it.
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pick = (file: File | undefined) => {
    if (file === undefined) return;
    const refusal = portraitRefusal(file);
    setRefused(refusal);
    if (refusal === undefined) setPicked(file);
  };

  const pickFrame = (next: TokenFrame) => {
    setFrame(next);
    // A stored portrait takes the frame at once; a picked file waits for "Use as token".
    if (picked === undefined && stored !== undefined) {
      setTokenFrame(character.id, next).catch((error: unknown) => console.error(error));
    }
  };

  const use = async () => {
    if (picked === undefined) return onClose();
    setSaving(true);
    const result = await setPortrait(character.id, picked, shownFrame);
    setSaving(false);
    if (result.ok) onClose();
    else setRefused(result.code);
  };

  const remove = async () => {
    await removePortrait(character.id);
    setPicked(undefined);
    setFrame(undefined);
  };

  const hasPortrait = picked !== undefined || stored !== undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="absolute inset-0 z-30 flex flex-col bg-bg text-text"
    >
      <header className="flex h-15 shrink-0 items-center gap-1 px-1">
        <BackButtonClose label={t('close')} onClose={onClose} />
        <h1 className="grow font-heading text-28 font-bold">{t('title')}</h1>
      </header>
      <main className="flex min-h-0 grow flex-col gap-3.5 overflow-y-auto px-4">
        <Part
          as="label"
          name="panel"
          htmlFor={inputId}
          className="flex h-55 shrink-0 flex-col items-center justify-center gap-2 text-muted"
        >
          <ImagePlus aria-hidden className="size-7" />
          <span>{hasPortrait ? t('replace') : t('choose', { name: character.name })}</span>
          <span className="text-12">{t('stays')}</span>
          <input
            id={inputId}
            type="file"
            accept={PORTRAIT_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => {
              pick(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </Part>
        {refused !== undefined && (
          <p role="alert" className="text-14 text-danger">
            {t(`refused.${refused}`)}
          </p>
        )}
        <div className="flex items-center gap-4">
          <TokenFace
            name={character.name}
            media={media}
            frame={shownFrame}
            face="size-24 text-48"
            className="m-2"
          />
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-22 leading-tight font-bold">{t('token')}</h2>
            <p className="text-13 text-muted">{t('tokenNote')}</p>
          </div>
        </div>
        <h2 className="text-12 font-semibold tracking-wide text-muted uppercase">{t('frame')}</h2>
        <div role="radiogroup" aria-label={t('frame')} className="flex gap-2">
          {TOKEN_FRAMES.map((each) => (
            <Part
              key={each}
              as="button"
              type="button"
              name="card"
              role="radio"
              aria-checked={shownFrame === each}
              onClick={() => pickFrame(each)}
              className={`flex h-24 grow flex-col items-center justify-center gap-2 ${
                shownFrame === each ? 'outline-2 outline-strong' : ''
              }`}
            >
              <TokenFace
                name={character.name}
                media={media}
                frame={each}
                face="size-12 text-24"
                className="m-1.5"
              />
              <span className="text-12">{t(`frames.${each}`)}</span>
            </Part>
          ))}
        </div>
        {stored !== undefined && picked === undefined && (
          <Part
            as="button"
            type="button"
            name="button-secondary"
            onClick={remove}
            className="flex h-control items-center justify-center gap-2 px-4 text-14 font-semibold"
          >
            <Trash2 aria-hidden className="size-4" />
            {t('remove')}
          </Part>
        )}
      </main>
      <div className="px-4 pt-2.5 pb-5">
        <Part
          as="button"
          type="button"
          name="button"
          fill="button"
          disabled={saving}
          onClick={use}
          className="flex h-12 w-full items-center justify-center px-4.5 font-semibold text-on-strong"
        >
          {t('use')}
        </Part>
      </div>
    </div>
  );
}

function BackButtonClose({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <Part
      as="button"
      type="button"
      name="icon-button"
      aria-label={label}
      onClick={onClose}
      className="flex size-control shrink-0 items-center justify-center text-text"
    >
      <ChevronLeft aria-hidden className="size-[22px]" />
    </Part>
  );
}
