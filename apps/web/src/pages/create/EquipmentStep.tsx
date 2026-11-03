// SHEET-28: BRIEF P3 step 9: the starting inventory. An item is picked from the ticked packs (the
// rules base's, or every edition's when the form mixes) and listed with its quantity; the same item
// picked again adds one to its row. Each row shows its edition when mixing and warns when the item
// is of the other edition or no ticked pack holds it (ADR 005 item 3). Worn and attuned are set on
// the sheet's Gear tab (SHEET-50), never here.
import { Minus, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import {
  type DraftItem,
  MAX_ITEM_QTY,
  nameIn,
  optionsOf,
  type StepProps,
  withItem,
  withItemQty,
  withoutItem,
} from './draft';
import { entryOptions, Picker, Step, Warnings } from './Fields';
import { itemWarnings } from './warnings';

function ItemRow({ entry, props }: { entry: DraftItem; props: StepProps }) {
  const { draft, change, entities } = props;
  const { t } = useTranslation('create');
  const found = entities.find(({ id }) => id === entry.id);
  const name = found === undefined ? t('warn.missing', { id: entry.id }) : nameIn(found.name);
  const label =
    draft.mix && found !== undefined ? t('withEdition', { name, ruleset: found.ruleset }) : name;
  return (
    <Part as="li" name="panel" className="flex flex-col gap-2 p-3" aria-label={name}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 grow text-15 font-semibold">{label}</span>
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('equipment.less', { name })}
          disabled={entry.qty <= 1}
          className="flex size-control shrink-0 items-center justify-center text-text"
          onClick={() => change((now) => withItemQty(now, entry.id, -1))}
        >
          <Minus aria-hidden className="size-5" />
        </Part>
        <span className="w-8 shrink-0 text-center text-16 font-bold" data-testid="item-qty">
          {entry.qty}
        </span>
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('equipment.more', { name })}
          disabled={entry.qty >= MAX_ITEM_QTY}
          className="flex size-control shrink-0 items-center justify-center text-text"
          onClick={() => change((now) => withItemQty(now, entry.id, 1))}
        >
          <Plus aria-hidden className="size-5" />
        </Part>
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('equipment.remove', { name })}
          className="flex size-control shrink-0 items-center justify-center text-text"
          onClick={() => change((now) => withoutItem(now, entry.id))}
        >
          <X aria-hidden className="size-5" />
        </Part>
      </div>
      <Warnings warnings={itemWarnings(entities, draft, entry.id)} />
    </Part>
  );
}

export function EquipmentStep(props: StepProps) {
  const { draft, change, entities } = props;
  const { t } = useTranslation('create');
  const offered = optionsOf(entities, 'item', draft);
  return (
    <Step title={t('equipment.title')}>
      {draft.items.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {draft.items.map((entry) => (
            <ItemRow key={entry.uid} entry={entry} props={props} />
          ))}
        </ul>
      )}
      {offered.length > 0 ? (
        <Picker
          label={t('equipment.add')}
          value={undefined}
          none={t('equipment.pick')}
          options={entryOptions(offered, undefined, entities, draft.mix, t)}
          onPick={(id) => {
            if (id !== undefined) change((now) => withItem(now, id, crypto.randomUUID()));
          }}
        />
      ) : (
        <p className="text-14 text-muted">{t('equipment.none')}</p>
      )}
    </Step>
  );
}
