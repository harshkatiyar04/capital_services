import { replyToChat } from '../lib/chat-reply.mjs';

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

  try {
    const body = await readJson(req);
    const result = await replyToChat({
      body,
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL,
      req,
    });
    sendJson(res, 200, result);
  } catch (err) {
    console.error('chat failed:', err);
    sendJson(res, err.status || 500, { error: err.message || 'Chat failed' });
  }
}
