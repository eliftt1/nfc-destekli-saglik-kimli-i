import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createClient, resetDb, registerUser } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const alice = () => registerUser({ fullName: 'Ayşe Yılmaz', email: 'ayse@example.com' });
const bob = () => registerUser({ fullName: 'Burak Demir', email: 'burak@example.com' });

describe('Sağlık profili: kaydet ve geri oku (senaryo 3)', () => {
  it('boş profil döner ve tamamlanma %0 olur', async () => {
    const { client } = await alice();
    const res = await client.get('/api/profile');
    expect(res.status).toBe(200);
    expect(res.body.profile.fullName).toBe('Ayşe Yılmaz');
    expect(res.body.profile.allergies).toEqual([]);
    expect(res.body.profile.completion.percent).toBe(0);
  });

  it('tüm profil bilgilerini kaydeder ve tekrar görüntüler', async () => {
    const { client } = await alice();
    const put = await client.put('/api/profile', {
      fullName: 'Ayşe Yılmaz', birthDate: '1990-05-17', bloodType: 'A+', note: 'Kalp pili var',
    });
    expect(put.status).toBe(200);

    await client.post('/api/profile/allergies', { name: 'Penisilin', description: 'Döküntü yapar' });
    await client.post('/api/profile/allergies', { name: 'Fıstık' });
    await client.post('/api/profile/conditions', { name: 'Tip 1 diyabet' });
    await client.post('/api/profile/medications', { name: 'İnsülin', usage: 'Günde 3 kez' });
    await client.post('/api/profile/contacts', { name: 'Mehmet Yılmaz', relation: 'Eş', phone: '+90 532 123 45 67' });

    const { body } = await client.get('/api/profile');
    const p = body.profile;
    expect(p).toMatchObject({ birthDate: '1990-05-17', bloodType: 'A+', note: 'Kalp pili var' });
    expect(p.allergies.map((a) => a.name)).toEqual(['Penisilin', 'Fıstık']);
    expect(p.allergies[0].description).toBe('Döküntü yapar');
    expect(p.allergies[1].description).toBeNull();
    expect(p.conditions[0].name).toBe('Tip 1 diyabet');
    expect(p.medications[0]).toMatchObject({ name: 'İnsülin', usage: 'Günde 3 kez' });
    expect(p.contacts[0]).toMatchObject({ name: 'Mehmet Yılmaz', relation: 'Eş', phone: '+905321234567' });
    expect(p.completion.percent).toBe(100);
  });

  it('kayıt düzenlenir ve silinir', async () => {
    const { client } = await alice();
    const { body } = await client.post('/api/profile/allergies', { name: 'Polen' });
    const id = body.item.id;
    const upd = await client.put(`/api/profile/allergies/${id}`, { name: 'Çim poleni', description: 'Bahar' });
    expect(upd.body.item).toMatchObject({ id, name: 'Çim poleni', description: 'Bahar' });
    expect((await client.delete(`/api/profile/allergies/${id}`)).status).toBe(200);
    expect((await client.get('/api/profile')).body.profile.allergies).toEqual([]);
    expect((await client.delete(`/api/profile/allergies/${id}`)).status).toBe(404);
  });

  it('isteğe bağlı kişisel alanlar boşaltılabilir', async () => {
    const { client } = await alice();
    await client.put('/api/profile', { fullName: 'Ayşe Yılmaz', birthDate: '1990-05-17', bloodType: '0-', note: 'x' });
    await client.put('/api/profile', { fullName: 'Ayşe Yılmaz', birthDate: '', bloodType: null });
    const p = (await client.get('/api/profile')).body.profile;
    expect(p.birthDate).toBeNull();
    expect(p.bloodType).toBeNull();
    expect(p.note).toBeNull();
  });
});

