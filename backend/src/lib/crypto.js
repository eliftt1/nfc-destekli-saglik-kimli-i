import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

// Biçim: "v1:" + base64(iv[12] | authTag[16] | şifreli metin)
const VERSION = 'v1:';

export function encrypt(plain) {
  if (plain === null || plain === undefined) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', env.healthKey, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return VERSION + Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decrypt(payload) {
  if (payload === null || payload === undefined) return null;
  if (!payload.startsWith(VERSION)) throw new Error('Bilinmeyen şifreli veri biçimi');
  const raw = Buffer.from(payload.slice(VERSION.length), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', env.healthKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
