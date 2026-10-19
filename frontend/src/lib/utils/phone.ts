// Cambodian phone numbers (domain-model.md § Conventions). Stored normalized as 0XXXXXXXX
// (9–10 digits). "+855 12 345 678", "855 12345678" and "012 345 678" all normalize to "012345678".

export const PHONE_PATTERN = /^0[1-9]\d{7,8}$/;

/** Strip formatting and convert a +855 / 855 country prefix to a leading 0. */
export function normalizePhone(input: string): string {
  let d = (input ?? '').replace(/\D/g, '');
  if (d.startsWith('855')) {
    d = d.slice(3);
    if (!d.startsWith('0')) d = '0' + d;
  }
  return d;
}

/** True when the input (formatted or not) normalizes to a valid Cambodian number. */
export function isValidPhone(input: string): boolean {
  return PHONE_PATTERN.test(normalizePhone(input));
}

/** Display form: "012 345 678" (9 digits) or "096 818 9261" (10 digits). */
export function formatPhone(input: string): string {
  const d = normalizePhone(input);
  if (!PHONE_PATTERN.test(d)) return input;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}
