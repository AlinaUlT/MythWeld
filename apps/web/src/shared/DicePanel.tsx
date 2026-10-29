// SHEET-38: the dice panel (ADR 009 item 1, ADR 010 items 4 and 5, boards V3-SheetDice and
// V3-Dice): a die picked from the standard set or the person's own, any count of it, a modifier,
// or any roll formula typed in `d` or `к`. Every roll is fair (ENG-08's die over the platform's
// secure numbers), or, with "I roll myself" on, counts the faces the person typed (SPEC §6.5).
// Each roll is logged (SHEET-37) and shown with its dice; the log's earlier rolls are its History.
// The dice page holds the panel; a sheet holds it in `DiceSheet`, at most half the screen high.
import {
  DICE_LIMITS,
  type FormulaError,
  type FormulaReader,
  parseRoll,
  type RollPartWarning,
} from '@grimoire/engine';
import type { RollRecord } from '@grimoire/schema';
import { Dices, Minus, Pencil, Plus, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CUSTOM_DICE_KEY, isCustomDie, readCustomDice, saveCustomDice } from '../db/customDice';
import { logRoll, ROLL_LOG_LIMIT, readRollLog } from '../db/rollLog';
import { en } from '../i18n/namespaces';
import { useSettings } from '../settings/useSettings';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';
import {
  builtFormula,
  diceFields,
  panelDie,
  type Roller,
  readNothing,
  rollWith,
  STANDARD_DICE,
  typedDie,
} from './dice';

const label = 'text-12 font-semibold tracking-wide text-muted uppercase';
const chip = 'flex h-9 min-w-11 items-center justify-center gap-1 px-3 text-14 font-semibold';
const stepper = 'flex size-control shrink-0 items-center justify-center text-text';
const field = 'h-control rounded-field border border-line bg-surface px-3 text-16 text-text';

type WarningKey = keyof typeof en.dice.warnings;

/** The words for a warning, by its code; a code with none of its own reads as `other`. */
export function warningKeyOf(code: string): WarningKey {
  return code !== 'other' && Object.hasOwn(en.dice.warnings, code) ? (code as WarningKey) : 'other';
}

