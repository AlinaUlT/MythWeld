// CONT-03: the Bookmarks page's route and frame. It is empty until CONT-56 fills it: the title and the
// back arrow, nothing else.
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function BookmarksPage() {
  const { t } = useTranslation('bookmarks');
  return <Page title={t('title')} back={paths.player} />;
}
