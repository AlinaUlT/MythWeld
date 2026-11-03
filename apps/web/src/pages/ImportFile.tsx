// SHEET-26: "Import file" on My characters (BRIEF P2): the person picks a character file (the one
// Export saves, SHEET-25); it runs through its checks (`importCharacterFile`) and, when it passes,
// the new character's sheet opens with a toast. A refused file says why, in the page, and nothing
// is stored. The file is read on the device and goes nowhere else.
import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { IMPORT_MAX_BYTES, importCharacterFile } from '../db/importCharacter';
import { showImported } from '../shared/undo';
import { sheetPath } from '../shell/routes';
import { Part } from '../theme/Part';

export function ImportFile() {
  const { t } = useTranslation('characters');
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | undefined>(undefined);
  // What the file's checks said, for a file the schema refused: the first lines of their text.
  const [detail, setDetail] = useState<string | undefined>(undefined);

  const run = async (file: File | undefined) => {
    if (file === undefined) return;
    setMessage(undefined);
    setDetail(undefined);
    // A file over the limit is refused before its text is read.
    const result =
      file.size > IMPORT_MAX_BYTES
        ? { ok: false as const, code: 'tooBig' as const, message: '' }
        : await importCharacterFile(await file.text()).catch((error: unknown) => {
            console.error(error);
            return { ok: false as const, code: 'failed' as const, message: '' };
          });
    if (!result.ok) {
      if (result.message !== '') console.warn(result.message);
      if (result.code === 'invalid') setDetail(result.message.split('\n').slice(0, 3).join(' '));
      setMessage(t(`importRefused.${result.code}`, { max: IMPORT_MAX_BYTES / (1024 * 1024) }));
      return;
    }
    showImported(result.character.name, result.again);
    void navigate(sheetPath(result.character.id));
  };

  return (
    <div className="flex flex-col items-center gap-2 px-4">
      <Part
        as="button"
        type="button"
        name="button-secondary"
        onClick={() => input.current?.click()}
        className="flex h-control items-center gap-2 px-5 text-14 font-semibold text-text"
      >
        <Upload aria-hidden className="size-[18px]" />
        {t('import')}
      </Part>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void run(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {message !== undefined && (
        <div role="alert" className="flex flex-col items-center gap-1 text-center">
          <p className="text-14 text-danger">{message}</p>
          {detail !== undefined && <p className="text-12 break-words text-muted">{detail}</p>}
        </div>
      )}
    </div>
  );
}
