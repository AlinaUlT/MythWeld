// SHEET-28: BRIEF P3 step 9: the starting inventory. An item is picked from the ticked packs and
// added as a row of one; picking an item already listed adds one to its row. Each row shows the
// item's edition (ADR 005 item 3.5), its quantity, and a tick for "worn", which `compute()` reads
// (an armor worn gives the AC, ENG-44). Nothing is attuned here: attunement, containers and coins
// are the Gear tab's (SHEET-50, SHEET-51). A row whose item no pack holds any more, or whose
// edition does not fit, stays and warns under itself.
import { Minus, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { type DraftItem, MAX_QTY, nameIn, optionsOf, type StepProps, withItem } from './draft';
import { entryOptions, Picker, Step, Tick, Warnings } from './Fields';
import { itemWarnings } from './warnings';

function ItemRow({ item, props }: { item: DraftItem; props: StepProps }) {
  const { draft, change, entities } = props;
  const { t } = useTranslation('create');
  const found = entities.find((entity) => entity.id === item.id);
  const name =
    found === undefined
      ? t('warn.missing', { id: item.id })
      : t('withEdition', { name: nameIn(found.name), ruleset: found.ruleset });
  const replace = (next: DraftItem) =>
    change((now) => ({
      ...now,
      items: now.items.map((each) => (each.uid === item.uid ? next : each)),
    }));
  return (
    <Part
      as="li"
      name="panel"
      className="flex flex-col gap-2 p-3"
      aria-label={t('equipment.row', { name })}
    >
      <div className="flex items-center gap-2">
        <span className="grow text-15 font-semibold">{name}</span>
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('equipment.remove', { name })}
          className="flex size-control shrink-0 items-center justify-center text-text"
          onClick={() =>
            change((now) => ({ ...now, items: now.items.filter((each) => each.uid !== item.uid) }))
          }
        >
          <X aria-hidden className="size-5" />
        </Part>
      </div>
      <div className="flex items-center gap-2">
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('equipment.less', { name })}
          disabled={item.qty <= 1}
          className="flex size-control shrink-0 items-center justify-center text-text disabled:text-muted"
          onClick={() => replace({ ...item, qty: item.qty - 1 })}
        >
          <Minus aria-hidden className="size-5" />
        </Part>
        <span className="min-w-8 text-center text-16 font-semibold" aria-live="polite">
          {t('equipment.qty', { qty: item.qty })}
        </span>
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('equipment.more', { name })}
          disabled={item.qty >= MAX_QTY}
          className="flex size-control shrink-0 items-center justify-center text-text disabled:text-muted"
          onClick={() => replace({ ...item, qty: item.qty + 1 })}
        >
          <Plus aria-hidden className="size-5" />
        </Part>
        <div className="ml-auto">
          <Tick
            label={t('equipment.worn')}
            checked={item.equipped}
            onChange={(equipped) => replace({ ...item, equipped })}
          />
        </div>
      </div>
      <Warnings warnings={itemWarnings(entities, item.id, draft)} />
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
          {draft.items.map((item) => (
            <ItemRow key={item.uid} item={item} props={props} />
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
