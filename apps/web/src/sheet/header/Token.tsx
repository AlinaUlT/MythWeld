// SHEET-30: the header's portrait token, a round frame (board V3-Sheet). SHEET-56: it holds the
// person's picture or video, and the character's first letter until there is one; a tap opens the
// portrait panel. Its i18n namespace is `token`.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readPortrait } from '../../db/portraits';
import { Slot } from '../../theme/Slot';
import { useSheet } from '../SheetContext';
import { TokenFace } from './TokenFace';

/** The person's file for the character's portrait; none while it is unset or the blob is missing. */
export function usePortraitFile(): Blob | undefined {
  const { character } = useSheet();
  const id = character.portraitBlobId;
  const [file, setFile] = useState<Blob | undefined>(undefined);
  useEffect(() => {
    setFile(undefined);
    if (id === undefined) return;
    let current = true;
    readPortrait(id).then(
      (row) => {
        if (current) setFile(row?.data);
      },
      (error: unknown) => console.error(error),
    );
    return () => {
      current = false;
    };
  }, [id]);
  return file;
}

export function Token({ onPortrait }: { onPortrait: () => void }) {
  const { t } = useTranslation('token');
  const { character } = useSheet();
  const file = usePortraitFile();
  return (
    <Slot
      as="button"
      type="button"
      name="token-frame-ring"
      aria-label={t('open')}
      className="mr-2.5 ml-0.5 flex shrink-0 rounded-full"
      onClick={onPortrait}
    >
      <TokenFace file={file} name={character.name} className="size-10.5 text-21" />
    </Slot>
  );
}
