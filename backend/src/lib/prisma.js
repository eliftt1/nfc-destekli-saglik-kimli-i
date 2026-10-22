import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from '../config/env.js';

// MySQL ve MariaDB için aynı sürücü kullanılır.
// DATABASE_URL: mysql://KULLANICI:PAROLA@localhost:3306/nfc_health
const url = new URL(env.DATABASE_URL);
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ''),
  connectionLimit: 10,
  // MySQL 8 varsayılan olarak caching_sha2_password kullanır; TLS olmadan ilk girişte sürücünün
  // sunucudan RSA anahtarı alabilmesi gerekir. Yalnızca yerel bağlantıda otomatik açılır;
  // uzak sunucu için TLS kullanın veya adrese ?allowPublicKeyRetrieval=true ekleyin.
  allowPublicKeyRetrieval: isLocal || url.searchParams.get('allowPublicKeyRetrieval') === 'true',
});

export const prisma = new PrismaClient({ adapter });
