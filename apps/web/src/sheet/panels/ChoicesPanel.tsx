// SHEET-36: "What needs choosing" (SPEC §7.2), the list the choices badge opens: every pending
// choice of the grants and every key path not chosen yet (a size), each answered from its list.
// An answer is a change to the stored character (`changeCharacter`), so the toast offers "Undo"
// and the card, then the badge, follow the stored character. The frame mounts it while it is open.
import { Check, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { en } from '../../i18n/namespaces';
import { changeCharacter } from '../../shared/undo';
import { Part } from '../../theme/Part';
import {
  type ChoiceOption,
  type ChoiceRow,
  choiceRows,
  type DistributeRow,
  type KeyRow,
  keyEntry,
  type PickRow,
  patternWords,
  pickEntry,
  stampFor,
} from '../choices';
import { type SheetValue, useSheet } from '../SheetContext';
import type { PanelProps } from './panel';

const optionButton = 'flex min-h-control items-center gap-2 px-3.5 text-left text-15 font-semibold';
const label = 'text-12 font-semibold tracking-wide text-muted uppercase';

type KindKey = keyof typeof en.choices.kind;

/** The words for what a choice picks; a kind with none of its own reads as `other`. */
export function kindKeyOf(what: string): KindKey {
  return Object.hasOwn(en.choices.kind, what) ? (what as KindKey) : 'other';
}

/** What a card does with an answer: store it, or say it could not. */
type Store = (entry: () => ReturnType<typeof pickEntry> | undefined) => void;

function Name({ option }: { option: ChoiceOption }) {
  const { t } = useTranslation('choices');
  return <>{option.missing ? t('missing', { id: option.name }) : option.name}</>;
}

function Options({
  options,
  busy,
  onPick,
}: {
  options: readonly ChoiceOption[];
  busy: boolean;
  onPick: (option: ChoiceOption) => void;
}) {
  const { t } = useTranslation('choices');
  if (options.length === 0) return <p className="text-14 text-muted">{t('noOptions')}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {options.map((option) => (
        <li key={option.value}>
          <Part
            as="button"
            type="button"
            name="button-secondary"
            disabled={busy}
            aria-label={t('choose', { name: option.name })}
            onClick={() => onPick(option)}
            className={`${optionButton} text-text disabled:text-muted`}
          >
            <Name option={option} />
          </Part>
        </li>
      ))}
    </ul>
  );
}

