// SHEET-11: empty until SHEET-38 fills it, the dice page.
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function DicePage() {
  const { t } = useTranslation('dice');
  return <Page title={t('title')} back={paths.player} />;
}
