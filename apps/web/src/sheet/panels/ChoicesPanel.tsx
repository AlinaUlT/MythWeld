// SHEET-36: every choice the character has not made, the list the choices badge opens (SPEC §7.2,
// "What needs choosing"). A bottom sheet over the sheet: one row per choice, with its source and
// how much of it is picked; a row opens that choice's options. The person picks, then "Choose"
// stores the answer as one change, so the "Undo" toast follows it. A choice made leaves the list;
// when the list is empty it says so. The frame mounts it while it is open (SHEET-30).
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { en } from '../../i18n/namespaces';
import { changeCharacter } from '../../shared/undo';
import { Part } from '../../theme/Part';
import { useSheet } from '../SheetContext';
import {
  type Ask,
  answerEntry,
  answers,
  asksOf,
  nameIn,
  offeredOf,
  placed,
  storable,
  toggled,
  wordsOf,
} from './choices';
import type { PanelProps } from './panel';

type WhatKey = keyof typeof en.choices.what;

/** The word for what a choice picks; `other` when the locale has none of its own. */
export function whatKeyOf(what: string): WhatKey {
  return Object.hasOwn(en.choices.what, what) ? (what as WhatKey) : 'other';
}

/** The name of an option: its entry's name, or its key as words, or "Missing" for an unknown id. */
function useOptionName(ask: Ask): (option: string) => string {
  const { t } = useTranslation('choices');
  const { computed, content } = useSheet();
  return (option) => {
    if (!ask.keyed) {
      const found = content.index.get(option);
      return found.ok ? nameIn(found.entity.name) : t('missing', { id: option });
    }
    const entry = ask.type === undefined ? undefined : computed.byKey[ask.type]?.[option];
    return entry === undefined ? wordsOf(option) : nameIn(entry.name);
  };
}

/** The name of the entity that asks, when the content has it. */
function useSourceName(source: string | undefined): string | undefined {
  const { content } = useSheet();
  if (source === undefined) return undefined;
  const found = content.index.get(source);
  return found.ok ? nameIn(found.entity.name) : undefined;
}

const row = 'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left';

