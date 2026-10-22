import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { ToastProvider } from '../components/Toast.jsx';

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * fetch'i yöntem+adres eşlemesiyle taklit eder. Eşleşmeyen istek testi düşürür.
 * routes: { 'GET /api/x': (req) => Response | body } ; geri dönen mock çağrıları kaydeder.
 */
export function mockApi(routes = {}) {
  const calls = [];
  const fn = vi.fn(async (url, init = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const key = `${method} ${url}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body, headers: init.headers });
    if (url === '/api/csrf-token') return json(200, { csrfToken: 'test-csrf' });
    if (key === 'GET /api/auth/me' && !(key in routes)) return json(401, { error: { code: 'UNAUTHORIZED' } });
    // Dinamik adresler (ör. /api/profile/allergies/:id) için isteğe bağlı eşleyici
    // Tam eşleşme her zaman önceliklidir; dinamik eşleyici yalnızca eşleşme yoksa çalışır.
    const handler = routes[key] ?? (() => {
      const dynamic = routes.__dynamic?.({ method, url, body });
      return dynamic !== undefined ? () => dynamic : undefined;
    })();
    if (!handler) throw new Error(`Beklenmeyen istek: ${key}`);
    const out = typeof handler === 'function' ? handler({ body, url }) : handler;
    return out instanceof Response ? out : json(200, out);
  });
  vi.stubGlobal('fetch', fn);
  fn.calls = calls;
  return fn;
}

export function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

/** Sayfayı gerçek yönlendirme ve AuthProvider ile çizer. */
export function renderRoute(ui, { path = '/', route = '/', extraRoutes = null, state } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: route.split('?')[0], search: route.includes('?') ? `?${route.split('?')[1]}` : '', state }]}>
      <AuthProvider>
        <ToastProvider>
        <Routes>
          <Route path={path} element={ui} />
          {extraRoutes}
          <Route path="*" element={<LocationProbe />} />
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
