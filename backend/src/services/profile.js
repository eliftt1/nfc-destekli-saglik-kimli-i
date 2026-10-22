import { prisma } from '../lib/prisma.js';
import { decrypt, encrypt } from '../lib/crypto.js';
import { VISIBILITY_KEYS } from '../lib/profileValidation.js';

export const LIMITS = { allergies: 30, conditions: 30, medications: 30, contacts: 10 };

/** Kullanıcının profil kaydının id'sini döner; yoksa (ör. seed ile açılmış hesap) oluşturur. */
export async function ensureProfileId(user) {
  const found = await prisma.healthProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (found) return found.id;
  const created = await prisma.healthProfile.create({
    data: { userId: user.id, fullNameEnc: encrypt(user.fullName) },
    select: { id: true },
  });
  return created.id;
}

/** Profil ve alt kayıtlara dokunulduğunda "son güncelleme" tarihini yeniler. */
export const touchProfile = (profileId) =>
  prisma.healthProfile.update({ where: { id: profileId }, data: { updatedAt: new Date() }, select: { id: true } });

const d = (v) => decrypt(v);

/** Veritabanındaki şifreli profili çözerek tam (kullanıcının kendi) görünümünü üretir. */
export async function loadProfile(userId) {
  const p = await prisma.healthProfile.findUnique({
    where: { userId },
    include: {
      allergies: { orderBy: { createdAt: 'asc' } },
      conditions: { orderBy: { createdAt: 'asc' } },
      medications: { orderBy: { createdAt: 'asc' } },
      contacts: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!p) return null;

  const profile = {
    fullName: d(p.fullNameEnc),
    birthDate: d(p.birthDateEnc),
    bloodType: d(p.bloodTypeEnc),
    note: d(p.noteEnc),
    visibility: Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, p[k]])),
    allergies: p.allergies.map((x) => ({ id: x.id, name: d(x.nameEnc), description: d(x.descriptionEnc) })),
    conditions: p.conditions.map((x) => ({ id: x.id, name: d(x.nameEnc), description: d(x.descriptionEnc) })),
    medications: p.medications.map((x) => ({ id: x.id, name: d(x.nameEnc), usage: d(x.usageEnc) })),
    contacts: p.contacts.map((x) => ({
      id: x.id, name: d(x.nameEnc), relation: d(x.relationEnc), phone: d(x.phoneEnc),
    })),
    updatedAt: p.updatedAt,
  };
  profile.completion = computeCompletion(profile);
  return profile;
}

/** Dört maddelik basit tamamlanma ölçüsü: her madde %25. */
export function computeCompletion(p) {
  const items = [
    { key: 'birthDate', done: Boolean(p.birthDate) },
    { key: 'bloodType', done: Boolean(p.bloodType) && p.bloodType !== 'UNKNOWN' },
    {
      key: 'healthInfo',
      done: p.allergies.length + p.conditions.length + p.medications.length > 0 || Boolean(p.note),
    },
    { key: 'contact', done: p.contacts.length > 0 },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { percent, items };
}
