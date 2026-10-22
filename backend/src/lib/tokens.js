import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { env } from '../config/env.js';

// Karışabilen karakterler (I, L, O, U) hariç 32 karakterlik alfabe.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SHORT_CODE_LENGTH = 10; // 32^10 ≈ 2^50

/** 256 bit rastgele, URL'de güvenle kullanılabilir token. */
export function generateToken() {
  return randomBytes(32).toString('base64url');
}

/** 10 karakterlik kısa kod (düz biçim, tire olmadan). */
export function generateShortCode() {
  let out = '';
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function formatShortCode(code) {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** Kullanıcı girdisini normalize eder: büyük harf, tire/boşluk atılır, O→0, I/L→1. */
export function normalizeShortCode(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function isValidShortCodeShape(code) {
  return code.length === SHORT_CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

/** Arama için anahtarlı özet (HMAC-SHA256). Alan ayrımı için "purpose" kullanılır. */
export function hmacDigest(purpose, value) {
  return createHmac('sha256', env.TOKEN_PEPPER).update(`${purpose}:${value}`).digest('hex');
}

/** Oturum ve şifre sıfırlama tokenları yüksek entropili olduğundan SHA-256 yeterlidir. */
export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
