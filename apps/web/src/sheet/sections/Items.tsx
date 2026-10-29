// SHEET-30: the Gear tab's items. Its own file and its own i18n namespace (`gear`) keep that row
// apart from its wave.
// SHEET-50: every row of the inventory with its Worn and Attuned switches (SPEC §7.2): a tap is one
// change, undone from the toast, and the header's AC and the attacks follow at once. Worn and
// Attuned work in play mode; putting a row into a container, which changes the list's structure,
// needs edit mode. The tab says the warnings it owns (SHEET-18, SHEET-63, ENG-44) with the item's
// name. Weights are stored in pounds and shown as the person chose (SPEC §7.5).
import { finderOf } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { TFunction } from 'i18next';
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { shownWeight } from '../../settings/units';
import { useSettings } from '../../settings/useSettings';
import { Part } from '../../theme/Part';
import { changeSheet } from '../change';
import { type GearRow, gearRows, gearWarnings, placesFor } from '../gear';
import { useSheet } from '../SheetContext';

type GearT = TFunction<'gear'>;

/** How far in a row is drawn, by how many rows it is inside; deeper ones stay at the last step. */
const INDENT = ['ml-0', 'ml-4', 'ml-8'] as const;

const switchBase = 'flex h-control items-center px-4 text-14 font-semibold select-none';

/** A name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

function Switch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <Part
      as="button"
      type="button"
      name="chip"
      aria-pressed={on}
      onClick={onToggle}
      className={`${switchBase} ${on ? 'bg-strong text-on-strong' : 'bg-soft text-muted'}`}
    >
      {label}
    </Part>
  );
}

function PutIn({
  entry,
  rows,
  nameOf,
  t,
}: {
  entry: GearRow;
  rows: readonly GearRow[];
  nameOf: (row: GearRow) => string;
  t: GearT;
}) {
  const { character, content, system } = useSheet();
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-w-0 grow items-center gap-2 text-13 text-muted">
      {t('putIn')}
      <Part
        as="select"
        id={id}
        name="field"
        className="h-control min-w-0 grow bg-surface px-2 text-14 text-text"
        value={entry.row.container ?? ''}
        onChange={(event: { target: { value: string } }) => {
          const container = event.target.value === '' ? undefined : event.target.value;
          void changeSheet(character, (stamp) =>
            system.inventory.move(
              character,
              content.index,
              { uid: entry.row.uid, ...(container !== undefined && { container }) },
              stamp,
            ),
          );
        }}
      >
        <option value="">{t('putInNone')}</option>
        {placesFor(entry.row.uid, rows).map((place) => (
          <option key={place.row.uid} value={place.row.uid}>
            {nameOf(place)}
          </option>
        ))}
      </Part>
    </label>
  );
}

function RowCard({
  entry,
  rows,
  nameOf,
  t,
}: {
  entry: GearRow;
  rows: readonly GearRow[];
  nameOf: (row: GearRow) => string;
  t: GearT;
}) {
  const { character, content, system, editing } = useSheet();
  const { weight } = useSettings();
  const { row } = entry;
  const shown = shownWeight(entry.weight, weight);
  const act = (make: Parameters<typeof changeSheet>[1]) => void changeSheet(character, make);
  return (
    <Part
      as="li"
      name="card"
      data-uid={row.uid}
      className={`flex flex-col gap-2 px-3 py-2.5 ${INDENT[Math.min(entry.depth, INDENT.length - 1)]}`}
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 grow truncate text-15 font-semibold">{nameOf(entry)}</span>
        {row.qty > 1 && <span className="text-13 text-muted">{t('qty', { count: row.qty })}</span>}
        {entry.weight > 0 && (
          <span className="text-13 whitespace-nowrap text-muted">
            {t(`weight.${shown.unit}`, { value: shown.value })}
          </span>
        )}
      </div>
      {entry.holds > 0 && (
        <span className="text-12 text-muted">{t('holds', { count: entry.holds })}</span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Switch
          label={t('worn')}
          on={row.equipped}
          onToggle={() =>
            act((stamp) =>
              system.inventory.equip(
                character,
                content.index,
                { uid: row.uid, equipped: !row.equipped },
                stamp,
              ),
            )
          }
        />
        {entry.attunable && (
          <Switch
            label={t('attuned')}
            on={row.attuned}
            onToggle={() =>
              act((stamp) =>
                system.inventory.attune(
                  character,
                  content.index,
                  { uid: row.uid, attuned: !row.attuned },
                  stamp,
                ),
              )
            }
          />
        )}
        {editing && <PutIn entry={entry} rows={rows} nameOf={nameOf} t={t} />}
      </div>
    </Part>
  );
}

export function Items() {
  const { t } = useTranslation('gear');
  const { character, content, computed, system } = useSheet();
  const { weight } = useSettings();
  const headingId = useId();
  const find = useMemo(() => finderOf(character, content.index), [character, content]);
  const rows = gearRows(character, find, system.inventory);
  const warnings = gearWarnings(computed.warnings);

  const called = (id: string) => {
    const found = find(id);
    return found === undefined ? t('missing', { id }) : nameIn(found.name);
  };
  const nameOf = ({ name, row }: GearRow) =>
    name === undefined ? t('missing', { id: row.itemId }) : nameIn(name);

  const total = shownWeight(system.inventory.weight(character, find).total, weight);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5">
      <h2 id={headingId} className="text-12 tracking-wide text-muted uppercase">
        {t('title')}
      </h2>
      {warnings.length > 0 && (
        <Part name="panel" role="alert" className="bg-warn-bg px-3 py-2 text-14 text-warn-text">
          <ul className="flex flex-col gap-1">
            {warnings.map((warning) => (
              <li key={JSON.stringify(warning)}>
                {warning.key === 'attunementLimit' &&
                  t('warning.attunementLimit', {
                    attuned: warning.attuned,
                    limit: warning.limit,
                  })}
                {warning.key === 'attunementCopies' &&
                  t('warning.attunementCopies', {
                    attuned: warning.attuned,
                    name: called(warning.item),
                  })}
                {warning.key === 'oneAtATime' &&
                  t('warning.oneAtATime', {
                    name: called(warning.item),
                    worn: called(warning.worn),
                  })}
              </li>
            ))}
          </ul>
        </Part>
      )}
      {rows.length === 0 ? (
        <p className="text-15 text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((entry) => (
            <RowCard key={entry.row.uid} entry={entry} rows={rows} nameOf={nameOf} t={t} />
          ))}
        </ul>
      )}
      <p className="flex items-baseline justify-between text-14 text-muted">
        <span>{t('carried')}</span>
        <span className="font-semibold text-text">
          {t(`weight.${total.unit}`, { value: total.value })}
        </span>
      </p>
    </section>
  );
}
