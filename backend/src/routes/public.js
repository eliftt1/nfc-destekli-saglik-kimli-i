import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { decrypt } from '../lib/crypto.js';
import { hmacDigest, normalizeShortCode, isValidShortCodeShape } from '../lib/tokens.js';
import { truncateIp } from '../lib/ip.js';
import { publicTokenLimiter, shortCodeIpLimiter, shortCodeGlobalLimiter } from '../middleware/rateLimit.js';
import { loadPublicProfile } from '../services/publicProfile.js';

// Oturum gerektirmez. Arama motorları indekslemesin.
export const publicRouter = Router();
publicRouter.use((_req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

const invalidTag = () =>
  new AppError(404, 'TAG_INVALID', 'Bu bağlantı geçersiz veya iptal edilmiş');
const invalidCode = () => new AppError(404, 'CODE_INVALID', 'Kod geçersiz');

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/; // 32 bayt, base64url

publicRouter.get(
  '/emergency/:token',
  publicTokenLimiter,
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    // Biçimi bozuk token için veritabanına gidilmez. Geçersiz/iptal ayrımı yapılmaz.
    if (!TOKEN_SHAPE.test(token)) throw invalidTag();

    const tag = await prisma.emergencyTag.findUnique({ where: { tokenHash: hmacDigest('token', token) } });
    if (!tag || tag.status !== 'ACTIVE') throw invalidTag();

    const profile = await loadPublicProfile(tag.userId);
    if (!profile) throw invalidTag();

    // Erişim kaydı: zaman, tür ve kırpılmış IP. Sağlık verisi yazılmaz.
    // "via=code" yalnızca kullanıcının kendi geçmişindeki etiketi belirler; yetki sağlamaz.
    try {
      await prisma.accessLog.create({
        data: {
          tagId: tag.id,
          kind: req.query.via === 'code' ? 'SHORT_CODE' : 'LINK',
          ipPrefix: truncateIp(req.ip),
        },
      });
    } catch {
      console.error('[erişim kaydı] yazılamadı'); // kayıt hatası acil bilgiyi engellemez
    }
    res.json({ profile });
  }),
);

const codeSchema = z.object({ code: z.string().max(40) });

// Sıra önemlidir: önce IP sınırı. IP'si engellenen istekler genel sayaca ulaşmaz;
// aksi halde tek bir saldırgan genel sınırı doldurup herkesi engelleyebilirdi.
// Yalnızca BAŞARISIZ (4xx) yanıtlar sayılır.
publicRouter.post(
  '/access',
  shortCodeIpLimiter,
  shortCodeGlobalLimiter,
  asyncHandler(async (req, res) => {
    const { code } = codeSchema.parse(req.body);
    const normalized = normalizeShortCode(code);
    if (!isValidShortCodeShape(normalized)) throw invalidCode();

    const tag = await prisma.emergencyTag.findUnique({
      where: { shortCodeHash: hmacDigest('code', normalized) },
    });
    if (!tag || tag.status !== 'ACTIVE') throw invalidCode();
    // Kısa kod doğrudan sağlık verisi döndürmez; yalnızca acil durum sayfasının adresini verir.
    res.json({ token: decrypt(tag.tokenEnc) });
  }),
);
