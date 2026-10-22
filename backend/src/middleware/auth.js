import { prisma } from '../lib/prisma.js';
import { sha256 } from '../lib/tokens.js';
import { unauthorized } from '../lib/errors.js';
import { SESSION_COOKIE } from '../config/cookies.js';

/** Geçerli oturum yoksa 401 döner; varsa req.user ve req.sessionTokenHash ayarlanır. */
export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length < 20) throw unauthorized();
    const tokenHash = sha256(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });
    if (!session || session.expiresAt <= new Date()) throw unauthorized();
    req.user = session.user;
    req.sessionTokenHash = tokenHash;
    next();
  } catch (err) {
    next(err);
  }
}
