// CONT-03: the library (with a topic) page's route and frame. It is empty until CONT-18 fills it: the title and the
// back arrow, nothing else.
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function LibraryPage() {
  const { t } = useTranslation('library');
  return <Page title={t('title')} back={paths.player} />;
}
