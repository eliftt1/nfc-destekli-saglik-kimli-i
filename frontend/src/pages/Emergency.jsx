import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import Logo from '../components/Logo.jsx';
import LanguageSwitch from '../components/LanguageSwitch.jsx';
import { ageFromBirthDate, formatDate, formatDateTime, formatPhone } from '../lib/format.js';

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" aria-hidden="true" fill="currentColor">
      <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
    </svg>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t-2 border-line py-5">
      <h2 className="text-lg font-bold text-slate">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ItemList({ items, detailKey }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="break-words">
          <span className="text-2xl font-bold">{it.name}</span>
          {it[detailKey] && <span className="block text-lg">{it[detailKey]}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function Emergency() {
  const { token } = useParams();
  const { state } = useLocation();
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState('loading'); // loading | ok | invalid | network
  const [profile, setProfile] = useState(null);
  const requested = useRef(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const q = state?.via === 'code' ? '?via=code' : '';
      const d = await api(`/public/emergency/${encodeURIComponent(token)}${q}`);
      setProfile(d.profile);
      setStatus('ok');
    } catch (err) {
      setProfile(null);
      setStatus(err.status === 404 ? 'invalid' : 'network');
    }
  }, [token, state]);

  // Aynı token için bir kez yükle (geliştirme modunda çift çalışma erişim geçmişini şişirmesin).
  useEffect(() => {
    if (requested.current === token) return;
    requested.current = token;
    load();
  }, [token, load]);

  // Arama motorları indekslemesin; sayfa başlığı ayarlansın.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const prev = document.title;
    document.title = t('emergency.pageTitle');
    return () => {
      meta.remove();
      document.title = prev;
    };
  }, [t]);

  const lang = i18n.language;
  const age = profile?.birthDate ? ageFromBirthDate(profile.birthDate) : null;
  const hasAlerts = profile?.allergies || profile?.medications;
  const hasExtra = profile && (profile.bloodType || profile.birthDate || hasAlerts || profile.conditions || profile.note || profile.contacts);

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <Logo light />
          <LanguageSwitch light />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-10 pt-5">
        {status === 'loading' && <p role="status" className="py-10 text-xl">{t('emergency.loading')}</p>}

        {status === 'invalid' && (
          <div className="py-6">
            <h1 className="text-3xl font-bold">{t('emergency.invalidTitle')}</h1>
            <p className="mt-3 text-lg">{t('emergency.invalidText')}</p>
            <p className="mt-3 text-lg text-slate">{t('emergency.invalidHelp')}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Link to="/access" className="flex min-h-14 items-center justify-center rounded-xl bg-brand px-4 text-lg font-bold text-white">{t('emergency.enterCode')}</Link>
              <a href="tel:112" className="flex min-h-14 items-center justify-center rounded-xl border-2 border-alert px-4 text-lg font-bold text-alert-dark">{t('emergency.call112')}</a>
            </div>
          </div>
        )}

        {status === 'network' && (
          <div className="py-6">
            <h1 className="text-3xl font-bold">{t('emergency.networkTitle')}</h1>
            <p className="mt-3 text-lg">{t('emergency.networkText')}</p>
            <button type="button" onClick={load} className="mt-6 flex min-h-14 w-full items-center justify-center rounded-xl bg-brand px-4 text-lg font-bold text-white">{t('common.retry')}</button>
          </div>
        )}

        {status === 'ok' && profile && (
          <article>
            <h1 className="break-words text-4xl font-bold leading-tight">{profile.fullName}</h1>

            {(profile.bloodType || profile.birthDate) && (
              <div className="mt-4 flex flex-wrap items-stretch gap-3">
                {profile.bloodType && (
                  <div className="rounded-xl border-2 border-ink px-4 py-2">
                    <p className="text-sm font-bold text-slate">{t('emergency.bloodType')}</p>
                    <p className="text-4xl font-bold leading-none">{profile.bloodType}</p>
                  </div>
                )}
                {profile.birthDate && (
                  <div className="rounded-xl border-2 border-line px-4 py-2">
                    <p className="text-sm font-bold text-slate">{t('emergency.birthDate')}</p>
                    <p className="text-xl font-bold">{formatDate(profile.birthDate, lang)}</p>
                    {age !== null && <p>{t('emergency.age', { count: age })}</p>}
                  </div>
                )}
              </div>
            )}

            {hasAlerts && (
              <div className="mt-5 rounded-xl border-4 border-alert bg-alert-soft p-4 text-alert-dark" role="region" aria-label={t('emergency.attention')}>
                {profile.allergies && (
                  <section>
                    <h2 className="text-xl font-bold">{t('emergency.allergies')}</h2>
                    <div className="mt-2"><ItemList items={profile.allergies} detailKey="description" /></div>
                  </section>
                )}
                {profile.medications && (
                  <section className={profile.allergies ? 'mt-5 border-t-2 border-alert/40 pt-4' : ''}>
                    <h2 className="text-xl font-bold">{t('emergency.medications')}</h2>
                    <div className="mt-2"><ItemList items={profile.medications} detailKey="usage" /></div>
                  </section>
                )}
              </div>
            )}

            {profile.contacts && (
              <section className="mt-5" aria-label={t('emergency.contacts')}>
                <h2 className="text-lg font-bold text-slate">{t('emergency.contacts')}</h2>
                <ul className="mt-2 space-y-3">
                  {profile.contacts.map((c, i) => (
                    <li key={i}>
                      <a
                        href={`tel:${c.phone}`}
                        aria-label={`${t('emergency.call')}: ${c.name}, ${c.relation}, ${formatPhone(c.phone)}`}
                        className="flex min-h-[4.5rem] items-center gap-4 rounded-xl bg-brand px-4 py-3 text-white active:bg-brand-dark"
                      >
                        <PhoneIcon />
                        <span className="min-w-0">
                          <span className="block break-words text-xl font-bold">{t('emergency.call')}: {c.name}</span>
                          <span className="block break-words text-lg">{c.relation}, {formatPhone(c.phone)}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.conditions && (
              <Section title={t('emergency.conditions')}><ItemList items={profile.conditions} detailKey="description" /></Section>
            )}
            {profile.note && (
              <Section title={t('emergency.note')}><p className="whitespace-pre-line break-words text-xl">{profile.note}</p></Section>
            )}

            {!hasExtra && <p className="mt-6 rounded-xl bg-paper p-4 text-lg">{t('emergency.noExtra')}</p>}

            <a href="tel:112" className="mt-6 flex min-h-14 items-center justify-center rounded-xl border-2 border-alert px-4 text-lg font-bold text-alert-dark">
              {t('emergency.call112')}
            </a>

            <p className="mt-6 text-sm text-slate">{t('emergency.updatedAt')}: {formatDateTime(profile.updatedAt, lang)}</p>
            <p className="mt-2 rounded-lg bg-paper p-3 text-sm text-slate">{t('emergency.disclaimer')}</p>
          </article>
        )}
      </main>
    </div>
  );
}
