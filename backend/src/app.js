import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { securityHeaders, noStore } from './middleware/security.js';
import { csrfProtection, issueCsrfToken } from './middleware/csrf.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { tagsRouter } from './routes/tags.js';
import { publicRouter } from './routes/public.js';
import { accessLogsRouter } from './routes/accessLogs.js';
import { accountRouter } from './routes/account.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const DEFAULT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

/**
 * options.frontendDist: derlenmiş frontend klasörü. Verilmezse üretimde ../frontend/dist kullanılır.
 * Geliştirmede frontend'i Vite (5173) sunar ve /api isteklerini backend'e yönlendirir.
 */
export function createApp(options = {}) {
  const frontendDist = options.frontendDist ?? (env.isProd ? DEFAULT_DIST : null);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(securityHeaders);
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(noStore);
  api.use(generalLimiter);

  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.get('/csrf-token', (req, res) => res.json({ csrfToken: issueCsrfToken(req, res) }));

  // Herkese açık uçlar oturum/çerez kullanmaz; çerezsiz tarayıcılarda da acil durumda çalışmalıdır.
  // Kimlik doğrulamasız olduğundan CSRF kapsamı dışındadır (hız sınırları geçerlidir).
  api.use('/public', publicRouter);

  // Durum değiştiren tüm /api istekleri CSRF korumasından geçer.
  api.use(csrfProtection);
  api.use('/auth', authRouter);
  api.use('/profile', profileRouter);
  api.use('/tags', tagsRouter);
  api.use('/access-logs', accessLogsRouter);
  api.use('/account', accountRouter);

  app.use('/api', api);
  app.use('/api', notFoundHandler); // bilinmeyen /api adresleri JSON 404 döner (SPA'ya düşmez)

  if (frontendDist && fs.existsSync(path.join(frontendDist, 'index.html'))) {
    // Vite çıktısındaki dosya adları içerik özetli olduğundan uzun süre önbelleğe alınabilir.
    app.use(
      '/assets',
      express.static(path.join(frontendDist, 'assets'), { immutable: true, maxAge: '1y' }),
    );
    app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
    // SPA: uzantısız tüm GET adresleri index.html döner; istemci yönlendirmesi devralır.
    app.get(/^\/(?!api\/)[^.]*$/, (req, res) => {
      res.set('Cache-Control', 'no-store');
      // Acil durum sayfası arama motorlarında indekslenmesin (token URL'de olduğundan Referer da sızmaz).
      if (req.path.startsWith('/e/')) res.set('X-Robots-Tag', 'noindex, nofollow');
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
