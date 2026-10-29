// SHEET-32: the Main tab's ability tiles (board V3-Sheet): the stat's name, its check bonus large
// (a tap rolls it), its score small below. Every number is a `SheetNumber`, so each has its breakdown.
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
    <section aria-labelledby="checks-abilities" className="flex flex-col gap-2">
      <h2 id="checks-abilities" className="text-17 font-extrabold">
        {t('abilities')}
      </h2>
      <div className="grid grid-cols-6 gap-1.5">
        {stats.map(({ key, name, abbr, check, score }) => (
          <Part key={key} name="card" className="flex h-18 flex-col bg-surface">
            <SheetNumber
              path={check}
              label={nameIn(abbr)}
              format="signed"
              rolls
              className="flex min-h-0 grow flex-col items-center justify-center pt-1 select-none"
              labelClassName="text-11 font-semibold tracking-wide text-muted"
              valueClassName="text-22 leading-26 font-bold"
            />
            <SheetNumber
              path={score}
              label={t('score', { name: nameIn(name) })}
              className="flex h-5 w-full items-center justify-center select-none"
              labelClassName="sr-only"
              valueClassName="text-12 text-muted"
            />
          </Part>
        ))}
      </div>
    </section>
  );
}
