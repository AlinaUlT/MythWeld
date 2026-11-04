// SHEET-42: the conditions on the character (Main and Combat tabs, board V3-Sheet: "No conditions"
// and "Add"): a chip for each condition it has, with its level when it has levels. A chip opens its
// panel (description, level, "Remove"); "Add" opens the list to add one from. A condition another
// entry gives has a chip too, and says what gives it; a stored one no pack holds says "Missing".
// Exhaustion at its highest level is death in both editions and gives no number: the chip says so.
import { finderOf } from '@grimoire/engine';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { nameIn } from '../names';
import { AddConditionPanel, ConditionPanel } from '../panels/ConditionPanels';
import { useSheet } from '../SheetContext';

export function Conditions() {
  const { t } = useTranslation('conditions');
  const { character, content, computed, system } = useSheet();
  const [open, setOpen] = useState<{ kind: 'add' } | { kind: 'one'; id: string } | undefined>();
  const find = finderOf(character, content.index);
  const { had, missing } = system.conditions(character, computed, find);
  const close = () => setOpen(undefined);
  const chip = 'flex min-h-control items-center px-3 text-14 font-semibold';
  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col gap-2 p-4"
      aria-label={t('title')}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-18 font-bold">{t('title')}</h2>
        <button
          type="button"
          onClick={() => setOpen({ kind: 'add' })}
          className="flex min-h-control items-center rounded-button border border-strong px-4 text-15 font-semibold"
        >
          {t('add')}
        </button>
      </div>
      {had.length === 0 && missing.length === 0 ? (
        <p className="text-15 text-muted">{t('none')}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" data-testid="conditions">
          {had.map((one) => {
            const found = find(one.id);
            const name = found === undefined ? one.id : nameIn(found.name);
            const text = one.fatal
              ? t('chipDeath', { name })
              : one.withheld
                ? t('chipNoEffect', { name })
                : one.max > 1
                  ? t('chipLevel', { name, level: one.level })
                  : name;
            return (
              <li key={one.id} data-condition={one.id}>
                <Part
                  as="button"
                  type="button"
                  name="chip"
                  onClick={() => setOpen({ kind: 'one', id: one.id })}
                  className={`${chip} ${one.stored ? 'bg-strong text-on-strong' : 'bg-soft'}`}
                >
                  {text}
                </Part>
              </li>
            );
          })}
          {missing.map((id) => (
            <li key={id} data-condition={id}>
              <Part
                as="button"
                type="button"
                name="chip"
                onClick={() => setOpen({ kind: 'one', id })}
                className={`${chip} bg-warn-bg text-warn-text`}
              >
                {t('missing', { id })}
              </Part>
            </li>
          ))}
        </ul>
      )}
      {open?.kind === 'add' && <AddConditionPanel onClose={close} />}
      {open?.kind === 'one' && <ConditionPanel id={open.id} onClose={close} />}
    </Part>
  );
}
