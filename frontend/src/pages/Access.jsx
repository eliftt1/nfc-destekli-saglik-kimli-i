import { useTranslation } from 'react-i18next';
import CodeEntryForm from '../components/CodeEntryForm.jsx';
import { Card } from '../components/ui.jsx';

export default function Access() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-3xl font-bold">{t('access.title')}</h1>
      <p className="mb-6 mt-2 text-slate">{t('access.text')}</p>
      <Card className="border-t-8 border-t-alert">
        <CodeEntryForm />
      </Card>
    </div>
  );
}
