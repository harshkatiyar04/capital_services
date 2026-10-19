const PHONE_MESSAGE = 'Please enter a UK phone number, or leave the phone field blank.';

export function ukPhoneMessage(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  if (/[a-z]/i.test(raw)) return PHONE_MESSAGE;
  const digits = raw.replace(/\D/g, '');
  const compact = raw.replace(/[\s()+-]/g, '');
  const ok = digits && digits === compact && (
    (digits.startsWith('44') && digits.length >= 11 && digits.length <= 13)
    || (digits.startsWith('0') && digits.length >= 10 && digits.length <= 12)
  );
  return ok ? '' : PHONE_MESSAGE;
}
