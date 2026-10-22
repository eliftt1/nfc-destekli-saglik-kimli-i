import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { sha256 } from '../src/lib/tokens.js';
import { outbox } from '../src/services/email.js';
import { createClient, resetDb, validRegistration, registerUser } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  outbox.length = 0;
});
afterAll(() => prisma.$disconnect());

describe('Kayıt', () => {
  it('kullanıcı kayıt olur, oturum açılır ve /me çalışır (senaryo 1)', async () => {
    const c = await createClient();
    const res = await c.post('/api/auth/register', validRegistration());
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ayse@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie'].find((x) => x.startsWith('sid='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const me = await c.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.fullName).toBe('Ayşe Yılmaz');
  });

  it('parola Argon2id ile saklanır, rızalar kaydedilir, boş profil oluşur', async () => {
    await registerUser();
    const u = await prisma.user.findUnique({ where: { email: 'ayse@example.com' }, include: { profile: true } });
    expect(u.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(u.passwordHash).not.toContain('GucluSifre123');
    expect(u.privacyAcceptedAt).toBeInstanceOf(Date);
    expect(u.healthConsentAt).toBeInstanceOf(Date);
    expect(u.consentVersion).toBeTruthy();
    expect(u.profile.fullNameEnc).not.toContain('Ayşe');
  });

  it('oturum tokenı veritabanında düz saklanmaz, yalnızca SHA-256 özeti tutulur', async () => {
    const c = await createClient();
    const res = await c.post('/api/auth/register', validRegistration());
    const raw = res.headers['set-cookie'].find((x) => x.startsWith('sid=')).match(/^sid=([^;]+)/)[1];
    expect(raw.length).toBeGreaterThanOrEqual(40);
    const sessions = await prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toHaveLength(64);
    expect(sessions[0].tokenHash).not.toBe(raw);
    expect(sessions[0].tokenHash).toBe(sha256(raw));
  });

  it('aynı e-posta ikinci kez kullanılamaz (büyük/küçük harf duyarsız)', async () => {
    await registerUser();
    const c = await createClient();
    const res = await c.post('/api/auth/register', validRegistration({ email: 'AYSE@Example.com' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('doğrulama hatalarını alan bazında çeviri anahtarlarıyla döner', async () => {
    const c = await createClient();
    const res = await c.post('/api/auth/register', {
      fullName: 'A', email: 'gecersiz', password: 'kisa', passwordConfirm: 'baska',
      acceptPrivacy: true, acceptHealthData: false,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toMatchObject({
      fullName: 'name_too_short',
      email: 'invalid_email',
      password: 'password_too_short',
      acceptHealthData: 'consent_required',
    });
  });

  it('açık rıza ve aydınlatma onayı ayrı ayrı zorunludur', async () => {
    const c = await createClient();
    const a = await c.post('/api/auth/register', validRegistration({ acceptPrivacy: false }));
    expect(a.body.error.fields.acceptPrivacy).toBe('consent_required');
    const b = await c.post('/api/auth/register', validRegistration({ acceptHealthData: undefined }));
    expect(b.body.error.fields.acceptHealthData).toBe('consent_required');
  });

  it('şifreler eşleşmezse reddeder', async () => {
    const c = await createClient();
    const res = await c.post('/api/auth/register', validRegistration({ passwordConfirm: 'FarkliSifre123' }));
    expect(res.body.error.fields.passwordConfirm).toBe('password_mismatch');
  });

  it('CSRF belirteci olmadan kayıt reddedilir', async () => {
    const c = await createClient();
    const res = await c.agent.post('/api/auth/register').send(validRegistration());
    expect(res.status).toBe(403);
  });
});

describe('Giriş / çıkış', () => {
  it('doğru parola ile giriş yapılır (senaryo 1)', async () => {
    await registerUser();
    const c = await createClient();
    const res = await c.post('/api/auth/login', { email: 'AYSE@example.com', password: 'GucluSifre123' });
    expect(res.status).toBe(200);
    expect((await c.get('/api/auth/me')).status).toBe(200);
  });

  it('yanlış parola ile giriş yapılamaz, hata mesajı hesabı belli etmez (senaryo 2)', async () => {
    await registerUser();
    const c = await createClient();
    const wrong = await c.post('/api/auth/login', { email: 'ayse@example.com', password: 'YanlisSifre123' });
    const unknown = await c.post('/api/auth/login', { email: 'yok@example.com', password: 'YanlisSifre123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect((await c.get('/api/auth/me')).status).toBe(401);
  });

  it('oturum olmadan /me 401 döner', async () => {
    const c = await createClient();
    expect((await c.get('/api/auth/me')).status).toBe(401);
  });

  it('çıkış oturumu sunucuda da geçersiz kılar', async () => {
    const { client } = await registerUser();
    const stolen = (await client.get('/api/auth/me')).status;
    expect(stolen).toBe(200);
    expect((await client.post('/api/auth/logout')).status).toBe(200);
    expect((await client.get('/api/auth/me')).status).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });

  it('süresi dolmuş oturum kabul edilmez', async () => {
    const { client } = await registerUser();
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });
});

describe('Şifre sıfırlama', () => {
  const tokenFrom = (mail) => mail.text.match(/token=([A-Za-z0-9_-]+)/)[1];

  it('var olan ve olmayan hesap için yanıt aynıdır; e-posta yalnızca var olana gider', async () => {
    await registerUser();
    const c = await createClient();
    const a = await c.post('/api/auth/forgot-password', { email: 'ayse@example.com' });
    const b = await c.post('/api/auth/forgot-password', { email: 'yok@example.com' });
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
    // SMTP yokken API bunu açıkça bildirir; arayüz "gönderildi" iddia etmez.
    expect(a.body.delivery).toBe('not_configured');
    await new Promise((r) => setTimeout(r, 50));
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe('ayse@example.com');
  });

  it('token ile şifre sıfırlanır, eski şifre geçmez, token tek kullanımlıktır, oturumlar kapanır', async () => {
    const { client } = await registerUser();
    const c = await createClient();
    await c.post('/api/auth/forgot-password', { email: 'ayse@example.com' });
    await new Promise((r) => setTimeout(r, 50));
    const token = tokenFrom(outbox[0]);

    // veritabanında düz token yok
    expect((await prisma.passwordResetToken.findMany())[0].tokenHash).not.toBe(token);

    const body = { token, password: 'YeniGucluSifre1', passwordConfirm: 'YeniGucluSifre1' };
    expect((await c.post('/api/auth/reset-password', body)).status).toBe(200);
    expect((await c.post('/api/auth/reset-password', body)).body.error.code).toBe('INVALID_RESET_TOKEN');

    expect((await client.get('/api/auth/me')).status).toBe(401); // eski oturum kapandı
    const old = await c.post('/api/auth/login', { email: 'ayse@example.com', password: 'GucluSifre123' });
    expect(old.status).toBe(401);
    const fresh = await c.post('/api/auth/login', { email: 'ayse@example.com', password: 'YeniGucluSifre1' });
    expect(fresh.status).toBe(200);
  });

  it('süresi dolmuş veya rastgele token reddedilir', async () => {
    await registerUser();
    const c = await createClient();
    await c.post('/api/auth/forgot-password', { email: 'ayse@example.com' });
    await new Promise((r) => setTimeout(r, 50));
    const token = tokenFrom(outbox[0]);
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const body = { password: 'YeniGucluSifre1', passwordConfirm: 'YeniGucluSifre1' };
    expect((await c.post('/api/auth/reset-password', { ...body, token })).status).toBe(400);
    expect((await c.post('/api/auth/reset-password', { ...body, token: 'x'.repeat(43) })).status).toBe(400);
  });
});

describe('Şifre değiştirme', () => {
  it('mevcut şifre doğruysa değiştirir, diğer oturumları kapatır', async () => {
    const { client } = await registerUser();
    const other = await createClient();
    await other.post('/api/auth/login', { email: 'ayse@example.com', password: 'GucluSifre123' });

    const bad = await client.post('/api/auth/change-password', {
      currentPassword: 'Yanlis12345', newPassword: 'YeniGucluSifre1', newPasswordConfirm: 'YeniGucluSifre1',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('WRONG_CURRENT_PASSWORD');

    const ok = await client.post('/api/auth/change-password', {
      currentPassword: 'GucluSifre123', newPassword: 'YeniGucluSifre1', newPasswordConfirm: 'YeniGucluSifre1',
    });
    expect(ok.status).toBe(200);
    expect((await client.get('/api/auth/me')).status).toBe(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
  });

  it('oturumsuz istek reddedilir', async () => {
    const c = await createClient();
    const res = await c.post('/api/auth/change-password', {
      currentPassword: 'a', newPassword: 'YeniGucluSifre1', newPasswordConfirm: 'YeniGucluSifre1',
    });
    expect(res.status).toBe(401);
  });
});
