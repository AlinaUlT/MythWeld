// SHEET-39: the roll dialog (SPEC §7.2, BRIEF P5 sheet 1, board V3-Roll): tapping a number that
// rolls opens "Roll" over the sheet. It shows the formula, `d20 + 5 (Athletics)`, with the d20 of
// the roll's mode; the Advantage and Disadvantage switches; 2014's inspiration; the situational
// effects as chips; then a large result with its dice. Every roll goes to the roll log with the
// character as its roller (SHEET-37). Initiative interrupts a knock-out's short rest (SHEET-19);
// a spent inspiration is one change with its Undo toast. A weapon attack that rolled a critical hit
// offers its damage with the dice doubled. "Send to DM" waits for the table link (ADR 005 item 6).
import type { DieSource } from '@grimoire/engine';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logRoll } from '../db/rollLog';
import { breakdownOf, stepLabel } from '../sheet/breakdown';
import { perform } from '../sheet/changes';
import { nameIn } from '../sheet/names';
import {
  d20Text,
  damageFormula,
  damageText,
  modeSources,
  NO_SWITCHES,
  type RolledTest,
  type RollSwitches,
  rollTestWith,
  signsOf,
} from '../sheet/roll';
import { useSheet } from '../sheet/SheetContext';
import { numberAt } from '../sheet/SheetNumber';
import { Part } from '../theme/Part';
import { BottomSheet } from './BottomSheet';
import { Faces } from './DicePanel';
import { panelDie, readNothing, rollWith } from './dice';

export interface RollDialogProps {
  path: string;
  onClose: () => void;
  /** The die the roll uses; the platform's secure numbers when none is given. */
  die?: DieSource;
}

function Switch({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Part
      as="button"
      type="button"
      name="chip"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`flex min-h-control flex-col items-start justify-center px-3 text-left ${on ? 'bg-strong text-on-strong' : 'bg-soft text-text'}`}
    >
      <span className="text-14 font-semibold">{label}</span>
      {hint !== undefined && <span className="text-12 opacity-80">{hint}</span>}
    </Part>
  );
}

