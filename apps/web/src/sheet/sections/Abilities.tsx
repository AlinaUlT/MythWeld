// SHEET-32: the Main tab's ability tiles (board V3-Sheet): each stat's check bonus large, its score
// small below. The stats are the packs' entries in their order (D3); the bonus is `Computed`'s
// `checks.<key>.total`, which adds every d20 bonus, so a plain check's bonus is always the one
// shown. A tap rolls the check (SHEET-39); a long press opens each number's breakdown (SHEET-33).
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { nameIn } from '../names';
import { useSheet } from '../SheetContext';
import { SheetNumber } from '../SheetNumber';

export function Abilities() {
  const { t } = useTranslation('checks');
  const { computed, system } = useSheet();
  const { stats } = system.checks(computed);
  if (stats.length === 0) return null;
  return (
    <section aria-label={t('abilities')}>
      <h2 className="mb-1.5 font-heading text-18 font-bold">{t('abilities')}</h2>
      <ul className="grid grid-cols-6 gap-1.5">
        {stats.map((stat) => (
          <Part
            as="li"
            key={stat.key}
            name="panel"
            className="flex flex-col items-center gap-0.5 py-2"
          >
            <SheetNumber
              path={stat.check}
              label={nameIn(stat.abbr)}
              format="signed"
              rolls
              className="flex min-h-control flex-col items-center"
              labelClassName="text-12 font-semibold text-muted"
              valueClassName="text-22 leading-tight font-bold"
            />
            <SheetNumber
              path={stat.score}
              label={t('score', { name: nameIn(stat.name) })}
              className="flex"
              labelClassName="sr-only"
              valueClassName="text-13 text-muted"
            />
          </Part>
        ))}
      </ul>
    </section>
  );
}
