// SHEET-31: every entry on the sheet opens and closes its description in place (ADR 011): its row
// is one button with the turning chevron; open, it shows the summary and "See full description",
// which opens the exact text of the entry's source with that source named, or says the source has
// none. The cast panel draws `DescriptionBody` alone, above "Cast" (ADR 011 item 2).
import type { TFunction } from 'i18next';
import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Described,
  type DescriptionSource,
  descriptionOf,
  type EntryDescription,
} from '../content/descriptions';
import type { InstalledPack } from '../content/packs';
import { Chevron } from './Chevron';

type DescriptionT = TFunction<'description'>;

/** The line naming where the text comes from. */
export function sourceLine(source: DescriptionSource, t: DescriptionT): string {
  if (source.kind === 'own') return t('own');
  if (source.kind === 'notInstalled') return t('notInstalled', { pack: source.pack });
  const book =
    source.page === undefined
      ? t('source', { book: source.book })
      : t('sourcePage', { book: source.book, page: source.page });
  return [book, t('version', { version: source.version }), source.license].join(t('separator'));
}

function FullText({ description, t }: { description: EntryDescription; t: DescriptionT }) {
  const { text, source } = description;
  return (
    <div className="flex flex-col gap-2 px-4 pt-1 pb-3">
      {text === undefined ? (
        <p className="text-14 text-muted">{t('noText')}</p>
      ) : (
        <p className="whitespace-pre-line text-15">{text}</p>
      )}
      <p className="text-12 text-muted">{sourceLine(source, t)}</p>
      {source.kind === 'pack' && source.attribution !== undefined && (
        <p className="text-12 text-muted">{source.attribution}</p>
      )}
    </div>
  );
}

/** The summary, and "See full description", which opens the exact text in place. */
export function DescriptionBody({
  description,
  defaultFull = false,
}: {
  description: EntryDescription;
  defaultFull?: boolean;
}) {
  const { t } = useTranslation('description');
  const [full, setFull] = useState(defaultFull);
  const id = useId();
  return (
    <div className="flex flex-col">
      {description.summary !== undefined && (
        <p className="whitespace-pre-line px-4 pb-3 text-15">{description.summary}</p>
      )}
      <button
        type="button"
        aria-expanded={full}
        aria-controls={id}
        onClick={() => setFull(!full)}
        className="flex min-h-control items-center gap-3 bg-soft px-4 text-left text-15 font-semibold"
      >
        <span className="grow">{t('seeFull')}</span>
        <Chevron open={full} />
      </button>
      <div id={id}>{full && <FullText description={description} t={t} />}</div>
    </div>
  );
}

/**
 * An entry's row that opens its description in place. `children` is the tab's line under the
 * name; the tab's own buttons sit outside the row, and the tab's card or list holds the rows.
 */
export function Description({
  entity,
  packs,
  children,
  defaultOpen = false,
  defaultFull = false,
}: {
  entity: Described;
  packs?: readonly InstalledPack[];
  children?: ReactNode;
  defaultOpen?: boolean;
  defaultFull?: boolean;
}) {
  const { i18n } = useTranslation('description');
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const description = descriptionOf(entity, i18n.language, packs);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex min-h-control items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-15 font-bold">{description.name}</span>
          {children !== undefined && <span className="text-12 text-muted">{children}</span>}
        </span>
        <Chevron open={open} />
      </button>
      <div id={id}>
        {open && <DescriptionBody description={description} defaultFull={defaultFull} />}
      </div>
    </div>
  );
}
