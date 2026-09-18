import { CHAT_SYSTEM_PROMPT } from '../lib/site-chat-context.mjs';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'POST only' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: 'Chat is not configured yet' });
    return;
  }

  try {
    const body = await readJson(req);
    const messages = normalizeMessages(body.messages);
    if (!messages.length) {
      sendJson(res, 400, { error: 'Please type a message' });
      return;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...messages],
        temperature: 0.4,
        max_tokens: 350,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Groq chat error:', response.status, detail);
      sendJson(res, 502, { error: 'Assistant is temporarily unavailable' });
      return;
    }

    const data = await response.json();
    const reply = (data.choices?.[0]?.message?.content || '').trim();
    if (!reply) {
      sendJson(res, 502, { error: 'Empty reply from assistant' });
      return;
    }

    sendJson(res, 200, { reply });
  } catch (err) {
    console.error('chat failed:', err);
    sendJson(res, err.status || 500, { error: err.message || 'Chat failed' });
  }
}
