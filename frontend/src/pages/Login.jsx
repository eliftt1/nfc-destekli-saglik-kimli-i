import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext.jsx';
import { Alert, Button, TextField } from '../components/ui.jsx';
import { validateLogin } from '../lib/validate.js';
import { apiErrorText } from '../lib/errors.js';

export default function Login() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const target = location.state?.from?.pathname ?? '/dashboard';
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={target} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const errs = validateLogin(values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await login(values.email.trim(), values.password);
      navigate(target, { replace: true });
    } catch (err) {
      setFormError(apiErrorText(t, err));
    } finally {
      setBusy(false);
    }
  }

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">{t('auth.login.title')}</h1>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {formError && <Alert>{formError}</Alert>}
        <TextField name="email" type="email" label={t('auth.email')} value={values.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <TextField name="password" type="password" label={t('auth.password')} value={values.password} onChange={set('password')} error={errors.password} autoComplete="current-password" />
        <Button type="submit" loading={busy} className="w-full">{t('auth.login.submit')}</Button>
        <p className="text-center"><Link to="/forgot-password" className="font-bold text-brand underline">{t('auth.login.forgot')}</Link></p>
        <p className="text-center text-slate">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="font-bold text-brand underline">{t('auth.login.toRegister')}</Link>
        </p>
      </form>
    </div>
  );
}
