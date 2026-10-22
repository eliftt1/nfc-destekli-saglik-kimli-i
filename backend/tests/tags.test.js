import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';
import { hmacDigest, generateShortCode, generateToken } from '../src/lib/tokens.js';
import { createTagRecord } from '../src/services/tags.js';
import { app, createClient, resetDb, registerUser, setupEmergency } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const alice = () => registerUser({ fullName: 'Ayşe Yılmaz', email: 'ayse@example.com' });
const bob = () => registerUser({ fullName: 'Burak Demir', email: 'burak@example.com' });

describe('Etiket oluşturma', () => {
  it('güvenli token ve kısa kod üretir; bağlantı APP_BASE_URL ile başlar', async () => {
    const { client } = await alice();
    const res = await client.post('/api/tags');
    expect(res.status).toBe(201);
    const { tag } = res.body;
    expect(tag.status).toBe('ACTIVE');
    expect(tag.url).toMatch(/^http:\/\/localhost:5173\/e\/[A-Za-z0-9_-]{43}$/);
    expect(tag.shortCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  });

  it('veritabanında düz token/kısa kod yoktur: yalnızca HMAC özeti ve şifreli kopya', async () => {
    const { client } = await alice();
    const { token, shortCode } = await setupEmergency(client);
    const row = JSON.stringify(await prisma.emergencyTag.findMany());
    expect(row).not.toContain(token);
    expect(row).not.toContain(shortCode.replace('-', ''));
    const stored = await prisma.emergencyTag.findFirst();
    expect(stored.tokenHash).toBe(hmacDigest('token', token));
    expect(stored.shortCodeHash).toBe(hmacDigest('code', shortCode.replace('-', '')));
  });

  it('iki etiketin token ve kodu birbirinden farklıdır', async () => {
    const a = await alice();
    const b = await bob();
    const t1 = (await a.client.post('/api/tags')).body.tag;
    const t2 = (await b.client.post('/api/tags')).body.tag;
    expect(t1.url).not.toBe(t2.url);
    expect(t1.shortCode).not.toBe(t2.shortCode);
  });

  it('aktif etiket varken ikinci etiket oluşturulamaz', async () => {
    const { client } = await alice();
    await client.post('/api/tags');
    const res = await client.post('/api/tags');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_TAG_EXISTS');
  });

  it('listeleme: aktif etiket bağlantı ve kod içerir', async () => {
    const { client } = await alice();
    await client.post('/api/tags');
    const { tags } = (await client.get('/api/tags')).body;
    expect(tags).toHaveLength(1);
    expect(tags[0].url).toBeTruthy();
  });
});

describe('Çakışma (kısa kod benzersizliği veritabanında denetlenir)', () => {
  it('kısa kod çakışırsa yeni değerlerle yeniden dener', async () => {
    const { user } = await alice();
    const other = await bob();
    const first = await createTagRecord(user.id, 'ilk', { token: generateToken, code: () => 'ABCDEFGHJK' });
    expect(first.shortCodeHash).toBe(hmacDigest('code', 'ABCDEFGHJK'));

    const codes = ['ABCDEFGHJK', 'ABCDEFGHJK', 'MNPQRSTVWX']; // ilk iki deneme çakışır
    const second = await createTagRecord(other.user.id, 'ikinci', {
      token: generateToken,
      code: () => codes.shift(),
    });
    expect(second.shortCodeHash).toBe(hmacDigest('code', 'MNPQRSTVWX'));
    expect(codes).toHaveLength(0);
  });

  it('sürekli çakışırsa sonsuza dek denemez, hata verir', async () => {
    const { user } = await alice();
    const o = await bob();
    await createTagRecord(user.id, 'a', { token: generateToken, code: () => 'ABCDEFGHJK' });
    await expect(
      createTagRecord(o.user.id, 'b', { token: generateToken, code: () => 'ABCDEFGHJK' }),
    ).rejects.toThrow();
  });

  it('veritabanı kısıtı aynı özeti ikinci kez kabul etmez', async () => {
    const { user } = await alice();
    await createTagRecord(user.id, 'a', { token: generateToken, code: generateShortCode });
    const row = await prisma.emergencyTag.findFirst();
    await expect(
      prisma.emergencyTag.create({
        data: { userId: user.id, tokenHash: row.tokenHash, shortCodeHash: 'x', tokenEnc: 'x', shortCodeEnc: 'x' },
      }),
    ).rejects.toThrow();
  });
});

describe('İptal ve yenileme', () => {
  it('iptal edilen bağlantı artık sağlık bilgisi açmaz (senaryo 7)', async () => {
    const { client } = await alice();
    const { tag, token, shortCode } = await setupEmergency(client);
    expect((await request(app).get(`/api/public/emergency/${token}`)).status).toBe(200);

    const res = await client.post(`/api/tags/${tag.id}/revoke`);
    expect(res.status).toBe(200);
    expect(res.body.tag.status).toBe('REVOKED');
    expect(res.body.tag.url).toBeUndefined();
    expect(res.body.tag.shortCode).toBeUndefined();

    const after = await request(app).get(`/api/public/emergency/${token}`);
    expect(after.status).toBe(404);
    expect(JSON.stringify(after.body)).not.toContain('Penisilin');
    expect((await request(app).post('/api/public/access').send({ code: shortCode })).status).toBe(404);
  });

  it('iptalden sonra gizli değerler veritabanından da silinir', async () => {
    const { client } = await alice();
    const { tag, token } = await setupEmergency(client);
    await client.post(`/api/tags/${tag.id}/revoke`);
    const { decrypt } = await import('../src/lib/crypto.js');
    const row = await prisma.emergencyTag.findUnique({ where: { id: tag.id } });
    expect(decrypt(row.tokenEnc)).toBe('revoked');
    expect(decrypt(row.tokenEnc)).not.toBe(token);
    expect(row.revokedAt).toBeInstanceOf(Date);
  });

  it('yenileme: eski bağlantı ve kod ölür, yenisi çalışır', async () => {
    const { client } = await alice();
    const old = await setupEmergency(client);
    const res = await client.post(`/api/tags/${old.tag.id}/regenerate`);
    expect(res.status).toBe(201);
    const fresh = res.body.tag;
    expect(fresh.url).not.toBe(old.url);
    expect(fresh.shortCode).not.toBe(old.shortCode);

    expect((await request(app).get(`/api/public/emergency/${old.token}`)).status).toBe(404);
    expect((await request(app).post('/api/public/access').send({ code: old.shortCode })).status).toBe(404);
    expect((await request(app).get(`/api/public/emergency/${fresh.url.split('/e/')[1]}`)).status).toBe(200);

    const tags = (await client.get('/api/tags')).body.tags;
    expect(tags.filter((t) => t.status === 'ACTIVE')).toHaveLength(1);
    expect(tags.filter((t) => t.status === 'REVOKED')).toHaveLength(1);
  });

  it('iptalden sonra yeni etiket oluşturulabilir; iptal edilmiş etiket yenilenemez', async () => {
    const { client } = await alice();
    const { tag } = await setupEmergency(client);
    await client.post(`/api/tags/${tag.id}/revoke`);
    expect((await client.post(`/api/tags/${tag.id}/regenerate`)).status).toBe(409);
    expect((await client.post('/api/tags')).status).toBe(201);
  });
});

describe('Etiket sahipliği', () => {
  it('başkasının etiketini iptal/yenileyemez (404) ve listede görmez', async () => {
    const a = await alice();
    const { tag, token } = await setupEmergency(a.client);
    const b = await bob();
    expect((await b.client.post(`/api/tags/${tag.id}/revoke`)).status).toBe(404);
    expect((await b.client.post(`/api/tags/${tag.id}/regenerate`)).status).toBe(404);
    expect((await b.client.get('/api/tags')).body.tags).toEqual([]);
    expect((await request(app).get(`/api/public/emergency/${token}`)).status).toBe(200);
  });

  it('oturumsuz erişilemez', async () => {
    const c = await createClient();
    expect((await c.get('/api/tags')).status).toBe(401);
    expect((await c.post('/api/tags')).status).toBe(401);
  });
});
