// SHEET-32: the Main tab's saving throws (board V3-Sheet): a chip for each stat that has a save,
// three to a row, with its proficiency dot; a tap rolls it.
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { nameIn } from '../names';
import { ProficiencyDot } from '../ProficiencyDot';
import { useSheet } from '../SheetContext';
import { numberAt, SheetNumber } from '../SheetNumber';

export function SavingThrows() {
  const { t } = useTranslation('checks');
  const { computed, system } = useSheet();
  const saves = system
    .checks(computed)
    .stats.flatMap(({ key, abbr, save }) => (save === undefined ? [] : [{ key, abbr, save }]));
  if (saves.length === 0) return null;
  return (
    <section aria-labelledby="checks-saves" className="flex flex-col gap-2">
      <h2 id="checks-saves" className="text-17 font-extrabold">
        {t('savingThrows')}
      </h2>
      <div className="grid grid-cols-3 gap-1.5">
        {saves.map(({ key, abbr, save }) => (
          <Part key={key} name="card" className="flex h-10 bg-surface">
            <SheetNumber
              path={save.total}
              label={nameIn(abbr)}
              format="signed"
              rolls
              mark={<ProficiencyDot mark={system.proficiencyMark(numberAt(computed, save.prof))} />}
              className="flex size-full items-center justify-center gap-2 select-none"
              labelClassName="text-12 font-semibold text-muted"
              valueClassName="font-bold"
            />
          </Part>
        ))}
      </div>
    </section>
  );
}
