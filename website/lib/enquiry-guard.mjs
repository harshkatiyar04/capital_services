const TEST_SECRET = '1x0000000000000000000000000000000AA';
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function fail(message, status) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

export function clientIp(req = {}) {
  const fwd = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || '';
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  const ip = String(raw).split(',')[0].trim();
  return ip || req.socket?.remoteAddress || 'unknown';
}

export function assertEnquiryRate(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    fail('Too many enquiries from this connection. Please call 01923 270022.', 429);
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
    }
  }
}

function looksLikeToken(value) {
  const text = String(value || '').trim();
  if (text.length < 16 || /\s/.test(text)) return false;
  return /^[A-Za-z0-9+/=_-]+$/.test(text);
}

function isUkPhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return true;
  if (/[a-z]/i.test(raw)) return false;
  const digits = raw.replace(/\D/g, '');
  const compact = raw.replace(/[\s()+-]/g, '');
  if (!digits || digits !== compact) return false;
  if (digits.startsWith('44')) return digits.length >= 11 && digits.length <= 13;
  if (digits.startsWith('0')) return digits.length >= 10 && digits.length <= 12;
  return false;
}

export function honeypotFilled(body = {}) {
  return Boolean(String(body.company_website || '').trim());
}

export function assertEnquiryContent(body = {}) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const message = String(body.message || '').trim();
  const phone = String(body.phone || '').trim();
  if (looksLikeToken(name) || looksLikeToken(message)) {
    fail('Please write your enquiry in plain language.', 400);
  }
  if (email) {
    const local = email.split('@')[0] || '';
    if ((local.match(/\./g) || []).length >= 4) {
      fail('Please enter a valid email.', 400);
    }
  }
  if (!isUkPhone(phone)) {
    fail('Please enter a UK phone number, or leave the phone field blank.', 400);
  }
  if (!email && !phone) {
    fail('Please enter a valid email or UK phone number.', 400);
  }
}

export async function assertTurnstile(token, ip) {
  const secret = process.env.VERCEL
    ? String(process.env.TURNSTILE_SECRET_KEY || '').trim()
    : TEST_SECRET;
  if (!secret) fail('Enquiry check is not configured yet.', 503);
  const response = String(token || '').trim();
  if (!response) fail('Please complete the security check and try again.', 400);

  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', response);

  let data = {};
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    data = await res.json();
  } catch {
    fail('The security check could not be reached. Please try again.', 503);
  }
  if (!data.success) {
    const codes = Array.isArray(data['error-codes']) ? data['error-codes'] : [];
    if (codes.includes('invalid-input-secret')) {
      fail('The security check on the server does not match this site. Check the Turnstile secret in Vercel, then redeploy.', 503);
    }
    fail('Please complete the security check and try again.', 400);
  }
}
