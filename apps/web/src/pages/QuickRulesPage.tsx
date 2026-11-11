// CONT-03: the Quick rules page's route and frame. It is empty until CONT-53 fills it: the title and the
// back arrow, nothing else.
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function QuickRulesPage() {
  const { t } = useTranslation('quickRules');
  return <Page title={t('title')} back={paths.player} />;
}
