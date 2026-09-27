// SETUP-05: lets TypeScript reject a key that is not in the English locale.
import 'i18next';
import type common from '../locales/en/common.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: { common: typeof common };
  }
}
