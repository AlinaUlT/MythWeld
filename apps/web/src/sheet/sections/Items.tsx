// SHEET-50: the Gear tab's items (SPEC §7.2, board V3-Sheet): what the character carries, each row
// under the row it is inside, with its weight, a switch for worn and one for attuned, how many, where
// it is kept and a way to take it away. Worn and attuned change the AC and the attacks at once, as
// every number is read from `Computed`; the rules the equipment breaks, a fourth attunement or two
// armors worn, are warned in amber and never refused (SPEC §8.2). Every change is one change with
// its "Undo" toast. Adding an item from the packs is the creation form's (SHEET-28) and, later, the
// library's; a free-text item is SHEET-52's (the "+" in edit mode), and its words show under its name.
import { finderOf } from '@grimoire/engine';
import { Minus, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shownWeight } from '../../settings/units';
import { useSettings } from '../../settings/useSettings';
import { Description } from '../../shared/Description';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { nameIn } from '../names';
import { EditCustomPanel } from '../panels/EditCustomPanel';
import { useSheet } from '../SheetContext';
import { SwitchRow } from '../SwitchRow';

const stepper = 'flex size-control shrink-0 items-center justify-center text-text';

export function Items() {
  const { t } = useTranslation('gear');
  const { weight: unit } = useSettings();
  const { character, content, computed, editing, system } = useSheet();
  // SHEET-80: the uid of the custom row whose edit form is open.
  const [edited, setEdited] = useState<string | undefined>(undefined);
  const find = finderOf(character, content.index);
  const gear = system.gear(character, computed, find);
  const weightOf = (pounds: number) => {
    const shown = shownWeight(pounds, unit);
    return t(`weight.${shown.unit}`, { value: shown.value });
  };
  if (gear.rows.length === 0) return <p className="px-1 py-2 text-15 text-muted">{t('none')}</p>;

  /** The row's own name: its item's, a custom row's, or that its item is missing. */
  const nameOf = (row: (typeof gear.rows)[number]) => {
    if (row.customName !== undefined) return row.customName;
    const found = row.itemId === undefined ? undefined : find(row.itemId);
    return found === undefined ? t('missing', { id: row.itemId }) : nameIn(found.name);
  };
  /** The rows a row may be put inside: every other row that is not inside it. */
  const containersFor = (uid: string) => {
    const held = new Set<string>([uid]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const row of gear.rows) {
        if (row.container !== undefined && held.has(row.container) && !held.has(row.uid)) {
          held.add(row.uid);
          grew = true;
        }
      }
    }
    return gear.rows.filter((row) => !held.has(row.uid));
  };
  const run = (action: Parameters<typeof perform>[1]) =>
    perform(character, action).catch((error: unknown) => console.error(error));

  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col py-3"
      aria-label={t('title')}
    >
      <header className="flex flex-col gap-1.5 px-4 pb-2">
        <h2 className="font-heading text-18 font-bold">{t('title')}</h2>
        <p className="text-13 text-muted" data-testid="carried">
          {t('carrying', { weight: weightOf(gear.weight) })}
        </p>
        {gear.warnings.map((warning) => (
          <p
            // A rule that is broken twice (two armors) reads the same each time.
            key={`${warning.rule}:${Object.values(warning.data).join(':')}`}
            className="bg-warn-bg px-3 py-2 text-13 text-warn-text"
            role="alert"
          >
            {t(`warn.${warning.rule}`, { ...warning.data, defaultValue: warning.rule })}
          </p>
        ))}
      </header>
      <ul className="flex flex-col divide-y divide-line">
        {gear.rows.map((row) => {
          const name = nameOf(row);
          const found = row.itemId === undefined ? undefined : find(row.itemId);
          const label = { en: name };
          const each = row.weight;
          const line = [
            t('qty', { qty: row.qty }),
            ...(each === undefined ? [] : [weightOf(each * row.qty)]),
            ...(row.inside > 0 ? [t('inside', { count: row.inside })] : []),
          ].join(t('separator'));
          return (
            <li
              key={row.uid}
              data-row={row.uid}
              className="flex flex-col"
              style={{ paddingInlineStart: `${row.depth * 16}px` }}
            >
              {found === undefined ? (
                <div className="flex flex-col gap-0.5 px-4 py-2.5">
                  <span className="text-15 font-bold">{name}</span>
                  <span className="text-12 text-muted">{line}</span>
                </div>
              ) : (
                <Description entity={found}>{line}</Description>
              )}
              {row.note !== undefined && (
                <p
                  className="px-4 pb-2 text-13 whitespace-pre-line text-muted"
                  data-testid="row-note"
                >
                  {row.note}
                </p>
              )}
              <div className="flex flex-col gap-1 px-4 pb-3">
                {row.itemId !== undefined && (
                  <SwitchRow
                    label={t('worn')}
                    on={row.equipped}
                    onChange={(equipped) =>
                      run((stamp) =>
                        system.setRowEquipped(character, { uid: row.uid, equipped, label }, stamp),
                      )
                    }
                  />
                )}
                {(row.asksAttunement || row.attuned) && (
                  <SwitchRow
                    label={t('attuned')}
                    on={row.attuned}
                    onChange={(attuned) =>
                      run((stamp) =>
                        system.setRowAttuned(character, { uid: row.uid, attuned, label }, stamp),
                      )
                    }
                  />
                )}
                <div className="flex items-center gap-2">
                  <span className="grow text-14">{t('quantity')}</span>
                  <Part
                    as="button"
                    type="button"
                    name="button-secondary"
                    aria-label={t('less', { name })}
                    disabled={row.qty <= 1}
                    className={stepper}
                    onClick={() =>
                      run((stamp) =>
                        system.setRowQuantity(
                          character,
                          { uid: row.uid, qty: row.qty - 1, label },
                          stamp,
                        ),
                      )
                    }
                  >
                    <Minus aria-hidden className="size-5" />
                  </Part>
                  <span className="w-8 text-center text-16 font-bold" data-testid="row-qty">
                    {row.qty}
                  </span>
                  <Part
                    as="button"
                    type="button"
                    name="button-secondary"
                    aria-label={t('more', { name })}
                    className={stepper}
                    onClick={() =>
                      run((stamp) =>
                        system.setRowQuantity(
                          character,
                          { uid: row.uid, qty: row.qty + 1, label },
                          stamp,
                        ),
                      )
                    }
                  >
                    <Plus aria-hidden className="size-5" />
                  </Part>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={`in-${row.uid}`} className="text-14">
                    {t('keptIn')}
                  </label>
                  <Part
                    as="select"
                    id={`in-${row.uid}`}
                    name="field"
                    className="h-control min-w-0 grow bg-surface px-3 text-15 text-text"
                    value={row.container ?? ''}
                    onChange={(event: { target: { value: string } }) =>
                      run((stamp) =>
                        system.setRowContainer(
                          character,
                          { uid: row.uid, container: event.target.value || undefined, label },
                          stamp,
                        ),
                      )
                    }
                  >
                    <option value="">{t('noContainer')}</option>
                    {containersFor(row.uid).map((other) => (
                      <option key={other.uid} value={other.uid}>
                        {nameOf(other)}
                      </option>
                    ))}
                  </Part>
                  {editing && row.customName !== undefined && (
                    <Part
                      as="button"
                      type="button"
                      name="icon-button"
                      aria-label={t('edit', { name })}
                      className={stepper}
                      onClick={() => setEdited(row.uid)}
                    >
                      <Pencil aria-hidden className="size-5" />
                    </Part>
                  )}
                  <Part
                    as="button"
                    type="button"
                    name="icon-button"
                    aria-label={t('remove', { name })}
                    className={stepper}
                    onClick={() =>
                      run((stamp) =>
                        system.removeRow(character, content.index, { uid: row.uid, label }, stamp),
                      )
                    }
                  >
                    <X aria-hidden className="size-5" />
                  </Part>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {(() => {
        const row = gear.rows.find((each) => each.uid === edited);
        return row === undefined || row.customName === undefined ? null : (
          <EditCustomPanel
            target={{
              kind: 'item',
              uid: row.uid,
              name: row.customName,
              weight: row.weight,
              text: row.note ?? '',
            }}
            onClose={() => setEdited(undefined)}
          />
        );
      })()}
    </Part>
  );
}
