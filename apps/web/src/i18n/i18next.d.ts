// SETUP-05: lets TypeScript reject a key that is not in the English locale.
import 'i18next';
import type { Namespaces } from './namespaces';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: Namespaces;
  }
}
