// SHEET-27: BRIEF P3 step 4, the name. Left empty, the character is made as "Unnamed character",
// so nothing blocks "Create". The portrait picker comes with the round token (SHEET-56).
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Part } from '../../theme/Part';
import type { StepProps } from './draft';
import { fieldClass, Labelled, Step } from './Fields';

export function NameStep({ draft, change }: StepProps) {
  const { t } = useTranslation('create');
  const id = useId();
  return (
    <Step title={t('name.title')}>
      <Labelled id={id} label={t('name.label')}>
        <Part
          as="input"
          id={id}
          name="field"
          type="text"
          autoComplete="off"
          maxLength={80}
          className={fieldClass}
          value={draft.name}
          placeholder={t('name.placeholder')}
          onChange={(event: { target: { value: string } }) => {
            const name = event.target.value;
            change((now) => ({ ...now, name }));
          }}
        />
      </Labelled>
    </Step>
  );
}
