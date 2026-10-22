import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();

export async function resetDb() {
  // Tüm tablolar User'a bağlıdır (ON DELETE CASCADE); kullanıcıları silmek her şeyi temizler.
  await prisma.user.deleteMany();
}

/** Çerezleri ve CSRF belirtecini otomatik yöneten test istemcisi. */
export async function createClient() {
  const agent = request.agent(app);
  let csrf = (await agent.get('/api/csrf-token')).body.csrfToken;
  const send = async (method, url, body) => {
    const req = agent[method](url);
    if (method !== 'get') req.set('x-csrf-token', csrf).send(body ?? {});
    const res = await req;
    // Giriş/çıkış sonrası dönen yeni CSRF belirtecini kullan
    if (res.body?.csrfToken) csrf = res.body.csrfToken;
    return res;
  };
  return {
    agent,
    get: (u) => send('get', u),
    post: (u, b) => send('post', u, b),
    put: (u, b) => send('put', u, b),
    patch: (u, b) => send('patch', u, b),
    delete: (u, b) => send('delete', u, b),
  };
}

export const validRegistration = (over = {}) => ({
  fullName: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  password: 'GucluSifre123',
  passwordConfirm: 'GucluSifre123',
  acceptPrivacy: true,
  acceptHealthData: true,
  ...over,
});

export async function registerUser(over = {}) {
  const c = await createClient();
  const res = await c.post('/api/auth/register', validRegistration(over));
  if (res.status !== 201) throw new Error(`Kayıt başarısız: ${res.status} ${JSON.stringify(res.body)}`);
  return { client: c, user: res.body.user, email: over.email ?? 'ayse@example.com' };
}

/** Dolu bir profil ve aktif etiket oluşturur; bağlantı, token ve kısa kodu döner. */
export async function setupEmergency(client, over = {}) {
  await client.put('/api/profile', {
    fullName: 'Ayşe Yılmaz', birthDate: '1990-05-17', bloodType: 'A+', note: 'Kalp pili var', ...over,
  });
  await client.post('/api/profile/allergies', { name: 'Penisilin', description: 'Döküntü' });
  await client.post('/api/profile/conditions', { name: 'Tip 1 diyabet' });
  await client.post('/api/profile/medications', { name: 'İnsülin', usage: 'Günde 3 kez' });
  await client.post('/api/profile/contacts', { name: 'Mehmet Yılmaz', relation: 'Eş', phone: '+90 532 123 45 67' });
  await client.post('/api/profile/contacts', { name: 'Fatma Yılmaz', relation: 'Anne', phone: '0212 555 00 11' });
  const res = await client.post('/api/tags');
  if (res.status !== 201) throw new Error(`Etiket oluşturulamadı: ${JSON.stringify(res.body)}`);
  const { tag } = res.body;
  return { tag, url: tag.url, token: tag.url.split('/e/')[1], shortCode: tag.shortCode };
}
