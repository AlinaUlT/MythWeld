// SHEET-39: the roll dialog (BRIEF P5 sheet 1, board V3-Roll). A tap on a number of the sheet
// that rolls opens it with that number's computed path. It names the d20 test (ENG-34), shows the
// formula the next roll rolls, and lets the person add what the sheet cannot know before the roll:
// advantage, disadvantage, a situational effect they switch on, and, in 2014 rules, inspiration.
// The roll is fair (SHEET-38's die), or counts the faces the person typed ("I roll myself"). Its
// record goes to the roll log with the character as roller. An attack reads its natural face
// (`attackOutcome`) and a weapon's offers its damage, with the dice doubled on a critical hit; a
// roll of initiative then records itself in the character's log (`rollInitiative`, SHEET-19).
// "Send to DM" waits for the table link (ADR 005). The chosen switches are for the next roll.
import { STAT_TYPE } from '@grimoire/engine';
import type { L10n } from '@grimoire/schema';
import { Dices, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logRoll } from '../db/rollLog';
import { useSettings } from '../settings/useSettings';
import { useSheet } from '../sheet/SheetContext';
import { numberAt } from '../sheet/SheetNumber';
import { Part } from '../theme/Part';
import { Faces, isFace, warningKeyOf } from './DicePanel';
import { panelDie, typedDie } from './dice';
import { damageDiceOf, fieldsOfFormula, type MadeRoll, rollTestWith } from './rollTest';
import { changeCharacter } from './undo';

const label = 'text-12 font-semibold tracking-wide text-muted uppercase';
const chip = 'flex min-h-9 items-center justify-center gap-1 px-3 py-1 text-14 font-semibold';
const field = 'h-control w-16 rounded-field border border-line bg-surface text-center text-16';

export interface RollDialogProps {
  path: string;
  onClose: () => void;
}

/** An entity's name in the first filled locale; English is the only one for now (ADR 000). */
function nameIn(name: L10n): string {
  return name.en ?? name.ru ?? '';
}

function Chip({
  on,
  onToggle,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Part
      as="button"
      type="button"
      name="chip"
      aria-pressed={on}
      onClick={onToggle}
      className={`${chip} ${on ? 'bg-strong text-on-strong' : 'bg-soft text-text'}`}
    >
      {children}
    </Part>
  );
}

function Result({ made, outcome }: { made: MadeRoll; outcome?: string | undefined }) {
  const { t: td, i18n } = useTranslation('dice');
  const warnings = [
    ...new Set(
      made.warnings.map(({ warning }) => td(`warnings.${warningKeyOf(warning.code)}`, warning)),
    ),
  ];
  return (
    <Part name="card" fill="card" className="flex flex-col gap-3 p-4" aria-live="polite">
      <Faces record={made.record} />
      <span className="flex items-end justify-between gap-3">
        <span className="min-w-0 truncate text-15 text-muted">{outcome ?? made.record.label}</span>
        <span className="sr-only">{td('total')}</span>
        <output data-testid="roll-total" className="text-48 leading-tight font-bold">
          {new Intl.NumberFormat(i18n.language).format(made.record.total)}
        </output>
      </span>
      {warnings.map((text) => (
        <p key={text} className="text-13 text-warn-text">
          {text}
        </p>
      ))}
    </Part>
  );
}

