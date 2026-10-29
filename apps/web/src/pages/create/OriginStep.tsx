// SHEET-27: BRIEF P3 step 5: the race (2014) or species (2024), and the background. The word is the
// rules base's (`terms`, ENG-19). Each pick shows its warnings under it; two editions' ability
// score increases open SHEET-29's window, drawn here.
import { useTranslation } from 'react-i18next';
import { AbilityBonusWindow } from './AbilityBonusWindow';
import { optionsOf, type StepProps } from './draft';
import { entryOptions, Picker, Step, Warnings } from './Fields';
import { warningsAbout } from './warnings';

export function OriginStep(props: StepProps) {
  const { draft, change, form, entities, computed } = props;
  const { t } = useTranslation('create');
  const term = form.terms(draft.ruleset).species;
  return (
    <Step title={t('origin.title')}>
      <Picker
        label={t(`origin.${term}`)}
        value={draft.species}
        none={t('none')}
        options={entryOptions(
          optionsOf(entities, 'species', draft),
          draft.species,
          entities,
          draft.mix,
          t,
        )}
        onPick={(species) =>
          change(({ species: _, ...now }) => ({ ...now, ...(species && { species }) }))
        }
      />
      {draft.species !== undefined && (
        <Warnings warnings={warningsAbout(computed, draft.species)} />
      )}
      <Picker
        label={t('origin.background')}
        value={draft.background}
        none={t('none')}
        options={entryOptions(
          optionsOf(entities, 'background', draft),
          draft.background,
          entities,
          draft.mix,
          t,
        )}
        onPick={(background) =>
          change(({ background: _, ...now }) => ({ ...now, ...(background && { background }) }))
        }
      />
      {draft.background !== undefined && (
        <Warnings warnings={warningsAbout(computed, draft.background)} />
      )}
      <AbilityBonusWindow {...props} />
    </Step>
  );
}