function Chosen({
  options,
  numbers,
  busy,
  onRemove,
}: {
  options: readonly ChoiceOption[];
  numbers?: readonly number[];
  busy: boolean;
  onRemove: (option: ChoiceOption) => void;
}) {
  const { t } = useTranslation('choices');
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className={label}>{t('chosen')}</h4>
      <ul className="flex flex-wrap gap-2">
        {options.map((option, at) => (
          <li key={option.value}>
            <Part
              as="button"
              type="button"
              name="button"
              fill="button"
              disabled={busy}
              aria-label={t('remove', { name: option.name })}
              onClick={() => onRemove(option)}
              className={`${optionButton} text-on-strong`}
            >
              <Check aria-hidden className="size-4" />
              <span>
                <Name option={option} />
                {numbers?.[at] !== undefined && ` +${numbers[at]}`}
              </span>
              <X aria-hidden className="size-4" />
            </Part>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({
  title,
  what,
  left,
  children,
}: {
  title?: string;
  what: string;
  left?: number;
  children: ReactNode;
}) {
  const { t } = useTranslation('choices');
  return (
    <Part as="li" name="card" fill="card" className="flex flex-col gap-3 p-4">
      <header className="flex flex-col gap-0.5">
        {title !== undefined && <h3 className="font-heading text-18 font-bold">{title}</h3>}
        <p className="text-13 text-muted">
          {t(`kind.${kindKeyOf(what)}`)}
          {left !== undefined && `${t('separator')}${t('left', { count: left })}`}
        </p>
      </header>
      {children}
    </Part>
  );
}

function PickCard({
  row,
  sheet,
  busy,
  store,
}: {
  row: PickRow;
  sheet: SheetValue;
  busy: boolean;
  store: Store;
}) {
  const items = row.chosen.map(({ value }) => value);
  return (
    <Card title={row.source} what={row.what} left={row.left}>
      <Chosen
        options={row.chosen}
        busy={busy}
        onRemove={({ value }) =>
          store(() =>
            pickEntry(
              sheet,
              row,
              items.filter((item) => item !== value),
              stampFor(sheet, crypto.randomUUID(), new Date().toISOString()),
            ),
          )
        }
      />
      <Options
        options={row.options}
        busy={busy}
        onPick={({ value }) =>
          store(() =>
            pickEntry(
              sheet,
              row,
              [...items, value],
              stampFor(sheet, crypto.randomUUID(), new Date().toISOString()),
            ),
          )
        }
      />
    </Card>
  );
}

function DistributeCard({
  row,
  sheet,
  busy,
  store,
}: {
  row: DistributeRow;
  sheet: SheetValue;
  busy: boolean;
  store: Store;
}) {
  const { t } = useTranslation('choices');
  const [pattern, setPattern] = useState<number | undefined>(
    row.patterns.length === 1 ? 0 : undefined,
  );
  const [picks, setPicks] = useState<readonly string[]>([]);
  const numbers = (pattern === undefined ? undefined : row.patterns[pattern]) ?? [];
  const every = [...row.chosen, ...row.options];
  const named = (values: readonly string[]) =>
    values.flatMap((value) => every.find((option) => option.value === value) ?? []);
  const place = ({ value }: ChoiceOption) => {
    const next = [...picks, value];
    if (next.length < numbers.length) {
      setPicks(next);
      return;
    }
    setPicks([]);
    store(() =>
      pickEntry(sheet, row, next, stampFor(sheet, crypto.randomUUID(), new Date().toISOString())),
    );
  };
  return (
    <Card title={row.source} what={row.what}>
      {row.patterns.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className={label}>{t('pattern')}</legend>
          <div className="flex flex-wrap gap-2">
            {row.patterns.map((each, at) => (
              <Part
                // The patterns are fixed by the grant, so their place is their key.
                key={patternWords(each)}
                as="button"
                type="button"
                name="button-secondary"
                aria-pressed={pattern === at}
                onClick={() => {
                  setPattern(at);
                  setPicks([]);
                }}
                className={`${optionButton} ${pattern === at ? 'text-strong' : 'text-text'}`}
              >
                {patternWords(each)}
              </Part>
            ))}
          </div>
        </fieldset>
      )}
      {pattern !== undefined && (
        <>
          <Chosen
            options={named(picks)}
            numbers={numbers}
            busy={busy}
            onRemove={({ value }) => setPicks(picks.filter((pick) => pick !== value))}
          />
          <Options
            options={every.filter(({ value }) => !picks.includes(value))}
            busy={busy}
            onPick={place}
          />
        </>
      )}
    </Card>
  );
}

function KeyCard({
  row,
  sheet,
  busy,
  store,
}: {
  row: KeyRow;
  sheet: SheetValue;
  busy: boolean;
  store: Store;
}) {
  return (
    <Card what={row.what}>
      <Options
        options={row.answer === undefined ? [] : row.options}
        busy={busy}
        onPick={(option) =>
          store(() =>
            keyEntry(
              sheet,
              row,
              option,
              stampFor(sheet, crypto.randomUUID(), new Date().toISOString()),
            ),
          )
        }
      />
    </Card>
  );
}

function CardOf({
  row,
  sheet,
  busy,
  store,
}: {
  row: ChoiceRow;
  sheet: SheetValue;
  busy: boolean;
  store: Store;
}) {
  switch (row.kind) {
    case 'pick':
      return <PickCard row={row} sheet={sheet} busy={busy} store={store} />;
    case 'distribute':
      return <DistributeCard row={row} sheet={sheet} busy={busy} store={store} />;
    case 'key':
      return <KeyCard row={row} sheet={sheet} busy={busy} store={store} />;
  }
}

export function ChoicesPanel({ onClose }: PanelProps) {
  const { t } = useTranslation('choices');
  const sheet = useSheet();
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  const rows = choiceRows(sheet);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const store: Store = (made) => {
    const entry = made();
    if (entry === undefined) return;
    setBusy(true);
    setRefused(false);
    changeCharacter(sheet.character.id, entry)
      .then((result) => setRefused(!result.ok))
      .catch((error: unknown) => {
        console.error(error);
        setRefused(true);
      })
      .finally(() => setBusy(false));
  };

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
        <header className="flex h-14 shrink-0 items-center gap-1 pl-4">
          <h2 id={titleId} className="grow font-heading text-24 font-bold">
            {t('title')}
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
        <div className="flex min-h-0 grow flex-col gap-3 overflow-y-auto px-4 pb-4">
          {refused && (
            <Part name="panel" role="alert" className="bg-warn-bg px-3 py-2 text-14 text-warn-text">
              {t('refused')}
            </Part>
          )}
          {rows.length === 0 ? (
            <p className="py-2 text-15 text-muted">{t('empty')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <CardOf key={row.id} row={row} sheet={sheet} busy={busy} store={store} />
              ))}
            </ul>
          )}
        </div>
      </Part>
    </div>
  );
}
