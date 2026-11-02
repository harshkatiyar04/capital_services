import {
  endChatSession,
  gatewayStatus,
  listChatMessages,
  officePresence,
  sendChatMessage,
  sendFeedback,
  setTyping,
  startOfficeChat,
  validateGateway,
  xelionStatus,
} from './xelion.mjs';

function send(res, status, payload) {
  res.statusCode = status;
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

function actionFrom(req, body = {}) {
  if (body.action) return String(body.action).trim().toLowerCase();
  const url = new URL(req.url || '/', 'http://local');
  return String(url.searchParams.get('action') || 'status').trim().toLowerCase();
}

export async function handleXelionRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    // Soft gate while integration is on hold (XELION_ENABLED=false).
    if (!xelionStatus().enabled && actionFrom(req) !== 'status') {
      return send(res, 503, { error: 'Xelion office chat is on hold.', onHold: true });
    }

    if (req.method === 'GET') {
      const action = actionFrom(req);
      if (action === 'status') return send(res, 200, xelionStatus());
      if (action === 'presence') return send(res, 200, await officePresence());
      if (action === 'validate') return send(res, 200, { ok: true, result: await validateGateway() });
      if (action === 'gateway') return send(res, 200, { ok: true, result: await gatewayStatus() });
      return send(res, 400, { error: 'Unknown action' });
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'Use GET or POST' });

    const body = await readJson(req);
    const action = actionFrom(req, body);

    if (action === 'start') {
      const started = await startOfficeChat({
        clientId: body.clientId,
        email: body.email || body.emailAddress,
        phone: body.phone || body.phoneNumber,
      });
      return send(res, 200, { ok: true, ...started });
    }

    if (action === 'message') {
      const message = await sendChatMessage(body.sessionId, body.text || body.message);
      return send(res, 200, { ok: true, message });
    }

    if (action === 'messages') {
      const messages = await listChatMessages(body.sessionId);
      return send(res, 200, { ok: true, messages });
    }

    if (action === 'end') {
      await endChatSession(body.sessionId);
      return send(res, 200, { ok: true });
    }

    if (action === 'typing') {
      await setTyping(body.sessionId);
      return send(res, 200, { ok: true });
    }

    if (action === 'feedback') {
      await sendFeedback(body.sessionId, {
        rating: body.rating,
        feedback: body.feedback || body.message,
      });
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: 'Unknown action' });
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || 'Xelion request failed' });
  }
}
