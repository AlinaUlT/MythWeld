// SHEET-30: the header's portrait token, the character's first letter in a round frame (board
// V3-Sheet). SHEET-56: made from the person's image in the frame they picked, an animated picture
// or a video included; a tap opens the portrait panel (board V3-Token, which the board links from
// here). While motion is stopped it shows one still frame. Its i18n namespace is `token`.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePortrait, useStill } from '../../shared/Portrait';
import { TokenFace, TokenPanel } from '../panels/TokenPanel';
import { useSheet } from '../SheetContext';

export function Token() {
  const { t } = useTranslation('token');
  const { character } = useSheet();
  const [open, setOpen] = useState(false);
  const { frame, source } = usePortrait(character.portraitBlobId);
  const still = useStill();
  return (
    <>
      <button
        type="button"
        aria-label={t('open')}
        onClick={() => setOpen(true)}
        className="mr-1 ml-px flex size-12 shrink-0 items-center justify-center"
      >
        <TokenFace
          name={character.name}
          frame={frame}
          {...(source !== undefined && { source })}
          still={still}
          className="size-10.5 text-21"
        />
      </button>
      {open && <TokenPanel onClose={() => setOpen(false)} />}
    </>
  );
}
