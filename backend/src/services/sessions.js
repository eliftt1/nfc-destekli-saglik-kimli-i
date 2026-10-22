import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { sha256 } from '../lib/tokens.js';
import { env } from '../config/env.js';
import { SESSION_COOKIE, sessionCookieOptions } from '../config/cookies.js';

/** Yeni oturum oluşturur ve çerezi yanıta yazar. Veritabanında yalnızca özet saklanır. */
export async function startSession(req, res, userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);
  await prisma.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  // CSRF belirteci oturum çerezine bağlı olduğundan yeni çerezle eşleşmesi için güncellenir.
  req.cookies[SESSION_COOKIE] = token;
}

export async function endSession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  const { expires: _e, ...opts } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
  delete req.cookies[SESSION_COOKIE];
}
