import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';

let dir;
let app;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>SPA</title>');
  fs.writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  app = createApp({ frontendDist: dir });
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('Derlenmiş frontend servisi', () => {
  it('istemci yolları index.html döner (SPA)', async () => {
    for (const p of ['/', '/login', '/dashboard/profile', '/privacy']) {
      const res = await request(app).get(p);
      expect(res.status).toBe(200);
      expect(res.text).toContain('<title>SPA</title>');
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });

  it('/e/:token sayfası noindex başlığıyla gelir, diğerleri gelmez', async () => {
    const e = await request(app).get('/e/' + 'A'.repeat(43));
    expect(e.status).toBe(200);
    expect(e.headers['x-robots-tag']).toContain('noindex');
    expect(e.headers['referrer-policy']).toBe('no-referrer');
    expect((await request(app).get('/privacy')).headers['x-robots-tag']).toBeUndefined();
  });

  it('içerik özetli dosyalar uzun süre önbelleğe alınır', async () => {
    const res = await request(app).get('/assets/app-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/max-age=31536000/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });

  it('olmayan asset ve olmayan dosya index.html DÖNMEZ (404)', async () => {
    expect((await request(app).get('/assets/yok.js')).status).toBe(404);
    const missing = await request(app).get('/yok.js');
    expect(missing.status).toBe(404);
    expect(missing.text).not.toContain('SPA');
  });

  it('bilinmeyen /api adresi JSON 404 döner, SPA\'ya düşmez', async () => {
    const res = await request(app).get('/api/yok');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('API ve acil durum verisi statik servisten etkilenmez', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ ok: true });
    const res = await request(app).get('/api/public/emergency/' + 'A'.repeat(43));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TAG_INVALID');
  });

  it('frontend klasörü yoksa yalnızca API çalışır', async () => {
    const apiOnly = createApp({ frontendDist: path.join(dir, 'yok') });
    expect((await request(apiOnly).get('/api/health')).status).toBe(200);
    expect((await request(apiOnly).get('/login')).status).toBe(404);
  });
});
