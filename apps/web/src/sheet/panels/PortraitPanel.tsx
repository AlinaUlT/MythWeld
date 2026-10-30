// SHEET-56: the portrait panel (board V3-Token): the person picks an image, an animated picture
// or a short video; it stays on the device and the header's token shows it cut round. A file that
// is no picture or video, or is too large, is said in the panel and not kept. The frame mounts it
// while it is open. Its i18n namespace is `token`.
import { ChevronLeft, ImagePlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clearPortrait, PORTRAIT_MAX_BYTES, refusalFor, setPortrait } from '../../db/portraits';
import { Part } from '../../theme/Part';
import { Slot } from '../../theme/Slot';
import { usePortraitFile } from '../header/Token';
import { TokenFace } from '../header/TokenFace';
import { useSheet } from '../SheetContext';
import type { PanelProps } from './panel';

export function PortraitPanel({ onClose }: PanelProps) {
  const { t } = useTranslation('token');
  const { t: c } = useTranslation();
  const { character } = useSheet();
  const current = usePortraitFile();
  const [chosen, setChosen] = useState<File | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const said = (code: string) => {
    if (code === 'notMedia' || code === 'tooBig') {
      return t(code, { max: PORTRAIT_MAX_BYTES / (1024 * 1024) });
    }
    return t(code === 'notFound' ? 'notFound' : 'failed');
  };

  const choose = (file: File | undefined) => {
    if (file === undefined) return;
    const refused = refusalFor(file);
    setChosen(refused === undefined ? file : undefined);
    setProblem(refused === undefined ? undefined : said(refused.code));
  };

  const finish = async (work: () => ReturnType<typeof setPortrait>) => {
    try {
      const result = await work();
      if (result.ok) onClose();
      else setProblem(said(result.code));
    } catch (error) {
      console.error(error);
      setProblem(t('failed'));
    }
  };

  return (
    <Slot
      as="section"
      name="app"
      aria-label={t('title')}
      className="absolute inset-0 z-30 flex flex-col"
    >
      <header className="flex h-15 shrink-0 items-center gap-1 px-1">
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={c('back')}
          className="flex size-control shrink-0 items-center justify-center text-text"
          onClick={onClose}
        >
          <ChevronLeft aria-hidden className="size-[22px]" />
        </Part>
        <h1 className="grow font-heading text-28 font-bold">{t('title')}</h1>
      </header>
      <main className="flex grow flex-col gap-3.5 overflow-y-auto px-4">
        <Part
          as="label"
          name="panel"
          className="flex h-55 cursor-pointer flex-col items-center justify-center gap-2 text-muted"
        >
          <ImagePlus aria-hidden className="size-10" />
          <span>{chosen === undefined ? t('choose', { name: character.name }) : chosen.name}</span>
          <span className="text-12">{t('stays')}</span>
          <input
            type="file"
            accept={t('accept')}
            className="sr-only"
            onChange={(event) => {
              choose(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </Part>
        {problem !== undefined && (
          <p role="alert" className="text-14 text-danger">
            {problem}
          </p>
        )}
        <div className="flex items-center gap-4">
          <Slot as="span" name="token-frame-ring" className="m-2 flex shrink-0 rounded-full">
            <TokenFace file={chosen ?? current} name={character.name} className="size-24 text-48" />
          </Slot>
          <span className="flex flex-col gap-1">
            <span className="font-heading text-22 font-bold leading-tight">{t('tokenTitle')}</span>
            <span className="text-13 text-muted">{t('tokenText')}</span>
          </span>
        </div>
      </main>
      <div className="flex flex-col gap-2 px-4 pt-2.5 pb-5">
        <Part
          as="button"
          type="button"
          name="button"
          disabled={chosen === undefined}
          className="flex h-12 items-center justify-center bg-strong px-4.5 font-semibold text-on-strong disabled:opacity-50"
          onClick={() => chosen !== undefined && finish(() => setPortrait(character.id, chosen))}
        >
          {t('use')}
        </Part>
        {character.portraitBlobId !== undefined && (
          <Part
            as="button"
            type="button"
            name="button-secondary"
            className="flex h-12 items-center justify-center px-4.5 font-semibold text-text"
            onClick={() => finish(() => clearPortrait(character.id))}
          >
            {t('remove')}
          </Part>
        )}
      </div>
    </Slot>
  );
}
