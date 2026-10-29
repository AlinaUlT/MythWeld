// SHEET-11: empty until SHEET-13 fills it (SPEC §7.5).
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';

export function SettingsPage() {
  const { t } = useTranslation('settings');
  return <Page title={t('title')} back="history" />;
}
