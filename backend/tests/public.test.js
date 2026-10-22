import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';
import { resetShortCodeLimits } from '../src/middleware/rateLimit.js';
import { app, resetDb, registerUser, setupEmergency } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  resetShortCodeLimits();
});
afterAll(() => prisma.$disconnect());

const fetchPublic = (token, q = '') => request(app).get(`/api/public/emergency/${token}${q}`);
const alice = () => registerUser({ fullName: 'Ayşe Yılmaz', email: 'ayse@example.com' });

describe('Acil durum sayfası verisi', () => {
  it('geçerli token giriş yapmadan profili açar (senaryo 6)', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    const res = await fetchPublic(token);
    expect(res.status).toBe(200);
    const p = res.body.profile;
    expect(p.fullName).toBe('Ayşe Yılmaz');
    expect(p.bloodType).toBe('A+');
    expect(p.note).toBe('Kalp pili var');
    expect(p.allergies).toEqual([{ name: 'Penisilin', description: 'Döküntü' }]);
    expect(p.conditions).toEqual([{ name: 'Tip 1 diyabet' }]);
    expect(p.medications).toEqual([{ name: 'İnsülin', usage: 'Günde 3 kez' }]);
    expect(p.contacts.map((c) => c.name)).toEqual(['Mehmet Yılmaz', 'Fatma Yılmaz']);
    expect(p.updatedAt).toBeTruthy();
  });

  it('yalnızca görünür alanlar döner; gizliler yanıtta HİÇ yoktur (senaryo 5)', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    // doğum tarihi varsayılan olarak gizli
    let body = JSON.stringify((await fetchPublic(token)).body);
    expect(body).not.toContain('1990-05-17');
    expect(body).not.toContain('birthDate');

    await client.patch('/api/profile/visibility', {
      showBirthDate: true, showBloodType: false, showAllergies: false, showConditions: false,
      showMedications: false, showNote: false, showContacts: false,
    });
    const res = await fetchPublic(token);
    expect(res.body.profile.birthDate).toBe('1990-05-17');
    body = JSON.stringify(res.body);
    for (const secret of ['A+', 'bloodType', 'Penisilin', 'allergies', 'diyabet', 'conditions', 'İnsülin', 'medications',
      'Kalp pili', 'note', 'Mehmet', 'contacts', '+90532', 'Yılmaz Yılmaz']) {
      expect(body).not.toContain(secret);
    }
    expect(Object.keys(res.body.profile).sort()).toEqual(['birthDate', 'fullName', 'updatedAt']);
  });

  it('her alanın görünürlüğü bağımsız çalışır', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    await client.patch('/api/profile/visibility', { showMedications: false, showNote: false });
    const p = (await fetchPublic(token)).body.profile;
    expect(p.allergies).toBeDefined();
    expect(p.contacts).toBeDefined();
    expect(p.medications).toBeUndefined();
    expect(p.note).toBeUndefined();
  });

  it('boş alanlar yanıta eklenmez; bilinmeyen kan grubu gösterilmez', async () => {
    const { client } = await alice();
    await client.put('/api/profile', { fullName: 'Ayşe Yılmaz', bloodType: 'UNKNOWN' });
    const tag = (await client.post('/api/tags')).body.tag;
    const p = (await fetchPublic(tag.url.split('/e/')[1])).body.profile;
    expect(Object.keys(p).sort()).toEqual(['fullName', 'updatedAt']);
  });

  it('iç kimlikler ve sistem alanları sızmaz', async () => {
    const { client, user } = await alice();
    const { token } = await setupEmergency(client);
    const body = JSON.stringify((await fetchPublic(token)).body);
    expect(body).not.toContain(user.id);
    expect(body).not.toContain('ayse@example.com');
    expect(body).not.toMatch(/"id"/);
    expect(body).not.toContain('passwordHash');
  });

  it('telefon, arama bağlantısı için doğru ve normalleştirilmiş biçimdedir (senaryo 10, API tarafı)', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    const { contacts } = (await fetchPublic(token)).body.profile;
    expect(contacts[0]).toEqual({ name: 'Mehmet Yılmaz', relation: 'Eş', phone: '+905321234567' });
    expect(contacts[1].phone).toBe('02125550011');
    for (const c of contacts) expect(`tel:${c.phone}`).toMatch(/^tel:\+?\d{7,15}$/);
  });

  it('noindex, no-store ve referrer başlıkları ayarlıdır', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    const res = await fetchPublic(token);
    expect(res.headers['x-robots-tag']).toContain('noindex');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('oturum/çerez gerekmez; çerez bırakmaz', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    const res = await fetchPublic(token);
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('Geçersiz token (senaryo 7)', () => {
  it('rastgele, kısa, uzun veya bozuk tokenlar aynı genel hatayı verir', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    const cases = [
      'A'.repeat(43), 'kisa', 'x'.repeat(200), '<script>alert(1)</script>', `${token}x`, token.slice(0, -1),
      "' OR 1=1 --", '..%2F..%2Fetc%2Fpasswd',
    ];
    for (const t of cases) {
      const res = await fetchPublic(encodeURIComponent(t));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TAG_INVALID');
      expect(JSON.stringify(res.body)).not.toContain('Ayşe');
    }
    expect(await prisma.accessLog.count()).toBe(0); // başarısız denemeler loglanmaz
  });
});

describe('Kısa kod erişimi (senaryo 8)', () => {
  it('geçerli kod doğru profilin token\'ını verir; küçük harf ve tire toleransı vardır', async () => {
    const { client } = await alice();
    const { token, shortCode } = await setupEmergency(client);
    for (const input of [shortCode, shortCode.toLowerCase(), shortCode.replace('-', ''), ` ${shortCode} `]) {
      const res = await request(app).post('/api/public/access').send({ code: input });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ token });
    }
    // Kod doğrudan sağlık verisi döndürmez.
    const res = await request(app).post('/api/public/access').send({ code: shortCode });
    expect(JSON.stringify(res.body)).not.toContain('Penisilin');
  });

  it('kodu iki ayrı kullanıcı için doğru profile yönlendirir', async () => {
    const a = await alice();
    const b = await registerUser({ fullName: 'Burak Demir', email: 'burak@example.com' });
    const ea = await setupEmergency(a.client);
    const eb = await setupEmergency(b.client, { fullName: 'Burak Demir' });
    const ta = (await request(app).post('/api/public/access').send({ code: ea.shortCode })).body.token;
    const tb = (await request(app).post('/api/public/access').send({ code: eb.shortCode })).body.token;
    expect((await fetchPublic(ta)).body.profile.fullName).toBe('Ayşe Yılmaz');
    expect((await fetchPublic(tb)).body.profile.fullName).toBe('Burak Demir');
  });

  it('QR/NFC bağlantısı (tags API adresi) ilgili sayfayı açar (senaryo 11, API tarafı)', async () => {
    const { client } = await alice();
    const { url } = await setupEmergency(client);
    const path = new URL(url).pathname; // /e/<token>  — SPA bu token ile API'yi çağırır
    expect(path).toMatch(/^\/e\/[A-Za-z0-9_-]{43}$/);
    const res = await fetchPublic(path.replace('/e/', ''));
    expect(res.status).toBe(200);
    expect(res.body.profile.fullName).toBe('Ayşe Yılmaz');
  });
});

