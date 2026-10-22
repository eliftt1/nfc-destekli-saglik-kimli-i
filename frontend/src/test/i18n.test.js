import { describe, it, expect } from 'vitest';
import tr from '../i18n/locales/tr.json';
import en from '../i18n/locales/en.json';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    Array.isArray(v)
      ? v.flatMap((item, i) => (typeof item === 'object' ? flatten(item, `${prefix}${k}.${i}.`) : [[`${prefix}${k}.${i}`, item]]))
      : v && typeof v === 'object'
        ? flatten(v, `${prefix}${k}.`)
        : [[`${prefix}${k}`, v]],
  );

describe('Dil dosyaları', () => {
  const trKeys = flatten(tr).map(([k]) => k).sort();
  const enKeys = flatten(en).map(([k]) => k).sort();

  it('Türkçe ve İngilizce anahtarlar birebir aynıdır', () => {
    expect(enKeys.filter((k) => !trKeys.includes(k))).toEqual([]);
    expect(trKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it('boş çeviri yoktur', () => {
    for (const [k, v] of [...flatten(tr), ...flatten(en)]) expect(String(v).trim(), k).not.toBe('');
  });

  it('backend\'in döndürdüğü tüm doğrulama anahtarları ve hata kodları çevrilmiştir', () => {
    const validation = [
      'required', 'invalid', 'invalid_email', 'password_too_short', 'password_too_weak', 'password_mismatch',
      'name_too_short', 'too_long', 'consent_required', 'email_taken', 'wrong_password', 'invalid_date',
      'invalid_blood_type', 'invalid_phone', 'invalid_id',
    ];
    const codes = [
      'UNAUTHORIZED', 'INVALID_CREDENTIALS', 'EMAIL_TAKEN', 'RATE_LIMITED', 'CSRF_INVALID', 'INVALID_RESET_TOKEN',
      'WRONG_CURRENT_PASSWORD', 'VALIDATION_ERROR', 'NOT_FOUND', 'LIMIT_REACHED', 'ACTIVE_TAG_EXISTS', 'TAG_REVOKED',
      'INVALID_ORDER', 'INTERNAL', 'NETWORK',
    ];
    for (const loc of [tr, en]) {
      for (const k of validation) expect(loc.validation[k], `validation.${k}`).toBeTruthy();
      for (const c of codes) expect(loc.errors[c], `errors.${c}`).toBeTruthy();
    }
  });

  it('gizlilik bölümleri iki dilde aynı kimliklere sahiptir ve "usage" bölümü vardır', () => {
    expect(en.privacy.sections.map((s) => s.id)).toEqual(tr.privacy.sections.map((s) => s.id));
    expect(tr.privacy.sections.some((s) => s.id === 'usage')).toBe(true);
  });
});
