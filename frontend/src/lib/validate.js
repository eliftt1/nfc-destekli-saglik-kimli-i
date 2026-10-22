// Backend kurallarının istemci tarafı yansımasıdır (anında geri bildirim için).
// Asıl doğrulama her zaman backend'dedir. Dönen değerler çeviri anahtarlarıdır.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const checkEmail = (v) => (!v?.trim() ? 'required' : !EMAIL.test(v.trim()) ? 'invalid_email' : null);
export const checkName = (v) => (!v?.trim() ? 'required' : v.trim().length < 2 ? 'name_too_short' : v.trim().length > 100 ? 'too_long' : null);
export function checkPassword(v) {
  if (!v) return 'required';
  if (v.length < 10) return 'password_too_short';
  if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return 'password_too_weak';
  return null;
}

const clean = (errors) => Object.fromEntries(Object.entries(errors).filter(([, v]) => v));

export function validateRegister(v) {
  return clean({
    fullName: checkName(v.fullName),
    email: checkEmail(v.email),
    password: checkPassword(v.password),
    passwordConfirm: v.passwordConfirm !== v.password ? 'password_mismatch' : null,
    acceptPrivacy: v.acceptPrivacy ? null : 'consent_required',
    acceptHealthData: v.acceptHealthData ? null : 'consent_required',
  });
}

export function validateLogin(v) {
  return clean({ email: checkEmail(v.email), password: v.password ? null : 'required' });
}

export function validateReset(v) {
  return clean({
    password: checkPassword(v.password),
    passwordConfirm: v.passwordConfirm !== v.password ? 'password_mismatch' : null,
  });
}

export const checkPhone = (v) => {
  if (!v?.trim()) return 'required';
  return /^\+?\d{7,15}$/.test(v.trim().replace(/[\s\-().]/g, '')) ? null : 'invalid_phone';
};
export const checkRequired = (v, max) => (!v?.trim() ? 'required' : v.trim().length > max ? 'too_long' : null);
export const checkOptional = (v, max) => (v && v.trim().length > max ? 'too_long' : null);
export const checkBirthDate = (v) => {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(d.getTime()) && d <= new Date() && d.getUTCFullYear() >= 1900 ? null : 'invalid_date';
};
