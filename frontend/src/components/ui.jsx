import { forwardRef, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const cx = (...a) => a.filter(Boolean).join(' ');

const BTN = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  secondary: 'border-2 border-ink bg-white text-ink hover:bg-paper',
  danger: 'bg-alert text-white hover:bg-alert-dark',
  ghost: 'text-brand hover:bg-brand-soft',
};

export function Button({ variant = 'primary', className, loading, children, disabled, ...rest }) {
  return (
    <button className={cx(BTN, VARIANTS[variant], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'primary', className, children, ...rest }) {
  return (
    <Link to={to} className={cx(BTN, VARIANTS[variant], className)} {...rest}>
      {children}
    </Link>
  );
}

function FieldError({ id, error }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <p id={id} className="mt-1 text-sm font-bold text-alert-dark">
      {t(`validation.${error}`, { defaultValue: t('validation.invalid') })}
    </p>
  );
}

export const TextField = forwardRef(function TextField(
  { label, error, hint, type = 'text', className, ...rest },
  ref,
) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-base font-bold">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cx(
          'min-h-12 w-full rounded-lg border-2 bg-white px-3 text-base text-ink',
          error ? 'border-alert' : 'border-line focus:border-brand',
        )}
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-err`} error={error} />
    </div>
  );
});

export function CheckboxField({ error, children, ...rest }) {
  const id = useId();
  return (
    <div>
      <label className="flex items-start gap-3 text-base leading-snug">
        <input
          type="checkbox"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className="mt-1 h-6 w-6 shrink-0 accent-brand"
          {...rest}
        />
        <span>{children}</span>
      </label>
      <FieldError id={`${id}-err`} error={error} />
    </div>
  );
}

const ALERT = {
  error: 'border-alert bg-alert-soft text-alert-dark',
  info: 'border-brand bg-brand-soft text-ink',
  success: 'border-brand bg-brand-soft text-ink',
};
export function Alert({ kind = 'error', className, children }) {
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border-l-4 px-4 py-3 text-base', ALERT[kind], className)}>
      {children}
    </div>
  );
}

export function Card({ className, children }) {
  return <div className={cx('rounded-xl border border-line bg-white p-5 sm:p-6', className)}>{children}</div>;
}

/** Sayfa yüklenirken kısa durum metni. */
export function LoadingBlock() {
  const { t } = useTranslation();
  return <p role="status" className="py-8 text-lg text-slate">{t('common.loading')}</p>;
}

export function LoadError({ onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 py-6">
      <Alert>{t('dash.loadError')}</Alert>
      <Button variant="secondary" onClick={onRetry}>{t('common.retry')}</Button>
    </div>
  );
}

/** Tehlikeli işlemler için satır içi onay (window.confirm yerine; erişilebilir ve test edilebilir). */
export function ConfirmAction({ label, ariaLabel, message, confirmLabel, onConfirm, variant = 'secondary', busy, className }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button variant={variant} className={className} aria-label={ariaLabel} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <div role="alertdialog" aria-label={message} className="rounded-lg border-2 border-alert bg-alert-soft p-3 text-alert-dark">
      <p className="font-bold">{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            await onConfirm();
            setAsking(false);
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={() => setAsking(false)}>{t('common.cancel')}</Button>
      </div>
    </div>
  );
}

/** "Acil durum sayfasında göster" anahtarı. */
export function VisibilityToggle({ checked, onChange, label, name }) {
  return (
    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-bold text-slate">
      <input type="checkbox" role="switch" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-brand" />
      {label}
    </label>
  );
}
