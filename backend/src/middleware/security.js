import helmet from 'helmet';
import { env } from '../config/env.js';

export const securityHeaders = helmet({
  // Token URL'de olduğu için Referer ile sızmasın.
  referrerPolicy: { policy: 'no-referrer' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'img-src': ["'self'", 'data:'], // QR kodu data URL olarak üretilir
      'style-src': ["'self'", "'unsafe-inline'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      ...(env.isProd ? {} : { 'upgrade-insecure-requests': null }),
    },
  },
  hsts: env.isProd ? { maxAge: 63_072_000, includeSubDomains: true } : false,
});

/** API yanıtları (sağlık verisi içerebilir) önbelleğe alınmasın. */
export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}
