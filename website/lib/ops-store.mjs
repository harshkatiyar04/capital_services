import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { passwordsMatch, signJwt, verifyJwt } from './ops-jwt.mjs';
import {
  hasDatabase,
  pgGetJob,
  pgGetWorker,
  pgGetWorkerByWorkId,
  pgInsertJob,
  pgInsertSurvey,
  pgInsertWorker,
  pgListJobs,
  pgListSurveys,
  pgListWorkers,
  pgNextWorkNumber,
  pgUpdateWorker,
} from './ops-pg.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROLES = {
  trade: { id: 'trade', label: 'On-site crew', short: 'Crew' },
  office: { id: 'office', label: 'Office staff', short: 'Office' },
  surveyor: { id: 'surveyor', label: 'Surveyor', short: 'Surveyor' },
};

export const TRADE_METRICS = [
  { key: 'punctuality', label: 'Punctuality', required: true },
  { key: 'politeness', label: 'Politeness', required: true },
  { key: 'tidiness', label: 'Tidiness', required: true },
  { key: 'quality', label: 'Quality of work', required: true },
  { key: 'presentation', label: 'Presentation', required: true },
  { key: 'professionalism', label: 'Professionalism', required: false },
];

export const OFFICE_METRICS = [
  { key: 'communication', label: 'Communication & timeline', required: true },
  { key: 'friendliness', label: 'Friendly & approachable', required: true },
];

export const SURVEYOR_METRICS = [
  { key: 'punctuality', label: 'Punctuality', required: true },
  { key: 'communication', label: 'Clarity on the project', required: true },
  { key: 'presentation', label: 'Well presented', required: true },
  { key: 'friendliness', label: 'Friendliness', required: true },
];

export const TIERS = [
  { id: 'foundation', label: 'Foundation', min: 0, max: 3.19, rank: 1 },
  { id: 'bronze', label: 'Bronze', min: 3.2, max: 3.69, rank: 2 },
  { id: 'silver', label: 'Silver', min: 3.7, max: 4.19, rank: 3 },
  { id: 'gold', label: 'Gold', min: 4.2, max: 4.59, rank: 4 },
  { id: 'capital', label: 'Capital', min: 4.6, max: 5, rank: 5 },
];

export const MIN_REVIEWS_FOR_TIER = 3;

function storePath() {
  return join(__dirname, '..', 'data', 'ops-store.json');
}

function assertStorage() {
  if (process.env.VERCEL && !hasDatabase()) {
    const err = new Error('DATABASE_URL is required on Vercel. File storage is local-only.');
    err.status = 503;
    throw err;
  }
}

