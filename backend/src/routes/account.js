import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { encrypt } from '../lib/crypto.js';
import { verifyPassword } from '../lib/password.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { endSession } from '../services/sessions.js';
import { ensureProfileId } from '../services/profile.js';
import { revokedData } from '../services/tags.js';

export const accountRouter = Router();
accountRouter.use(requireAuth);

const confirmSchema = z.object({ password: z.string({ error: 'required' }).min(1, 'required').max(128) });

// Yıkıcı işlemler parola ile onaylanır (çalıntı oturuma karşı ek koruma).
async function confirmPassword(req) {
  const { password } = confirmSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    throw new AppError(400, 'WRONG_CURRENT_PASSWORD', 'Şifre hatalı', { password: 'wrong_password' });
  }
  return user;
}

accountRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({
      account: {
        email: u.email,
        fullName: u.fullName,
        createdAt: u.createdAt,
        consents: {
          privacyAcceptedAt: u.privacyAcceptedAt,
          healthConsentAt: u.healthConsentAt,
          consentVersion: u.consentVersion,
        },
      },
    });
  }),
);

// Kişisel verilerin silinmesi talebi: sağlık profilini, erişim geçmişini boşaltır ve etiketleri iptal eder. Hesap kalır.
accountRouter.delete(
  '/health-data',
  authLimiter,
  asyncHandler(async (req, res) => {
    const user = await confirmPassword(req);
    const profileId = await ensureProfileId(user);
    await prisma.$transaction([
      prisma.allergy.deleteMany({ where: { profileId } }),
      prisma.chronicCondition.deleteMany({ where: { profileId } }),
      prisma.medication.deleteMany({ where: { profileId } }),
      prisma.emergencyContact.deleteMany({ where: { profileId } }),
      prisma.healthProfile.update({
        where: { id: profileId },
        data: {
          fullNameEnc: encrypt(user.fullName),
          birthDateEnc: null, bloodTypeEnc: null, noteEnc: null,
          updatedAt: new Date(),
        },
      }),
      prisma.accessLog.deleteMany({ where: { tag: { userId: user.id } } }),
      prisma.emergencyTag.updateMany({ where: { userId: user.id, status: 'ACTIVE' }, data: revokedData() }),
    ]);
    res.json({ ok: true });
  }),
);

// Hesabı siler. İlişkili tüm kayıtlar (profil, etiketler, kodlar, oturumlar, loglar) veritabanında CASCADE ile silinir.
// Yasal saklama zorunluluğu bulunan bir kayıt bu projede tutulmamaktadır.
accountRouter.delete(
  '/',
  authLimiter,
  asyncHandler(async (req, res) => {
    const user = await confirmPassword(req);
    await prisma.user.delete({ where: { id: user.id } });
    await endSession(req, res);
    res.json({ ok: true, csrfToken: issueCsrfToken(req, res) });
  }),
);