function AskRow({ ask, onOpen }: { ask: Ask; onOpen: () => void }) {
  const { t } = useTranslation('choices');
  const source = useSourceName(ask.source);
  return (
    <Part
      as="button"
      type="button"
      name="card"
      fill="card"
      onClick={onOpen}
      className={`${row} justify-between`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-16 font-semibold">{t(`what.${whatKeyOf(ask.what)}`)}</span>
        {source !== undefined && <span className="truncate text-14 text-muted">{source}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-14 text-muted">
        {t('progress', { done: ask.chosen.length, count: ask.max })}
        <ChevronRight aria-hidden className="size-4" />
      </span>
    </Part>
  );
}

/** A distribution's ways of placing its numbers, written for the hint under its title. */
function waysOf(ask: Ask, t: (key: 'bonus' | 'ways', values: Record<string, unknown>) => string) {
  return (ask.patterns ?? []).map((pattern) =>
    t('ways', {
      count: pattern.length,
      numbers: pattern.map((value) => t('bonus', { value })).join(' '),
    }),
  );
}

function OptionRow({
  label,
  selected,
  rank,
  number,
  disabled,
  onToggle,
}: {
  label: string;
  selected: boolean;
  /** The place in the order picked, for a distribution. */
  rank: number | undefined;
  /** The number the distribution gives it, once the picks answer. */
  number: number | undefined;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('choices');
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      className={`${row} border-b border-line disabled:text-muted`}
    >
      <span
        aria-hidden
        className={`flex size-6 shrink-0 items-center justify-center rounded-pill border text-12 font-bold ${selected ? 'border-strong bg-strong text-on-strong' : 'border-muted'}`}
      >
        {selected && (rank !== undefined ? rank : <Check className="size-4" />)}
      </span>
      <span className="grow text-16">{label}</span>
      {selected && number !== undefined && (
        <span className="shrink-0 text-16 font-bold">{t('bonus', { value: number })}</span>
      )}
    </button>
  );
}

function AskDetail({ ask, onBack }: { ask: Ask; onBack: () => void }) {
  const { t } = useTranslation('choices');
  const { character } = useSheet();
  const nameOf = useOptionName(ask);
  const [picks, setPicks] = useState<readonly string[]>(ask.chosen);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const distribution = ask.patterns !== undefined;
  const numbers = placed(ask, picks);
  const ready = answers(ask, picks) && storable(ask) && !saving;

  const save = async () => {
    setSaving(true);
    setFailed(false);
    const entry = answerEntry(character, ask, picks, {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
    });
    const result = await changeCharacter(character.id, entry);
    setSaving(false);
    if (result.ok) onBack();
    else setFailed(true);
  };

  return (
    <>
      <p className="px-4 text-14 text-muted">
        {distribution ? t('pickInOrder') : t('pick', { count: ask.max })}
      </p>
      {distribution && (
        <ul className="px-4 pb-1 text-14 text-muted">
          {waysOf(ask, t).map((way) => (
            <li key={way}>{way}</li>
          ))}
        </ul>
      )}
      <fieldset className="mt-1 flex flex-col">
        <legend className="sr-only">{t(`what.${whatKeyOf(ask.what)}`)}</legend>
        {offeredOf(ask).map((option) => {
          const at = picks.indexOf(option);
          const selected = at !== -1;
          return (
            <OptionRow
              key={option}
              label={nameOf(option)}
              selected={selected}
              rank={distribution && selected ? at + 1 : undefined}
              number={selected ? numbers[at] : undefined}
              disabled={!selected && picks.length >= ask.max && ask.max > 1}
              onToggle={() => setPicks(toggled(ask, picks, option))}
            />
          );
        })}
      </fieldset>
      {ask.short > 0 && (
        <Part
          name="panel"
          className="mx-4 mt-2 bg-warn-bg px-3 py-2 text-14 text-warn-text"
          role="status"
        >
          {t('short', { count: ask.short })}
        </Part>
      )}
      {!storable(ask) && (
        <Part
          name="panel"
          className="mx-4 mt-2 bg-warn-bg px-3 py-2 text-14 text-warn-text"
          role="status"
        >
          {t('noPlace')}
        </Part>
      )}
      {failed && (
        <Part
          name="panel"
          className="mx-4 mt-2 bg-warn-bg px-3 py-2 text-14 text-warn-text"
          role="alert"
        >
          {t('failed')}
        </Part>
      )}
      <div className="p-4">
        <Part
          as="button"
          type="button"
          name="button"
          fill="button"
          disabled={!ready}
          onClick={save}
          className="flex h-control-lg w-full items-center justify-center px-5 text-16 font-semibold text-on-strong disabled:opacity-50"
        >
          {t('confirm')}
        </Part>
      </div>
    </>
  );
}

export function ChoicesPanel({ onClose }: PanelProps) {
  const { t } = useTranslation('choices');
  const { computed, content, system } = useSheet();
  const titleId = useId();
  const asks = useMemo(
    () =>
      asksOf(computed, system, (id) => {
        const found = content.index.get(id);
        return found.ok ? found.entity.type : undefined;
      }),
    [computed, content, system],
  );
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  // A choice made leaves the list, so the one open may be gone: the list shows again.
  const open = asks.find(({ id }) => id === openId);
  const source = useSourceName(open?.source);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t('close')}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-scrim"
      />
      <Part
        name="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85dvh] flex-col bg-surface"
      >
        <header className="flex h-14 shrink-0 items-center gap-1 pl-2">
          {open !== undefined && (
            <Part
              as="button"
              type="button"
              name="icon-button"
              aria-label={t('back')}
              onClick={() => setOpenId(undefined)}
              className="flex size-control shrink-0 items-center justify-center text-text"
            >
              <ChevronLeft aria-hidden className="size-[22px]" />
            </Part>
          )}
          <h2 id={titleId} className="min-w-0 grow pl-2 font-heading text-24 font-bold">
            {open === undefined ? (
              t('title')
            ) : (
              <>
                <span className="block truncate">{t(`what.${whatKeyOf(open.what)}`)}</span>
                {source !== undefined && (
                  <span className="block truncate text-14 font-normal text-muted">{source}</span>
                )}
              </>
            )}
          </h2>
          <Part
            as="button"
            type="button"
            name="icon-button"
            aria-label={t('close')}
            onClick={onClose}
            className="mr-1 flex size-control shrink-0 items-center justify-center text-text"
          >
            <X aria-hidden className="size-[22px]" />
          </Part>
        </header>
        <div className="flex min-h-0 grow flex-col overflow-y-auto pb-2">
          {open !== undefined ? (
            <AskDetail key={open.id} ask={open} onBack={() => setOpenId(undefined)} />
          ) : asks.length === 0 ? (
            <p className="px-4 py-6 text-15 text-muted">{t('empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2 px-4 pb-2">
              {asks.map((ask) => (
                <li key={ask.id}>
                  <AskRow ask={ask} onOpen={() => setOpenId(ask.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Part>
    </div>
  );
}
