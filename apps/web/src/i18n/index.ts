// SETUP-05: the one i18next instance. Strings are bundled, so nothing is fetched at runtime.
// Only `en` is filled for now (ADR 000); `ru` arrives with the Russian phase.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './namespaces';

i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en'],
  ns: Object.keys(en),
  defaultNS: 'common',
  resources: { en },
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18next;
