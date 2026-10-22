import { describe, it, expect } from 'vitest';
import { ageFromBirthDate, formatPhone, formatDate } from '../lib/format.js';
import { validateRegister, checkPassword } from '../lib/validate.js';
import { formatCodeInput } from '../components/CodeEntryForm.jsx';

describe('format', () => {
  it('telefon biçimlendirir; tanınmayan biçimi olduğu gibi bırakır', () => {
    expect(formatPhone('+905321234567')).toBe('+90 532 123 45 67');
    expect(formatPhone('02125550011')).toBe('0212 555 00 11');
    expect(formatPhone('+14155550123')).toBe('+14155550123');
  });
  it('yaşı doğum gününe göre hesaplar', () => {
    const now = new Date(2026, 9, 18); // 18 Ekim 2026
    expect(ageFromBirthDate('1990-10-18', now)).toBe(36);
    expect(ageFromBirthDate('1990-10-19', now)).toBe(35);
    expect(ageFromBirthDate('bozuk', now)).toBeNull();
  });
  it('tarihi seçilen dile göre yazar', () => {
    expect(formatDate('1990-05-17', 'tr')).toContain('Mayıs');
    expect(formatDate('1990-05-17', 'en')).toContain('May');
  });
  it('kısa kod girişini biçimlendirir', () => {
    expect(formatCodeInput('abcde12345')).toBe('ABCDE-12345');
    expect(formatCodeInput('abc')).toBe('ABC');
    expect(formatCodeInput('ab-cd e!1234567890')).toBe('ABCDE-12345');
  });
});

describe('istemci doğrulaması', () => {
  it('şifre kuralları backend ile aynıdır', () => {
    expect(checkPassword('kisa1')).toBe('password_too_short');
    expect(checkPassword('sadeceharflerburada')).toBe('password_too_weak');
    expect(checkPassword('GucluSifre123')).toBeNull();
  });
  it('iki onay ayrı ayrı denetlenir', () => {
    const base = { fullName: 'Ayşe Yılmaz', email: 'a@b.co', password: 'GucluSifre123', passwordConfirm: 'GucluSifre123' };
    expect(validateRegister({ ...base, acceptPrivacy: true, acceptHealthData: false })).toEqual({ acceptHealthData: 'consent_required' });
    expect(validateRegister({ ...base, acceptPrivacy: false, acceptHealthData: true })).toEqual({ acceptPrivacy: 'consent_required' });
    expect(validateRegister({ ...base, acceptPrivacy: true, acceptHealthData: true })).toEqual({});
  });
});
