// SHEET-27: BRIEF P3 steps 1 to 3: the system ("5E compatible", the only one for now), the rules
// base, the content packs and "Mix editions". The person's own packs come with phase 5.
import { useTranslation } from 'react-i18next';
import { MANUAL_FORM_SYSTEMS } from '../../systems';
import { type StepProps, withPack, withRuleset } from './draft';
import { Segmented, Step, Tick, Toggle } from './Fields';

export function RulesStep({ draft, change, form, installed }: StepProps) {
  const { t } = useTranslation('create');
  const { t: tc } = useTranslation();
  return (
    <Step title={t('rules.title')}>
      <Segmented
        label={t('rules.system')}
        name="system"
        value={draft.system}
        values={MANUAL_FORM_SYSTEMS.map(({ system }) => system)}
        names={(system) => t(`rules.systems.${system}`, { defaultValue: system })}
        onPick={() => undefined}
      />
      <Segmented
        label={t('rules.ruleset')}
        name="ruleset"
        value={draft.ruleset}
        values={form.rulesets}
        names={(ruleset) => t('rules.rulesetName', { ruleset })}
        onPick={(ruleset) => change((now) => withRuleset(now, ruleset, installed))}
      />
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-13 font-semibold text-muted">{t('rules.packs')}</legend>
        {installed.map(({ pack }) => (
          <Tick
            key={pack.id}
            label={pack.title.en ?? pack.id}
            checked={draft.packs.includes(pack.id)}
            onChange={(on) => change((now) => withPack(now, pack.id, on, installed))}
          />
        ))}
        <Tick label={t('rules.myPacks')} hint={tc('comingLater')} checked={false} disabled />
      </fieldset>
      <Toggle
        label={t('rules.mix')}
        hint={t('rules.mixHint')}
        on={draft.mix}
        onChange={(mix) => change((now) => ({ ...now, mix }))}
      />
    </Step>
  );
}
