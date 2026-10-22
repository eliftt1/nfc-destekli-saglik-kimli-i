import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { Alert, Button, TextField } from '../components/ui.jsx';
import { checkEmail } from '../lib/validate.js';
import { apiErrorText } from '../lib/errors.js';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const err = checkEmail(email);
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      const d = await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      setDelivery(d.delivery);
    } catch (e2) {
      setFormError(apiErrorText(t, e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">{t('auth.forgot.title')}</h1>
      {delivery ? (
        <div className="mt-6 space-y-4">
          {/* E-posta servisi yapılandırılmadıysa gönderildiği iddia edilmez. */}
          <Alert kind={delivery === 'configured' ? 'success' : 'info'}>
            {delivery === 'configured' ? t('auth.forgot.sent') : t('auth.forgot.notConfigured')}
          </Alert>
          <Link to="/login" className="inline-block font-bold text-brand underline">{t('auth.forgot.backToLogin')}</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-5">
          <p className="text-slate">{t('auth.forgot.text')}</p>
          {formError && <Alert>{formError}</Alert>}
          <TextField name="email" type="email" label={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoComplete="email" />
          <Button type="submit" loading={busy} className="w-full">{t('auth.forgot.submit')}</Button>
          <p className="text-center"><Link to="/login" className="font-bold text-brand underline">{t('auth.forgot.backToLogin')}</Link></p>
        </form>
      )}
    </div>
  );
}
