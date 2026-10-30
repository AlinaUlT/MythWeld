// SHEET-39: the roll dialog (board V3-Roll, BRIEF P5 sheet 1). A tap on a number of the sheet that
// is a d20 test opens it: the test's name and formula, the person's Advantage and Disadvantage, the
// situational effects that name the test, and 2014's inspiration. Its mode is the rules' sources
// plus those switches (`rollModeOf`); a roll goes to the roll log with the character as its roller
// (SHEET-37). An attack shows what its kept d20 face gives and then rolls its damage, doubled on
// a critical hit. Rolling initiative interrupts a knock-out's rest (SHEET-19). With "I roll
// myself" on, the person types each die's face (SPEC §6.5). "Send to DM" waits for the table link.
import type { FormulaReader, RollPart, RollPartWarning } from '@grimoire/engine';
import type { L10n, RollRecord } from '@grimoire/schema';
import { Dices, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logRoll } from '../db/rollLog';
import { useSettings } from '../settings/useSettings';
import { useSheet } from '../sheet/SheetContext';
import { numberAt } from '../sheet/SheetNumber';
import { Part } from '../theme/Part';
import { Slot } from '../theme/Slot';
import { facesOf } from './DicePanel';
import { panelDie, rollParts, typedDie } from './dice';
import {
  d20Parts,
  damageFormula,
  fieldsOfParts,
  keptFace,
  type Switches,
  signsOf,
} from './rollSheet';
import { changeCharacter } from './undo';

const label = 'text-12 font-semibold tracking-wide text-muted uppercase';
const field = 'h-control rounded-field border border-line bg-surface px-3 text-16 text-text';
const switchClass = 'flex h-9 items-center justify-center px-3 text-14 font-semibold';

const nameIn = (name: L10n): string => name.en ?? name.ru ?? '';

export interface RollDialogProps {
  path: string;
  onClose: () => void;
}

/** One roll waiting for the faces the person types, or already rolled. */
interface Throw {
  /** What the record is called, and the number it rolled. */
  label: string;
  path: string;
  parts: [RollPart, ...RollPart[]];
  /** The d20 test itself, whose roll sets the attack's outcome and the knock-out's rest. */
  d20: boolean;
  /** For a damage roll: whether it is a critical hit's. */
  critical?: boolean;
}

function isFace(text: string, faces: number): boolean {
  const face = Number(text);
  return text.trim() !== '' && Number.isInteger(face) && face >= 1 && face <= faces;
}

