import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh', 'ja', 'es', 'fr', 'ru', 'ar'],
    debug: false,
    interpolation: {
      escapeValue: false, // React already safe from xss
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    }
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = (lng === 'ar' || lng === 'he') ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

export default i18n;
