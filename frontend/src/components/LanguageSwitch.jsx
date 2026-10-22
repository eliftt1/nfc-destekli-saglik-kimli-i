import { useTranslation } from 'react-i18next';

export default function LanguageSwitch({ light = false }) {
  const { t, i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'tr';
  return (
    <div role="group" aria-label={t('nav.language')} className="flex overflow-hidden rounded-lg border-2 border-current">
      {['tr', 'en'].map((lng) => (
        <button
          key={lng}
          type="button"
          lang={lng}
          aria-pressed={current === lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`min-h-10 min-w-11 px-2.5 text-sm font-bold ${
            current === lng ? (light ? 'bg-white text-ink' : 'bg-ink text-white') : light ? 'text-white' : 'text-ink'
          }`}
        >
          {lng === 'tr' ? 'TR' : 'EN'}
        </button>
      ))}
    </div>
  );
}
