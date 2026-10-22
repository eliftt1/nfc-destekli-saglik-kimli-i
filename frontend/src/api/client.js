// Tek noktadan API erişimi: çerezler aynı origin'de gönderilir, durum değiştiren isteklere CSRF başlığı eklenir.
export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let csrfToken = null;

async function fetchCsrf() {
  const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
  const data = await res.json();
  csrfToken = data.csrfToken;
}

async function parse(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function api(path, { method = 'GET', body } = {}, retried = false) {
  const headers = {};
  const init = { method, credentials: 'same-origin', headers };
  if (method !== 'GET') {
    if (!csrfToken) await fetchCsrf();
    headers['x-csrf-token'] = csrfToken;
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body ?? {});
  }

  let res;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error');
  }
  const data = await parse(res);

  // CSRF belirteci geçersizleştiyse (ör. oturum değişti) bir kez yenileyip tekrar dene.
  if (res.status === 403 && data?.error?.code === 'CSRF_INVALID' && !retried && method !== 'GET') {
    csrfToken = null;
    return api(path, { method, body }, true);
  }
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'INTERNAL', e.message ?? 'Error', e.fields);
  }
  if (data.csrfToken) csrfToken = data.csrfToken; // giriş/çıkış sonrası yeni belirteç
  return data;
}

/** Testler için: önbellekteki belirteci sıfırlar. */
export const resetCsrf = () => {
  csrfToken = null;
};
