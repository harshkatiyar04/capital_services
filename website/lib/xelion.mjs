function trim(value) {
  return String(value || '').trim();
}

function fail(message, status = 500) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

/** Xelion integration is on hold until Capital/Expert setup is ready. Set XELION_ENABLED=true to resume. */
export function xelionEnabled() {
  return /^(1|true|yes)$/i.test(trim(process.env.XELION_ENABLED));
}

export function xelionConfig() {
  const host = trim(process.env.XELION_HOST).replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const tenant = trim(process.env.XELION_TENANT) || 'master';
  const gatewayId = trim(process.env.XELION_GATEWAY_ID);
  const token = trim(process.env.XELION_AUTH_TOKEN);
  const appKey = trim(process.env.XELION_APP_KEY);
  const enabled = xelionEnabled();
  return {
    host,
    tenant,
    gatewayId,
    token,
    appKey,
    enabled,
    // Keys stay in .env; ready stays false while on hold.
    ready: enabled && Boolean(host && tenant && gatewayId && token),
  };
}

export function xelionStatus() {
  const cfg = xelionConfig();
  return {
    enabled: cfg.enabled,
    configured: cfg.ready,
    hostSet: Boolean(cfg.host),
    tenant: cfg.tenant,
    gatewayIdSet: Boolean(cfg.gatewayId),
    tokenSet: Boolean(cfg.token),
    appKeySet: Boolean(cfg.appKey),
    onHold: !cfg.enabled,
  };
}

function chatBase(cfg = xelionConfig()) {
  if (!cfg.ready) {
    fail('Xelion is not configured yet. Host, tenant, gateway ID and token are required.', 503);
  }
  return `https://${cfg.host}/portal/chat/${encodeURIComponent(cfg.tenant)}/gateways/${encodeURIComponent(cfg.gatewayId)}`;
}

async function xelionFetch(path, { method = 'GET', body } = {}) {
  const cfg = xelionConfig();
  const url = `${chatBase(cfg)}${path}`;
  const headers = {
    Accept: 'application/json',
    Authorization: cfg.token,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    fail('Could not reach the Xelion host.', 503);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      `Xelion request failed (${res.status})`;
    fail(String(message), res.status >= 400 && res.status < 600 ? res.status : 502);
  }
  return data;
}

export async function validateGateway() {
  return xelionFetch('/validate');
}

export async function gatewayStatus() {
  return xelionFetch('/status');
}

export async function createChatSession({ clientId, email, phone } = {}) {
  const id = trim(clientId) || `web-${Date.now().toString(36)}`;
  const payload = { clientId: id.slice(0, 80) };
  const mail = trim(email);
  const tel = trim(phone);
  if (mail) payload.emailAddress = mail.slice(0, 160);
  if (tel) payload.phoneNumber = tel.slice(0, 40);
  return xelionFetch('/sessions', { method: 'POST', body: payload });
}

export async function sendChatMessage(sessionId, text) {
  const sid = trim(sessionId);
  const message = trim(text);
  if (!sid) fail('Missing chat session.', 400);
  if (!message) fail('Please enter a message.', 400);
  return xelionFetch(`/sessions/${encodeURIComponent(sid)}/messages`, {
    method: 'POST',
    body: { text: message.slice(0, 4000) },
  });
}

export async function listChatMessages(sessionId) {
  const sid = trim(sessionId);
  if (!sid) fail('Missing chat session.', 400);
  return xelionFetch(`/sessions/${encodeURIComponent(sid)}/messages`);
}

export async function chatWebsocketUrl(sessionId) {
  const sid = trim(sessionId);
  if (!sid) fail('Missing chat session.', 400);
  const data = await xelionFetch(`/sessions/${encodeURIComponent(sid)}/websocket`);
  if (typeof data === 'string') return data;
  if (data && typeof data.object === 'string') return data.object;
  if (data && typeof data.value === 'string') return data.value;
  fail('Xelion did not return a websocket URL.', 502);
}

export async function endChatSession(sessionId) {
  const sid = trim(sessionId);
  if (!sid) fail('Missing chat session.', 400);
  await xelionFetch(`/sessions/${encodeURIComponent(sid)}/close`, { method: 'POST' });
  return { ok: true };
}