function hashSecret(value, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(value), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifySecret(value, stored) {
  if (!stored || !value) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(String(value), salt, 32);
  const prev = Buffer.from(hash, 'hex');
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

function uid(prefix = 'id') {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

function nowIso() {
  return new Date().toISOString();
}

function emptyStore() {
  return {
    workers: [],
    surveys: [],
    jobs: [],
    counters: { trade: 1040, office: 2010, surveyor: 3300 },
  };
}

function seedWorkers(store) {
  const seeds = [
    { name: 'Ryan Cole', role: 'trade' },
    { name: 'Arron Thomas', role: 'trade' },
    { name: 'Jemma Walsh', role: 'office' },
    { name: 'Rebecca Lane', role: 'office' },
    { name: 'Sean Carter', role: 'surveyor' },
  ];
  const demoPass = 'Capital123';
  for (const s of seeds) {
    store.counters[s.role] += 1;
    const workId = workIdFrom(s.role, store.counters[s.role]);
    store.workers.push({
      id: uid('w'),
      workId,
      name: s.name,
      role: s.role,
      tempPinHash: null,
      passwordHash: hashSecret(demoPass),
      mustChangePassword: false,
      active: true,
      createdAt: nowIso(),
    });
  }
  seedSurveys(store);
  seedJobs(store);
}

function seedSurveys(store) {
  const byName = (name) => store.workers.find((w) => w.name === name);
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const card = (when, overall, improvement, sections) => ({
    id: uid('sv'),
    createdAt: daysAgo(when),
    customerName: '',
    jobRef: '',
    overallSatisfaction: overall,
    improvement,
    sections,
  });
  const section = (worker, scores) => ({
    role: worker.role,
    workerId: worker.id,
    workId: worker.workId,
    workerName: worker.name,
    scores,
    average: Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length,
  });
  const ryan = byName('Ryan Cole');
  const arron = byName('Arron Thomas');
  const jemma = byName('Jemma Walsh');
  const sean = byName('Sean Carter');
  store.surveys = [
    card(2, 5, '', [
      section(ryan, { punctuality: 5, politeness: 5, tidiness: 4, quality: 5, presentation: 5, professionalism: 5 }),
      section(jemma, { communication: 5, friendliness: 5 }),
    ]),
    card(5, 4, 'A quicker update on drying times would help.', [
      section(arron, { punctuality: 4, politeness: 5, tidiness: 5, quality: 4, presentation: 4 }),
      section(sean, { punctuality: 5, communication: 4, presentation: 5, friendliness: 4 }),
    ]),
    card(9, 5, '', [
      section(ryan, { punctuality: 5, politeness: 4, tidiness: 5, quality: 5, presentation: 4, professionalism: 5 }),
    ]),
    card(12, 5, '', [
      section(arron, { punctuality: 5, politeness: 5, tidiness: 5, quality: 5, presentation: 5, professionalism: 4 }),
      section(jemma, { communication: 4, friendliness: 5 }),
    ]),
    card(18, 4, '', [
      section(ryan, { punctuality: 4, politeness: 5, tidiness: 4, quality: 4, presentation: 4 }),
      section(sean, { punctuality: 4, communication: 5, presentation: 4, friendliness: 5 }),
    ]),
  ];
}

function seedJobs(store) {
  const ryan = store.workers.find((w) => w.name === 'Ryan Cole');
  const arron = store.workers.find((w) => w.name === 'Arron Thomas');
  if (!ryan || !arron) return;
  store.jobs = [
    {
      id: uid('job'),
      workerId: ryan.id,
      customerName: 'Bob Voss',
      jobNumber: 'CS-J-8841',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      surveyId: store.surveys[0]?.id || null,
    },
    {
      id: uid('job'),
      workerId: ryan.id,
      customerName: 'Helen Park',
      jobNumber: 'CS-J-8902',
      createdAt: nowIso(),
      surveyId: null,
    },
    {
      id: uid('job'),
      workerId: arron.id,
      customerName: 'Terry Richardson',
      jobNumber: 'CS-J-8760',
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      surveyId: null,
    },
  ];
}

function workIdFrom(role, n) {
  return `CS-${n}`;
}

let cache = null;
let cachePath = null;

function loadStore() {
  const path = storePath();
  if (cache && cachePath === path) return cache;
  if (!existsSync(path)) {
    const store = emptyStore();
    seedWorkers(store);
    saveStore(store);
    cache = store;
    cachePath = path;
    return store;
  }
  try {
    cache = JSON.parse(readFileSync(path, 'utf-8'));
    if (!Array.isArray(cache.jobs)) cache.jobs = [];
    cachePath = path;
    return cache;
  } catch {
    const store = emptyStore();
    seedWorkers(store);
    saveStore(store);
    cache = store;
    cachePath = path;
    return store;
  }
}

function saveStore(store) {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  const clone = structuredClone(store);
  writeFileSync(path, JSON.stringify(clone, null, 2));
  cache = clone;
  cachePath = path;
}

function issueToken(subject) {
  if (subject.kind === 'admin') {
    return signJwt({ kind: 'admin', name: 'Office', role: 'admin' });
  }
  return signJwt({
    kind: 'worker',
    workerId: subject.workerId,
    workId: subject.workId,
    name: subject.name,
    role: subject.role,
    mustChangePassword: !!subject.mustChangePassword,
  });
}

export async function getSession(token) {
  assertStorage();
  const payload = verifyJwt(token);
  if (!payload) return null;
  if (payload.kind === 'admin') {
    return { kind: 'admin', name: 'Office', role: 'admin' };
  }
  if (payload.kind !== 'worker' || !payload.workerId) return null;
  const worker = hasDatabase()
    ? await pgGetWorker(payload.workerId)
    : loadStore().workers.find((w) => w.id === payload.workerId);
  if (!worker || !worker.active) return null;
  return {
    kind: 'worker',
    workerId: worker.id,
    workId: worker.workId,
    name: worker.name,
    role: worker.role,
    mustChangePassword: !!worker.mustChangePassword,
  };
}

async function requireAdmin(token) {
  const session = await getSession(token);
  if (!session || session.kind !== 'admin') {
    const err = new Error('Admin access required');
    err.status = 401;
    throw err;
  }
  return session;
}

async function requireWorker(token) {
  const session = await getSession(token);
  if (!session || session.kind !== 'worker') {
    const err = new Error('Sign in required');
    err.status = 401;
    throw err;
  }
  return session;
}

async function allWorkers() {
  if (hasDatabase()) return pgListWorkers();
  return loadStore().workers;
}

async function allJobs() {
  if (hasDatabase()) return pgListJobs();
  return loadStore().jobs;
}

async function allSurveys() {
  if (hasDatabase()) return pgListSurveys();
  return loadStore().surveys;
}

function publicWorker(w) {
  return {
    id: w.id,
    workId: w.workId,
    name: w.name,
    role: w.role,
    active: w.active,
  };
}

function metricSetFor(role) {
  if (role === 'trade') return TRADE_METRICS;
  if (role === 'office') return OFFICE_METRICS;
  return SURVEYOR_METRICS;
}

function mean(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function tierFromAverage(avg, reviewCount) {
  if (reviewCount < MIN_REVIEWS_FOR_TIER) {
    return { id: 'provisional', label: 'Provisional', rank: 0 };
  }
  const clamped = Math.max(0, Math.min(5, avg));
  return [...TIERS].reverse().find((t) => clamped >= t.min) || TIERS[0];
}

function scoresFromSection(role, scores) {
  const metrics = metricSetFor(role);
  const out = {};
  const values = [];
  for (const m of metrics) {
    const raw = scores?.[m.key];
    if (raw == null || raw === '') {
      if (m.required) {
        const err = new Error(`Please rate ${m.label.toLowerCase()}`);
        err.status = 400;
        throw err;
      }
      continue;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      const err = new Error('Ratings must be whole stars from 1 to 5');
      err.status = 400;
      throw err;
    }
    out[m.key] = n;
    values.push(n);
  }
  return { scores: out, average: mean(values) };
}

export async function login({ identifier, password }) {
  assertStorage();
  const id = String(identifier || '').trim();
  const pass = String(password || '');
  if (!id || !pass) {
    const err = new Error('Enter your ID and password');
    err.status = 400;
    throw err;
  }

  const adminUser = (process.env.ADMIN_USER || 'admin').toLowerCase();
  if (id.toLowerCase() === adminUser) {
    const expected = process.env.ADMIN_PASSWORD || 'CapitalOffice!';
    if (!passwordsMatch(pass, expected)) {
      const err = new Error('Those details do not match');
      err.status = 401;
      throw err;
    }
    const user = { kind: 'admin', name: 'Office', role: 'admin', mustChangePassword: false };
    return { token: issueToken(user), user };
  }

  const worker = hasDatabase()
    ? await pgGetWorkerByWorkId(id)
    : loadStore().workers.find((w) => w.active && w.workId.toLowerCase() === id.toLowerCase());
  if (!worker || !worker.active) {
    const err = new Error('Those details do not match');
    err.status = 401;
    throw err;
  }

  const ok = worker.passwordHash
    ? verifySecret(pass, worker.passwordHash)
    : verifySecret(pass, worker.tempPinHash);
  if (!ok) {
    const err = new Error('Those details do not match');
    err.status = 401;
    throw err;
  }

  const user = {
    kind: 'worker',
    workerId: worker.id,
    workId: worker.workId,
    name: worker.name,
    role: worker.role,
    mustChangePassword: !!worker.mustChangePassword,
  };
  return { token: issueToken(user), user };
}

export async function setPassword({ token, password }) {
  const session = await requireWorker(token);
  const pass = String(password || '');
  if (pass.length < 8) {
    const err = new Error('Use at least 8 characters');
    err.status = 400;
    throw err;
  }
  if (hasDatabase()) {
    const worker = await pgGetWorker(session.workerId);
    worker.passwordHash = hashSecret(pass);
    worker.mustChangePassword = false;
    worker.tempPinHash = null;
    await pgUpdateWorker(worker);
    return { user: { ...session, mustChangePassword: false } };
  }
  const store = loadStore();
  const worker = store.workers.find((w) => w.id === session.workerId);
  worker.passwordHash = hashSecret(pass);
  worker.mustChangePassword = false;
  worker.tempPinHash = null;
  saveStore(store);
  return { user: { ...session, mustChangePassword: false } };
}

export async function logout() {
  return { ok: true };
}

export async function listPublicWorkers() {
  assertStorage();
  return (await allWorkers()).filter((w) => w.active).map(publicWorker);
}

export async function signupWorker({ name, role, password }) {
  assertStorage();
  const trimmed = String(name || '').trim();
  const pass = String(password || '');
  if (trimmed.length < 2) {
    const err = new Error('Enter your full name');
    err.status = 400;
    throw err;
  }
  if (!ROLES[role]) {
    const err = new Error('Choose your line of work');
    err.status = 400;
    throw err;
  }
  if (pass.length < 8) {
    const err = new Error('Use at least 8 characters for your password');
    err.status = 400;
    throw err;
  }
  let n;
  if (hasDatabase()) {
    n = await pgNextWorkNumber(role);
  } else {
    const store = loadStore();
    store.counters[role] += 1;
    n = store.counters[role];
    saveStore(store);
  }
  const workId = workIdFrom(role, n);
  const worker = {
    id: uid('w'),
    workId,
    name: trimmed,
    role,
    tempPinHash: null,
    passwordHash: hashSecret(pass),
    mustChangePassword: false,
    active: true,
    createdAt: nowIso(),
  };
  if (hasDatabase()) {
    await pgInsertWorker(worker);
  } else {
    const store = loadStore();
    store.counters[role] = n;
    store.workers.push(worker);
    saveStore(store);
  }
  const user = {
    kind: 'worker',
    workerId: worker.id,
    workId: worker.workId,
    name: worker.name,
    role: worker.role,
    mustChangePassword: false,
  };
  return { token: issueToken(user), user };
}

export async function logJob({ token, customerName, jobNumber }) {
  const session = await requireWorker(token);
  const customer = String(customerName || '').trim().slice(0, 80);
  const number = String(jobNumber || '').trim().slice(0, 40);
  if (customer.length < 2) {
    const err = new Error('Enter the customer name');
    err.status = 400;
    throw err;
  }
  if (number.length < 2) {
    const err = new Error('Enter the job number');
    err.status = 400;
    throw err;
  }
  const jobs = await allJobs();
  const exists = jobs.some(
    (j) => j.workerId === session.workerId && j.jobNumber.toLowerCase() === number.toLowerCase(),
  );
  if (exists) {
    const err = new Error('That job number is already logged');
    err.status = 400;
    throw err;
  }
  const job = {
    id: uid('job'),
    workerId: session.workerId,
    customerName: customer,
    jobNumber: number,
    createdAt: nowIso(),
    surveyId: null,
  };
  if (hasDatabase()) await pgInsertJob(job);
  else {
    const store = loadStore();
    store.jobs.unshift(job);
    saveStore(store);
  }
  return { job: publicJob(job, session) };
}

function publicJob(job, session) {
  return {
    id: job.id,
    customerName: job.customerName,
    jobNumber: job.jobNumber,
    createdAt: job.createdAt,
    reviewed: !!job.surveyId,
    workerName: session?.name,
    workId: session?.workId,
    role: session?.role,
  };
}

export async function getReviewJob({ token, jobId }) {
  const session = await requireWorker(token);
  const job = hasDatabase()
    ? await pgGetJob(jobId)
    : loadStore().jobs.find((j) => j.id === jobId);
  if (!job || job.workerId !== session.workerId) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  if (job.surveyId) {
    const err = new Error('This job already has a review');
    err.status = 400;
    throw err;
  }
  const workers = await allWorkers();
  return {
    job: publicJob(job, session),
    worker: {
      id: session.workerId,
      workId: session.workId,
      name: session.name,
      role: session.role,
    },
    colleagues: workers.filter((w) => w.active && w.id !== session.workerId).map(publicWorker),
  };
}

export async function submitSurvey(payload, token) {
  const session = await requireWorker(token);
  const job = hasDatabase()
    ? await pgGetJob(payload?.jobId)
    : loadStore().jobs.find((j) => j.id === payload?.jobId);
  if (!job || job.workerId !== session.workerId) {
    const err = new Error('Log the job first, then collect the review');
    err.status = 400;
    throw err;
  }
  if (job.surveyId) {
    const err = new Error('This job already has a review');
    err.status = 400;
    throw err;
  }

  const worker = hasDatabase()
    ? await pgGetWorker(session.workerId)
    : loadStore().workers.find((w) => w.id === session.workerId);
  const own = scoresFromSection(worker.role, payload?.scores);
  const sections = [
    {
      role: worker.role,
      workerId: worker.id,
      workId: worker.workId,
      workerName: worker.name,
      scores: own.scores,
      average: own.average,
    },
  ];

  for (const role of ['trade', 'office', 'surveyor']) {
    if (role === worker.role) continue;
    const block = payload?.[role];
    if (!block || !block.workerId) continue;
    const workers = await allWorkers();
    const other = workers.find((w) => w.id === block.workerId && w.active && w.role === role);
    if (!other) continue;
    const scored = scoresFromSection(role, block.scores);
    sections.push({
      role,
      workerId: other.id,
      workId: other.workId,
      workerName: other.name,
      scores: scored.scores,
      average: scored.average,
    });
  }

  const overall = Number(payload.overallSatisfaction);
  if (!Number.isInteger(overall) || overall < 1 || overall > 5) {
    const err = new Error('Please give an overall satisfaction rating');
    err.status = 400;
    throw err;
  }

  const survey = {
    id: uid('sv'),
    createdAt: nowIso(),
    customerName: job.customerName,
    jobRef: job.jobNumber,
    jobId: job.id,
    overallSatisfaction: overall,
    improvement: String(payload.improvement || '').trim().slice(0, 600),
    sections,
  };
  if (hasDatabase()) {
    await pgInsertSurvey(survey);
  } else {
    const store = loadStore();
    store.surveys.unshift(survey);
    const storedJob = store.jobs.find((j) => j.id === job.id);
    if (storedJob) storedJob.surveyId = survey.id;
    saveStore(store);
  }
  return { ok: true, id: survey.id };
}

export async function createWorker({ token, name, role }) {
  await requireAdmin(token);
  const trimmed = String(name || '').trim();
  if (trimmed.length < 2) {
    const err = new Error('Enter the full name');
    err.status = 400;
    throw err;
  }
  if (!ROLES[role]) {
    const err = new Error('Choose a role');
    err.status = 400;
    throw err;
  }
  let n;
  if (hasDatabase()) n = await pgNextWorkNumber(role);
  else {
    const store = loadStore();
    store.counters[role] += 1;
    n = store.counters[role];
    saveStore(store);
  }
  const workId = workIdFrom(role, n);
  const pin = String(100000 + (randomBytes(3).readUIntBE(0, 3) % 900000));
  const worker = {
    id: uid('w'),
    workId,
    name: trimmed,
    role,
    tempPinHash: hashSecret(pin),
    passwordHash: null,
    mustChangePassword: true,
    active: true,
    createdAt: nowIso(),
  };
  if (hasDatabase()) await pgInsertWorker(worker);
  else {
    const store = loadStore();
    store.workers.push(worker);
    saveStore(store);
  }
  return {
    worker: publicWorker(worker),
    pin,
    note: 'Share the Work ID and this one-time PIN. They set their own password on first sign-in.',
  };
}

export async function setWorkerActive({ token, workerId, active }) {
  await requireAdmin(token);
  if (hasDatabase()) {
    const worker = await pgGetWorker(workerId);
    if (!worker) {
      const err = new Error('Person not found');
      err.status = 404;
      throw err;
    }
    worker.active = !!active;
    await pgUpdateWorker(worker);
    return { worker: publicWorker(worker) };
  }
  const store = loadStore();
  const worker = store.workers.find((w) => w.id === workerId);
  if (!worker) {
    const err = new Error('Person not found');
    err.status = 404;
    throw err;
  }
  worker.active = !!active;
  saveStore(store);
  return { worker: publicWorker(worker) };
}

function ratingsForWorker(surveys, workerId) {
  const rows = [];
  for (const survey of surveys) {
    for (const section of survey.sections || []) {
      if (section.workerId === workerId) {
        rows.push({
          surveyId: survey.id,
          createdAt: survey.createdAt,
          scores: section.scores,
          average: section.average,
          overallSatisfaction: survey.overallSatisfaction,
        });
      }
    }
  }
  return rows;
}

export async function buildLeaderboard(role) {
  const workers = (await allWorkers()).filter((w) => w.active && (!role || w.role === role));
  const surveys = await allSurveys();
  const board = workers.map((w) => {
    const ratings = ratingsForWorker(surveys, w.id);
    const avg = ratings.length ? round1(mean(ratings.map((r) => r.average))) : 0;
    const breakdown = {};
    const metrics = metricSetFor(w.role);
    for (const m of metrics) {
      const vals = ratings.map((r) => r.scores[m.key]).filter((n) => typeof n === 'number');
      breakdown[m.key] = vals.length ? round1(mean(vals)) : null;
    }
    const tier = tierFromAverage(avg, ratings.length);
    return {
      ...publicWorker(w),
      reviews: ratings.length,
      average: ratings.length ? avg : null,
      tier,
      breakdown,
    };
  });
  board.sort((a, b) => {
    if ((b.average || 0) !== (a.average || 0)) return (b.average || 0) - (a.average || 0);
    return b.reviews - a.reviews;
  });
  return board.map((row, i) => ({ ...row, place: row.reviews ? i + 1 : null }));
}

export async function workerDashboard(token) {
  const session = await requireWorker(token);
  const board = await buildLeaderboard(session.role);
  const me = board.find((b) => b.id === session.workerId);
  const surveys = await allSurveys();
  const ratings = ratingsForWorker(surveys, session.workerId).slice(0, 8);
  const jobs = (await allJobs())
    .filter((j) => j.workerId === session.workerId)
    .map((j) => publicJob(j, session));
  return {
    user: session,
    stats: me,
    recent: ratings,
    board: board.slice(0, 12),
    jobs,
    tiers: TIERS,
  };
}

export async function adminOverview(token) {
  await requireAdmin(token);
  const surveys = await allSurveys();
  const workers = await allWorkers();
  const jobs = await allJobs();
  const overall = surveys.length ? round1(mean(surveys.map((s) => s.overallSatisfaction))) : null;
  return {
    counts: {
      workers: workers.filter((w) => w.active).length,
      surveys: surveys.length,
      jobs: jobs.length,
      thisWeek: surveys.filter((s) => Date.now() - new Date(s.createdAt).getTime() < 7 * 86400000).length,
    },
    overall,
    workers: workers.map(publicWorker),
    surveys: surveys.slice(0, 80).map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      customerName: s.customerName,
      jobRef: s.jobRef,
      overallSatisfaction: s.overallSatisfaction,
      improvement: s.improvement,
      sections: s.sections,
    })),
    leaderboard: {
      trade: await buildLeaderboard('trade'),
      office: await buildLeaderboard('office'),
      surveyor: await buildLeaderboard('surveyor'),
    },
    tiers: TIERS,
    minReviews: MIN_REVIEWS_FOR_TIER,
  };
}

