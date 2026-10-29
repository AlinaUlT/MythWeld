// SHEET-25: a character's Actions (ADR 008 item 4, BRIEF P2, board V3-Actions): Link for the DM,
// Export, Copy, Transfer, Delete. Export saves the character file, Copy stores a copy, Delete
// drops it with "Undo" in the toast. Link for the DM and Transfer wait for the table link's phase
// (ADR 005) and show as coming later. My characters opens it from a card's swipe or its "⋯"; the
// sheet's "⋯" (SHEET-58) shows the same rows under its own.
import type { TFunction } from 'i18next';
import { ArrowRightLeft, Copy, FileDown, Link2, type LucideIcon, Trash2, X } from 'lucide-react';
import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { copyCharacter, exportCharacter } from '../db/characterActions';
import { Part } from '../theme/Part';
import { saveFile } from './saveFile';
import { deleteWithUndo } from './undo';

type ActionsT = TFunction<'actions'>;

/** The character the Actions are for: its id, its name, and whether it opens. */
export interface ActionsTarget {
  id: string;
  name: string;
  opens: boolean;
}

/** Stores a copy of `target`, named "<name> (copy)". */
export async function copyTarget(target: ActionsTarget, t: ActionsT): Promise<void> {
  const copied = await copyCharacter(target.id, t('copyName', { name: target.name }));
  if (!copied.ok) console.warn(copied.message);
}

/** Saves `target`'s character file through the browser. */
export async function exportTarget(target: ActionsTarget): Promise<void> {
  const exported = await exportCharacter(target.id);
  if (exported.ok) saveFile(exported.file.fileName, exported.file.text, 'application/json');
  else console.warn(exported.message);
}

/** Deletes `target`; the toast offers "Undo". */
export async function deleteTarget(target: ActionsTarget): Promise<void> {
  const deleted = await deleteWithUndo(target.id, target.name);
  if (!deleted.ok) console.warn(deleted.message);
}

interface RowProps {
  icon: LucideIcon;
  label: string;
  note?: string;
  danger?: boolean;
  onClick?: () => void;
}

/** One row of the list; with no `onClick` it is shown, not tappable. */
function Row({ icon: Icon, label, note, danger = false, onClick }: RowProps) {
  return (
    <button
      type="button"
      disabled={onClick === undefined}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3.5 px-5 py-2 text-left disabled:opacity-40 ${danger ? 'text-danger' : 'text-text'}`}
    >
      <Icon aria-hidden className="size-[22px] shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="text-16 font-semibold">{label}</span>
        {note !== undefined && <span className="text-13 text-muted">{note}</span>}
      </span>
    </button>
  );
}

/** The rows every Actions list has; each closes the list when it runs. */
export function ActionRows({ target, onClose }: { target: ActionsTarget; onClose: () => void }) {
  const { t } = useTranslation('actions');
  const { t: tc } = useTranslation();
  const run = (action: () => Promise<void>) => () => {
    onClose();
    void action();
  };
  return (
    <>
      <Row icon={Link2} label={t('dmLink')} note={tc('comingLater')} />
      <Row
        icon={FileDown}
        label={t('export')}
        note={t('exportNote')}
        onClick={run(() => exportTarget(target))}
      />
      <Row
        icon={Copy}
        label={t('copy')}
        {...(target.opens ? { onClick: run(() => copyTarget(target, t)) } : { note: t('noCopy') })}
      />
      <Row icon={ArrowRightLeft} label={t('transfer')} note={tc('comingLater')} />
      <Row
        icon={Trash2}
        label={t('delete')}
        note={t('deleteNote')}
        danger
        onClick={run(() => deleteTarget(target))}
      />
    </>
  );
}

export interface CharacterActionsProps {
  target: ActionsTarget;
  /** The line under the name: the species and classes, as the list card shows them. */
  line?: string;
  onClose: () => void;
}

/** The Actions list in a sheet from the bottom, over a dimmed screen. */
export function CharacterActions({ target, line, onClose }: CharacterActionsProps) {
  const { t } = useTranslation('actions');
  const titleId = useId();
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t('close')}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-scrim"
      />
      <Part
        name="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[80dvh] flex-col bg-surface pb-3"
      >
        <header className="flex shrink-0 items-center gap-1 py-2 pl-5">
          <span className="flex min-w-0 grow flex-col">
            <h2 id={titleId} className="truncate font-heading text-24 font-bold">
              {target.name}
            </h2>
            {line !== undefined && line !== '' && (
              <span className="truncate text-14 text-muted">{line}</span>
            )}
          </span>
          <Part
            as="button"
            type="button"
            name="icon-button"
            aria-label={t('close')}
            onClick={onClose}
            className="mr-1 flex size-control shrink-0 items-center justify-center text-text"
          >
            <X aria-hidden className="size-[22px]" />
          </Part>
        </header>
        <div className="min-h-0 grow overflow-y-auto">
          <ActionRows target={target} onClose={onClose} />
        </div>
      </Part>
    </div>
  );
}
