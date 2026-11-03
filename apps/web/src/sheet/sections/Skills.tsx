// SHEET-32: the Main tab's skills and passive values (board V3-Sheet): the skills under the stat
// each is rolled with, in two columns, each with its proficiency dot and total. The stat is the key
// path `skills.<key>.ability` (ENG-43), so an effect that sets a skill's stat moves the skill to
// that group. The passive values come after, one for each skill that has one.
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { nameIn } from '../names';
import { ProfDot } from '../ProfDot';
import { useSheet } from '../SheetContext';
import { numberAt, SheetNumber } from '../SheetNumber';

export function Skills() {
  const { t } = useTranslation('checks');
  const { computed, system } = useSheet();
  const { groups, passives } = system.checks(computed);
  if (groups.length === 0) return null;
  return (
    <>
      <section aria-label={t('skills')} className="flex flex-col gap-3">
        <h2 className="font-heading text-18 font-bold">{t('skills')}</h2>
        {groups.map((group) => (
          <div key={group.stat} className="flex flex-col gap-1">
            <h3 className="text-13 font-bold tracking-wide text-muted uppercase">
              {group.name === undefined ? group.stat : nameIn(group.name)}
            </h3>
            <ul className="grid grid-cols-2 gap-x-3">
              {group.skills.map((skill) => (
                <li key={skill.key} className="flex items-center gap-2">
                  <ProfDot level={numberAt(computed, skill.prof) ?? 0} />
                  <SheetNumber
                    path={skill.total}
                    label={nameIn(skill.name)}
                    format="signed"
                    rolls
                    className="flex min-h-control grow items-center justify-between gap-2 text-left"
                    labelClassName="text-14 text-text"
                    valueClassName="text-15 font-bold"
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      {passives.length > 0 && (
        <section aria-label={t('passives')}>
          <h2 className="mb-1.5 font-heading text-18 font-bold">{t('passives')}</h2>
          <ul className="grid grid-cols-3 gap-1.5">
            {passives.map(
              (skill) =>
                skill.passive !== undefined && (
                  <Part as="li" key={skill.key} name="chip" className="flex px-3">
                    <SheetNumber
                      path={skill.passive}
                      label={t('passive', { skill: nameIn(skill.name) })}
                      className="flex min-h-control grow flex-col items-center justify-center"
                      labelClassName="text-12 text-muted"
                      valueClassName="text-17 font-bold"
                    />
                  </Part>
                ),
            )}
          </ul>
        </section>
      )}
    </>
  );
}