export function RollDialog({ path, onClose, die }: RollDialogProps) {
  const { t } = useTranslation('roll');
  const { t: tb } = useTranslation('breakdown');
  const { character, content, computed, system } = useSheet();
  const [on, setOn] = useState<RollSwitches>(NO_SWITCHES);
  const [rolled, setRolled] = useState<RolledTest>();
  const [damage, setDamage] = useState<{ total: number; record: RolledTest['record'] }>();
  const [failed, setFailed] = useState(false);

  const test = system.rollTest(computed, path);
  if (test === undefined) {
    return (
      <BottomSheet title={t('title')} onClose={onClose}>
        <p className="py-2 text-15 text-muted">{t('doesNotRoll')}</p>
      </BottomSheet>
    );
  }

  const name = breakdownOf(computed, system, path, tb).name;
  const bonus = numberAt(computed, test.bonus) ?? 0;
  const offered = system.situational(computed, test.targets);
  const mode = system.rollMode(signsOf(computed, test, offered, on));
  const { held, rules } = system.inspiration(character);
  const inspirationOffered = rules.use === 'advantage' && (held > 0 || on.inspiration);
  const sources = modeSources(computed, test);
  const set = (next: Partial<RollSwitches>) => setOn((now) => ({ ...now, ...next }));
  const roller = { actorId: character.id, name: character.name };

  const roll = () => {
    const made = rollTestWith({
      system,
      computed,
      test,
      name,
      mode,
      die: die ?? panelDie(),
      roller,
      id: crypto.randomUUID(),
      now: new Date(),
    });
    if (made === undefined) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setRolled(made);
    setDamage(undefined);
    logRoll(made.record).then(
      (logged) => {
        if (!logged.ok) console.error(logged.message);
      },
      (error: unknown) => console.error(error),
    );
    // A refusal is the usual answer (no knock-out is resting, or the character is dead): not shown.
    if (test.kind === 'init') {
      perform(character, (stamp) => system.rollInitiative(character, content.index, stamp)).catch(
        (error: unknown) => console.error(error),
      );
    }
    if (on.inspiration) {
      perform(character, (stamp) => system.spendInspiration(character, stamp)).catch(
        (error: unknown) => console.error(error),
      );
      set({ inspiration: false });
    }
  };

  const rollDamage = () => {
    if (test.damage === undefined) return;
    const critical = rolled?.outcome === 'criticalHit';
    const added = numberAt(computed, test.damage.bonus) ?? 0;
    const formula = damageFormula(system, damageText(test.damage.dice, added), critical);
    if (formula === undefined) {
      setFailed(true);
      return;
    }
    const made = rollWith({
      formula,
      read: readNothing,
      die: die ?? panelDie(),
      roller,
      id: crypto.randomUUID(),
      now: new Date(),
      label: t('damage'),
      path: test.damage.path,
    });
    setDamage({ total: made.record.total, record: made.record });
    logRoll(made.record).then(
      (logged) => {
        if (!logged.ok) console.error(logged.message);
      },
      (error: unknown) => console.error(error),
    );
  };

  return (
    <BottomSheet title={t('title')} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-3">
        <p className="text-17 font-bold" data-testid="roll-formula">
          {t('formula', { formula: d20Text(system, mode, bonus), name })}
        </p>

        <div className="flex flex-wrap gap-2">
          <Switch
            label={t('advantage')}
            on={on.advantage}
            onChange={(advantage) => set({ advantage })}
          />
          <Switch
            label={t('disadvantage')}
            on={on.disadvantage}
            onChange={(disadvantage) => set({ disadvantage })}
          />
          {inspirationOffered && (
            <Switch
              label={t('inspiration')}
              hint={t('inspirationHint')}
              on={on.inspiration}
              onChange={(inspiration) => set({ inspiration })}
            />
          )}
        </div>
        <p className="text-13 text-muted" data-testid="roll-mode">
          {t(`mode.${mode === 1 ? 'advantage' : mode === -1 ? 'disadvantage' : 'normal'}`)}
        </p>

        {sources.length > 0 && (
          <section className="flex flex-col gap-1.5" aria-label={t('sources')}>
            <h3 className="text-12 font-semibold tracking-wide text-muted uppercase">
              {t('sources')}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {sources.map((step, at) => (
                // A test's sources are a fixed list, so a source's place is its key.
                // biome-ignore lint/suspicious/noArrayIndexKey: the list never changes order.
                <Part as="li" key={at} name="chip" className="bg-soft px-2.5 py-1 text-12">
                  {t(`source.${step.value > 0 ? 'advantage' : 'disadvantage'}`, {
                    label: stepLabel(computed, system, step, tb),
                  })}
                </Part>
              ))}
            </ul>
          </section>
        )}

        {offered.length > 0 && (
          <section className="flex flex-col gap-1.5" aria-label={t('situational')}>
            <h3 className="text-12 font-semibold tracking-wide text-muted uppercase">
              {t('situational')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {offered.map((each) => (
                <Switch
                  key={each.part}
                  label={nameIn(each.label)}
                  hint={nameIn(each.situation)}
                  on={on.situational.includes(each.part)}
                  onChange={(next) =>
                    set({
                      situational: next
                        ? [...on.situational, each.part]
                        : on.situational.filter((part) => part !== each.part),
                    })
                  }
                />
              ))}
            </div>
          </section>
        )}

        {rolled !== undefined && (
          <Part
            name="card"
            fill="card"
            className="flex flex-col gap-3 p-4"
            aria-live="polite"
            data-testid="roll-result"
          >
            <Faces record={rolled.record} />
            <span className="flex items-end justify-between gap-3">
              <span className="flex min-w-0 flex-col text-14 text-muted">
                {rolled.face !== undefined && <span>{t('natural', { face: rolled.face })}</span>}
                {rolled.outcome !== undefined && rolled.outcome !== 'byTotal' && (
                  <span className="font-semibold text-text" data-outcome={rolled.outcome}>
                    {t(`outcome.${rolled.outcome}`)}
                  </span>
                )}
              </span>
              <span className="sr-only">{t('total')}</span>
              <output data-testid="roll-total" className="text-48 leading-tight font-bold">
                {rolled.record.total}
              </output>
            </span>
          </Part>
        )}

        {rolled !== undefined &&
          test.damage !== undefined &&
          rolled.outcome !== 'automaticMiss' && (
            <div className="flex items-center justify-between gap-3">
              <Part
                as="button"
                type="button"
                name="button-secondary"
                onClick={rollDamage}
                className="flex h-control items-center px-4 text-15 font-semibold"
              >
                {t(rolled.outcome === 'criticalHit' ? 'rollCritical' : 'rollDamage')}
              </Part>
              {damage !== undefined && (
                <output data-testid="damage-total" className="text-24 font-bold">
                  {t('damageTotal', { total: damage.total })}
                </output>
              )}
            </div>
          )}

        {failed && <p className="text-13 text-warn-text">{t('failed')}</p>}

        <div className="flex gap-2">
          <Part
            as="button"
            type="button"
            name="button"
            fill="button"
            onClick={roll}
            className="flex h-control grow items-center justify-center text-16 font-semibold text-on-strong"
          >
            {t(rolled === undefined ? 'roll' : 'again')}
          </Part>
          <Part
            as="button"
            type="button"
            name="button-secondary"
            onClick={onClose}
            className="flex h-control items-center px-5 text-16 font-semibold"
          >
            {t('done')}
          </Part>
        </div>
      </div>
    </BottomSheet>
  );
}
