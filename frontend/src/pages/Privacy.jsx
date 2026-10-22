import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '../components/ui.jsx';

export default function Privacy() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const sections = t('privacy.sections', { returnObjects: true });

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t('privacy.title')}</h1>
      <Alert kind="info" className="mt-4">{t('privacy.draft')}</Alert>
      <div className="mt-8 space-y-8">
        {Array.isArray(sections) &&
          sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-4">
              <h2 className="text-2xl font-bold">{s.title}</h2>
              <div className="mt-2 max-w-prose space-y-3 text-lg leading-relaxed">
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
