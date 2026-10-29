// SHEET-27: empty until SHEET-28 fills it: the equipment step (BRIEF P3 step 9), which adds items.
import { useTranslation } from 'react-i18next';
import type { StepProps } from './draft';
import { Step } from './Fields';

export function EquipmentStep(_props: StepProps) {
  const { t } = useTranslation('create');
  const { t: tc } = useTranslation();
  return (
    <Step title={t('equipment.title')}>
      <p className="text-14 text-muted">{tc('comingLater')}</p>
    </Step>
  );
}
