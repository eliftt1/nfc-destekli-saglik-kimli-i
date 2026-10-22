import { z } from 'zod';

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-', 'UNKNOWN'];

export const reqText = (max) =>
  z.string({ error: 'required' }).trim().min(1, 'required').max(max, 'too_long');

export const optText = (max) =>
  z
    .string({ error: 'invalid' })
    .trim()
    .max(max, 'too_long')
    .nullish()
    .transform((v) => v || null);

/** Telefon: boşluk, tire ve parantezler atılır; 7-15 rakam, isteğe bağlı baştaki + kabul edilir. */
export const phoneSchema = z
  .string({ error: 'required' })
  .trim()
  .min(1, 'required')
  .transform((v) => v.replace(/[\s\-().]/g, ''))
  .refine((v) => /^\+?\d{7,15}$/.test(v), 'invalid_phone');

export const birthDateSchema = z
  .string({ error: 'invalid_date' })
  .trim()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => {
    if (v === null) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return false; // 31 Şubat gibi
    return d <= new Date() && d.getUTCFullYear() >= 1900;
  }, 'invalid_date');

export const bloodTypeSchema = z
  .string({ error: 'invalid_blood_type' })
  .trim()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || BLOOD_TYPES.includes(v), 'invalid_blood_type');

export const VISIBILITY_KEYS = [
  'showBirthDate', 'showBloodType', 'showAllergies', 'showConditions',
  'showMedications', 'showNote', 'showContacts',
];
