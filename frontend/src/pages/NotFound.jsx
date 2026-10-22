import { useTranslation } from 'react-i18next';
import { LinkButton } from '../components/ui.jsx';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-bold">{t('notFound.title')}</h1>
      <p className="mb-6 mt-2 text-slate">{t('notFound.text')}</p>
      <LinkButton to="/">{t('common.backHome')}</LinkButton>
    </div>
  );
}
