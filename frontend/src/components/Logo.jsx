import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#10243A" />
      <path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z" fill="#fff" />
      <path d="M24.5 6.5a9 9 0 0 1 0 6" fill="none" stroke="#5CC8D2" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ light = false }) {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg">
      <LogoMark />
      <span className={`text-xl font-bold ${light ? 'text-white' : 'text-ink'}`}>{t('brand.name')}</span>
    </Link>
  );
}
