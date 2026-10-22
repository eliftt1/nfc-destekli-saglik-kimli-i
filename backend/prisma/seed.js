// Geliştirme/sunum için demo hesap oluşturur. ÜRETİMDE ÇALIŞMAZ.
// Kullanım: npm run db:seed
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import { encrypt } from '../src/lib/crypto.js';
import { createTagRecord, toTagDto } from '../src/services/tags.js';
import { CONSENT_VERSION } from '../src/config/constants.js';

if (env.isProd) {
  console.error('Seed üretim ortamında çalıştırılamaz.');
  process.exit(1);
}

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'DemoSifre123';

await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } }); // tekrar çalıştırılabilir

const now = new Date();
const user = await prisma.user.create({
  data: {
    email: DEMO_EMAIL,
    fullName: 'Demo Kullanıcı',
    passwordHash: await hashPassword(DEMO_PASSWORD),
    privacyAcceptedAt: now,
    healthConsentAt: now,
    consentVersion: CONSENT_VERSION,
    profile: {
      create: {
        fullNameEnc: encrypt('Demo Kullanıcı'),
        birthDateEnc: encrypt('1992-03-14'),
        bloodTypeEnc: encrypt('0+'),
        noteEnc: encrypt('Kalp pili yok. Acil durumda 112 aranmalı.'),
        showBirthDate: true,
        allergies: { create: [{ nameEnc: encrypt('Penisilin'), descriptionEnc: encrypt('Ciddi alerjik reaksiyon') }, { nameEnc: encrypt('Fıstık') }] },
        conditions: { create: [{ nameEnc: encrypt('Astım') }] },
        medications: { create: [{ nameEnc: encrypt('Ventolin'), usageEnc: encrypt('Gerektiğinde inhaler') }] },
        contacts: {
          create: [
            { nameEnc: encrypt('Elif Demo'), relationEnc: encrypt('Anne'), phoneEnc: encrypt('+905551112233'), sortOrder: 0 },
            { nameEnc: encrypt('Can Demo'), relationEnc: encrypt('Kardeş'), phoneEnc: encrypt('+905554445566'), sortOrder: 1 },
          ],
        },
      },
    },
  },
});
const tag = toTagDto(await createTagRecord(user.id));

console.log('\nDemo hesap hazır');
console.log(`  E-posta : ${DEMO_EMAIL}`);
console.log(`  Şifre   : ${DEMO_PASSWORD}   (yalnızca geliştirme)`);
console.log(`  Bağlantı: ${tag.url}`);
console.log(`  Kısa kod: ${tag.shortCode}\n`);
await prisma.$disconnect();
