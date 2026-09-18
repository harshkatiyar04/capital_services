/**
 * Apply / verify Neon schema (ops tables + site_enquiries).
 * Usage: node scripts/migrate-neon.mjs
 */
import 'dotenv/config';
import { ensureSchema, hasDatabase } from '../lib/ops-pg.mjs';

async function main() {
  if (!hasDatabase()) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const q = await ensureSchema();
  const tables = await q`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('ops_workers', 'ops_jobs', 'ops_surveys', 'ops_counters', 'site_enquiries')
    ORDER BY table_name
  `;
  console.log('Connected. Tables ready:');
  tables.forEach((t) => console.log(` - ${t.table_name}`));
  console.log('Migration OK');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