describe('Geçersiz kod ve hız sınırı (senaryo 9)', () => {
  const bad = (ip) => {
    const r = request(app).post('/api/public/access').send({ code: 'ZZZZZ-ZZZZZ' });
    return ip ? r.set('X-Forwarded-For', ip) : r;
  };

  it('geçersiz, boş ve bozuk kodlar erişim vermez ve hep aynı genel hatayı döner', async () => {
    const { client } = await alice();
    await setupEmergency(client);
    for (const code of ['ZZZZZ-ZZZZZ', '', 'abc', '!!!!!!!!!!', 'A'.repeat(11)]) {
      const res = await request(app).post('/api/public/access').send({ code });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CODE_INVALID');
      resetShortCodeLimits();
    }
    expect((await request(app).post('/api/public/access').send({})).status).toBe(400);
  });

  it('aynı IP\'den 8 başarısız denemeden sonra geçici olarak engellenir', async () => {
    const { client } = await alice();
    const { shortCode } = await setupEmergency(client);
    for (let i = 0; i < 8; i++) expect((await bad()).status).toBe(404);
    const blocked = await bad();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    // Engel sürerken doğru kod da geçici olarak reddedilir.
    expect((await request(app).post('/api/public/access').send({ code: shortCode })).status).toBe(429);
    // Başka bir IP etkilenmez.
    expect((await request(app).post('/api/public/access').set('X-Forwarded-For', '203.0.113.9').send({ code: shortCode })).status).toBe(200);
  });

  it('başarılı denemeler sınıra sayılmaz', async () => {
    const { client } = await alice();
    const { shortCode } = await setupEmergency(client);
    for (let i = 0; i < 20; i++) {
      expect((await request(app).post('/api/public/access').send({ code: shortCode })).status).toBe(200);
    }
  });

  it('tek IP\'nin engellenen istekleri genel sayacı doldurmaz (herkesi engelleyemez)', async () => {
    const { client } = await alice();
    const { shortCode } = await setupEmergency(client);
    // Genel sınır 500: tek IP 520 istek gönderir. Doğru sırada yalnızca ilk 8'i genel sayaca ulaşır.
    let blocked = 0;
    for (let i = 0; i < 520; i++) if ((await bad('198.51.100.7')).status === 429) blocked++;
    expect(blocked).toBe(512);
    const other = await request(app).post('/api/public/access').set('X-Forwarded-For', '203.0.113.50').send({ code: shortCode });
    expect(other.status).toBe(200);
  }, 60_000);

  it('dağıtık saldırıda genel sınır devreye girer (500 başarısız deneme/saat)', async () => {
    const { client } = await alice();
    const { shortCode } = await setupEmergency(client);
    for (let i = 0; i < 500; i++) {
      const res = await bad(`10.${(i >> 8) & 255}.${i & 255}.1`);
      expect(res.status).toBe(404);
    }
    const res = await bad('192.0.2.77');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect((await request(app).post('/api/public/access').set('X-Forwarded-For', '192.0.2.78').send({ code: shortCode })).status).toBe(429);
  }, 60_000);
});

