import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client.js';
import { apiErrorText } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/format.js';
import { useToast } from '../../components/Toast.jsx';
import { Button, Card, LoadError, LoadingBlock } from '../../components/ui.jsx';

export default function AccessLogs() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [logs, setLogs] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api('/access-logs?limit=20');
      setLogs(d.logs);
      setCursor(d.nextCursor);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function loadMore() {
    setMore(true);
    try {
      const d = await api(`/access-logs?limit=20&cursor=${cursor}`);
      setLogs((l) => [...l, ...d.logs]);
      setCursor(d.nextCursor);
    } catch (err) {
      toast.error(apiErrorText(t, err));
    } finally {
      setMore(false);
    }
  }

  if (failed && !logs) return <LoadError onRetry={load} />;
  if (!logs) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('logs.title')}</h1>
        <p className="mt-2 max-w-prose text-slate">{t('logs.intro')}</p>
      </header>
      {logs.length === 0 ? (
        <Card><p className="text-slate">{t('logs.empty')}</p></Card>
      ) : (
        <Card className="p-0 sm:p-0">
          <ul>
            {logs.map((l) => (
              <li key={l.id} className="border-t border-line px-5 py-4 first:border-t-0">
                <p className="text-lg font-bold">{formatDateTime(l.accessedAt, i18n.language)}</p>
                <p>{t(`logs.kind.${l.kind}`)}</p>
                <p className="text-sm text-slate">{l.ipPrefix ? t('logs.network', { ip: l.ipPrefix }) : t('logs.noNetwork')}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {cursor && <Button variant="secondary" loading={more} onClick={loadMore}>{t('logs.more')}</Button>}
    </div>
  );
}
