// SHEET-26: "Import file" on My characters (BRIEF P2): the person picks a character file, which
// opens through its checks and then its sheet, or is refused with the reason in a card that says
// nothing was saved.
import type { TFunction } from 'i18next';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  type CharacterRefusal,
  type FileRefusal,
  IMPORT_MAX_BYTES,
  importCharacter,
} from '../db/characterImport';
import { sheetPath } from '../shell/routes';
import { Part } from '../theme/Part';

/** A file that was not imported, and why. */
export interface RefusedFile {
  fileName: string;
  refusal: FileRefusal | CharacterRefusal;
}

/** How many failed checks the card lists before "and N more". */
export const ISSUES_SHOWN = 5;

type CharactersT = TFunction<'characters'>;

/** The failed checks of a refused file, each `path: message`, the first `ISSUES_SHOWN`. */
export function issueLines(refusal: RefusedFile['refusal'], t: CharactersT): string[] {
  if (refusal.code !== 'invalid') return [];
  const { issues } = refusal.error;
  const shown = issues.slice(0, ISSUES_SHOWN).map((issue) => {
    const where = issue.path.length === 0 ? t('importRefused.wholeFile') : issue.path.join('.');
    return `${where}: ${issue.message}`;
  });
  return issues.length > ISSUES_SHOWN
    ? [...shown, t('importRefused.more', { count: issues.length - ISSUES_SHOWN })]
    : shown;
}

/** The reason a file was refused, in the person's words. */
export function reasonText(refusal: RefusedFile['refusal'], t: CharactersT): string {
  switch (refusal.code) {
    case 'newer':
      return t('importRefused.newer', {
        field: refusal.field,
        found: refusal.found,
        current: refusal.current,
      });
    case 'tooLarge':
      return t('importRefused.tooLarge', { limit: IMPORT_MAX_BYTES / (1024 * 1024) });
    default:
      return t(`importRefused.${refusal.code}`);
  }
}

/** The smaller action that opens the file picker; a file that imports opens its sheet. */
export function ImportButton({
  onRefused,
}: {
  onRefused: (refused: RefusedFile | undefined) => void;
}) {
  const { t } = useTranslation('characters');
  const { t: ta } = useTranslation('actions');
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);

  const choose = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (file === undefined) return;
    const imported = await importCharacter(file, (name) => ta('copyName', { name }));
    if (imported.ok) {
      onRefused(undefined);
      void navigate(sheetPath(imported.character.id));
    } else {
      console.warn(imported.message);
      onRefused({ fileName: file.name, refusal: imported });
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        data-testid="import-input"
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      <Part
        as="button"
        type="button"
        name="button-secondary"
        onClick={() => input.current?.click()}
        className="flex h-control items-center justify-center px-5 text-14 font-semibold"
      >
        {t('import')}
      </Part>
    </>
  );
}

/** The card for a refused file: its name, that nothing was saved, and the reason. */
export function ImportRefusal({ refused, onClose }: { refused: RefusedFile; onClose: () => void }) {
  const { t } = useTranslation('characters');
  const lines = issueLines(refused.refusal, t);
  return (
    <Part
      as="div"
      name="card"
      fill="card"
      role="alert"
      className="mx-4 mt-2 flex flex-col gap-1.5 p-3.5 text-14"
    >
      <p className="text-15 font-bold">{t('importRefused.title', { file: refused.fileName })}</p>
      <p>{reasonText(refused.refusal, t)}</p>
      {lines.length > 0 && (
        <ul className="list-disc pl-5 text-13 text-muted">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="text-muted">{t('importRefused.nothingSaved')}</p>
      <Part
        as="button"
        type="button"
        name="button-secondary"
        onClick={onClose}
        className="flex h-control items-center justify-center self-start px-5 font-semibold"
      >
        {t('importRefused.close')}
      </Part>
    </Part>
  );
}
