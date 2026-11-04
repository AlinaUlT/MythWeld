// SHEET-52: "Add to the sheet" (ADR 009 item 7, SPEC §12 stage 2, board V3-Add), opened in edit mode
// by the "+" over the dock. A list of what can be added, and for each a form of free text: a custom
// item (a name, a weight, how many, its words) goes in the inventory; a custom feature (a name and
// its words) is a feat of the character's own. Neither has an effect: those are phase 5's. Each is
// one change with its "Undo" toast; the panel closes when it is made, and a refusal is said in
// the panel, never thrown. Sections and companions (SHEET-57) join the list in their row.
import { Package, Sparkles } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { storedWeight } from '../../settings/units';
import { useSettings } from '../../settings/useSettings';
import { BottomSheet } from '../../shared/BottomSheet';
import { ActionRow } from '../../shared/CharacterActions';
import { typedNumber } from '../../shared/OverrideEditor';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { useSheet } from '../SheetContext';
import type { PanelProps } from './panel';

type View = 'menu' | 'item' | 'feature';

const field = 'h-control w-full bg-surface px-3 text-16 text-text';

/** The most of one item a form adds: three digits, as the creation form's stepper. */
const MOST = 999;

/** How many a text means: a whole number from 1; none when it is not one. */
function typedCount(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return undefined;
  const count = Number(trimmed);
  return count >= 1 && count <= MOST ? count : undefined;
}

/** The weight a text means, above 0; `null` for an empty text (no weight), `undefined` when bad. */
function typedPositive(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const value = typedNumber(text);
  return value !== undefined && value > 0 ? value : undefined;
}

export function AddPanel({ onClose }: PanelProps) {
  const { t } = useTranslation('add');
  const { character, system } = useSheet();
  const { weight: unit } = useSettings();
  const id = useId();
  const [view, setView] = useState<View>('menu');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [count, setCount] = useState('1');
  const [text, setText] = useState('');
  const [refused, setRefused] = useState<string | undefined>(undefined);

  const typedWeight = typedPositive(weight);
  const qty = typedCount(count);
  const named = /\S/.test(name);
  const ready = named && (view === 'feature' || (typedWeight !== undefined && qty !== undefined));

  const show = (next: View) => {
    setView(next);
    setRefused(undefined);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    const made = await perform(character, (stamp) =>
      view === 'item'
        ? system.addCustomItem(
            character,
            {
              uid: crypto.randomUUID(),
              name,
              weight:
                typedWeight === null || typedWeight === undefined
                  ? undefined
                  : storedWeight(typedWeight, unit),
              qty: qty ?? 1,
              text,
            },
            stamp,
          )
        : system.addCustomFeature(
            character,
            { slug: `custom-${crypto.randomUUID().slice(0, 8)}`, name, text },
            stamp,
          ),
    ).catch((error: unknown) => {
      console.error(error);
      return undefined;
    });
    if (made?.ok) onClose();
    else setRefused(made !== undefined && 'code' in made ? made.code : 'other');
  };

  if (view === 'menu') {
    return (
      <BottomSheet title={t('title')} onClose={onClose}>
        <div className="-mx-5 flex flex-col pb-2" data-testid="add-menu">
          <ActionRow
            icon={Package}
            label={t('item.title')}
            note={t('item.note')}
            onClick={() => show('item')}
          />
          <ActionRow
            icon={Sparkles}
            label={t('feature.title')}
            note={t('feature.note')}
            onClick={() => show('feature')}
          />
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title={t(`${view}.title`)} onClose={onClose}>
      <form className="flex flex-col gap-3 pb-2" onSubmit={submit} aria-label={t(`${view}.title`)}>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="text-13 font-semibold text-muted">
            {t('name')}
          </label>
          <Part
            as="input"
            id={`${id}-name`}
            name="field"
            autoComplete="off"
            className={field}
            value={name}
            onChange={(event: { target: { value: string } }) => setName(event.target.value)}
          />
        </div>
        {view === 'item' && (
          <div className="flex gap-3">
            <div className="flex min-w-0 grow basis-0 flex-col gap-1">
              <label htmlFor={`${id}-weight`} className="text-13 font-semibold text-muted">
                {t('weight', { unit })}
              </label>
              <Part
                as="input"
                id={`${id}-weight`}
                name="field"
                inputMode="decimal"
                autoComplete="off"
                className={field}
                value={weight}
                aria-invalid={typedWeight === undefined}
                onChange={(event: { target: { value: string } }) => setWeight(event.target.value)}
              />
            </div>
            <div className="flex w-24 shrink-0 flex-col gap-1">
              <label htmlFor={`${id}-count`} className="text-13 font-semibold text-muted">
                {t('quantity')}
              </label>
              <Part
                as="input"
                id={`${id}-count`}
                name="field"
                inputMode="numeric"
                autoComplete="off"
                className={field}
                value={count}
                aria-invalid={qty === undefined}
                onChange={(event: { target: { value: string } }) => setCount(event.target.value)}
              />
            </div>
          </div>
        )}
        {view === 'item' && <p className="-mt-1.5 text-12 text-muted">{t('weightHint')}</p>}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-text`} className="text-13 font-semibold text-muted">
            {t('text')}
          </label>
          <Part
            as="textarea"
            id={`${id}-text`}
            name="field"
            className="min-h-24 w-full resize-y bg-surface p-3 text-16 text-text"
            value={text}
            placeholder={t('textPlaceholder')}
            onChange={(event: { target: { value: string } }) => setText(event.target.value)}
          />
        </div>
        {refused !== undefined && (
          <p className="bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
            {t(`refused.${refused}`, { defaultValue: t('refused.other') })}
          </p>
        )}
        <div className="flex gap-2">
          <Part
            as="button"
            type="button"
            name="button-secondary"
            className="h-control grow px-4 text-16"
            onClick={() => show('menu')}
          >
            {t('back')}
          </Part>
          <Part
            as="button"
            type="submit"
            name="button"
            fill="button"
            disabled={!ready}
            className="h-control grow px-4 text-16 font-bold text-on-strong"
          >
            {t('add')}
          </Part>
        </div>
      </form>
    </BottomSheet>
  );
}