describe('Şifreleme (veritabanında düz metin yok)', () => {
  it('tüm sağlık alanları şifreli saklanır', async () => {
    const { client } = await alice();
    await client.put('/api/profile', { fullName: 'Ayşe Yılmaz', birthDate: '1990-05-17', bloodType: 'AB+', note: 'GizliNot' });
    await client.post('/api/profile/allergies', { name: 'PenisilinX', description: 'AciklamaX' });
    await client.post('/api/profile/conditions', { name: 'AstimX' });
    await client.post('/api/profile/medications', { name: 'VentolinX', usage: 'KullanimX' });
    await client.post('/api/profile/contacts', { name: 'MehmetX', relation: 'EsX', phone: '05321234567' });

    const dump = JSON.stringify([
      await prisma.healthProfile.findMany(),
      await prisma.allergy.findMany(),
      await prisma.chronicCondition.findMany(),
      await prisma.medication.findMany(),
      await prisma.emergencyContact.findMany(),
    ]);
    for (const secret of ['Ayşe', '1990-05-17', 'AB+', 'GizliNot', 'PenisilinX', 'AciklamaX', 'AstimX',
      'VentolinX', 'KullanimX', 'MehmetX', 'EsX', '05321234567']) {
      expect(dump).not.toContain(secret);
    }
    expect(dump).toContain('v1:');
  });
});

