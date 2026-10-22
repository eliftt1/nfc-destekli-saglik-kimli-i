import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind, message) => {
      const id = nextId.current++;
      setToasts((all) => [...all, { id, kind, message }]);
      // Hatalar daha uzun kalır.
      setTimeout(() => dismiss(id), kind === 'error' ? 9000 : 5000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ success: (m) => push('success', m), error: (m) => push('error', m) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((x) => (
          <div
            key={x.id}
            role={x.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border-l-4 px-4 py-3 shadow-lg ${
              x.kind === 'error' ? 'border-alert bg-alert-soft text-alert-dark' : 'border-brand bg-white text-ink'
            }`}
          >
            <span className="flex-1">{x.message}</span>
            <button type="button" onClick={() => dismiss(x.id)} aria-label={t('toast.dismiss')} className="-m-1 min-h-8 min-w-8 rounded text-lg font-bold">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast, ToastProvider içinde kullanılmalı');
  return ctx;
};
