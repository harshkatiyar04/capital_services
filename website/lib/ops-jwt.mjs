import { createHmac, createHash, timingSafeEqual } from 'crypto';

const JWT_DAYS = 7;

function secret() {
  const key = process.env.JWT_SECRET || process.env.OPS_JWT_SECRET;
  if (key) return key;
  if (process.env.VERCEL) {
    const err = new Error('JWT_SECRET is not set');
    err.status = 500;
    throw err;
  }
  return 'dev-only-jwt-secret-change-before-live';
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signJwt(payload) {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlJson({
    ...payload,
    iat: now,
    exp: now + JWT_DAYS * 24 * 60 * 60,
  });
  const sig = createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function passwordsMatch(plain, expected) {
  const a = createHash('sha256').update(String(plain)).digest();
  const b = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(a, b);
}
