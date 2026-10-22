import { env } from './env.js';

// Üretimde "__Host-" öneki çerezi Secure + Path=/ + Domain'siz olmaya zorlar.
const prefix = env.isProd ? '__Host-' : '';
export const SESSION_COOKIE = `${prefix}sid`;
export const CSRF_COOKIE = `${prefix}csrf`;

export function sessionCookieOptions(expires) {
  return {
    httpOnly: true, // JavaScript okuyamaz
    secure: env.isProd, // üretimde yalnızca HTTPS
    sameSite: 'lax',
    path: '/',
    expires,
  };
}
