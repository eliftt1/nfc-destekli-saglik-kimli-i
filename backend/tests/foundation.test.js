import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { encrypt, decrypt } from '../src/lib/crypto.js';
import {
  generateToken, generateShortCode, normalizeShortCode, isValidShortCodeShape, hmacDigest, formatShortCode,
} from '../src/lib/tokens.js';
import { truncateIp } from '../src/lib/ip.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

describe('AES-256-GCM şifreleme', () => {
  it('şifreleyip geri çözer, aynı metin farklı şifreli çıktı üretir', () => {
    const a = encrypt('Penisilin alerjisi');
    const b = encrypt('Penisilin alerjisi');
    expect(a).not.toBe(b);
    expect(a).not.toContain('Penisilin');
    expect(decrypt(a)).toBe('Penisilin alerjisi');
  });
  it('null değerleri korur', () => {
    expect(encrypt(null)).toBeNull();
    expect(decrypt(null)).toBeNull();
  });
  it('değiştirilmiş veriyi reddeder', () => {
    const enc = encrypt('abc');
    const tampered = enc.slice(0, -2) + (enc.endsWith('A') ? 'B' : 'A') + enc.slice(-1);
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe('Token ve kısa kod', () => {
  it('token 256 bit ve benzersizdir', () => {
    const t = generateToken();
    expect(Buffer.from(t, 'base64url')).toHaveLength(32);
    expect(generateToken()).not.toBe(t);
  });
  it('kısa kod biçimi ve normalizasyonu', () => {
    const c = generateShortCode();
    expect(isValidShortCodeShape(c)).toBe(true);
    expect(normalizeShortCode(formatShortCode(c).toLowerCase())).toBe(c);
    expect(normalizeShortCode('o1-il')).toBe('01-11'.replace('-', ''));
  });
  it('özet deterministik ve alan ayrımlıdır', () => {
    expect(hmacDigest('token', 'x')).toBe(hmacDigest('token', 'x'));
    expect(hmacDigest('token', 'x')).not.toBe(hmacDigest('code', 'x'));
  });
});

describe('IP kırpma', () => {
  it('IPv4 /24 ve IPv6 /48 öneki', () => {
    expect(truncateIp('192.168.5.77')).toBe('192.168.5.0/24');
    expect(truncateIp('::ffff:10.1.2.3')).toBe('10.1.2.0/24');
    expect(truncateIp('2001:db8:abcd:1::5')).toBe('2001:db8:abcd::/48');
    expect(truncateIp(undefined)).toBeNull();
  });
});

describe('Uygulama temeli', () => {
  const app = createApp();
  it('health ucu ve güvenlik başlıkları', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });
  it('CSRF belirteci olmadan POST reddedilir', async () => {
    const res = await request(app).post('/api/anything').send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });
  it('CSRF belirteci ile POST CSRF kontrolünü geçer (rota yoksa 404)', async () => {
    const agent = request.agent(app);
    const { body } = await agent.get('/api/csrf-token');
    const res = await agent.post('/api/anything').set('x-csrf-token', body.csrfToken).send({});
    expect(res.status).toBe(404);
  });
  it('veritabanına bağlanır ve şema mevcuttur', async () => {
    expect(await prisma.user.count()).toBeGreaterThanOrEqual(0);
  });
});
