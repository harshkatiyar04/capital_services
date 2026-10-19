import { hasDatabase, pgGetEnquiry, pgInsertEnquiry, pgUpdateEnquiryDetails } from './ops-pg.mjs';
import { assertEnquiryContent, assertEnquiryRate, assertTurnstile } from './enquiry-guard.mjs';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+44\s?\d[\d\s()-]{8,}|\b0\d[\d\s()-]{8,})/;
const NOT_NAME = /^(yes|no|ok|okay|thanks|thank you|hi|hello|hey|please|help|sure)$/i;
const SERVICES = [
  ['leak', 'Leak detection'],
  ['fire', 'Fire and smoke'],
  ['smoke', 'Fire and smoke'],
  ['flood', 'Flood'],
  ['escape of water', 'Escape of water'],
  ['water', 'Escape of water'],
  ['storm', 'Storm'],
  ['subsidence', 'Subsidence'],
  ['validation', 'Validation'],
  ['cash settlement', 'Cash settlements'],
  ['drying', 'Emergency make-safe and drying'],
  ['make safe', 'Emergency make-safe and drying'],
  ['make-safe', 'Emergency make-safe and drying'],
];

function tidy(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function extractName(messages) {
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i].role !== 'user') continue;
    const text = messages[i].content.trim();
    const stated = text.match(/^(?:my name is|i am|i'm|this is)\s+([A-Za-z][A-Za-z' .-]{1,60})$/i);
    if (stated) return tidy(stated[1], 80);
    const prev = messages[i - 1];
    const asked = prev?.role === 'assistant' && /\bname\b/i.test(prev.content);
    const short = text.split(/\s+/).length <= 4 && /^[A-Za-z][A-Za-z' .-]{1,60}$/.test(text);
    if (asked && short && !NOT_NAME.test(text) && !EMAIL.test(text)) return tidy(text, 80);
  }
  return '';
}

export function extractChatEnquiry(messages) {
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const blob = users.join('\n');
  const emailMatch = blob.match(EMAIL);
  const name = extractName(messages);
  if (!emailMatch || !name) return null;
  const phoneMatch = blob.match(PHONE);
  const companyMatch = blob.match(/\bcompany(?: name)?(?: is|:)\s+([^\n.]{2,80})/i);
  const lower = blob.toLowerCase();
  const service = SERVICES.find(([word]) => lower.includes(word))?.[1] || '';
  return {
    name,
    email: emailMatch[0].toLowerCase(),
    phone: phoneMatch ? tidy(phoneMatch[0], 40) : '',
    company: companyMatch ? tidy(companyMatch[1], 120) : '',
    service,
  };
}

function transcript(messages) {
  return messages
    .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'Visitor'}: ${m.content.trim()}`)
    .join('\n\n');
}

function enquiryMessage(fields, messages) {
  return [
    'Registered using chat.',
    '',
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Phone: ${fields.phone || '—'}`,
    `Company: ${fields.company || '—'}`,
    `Service: ${fields.service || '—'}`,
    '',
    'Conversation:',
    transcript(messages),
  ].join('\n');
}

export function stripFalseSave(reply) {
  return String(reply || '')
    .replace(/\b(i['’]ve|i have)\s+(recorded|registered|submitted|saved|logged)\b[^.!?\n]*[.!?]?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function recordChatEnquiry({ sessionId, messages, turnstileToken, ip }) {
  const empty = { saved: false, needsCheck: false };
  if (!hasDatabase()) return empty;
  if (!/^cs_[a-z0-9]{24}$/.test(String(sessionId || ''))) return empty;
  const fields = extractChatEnquiry(messages);
  if (!fields) return empty;

  const existing = await pgGetEnquiry(sessionId);
  const message = enquiryMessage(fields, messages).slice(0, 4000);
  if (existing?.source === 'chat') {
    await pgUpdateEnquiryDetails({ ...fields, id: sessionId, message });
    return { saved: true, needsCheck: false, id: sessionId };
  }
  if (existing) return empty;

  if (!turnstileToken) return { saved: false, needsCheck: true };
  try {
    await assertTurnstile(turnstileToken, ip);
    assertEnquiryRate(ip);
    try {
      assertEnquiryContent({
        name: fields.name,
        email: fields.email,
        phone: fields.phone,
        message: 'Chat enquiry from the website assistant.',
      });
    } catch (err) {
      if (!fields.phone || !/phone/i.test(err.message || '')) throw err;
      fields.phone = '';
      assertEnquiryContent({
        name: fields.name,
        email: fields.email,
        phone: '',
        message: 'Chat enquiry from the website assistant.',
      });
    }
  } catch {
    return { saved: false, needsCheck: true };
  }

  await pgInsertEnquiry({
    id: sessionId,
    source: 'chat',
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    company: fields.company,
    service: fields.service,
    message,
    status: 'new',
    createdAt: new Date().toISOString(),
  });
  return { saved: true, needsCheck: false, id: sessionId };
}
