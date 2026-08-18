import {
  adminOverview,
  buildLeaderboard,
  createWorker,
  getReviewJob,
  getSession,
  listPublicWorkers,
  logJob,
  login,
  logout,
  setPassword,
  setWorkerActive,
  signupWorker,
  submitSurvey,
  workerDashboard,
} from './ops-store.mjs';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
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

function routeKey(req) {
  const url = new URL(req.url, 'http://local');
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const opsIndex = parts.indexOf('ops');
  let action = opsIndex >= 0 ? parts.slice(opsIndex + 1).join('/') : '';
  if (!action) action = url.searchParams.get('path') || '';
  return { action, search: url.searchParams };
}

export async function handleOpsRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const { action, search } = routeKey(req);
    const token = bearer(req);

    if (req.method === 'GET' && (action === 'workers' || action === 'public/workers')) {
      return send(res, 200, { workers: await listPublicWorkers() });
    }
    if (req.method === 'GET' && action === 'me') {
      const user = await getSession(token);
      if (!user) return send(res, 401, { error: 'Sign in required' });
      return send(res, 200, { user });
    }
    if (req.method === 'GET' && action === 'dashboard') {
      return send(res, 200, await workerDashboard(token));
    }
    if (req.method === 'GET' && action === 'admin/overview') {
      return send(res, 200, await adminOverview(token));
    }
    if (req.method === 'GET' && action === 'job') {
      return send(res, 200, await getReviewJob({ token, jobId: search.get('id') }));
    }
    if (req.method === 'GET' && action === 'leaderboard') {
      await requireAdminLike(token);
      const role = search.get('role') || '';
      return send(res, 200, { board: await buildLeaderboard(role || undefined) });
    }

    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const body = await readJson(req);

    if (action === 'login') return send(res, 200, await login(body));
    if (action === 'signup') return send(res, 200, await signupWorker(body));
    if (action === 'logout') return send(res, 200, await logout());
    if (action === 'password') return send(res, 200, await setPassword({ token, password: body.password }));
    if (action === 'jobs') return send(res, 200, await logJob({ token, ...body }));
    if (action === 'survey') return send(res, 200, await submitSurvey(body, token));
    if (action === 'admin/workers') return send(res, 200, await createWorker({ token, ...body }));
    if (action === 'admin/workers/active') {
      return send(res, 200, await setWorkerActive({ token, workerId: body.workerId, active: body.active }));
    }

    return send(res, 404, { error: 'Unknown action' });
  } catch (err) {
    const status = err.status || 500;
    return send(res, status, { error: err.message || 'Server error' });
  }
}

async function requireAdminLike(token) {
  const user = await getSession(token);
  if (!user || user.kind !== 'admin') {
    const err = new Error('Admin access required');
    err.status = 401;
    throw err;
  }
}
