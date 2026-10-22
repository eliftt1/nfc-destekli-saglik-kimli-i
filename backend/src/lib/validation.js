import { z } from 'zod';

// Hata mesajları çeviri anahtarlarıdır; frontend bunları dil dosyalarından gösterir.
export const emailSchema = z
  .string({ error: 'required' })
  .trim()
  .toLowerCase()
  .min(1, 'required')
  .max(254, 'too_long')
  .email('invalid_email');

export const passwordSchema = z
  .string({ error: 'required' })
  .min(10, 'password_too_short')
  .max(128, 'too_long')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'password_too_weak');

export const fullNameSchema = z
  .string({ error: 'required' })
  .trim()
  .min(2, 'name_too_short')
  .max(100, 'too_long');

export const mustBeTrue = z.boolean({ error: 'consent_required' }).refine((v) => v === true, 'consent_required');

export const uuidSchema = z.string().uuid('invalid_id');
