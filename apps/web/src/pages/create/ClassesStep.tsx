// SHEET-27: BRIEF P3 step 7: classes and levels, in the order taken, the first being the first
// class. A class is added at level 1; a level picker offers no more than the levels left, so the
// levels never pass the system's highest. Picking another class for a row drops that row's
// subclass, which was the old class's. Each class shows its warnings under it.
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import { type DraftClass, levelsLeft, optionsOf, type StepProps, subclassOptionsOf } from './draft';
import { entryOptions, Picker, Step, Warnings } from './Fields';
import { warningsAbout } from './warnings';

function ClassRow({ at, entry, props }: { at: number; entry: DraftClass; props: StepProps }) {
  const { draft, change, form, entities, computed } = props;
  const { t } = useTranslation('create');
  const taken = new Set(draft.classes.map(({ id }) => id));
  const offered = optionsOf(entities, 'class', draft).filter(
    ({ id }) => id === entry.id || !taken.has(id),
  );
  const most = entry.level + levelsLeft(draft.classes, form.maxLevel);
  const subclasses = subclassOptionsOf(entities, entry.id, draft);
  const replace = (next: DraftClass) =>
    change((now) => ({
      ...now,
      classes: now.classes.map((each, index) => (index === at ? next : each)),
    }));
  return (
    <Part
      as="li"
      name="panel"
      className="flex flex-col gap-3 p-3"
      aria-label={t('classes.row', { number: at + 1 })}
    >
      <div className="flex items-end gap-2">
        <div className="grow">
          <Picker
            label={t('classes.class')}
            value={entry.id}
            options={entryOptions(offered, entry.id, entities, draft.mix, t)}
            onPick={(id) => {
              if (id !== undefined && id !== entry.id) replace({ id, level: entry.level });
            }}
          />
        </div>
        <div className="w-20 shrink-0">
          <Picker
            label={t('classes.level')}
            value={`${entry.level}`}
            options={Array.from({ length: Math.max(most, 1) }, (_, index) => ({
              value: `${index + 1}`,
              label: `${index + 1}`,
            }))}
            onPick={(level) => {
              if (level !== undefined) replace({ ...entry, level: Number(level) });
            }}
          />
        </div>
        <Part
          as="button"
          type="button"
          name="icon-button"
          aria-label={t('classes.remove', { number: at + 1 })}
          className="flex size-control shrink-0 items-center justify-center text-text"
          onClick={() =>
            change((now) => ({ ...now, classes: now.classes.filter((_, index) => index !== at) }))
          }
        >
          <X aria-hidden className="size-5" />
        </Part>
      </div>
      {(subclasses.length > 0 || entry.subclass !== undefined) && (
        <Picker
          label={t('classes.subclass')}
          value={entry.subclass}
          none={t('none')}
          options={entryOptions(subclasses, entry.subclass, entities, draft.mix, t)}
          onPick={(subclass) => {
            const { subclass: _, ...rest } = entry;
            replace(subclass === undefined ? rest : { ...rest, subclass });
          }}
        />
      )}
      <Warnings
        warnings={[
          ...warningsAbout(computed, entry.id),
          ...(entry.subclass === undefined ? [] : warningsAbout(computed, entry.subclass)),
        ]}
      />
    </Part>
  );
}

export function ClassesStep(props: StepProps) {
  const { draft, change, form, entities } = props;
  const { t } = useTranslation('create');
  const taken = new Set(draft.classes.map(({ id }) => id));
  const left = levelsLeft(draft.classes, form.maxLevel);
  const addable = optionsOf(entities, 'class', draft).filter(({ id }) => !taken.has(id));
  return (
    <Step title={t('classes.title')}>
      {draft.classes.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {draft.classes.map((entry, at) => (
            <ClassRow key={entry.id} at={at} entry={entry} props={props} />
          ))}
        </ul>
      )}
      {left > 0 && addable.length > 0 && (
        <Picker
          label={draft.classes.length === 0 ? t('classes.first') : t('classes.another')}
          value={undefined}
          none={t('classes.pick')}
          options={entryOptions(addable, undefined, entities, draft.mix, t)}
          onPick={(id) => {
            if (id !== undefined) {
              change((now) => ({ ...now, classes: [...now.classes, { id, level: 1 }] }));
            }
          }}
        />
      )}
      <p className="text-14 text-muted">
        {t('classes.total', { level: form.maxLevel - left, max: form.maxLevel })}
      </p>
    </Step>
  );
}
