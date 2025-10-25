import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import en from './locales/en.json';
import tr from './locales/tr.json';
import es from './locales/es.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  tr: { translation: tr },
  es: { translation: es },
  ar: { translation: ar },
};

// Detect RTL for Arabic
const isRTL = true; // we will set for ar at runtime below

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export const setLanguage = (lng) => {
  i18n.changeLanguage(lng);
  const rtl = lng === 'ar';
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
};

export default i18n;