// SHEET-11: the toasts over every page. SHEET-23: the toast after each change, with "Undo"
// (SPEC §7.2, board V3-Features). It names what changed: the action's text, with the entry's
// label, or its subject when the content no longer has a name for it. It goes after `TOAST_MS`,
// unless the person's focus is in it; a refused undo says so in its place.
import type { LogEntry } from '@grimoire/schema';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { en } from '../i18n/namespaces';
import { Part } from '../theme/Part';
import { currentToast, hideToast, subscribeToast, TOAST_MS, type Toast, undoToast } from './undo';

type DoneKey = keyof typeof en.toast.done;

/** The action's own text key, or `other` for an action the locale has no text for. */
export function doneKeyOf(action: string): DoneKey {
  return Object.hasOwn(en.toast.done, action) ? (action as DoneKey) : 'other';
}

/** What changed, by name: the label in `language`, in English, or the subject. */
export function nameOf(entry: LogEntry, language: string): string {
  const label = entry.label as Readonly<Record<string, string | undefined>> | undefined;
  return label?.[language] ?? label?.en ?? entry.subject;
}

/** One toast as it is drawn; `onUndo` runs when "Undo" is tapped. */
export function ToastView({ toast, onUndo }: { toast: Toast; onUndo?: () => void }) {
  const { t, i18n } = useTranslation('toast');
  const text =
    toast.kind === 'changed'
      ? t(`done.${doneKeyOf(toast.entry.action)}`, { name: nameOf(toast.entry, i18n.language) })
      : t('notUndone');
  return (
    <Part
      name="toast"
      className="pointer-events-auto flex h-12 items-center gap-2 bg-strong pr-1.5 pl-4 text-on-strong"
    >
      <span className="grow truncate">{text}</span>
      {toast.kind === 'changed' && (
        <button type="button" onClick={onUndo} className="h-11 shrink-0 px-3.5 font-bold underline">
          {t('undo')}
        </button>
      )}
    </Part>
  );
}

export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, currentToast, currentToast);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (toast === undefined || held) return;
    const timer = setTimeout(() => hideToast(toast), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, held]);
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-4 bottom-4"
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      {toast && <ToastView toast={toast} onUndo={() => void undoToast(toast)} />}
    </div>
  );
}
