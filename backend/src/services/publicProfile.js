import { prisma } from '../lib/prisma.js';
import { decrypt } from '../lib/crypto.js';

/**
 * Herkese açık acil durum görünümü. Beyaz liste yaklaşımı:
 * gizli işaretlenen veya boş olan alanlar yanıta HİÇ girmez (ve gereksiz yere çözülmez).
 * İç kimlikler (id) döndürülmez.
 */
export async function loadPublicProfile(userId) {
  const p = await prisma.healthProfile.findUnique({ where: { userId } });
  if (!p) return null;

  const out = { fullName: decrypt(p.fullNameEnc), updatedAt: p.updatedAt };

  if (p.showBirthDate && p.birthDateEnc) out.birthDate = decrypt(p.birthDateEnc);
  if (p.showBloodType && p.bloodTypeEnc) {
    const blood = decrypt(p.bloodTypeEnc);
    if (blood && blood !== 'UNKNOWN') out.bloodType = blood;
  }
  if (p.showNote && p.noteEnc) out.note = decrypt(p.noteEnc);

  const byCreated = { orderBy: { createdAt: 'asc' } };
  const [allergies, conditions, medications, contacts] = await Promise.all([
    p.showAllergies ? prisma.allergy.findMany({ where: { profileId: p.id }, ...byCreated }) : [],
    p.showConditions ? prisma.chronicCondition.findMany({ where: { profileId: p.id }, ...byCreated }) : [],
    p.showMedications ? prisma.medication.findMany({ where: { profileId: p.id }, ...byCreated }) : [],
    p.showContacts
      ? prisma.emergencyContact.findMany({
          where: { profileId: p.id },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        })
      : [],
  ]);

  const withOptional = (name, key, enc) => ({ name: decrypt(name), ...(enc ? { [key]: decrypt(enc) } : {}) });
  if (allergies.length) out.allergies = allergies.map((r) => withOptional(r.nameEnc, 'description', r.descriptionEnc));
  if (conditions.length) out.conditions = conditions.map((r) => withOptional(r.nameEnc, 'description', r.descriptionEnc));
  if (medications.length) out.medications = medications.map((r) => withOptional(r.nameEnc, 'usage', r.usageEnc));
  if (contacts.length) {
    out.contacts = contacts.map((r) => ({
      name: decrypt(r.nameEnc),
      relation: decrypt(r.relationEnc),
      phone: decrypt(r.phoneEnc),
    }));
  }
  return out;
}
