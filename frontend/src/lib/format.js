/** Telefonu okunaklı gösterir: +905321234567 → +90 532 123 45 67, 02125550011 → 0212 555 00 11. */
export function formatPhone(phone) {
  if (!phone) return '';
  const m1 = phone.match(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (m1) return `+90 ${m1[1]} ${m1[2]} ${m1[3]} ${m1[4]}`;
  const m2 = phone.match(/^0(\d{3})(\d{3})(\d{2})(\d{2})$/);
  if (m2) return `0${m2[1]} ${m2[2]} ${m2[3]} ${m2[4]}`;
  return phone;
}

const loc = (lang) => (lang?.startsWith('en') ? 'en-GB' : 'tr-TR');

export function formatDate(iso, lang) {
  if (!iso) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return new Intl.DateTimeFormat(loc(lang), { dateStyle: 'long' }).format(d);
}

export function formatDateTime(iso, lang) {
  if (!iso) return '';
  return new Intl.DateTimeFormat(loc(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** YYYY-MM-DD doğum tarihinden yaş. */
export function ageFromBirthDate(iso, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age -= 1;
  return age >= 0 ? age : null;
}
