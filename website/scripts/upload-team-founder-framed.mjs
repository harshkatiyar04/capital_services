/**
 * Re-upload framed team_founder headshots (padded for circle frames).
 * Run: node scripts/upload-team-founder-framed.mjs
 */
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { readdirSync, writeFileSync, existsSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'assets', 'team_founder', 'framed');
const OUT = join(ROOT, 'data', 'team-founder-manifest.json');
const FOLDER = 'capital-services/team_founder';

async function main() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || 'foxrj3tm').trim();
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) {
    console.error('Missing Cloudinary credentials in .env');
    process.exit(1);
  }
  if (!existsSync(SRC)) {
    console.error(`Missing ${SRC}`);
    process.exit(1);
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  await cloudinary.api.ping();

  const files = readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const manifest = { cloudName, folder: FOLDER, uploadedAt: new Date().toISOString(), assets: {} };

  console.log(`Uploading ${files.length} framed photos → ${FOLDER}/`);
  for (const file of files) {
    const id = basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const publicId = `${FOLDER}/${id}`;
    process.stdout.write(`  ${file} → ${publicId} … `);
    try {
      const result = await cloudinary.uploader.upload(join(SRC, file), {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
      });
      manifest.assets[id] = {
        file,
        publicId: result.public_id,
        version: result.version,
        delivery: `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/v${result.version}/${result.public_id}`,
      };
      console.log(`ok v${result.version}`);
    } catch (err) {
      console.log('FAILED');
      console.error(`    ${err.error?.message || err.message || err}`);
    }
  }
  writeFileSync(OUT, JSON.stringify(manifest, null, 2));
  console.log(`Manifest: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
