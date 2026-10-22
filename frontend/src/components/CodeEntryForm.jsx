import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { Alert, Button } from './ui.jsx';
import { useId } from 'react';

/** Kullanıcı yazdıkça biçimlendirir: büyük harf, yalnızca harf/rakam, 5. karakterden sonra tire. */
export function formatCodeInput(value) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
}

export default function CodeEntryForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const id = useId();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!code.replace('-', '')) {
      setError('empty');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token } = await api('/public/access', { method: 'POST', body: { code } });
      // Kısa kodla gelindiği erişim geçmişinde ayırt edilsin diye durum taşınır.
      navigate(`/e/${token}`, { state: { via: 'code' } });
    } catch (err) {
      setError(err.code === 'RATE_LIMITED' ? 'rateLimited' : err.code === 'NETWORK' ? 'network' : 'invalid');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor={id} className="mb-1 block text-base font-bold">
        {t('access.label')}
      </label>
      <input
        id={id}
        value={code}
        onChange={(e) => setCode(formatCodeInput(e.target.value))}
        placeholder={t('access.placeholder')}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        aria-invalid={error ? 'true' : undefined}
        className="min-h-14 w-full rounded-lg border-2 border-ink bg-white px-4 text-2xl font-bold tracking-widest placeholder:font-normal placeholder:text-slate/60"
      />
      {error && (
        <Alert className="mt-3">{t(`access.${error}`)}</Alert>
      )}
      <Button type="submit" loading={busy} className="mt-3 w-full">
        {t('access.submit')}
      </Button>
    </form>
  );
}
