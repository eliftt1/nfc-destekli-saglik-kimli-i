import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { Alert, Button, LinkButton, TextField } from '../components/ui.jsx';
import { validateReset } from '../lib/validate.js';
import { apiErrorText } from '../lib/errors.js';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [values, setValues] = useState({ password: '', passwordConfirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-10">
        <h1 className="text-3xl font-bold">{t('auth.reset.title')}</h1>
        <Alert>{t('auth.reset.missingToken')}</Alert>
        <Link to="/forgot-password" className="inline-block font-bold text-brand underline">{t('auth.reset.requestNew')}</Link>
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const errs = validateReset(values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, ...values } });
      setDone(true);
    } catch (err) {
      setErrors(err.fields ?? {});
      setFormError(apiErrorText(t, err));
    } finally {
      setBusy(false);
    }
  }
  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">{t('auth.reset.title')}</h1>
      {done ? (
        <div className="mt-6 space-y-4">
          <Alert kind="success">{t('auth.reset.done')}</Alert>
          <LinkButton to="/login">{t('auth.login.submit')}</LinkButton>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
          {formError && <Alert>{formError}</Alert>}
          <TextField name="password" type="password" label={t('auth.password')} hint={t('auth.passwordHint')} value={values.password} onChange={set('password')} error={errors.password} autoComplete="new-password" />
          <TextField name="passwordConfirm" type="password" label={t('auth.passwordConfirm')} value={values.passwordConfirm} onChange={set('passwordConfirm')} error={errors.passwordConfirm} autoComplete="new-password" />
          <Button type="submit" loading={busy} className="w-full">{t('auth.reset.submit')}</Button>
          {formError && <p className="text-center"><Link to="/forgot-password" className="font-bold text-brand underline">{t('auth.reset.requestNew')}</Link></p>}
        </form>
      )}
    </div>
  );
}
