// SHEET-57: a custom section's tab (ADR 009 item 8, board V3-Add): a list of the person's own,
// Mounts, Pets, Familiars, Notes or any name, each entry a name and free text; a companion with
// its small stat block is such an entry. Edit mode adds an entry, takes one away, or takes the
// whole section away, each one change with its "Undo" toast. Play mode only reads. A companion with
// a sheet of its own waits for the table link (ADR 014 item 9).
import { removeSection, removeSectionEntry } from '@grimoire/engine';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { AddPanel } from '../panels/AddPanel';
import { useSheet } from '../SheetContext';

export function SectionList({ id }: { id: string }) {
  const { t } = useTranslation('sections');
  const { character, editing } = useSheet();
  const [adding, setAdding] = useState(false);
  const section = character.sections.find((each) => each.id === id);
  if (section === undefined) return null;

  const run = (action: Parameters<typeof perform>[1]) =>
    perform(character, action).catch((error: unknown) => console.error(error));

  return (
    <>
      <Part
        as="section"
        name="card"
        fill="card"
        className="flex flex-col py-3"
        aria-label={section.name}
        data-section={section.id}
      >
        <h2 className="px-4 pb-2 font-heading text-18 font-bold">{section.name}</h2>
        {section.entries.length === 0 ? (
          <p className="px-4 pb-1 text-15 text-muted">{t('none')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {section.entries.map((entry) => (
              <li
                key={entry.id}
                data-entry={entry.id}
                className="flex items-start gap-2 px-4 py-2.5"
              >
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="text-15 font-bold">{entry.name}</span>
                  {entry.text !== undefined && (
                    <span className="text-14 whitespace-pre-line text-muted">{entry.text}</span>
                  )}
                </span>
                {editing && (
                  <Part
                    as="button"
                    type="button"
                    name="icon-button"
                    aria-label={t('removeEntry', { name: entry.name })}
                    className="flex size-control shrink-0 items-center justify-center text-text"
                    onClick={() =>
                      run((stamp) =>
                        removeSectionEntry(character, { section: section.id, id: entry.id }, stamp),
                      )
                    }
                  >
                    <X aria-hidden className="size-5" />
                  </Part>
                )}
              </li>
            ))}
          </ul>
        )}
        {editing && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            <Part
              as="button"
              type="button"
              name="button"
              fill="button"
              className="flex h-control grow items-center justify-center gap-2 px-4 text-15 font-bold whitespace-nowrap text-on-strong"
              onClick={() => setAdding(true)}
            >
              <Plus aria-hidden className="size-4" />
              {t('addEntry')}
            </Part>
            <Part
              as="button"
              type="button"
              name="button-secondary"
              className="flex h-control grow items-center justify-center px-4 text-15 whitespace-nowrap"
              onClick={() => run((stamp) => removeSection(character, { id: section.id }, stamp))}
            >
              {t('removeSection')}
            </Part>
          </div>
        )}
      </Part>
      {adding && <AddPanel entryIn={section.id} onClose={() => setAdding(false)} />}
    </>
  );
}
