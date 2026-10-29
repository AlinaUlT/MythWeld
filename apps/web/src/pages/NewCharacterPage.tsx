// SHEET-11: empty until SHEET-27 fills it, the manual form.
import { useTranslation } from 'react-i18next';
import { Page } from '../shell/Page';
import { paths } from '../shell/routes';

export function NewCharacterPage() {
  const { t } = useTranslation('create');
  return <Page title={t('title')} back={paths.characters} />;
}
