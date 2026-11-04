// SHEET-52: "Add to the sheet" (ADR 009 item 7, SPEC §12 stage 2, board V3-Add), opened in edit mode
// by the "+" over the dock. A list of what can be added, and for each a form of free text: a custom
// item (a name, a weight, how many, its words) goes in the inventory; a custom feature (a name and
// its words) is a feat of the character's own. Neither has an effect: those are phase 5's. Each is
// one change with its "Undo" toast; the panel closes when it is made, and a refusal is said in
// the panel, never thrown.
// SHEET-57: the list also adds a section, a named list that becomes a tab (ADR 009 item 8), and a
// companion, an entry of a section with its small stat block as text. A section's own tab opens
// the entry form at once (`entryIn`). A new section, or an entry made from here, shows its tab.
import { addSection, addSectionEntry } from '@grimoire/engine';
import { ListPlus, Package, PawPrint, Sparkles } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { storedWeight } from '../../settings/units';
import { useSettings } from '../../settings/useSettings';
import { BottomSheet } from '../../shared/BottomSheet';
import { ActionRow } from '../../shared/CharacterActions';
import { typedNumber } from '../../shared/OverrideEditor';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { useSheet } from '../SheetContext';
import type { PanelProps } from './panel';

type View = 'menu' | 'item' | 'feature' | 'section' | 'entry';

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

export interface AddPanelProps extends PanelProps {
  /** The section whose tab opened the panel: it opens on a new entry for it. */
  entryIn?: string;
}

export function AddPanel({ onClose, entryIn }: AddPanelProps) {
  const { t } = useTranslation('add');
  const { character, system } = useSheet();
  const { weight: unit } = useSettings();
  const [, setSearch] = useSearchParams();
  const id = useId();
  const [view, setView] = useState<View>(entryIn === undefined ? 'menu' : 'entry');
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [count, setCount] = useState('1');
  const [text, setText] = useState('');
  const [picked, setPicked] = useState(entryIn ?? character.sections[0]?.id ?? '');
  const [refused, setRefused] = useState<string | undefined>(undefined);

  const typedWeight = typedPositive(weight);
  const qty = typedCount(count);
  const named = /\S/.test(name);
  const section = character.sections.find((each) => each.id === picked);
  const ready =
    named &&
    (view === 'feature' ||
      view === 'section' ||
      (view === 'item' && typedWeight !== undefined && qty !== undefined) ||
      (view === 'entry' && section !== undefined));

  const show = (next: View) => {
    setView(next);
    setRefused(undefined);
  };

  /** The tab of a section the person just made or filled, so the new thing shows. */
  const open = (tab: string) => setSearch({ tab }, { replace: true });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    const made = await perform(character, (stamp) => {
      switch (view) {
        case 'item':
          return system.addCustomItem(
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
          );
        case 'section':
          return addSection(character, { id: crypto.randomUUID(), name }, stamp);
        case 'entry':
          return addSectionEntry(
            character,
            { section: picked, id: crypto.randomUUID(), name, text },
            stamp,
          );
        default:
          return system.addCustomFeature(
            character,
            { slug: `custom-${crypto.randomUUID().slice(0, 8)}`, name, text },
            stamp,
          );
      }
    }).catch((error: unknown) => {
      console.error(error);
      return undefined;
    });
    if (made?.ok) {
      if (view === 'section') {
        // The new section is the last one of the stored list.
        const last = made.character.sections.at(-1);
        if (last !== undefined) open(last.id);
      } else if (view === 'entry' && entryIn === undefined) {
        open(picked);
      }
      onClose();
    } else setRefused(made !== undefined && 'code' in made ? made.code : 'other');
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
          <ActionRow
            icon={ListPlus}
            label={t('section.title')}
            note={t('section.note')}
            onClick={() => show('section')}
          />
          <ActionRow
            icon={PawPrint}
            label={t('entry.menu')}
            note={t('entry.note')}
            onClick={() => show('entry')}
          />
        </div>
      </BottomSheet>
    );
  }

  const textLabel = view === 'entry' ? t('entry.text') : t('text');
  const textHint = view === 'entry' ? t('entry.textPlaceholder') : t('textPlaceholder');
  return (
    <BottomSheet title={t(`${view}.title`)} onClose={onClose}>
      <form className="flex flex-col gap-3 pb-2" onSubmit={submit} aria-label={t(`${view}.title`)}>
        {view === 'entry' && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-section`} className="text-13 font-semibold text-muted">
              {t('entry.section')}
            </label>
            {character.sections.length === 0 ? (
              <p className="text-14 text-muted">{t('entry.noSections')}</p>
            ) : (
              <Part
                as="select"
                id={`${id}-section`}
                name="field"
                className={field}
                value={picked}
                onChange={(event: { target: { value: string } }) => setPicked(event.target.value)}
              >
                {character.sections.map((each) => (
                  <option key={each.id} value={each.id}>
                    {each.name}
                  </option>
                ))}
              </Part>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="text-13 font-semibold text-muted">
            {view === 'section' ? t('section.name') : t('name')}
          </label>
          <Part
            as="input"
            id={`${id}-name`}
            name="field"
            autoComplete="off"
            className={field}
            value={name}
            placeholder={view === 'section' ? t('section.placeholder') : undefined}
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
        {view !== 'section' && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-text`} className="text-13 font-semibold text-muted">
              {textLabel}
            </label>
            <Part
              as="textarea"
              id={`${id}-text`}
              name="field"
              className="min-h-24 w-full resize-y bg-surface p-3 text-16 text-text"
              value={text}
              placeholder={textHint}
              onChange={(event: { target: { value: string } }) => setText(event.target.value)}
            />
          </div>
        )}
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
            onClick={() => (entryIn === undefined ? show('menu') : onClose())}
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
