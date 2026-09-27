// SETUP-04: the heading every tab page starts with.
import { useTranslation } from 'react-i18next';
import type { TabLabelKey } from '../shell/tabs';

export function PageTitle({ labelKey }: { labelKey: TabLabelKey }) {
  const { t } = useTranslation();
  return <h1 className="text-2xl font-semibold">{t(labelKey)}</h1>;
}
