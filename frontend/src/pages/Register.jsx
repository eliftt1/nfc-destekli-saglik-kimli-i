import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext.jsx';
import { Alert, Button, CheckboxField, TextField } from '../components/ui.jsx';
import { validateRegister } from '../lib/validate.js';
import { apiErrorText } from '../lib/errors.js';

export default function Register() {
  const { t } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    fullName: '', email: '', password: '', passwordConfirm: '', acceptPrivacy: false, acceptHealthData: false,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  // Kayıt tamamlanınca user state'i değişir; bu sırada genel "girişliyse panele git" yönlendirmesi
  // profil sayfasına gitmemizi ezmesin diye kayıt süreci işaretlenir.
  const registering = useRef(false);

  if (user && !registering.current) return <Navigate to="/dashboard" replace />;

  const set = (name) => (e) =>
    setValues((v) => ({ ...v, [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function focusFirstError(errs) {
    const first = Object.keys(errs)[0];
    formRef.current?.querySelector(`[name="${first}"]`)?.focus();
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const errs = validateRegister(values);
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError(errs);

    setBusy(true);
    registering.current = true;
    try {
      await register({ ...values, fullName: values.fullName.trim(), email: values.email.trim() });
      navigate('/dashboard/profile', { replace: true });
    } catch (err) {
      registering.current = false;
      const fields = err.fields ?? {};
      if (err.code === 'EMAIL_TAKEN') fields.email = 'email_taken';
      setErrors(fields);
      setFormError(apiErrorText(t, err));
      focusFirstError(fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-3xl font-bold">{t('auth.register.title')}</h1>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {formError && <Alert>{formError}</Alert>}
        <TextField name="fullName" label={t('auth.fullName')} value={values.fullName} onChange={set('fullName')} error={errors.fullName} autoComplete="name" />
        <TextField name="email" type="email" label={t('auth.email')} value={values.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <TextField name="password" type="password" label={t('auth.password')} hint={t('auth.passwordHint')} value={values.password} onChange={set('password')} error={errors.password} autoComplete="new-password" />
        <TextField name="passwordConfirm" type="password" label={t('auth.passwordConfirm')} value={values.passwordConfirm} onChange={set('passwordConfirm')} error={errors.passwordConfirm} autoComplete="new-password" />

        <fieldset className="space-y-4 rounded-xl border border-line bg-white p-4">
          <legend className="px-1 text-lg font-bold">{t('auth.register.consentsTitle')}</legend>
          {/* Aydınlatma ve açık rıza ayrı ayrı onaylanır. */}
          <div>
            <CheckboxField name="acceptPrivacy" checked={values.acceptPrivacy} onChange={set('acceptPrivacy')} error={errors.acceptPrivacy}>
              {t('auth.register.acceptPrivacy')}
            </CheckboxField>
            <Link to="/privacy" target="_blank" className="ml-9 mt-1 inline-block text-sm font-bold text-brand underline">
              {t('auth.register.privacyLink')}
            </Link>
          </div>
          <CheckboxField name="acceptHealthData" checked={values.acceptHealthData} onChange={set('acceptHealthData')} error={errors.acceptHealthData}>
            {t('auth.register.acceptHealthData')}
          </CheckboxField>
        </fieldset>

        <Button type="submit" loading={busy} className="w-full">{t('auth.register.submit')}</Button>
        <p className="text-center text-slate">
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login" className="font-bold text-brand underline">{t('auth.register.toLogin')}</Link>
        </p>
      </form>
    </div>
  );
}
