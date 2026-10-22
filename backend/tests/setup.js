import { beforeAll } from 'vitest';

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST tanımlı değil. backend/.env dosyanızı kontrol edin.');
  }
  // Güvenlik: yanlışlıkla geliştirme veritabanını silmeyelim.
  if (!/test/i.test(new URL(process.env.DATABASE_URL).pathname)) {
    throw new Error('Test veritabanı adı "test" içermeli; geliştirme veritabanı silinmesin.');
  }
});
