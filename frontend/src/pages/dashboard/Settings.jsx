import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiErrorText } from '../../lib/errors.js';
import { formatDateTime } from '../../lib/format.js';
import { checkPassword } from '../../lib/validate.js';
import { useToast } from '../../components/Toast.jsx';
import { Alert, Button, Card, CheckboxField, LoadError, LoadingBlock, TextField } from '../../components/ui.jsx';

function ChangePassword() {
  const { t } = useTranslation();
  const toast = useToast();
  const [v, setV] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!v.currentPassword) errs.currentPassword = 'required';
    const pw = checkPassword(v.newPassword);
    if (pw) errs.newPassword = pw;
    if (v.newPassword !== v.newPasswordConfirm) errs.newPasswordConfirm = 'password_mismatch';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: v });
      toast.success(t('settings.password.done'));
      setV({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
    } catch (err) {
      setErrors(err.fields ?? {});
      if (!err.fields) toast.error(apiErrorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} noValidate className="space-y-4">
        <h2 className="text-xl font-bold">{t('settings.password.title')}</h2>
        <TextField name="currentPassword" type="password" label={t('settings.password.current')} value={v.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} autoComplete="current-password" />
        <TextField name="newPassword" type="password" label={t('settings.password.new')} hint={t('auth.passwordHint')} value={v.newPassword} onChange={set('newPassword')} error={errors.newPassword} autoComplete="new-password" />
        <TextField name="newPasswordConfirm" type="password" label={t('settings.password.confirm')} value={v.newPasswordConfirm} onChange={set('newPasswordConfirm')} error={errors.newPasswordConfirm} autoComplete="new-password" />
        <Button type="submit" loading={busy}>{t('settings.password.submit')}</Button>
      </form>
    </Card>
  );
}

/** Şifreyle onaylanan yıkıcı işlem formu (sağlık verisi silme / hesap silme). */
function DangerZone({ ns, endpoint, requireUnderstand, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [understand, setUnderstand] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!password) errs.password = 'required';
    if (requireUnderstand && !understand) errs.understand = 'consent_required';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api(endpoint, { method: 'DELETE', body: { password } });
      await onDone();
      setOpen(false);
      setPassword('');
    } catch (err) {
      if (err.fields?.password) setErrors({ password: err.fields.password });
      else toast.error(apiErrorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 border-alert">
      <h2 className="text-xl font-bold">{t(`settings.${ns}.title`)}</h2>
      <p>{t(`settings.${ns}.text`)}</p>
      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)}>{t(`settings.${ns}.button`)}</Button>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4 rounded-lg bg-alert-soft p-4" aria-label={t(`settings.${ns}.title`)}>
          {requireUnderstand && (
            <CheckboxField name="understand" checked={understand} onChange={(e) => setUnderstand(e.target.checked)} error={errors.understand}>
              {t(`settings.${ns}.understand`)}
            </CheckboxField>
          )}
          <TextField name="password" type="password" label={t(`settings.${ns}.confirmPassword`)} value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoComplete="current-password" />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" loading={busy}>{t(`settings.${ns}.submit`)}</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { logout, endSession } = useAuth();
  const [account, setAccount] = useState(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    try {
      setAccount((await api('/account')).account);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  useEffect(() => { load(); }, []);

  if (failed && !account) return <LoadError onRetry={load} />;
  if (!account) return <LoadingBlock />;
  const c = account.consents;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('settings.title')}</h1>

      <Card>
        <h2 className="text-xl font-bold">{t('settings.account.title')}</h2>
        <dl className="mt-3 space-y-3">
          <div><dt className="text-sm font-bold text-slate">{t('settings.account.name')}</dt><dd className="break-words text-lg">{account.fullName}</dd></div>
          <div><dt className="text-sm font-bold text-slate">{t('settings.account.email')}</dt><dd className="break-words text-lg">{account.email}</dd></div>
          <div><dt className="text-sm font-bold text-slate">{t('settings.account.since')}</dt><dd className="text-lg">{formatDateTime(account.createdAt, i18n.language)}</dd></div>
          <div>
            <dt className="text-sm font-bold text-slate">{t('settings.account.consent', { version: c.consentVersion })}</dt>
            <dd>{t('settings.account.consentDate', { date: formatDateTime(c.healthConsentAt, i18n.language) })}</dd>
          </div>
        </dl>
      </Card>

      <ChangePassword />

      <Card>
        <h2 className="text-xl font-bold">{t('settings.session.title')}</h2>
        <Button variant="secondary" className="mt-3" onClick={async () => { try { await logout(); } catch (err) { toast.error(apiErrorText(t, err)); } }}>
          {t('settings.session.logout')}
        </Button>
      </Card>

      <DangerZone ns="erase" endpoint="/account/health-data" onDone={async () => toast.success(t('settings.erase.done'))} />
      <DangerZone
        ns="delete" endpoint="/account" requireUnderstand
        onDone={async () => endSession()} // hesap silindi, sunucudaki oturum da kapandı: ana sayfaya yönlendirilir
      />
      {failed && <Alert>{t('dash.loadError')}</Alert>}
    </div>
  );
}
