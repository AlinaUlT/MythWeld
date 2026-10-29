// SHEET-27: BRIEF P3 step 8: one number field per stat the packs hold, in their order (D3), any
// whole number. Under each, the computed score and modifier, with every bonus. A field with no
// whole number in it counts as `UNTYPED_SCORE`, and says so. Score methods are phase 4's.
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { nameIn, type StepProps, typedScore, UNTYPED_SCORE } from './draft';
import { Step, WarningLine } from './Fields';

export function AbilitiesStep({ draft, change, computed, stats }: StepProps) {
  const { t } = useTranslation('create');
  const id = useId();
  if (stats.length === 0) {
    return (
      <Step title={t('abilities.title')}>
        <p className="text-14 text-muted">{t('abilities.none')}</p>
      </Step>
    );
  }
  const untyped = stats.filter(
    ({ key }) => typedScore(draft.scores[key] ?? `${UNTYPED_SCORE}`) === undefined,
  );
  return (
    <Step title={t('abilities.title')}>
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map(({ key, entity }) => {
          const score = computed.values[`abilities.${key}.score`];
          const mod = computed.values[`abilities.${key}.mod`];
          const abbr = entity.type === 'ability' ? nameIn(entity.abbr) : key;
          return (
            <div key={key} className="flex flex-col items-center gap-1">
              <label
                htmlFor={`${id}-${key}`}
                className="text-13 font-bold"
                title={nameIn(entity.name)}
              >
                {abbr}
              </label>
              <Part
                as="input"
                id={`${id}-${key}`}
                name="field"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={nameIn(entity.name)}
                className="h-control w-full bg-surface text-center text-20 font-bold text-text"
                value={draft.scores[key] ?? `${UNTYPED_SCORE}`}
                onChange={(event: { target: { value: string } }) => {
                  const text = event.target.value;
                  change((now) => ({ ...now, scores: { ...now.scores, [key]: text } }));
                }}
              />
              <span className="text-12 text-muted" data-testid={`ability-${key}`}>
                {typeof score === 'number' && typeof mod === 'number'
                  ? t('abilities.result', { score, mod })
                  : ''}
              </span>
            </div>
          );
        })}
      </div>
      {untyped.length > 0 && (
        <WarningLine
          text={t('abilities.untyped', {
            names: untyped.map(({ entity }) => nameIn(entity.name)).join(t('separator')),
            score: UNTYPED_SCORE,
          })}
        />
      )}
    </Step>
  );
}