/** "I roll myself": one field per die of the roll about to be made. */
function TypedFaces({
  formula,
  typed,
  onChange,
}: {
  formula: string | Parameters<typeof fieldsOfFormula>[0];
  typed: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation('dice');
  const fields = fieldsOfFormula(formula);
  if (fields.length === 0) return null;
  return (
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
              onChange(next);
            }}
            className={field}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function RollDialog({ path, onClose }: RollDialogProps) {
  const { t } = useTranslation('roll');
  const { rollMyself } = useSettings();
  const { character, content, computed, system } = useSheet();
  const { rolls } = system;
  const titleId = useId();
  const [advantage, setAdvantage] = useState(false);
  const [disadvantage, setDisadvantage] = useState(false);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [inspired, setInspired] = useState(false);
  const [made, setMade] = useState<MadeRoll>();
  const [damage, setDamage] = useState<MadeRoll>();
  const [typed, setTyped] = useState<string[]>([]);
  const [typedDamage, setTypedDamage] = useState<string[]>([]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const test = rolls.test(path, computed);
  const bonus = numberAt(computed, path) ?? 0;

  const nameOf = (): string => {
    const subject = test?.subject;
    const entity =
      subject?.type === 'stat'
        ? computed.byKey[STAT_TYPE]?.[subject.key]
        : subject?.type === 'skill'
          ? computed.byKey.skill?.[subject.key]
          : subject?.type === 'item'
            ? (() => {
                const found = content.index.get(subject.id);
                return found.ok ? found.entity : undefined;
              })()
            : undefined;
    if (entity !== undefined) return nameIn(entity.name);
    return subject === undefined
      ? ''
      : t('missing', { id: subject.type === 'item' ? subject.id : subject.key });
  };

  const title = test === undefined ? t('title') : t(`titles.${test.kind}`, { name: nameOf() });

  const frame = (body: ReactNode) => (
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
        <div className="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6">
          {body}
          <Part
            as="button"
            type="button"
            name="button-secondary"
            onClick={onClose}
            className="flex h-control-lg items-center justify-center px-5 text-16 font-semibold"
          >
            {t('done')}
          </Part>
        </div>
      </Part>
    </div>
  );

  if (test === undefined) return frame(<p className="text-15 text-muted">{t('noRoll')}</p>);

  const signs = rolls.signs(computed, test.modePath);
  const situational = rolls.situational(character, computed, test.targets);
  const { held, use } = rolls.inspiration(character);
  const canInspire = use === 'advantage' && held > 0;
  const own = [
    ...(advantage ? [1] : []),
    ...(disadvantage ? [-1] : []),
    ...situational.filter(({ part }) => picked.includes(part)).map(({ sign }) => sign),
    ...(canInspire && inspired ? [1] : []),
  ];
  const sheetMode = rolls.mode(signs);
  const mode = rolls.mode([...signs, ...own]);
  const dice = rolls.d20(mode);
  const modeName = (value: number) =>
    t(value > 0 ? 'mode.advantage' : value < 0 ? 'mode.disadvantage' : 'mode.normal');

  const read = (at: string) =>
    Object.hasOwn(computed.values, at) ? computed.values[at] : undefined;
  const roller = { actorId: character.id, name: character.name };
  const stamp = () => ({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    by: { role: 'player' as const, name: character.name, actorId: character.id },
  });
  const record = (rolled: MadeRoll) =>
    logRoll(rolled.record).then(
      (logged) => {
        if (!logged.ok) console.error(logged.message);
      },
      (error: unknown) => console.error(error),
    );
  const write = (action: ReturnType<typeof rolls.spend>) => {
    if (!action.ok) {
      // Nothing to record is the usual answer (a character not knocked out rolling initiative).
      if (action.code !== 'unchanged') console.warn(action.message);
      return;
    }
    changeCharacter(character.id, action.entry).then(
      (changed) => {
        if (!changed.ok) console.warn(changed.message);
      },
      (error: unknown) => console.error(error),
    );
  };

  const attackFields = rollMyself ? fieldsOfFormula(dice) : [];
  const attackReady = attackFields.every(({ faces }, index) => isFace(typed[index] ?? '', faces));

  const roll = () => {
    if (!attackReady) return;
    const die = rollMyself
      ? typedDie(attackFields.map((_, index) => Number(typed[index])))
      : panelDie();
    const rolled = rollTestWith({
      label: title,
      path,
      dice,
      diceLabel: t('d20'),
      addLabel: title,
      addPath: path,
      read,
      die,
      roller,
      id: crypto.randomUUID(),
      now: new Date(),
    });
    setMade(rolled);
    setDamage(undefined);
    setTyped([]);
    setTypedDamage([]);
    void record(rolled);
    if (canInspire && inspired) {
      write(rolls.spend(character, stamp()));
      setInspired(false);
    }
    if (test.kind === 'init') write(rolls.initiative(character, content.index, stamp()));
  };

  const outcome =
    test.critRange !== undefined && made?.natural !== undefined
      ? rolls.outcome(made.natural, test.critRange)
      : 'byTotal';
  const outcomeText = outcome === 'byTotal' ? undefined : t(`outcome.${outcome}`);
  const offersDamage =
    test.damage !== undefined && made !== undefined && outcome !== 'automaticMiss';
  const critical = outcome === 'criticalHit';
  const damageDice =
    test.damage === undefined ? '' : damageDiceOf(test.damage.formula, critical, rolls.critical);
  const damageFields = rollMyself && offersDamage ? fieldsOfFormula(damageDice) : [];
  const damageReady = damageFields.every(({ faces }, index) =>
    isFace(typedDamage[index] ?? '', faces),
  );

  const rollDamage = () => {
    if (test.damage === undefined || !damageReady) return;
    const die = rollMyself
      ? typedDie(damageFields.map((_, index) => Number(typedDamage[index])))
      : panelDie();
    const name = nameOf();
    const rolled = rollTestWith({
      label: t('damageOf', { name }),
      path: test.damage.bonusPath,
      dice: damageDice,
      diceLabel: t(critical ? 'criticalDice' : 'damageDice'),
      addLabel: t('damageBonus'),
      addPath: test.damage.bonusPath,
      read,
      die,
      roller,
      id: crypto.randomUUID(),
      now: new Date(),
    });
    setDamage(rolled);
    setTypedDamage([]);
    void record(rolled);
  };

  const sign = bonus < 0 ? t('sign.minus') : t('sign.plus');
  return frame(
    <>
      <p className="text-16 font-semibold" data-testid="roll-formula">
        {t('formula', { dice, sign, value: Math.abs(bonus) })}
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Chip on={advantage} onToggle={() => setAdvantage(!advantage)}>
            {t('advantage')}
          </Chip>
          <Chip on={disadvantage} onToggle={() => setDisadvantage(!disadvantage)}>
            {t('disadvantage')}
          </Chip>
          {canInspire && (
            <Chip on={inspired} onToggle={() => setInspired(!inspired)}>
              {t('inspiration', { count: held })}
            </Chip>
          )}
          {situational.map(({ part, hint, sign: given }) => (
            <Chip
              key={part}
              on={picked.includes(part)}
              onToggle={() =>
                setPicked(
                  picked.includes(part)
                    ? picked.filter((each) => each !== part)
                    : [...picked, part],
                )
              }
            >
              {t('situational', {
                hint: nameIn(hint),
                mode: t(given > 0 ? 'advantage' : 'disadvantage').toLowerCase(),
              })}
            </Chip>
          ))}
        </div>
        <p className="text-13 text-muted">
          {sheetMode !== 0 && `${t('fromSheet', { mode: modeName(sheetMode) })} `}
          {t('rollingWith', { mode: modeName(mode) })}
        </p>
      </div>

      {rollMyself && <TypedFaces formula={dice} typed={typed} onChange={setTyped} />}

      <Part
        as="button"
        type="button"
        name="button"
        fill="button"
        disabled={!attackReady}
        onClick={roll}
        className="flex h-control-lg items-center justify-center gap-2 px-5 text-16 font-semibold text-on-strong disabled:opacity-50"
      >
        <Dices aria-hidden className="size-5 shrink-0" />
        {t(rollMyself ? (made ? 'countAgain' : 'count') : made ? 'rollAgain' : 'roll')}
      </Part>

      {made && <Result made={made} outcome={outcomeText} />}

      {offersDamage && (
        <>
          {rollMyself && (
            <TypedFaces formula={damageDice} typed={typedDamage} onChange={setTypedDamage} />
          )}
          <Part
            as="button"
            type="button"
            name="button-secondary"
            disabled={!damageReady}
            onClick={rollDamage}
            className="flex h-control-lg items-center justify-center px-5 text-16 font-semibold disabled:opacity-50"
          >
            {t(critical ? 'rollCriticalDamage' : 'rollDamage')}
          </Part>
          {damage && <Result made={damage} />}
        </>
      )}
    </>,
  );
}
