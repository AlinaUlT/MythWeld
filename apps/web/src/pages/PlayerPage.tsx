// SHEET-11: empty until SHEET-12 fills it (ADR 013 item 17).
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function PlayerPage() {
  const { t } = useTranslation('player');
  return <Page title={t('title')} back={paths.start} gear />;
}
