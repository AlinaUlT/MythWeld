// SHEET-43: the Combat tab's death saves (SPEC §7.2, §6.4, BRIEF P4): the tracker follows a dying
// character, and shows for no one else. Dying at 0 hit points: three success and three failure
// circles, "Roll death save" (the roll dialog on the death save's mode, which applies the kept face
// and the total, ENG-58), and "Stabilize" (first aid's Medicine check, Spare the Dying: the person
// says it happened). Stable: it makes no saves; the 1 hit point after 1d4 hours is the person's
// "Regain 1 hit point", for nothing keeps the time. Dead: a revival with 1 hit point or the
// maximum, refused where exhaustion still kills (ENG-67). Knocked out at 1 hit point (2024, ENG-65):
// "First aid", someone else's DC 10 Wisdom (Medicine) check, recorded as a success. Every change is
// one entry with its "Undo" toast.
import { finderOf } from '@grimoire/engine';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { perform } from '../changes';
import { useSheet } from '../SheetContext';

const button =
  'flex min-h-control items-center rounded-button border border-strong px-4 text-15 font-semibold';

/** `max` circles, `count` of them filled. */
function Circles({
  count,
  max,
  label,
  aria,
  kind,
}: {
  count: number;
  max: number;
  label: string;
  aria: string;
  kind: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-13 font-semibold tracking-wide text-muted uppercase">{label}</span>
      <span className="flex gap-2" role="img" aria-label={aria} data-testid={`death-${kind}`}>
        {Array.from({ length: max }, (_, at) => (
          <span
            // The circles are a fixed row, so their place is their key.
            // biome-ignore lint/suspicious/noArrayIndexKey: the row never changes order.
            key={at}
            data-filled={at < count}
            className={`size-5 rounded-full border-2 border-strong ${at < count ? 'bg-strong' : ''}`}
          />
        ))}
      </span>
    </div>
  );
}

export function DeathSaves() {
  const { t } = useTranslation('deathSaves');
  const { character, content, computed, system, roll } = useSheet();
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const find = finderOf(character, content.index);
  const shown = system.deathSaves(character, computed, find);
  if (shown.state === 'up') return null;

  const run = (action: Parameters<typeof perform>[1]) => {
    setRefusal(undefined);
    perform(character, action).then(
      (done) => {
        if (!done.ok && 'code' in done) setRefusal(done.code);
      },
      (error: unknown) => console.error(error),
    );
  };

  return (
    <Part
      as="section"
      name="card"
      fill="card"
      className="flex flex-col gap-3 p-4"
      aria-label={t('title')}
      data-death-state={shown.state}
    >
      <h2 className="font-heading text-18 font-bold">{t('title')}</h2>

      {shown.state === 'dying' && (
        <>
          <Circles
            kind="success"
            label={t('successes')}
            aria={t('count', { label: t('successes'), count: shown.success, max: shown.max })}
            count={shown.success}
            max={shown.max}
          />
          <Circles
            kind="failure"
            label={t('failures')}
            aria={t('count', { label: t('failures'), count: shown.failure, max: shown.max })}
            count={shown.failure}
            max={shown.max}
          />
          <div className="flex flex-wrap gap-2">
            <Part
              as="button"
              type="button"
              name="button"
              fill="button"
              onClick={() => roll(system.deathSavePath)}
              className="flex min-h-control items-center px-4 text-15 font-semibold text-on-strong"
            >
              {t('roll')}
            </Part>
            <button
              type="button"
              className={button}
              onClick={() => run((stamp) => system.stabilize(character, content.index, stamp))}
            >
              {t('stabilize')}
            </button>
          </div>
          <p className="text-13 text-muted">{t('stabilizeHint')}</p>
        </>
      )}

      {shown.state === 'stable' && (
        <>
          <p className="text-15 font-semibold">{t('stable')}</p>
          <p className="text-13 text-muted">{t('stableHint')}</p>
          <button
            type="button"
            className={`${button} self-start`}
            onClick={() =>
              run((stamp) => system.applyHealing(character, content.index, { amount: 1 }, stamp))
            }
          >
            {t('regain')}
          </button>
        </>
      )}

      {shown.state === 'knockedOut' && (
        <>
          <p className="text-15 font-semibold">{t('knockedOut')}</p>
          <p className="text-13 text-muted">{t('knockedOutHint')}</p>
          <button
            type="button"
            className={`${button} self-start`}
            onClick={() => run((stamp) => system.firstAid(character, content.index, stamp))}
          >
            {t('firstAid')}
          </button>
        </>
      )}

      {shown.state === 'dead' && (
        <>
          <p className="text-15 font-semibold">{t('dead')}</p>
          <p className="text-13 text-muted">{t('deadHint')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              onClick={() =>
                run((stamp) => system.revive(character, content.index, { hp: 1 }, stamp))
              }
            >
              {t('reviveOne')}
            </button>
            <button
              type="button"
              className={button}
              onClick={() =>
                run((stamp) => system.revive(character, content.index, { hp: 'max' }, stamp))
              }
            >
              {t('reviveMax')}
            </button>
          </div>
        </>
      )}

      {refusal !== undefined && (
        <p className="bg-warn-bg px-3 py-2 text-13 text-warn-text" role="alert">
          {refusal === 'stillDead' ? t('stillDead') : t('refused')}
        </p>
      )}
    </Part>
  );
}
