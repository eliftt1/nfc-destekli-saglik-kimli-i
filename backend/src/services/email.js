import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Testlerde gönderilen e-postalar burada toplanır.
export const outbox = [];

let transporter = null;
if (env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

/** SMTP yapılandırılmış mı? (Arayüz, gönderim yapılmadığında bunu dürüstçe söyleyebilsin diye.) */
export const isMailConfigured = Boolean(transporter);

/**
 * Yapılandırılabilir e-posta arayüzü: sendMail({ to, subject, text }).
 * SMTP yoksa e-posta GÖNDERİLMEZ:
 *  - test: outbox'a yazılır
 *  - development: içerik sunucu konsoluna yazılır (şifre sıfırlama bağlantısını oradan alın)
 *  - production: uyarı loglanır, içerik loglanmaz
 * Dönüş değeri: gerçekten gönderildi mi (boolean).
 */
export async function sendMail({ to, subject, text }) {
  if (transporter) {
    await transporter.sendMail({ from: env.MAIL_FROM, to, subject, text });
    return true;
  }
  if (env.NODE_ENV === 'test') {
    outbox.push({ to, subject, text });
  } else if (env.NODE_ENV === 'development') {
    console.log(`\n[DEV E-POSTA - gönderilmedi] Kime: ${to}\nKonu: ${subject}\n${text}\n`);
  } else {
    console.warn('[e-posta] SMTP yapılandırılmadığı için e-posta gönderilemedi.');
  }
  return false;
}
