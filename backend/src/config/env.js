import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string({ error: 'DATABASE_URL gerekli' }).min(1, 'DATABASE_URL gerekli'),
  // Kullanıcıya gösterilen herkese açık adres (etiket/QR bağlantıları bununla üretilir)
  APP_BASE_URL: z.string({ error: 'APP_BASE_URL gerekli (ör. http://localhost:5173)' }).url('APP_BASE_URL geçerli bir adres olmalı'),
  // 32 baytlık AES anahtarı, base64. Üretmek için: openssl rand -base64 32
  HEALTH_DATA_KEY: z.string({ error: 'HEALTH_DATA_KEY gerekli (openssl rand -base64 32)' }).min(1, 'HEALTH_DATA_KEY gerekli (openssl rand -base64 32)'),
  // Token/kısa kod özetleri ve CSRF için gizli değer. Üretmek için: openssl rand -base64 48
  TOKEN_PEPPER: z.string({ error: 'TOKEN_PEPPER gerekli (openssl rand -base64 48)' }).min(32, 'TOKEN_PEPPER en az 32 karakter olmalı'),
  CSRF_SECRET: z.string({ error: 'CSRF_SECRET gerekli (openssl rand -base64 48)' }).min(32, 'CSRF_SECRET en az 32 karakter olmalı'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  ACCESS_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  // Reverse proxy arkasında çalışırken 1 yapın (istemci IP'si için)
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Acil Sağlık <no-reply@localhost>'),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Ortam değişkenleri geçersiz:\n${lines.join('\n')}`);
  }
  const env = parsed.data;

  // Şifreleme anahtarı: tam 32 bayt olmalı, yoksa uygulama başlamaz.
  const key = Buffer.from(env.HEALTH_DATA_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('HEALTH_DATA_KEY geçersiz: base64 kodlanmış 32 bayt olmalı (openssl rand -base64 32).');
  }
  if (env.NODE_ENV === 'production' && !env.APP_BASE_URL.startsWith('https://')) {
    throw new Error('Üretimde APP_BASE_URL https:// ile başlamalı.');
  }
  return { ...env, healthKey: key, isProd: env.NODE_ENV === 'production' };
}

export const env = load();
