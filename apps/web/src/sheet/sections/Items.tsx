// SHEET-50: the Gear tab's items (SPEC §7.2 "Equipment", BRIEF P4): each row of the inventory with
// its worn and attuned switches, what it weighs, and what is inside it. Worn and attuned change
// AC and attacks at once, since the sheet reads `Computed`, and are play actions; putting a row
// inside another is the sheet's structure, so it waits for edit mode (SPEC §7.2). Every number is
// a `SheetNumber`; every change goes through `changeCharacter`, so "Undo" follows it. The warnings
// are the module's (SHEET-18, SHEET-63, ENG-44), said here, never a block (SPEC §8.2).
import { finderOf } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeCharacter } from '../../shared/undo';
import type { AppCharacter } from '../../systems';
import { Part } from '../../theme/Part';
import { useSheet } from '../SheetContext';
import { numberAt, SheetNumber } from '../SheetNumber';

type Row = AppCharacter['systemData']['inventory'][number];
type GearT = TFunction<'gear'>;

/** Why a change was not made, as the `problem` texts name it. */
type Problem = 'noRow' | 'noContainer' | 'insideItself' | 'changed';

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

/** The switch of a row: pressed when on. */
const switchClass = (on: boolean) =>
  `flex min-h-control min-w-control items-center justify-center px-3 text-14 font-semibold ${
    on ? 'bg-strong text-on-strong' : 'bg-soft text-muted'
  }`;

/** Rows by the row they are inside; `undefined` holds those carried loose. */
function childrenOf(rows: readonly Row[]): Map<string | undefined, Row[]> {
  const known = new Set(rows.map(({ uid }) => uid as string));
  const children = new Map<string | undefined, Row[]>();
  for (const row of rows) {
    // A container the inventory does not hold cannot be drawn, so its rows are carried loose.
    const parent =
      row.container !== undefined && known.has(row.container) ? row.container : undefined;
    children.set(parent, [...(children.get(parent) ?? []), row]);
  }
  return children;
}

/** The problem a refusal's code is told as; a refusal of the entry itself is a row that changed. */
function problemOf(code: string): Problem {
  return code === 'noRow' || code === 'noContainer' || code === 'insideItself' ? code : 'changed';
}

/** What the gear tab does: names, the finder, and the one way every change is made. */
function useGear() {
  const sheet = useSheet();
  const { character, content, system } = sheet;
  const [problem, setProblem] = useState<Problem | undefined>(undefined);
  const find = finderOf(character, content.index);

  /** The name of the entity `id`, or the Missing text; a custom row is named by the caller. */
  const nameOfId = (id: string, t: GearT) => {
    const entity = find(id);
    return entity === undefined ? t('missing', { id }) : nameIn(entity.name);
  };
  const nameOfRow = (row: Row, t: GearT) => {
    if (row.custom !== undefined) return row.custom.name;
    return row.itemId === undefined ? '' : nameOfId(row.itemId, t);
  };

  /** Makes an action's entry for the stamp of now, and writes it; says why when it does not. */
  const change = async (
    make: (stamp: {
      id: string;
      at: string;
      by: { role: 'player'; name: string; actorId: string };
    }) => ReturnType<typeof system.inventory.setEquipped>,
  ) => {
    const stamp = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      by: { role: 'player' as const, name: character.name, actorId: character.id },
    };
    const made = make(stamp);
    if (!made.ok) {
      // A change that changes nothing is not a problem; the switch already shows it.
      setProblem(made.code === 'unchanged' ? undefined : problemOf(made.code));
      return;
    }
    const written = await changeCharacter(character.id, made.entry);
    setProblem(written.ok ? undefined : 'changed');
  };

  return { ...sheet, find, problem, change, nameOfId, nameOfRow };
}

type Gear = ReturnType<typeof useGear>;

function Weight({ path, label, gear }: { path: string; label: string; gear: Gear }) {
  const { t } = useTranslation('gear');
  if ((numberAt(gear.computed, path) ?? 0) === 0) return <span aria-hidden>{t('noWeight')}</span>;
  return <SheetNumber path={path} label={label} format="weight" labelClassName="sr-only" />;
}

