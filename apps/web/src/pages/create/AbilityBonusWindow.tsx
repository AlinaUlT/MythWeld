// SHEET-29: the window for ability score increases from two editions (BRIEF P3 step 6, ADR 017,
// board V3-Conflict). When the species or race and the background both raise ability scores, the
// Origin step shows a warning and a button that opens a popup: two tick boxes, the species' or
// race's bonuses and the background's, each with what it gives, ticked one, both or neither. The
// ticks are the stored source (`abilities.bonusSource`), so the live numbers follow each tap. The
// warning stays whatever is ticked, and "Create" is never blocked (ADR 017 items 3 and 4). A
// campaign's DM decides there (ADR 013 item 10); the popup says so. The entities and what they
// give come from the module (`form.abilityBonus`), the stat names from the form's own stats.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../shared/BottomSheet';
import type { AbilityBonusShown, BonusGiverShown } from '../../systems';
import { Part } from '../../theme/Part';
import { type Draft, nameIn, type StepProps } from './draft';
import { Tick } from './Fields';

type Source = AbilityBonusShown['source'];
type Side = keyof AbilityBonusShown['sides'];

/** Whether the stored source takes the increases of `side`. */
function takes(source: Source, side: Side): boolean {
  return source === 'both' || source === side;
}

/** The source that takes the increases of exactly the sides ticked. */
function sourceOf(species: boolean, background: boolean): Source {
  if (species && background) return 'both';
  if (species) return 'species';
  return background ? 'background' : 'neither';
}

export function AbilityBonusWindow({ draft, change, form, stats, bonus }: StepProps) {
  const { t } = useTranslation('create');
  const [open, setOpen] = useState(false);
  if (bonus === undefined) return null;

  const word = t(`origin.${form.terms(draft.ruleset).species}`).toLowerCase();
  const abbrOf = (key: string) => {
    const entity = stats.find((stat) => stat.key === key)?.entity;
    return entity?.type === 'ability' ? nameIn(entity.abbr) : key;
  };
  /** What a giver gives: its fixed increases, and the patterns it spreads over its stats. */
  const givesOf = (giver: BonusGiverShown) =>
    [
      ...giver.fixed.map(({ stat, amount }) => t('window.fixed', { stat: abbrOf(stat), amount })),
      ...giver.spread.map(({ from, patterns }) =>
        t('window.spread', {
          from: from.map(abbrOf).join(t('separator')),
          patterns: patterns
            .map((pattern) => pattern.map((amount) => t('window.plus', { amount })).join(' '))
            .join(t('window.or')),
        }),
      ),
    ].join(t('separator'));
  const sideLabel = (side: Side) =>
    t('window.side', {
      side:
        side === 'species'
          ? t(`origin.${form.terms(draft.ruleset).species}`)
          : t('origin.background'),
      names: bonus.sides[side].map((giver) => nameIn(giver.name)).join(t('separator')),
      ruleset: [...new Set(bonus.sides[side].map((giver) => giver.ruleset))].join(t('separator')),
    });
  const pick = (side: Side, on: boolean) =>
    change((now: Draft) => ({
      ...now,
      bonusSource: sourceOf(
        side === 'species' ? on : takes(bonus.source, 'species'),
        side === 'background' ? on : takes(bonus.source, 'background'),
      ),
    }));

  return (
    <>
      <Part
        as="div"
        name="panel"
        className="flex flex-col gap-2 bg-warn-bg px-3 py-2 text-13 text-warn-text"
        role="group"
        aria-label={t('window.title')}
        data-testid="bonus-conflict"
      >
        <p className="font-semibold">{t('window.title')}</p>
        <p>{t('window.warn', { species: word })}</p>
        <p data-testid="bonus-using">{t(`window.using.${bonus.source}`, { species: word })}</p>
        <Part
          as="button"
          type="button"
          name="button-secondary"
          className="h-control w-fit px-4 text-15 font-semibold text-text"
          onClick={() => setOpen(true)}
        >
          {t('window.choose')}
        </Part>
      </Part>
      {open && (
        <BottomSheet title={t('window.title')} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-2 pb-2">
            <p className="text-15">{t('window.intro', { species: word })}</p>
            {(['species', 'background'] as const).map((side) => (
              <Tick
                key={side}
                label={sideLabel(side)}
                hint={bonus.sides[side]
                  .map(givesOf)
                  .filter((text) => text !== '')
                  .join(t('separator'))}
                checked={takes(bonus.source, side)}
                onChange={(on) => pick(side, on)}
              />
            ))}
            {bonus.source === 'both' && <p className="text-13 text-muted">{t('window.both')}</p>}
            {bonus.source === 'neither' && (
              <p className="text-13 text-muted">{t('window.neither')}</p>
            )}
            <p className="text-13 text-muted">{t('window.campaign')}</p>
            <Part
              as="button"
              type="button"
              name="button"
              fill="button"
              className="h-control px-4 text-16 font-bold text-on-strong"
              onClick={() => setOpen(false)}
            >
              {t('window.apply')}
            </Part>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
