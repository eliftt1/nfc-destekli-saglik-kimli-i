import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client.js';
import { apiErrorText } from '../../lib/errors.js';
import { copyText, makeQrPng } from '../../lib/qr.js';
import { formatDateTime } from '../../lib/format.js';
import { useToast } from '../../components/Toast.jsx';
import { Alert, Button, Card, ConfirmAction, LoadError, LoadingBlock } from '../../components/ui.jsx';

function CopyField({ label, value, big = false }) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <div>
      <label className="mb-1 block text-base font-bold">
        {label}
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className={`mt-1 min-h-12 w-full rounded-lg border-2 border-line bg-paper px-3 font-mono ${big ? 'text-2xl font-bold tracking-widest' : 'text-sm'}`}
        />
      </label>
      <Button
        variant="secondary"
        className="mt-2"
        onClick={async () => (await copyText(value)) ? toast.success(t('tags.copied')) : toast.error(t('tags.copyFailed'))}
      >
        {t('tags.copy')}
      </Button>
    </div>
  );
}

export default function Tags() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [tags, setTags] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState(null);
  const [qrFailed, setQrFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api('/tags');
      setTags(d.tags);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const active = tags?.find((x) => x.status === 'ACTIVE') ?? null;
  const revoked = tags?.filter((x) => x.status === 'REVOKED') ?? [];

  useEffect(() => {
    setQr(null);
    setQrFailed(false);
    if (!active?.url) return undefined;
    let current = true;
    makeQrPng(active.url).then((png) => current && setQr(png)).catch(() => current && setQrFailed(true));
    return () => { current = false; };
  }, [active?.url]);

  async function act(path, successKey) {
    setBusy(true);
    try {
      await api(path, { method: 'POST' });
      toast.success(t(successKey));
      await load();
    } catch (err) {
      toast.error(apiErrorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  if (failed && !tags) return <LoadError onRetry={load} />;
  if (!tags) return <LoadingBlock />;

  const isLocal = active && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(active.url).hostname);
  const steps = t('tags.nfcSteps', { returnObjects: true });
  const previewPath = active ? new URL(active.url).pathname : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('tags.title')}</h1>
        <p className="mt-2 max-w-prose text-slate">{t('tags.intro')}</p>
      </header>

      {!active ? (
        <Card>
          <p className="text-lg">{t('tags.empty')}</p>
          <Button className="mt-4" loading={busy} onClick={() => act('/tags', 'tags.created')}>{t('tags.create')}</Button>
        </Card>
      ) : (
        <>
          <Card className="space-y-4">
            <h2 className="text-xl font-bold">{t('tags.linkTitle')}</h2>
            <Alert kind="info">{t('tags.warning')}</Alert>
            {isLocal && <Alert kind="error">{t('tags.localhost')}</Alert>}
            <CopyField label={t('tags.linkLabel')} value={active.url} />
            <div>
              <a href={previewPath} target="_blank" rel="noreferrer" className="font-bold text-brand underline">{t('tags.preview')}</a>
              <p className="text-sm text-slate">{t('tags.previewNote')}</p>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-xl font-bold">{t('tags.qrTitle')}</h2>
            {qrFailed && <Alert>{t('tags.qrFailed')}</Alert>}
            {qr && (
              <>
                <img src={qr} alt={t('tags.qrAlt')} width={240} height={240} className="h-60 w-60 max-w-full rounded-lg border border-line" />
                <a
                  href={qr}
                  download="acil-kunye-qr.png"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 font-bold text-white hover:bg-brand-dark"
                >
                  {t('tags.qrDownload')}
                </a>
              </>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-xl font-bold">{t('tags.codeTitle')}</h2>
            <p className="text-slate">{t('tags.codeText', { site: window.location.origin })}</p>
            <CopyField label={t('tags.codeTitle')} value={active.shortCode} big />
          </Card>

          <Card>
            <h2 className="text-xl font-bold">{t('tags.nfcTitle')}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6">
              {Array.isArray(steps) && steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <p className="mt-4 rounded-lg bg-paper p-3 text-sm">{t('tags.nfcNote')}</p>
          </Card>

          <Card className="space-y-3 border-alert">
            <h2 className="text-xl font-bold">{t('tags.dangerTitle')}</h2>
            <p>{t('tags.dangerText')}</p>
            <div className="flex flex-col items-start gap-3">
              <ConfirmAction
                label={t('tags.regenerate')} message={t('tags.regenerateConfirm')} confirmLabel={t('tags.regenerateYes')}
                busy={busy} onConfirm={() => act(`/tags/${active.id}/regenerate`, 'tags.regenerated')}
              />
              <ConfirmAction
                label={t('tags.revoke')} message={t('tags.revokeConfirm')} confirmLabel={t('tags.revokeYes')}
                busy={busy} onConfirm={() => act(`/tags/${active.id}/revoke`, 'tags.revoked')}
              />
            </div>
          </Card>
        </>
      )}

      {revoked.length > 0 && (
        <section aria-labelledby="history">
          <h2 id="history" className="text-lg font-bold text-slate">{t('tags.historyTitle')}</h2>
          <ul className="mt-2 space-y-1 text-slate">
            {revoked.map((x) => (
              <li key={x.id}>{t('tags.revokedAt', { date: formatDateTime(x.revokedAt, i18n.language) })}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
