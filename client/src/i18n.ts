import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation files
import uzTranslation from './locales/uz.json';
import ruTranslation from './locales/ru.json';

const resources = {
  uz: {
    translation: uzTranslation,
  },
  ru: {
    translation: ruTranslation,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'uz', // har doim o'zbek tili
    fallbackLng: 'uz',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
