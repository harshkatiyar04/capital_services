import { CHAT_SYSTEM_PROMPT } from './site-chat-context.mjs';
import { clientIp } from './enquiry-guard.mjs';
import { recordChatEnquiry, stripFalseSave } from './chat-enquiry.mjs';

function normalizeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-12)
    .map((m) => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: String(m?.content || '').trim().slice(0, 2000),
    }))
    .filter((m) => m.content);
}

export async function replyToChat({ body, apiKey, model, req }) {
  const messages = normalizeMessages(body?.messages);
  if (!messages.length) {
    const err = new Error('Please type a message');
    err.status = 400;
    throw err;
  }
  if (!apiKey) {
    const err = new Error('Chat is not configured yet');
    err.status = 500;
    throw err;
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-oss-120b',
      messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...messages],
      temperature: 0.4,
      max_tokens: 350,
    }),
  });
  if (!response.ok) {
    const err = new Error('Assistant is temporarily unavailable');
    err.status = 502;
    throw err;
  }
  const data = await response.json();
  let reply = (data.choices?.[0]?.message?.content || '').trim();
  if (!reply) {
    const err = new Error('Empty reply from assistant');
    err.status = 502;
    throw err;
  }

  const recorded = await recordChatEnquiry({
    sessionId: body?.chatSession,
    messages,
    turnstileToken: body?.turnstileToken,
    ip: clientIp(req),
  }).catch(() => ({ saved: false, needsCheck: false }));

  if (!recorded.saved) {
    reply = stripFalseSave(reply);
    if (!reply && recorded.needsCheck) {
      reply = 'Please complete the security check in this chat so the office can register it.';
    }
  }
  if (recorded.saved) {
    reply = `${reply}\n\nRegistered using chat. The office has this and will reply within 24 hours.`.trim();
  }

  return {
    reply,
    saved: Boolean(recorded.saved),
    needsCheck: Boolean(recorded.needsCheck),
  };
}
