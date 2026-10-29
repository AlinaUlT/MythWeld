// SHEET-32: the Main tab's skills and passive values (board V3-Sheet): the skills in two columns,
// grouped under the stat each uses now (`skills.<key>.ability`, so an effect or a manual edit that
// moves a skill moves its row), each with a proficiency dot, its total, and a tap that rolls it;
// then each passive value a skill shows.
import { useTranslation } from 'react-i18next';
import { nameIn } from '../names';
import { ProficiencyDot } from '../ProficiencyDot';
import { useSheet } from '../SheetContext';
import { numberAt, SheetNumber } from '../SheetNumber';
import { groupSkills, inColumns, type SkillGroup } from '../skillGroups';

const row = 'flex h-8.5 w-full items-center gap-2 text-14 select-none';

function Group({ group }: { group: SkillGroup }) {
  const { t } = useTranslation('checks');
  const { computed, system } = useSheet();
  const heading =
    group.stat === undefined ? t('missing', { id: group.ability }) : nameIn(group.stat.name);
  return (
    <div className="flex flex-col">
      <h3 className="mt-1 mb-0.5 text-12 font-bold tracking-wide text-muted uppercase">
        {heading}
      </h3>
      {group.skills.map(({ key, name, total, prof }) => {
        const mark = system.proficiencyMark(numberAt(computed, prof));
        return (
          <SheetNumber
            key={key}
            path={total}
            label={nameIn(name)}
            format="signed"
            rolls
            mark={<ProficiencyDot mark={mark} className="order-first" />}
            className={row}
            labelClassName="grow text-left whitespace-nowrap"
            valueClassName={mark === 'none' ? 'font-medium' : 'font-bold'}
          />
        );
      })}
    </div>
  );
}

export function Skills() {
  const { t } = useTranslation('checks');
  const { computed, system } = useSheet();
  const { stats, skills } = system.checks(computed);
  if (skills.length === 0) return null;
  const groups = groupSkills(stats, skills, ({ name }) => nameIn(name));
  const passive = skills.flatMap(({ key, name, passive: path }) =>
    path === undefined ? [] : [{ key, name, path }],
  );
  return (
    <section aria-labelledby="checks-skills" className="flex flex-col gap-2">
      <h2 id="checks-skills" className="text-17 font-extrabold">
        {t('skills')}
      </h2>
      <div className="grid grid-cols-2 gap-x-4">
        {inColumns(groups).map((column) => (
          <div key={column.map(({ ability }) => ability).join()} className="flex flex-col">
            {column.map((group) => (
              <Group key={group.ability} group={group} />
            ))}
          </div>
        ))}
      </div>
      {passive.length > 0 && (
        <div className="flex flex-col border-t border-line pt-1">
          {passive.map(({ key, name, path }) => (
            <SheetNumber
              key={key}
              path={path}
              label={t('passive', { skill: nameIn(name) })}
              className={row}
              labelClassName="text-left"
              valueClassName="font-bold"
            />
          ))}
        </div>
      )}
    </section>
  );
}
