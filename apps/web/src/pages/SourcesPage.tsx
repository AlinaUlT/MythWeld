// CONT-03: the Sources page's route and frame. It is empty until CONT-57 fills it: the title and the
// back arrow, nothing else.
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function SourcesPage() {
  const { t } = useTranslation('sources');
  return <Page title={t('title')} back={paths.player} />;
}
