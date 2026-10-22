import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tr from './locales/tr.json';
import en from './locales/en.json';

const read = () => {
  try {
    return localStorage.getItem('lang');
  } catch {
    return null;
  }
};

i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: read() === 'en' ? 'en' : 'tr', // Türkçe varsayılan
  fallbackLng: 'tr',
  interpolation: { escapeValue: false }, // React zaten kaçışlar
});

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('lang', lng);
  } catch {
    /* depolama kapalı olabilir */
  }
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language;

export default i18n;