describe('Erişim geçmişi', () => {
  it('bağlantı ve kısa kod erişimleri türüyle kaydedilir; IP kırpılır; sağlık verisi yazılmaz', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    await fetchPublic(token);
    await fetchPublic(token, '?via=code');
    await fetchPublic(token, '?via=baska'); // bilinmeyen değer LINK sayılır

    const { logs } = (await client.get('/api/access-logs')).body;
    expect(logs).toHaveLength(3);
    expect(logs.map((l) => l.kind).sort()).toEqual(['LINK', 'LINK', 'SHORT_CODE']);
    for (const l of logs) {
      expect(l.ipPrefix).toBe('127.0.0.0/24');
      expect(l.tagLabel).toBeTruthy();
    }
    const raw = JSON.stringify(await prisma.accessLog.findMany());
    for (const s of ['Penisilin', 'Ayşe', '127.0.0.1', token]) expect(raw).not.toContain(s);
  });

  it('en yeniden eskiye sıralanır ve sayfalanır', async () => {
    const { client } = await alice();
    const { token } = await setupEmergency(client);
    for (let i = 0; i < 5; i++) {
      await fetchPublic(token);
      await new Promise((r) => setTimeout(r, 5));
    }
    const p1 = (await client.get('/api/access-logs?limit=2')).body;
    expect(p1.logs).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = (await client.get(`/api/access-logs?limit=2&cursor=${p1.nextCursor}`)).body;
    expect(p2.logs).toHaveLength(2);
    const p3 = (await client.get(`/api/access-logs?limit=2&cursor=${p2.nextCursor}`)).body;
    expect(p3.logs).toHaveLength(1);
    expect(p3.nextCursor).toBeNull();
    const times = [...p1.logs, ...p2.logs, ...p3.logs].map((l) => new Date(l.accessedAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('yalnızca kendi etiketinin kayıtlarını görür', async () => {
    const a = await alice();
    const b = await registerUser({ fullName: 'Burak Demir', email: 'burak@example.com' });
    const ea = await setupEmergency(a.client);
    await setupEmergency(b.client, { fullName: 'Burak Demir' });
    await fetchPublic(ea.token);
    expect((await a.client.get('/api/access-logs')).body.logs).toHaveLength(1);
    expect((await b.client.get('/api/access-logs')).body.logs).toHaveLength(0);
  });

  it('oturumsuz erişilemez', async () => {
    expect((await request(app).get('/api/access-logs')).status).toBe(401);
  });
});