export async function setTyping(sessionId) {
  const sid = trim(sessionId);
  if (!sid) fail('Missing chat session.', 400);
  await xelionFetch(`/sessions/${encodeURIComponent(sid)}/is_typing`, { method: 'POST' });
  return { ok: true };
}

export async function sendFeedback(sessionId, { rating, feedback } = {}) {
  const sid = trim(sessionId);
  if (!sid) fail('Missing chat session.', 400);
  const stars = Number(rating);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) fail('Please choose a rating from 1 to 5.', 400);
  return xelionFetch(`/sessions/${encodeURIComponent(sid)}/feedback`, {
    method: 'POST',
    body: {
      rating: Math.round(stars),
      feedback: trim(feedback).slice(0, 2000),
    },
  });
}

function parseHm(value, fallback) {
  const raw = trim(value) || fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) {
    const fb = /^(\d{1,2}):(\d{2})$/.exec(fallback) || ['', '8', '0'];
    return { h: Number(fb[1]), min: Number(fb[2]), label: fallback };
  }
  const h = Math.min(23, Number(m[1]));
  const min = Math.min(59, Number(m[2]));
  return {
    h,
    min,
    label: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  };
}

function formatHoursLabel(hours) {
  const days = [...hours.days].sort((a, b) => a - b);
  const contiguous = days.length > 1 && days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayLabel = contiguous
    ? `${names[days[0] - 1]}–${names[days[days.length - 1] - 1]}`
    : days.map((d) => names[d - 1]).join(', ');
  return `${dayLabel}, ${hours.startLabel}–${hours.endLabel} (UK)`;
}

function contactMeta(hours = officeHoursConfig()) {
  return {
    officeHours: hours.hoursLabel,
    contactPhone: hours.contactPhone,
    contactEmail: hours.contactEmail,
  };
}

function parseOfficeDays(value) {
  const raw = trim(value) || '1-5';
  const days = new Set();
  for (const part of raw.split(',')) {
    const bit = trim(part);
    const range = /^(\d)-(\d)$/.exec(bit);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      for (let d = Math.min(a, b); d <= Math.max(a, b); d += 1) {
        if (d >= 1 && d <= 7) days.add(d);
      }
      continue;
    }
    const n = Number(bit);
    if (Number.isInteger(n) && n >= 1 && n <= 7) days.add(n);
  }
  return days.size ? days : new Set([1, 2, 3, 4, 5]);
}

/** ISO weekday 1=Mon … 7=Sun in the given IANA timezone. */
function zonedWeekdayAndMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const weekday = weekdayMap[map.weekday] || 1;
  const minutes = Number(map.hour) * 60 + Number(map.minute);
  return { weekday, minutes };
}

export function officeHoursConfig() {
  const tz = trim(process.env.XELION_OFFICE_TZ) || 'Europe/London';
  const start = parseHm(process.env.XELION_OFFICE_START, '08:00');
  const end = parseHm(process.env.XELION_OFFICE_END, '17:00');
  const dndText1 = trim(process.env.XELION_DND_TEXT_1) || 'Sorry, we are currently unavailable.';
  const dndText2 =
    trim(process.env.XELION_DND_TEXT_2) ||
    'Please come back during office hours or email info@capitalservices.com';
  const unavailableText =
    trim(process.env.XELION_UNAVAILABLE_TEXT) ||
    'Sorry, no one is available right now. Please email info@capitalservices.com or leave an enquiry.';
  const contactPhone = trim(process.env.XELION_CONTACT_PHONE) || '01923 270022';
  const contactEmail = trim(process.env.XELION_CONTACT_EMAIL) || 'info@capitalservices.com';
  const cfg = {
    tz,
    days: parseOfficeDays(process.env.XELION_OFFICE_DAYS),
    startMinutes: start.h * 60 + start.min,
    endMinutes: end.h * 60 + end.min,
    startLabel: start.label,
    endLabel: end.label,
    dndText1,
    dndText2,
    unavailableText,
    contactPhone,
    contactEmail,
  };
  cfg.hoursLabel = formatHoursLabel(cfg);
  return cfg;
}

