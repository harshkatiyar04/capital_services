/**
 * Upload all website/assets to Cloudinary under capital-services/*
 * Run: node scripts/upload-cloudinary.mjs
 * Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env
 */
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASSETS = join(ROOT, 'assets');
const MANIFEST_PATH = join(ROOT, 'data', 'cloudinary-manifest.json');

const DEVELOPER_NAMES = new Set([
  'bellway.jpg', 'berkeley.jpg', 'bovis-homes.jpg', 'cale-homes.png',
  'crest-nicholson.png', 'lovell.jpg', 'rectory.jpg', 'spitfire-bespoke-homes.jpg',
  'taylor-wimpey.jpg',
]);

const ACCREDITATION_NAMES = new Set(['12.png', '13.png', '14.png', '15.png', '16.png']);

/** AI restored "after" images → readable Cloudinary public IDs */
const WORK_AFTER_MAP = {
  'Gemini_Generated_Image_dhidbqdhidbqdhid-clean.png': 'capital-services/work-after/escape-of-water',
  'Gemini_Generated_Image_kaqbvnkaqbvnkaqb-clean.png': 'capital-services/work-after/flood-damage',
  'Gemini_Generated_Image_7scia37scia37sci-clean.png': 'capital-services/work-after/fire-smoke-damage',
  'Gemini_Generated_Image_k4yq0ek4yq0ek4yq-clean.png': 'capital-services/work-after/subsidence-damage',
  'Gemini_Generated_Image_vup3yrvup3yrvup3 (1)-clean.png': 'capital-services/work-after/impact-damage',
  'Gemini_Generated_Image_17jca217jca217jc-clean.png': 'capital-services/work-after/storm-damage',
};

function slugPublicId(folderPath, fileName) {
  const base = basename(fileName, extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${folderPath}/${base || 'asset'}`;
}

function cloudFolder(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  const file = basename(norm);
  if (norm.startsWith('logos/')) return slugPublicId('capital-services/logos', file);
  if (norm.startsWith('images/team/')) return slugPublicId('capital-services/team', file);
  if (norm.startsWith('images/work/after/')) {
    return WORK_AFTER_MAP[file] || slugPublicId('capital-services/work-after', file);
  }
  if (norm.startsWith('images/work/')) return slugPublicId('capital-services/featured-work', file);
  if (norm === 'images/postcode-coverage-source.png') return 'capital-services/coverage/postcode-coverage-source';
  if (/^images\/hero-/.test(norm)) return slugPublicId('capital-services/heroes', file);
  if (norm.startsWith('images/partners/')) {
    if (ACCREDITATION_NAMES.has(file)) return slugPublicId('capital-services/accreditations', file);
    if (DEVELOPER_NAMES.has(file)) return slugPublicId('capital-services/developers', file);
    return slugPublicId('capital-services/partners', file);
  }
  if (norm.includes('trusted-partners')) return slugPublicId('capital-services/partners', file);
  if (norm.startsWith('images/')) return slugPublicId('capital-services/misc', file);
  return slugPublicId('capital-services/misc', file);
}

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).replace(/\\/g, '/'));
  }
  return out;
}

function resourceType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.svg') return 'image';
  return 'auto';
}

async function discoverCloudName(apiKey, apiSecret) {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    const raw = process.env.CLOUDINARY_CLOUD_NAME.trim();
    if (/\s/.test(raw)) {
      const slug = raw.toLowerCase().replace(/\s+/g, '-');
      console.warn(`Cloud name "${raw}" has spaces — trying slug "${slug}" (Cloudinary cloud names cannot contain spaces).`);
      return slug;
    }
    return raw;
  }

  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
    try {
      await cloudinary.api.ping();
      const parts = process.env.CLOUDINARY_URL.match(/@([^/?]+)/);
      if (parts) return parts[1];
    } catch {
      /* fall through */
    }
  }

  const candidates = [
    'capital-services',
    'capitalservices',
    'capital_services',
    'capital-services-draft',
    'capital-services-uk',
    'capital-services-ltd',
    'capitalservicesuk',
    'expert-property-care',
    'expertpropertycare',
    'capital-services-draft-vercel',
    'alphah-dev',
    'alphahdev',
    'd-capital-services',
    'dcapitalservices',
  ].filter(Boolean);

  const apiHosts = [
    'https://api.cloudinary.com',
    'https://api-eu.cloudinary.com',
    'https://api-ap.cloudinary.com',
  ];

  for (const host of apiHosts) {
    for (const name of candidates) {
      cloudinary.config({
        cloud_name: name,
        api_key: apiKey,
        api_secret: apiSecret,
        api_proxy: host,
      });
      try {
        await cloudinary.api.ping();
        console.log(`Discovered cloud name: ${name} (${host})`);
        return name;
      } catch (err) {
        if (err?.error?.http_code === 401) {
          console.warn(`Cloud name "${name}" rejected credentials (401) — check API key/secret.`);
        }
      }
    }
  }
  return null;
}

async function main() {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('Missing CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET in .env');
    process.exit(1);
  }

  const cloudName = await discoverCloudName(apiKey, apiSecret);
  if (!cloudName) {
    console.error('Could not discover CLOUDINARY_CLOUD_NAME. Add it to .env from Cloudinary Dashboard → Settings → API Keys.');
    process.exit(1);
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  try {
    const ping = await cloudinary.api.ping();
    console.log(`Connected to Cloudinary (${cloudName}):`, ping.status || 'ok');
  } catch (err) {
    console.error('Cloudinary auth failed before upload — check API key + secret match this cloud.');
    console.error(err.message || err.error?.message || err);
    process.exit(1);
  }

  const files = walk(ASSETS);
  const manifest = {
    cloudName,
    uploadedAt: new Date().toISOString(),
    assets: {},
  };

  console.log(`Uploading ${files.length} files…`);

  for (const rel of files) {
    const localPath = join(ASSETS, rel);
    const webPath = `assets/${rel}`;
    const folder = cloudFolder(rel);
    const publicId = folder;

    process.stdout.write(`  ${webPath} → ${publicId} … `);

    try {
      const result = await cloudinary.uploader.upload(localPath, {
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: resourceType(localPath),
      });
      manifest.assets[webPath] = {
        url: result.secure_url,
        publicId: result.public_id,
        folder: result.folder,
        bytes: result.bytes,
        format: result.format,
      };
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      const detail = err.error?.message || err.message || err;
      console.error(`    ${detail}`);
      if (String(detail).includes('403') || err.http_code === 403) {
        console.error('    → This API key can connect but cannot upload. In Cloudinary: Settings → API Keys → open "capital services" → allow Upload/Create, OR use the Root key secret in .env.');
      }
    }
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written: ${MANIFEST_PATH}`);
  console.log(`Uploaded ${Object.keys(manifest.assets).length} / ${files.length} files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
