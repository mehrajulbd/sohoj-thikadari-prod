import { digits } from './i18n';
export function normalizePhone(value: string) {
  const v = digits(value).replace(/[^0-9+]/g, '');
  if (/^01\d{9}$/.test(v)) return '+880' + v.slice(1);
  if (/^8801\d{9}$/.test(v)) return '+' + v;
  return v;
}
