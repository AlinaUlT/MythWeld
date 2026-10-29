// SHEET-11: empty until SHEET-24 fills it (ADR 008 item 4).
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function CharactersPage() {
  const { t } = useTranslation('characters');
  return <Page title={t('title')} back={paths.player} />;
}
