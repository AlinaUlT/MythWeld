// SHEET-25: a character's Actions (ADR 008 item 4, board V3-Actions): a sheet over the page, the
// rest dimmed. Export saves the character as a JSON file, Copy stores a copy, Delete drops it and
// its toast offers "Undo". Link for the DM and Transfer wait for the table link's phase and show as
// coming later. My characters opens it from a card; the sheet's "⋯" opens the same (SHEET-58).
import { Copy, FileText, Link2, Send, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyCharacter, exportCharacter } from '../db/characterActions';
import { downloadFile } from '../lib/download';
import type { AppCharacter } from '../systems';
import { Part } from '../theme/Part';
import { removeCharacter } from './undo';

const icon = 'size-[22px] shrink-0';

interface RowProps {
  icon: ReactNode;
  label: string;
  note?: string;
  danger?: boolean;
  onClick?: () => void;
}

function Row({ icon, label, note, danger = false, onClick }: RowProps) {
  return (
    <button
      type="button"
      disabled={onClick === undefined}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3.5 border-line border-b px-1 py-0.5 text-left disabled:text-muted ${danger ? 'text-danger' : 'text-text'}`}
    >
      {icon}
      <span className="flex grow flex-col">
        <span className="font-semibold">{label}</span>
        {note !== undefined && <span className="text-13 text-muted">{note}</span>}
      </span>
    </button>
  );
}

interface CharacterActionsProps {
  character: AppCharacter;
  /** What shows beside the name: the list card's line, or the sheet's class line. */
  line: string;
  onClose: () => void;
}

export function CharacterActions({ character, line, onClose }: CharacterActionsProps) {
  const { t } = useTranslation('actions');
  const { t: tc } = useTranslation();
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[role="dialog"]')?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  /** Runs `act`; closes when it is done, or says it was not. */
  const run = (act: () => Promise<{ ok: boolean }>) => () => {
    act().then(
      (result) => (result.ok ? onClose() : setFailed(true)),
      (error: unknown) => {
        console.error(error);
        setFailed(true);
      },
    );
  };

  const exportFile = run(async () => {
    const result = await exportCharacter(character.id);
    if (result.ok) downloadFile(result.file.name, result.file.text);
    return result;
  });
  const copy = run(() =>
    copyCharacter(character.id, { name: t('copyName', { name: character.name }) }),
  );
  const remove = run(() => removeCharacter(character.id, character.name));

  return (
    <div ref={root} className="fixed inset-0 z-10 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 bg-scrim-low"
      />
      <Part
        as="section"
        name="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('title', { name: character.name })}
        tabIndex={-1}
        className="relative flex flex-col gap-2.5 bg-surface px-4 pt-2 pb-4 outline-none"
      >
        <div aria-hidden className="h-1 w-10 self-center rounded-pill bg-line" />
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-20 font-extrabold">{character.name}</span>
          <span className="truncate text-muted">{line}</span>
        </p>
        <div className="flex flex-col">
          {/* Link for the DM and Transfer come with the table link's phase (ADR 005). */}
          <Row
            icon={<Link2 aria-hidden className={icon} />}
            label={t('dmLink')}
            note={tc('comingLater')}
          />
          <Row
            icon={<FileText aria-hidden className={icon} />}
            label={t('export')}
            note={t('exportNote')}
            onClick={exportFile}
          />
          <Row icon={<Copy aria-hidden className={icon} />} label={t('copy')} onClick={copy} />
          <Row
            icon={<Send aria-hidden className={icon} />}
            label={t('transfer')}
            note={tc('comingLater')}
          />
          <Row
            icon={<Trash2 aria-hidden className={icon} />}
            label={t('delete')}
            note={t('deleteNote')}
            danger
            onClick={remove}
          />
        </div>
        {failed && <p className="text-13 text-muted">{t('failed')}</p>}
      </Part>
    </div>
  );
}
