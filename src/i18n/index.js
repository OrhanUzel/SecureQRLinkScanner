import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const LANGUAGE_KEY = 'user-language-v2'; // Changed key to reset legacy settings

// Region-based language detection based on user provided reference
const getDefaultLanguage = () => {
  try {
    const getLocales = Localization.getLocales?.bind(Localization);
    const locales = typeof getLocales === 'function' ? getLocales() : [];
    
    // Get region codes from locales or fallback to Localization.region
    const regionCodes = Array.isArray(locales)
      ? locales.map((l) => (l?.regionCode || '').toUpperCase()).filter(Boolean)
      : [];
    const region = (Localization.region || '').toUpperCase();
    const code = (regionCodes[0] || region || '').toUpperCase();
    
    console.log('Detected Region Code:', code);

    // Define region sets
    const arabicRegions = new Set(['PS','AE','SA','IQ','JO','LB','SY','EG','QA','BH','KW','OM','DZ','MA','TN','LY','YE']);
    const spanishRegions = new Set(['ES','MX','CO','AR','CL','PE','VE','EC','GT','CU','DO','HN','NI','CR','PA','UY','PY','BO','SV','PR']);

    // Check by Region Code first
    if (code === 'TR') return 'tr';
    if (arabicRegions.has(code)) return 'ar';
    if (spanishRegions.has(code)) return 'es';

    // Fallback: Check locale string
    // Localization.locale can be undefined in newer Expo versions, use locales[0].languageTag
    const localeTag = (locales[0]?.languageTag || Localization.locale || '').toLowerCase();
    console.log('Detected Locale Tag:', localeTag);

    if (localeTag.includes('tr') || localeTag.endsWith('-tr')) return 'tr';
    if (localeTag.includes('ar') || localeTag.endsWith('-ar')) return 'ar';
    if (localeTag.includes('es') || localeTag.endsWith('-es')) return 'es';

    return 'en';
  } catch (e) {
    console.log('Language detection error:', e);
    return 'en';
  }
};

const initialLanguage = getDefaultLanguage();
console.log('Initial Language Selected:', initialLanguage);

// Initialize i18n synchronously
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v3',
    react: {
      useSuspense: false,
    },
  });

// Check for saved user preference asynchronously (overrides device detection)
AsyncStorage.getItem(LANGUAGE_KEY).then((savedLanguage) => {
  if (savedLanguage && resources[savedLanguage]) {
    console.log('Found saved user language:', savedLanguage);
    if (savedLanguage !== initialLanguage) {
      i18n.changeLanguage(savedLanguage);
    }
  }
}).catch((err) => {
  console.log('Error reading language from storage:', err);
});

// Always force LTR layout - RTL causes layout issues
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// Handle language updates (no RTL switching)
i18n.on('languageChanged', (lng) => {
  // Keep LTR layout for all languages to prevent layout issues
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
  // DO NOT save to AsyncStorage here automatically. 
  // We only want to save when user explicitly changes it via setLanguage.
});

export const setLanguage = (lng) => {
  i18n.changeLanguage(lng);
  AsyncStorage.setItem(LANGUAGE_KEY, lng).catch(() => {});
};

export default i18n;