export function RollDialog({ path, onClose }: RollDialogProps) {
  const { t } = useTranslation('roll');
  const { rollMyself } = useSettings();
  const sheet = useSheet();
  const { character, computed, content, system } = sheet;
  const { rolls } = system;
  const setup = rolls.setup(character, computed, content.index, path);
  const titleId = useId();

  const [manual, setManual] = useState<Switches['manual']>();
  const [inspiration, setInspiration] = useState(false);
  const [situational, setSituational] = useState<ReadonlySet<string>>(new Set());
  const [last, setLast] = useState<{ record: RollRecord; warnings: readonly RollPartWarning[] }>();
  const [damage, setDamage] = useState<{ record: RollRecord; critical: boolean }>();
  const [pending, setPending] = useState<Throw>();
  const [typed, setTyped] = useState<string[]>([]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const read: FormulaReader = (at) =>
    Object.hasOwn(computed.values, at) ? computed.values[at] : undefined;

  if (setup === undefined) {
    return (
      <Frame titleId={titleId} title={t('nothing')} onClose={onClose}>
        <p className="px-4 pb-6 text-15 text-muted">{t('notRolled')}</p>
      </Frame>
    );
  }

  const found = setup.subject === undefined ? undefined : content.index.get(setup.subject);
  const name =
    setup.subject === undefined
      ? ''
      : found?.ok
        ? nameIn(found.entity.name)
        : t('missing', { id: setup.subject });
  const title = t(`titles.${setup.kind}`, { name });

  const offered = rolls.situational(computed, setup);
  const rule = (computed.breakdown[setup.modePath] ?? []).map((step) => step.value);
  const switches: Switches = { ...(manual && { manual }), inspiration, situational };
  const mode = rolls.modeOf(signsOf(rule, switches, offered));
  const bonus = numberAt(computed, setup.path) ?? 0;
  const shownBonus =
    bonus < 0 ? t('bonus.minus', { value: -bonus }) : t('bonus.plus', { value: bonus });
  const modeKey = mode > 0 ? 'advantage' : mode < 0 ? 'disadvantage' : 'normal';
  const canInspire = rolls.inspirationAdvantage(character);

  const stamp = () => ({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    by: { role: 'player' as const, name: character.name, actorId: character.id },
  });

  /** Rolls `made` now, with the faces the person typed or a fair die, and keeps it in the log. */
  const perform = (made: Throw, faces: readonly number[] | undefined) => {
    const result = rollParts({
      parts: made.parts,
      label: made.label,
      path: made.path,
      read,
      die: faces === undefined ? panelDie() : typedDie(faces),
      roller: { actorId: character.id, name: character.name },
      id: crypto.randomUUID(),
      now: new Date(),
    });
    logRoll(result.record).then(
      (logged) => {
        if (!logged.ok) console.error(logged.message);
      },
      (error: unknown) => console.error(error),
    );
    if (made.d20) {
      setLast(result);
      setDamage(undefined);
      afterD20();
    } else {
      setDamage({ record: result.record, critical: made.critical === true });
    }
    setPending(undefined);
    setTyped([]);
  };

  /** Spending inspiration, and an initiative roll's effect on a knock-out's rest. */
  const afterD20 = () => {
    if (inspiration) {
      const spent = rolls.spendInspiration(character, stamp());
      if (spent.ok) void changeCharacter(character.id, spent.entry);
      setInspiration(false);
    }
    if (setup.kind === 'init') {
      // A knock-out's rest is interrupted; "unchanged" is the usual answer and is not shown.
      const after = rolls.rollInitiative(character, content.index, stamp());
      if (after.ok) void changeCharacter(character.id, after.entry);
    }
  };

  /** Rolls `made` at once, or asks for its faces first with "I roll myself" on. */
  const request = (made: Throw) => {
    const fields = fieldsOfParts(made.parts);
    if (!rollMyself || fields.length === 0) {
      perform(made, undefined);
      return;
    }
    setPending(made);
    setTyped([]);
  };

  const rollD20 = () =>
    request({
      label: title,
      path: setup.path,
      d20: true,
      parts: d20Parts({
        d20: rolls.d20Formula(mode),
        bonus,
        label: { d20: t('d20'), bonus: title },
        offered,
        switches,
        nameOf: (each) => nameIn(each.label),
      }),
    });

  const face = last === undefined ? undefined : keptFace(last.record);
  const outcome =
    face === undefined || setup.critical === undefined
      ? undefined
      : rolls.attackOutcome(face, rolls.criticalRange(setup, computed));

  const rollDamage = () => {
    if (setup.damage === undefined) return;
    const critical = outcome === 'criticalHit';
    const doubled = damageFormula(
      setup.damage.dice,
      numberAt(computed, setup.damage.bonusPath) ?? 0,
      critical,
      rolls.criticalDamage,
    );
    if (!doubled.ok) return;
    request({
      label: `${title}: ${t(critical ? 'criticalDamage' : 'damage')}`,
      path: setup.damage.bonusPath,
      d20: false,
      critical,
      parts: [{ label: t(critical ? 'criticalDamage' : 'damage'), formula: doubled.formula }],
    });
  };

  const fields = pending === undefined ? [] : fieldsOfParts(pending.parts);
  const ready = fields.every(({ faces }, index) => isFace(typed[index] ?? '', faces));
  const toggle = (part: string) =>
    setSituational((before) => {
      const next = new Set(before);
      if (!next.delete(part)) next.add(part);
      return next;
    });

  return (
    <Frame titleId={titleId} title={title} onClose={onClose}>
      <div className="flex flex-col gap-4 px-4 pt-1 pb-6">
        <p className="text-15 text-muted" data-testid="roll-formula">
          {t(`formula.${modeKey}`, { bonus: shownBonus })}
        </p>

        <div className="flex flex-wrap gap-2">
          {(['advantage', 'disadvantage'] as const).map((each) => (
            <Part
              key={each}
              as="button"
              type="button"
              name="chip"
              aria-pressed={manual === each}
              onClick={() => setManual(manual === each ? undefined : each)}
              className={`${switchClass} ${manual === each ? 'bg-strong text-on-strong' : 'bg-soft text-text'}`}
            >
              {t(`mode.${each}`)}
            </Part>
          ))}
          {canInspire && (
            <Part
              as="button"
              type="button"
              name="chip"
              aria-pressed={inspiration}
              onClick={() => setInspiration(!inspiration)}
              className={`${switchClass} ${inspiration ? 'bg-strong text-on-strong' : 'bg-soft text-text'}`}
            >
              {t('inspiration')}
            </Part>
          )}
        </div>

        {offered.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className={label}>{t('situationalSwitches')}</h3>
            <div className="flex flex-wrap gap-2">
              {offered.map((each) => (
                <Part
                  key={each.part}
                  as="button"
                  type="button"
                  name="chip"
                  aria-pressed={situational.has(each.part)}
                  title={nameIn(each.text)}
                  onClick={() => toggle(each.part)}
                  className={`${switchClass} ${situational.has(each.part) ? 'bg-strong text-on-strong' : 'bg-soft text-text'}`}
                >
                  {nameIn(each.label)}
                </Part>
              ))}
            </div>
          </section>
        )}

        {fields.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className={`${label} mb-2`}>{t('typed')}</legend>
            <div className="flex flex-wrap gap-2">
              {fields.map(({ key, term, faces, n }, index) => (
                <input
                  key={key}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={faces}
                  aria-label={t('typedDie', { term, n })}
                  placeholder={t('die', { faces })}
                  value={typed[index] ?? ''}
                  aria-invalid={(typed[index] ?? '') !== '' && !isFace(typed[index] ?? '', faces)}
                  onChange={(event) => {
                    const next = [...typed];
                    next[index] = event.target.value;
                    setTyped(next);
                  }}
                  className={`${field} w-20 text-center`}
                />
              ))}
            </div>
          </fieldset>
        )}

        {last !== undefined && <Result record={last.record} warnings={last.warnings} />}
        {outcome === 'criticalHit' || outcome === 'automaticMiss' ? (
          <p className="text-16 font-bold" data-testid="roll-outcome">
            {t(`outcome.${outcome}`)}
          </p>
        ) : null}
        {damage !== undefined && (
          <Result
            record={damage.record}
            warnings={[]}
            heading={t(damage.critical ? 'criticalDamage' : 'damage')}
            testId="roll-damage"
          />
        )}

        <div className="flex flex-col gap-2">
          {pending !== undefined ? (
            <Part
              as="button"
              type="button"
              name="button"
              fill="button"
              disabled={!ready}
              onClick={() => perform(pending, typed.map(Number))}
              className="flex h-control-lg items-center justify-center gap-2 px-5 text-16 font-semibold text-on-strong disabled:opacity-50"
            >
              <Dices aria-hidden className="size-5 shrink-0" />
              {t('count')}
            </Part>
          ) : (
            <>
              <Part
                as="button"
                type="button"
                name="button"
                fill="button"
                onClick={rollD20}
                className="flex h-control-lg items-center justify-center gap-2 px-5 text-16 font-semibold text-on-strong"
              >
                <Dices aria-hidden className="size-5 shrink-0" />
                {t(last === undefined ? 'roll' : 'rollAgain')}
              </Part>
              {setup.damage !== undefined && last !== undefined && outcome !== 'automaticMiss' && (
                <Part
                  as="button"
                  type="button"
                  name="button-secondary"
                  onClick={rollDamage}
                  className="flex h-control-lg items-center justify-center px-5 text-16 font-semibold"
                >
                  {t(outcome === 'criticalHit' ? 'rollCriticalDamage' : 'rollDamage')}
                </Part>
              )}
            </>
          )}
        </div>
      </div>
    </Frame>
  );
}

function Frame({
  titleId,
  title,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('roll');
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
          <h2 id={titleId} className="grow truncate font-heading text-24 font-bold">
            {title}
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
        <div className="min-h-0 grow overflow-y-auto">{children}</div>
      </Part>
    </div>
  );
}

function Result({
  record,
  warnings,
  heading,
  testId = 'roll-total',
}: {
  record: RollRecord;
  warnings: readonly RollPartWarning[];
  heading?: string;
  testId?: string;
}) {
  const { t } = useTranslation('roll');
  return (
    <Part name="card" fill="card" className="flex flex-col gap-3 p-4" aria-live="polite">
      {heading !== undefined && <h3 className={label}>{heading}</h3>}
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
      <span className="flex items-end justify-between gap-3">
        <span className="sr-only">{t('total')}</span>
        <output data-testid={testId} className="ml-auto text-48 leading-tight font-bold">
          {record.total}
        </output>
      </span>
      {warnings.length > 0 && <p className="text-13 text-warn-text">{t('warning')}</p>}
    </Part>
  );
}
