import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from './Logo.jsx';
import LanguageSwitch from './LanguageSwitch.jsx';
import { LinkButton } from './ui.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

export default function PublicLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        {t('nav.skipToContent')}
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex flex-wrap items-center gap-2">
            <LanguageSwitch />
            {user ? (
              <LinkButton to="/dashboard" className="min-h-10">{t('nav.dashboard')}</LinkButton>
            ) : (
              <>
                <Link to="/login" className="inline-flex min-h-10 items-center rounded-lg px-3 font-bold text-ink hover:bg-paper">
                  {t('nav.login')}
                </Link>
                <LinkButton to="/register" className="min-h-10">{t('nav.register')}</LinkButton>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate">
          <p className="flex flex-wrap gap-x-5 gap-y-2 font-bold">
            <Link to="/privacy" className="underline">{t('nav.privacy')}</Link>
            <Link to="/privacy#usage" className="underline">{t('nav.terms')}</Link>
            <Link to="/access" className="underline">{t('access.title')}</Link>
          </p>
          <p className="mt-3 max-w-prose">{t('nav.footerNote')}</p>
        </div>
      </footer>
    </div>
  );
}
