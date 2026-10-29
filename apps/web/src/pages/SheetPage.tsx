// SHEET-11: empty until SHEET-30 fills it, the sheet's frame.
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function SheetPage() {
  const { t } = useTranslation('sheet');
  return <Page title={t('title')} back={paths.characters} />;
}