/** Whether `text` is a face of a die of `faces` faces. */
function isFace(text: string, faces: number): boolean {
  const face = Number(text);
  return text.trim() !== '' && Number.isInteger(face) && face >= 1 && face <= faces;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** "Edit dice", or "Done" while the edit mode is on. */
export function EditDiceButton({ editing, onToggle }: { editing: boolean; onToggle: () => void }) {
  const { t } = useTranslation('dice');
  return (
    <Part
      as="button"
      type="button"
      name="button"
      fill="button"
      aria-pressed={editing}
      onClick={onToggle}
      className="mr-2 flex h-9 shrink-0 items-center gap-1.5 px-3.5 text-14 font-semibold text-on-strong"
    >
      <Pencil aria-hidden className="size-4" />
      {editing ? t('editDone') : t('edit')}
    </Part>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className={label}>{title}</h2>
      {children}
    </section>
  );
}

/** Every face of a roll, in order, keyed by its entry, its term and its place in the term. */
export function facesOf(record: RollRecord): { key: string; face: number; kept: boolean }[] {
  return record.breakdown.flatMap((entry, e) =>
    entry.dice.flatMap((term) =>
      term.results.map((face, f) => ({
        key: `${e}:${term.at}:${f}`,
        face,
        kept: term.kept[f] ?? true,
      })),
    ),
  );
}

/** Each term's faces as dice; a die the term drops is struck through. */
function Faces({ record }: { record: RollRecord }) {
  const { t } = useTranslation('dice');
  return (
    <span className="flex min-w-0 flex-wrap gap-1.5">
      {facesOf(record).map(({ key, face, kept }) => (
        <Slot
          as="span"
          name="dice"
          key={key}
          title={kept ? undefined : t('dropped')}
          data-face={face}
          data-kept={kept}
          className={`flex size-9 items-center justify-center rounded-badge border text-16 font-bold ${kept ? 'border-strong' : 'border-line text-muted line-through'}`}
        >
          {face}
        </Slot>
      ))}
    </span>
  );
}

function LastRoll({
  record,
  warnings,
}: {
  record: RollRecord | undefined;
  warnings: readonly RollPartWarning[];
}) {
  const { t } = useTranslation('dice');
  return (
    <Part name="card" fill="card" className="flex flex-col gap-3 p-4" aria-live="polite">
      <h2 className={label}>{t('lastRoll')}</h2>
      {record ? (
        <>
          <Faces record={record} />
          <span className="flex items-end justify-between gap-3">
            <span className="min-w-0 truncate text-15 text-muted">{record.label}</span>
            <span className="sr-only">{t('total')}</span>
            <output data-testid="dice-total" className="text-48 leading-tight font-bold">
              {record.total}
            </output>
          </span>
        </>
      ) : (
        <p className="text-15 text-muted">{t('noRolls')}</p>
      )}
      {[
        ...new Set(
          warnings.map(({ warning }) => t(`warnings.${warningKeyOf(warning.code)}`, warning)),
        ),
      ].map((text) => (
        <p key={text} className="text-13 text-warn-text">
          {text}
        </p>
      ))}
    </Part>
  );
}

function History({ rolls }: { rolls: readonly RollRecord[] }) {
  const { t, i18n } = useTranslation('dice');
  if (rolls.length === 0) return null;
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' });
  return (
    <Section title={t('history')}>
      <Part name="card" fill="card" className="flex flex-col divide-y divide-line">
        {rolls.map((roll) => (
          <p key={roll.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="grow truncate text-15">{roll.label}</span>
            <span className="text-12 text-muted">{time.format(new Date(roll.rolledAt))}</span>
            <span className="min-w-10 text-right text-17 font-bold">{roll.total}</span>
          </p>
        ))}
      </Part>
    </Section>
  );
}

function DieChip({
  faces,
  picked,
  onPick,
  onRemove,
}: {
  faces: number;
  picked: boolean;
  onPick: () => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation('dice');
  const die = t('die', { faces });
  return (
    <span className="flex items-center">
      <Part
        as="button"
        type="button"
        name="chip"
        aria-pressed={picked}
        onClick={onPick}
        className={`${chip} ${picked ? 'bg-strong text-on-strong' : 'bg-soft text-text'}`}
      >
        {die}
      </Part>
      {onRemove && (
        <button
          type="button"
          aria-label={t('removeDie', { die })}
          onClick={onRemove}
          className="flex size-9 items-center justify-center text-muted"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </span>
  );
}

function Stepper({
  title,
  value,
  less,
  more,
  onChange,
  children,
}: {
  title: string;
  value: ReactNode;
  less: string;
  more: string;
  onChange: (step: number) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-26 shrink-0 text-15 font-semibold">{title}</span>
      <Part
        as="button"
        type="button"
        name="button-secondary"
        aria-label={less}
        onClick={() => onChange(-1)}
        className={stepper}
      >
        <Minus aria-hidden className="size-5" />
      </Part>
      {value}
      <Part
        as="button"
        type="button"
        name="button-secondary"
        aria-label={more}
        onClick={() => onChange(1)}
        className={stepper}
      >
        <Plus aria-hidden className="size-5" />
      </Part>
      {children}
    </div>
  );
}

function NewDie({ onAdd }: { onAdd: (faces: number) => void }) {
  const { t } = useTranslation('dice');
  const [faces, setFaces] = useState('');
  const id = useId();
  const number = Number(faces);
  const ok = faces.trim() !== '' && isCustomDie(number);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ok) return;
        onAdd(number);
        setFaces('');
      }}
    >
      <label htmlFor={id} className="text-14 text-muted">
        {t('newFaces')}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={DICE_LIMITS.faces.min}
        max={DICE_LIMITS.faces.max}
        value={faces}
        onChange={(event) => setFaces(event.target.value)}
        className={`${field} w-24`}
      />
      <Part
        as="button"
        type="submit"
        name="button-secondary"
        disabled={!ok}
        className="flex h-control items-center px-4 text-14 font-semibold disabled:text-muted"
      >
        {t('addDie')}
      </Part>
    </form>
  );
}

function errorText(t: ReturnType<typeof useTranslation<'dice'>>['t'], error: FormulaError) {
  // A person counts characters from 1; the engine counts from 0.
  return t(`errors.${error.code}`, { ...error, at: error.at + 1 });
}

export interface DicePanelProps {
  /** The character who rolls; none on the dice page. */
  roller?: Roller;
  /** The character's paths; on the dice page none can be read. */
  read?: FormulaReader;
  editing: boolean;
}

export function DicePanel({ roller, read = readNothing, editing }: DicePanelProps) {
  const { t, i18n } = useTranslation('dice');
  const { rollMyself } = useSettings();
  const actorId = roller?.actorId;
  const [custom, setCustom] = useState<number[]>([]);
  const [faces, setFaces] = useState(20);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [typed, setTyped] = useState<string>();
  const [typedFaces, setTypedFaces] = useState<string[]>([]);
  const [rolls, setRolls] = useState<RollRecord[]>([]);
  const [warnings, setWarnings] = useState<readonly RollPartWarning[]>([]);
  const formulaId = useId();
  const errorId = useId();

  useEffect(() => {
    let current = true;
    readCustomDice().then(
      ({ faces: stored, refused }) => {
        for (const message of refused) console.warn(message);
        if (current) setCustom(stored);
      },
      (error: unknown) => console.error(error),
    );
    readRollLog(actorId).then(
      (log) => {
        for (const { message } of log.refused) console.warn(message);
        if (current) setRolls(log.rolls);
      },
      (error: unknown) => console.error(error),
    );
    return () => {
      current = false;
    };
  }, [actorId]);

  const text = typed ?? builtFormula(count, faces, modifier);
  const parsed = useMemo(() => parseRoll(text), [text]);
  const fields = parsed.ok && rollMyself ? diceFields(parsed.formula) : [];
  const ready =
    parsed.ok && fields.every(({ faces: of }, index) => isFace(typedFaces[index] ?? '', of));
  const signed = new Intl.NumberFormat(i18n.language, { signDisplay: 'exceptZero' });

  /** A picker's change writes the built formula again. */
  const pick = (change: () => void) => {
    change();
    setTyped(undefined);
  };

  const changeCustom = (next: number[]) => {
    const kept = [...new Set(next.filter(isCustomDie))].sort((a, b) => a - b);
    setCustom(kept);
    saveCustomDice(kept).catch((error: unknown) =>
      console.error(`${CUSTOM_DICE_KEY} not saved`, error),
    );
  };

  const roll = () => {
    if (!parsed.ok || !ready) return;
    const die = rollMyself
      ? typedDie(fields.map((_, index) => Number(typedFaces[index])))
      : panelDie();
    const made = rollWith({
      formula: parsed.formula,
      read,
      die,
      roller: roller ?? { name: t('roller') },
      id: crypto.randomUUID(),
      now: new Date(),
    });
    setRolls((before) => [made.record, ...before].slice(0, ROLL_LOG_LIMIT));
    setWarnings(made.warnings);
    setTypedFaces([]);
    logRoll(made.record).then(
      (logged) => {
        if (!logged.ok) console.error(logged.message);
      },
      (error: unknown) => console.error(error),
    );
  };

  const [last, ...earlier] = rolls;
  const button = t(rollMyself ? 'count' : 'roll', { formula: text });

  return (
    <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
      <LastRoll record={last} warnings={last ? warnings : []} />

      <div className="flex flex-wrap gap-2">
        {STANDARD_DICE.map((of) => (
          <DieChip
            key={of}
            faces={of}
            picked={typed === undefined && of === faces}
            onPick={() => pick(() => setFaces(of))}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-13 text-muted">{t('custom')}</span>
          {custom.map((of) => (
            <DieChip
              key={of}
              faces={of}
              picked={typed === undefined && of === faces}
              onPick={() => pick(() => setFaces(of))}
              onRemove={
                editing
                  ? () => {
                      changeCustom(custom.filter((other) => other !== of));
                      if (faces === of) setFaces(20);
                    }
                  : undefined
              }
            />
          ))}
          {custom.length === 0 && <span className="text-13 text-muted">{t('noCustom')}</span>}
        </div>
        {editing && <NewDie onAdd={(of) => changeCustom([...custom, of])} />}
      </div>

      <Stepper
        title={t('howMany')}
        less={t('fewerDice')}
        more={t('moreDice')}
        onChange={(step) =>
          pick(() => setCount(clamp(count + step, DICE_LIMITS.count.min, DICE_LIMITS.count.max)))
        }
        value={
          <input
            type="number"
            inputMode="numeric"
            aria-label={t('howMany')}
            min={DICE_LIMITS.count.min}
            max={DICE_LIMITS.count.max}
            value={count}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isInteger(next)) {
                pick(() => setCount(clamp(next, DICE_LIMITS.count.min, DICE_LIMITS.count.max)));
              }
            }}
            className={`${field} w-20 text-center font-bold`}
          />
        }
      >
        <span className="text-16 font-bold">{t('die', { faces })}</span>
      </Stepper>

      <Stepper
        title={t('modifier')}
        less={t('modifierDown')}
        more={t('modifierUp')}
        onChange={(step) => pick(() => setModifier(modifier + step))}
        value={
          <output
            aria-label={t('modifier')}
            className="flex h-control w-20 items-center justify-center text-16 font-bold"
          >
            {signed.format(modifier)}
          </output>
        }
      />

      <div className="flex flex-col gap-1">
        <label htmlFor={formulaId} className="sr-only">
          {t('formula')}
        </label>
        <input
          id={formulaId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={text}
          aria-invalid={!parsed.ok}
          aria-describedby={parsed.ok ? undefined : errorId}
          onChange={(event) => setTyped(event.target.value)}
          className={`${field} border-dashed font-semibold`}
        />
        {!parsed.ok && (
          <p id={errorId} className="text-13 text-danger">
            {errorText(t, parsed.error)}
          </p>
        )}
      </div>

      {fields.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className={`${label} mb-2`}>{t('typed')}</legend>
          <div className="flex flex-wrap gap-2">
            {fields.map(({ key, term, faces: of, n }, index) => (
              <input
                key={key}
                type="number"
                inputMode="numeric"
                min={1}
                max={of}
                aria-label={t('typedDie', { term, n })}
                placeholder={t('die', { faces: of })}
                value={typedFaces[index] ?? ''}
                aria-invalid={
                  (typedFaces[index] ?? '') !== '' && !isFace(typedFaces[index] ?? '', of)
                }
                onChange={(event) => {
                  const next = [...typedFaces];
                  next[index] = event.target.value;
                  setTypedFaces(next);
                }}
                className={`${field} w-20 text-center`}
              />
            ))}
          </div>
        </fieldset>
      )}

      <Part
        as="button"
        type="button"
        name="button"
        fill="button"
        disabled={!ready}
        onClick={roll}
        className="flex h-control-lg items-center justify-center gap-2 px-5 text-16 font-semibold text-on-strong disabled:opacity-50"
      >
        <Dices aria-hidden className="size-5 shrink-0" />
        <span className="truncate">{button}</span>
      </Part>

      <History rolls={earlier} />
    </div>
  );
}

export interface DiceSheetProps {
  open: boolean;
  onClose: () => void;
  roller?: Roller;
  read?: FormulaReader;
}

/** The panel over a sheet, at most half the screen high, the sheet still seen above it. */
export function DiceSheet({ open, onClose, roller, read }: DiceSheetProps) {
  const { t } = useTranslation('dice');
  const [editing, setEditing] = useState(false);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open, onClose]);
  if (!open) return null;
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
        className="relative flex max-h-[50dvh] flex-col bg-surface"
      >
        <header className="flex h-14 shrink-0 items-center gap-1 pl-4">
          <h2 id={titleId} className="grow font-heading text-24 font-bold">
            {t('title')}
          </h2>
          <EditDiceButton editing={editing} onToggle={() => setEditing(!editing)} />
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
        <div className="min-h-0 grow overflow-y-auto">
          <DicePanel roller={roller} read={read} editing={editing} />
        </div>
      </Part>
    </div>
  );
}
