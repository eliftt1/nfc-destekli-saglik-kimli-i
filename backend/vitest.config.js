import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Testler ayrı bir veritabanı kullanır (DATABASE_URL_TEST). Anahtarlar yalnızca test içindir.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    fileParallelism: false, // tek test veritabanı paylaşıldığı için dosyalar sırayla çalışır
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      TRUST_PROXY: '1', // testlerde X-Forwarded-For ile farklı IP'ler simüle edilir
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? '',
      APP_BASE_URL: 'http://localhost:5173',
      HEALTH_DATA_KEY: Buffer.alloc(32, 7).toString('base64'),
      TOKEN_PEPPER: 'test-pepper-test-pepper-test-pepper-1234',
      CSRF_SECRET: 'test-csrf-secret-test-csrf-secret-1234',
    },
  },
});