function RowView({
  row,
  tree,
  gear,
}: {
  row: Row;
  tree: Map<string | undefined, Row[]>;
  gear: Gear;
}) {
  const { t } = useTranslation('gear');
  const { character, system, editing, find, change } = gear;
  const { inventory } = system;
  const name = gear.nameOfRow(row, t);
  const inside = tree.get(row.uid) ?? [];
  const known = row.itemId !== undefined && find(row.itemId) !== undefined;
  // A switch for attunement: for an item that needs it, for a row already attuned so it can be
  // ended, and for a row whose item is not known (a custom row, a missing item).
  const attunable = !known || row.attuned || inventory.needsAttunement(find(row.itemId ?? ''));
  return (
    <li className="flex flex-col gap-2" data-row={row.uid}>
      <Part name="card" fill="card" className="flex flex-col gap-2 px-3 py-2.5">
        <div className="flex items-baseline gap-2 text-15">
          <span className="min-w-0 grow truncate font-semibold">{name}</span>
          {row.qty !== 1 && <span className="text-muted">{t('quantity', { count: row.qty })}</span>}
          <span className="shrink-0 text-14 text-muted">
            <Weight path={inventory.rowWeightPath(row.uid)} label={t('weight')} gear={gear} />
          </span>
        </div>
        {inside.length > 0 && (
          <div className="flex items-baseline gap-2 text-13 text-muted">
            <span>{t('holds')}</span>
            <Weight path={inventory.containedWeightPath(row.uid)} label={t('holds')} gear={gear} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Part
            as="button"
            type="button"
            name="chip"
            aria-pressed={row.equipped}
            aria-label={t('wornFor', { name })}
            onClick={() =>
              change((stamp) =>
                inventory.setEquipped(character, find, row.uid, !row.equipped, stamp),
              )
            }
            className={switchClass(row.equipped)}
          >
            {t('worn')}
          </Part>
          {attunable && (
            <Part
              as="button"
              type="button"
              name="chip"
              aria-pressed={row.attuned}
              aria-label={t('attunedFor', { name })}
              onClick={() =>
                change((stamp) =>
                  inventory.setAttuned(character, find, row.uid, !row.attuned, stamp),
                )
              }
              className={switchClass(row.attuned)}
            >
              {t('attuned')}
            </Part>
          )}
          {editing && <Container row={row} name={name} gear={gear} />}
        </div>
      </Part>
      {inside.length > 0 && (
        <ul className="ml-4 flex flex-col gap-2 border-l border-line pl-3">
          {inside.map((each) => (
            <RowView key={each.uid} row={each} tree={tree} gear={gear} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The select that puts the row inside another, or carries it loose. */
function Container({ row, name, gear }: { row: Row; name: string; gear: Gear }) {
  const { t } = useTranslation('gear');
  const { character, system, find, change } = gear;
  const others = character.systemData.inventory.filter(({ uid }) => uid !== row.uid);
  if (others.length === 0) return null;
  return (
    <select
      aria-label={t('insideFor', { name })}
      value={row.container ?? ''}
      onChange={(event) =>
        change((stamp) =>
          system.inventory.moveItem(
            character,
            find,
            row.uid,
            event.target.value === '' ? undefined : event.target.value,
            stamp,
          ),
        )
      }
      className="h-control min-w-0 grow rounded-field border border-line bg-surface px-3 text-14 text-text"
    >
      <option value="">{t('loose')}</option>
      {others.map((each) => (
        <option key={each.uid} value={each.uid}>
          {t('inside', { name: gear.nameOfRow(each, t) })}
        </option>
      ))}
    </select>
  );
}

function Warnings({ gear }: { gear: Gear }) {
  const { t } = useTranslation('gear');
  const warnings = gear.system.inventory.warnings(gear.computed);
  return warnings.map((warning) => {
    const text =
      warning.rule === 'attunementLimit'
        ? t('warn.attunementLimit', { attuned: warning.attuned, limit: warning.limit })
        : warning.rule === 'attunementCopies'
          ? t('warn.attunementCopies', {
              name: gear.nameOfId(warning.itemId, t),
              attuned: warning.attuned,
            })
          : t('warn.oneAtATime', {
              item: gear.nameOfId(warning.item, t),
              worn: gear.nameOfId(warning.worn, t),
            });
    return (
      <Part
        key={text}
        name="panel"
        role="alert"
        className="bg-warn-bg px-3 py-2 text-14 text-warn-text"
      >
        {text}
      </Part>
    );
  });
}

export function Items() {
  const { t } = useTranslation('gear');
  const gear = useGear();
  const { character, system, problem } = gear;
  const rows = character.systemData.inventory;
  const tree = childrenOf(rows);
  const attuned = rows.filter((row) => row.attuned).length;
  return (
    <section aria-labelledby="gear-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="gear-title" className="font-heading text-18 font-bold">
          {t('title')}
        </h2>
        <span className="text-13 text-muted">
          {t('attunedCount', { count: attuned, limit: system.inventory.attunementLimit })}
        </span>
      </div>
      <SheetNumber
        path={system.inventory.carriedPath}
        label={t('carried')}
        format="weight"
        className="flex items-baseline gap-2 text-15 select-none"
        labelClassName="text-muted"
        valueClassName="font-bold"
      />
      <Warnings gear={gear} />
      {problem !== undefined && (
        <Part name="panel" role="alert" className="bg-warn-bg px-3 py-2 text-14 text-warn-text">
          {t(`problem.${problem}`)}
        </Part>
      )}
      {rows.length === 0 ? (
        <p className="text-15 text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(tree.get(undefined) ?? []).map((row) => (
            <RowView key={row.uid} row={row} tree={tree} gear={gear} />
          ))}
        </ul>
      )}
    </section>
  );
}
