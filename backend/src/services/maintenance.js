import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

/** Süresi dolmuş oturum/sıfırlama tokenlarını ve saklama süresini aşan erişim kayıtlarını siler. */
export async function runMaintenance() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - env.ACCESS_LOG_RETENTION_DAYS * 86_400_000);
  const [sessions, resets, logs] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] },
    }),
    prisma.accessLog.deleteMany({ where: { accessedAt: { lt: cutoff } } }),
  ]);
  return { sessions: sessions.count, resets: resets.count, accessLogs: logs.count };
}
