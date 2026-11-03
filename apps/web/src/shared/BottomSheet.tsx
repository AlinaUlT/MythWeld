// SHEET-56: a sheet from the bottom over a dimmed screen, with a title, a close button and a
// scrolling body: the shell the Actions list (SHEET-25) draws, for the panels of the sheet to
// share. Escape and a tap on the dim close it.
import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Part } from '../theme/Part';

export interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const { t } = useTranslation();
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
        className="relative flex max-h-[85dvh] flex-col bg-surface pb-3"
      >
        <header className="flex shrink-0 items-center gap-1 py-2 pl-5">
          <h2 id={titleId} className="min-w-0 grow font-heading text-22 leading-tight font-bold">
            {title}
          </h2>
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
        <div className="min-h-0 grow overflow-y-auto px-5">{children}</div>
      </Part>
    </div>
  );
}
