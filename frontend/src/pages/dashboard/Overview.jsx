import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { formatDateTime } from '../../lib/format.js';
import { Card, LinkButton, LoadError, LoadingBlock } from '../../components/ui.jsx';

export default function Overview() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, tg, lg] = await Promise.all([api('/profile'), api('/tags'), api('/access-logs?limit=5')]);
      setData({ profile: p.profile, tag: tg.tags.find((x) => x.status === 'ACTIVE') ?? null, logs: lg.logs });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (failed && !data) return <LoadError onRetry={load} />;
  if (!data) return <LoadingBlock />;
  const { profile, tag, logs } = data;
  const { percent, items } = profile.completion;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('dash.overview.greeting', { name: user?.fullName })}</h1>
        <p className="mt-2 text-slate">{t('dash.overview.intro')}</p>
      </header>

      <Card>
        <h2 className="text-xl font-bold">{t('dash.overview.completionTitle')}</h2>
        <div
          role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          aria-label={t('dash.overview.completionTitle')}
          className="mt-3 h-4 overflow-hidden rounded-full bg-paper"
        >
          <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-lg font-bold">%{percent}</p>
        {percent === 100 ? (
          <p className="mt-1">{t('dash.overview.completionDone')}</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {items.filter((i) => !i.done).map((i) => (
              <li key={i.key}>
                <Link to="/dashboard/profile" className="font-bold text-brand underline">{t(`dash.overview.items.${i.key}`)}</Link>
              </li>
            ))}
          </ul>
        )}
        <LinkButton to="/dashboard/profile" variant="secondary" className="mt-4">{t('dash.overview.editProfile')}</LinkButton>
      </Card>

      <Card>
        <h2 className="text-xl font-bold">{t('dash.overview.emergencyTitle')}</h2>
        {tag ? (
          <div className="mt-3 space-y-3">
            <p><span className="font-bold">{t('dash.overview.shortCode')}:</span> <span className="font-mono text-lg font-bold tracking-widest">{tag.shortCode}</span></p>
            <div className="flex flex-wrap gap-3">
              <a href={new URL(tag.url).pathname} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center rounded-lg border-2 border-ink px-5 font-bold">{t('dash.overview.preview')}</a>
              <LinkButton to="/dashboard/tags">{t('dash.overview.manageTag')}</LinkButton>
            </div>
            <p className="text-sm text-slate">{t('dash.overview.previewNote')}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p>{t('dash.overview.noTag')}</p>
            <LinkButton to="/dashboard/tags">{t('dash.overview.createTag')}</LinkButton>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-xl font-bold">{t('dash.overview.recentTitle')}</h2>
        {logs.length === 0 ? (
          <p className="mt-3 rounded-lg bg-paper p-3 text-slate">{t('dash.overview.noAccess')}</p>
        ) : (
          <>
            <p className="mt-2"><span className="font-bold">{t('dash.overview.lastAccess')}:</span> {formatDateTime(logs[0].accessedAt, i18n.language)}</p>
            <Link to="/dashboard/access-logs" className="mt-2 inline-block font-bold text-brand underline">{t('dash.overview.allLogs')}</Link>
          </>
        )}
      </Card>
    </div>
  );
}
