import rateLimit, { MemoryStore } from 'express-rate-limit';
import { env } from '../config/env.js';

const tooMany = (message) => (req, res) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message } });

const make = (opts) =>
  rateLimit({ standardHeaders: 'draft-7', legacyHeaders: false, ...opts });

const isTest = env.NODE_ENV === 'test';

// Sayaçlar bellektedir (tek sunucu için yeterli; çok sunuculu kurulumda Redis gibi ortak bir depo gerekir).
const ipStore = new MemoryStore();
const globalStore = new MemoryStore();
/** Yalnızca testler için: kısa kod sayaçlarını sıfırlar. */
export const resetShortCodeLimits = () => {
  ipStore.resetAll();
  globalStore.resetAll();
};

/** Tüm /api istekleri için gevşek genel sınır. */
export const generalLimiter = make({
  windowMs: 60_000,
  limit: isTest ? 10_000 : 300,
  handler: tooMany('Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.'),
});

/** Giriş, kayıt ve şifre sıfırlama için orta düzey sınır. */
export const authLimiter = make({
  windowMs: 15 * 60_000,
  limit: isTest ? 10_000 : 20,
  handler: tooMany('Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin.'),
});

/** Kısa kod: IP başına yalnızca BAŞARISIZ denemeler sayılır. */
export const shortCodeIpLimiter = make({
  windowMs: 15 * 60_000,
  limit: 8,
  store: ipStore,
  skipSuccessfulRequests: true,
  handler: tooMany('Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.'),
});

/**
 * Dağıtık (çok IP'li) tahmin saldırılarına karşı genel başarısız deneme sınırı.
 * Kısa kod ~50 bit entropiye sahiptir; bu sınır kaba kuvvet ihtimalini pratikte ortadan kaldırır.
 */
export const shortCodeGlobalLimiter = make({
  windowMs: 60 * 60_000,
  limit: 500,
  store: globalStore,
  skipSuccessfulRequests: true,
  keyGenerator: () => 'global',
  validate: { keyGeneratorIpFallback: false },
  handler: tooMany('Sistem şu an çok fazla başarısız deneme alıyor. Lütfen daha sonra tekrar deneyin.'),
});

/** Uzun token ile erişim: tahmin imkânsız, yine de kötüye kullanıma karşı IP başına sınır. */
export const publicTokenLimiter = make({
  windowMs: 60_000,
  limit: isTest ? 10_000 : 60,
  handler: tooMany('Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.'),
});