describe('Doğrulama', () => {
  it('geçersiz doğum tarihi, kan grubu ve telefonu reddeder', async () => {
    const { client } = await alice();
    const bad = async (body) => (await client.put('/api/profile', { fullName: 'Ayşe Yılmaz', ...body })).body.error.fields;
    expect((await bad({ birthDate: '2999-01-01' })).birthDate).toBe('invalid_date');
    expect((await bad({ birthDate: '1990-02-31' })).birthDate).toBe('invalid_date');
    expect((await bad({ birthDate: '17.05.1990' })).birthDate).toBe('invalid_date');
    expect((await bad({ bloodType: 'C+' })).bloodType).toBe('invalid_blood_type');

    const c = await client.post('/api/profile/contacts', { name: 'X Y', relation: 'Eş', phone: 'abc' });
    expect(c.status).toBe(400);
    expect(c.body.error.fields.phone).toBe('invalid_phone');
    const empty = await client.post('/api/profile/allergies', { name: '   ' });
    expect(empty.body.error.fields.name).toBe('required');
    const long = await client.post('/api/profile/allergies', { name: 'a'.repeat(101) });
    expect(long.body.error.fields.name).toBe('too_long');
  });

  it('liste başına kayıt sayısı sınırlıdır', async () => {
    const { client } = await alice();
    for (let i = 0; i < 10; i++) {
      expect((await client.post('/api/profile/contacts', { name: `Kişi ${i}`, relation: 'Arkadaş', phone: '5321234567' })).status).toBe(201);
    }
    const res = await client.post('/api/profile/contacts', { name: 'Fazla', relation: 'Arkadaş', phone: '5321234567' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LIMIT_REACHED');
  });

  it('oturum açmadan hiçbir profil rotası çalışmaz', async () => {
    const c = await createClient();
    expect((await c.get('/api/profile')).status).toBe(401);
    expect((await c.put('/api/profile', { fullName: 'Ayşe Yılmaz' })).status).toBe(401);
    expect((await c.post('/api/profile/allergies', { name: 'x' })).status).toBe(401);
  });
});

describe('Görünürlük ayarları', () => {
  it('varsayılanlar: doğum tarihi gizli, diğerleri açık', async () => {
    const { client } = await alice();
    const v = (await client.get('/api/profile')).body.profile.visibility;
    expect(v).toEqual({
      showBirthDate: false, showBloodType: true, showAllergies: true, showConditions: true,
      showMedications: true, showNote: true, showContacts: true,
    });
  });

  it('kısmi güncelleme yapar, bilinmeyen alanı ve geçersiz değeri reddeder', async () => {
    const { client } = await alice();
    const ok = await client.patch('/api/profile/visibility', { showAllergies: false, showBirthDate: true });
    expect(ok.body.profile.visibility).toMatchObject({ showAllergies: false, showBirthDate: true, showNote: true });
    expect((await client.patch('/api/profile/visibility', { isAdmin: true })).status).toBe(400);
    expect((await client.patch('/api/profile/visibility', { showNote: 'evet' })).status).toBe(400);
    expect((await client.patch('/api/profile/visibility', {})).status).toBe(400);
  });
});

describe('Acil durum kişisi sıralaması', () => {
  it('yeni kişi sona eklenir, sıralama değiştirilebilir', async () => {
    const { client } = await alice();
    const ids = [];
    for (const n of ['Bir', 'İki', 'Üç']) {
      ids.push((await client.post('/api/profile/contacts', { name: `${n} Kişi`, relation: 'Eş', phone: '5321234567' })).body.item.id);
    }
    let names = (await client.get('/api/profile')).body.profile.contacts.map((c) => c.name);
    expect(names).toEqual(['Bir Kişi', 'İki Kişi', 'Üç Kişi']);

    const res = await client.put('/api/profile/contacts/order', { ids: [ids[2], ids[0], ids[1]] });
    expect(res.status).toBe(200);
    names = res.body.profile.contacts.map((c) => c.name);
    expect(names).toEqual(['Üç Kişi', 'Bir Kişi', 'İki Kişi']);

    // eksik, fazla ya da tekrarlı liste reddedilir
    expect((await client.put('/api/profile/contacts/order', { ids: [ids[0]] })).status).toBe(400);
    expect((await client.put('/api/profile/contacts/order', { ids: [ids[0], ids[0], ids[1]] })).status).toBe(400);
  });
});

describe('Son güncellenme tarihi', () => {
  it('alt kayıt eklemek/silmek updatedAt değerini yeniler', async () => {
    const { client } = await alice();
    const t0 = new Date((await client.get('/api/profile')).body.profile.updatedAt).getTime();
    await new Promise((r) => setTimeout(r, 20));
    const { body } = await client.post('/api/profile/medications', { name: 'Aspirin' });
    const t1 = new Date((await client.get('/api/profile')).body.profile.updatedAt).getTime();
    expect(t1).toBeGreaterThan(t0);
    await new Promise((r) => setTimeout(r, 20));
    await client.delete(`/api/profile/medications/${body.item.id}`);
    const t2 = new Date((await client.get('/api/profile')).body.profile.updatedAt).getTime();
    expect(t2).toBeGreaterThan(t1);
  });
});

describe('Kullanıcılar arası yalıtım (senaryo 4)', () => {
  it('bir kullanıcı başkasının profilini göremez; /profile her zaman oturum sahibini döner', async () => {
    const a = await alice();
    await a.client.put('/api/profile', { fullName: 'Ayşe Yılmaz', bloodType: 'A+', note: 'Ayşe notu' });
    await a.client.post('/api/profile/allergies', { name: 'Ayşe alerjisi' });
    const b = await bob();

    const pb = (await b.client.get('/api/profile')).body.profile;
    expect(pb.fullName).toBe('Burak Demir');
    expect(pb.allergies).toEqual([]);
    expect(JSON.stringify(pb)).not.toContain('Ayşe');
  });

  it('başkasının kaydını güncelleyemez/silemez (404), kayıt değişmeden kalır', async () => {
    const a = await alice();
    const created = (await a.client.post('/api/profile/allergies', { name: 'Penisilin' })).body.item;
    const contact = (await a.client.post('/api/profile/contacts', { name: 'Mehmet Y', relation: 'Eş', phone: '5321234567' })).body.item;
    const b = await bob();

    for (const [path, id] of [['allergies', created.id], ['contacts', contact.id]]) {
      const body = { name: 'Hacklendi', relation: 'x', phone: '5550000000' };
      expect((await b.client.put(`/api/profile/${path}/${id}`, body)).status).toBe(404);
      expect((await b.client.delete(`/api/profile/${path}/${id}`)).status).toBe(404);
    }
    const after = (await a.client.get('/api/profile')).body.profile;
    expect(after.allergies[0].name).toBe('Penisilin');
    expect(after.contacts[0].name).toBe('Mehmet Y');
  });

  it('başkasının kişi id\'leriyle sıralama yapılamaz', async () => {
    const a = await alice();
    const contact = (await a.client.post('/api/profile/contacts', { name: 'Mehmet Y', relation: 'Eş', phone: '5321234567' })).body.item;
    const b = await bob();
    const mine = (await b.client.post('/api/profile/contacts', { name: 'Kendi Kişim', relation: 'Eş', phone: '5321234567' })).body.item;
    const res = await b.client.put('/api/profile/contacts/order', { ids: [contact.id] });
    expect(res.status).toBe(400);
    expect((await b.client.put('/api/profile/contacts/order', { ids: [mine.id, contact.id] })).status).toBe(400);
    expect((await a.client.get('/api/profile')).body.profile.contacts).toHaveLength(1);
  });

  it('geçersiz id biçimi 404 döner', async () => {
    const { client } = await alice();
    expect((await client.delete('/api/profile/allergies/1')).status).toBe(404);
    expect((await client.put('/api/profile/contacts/not-a-uuid', { name: 'a b', relation: 'x', phone: '5321234567' })).status).toBe(404);
  });
});
