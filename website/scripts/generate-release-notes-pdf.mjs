/**
 * Generate PDF release notes from HTML (uses local Chrome via puppeteer-core).
 * Usage: node scripts/generate-release-notes-pdf.mjs [path-to.html]
 */
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DOC_DIR = join(ROOT, 'doc');
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const DEFAULT_HTML = join(ROOT, 'release notes', 'Capital-Services-Website-Release-Notes-August-2026.html');

async function htmlToPdf(htmlPath, pdfPath) {
  if (!existsSync(CHROME_PATH)) {
    throw new Error(`Chrome not found at ${CHROME_PATH}. Set CHROME_PATH in env.`);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const fileUrl = `file:///${resolve(htmlPath).replace(/\\/g, '/')}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.emulateMediaType('print');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const htmlPath = resolve(process.argv[2] || DEFAULT_HTML);
  if (!existsSync(htmlPath)) {
    console.error(`HTML not found: ${htmlPath}`);
    process.exit(1);
  }

  mkdirSync(DOC_DIR, { recursive: true });

  const base = basename(htmlPath, '.html');
  const docHtml = join(DOC_DIR, `${base}.html`);
  const pdfPath = join(DOC_DIR, `${base}.pdf`);

  copyFileSync(htmlPath, docHtml);
  console.log(`Copied HTML → ${docHtml}`);

  await htmlToPdf(docHtml, pdfPath);
  console.log(`Generated PDF → ${pdfPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
