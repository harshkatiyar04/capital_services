import { neon } from '@neondatabase/serverless';

let sql;
let ready = false;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function db() {
  if (!process.env.DATABASE_URL) {
    const err = new Error('DATABASE_URL is not set');
    err.status = 500;
    throw err;
  }
  if (!sql) sql = neon(process.env.DATABASE_URL);
  return sql;
}

export async function ensureSchema() {
  if (ready) return db();
  const q = db();
  await q`CREATE TABLE IF NOT EXISTS ops_counters (
    role TEXT PRIMARY KEY,
    n INTEGER NOT NULL
  )`;
  await q`CREATE TABLE IF NOT EXISTS ops_workers (
    id TEXT PRIMARY KEY,
    work_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT,
    temp_pin_hash TEXT,
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS ops_jobs (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    job_number TEXT NOT NULL,
    survey_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS ops_surveys (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    customer_name TEXT,
    job_ref TEXT,
    overall_satisfaction INTEGER NOT NULL,
    improvement TEXT,
    sections JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`INSERT INTO ops_counters (role, n) VALUES
    ('trade', 1040), ('office', 2010), ('surveyor', 3300)
    ON CONFLICT (role) DO NOTHING`;
  await q`CREATE TABLE IF NOT EXISTS site_enquiries (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    service TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS site_enquiries_created_idx ON site_enquiries (created_at DESC)`;
  await q`CREATE INDEX IF NOT EXISTS site_enquiries_status_idx ON site_enquiries (status)`;
  ready = true;
  return q;
}

function mapWorker(r) {
  if (!r) return null;
  return {
    id: r.id,
    workId: r.work_id,
    name: r.name,
    role: r.role,
    passwordHash: r.password_hash,
    tempPinHash: r.temp_pin_hash,
    mustChangePassword: r.must_change_password,
    active: r.active,
    createdAt: r.created_at,
  };
}

function mapJob(r) {
  if (!r) return null;
  return {
    id: r.id,
    workerId: r.worker_id,
    customerName: r.customer_name,
    jobNumber: r.job_number,
    surveyId: r.survey_id,
    createdAt: r.created_at,
  };
}

function mapSurvey(r) {
  if (!r) return null;
  return {
    id: r.id,
    jobId: r.job_id,
    customerName: r.customer_name,
    jobRef: r.job_ref,
    overallSatisfaction: r.overall_satisfaction,
    improvement: r.improvement || '',
    sections: r.sections,
    createdAt: r.created_at,
  };
}

export async function pgListWorkers() {
  const q = await ensureSchema();
  const rows = await q`SELECT * FROM ops_workers ORDER BY created_at DESC`;
  return rows.map(mapWorker);
}

export async function pgGetWorker(id) {
  const q = await ensureSchema();
  const rows = await q`SELECT * FROM ops_workers WHERE id = ${id} LIMIT 1`;
  return mapWorker(rows[0]);
}

export async function pgGetWorkerByWorkId(workId) {
  const q = await ensureSchema();
  const rows = await q`SELECT * FROM ops_workers WHERE lower(work_id) = ${workId.toLowerCase()} LIMIT 1`;
  return mapWorker(rows[0]);
}

export async function pgInsertWorker(worker) {
  const q = await ensureSchema();
  await q`INSERT INTO ops_workers (
    id, work_id, name, role, password_hash, temp_pin_hash, must_change_password, active, created_at
  ) VALUES (
    ${worker.id}, ${worker.workId}, ${worker.name}, ${worker.role},
    ${worker.passwordHash}, ${worker.tempPinHash}, ${worker.mustChangePassword},
    ${worker.active}, ${worker.createdAt}
  )`;
}

export async function pgUpdateWorker(worker) {
  const q = await ensureSchema();
  await q`UPDATE ops_workers SET
    password_hash = ${worker.passwordHash},
    temp_pin_hash = ${worker.tempPinHash},
    must_change_password = ${worker.mustChangePassword},
    active = ${worker.active}
    WHERE id = ${worker.id}`;
}

export async function pgNextWorkNumber(role) {
  const q = await ensureSchema();
  const rows = await q`UPDATE ops_counters SET n = n + 1 WHERE role = ${role} RETURNING n`;
  return rows[0].n;
}

export async function pgListJobs() {
  const q = await ensureSchema();
  const rows = await q`SELECT * FROM ops_jobs ORDER BY created_at DESC`;
  return rows.map(mapJob);
}

export async function pgGetJob(id) {
  const q = await ensureSchema();
  const rows = await q`SELECT * FROM ops_jobs WHERE id = ${id} LIMIT 1`;
  return mapJob(rows[0]);
}

export async function pgInsertJob(job) {
  const q = await ensureSchema();
  await q`INSERT INTO ops_jobs (id, worker_id, customer_name, job_number, survey_id, created_at)
    VALUES (${job.id}, ${job.workerId}, ${job.customerName}, ${job.jobNumber}, ${job.surveyId}, ${job.createdAt})`;
}

export async function pgListSurveys() {
  const q = await ensureSchema();
  const rows = await q`SELECT * FROM ops_surveys ORDER BY created_at DESC`;
  return rows.map(mapSurvey);
}

export async function pgInsertSurvey(survey) {
  const q = await ensureSchema();
  const sectionsJson = JSON.stringify(survey.sections ?? []);
  await q`INSERT INTO ops_surveys (
    id, job_id, customer_name, job_ref, overall_satisfaction, improvement, sections, created_at
  ) VALUES (
    ${survey.id}, ${survey.jobId}, ${survey.customerName}, ${survey.jobRef},
    ${survey.overallSatisfaction}, ${survey.improvement}, ${sectionsJson}::jsonb,
    ${survey.createdAt}
  )`;
  await q`UPDATE ops_jobs SET survey_id = ${survey.id} WHERE id = ${survey.jobId}`;
}

function mapEnquiry(r) {
  if (!r) return null;
  return {
    id: r.id,
    source: r.source,
    name: r.name,
    email: r.email,
    phone: r.phone || '',
    company: r.company || '',
    service: r.service || '',
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function pgInsertEnquiry(enquiry) {
  const q = await ensureSchema();
  await q`INSERT INTO site_enquiries (
    id, source, name, email, phone, company, service, message, status, created_at
  ) VALUES (
    ${enquiry.id}, ${enquiry.source}, ${enquiry.name}, ${enquiry.email},
    ${enquiry.phone || null}, ${enquiry.company || null}, ${enquiry.service || null},
    ${enquiry.message}, ${enquiry.status || 'new'}, ${enquiry.createdAt}
  )`;
  return enquiry;
}

export async function pgListEnquiries(limit = 100) {
  const q = await ensureSchema();
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const rows = await q`SELECT * FROM site_enquiries ORDER BY created_at DESC LIMIT ${cap}`;
  return rows.map(mapEnquiry);
}

export async function pgUpdateEnquiryStatus(id, status) {
  const q = await ensureSchema();
  const rows = await q`UPDATE site_enquiries SET status = ${status} WHERE id = ${id} RETURNING *`;
  return mapEnquiry(rows[0]);
}
