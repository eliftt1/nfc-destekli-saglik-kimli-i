import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { generateToken, generateShortCode, formatShortCode, hmacDigest } from '../lib/tokens.js';
import { env } from '../config/env.js';

export const DEFAULT_LABEL = 'Acil durum etiketi';
const defaultGenerators = { token: generateToken, code: generateShortCode };

/**
 * Yeni etiket kaydı oluşturur. Veritabanında yalnızca HMAC özeti (arama için) ve
 * şifreli kopya (panelde tekrar göstermek için) tutulur. Benzersizlik kısıtı
 * ihlal edilirse (çok düşük olasılıklı çakışma) yeni değerlerle yeniden denenir.
 */
export async function createTagRecord(userId, label = DEFAULT_LABEL, gen = defaultGenerators) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = gen.token();
    const code = gen.code();
    try {
      return await prisma.emergencyTag.create({
        data: {
          userId,
          label,
          tokenHash: hmacDigest('token', token),
          shortCodeHash: hmacDigest('code', code),
          tokenEnc: encrypt(token),
          shortCodeEnc: encrypt(code),
        },
      });
    } catch (err) {
      if (err?.code === 'P2002') continue; // çakışma: yeniden üret
      throw err;
    }
  }
  throw new Error('Benzersiz etiket değerleri üretilemedi');
}

/** İptal edilen etiketin gizli değerlerini siler; yalnızca "iptal edilmiş" olduğunu ayırt eden özet kalır. */
export const revokedData = () => ({
  status: 'REVOKED',
  revokedAt: new Date(),
  tokenEnc: encrypt('revoked'),
  shortCodeEnc: encrypt('revoked'),
});

const baseUrl = () => env.APP_BASE_URL.replace(/\/+$/, '');

export function toTagDto(tag) {
  const dto = {
    id: tag.id,
    label: tag.label,
    status: tag.status,
    createdAt: tag.createdAt,
    revokedAt: tag.revokedAt,
  };
  // Yalnızca aktif etiketin bağlantısı ve kodu gösterilir.
  if (tag.status === 'ACTIVE') {
    dto.url = `${baseUrl()}/e/${decrypt(tag.tokenEnc)}`;
    dto.shortCode = formatShortCode(decrypt(tag.shortCodeEnc));
  }
  return dto;
}
