import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError, badRequest, unauthorized } from '../lib/errors.js';
import { emailSchema, passwordSchema, fullNameSchema, mustBeTrue } from '../lib/validation.js';
import { hashPassword, verifyPassword, burnPasswordCheck } from '../lib/password.js';
import { encrypt } from '../lib/crypto.js';
import { sha256 } from '../lib/tokens.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { startSession, endSession } from '../services/sessions.js';
import { sendMail, isMailConfigured } from '../services/email.js';
import { env } from '../config/env.js';
import { CONSENT_VERSION, RESET_TOKEN_TTL_MINUTES } from '../config/constants.js';

export const authRouter = Router();

const withMatch = (schema, field, confirmField) =>
  schema.refine((d) => d[field] === d[confirmField], { message: 'password_mismatch', path: [confirmField] });

const registerSchema = withMatch(
  z.object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string({ error: 'required' }),
    // Açık rıza ve aydınlatma onayı ayrı ayrı alınır.
    acceptPrivacy: mustBeTrue,
    acceptHealthData: mustBeTrue,
  }),
  'password',
  'passwordConfirm',
);

const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'required' }).min(1, 'required').max(128),
});

const forgotSchema = z.object({ email: emailSchema });

const resetSchema = withMatch(
  z.object({
    token: z.string({ error: 'required' }).min(10).max(200),
    password: passwordSchema,
    passwordConfirm: z.string({ error: 'required' }),
  }),
  'password',
  'passwordConfirm',
);

const changeSchema = withMatch(
  z.object({
    currentPassword: z.string({ error: 'required' }).min(1, 'required').max(128),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string({ error: 'required' }),
  }),
  'newPassword',
  'newPasswordConfirm',
);

const publicUser = (u) => ({ id: u.id, email: u.email, fullName: u.fullName });

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (exists) throw new AppError(409, 'EMAIL_TAKEN', 'Bu e-posta adresi zaten kullanılıyor', { email: 'email_taken' });

    const passwordHash = await hashPassword(data.password);
    const now = new Date();
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: data.email,
          fullName: data.fullName,
          passwordHash,
          privacyAcceptedAt: now,
          healthConsentAt: now,
          consentVersion: CONSENT_VERSION,
          // Boş sağlık profili kayıtla birlikte oluşturulur.
          profile: { create: { fullNameEnc: encrypt(data.fullName) } },
        },
      });
    } catch (err) {
      // Eşzamanlı kayıt yarışında benzersizlik kısıtı devreye girer.
      if (err?.code === 'P2002') throw new AppError(409, 'EMAIL_TAKEN', 'Bu e-posta adresi zaten kullanılıyor', { email: 'email_taken' });
      throw err;
    }
    await startSession(req, res, user.id);
    res.status(201).json({ user: publicUser(user), csrfToken: issueCsrfToken(req, res) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user ? await verifyPassword(user.passwordHash, password) : (await burnPasswordCheck(password), false);
    // Hesabın var olup olmadığını açığa çıkarmayan tek bir hata.
    if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'E-posta veya şifre hatalı');
    await startSession(req, res, user.id);
    res.json({ user: publicUser(user), csrfToken: issueCsrfToken(req, res) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await endSession(req, res);
    res.json({ ok: true, csrfToken: issueCsrfToken(req, res) });
  }),
);

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

authRouter.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: sha256(token),
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
          },
        }),
      ]);
      const link = `${env.APP_BASE_URL}/reset-password?token=${token}`;
      // Beklemeden gönder: yanıt süresi hesabın varlığını belli etmesin.
      sendMail({
        to: user.email,
        subject: 'Şifre sıfırlama / Password reset',
        text:
          `Şifrenizi sıfırlamak için ${RESET_TOKEN_TTL_MINUTES} dakika içinde bu bağlantıyı açın:\n${link}\n\n` +
          `To reset your password, open this link within ${RESET_TOKEN_TTL_MINUTES} minutes:\n${link}\n\n` +
          'Bu işlemi siz yapmadıysanız bu e-postayı yok sayın. / If this wasn\'t you, ignore this email.',
      }).catch(() => console.error('[e-posta] gönderim hatası'));
    }
    // Hesap var da olsa yok da olsa aynı yanıt. 'delivery' tüm hesaplar için aynıdır, hesabı belli etmez.
    res.json({ ok: true, delivery: isMailConfigured ? 'configured' : 'not_configured' });
  }),
);

authRouter.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = resetSchema.parse(req.body);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(data.token) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw badRequest('INVALID_RESET_TOKEN', 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş');
    }
    const passwordHash = await hashPassword(data.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Güvenlik: tüm açık oturumlar kapatılır.
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/change-password',
  authLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = changeSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !(await verifyPassword(user.passwordHash, data.currentPassword))) {
      throw new AppError(400, 'WRONG_CURRENT_PASSWORD', 'Mevcut şifre hatalı', { currentPassword: 'wrong_password' });
    }
    const passwordHash = await hashPassword(data.newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // Mevcut oturum dışındaki oturumlar kapatılır.
      prisma.session.deleteMany({ where: { userId: user.id, NOT: { tokenHash: req.sessionTokenHash } } }),
    ]);
    res.json({ ok: true });
  }),
);
