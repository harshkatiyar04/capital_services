import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const websiteDir = path.resolve(__dirname, '../website');
const puppeteer = (await import(pathToFileURL(path.join(websiteDir, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).href)).default;
const htmlPath = path.join(__dirname, 'Capital-Services-Website-Release-Notes-July-2026.html');
const pdfPath = path.join(__dirname, 'Capital-Services-Website-Release-Notes-July-2026.pdf');

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function resolveBrowser() {
  for (const candidate of CHROME_PATHS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome or Edge not found. Set CHROME_PATH to your browser executable.');
}

const browser = await puppeteer.launch({
  executablePath: resolveBrowser(),
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  console.log(`PDF saved: ${pdfPath}`);
} finally {
  await browser.close();
}
