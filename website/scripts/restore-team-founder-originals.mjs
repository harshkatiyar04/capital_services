/**
 * Restore original team_founder PNGs to Cloudinary (overwrite framed versions).
 */
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { readdirSync, writeFileSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'assets', 'team_founder');
const OUT = join(ROOT, 'data', 'team-founder-manifest.json');
const FOLDER = 'capital-services/team_founder';

cloudinary.config({
  cloud_name: (process.env.CLOUDINARY_CLOUD_NAME || 'foxrj3tm').trim(),
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const files = readdirSync(SRC).filter((f) => /\.png$/i.test(f) && !f.startsWith('_'));
const manifest = {
  cloudName: cloudinary.config().cloud_name,
  folder: FOLDER,
  uploadedAt: new Date().toISOString(),
  assets: {},
};

console.log(`Restoring ${files.length} originals…`);
for (const file of files) {
  const id = basename(file, extname(file)).toLowerCase();
  const publicId = `${FOLDER}/${id}`;
  process.stdout.write(`  ${file} … `);
  try {
    const result = await cloudinary.uploader.upload(join(SRC, file), {
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      timeout: 120000,
    });
    manifest.assets[id] = {
      file,
      publicId: result.public_id,
      version: result.version,
      delivery: `https://res.cloudinary.com/${manifest.cloudName}/image/upload/f_auto,q_auto/v${result.version}/${result.public_id}`,
    };
    console.log(`ok v${result.version}`);
  } catch (err) {
    console.log('FAIL', err.error?.message || err.message || err);
  }
}
writeFileSync(OUT, JSON.stringify(manifest, null, 2));
console.log('Wrote', OUT);
