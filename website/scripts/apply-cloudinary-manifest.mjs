/**
 * Replace ALL asset URLs with Cloudinary delivery URLs from manifest.
 * - Local assets/ paths
 * - Legacy cloud (dhlmxyh9f) and any non-foxrj3tm Cloudinary URLs
 * Run after: node scripts/upload-cloudinary.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'data', 'cloudinary-manifest.json');

const HERO_WIDTHS = {
  'assets/images/hero-home.png': 1920,
  'assets/images/hero-about.png': 900,
  'assets/images/hero-clients.png': 1400,
  'assets/images/hero-contact.png': 1400,
  'assets/images/hero-services.png': 1400,
  'assets/images/hero-testimonials.png': 1400,
};

/** Peril after images — cap width for faster delivery */
const AFTER_WIDTHS = {
  'assets/images/work/after/Gemini_Generated_Image_dhidbqdhidbqdhid-clean.png': 1200,
  'assets/images/work/after/Gemini_Generated_Image_kaqbvnkaqbvnkaqb-clean.png': 1200,
  'assets/images/work/after/Gemini_Generated_Image_7scia37scia37sci-clean.png': 1200,
  'assets/images/work/after/Gemini_Generated_Image_k4yq0ek4yq0ek4yq-clean.png': 1200,
  'assets/images/work/after/Gemini_Generated_Image_vup3yrvup3yrvup3 (1)-clean.png': 1200,
  'assets/images/work/after/Gemini_Generated_Image_17jca217jca217jc-clean.png': 1200,
};

/** Old CDN public IDs → manifest local path */
const LEGACY_MAP = {
  'hero-home_rtckml': 'assets/images/hero-home.png',
  'hero-about_ynpawl': 'assets/images/hero-about.png',
};

function deliveryUrl(baseUrl, width) {
  if (!width) return baseUrl.replace('/upload/', '/upload/f_auto,q_auto/');
  return baseUrl.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}

function manifestDelivery(manifest, localPath) {
  const meta = manifest.assets[localPath];
  if (!meta?.url) return null;
  const width = HERO_WIDTHS[localPath] || AFTER_WIDTHS[localPath];
  return deliveryUrl(meta.url, width);
}

function walkFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'data') continue;
      out.push(...walkFiles(full, base));
    } else {
      const ext = extname(name).toLowerCase();
      if (['.html', '.js', '.css'].includes(ext)) {
        out.push(full);
      }
    }
  }
  return out;
}

function replaceLegacyCloudinary(content, manifest, cloudName) {
  let changed = false;
  let next = content;

  // Any URL on old or unknown Cloudinary accounts
  const foreignCloud = /https:\/\/res\.cloudinary\.com\/(?!foxrj3tm\/)[^"'`\s)]+/g;
  if (foreignCloud.test(next)) {
    next = next.replace(foreignCloud, (url) => {
      for (const [legacyId, localPath] of Object.entries(LEGACY_MAP)) {
        if (url.includes(legacyId)) {
          const replacement = manifestDelivery(manifest, localPath);
          if (replacement) {
            changed = true;
            return replacement;
          }
        }
      }
      // Unknown legacy URL — drop to foxrj3tm cloud root (shouldn't happen)
      changed = true;
      return url.replace(/res\.cloudinary\.com\/[^/]+/, `res.cloudinary.com/${cloudName}`);
    });
  }

  return { content: next, changed };
}

function applyToFile(filePath, manifest, cloudName) {
  let content = readFileSync(filePath, 'utf-8');
  let changed = false;

  const replacements = Object.entries(manifest.assets).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [localPath, meta] of replacements) {
    const delivery = manifestDelivery(manifest, localPath);
    if (content.includes(localPath)) {
      content = content.split(localPath).join(delivery);
      changed = true;
    }
  }

  const legacy = replaceLegacyCloudinary(content, manifest, cloudName);
  if (legacy.changed) {
    content = legacy.content;
    changed = true;
  }

  // Normalise any bare foxrj3tm URLs missing f_auto,q_auto
  const bareFox = new RegExp(
    `https://res\\.cloudinary\\.com/${cloudName}/image/upload/v\\d+/`,
    'g'
  );
  if (bareFox.test(content)) {
    content = content.replace(
      new RegExp(
        `(https://res\\.cloudinary\\.com/${cloudName}/image/upload/)(?!f_auto,q_auto)(v\\d+/)`,
        'g'
      ),
      '$1f_auto,q_auto,$2'
    );
    changed = true;
  }

  if (changed) {
    writeFileSync(filePath, content);
  }
  return changed;
}

function writeCloudinaryJs(manifest, cloudName) {
  const jsPath = join(ROOT, 'js', 'cloudinary-images.js');
  const lines = [
    '/** Auto-generated from data/cloudinary-manifest.json — do not edit by hand */',
    '',
    `export const CLOUDINARY_CLOUD = '${cloudName}';`,
    '',
    'export const CLOUDINARY_ASSETS = {',
  ];

  for (const [localPath, meta] of Object.entries(manifest.assets).sort()) {
    const key = localPath
      .replace(/^assets\//, '')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    lines.push(`  ${key}: '${manifestDelivery(manifest, localPath)}',`);
  }

  lines.push('};', '', '/** Append auto-format, quality, optional width */');
  lines.push('export function cloudinaryUrl(baseUrl, width) {');
  lines.push("  if (!width) return baseUrl.replace('/upload/', '/upload/f_auto,q_auto/');");
  lines.push("  return baseUrl.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);");
  lines.push('}', '');
  writeFileSync(jsPath, lines.join('\n'));
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const cloudName = manifest.cloudName;
  const files = [
    ...readdirSync(ROOT).filter((f) => f.endsWith('.html')).map((f) => join(ROOT, f)),
    ...walkFiles(join(ROOT, 'js')),
    ...walkFiles(join(ROOT, 'css')),
  ];

  let updated = 0;
  for (const file of files) {
    if (applyToFile(file, manifest, cloudName)) {
      console.log(`Updated ${file.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
      updated += 1;
    }
  }

  writeCloudinaryJs(manifest, cloudName);
  console.log(`\nDone — ${updated} files updated. All assets should use res.cloudinary.com/${cloudName}/`);
}

main();
