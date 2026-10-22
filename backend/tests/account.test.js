import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';
import { resetShortCodeLimits } from '../src/middleware/rateLimit.js';
import { app, createClient, resetDb, registerUser, setupEmergency } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  resetShortCodeLimits();
});
afterAll(() => prisma.$disconnect());

const alice = () => registerUser({ fullName: 'Ayşe Yılmaz', email: 'ayse@example.com' });
const PASSWORD = 'GucluSifre123';

describe('Hesap bilgileri', () => {
  it('e-posta, ad ve rıza kayıtlarını gösterir', async () => {
    const { client } = await alice();
    const { account } = (await client.get('/api/account')).body;
    expect(account.email).toBe('ayse@example.com');
    expect(account.consents.healthConsentAt).toBeTruthy();
    expect(account.consents.consentVersion).toBeTruthy();
    expect(JSON.stringify(account)).not.toContain('passwordHash');
  });
});

describe('Hesap silme (senaryo 12)', () => {
  it('hesap silinince profil, etiketler, kodlar ve oturumlar erişilemez olur', async () => {
    const { client, user } = await alice();
    const { token, shortCode } = await setupEmergency(client);
    await request(app).get(`/api/public/emergency/${token}`); // erişim kaydı da oluşsun
    expect((await request(app).get(`/api/public/emergency/${token}`)).status).toBe(200);

    const del = await client.delete('/api/account', { password: PASSWORD });
    expect(del.status).toBe(200);

    // eski bağlantı ve kısa kod artık hiçbir şey açmaz
    const after = await request(app).get(`/api/public/emergency/${token}`);
    expect(after.status).toBe(404);
    expect(JSON.stringify(after.body)).not.toContain('Penisilin');
    expect((await request(app).post('/api/public/access').send({ code: shortCode })).status).toBe(404);
    // oturum kapandı
    expect((await client.get('/api/auth/me')).status).toBe(401);
    // giriş yapılamaz
    const c = await createClient();
    expect((await c.post('/api/auth/login', { email: 'ayse@example.com', password: PASSWORD })).status).toBe(401);

    // veritabanında hiçbir ilişkili kayıt kalmaz
    const counts = await Promise.all([
      prisma.user.count(), prisma.session.count(), prisma.healthProfile.count(), prisma.allergy.count(),
      prisma.chronicCondition.count(), prisma.medication.count(), prisma.emergencyContact.count(),
      prisma.emergencyTag.count(), prisma.accessLog.count(), prisma.passwordResetToken.count(),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it('yanlış şifreyle silinmez', async () => {
    const { client } = await alice();
    const res = await client.delete('/api/account', { password: 'YanlisSifre123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WRONG_CURRENT_PASSWORD');
    expect(await prisma.user.count()).toBe(1);
  });

  it('şifre gönderilmezse silinmez; oturumsuz silinemez', async () => {
    const { client } = await alice();
    expect((await client.delete('/api/account', {})).status).toBe(400);
    const anon = await createClient();
    expect((await anon.delete('/api/account', { password: PASSWORD })).status).toBe(401);
    expect(await prisma.user.count()).toBe(1);
  });

  it('başka kullanıcının verisi etkilenmez', async () => {
    const a = await alice();
    const b = await registerUser({ fullName: 'Burak Demir', email: 'burak@example.com' });
    await setupEmergency(a.client);
    const eb = await setupEmergency(b.client, { fullName: 'Burak Demir' });
    await a.client.delete('/api/account', { password: PASSWORD });
    expect((await request(app).get(`/api/public/emergency/${eb.token}`)).body.profile.fullName).toBe('Burak Demir');
    expect(await prisma.emergencyTag.count()).toBe(1);
  });
});

describe('Kişisel verilerin silinmesini talep etme', () => {
  it('sağlık verilerini ve erişim geçmişini siler, etiketleri iptal eder; hesap kalır', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    await request(app).get(`/api/public/emergency/${token}`);

    const res = await client.delete('/api/account/health-data', { password: PASSWORD });
    expect(res.status).toBe(200);

    const p = (await client.get('/api/profile')).body.profile;
    expect(p).toMatchObject({ birthDate: null, bloodType: null, note: null, allergies: [], conditions: [], medications: [], contacts: [] });
    expect(await prisma.accessLog.count()).toBe(0);
    expect((await request(app).get(`/api/public/emergency/${token}`)).status).toBe(404);
    expect((await client.get('/api/tags')).body.tags[0].status).toBe('REVOKED');
    expect((await client.get('/api/auth/me')).status).toBe(200); // hesap duruyor
  });

  it('parola olmadan çalışmaz', async () => {
    const { client } = await alice();
    await setupEmergency(client);
    expect((await client.delete('/api/account/health-data', { password: 'YanlisSifre123' })).status).toBe(400);
    expect((await client.get('/api/profile')).body.profile.allergies).toHaveLength(1);
  });
});
