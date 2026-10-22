import { useTranslation } from 'react-i18next';
import { LinkButton } from '../components/ui.jsx';
import CodeEntryForm from '../components/CodeEntryForm.jsx';

export default function Home() {
  const { t } = useTranslation();
  const steps = ['profile', 'tag', 'view'];
  return (
    <>
      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1.25fr_1fr] lg:gap-12 lg:py-16">
        <div>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{t('home.title')}</h1>
          <p className="mt-5 max-w-prose text-lg text-slate">{t('home.text')}</p>
          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-xl font-bold">{t('home.ownerTitle')}</h2>
            <p className="mt-1 max-w-prose text-slate">{t('home.ownerText')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <LinkButton to="/register">{t('nav.register')}</LinkButton>
              <LinkButton to="/login" variant="secondary">{t('nav.login')}</LinkButton>
            </div>
          </div>
        </div>

        <aside className="self-start rounded-xl border-t-8 border-alert bg-white p-5 shadow-sm sm:p-6" aria-labelledby="code-heading">
          <h2 id="code-heading" className="text-xl font-bold">{t('home.codeTitle')}</h2>
          <p className="mb-4 mt-1 text-slate">{t('home.codeText')}</p>
          <CodeEntryForm />
        </aside>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 lg:py-14">
          <h2 className="text-3xl font-bold">{t('home.howTitle')}</h2>
          <ol className="mt-6 max-w-2xl space-y-6 border-l-4 border-brand pl-6">
            {steps.map((key, i) => (
              <li key={key}>
                <h3 className="text-xl font-bold">
                  <span className="mr-2 text-brand">{i + 1}.</span>
                  {t(`home.steps.${key}.title`)}
                </h3>
                <p className="mt-1 text-slate">{t(`home.steps.${key}.text`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-2 lg:py-14">
        <div>
          <h2 className="text-2xl font-bold">{t('home.nfcTitle')}</h2>
          <p className="mt-2 max-w-prose text-slate">{t('home.nfcText')}</p>
        </div>
        <div className="md:border-l md:border-line md:pl-10">
          <h2 className="text-2xl font-bold">{t('home.trustTitle')}</h2>
          <p className="mt-2 max-w-prose text-slate">{t('home.trustText')}</p>
        </div>
      </section>
    </>
  );
}
