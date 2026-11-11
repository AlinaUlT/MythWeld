// CONT-03: the About page's route and frame. It is empty until CONT-59 fills it: the title and the
// back arrow, nothing else.
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function AboutPage() {
  const { t } = useTranslation('aboutApp');
  return <Page title={t('title')} back={paths.settings} />;
}
