// SHEET-32: the Main tab's saving throws (board V3-Sheet): one chip for each stat that has a save,
// its proficiency dot and its total, `abilities.<key>.save`. A tap rolls it (SHEET-39).
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { nameIn } from '../names';
import { ProfDot } from '../ProfDot';
import { useSheet } from '../SheetContext';
import { numberAt, SheetNumber } from '../SheetNumber';

export function SavingThrows() {
  const { t } = useTranslation('checks');
  const { computed, system } = useSheet();
  const saves = system
    .checks(computed)
    .stats.flatMap((stat) => (stat.save === undefined ? [] : [{ stat, save: stat.save }]));
  if (saves.length === 0) return null;
  return (
    <section aria-label={t('saves')}>
      <h2 className="mb-1.5 font-heading text-18 font-bold">{t('saves')}</h2>
      <ul className="grid grid-cols-3 gap-1.5">
        {saves.map(({ stat, save }) => (
          <Part as="li" key={stat.key} name="chip" className="flex items-center gap-2 px-3">
            <ProfDot level={numberAt(computed, save.prof) ?? 0} />
            <SheetNumber
              path={save.total}
              label={nameIn(stat.abbr)}
              format="signed"
              rolls
              className="flex min-h-control grow items-center justify-between gap-2"
              labelClassName="text-13 font-semibold text-muted"
              valueClassName="text-16 font-bold"
            />
          </Part>
        ))}
      </ul>
    </section>
  );
}
