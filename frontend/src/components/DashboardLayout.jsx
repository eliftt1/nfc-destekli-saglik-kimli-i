import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext.jsx';
import Logo from './Logo.jsx';
import LanguageSwitch from './LanguageSwitch.jsx';
import { ToastProvider, useToast } from './Toast.jsx';
import { apiErrorText } from '../lib/errors.js';
import { ClockIcon, GearIcon, HeartIcon, HomeIcon, TagIcon } from './icons.jsx';
import { Button } from './ui.jsx';

const ITEMS = [
  { to: '/dashboard', key: 'overview', Icon: HomeIcon, end: true },
  { to: '/dashboard/profile', key: 'profile', Icon: HeartIcon },
  { to: '/dashboard/tags', key: 'tags', Icon: TagIcon },
  { to: '/dashboard/access-logs', key: 'logs', Icon: ClockIcon },
  { to: '/dashboard/settings', key: 'settings', Icon: GearIcon },
];

export default function DashboardLayout() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const toast = useToast();

  async function onLogout() {
    try {
      await logout(); // başarılıysa ProtectedRoute ana sayfaya yönlendirir
    } catch (err) {
      toast.error(apiErrorText(t, err));
    }
  }

  return (
      <div className="min-h-screen md:flex">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          {t('nav.skipToContent')}
        </a>

        {/* Masaüstü: yan menü */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white md:flex">
          <div className="p-4"><Logo /></div>
          <nav aria-label={t('dash.menuLabel')} className="flex-1 space-y-1 px-3">
            {ITEMS.map(({ to, key, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-3 rounded-lg px-3 font-bold ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-paper'}`
                }
              >
                <Icon /> {t(`dash.menu.${key}`)}
              </NavLink>
            ))}
          </nav>
          <div className="space-y-3 border-t border-line p-4">
            <p className="truncate text-sm text-slate" title={user?.email}>{user?.fullName}</p>
            <div className="flex items-center justify-between gap-2">
              <LanguageSwitch />
              <Button variant="secondary" onClick={onLogout} className="min-h-10 px-3">{t('dash.menu.logout')}</Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobil: üst çubuk */}
          <header className="flex items-center justify-between border-b border-line bg-white px-4 py-2 md:hidden">
            <Logo />
            <LanguageSwitch />
          </header>
          <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 md:pb-10 md:pt-10">
            <Outlet />
          </main>
        </div>

        {/* Mobil: alt gezinme */}
        <nav
          aria-label={t('dash.menuLabel')}
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {ITEMS.map(({ to, key, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-bold ${isActive ? 'text-brand' : 'text-slate'}`
              }
            >
              <Icon />
              <span className="max-w-full truncate">{t(`dash.menu.${key}`)}</span>
            </NavLink>
          ))}
        </nav>
      </div>
  );
}
