import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Adres bulunamadı' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const fields = {};
    // Mesajlar çeviri anahtarıdır; Zod'un varsayılan (İngilizce) metinleri 'invalid' olarak sadeleştirilir.
    for (const issue of err.issues) {
      fields[issue.path.join('.') || '_'] ??= /^[a-z_]+$/.test(issue.message) ? issue.message : 'invalid';
    }
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Girdiler geçersiz', fields } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { fields: err.details } : {}) },
    });
  }
  if (err?.code === 'CSRF_INVALID' || err?.statusCode === 403) {
    return res.status(403).json({ error: { code: 'CSRF_INVALID', message: 'Geçersiz CSRF belirteci' } });
  }
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'İstek gövdesi geçersiz' } });
  }
  // Diğer ara katmanların ürettiği istemci hataları (ör. 404/400) 500'e dönüşmesin.
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: { code: err.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: 'İstek işlenemedi' } });
  }
  // Dahili hata: ayrıntı istemciye gitmez, sağlık verisi loglanmaz (yalnızca ad ve mesaj).
  if (env.NODE_ENV !== 'test') console.error('[hata]', err?.name, err?.message);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Beklenmeyen bir hata oluştu' } });
}
