import { doubleCsrf } from 'csrf-csrf';
import { env } from '../config/env.js';
import { CSRF_COOKIE, SESSION_COOKIE } from '../config/cookies.js';

// Token oturum çerezine bağlanır; giriş/çıkıştan sonra yeni token alınmalıdır.
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.cookies?.[SESSION_COOKIE] ?? 'anonymous',
  cookieName: CSRF_COOKIE,
  cookieOptions: { sameSite: 'lax', secure: env.isProd, httpOnly: true, path: '/' },
  size: 32,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
  errorConfig: { statusCode: 403, message: 'Geçersiz CSRF belirteci', code: 'CSRF_INVALID' },
});

export const csrfProtection = doubleCsrfProtection;
export const issueCsrfToken = (req, res) => generateToken(req, res, { overwrite: true });
