/**
 * Upload assets/team_founder/* to Cloudinary under capital-services/team_founder/
 * Run: node scripts/upload-team-founder.mjs
 */
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { readdirSync, writeFileSync, existsSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'assets', 'team_founder');
const OUT = join(ROOT, 'data', 'team-founder-manifest.json');
const FOLDER = 'capital-services/team_founder';

async function main() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || 'foxrj3tm').trim();
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('Missing CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET in .env');
    process.exit(1);
  }

  if (!existsSync(SRC)) {
    console.error(`Folder not found: ${SRC}`);
    process.exit(1);
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

  const ping = await cloudinary.api.ping();
  console.log(`Connected (${cloudName}):`, ping.status || 'ok');

  const files = readdirSync(SRC).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const manifest = { cloudName, folder: FOLDER, uploadedAt: new Date().toISOString(), assets: {} };

  console.log(`Uploading ${files.length} files → ${FOLDER}/`);

  for (const file of files) {
    const localPath = join(SRC, file);
    const id = basename(file, extname(file))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const publicId = `${FOLDER}/${id}`;

    process.stdout.write(`  ${file} → ${publicId} … `);
    try {
      const result = await cloudinary.uploader.upload(localPath, {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
      });
      const delivery = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${result.public_id}`;
      manifest.assets[id] = {
        file,
        publicId: result.public_id,
        version: result.version,
        url: result.secure_url,
        delivery,
      };
      console.log(`ok v${result.version}`);
    } catch (err) {
      console.log('FAILED');
      console.error(`    ${err.error?.message || err.message || err}`);
    }
  }

  writeFileSync(OUT, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${OUT}`);
  console.log(`Uploaded ${Object.keys(manifest.assets).length} / ${files.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
