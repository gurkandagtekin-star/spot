import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from '../locales/en.json';
import tr from '../locales/tr.json';

export const SUPPORTED_LANGS = ['tr', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGS)[number];

export function deviceLanguage(): AppLanguage {
  const code = String(getLocales()[0]?.languageCode || '')
    .toLowerCase()
    .split('-')[0];
  return code === 'tr' ? 'tr' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