export function isWithinOfficeHours(now = new Date(), hours = officeHoursConfig()) {
  const { weekday, minutes } = zonedWeekdayAndMinutes(now, hours.tz);
  if (!hours.days.has(weekday)) return false;
  if (hours.endMinutes <= hours.startMinutes) {
    return minutes >= hours.startMinutes || minutes < hours.endMinutes;
  }
  return minutes >= hours.startMinutes && minutes < hours.endMinutes;
}

function dndPresence(hours = officeHoursConfig()) {
  const message = `${hours.dndText1} ${hours.dndText2}`.trim();
  return {
    available: false,
    status: 'dnd',
    label: hours.dndText1,
    dndText1: hours.dndText1,
    dndText2: hours.dndText2,
    message,
    ...contactMeta(hours),
  };
}

function unavailablePresence(hours = officeHoursConfig(), label) {
  const text = trim(label) || hours.unavailableText;
  return {
    available: false,
    status: 'unavailable',
    label: text,
    message: text,
    ...contactMeta(hours),
  };
}

export async function startOfficeChat({ clientId, email, phone, bypassHours = false } = {}) {
  let presence = null;
  if (!bypassHours) {
    presence = await officePresence();
    if (!presence.available) {
      fail(
        presence.message || presence.label || 'Office chat is offline. Please leave an enquiry instead.',
        503,
      );
    }
  } else if (!xelionConfig().ready) {
    fail('Xelion is not configured yet. Host, tenant, gateway ID and token are required.', 503);
  }

  const session = await createChatSession({ clientId, email, phone });
  const sessionId = String(session?.id || '').trim();
  if (!sessionId) fail('Xelion did not create a chat session.', 502);

  let websocket = '';
  try {
    websocket = await chatWebsocketUrl(sessionId);
  } catch {
    websocket = '';
  }
  return {
    session,
    websocket,
    presence: presence || { available: true, status: 'notify' },
  };
}

/** Push a website enquiry onto the office Xelion line without failing the form. */
export async function notifyEnquiryOnXelion(enquiry = {}) {
  if (!xelionConfig().ready) return { sent: false, reason: 'not-configured' };
  try {
    const name = trim(enquiry.name) || 'Website enquiry';
    const phone = trim(enquiry.phone);
    const email = trim(enquiry.email);
    // Enquiry/callback dual-write must not be blocked by site-side DND hours.
    const started = await startOfficeChat({
      clientId: name.slice(0, 60),
      email,
      phone,
      bypassHours: true,
    });
    const sessionId = String(started.session?.id || '').trim();
    if (!sessionId) return { sent: false, reason: 'no-session' };
    const afterHours = /outside office hours|callback requested|office chat unavailable/i.test(
      String(enquiry.message || ''),
    );
    const lines = [
      afterHours ? 'After-hours callback request' : 'New website enquiry',
      `Source: ${enquiry.source === 'chat' ? 'Registered using chat' : 'Contact form'}`,
      `Name: ${name}`,
      `Phone: ${phone || '—'}`,
      `Email: ${email || '—'}`,
      `Postcode: ${trim(enquiry.company) || '—'}`,
      `Service: ${trim(enquiry.service) || '—'}`,
      '',
      String(enquiry.message || '').slice(0, 3500),
    ];
    await sendChatMessage(sessionId, lines.join('\n'));
    return { sent: true, sessionId };
  } catch (err) {
    console.error('xelion enquiry notify failed', err instanceof Error ? err.message : 'failed');
    return { sent: false, reason: 'provider' };
  }
}

export async function officePresence() {
  const hours = officeHoursConfig();
  if (!xelionConfig().ready) {
    return unavailablePresence(hours, 'Office chat offline');
  }
  if (!isWithinOfficeHours(new Date(), hours)) {
    return dndPresence(hours);
  }
  try {
    const [valid, status] = await Promise.all([validateGateway(), gatewayStatus()]);
    const ok = valid === true || valid?.value === true;
    const line = String(status?.value || status || '').toLowerCase();
    const online = ok && line === 'online';
    if (online) {
      return {
        available: true,
        status: 'online',
        label: 'Office chat available',
        message: 'Office chat available',
        ...contactMeta(hours),
      };
    }
    return unavailablePresence(hours);
  } catch {
    return unavailablePresence(hours);
  }
}
