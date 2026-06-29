/**
 * Capital Services — PDF Generator v2
 * =====================================
 * Converts all crawled data into a gorgeous, readable PDF
 * by rendering a styled HTML page through Puppeteer.
 *
 * Usage: node generate-pdf-v2.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer-core';

const OUTPUT_DIR = path.resolve('output');
const JSON_PATH = path.join(OUTPUT_DIR, 'site_data.json');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');
const HTML_PATH = path.join(OUTPUT_DIR, 'Capital_Services_Complete_Content.html');
const PDF_PATH = path.join(OUTPUT_DIR, 'Capital_Services_Complete_Content.pdf');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugFromPath(urlPath) {
  if (urlPath === '/') return 'Home';
  return urlPath
    .replace(/^\/|\/$/g, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── HTML Builder ────────────────────────────────────────────────────────────

function buildHTML(siteData) {
  const crawlDate = new Date(siteData.crawledAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Capital Services — Complete Website Content</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  :root {
    --navy: #0F2439;
    --blue: #1B3A5C;
    --teal: #2E86AB;
    --orange: #E8592A;
    --dark: #1a1a2e;
    --body: #3d3d50;
    --muted: #7a7a8e;
    --light: #f4f6f9;
    --border: #e0e4ea;
    --white: #ffffff;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    line-height: 1.6;
    color: var(--body);
    background: var(--white);
  }

  /* ─── Cover Page ─── */
  .cover {
    page-break-after: always;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 60px;
    background: linear-gradient(135deg, var(--navy) 0%, #1a3f6f 40%, var(--teal) 100%);
    color: white;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(46,134,171,0.3) 0%, transparent 70%);
    border-radius: 50%;
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -30%;
    left: -10%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(232,89,42,0.2) 0%, transparent 70%);
    border-radius: 50%;
  }
  .cover-content { position: relative; z-index: 1; }
  .cover-badge {
    display: inline-block;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 20px;
    padding: 6px 16px;
    font-size: 10px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 30px;
    font-weight: 500;
  }
  .cover h1 {
    font-size: 42px;
    font-weight: 800;
    line-height: 1.15;
    margin-bottom: 12px;
    letter-spacing: -0.5px;
  }
  .cover h1 span { color: var(--orange); }
  .cover .subtitle {
    font-size: 18px;
    font-weight: 300;
    color: rgba(255,255,255,0.8);
    margin-bottom: 40px;
  }
  .cover-meta {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-top: 40px;
  }
  .cover-meta-item {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    padding: 16px;
  }
  .cover-meta-item .label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255,255,255,0.6);
    margin-bottom: 6px;
  }
  .cover-meta-item .value {
    font-size: 20px;
    font-weight: 700;
  }
  .cover-toc {
    margin-top: 50px;
    border-top: 1px solid rgba(255,255,255,0.2);
    padding-top: 30px;
  }
  .cover-toc h3 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.6);
    margin-bottom: 16px;
  }
  .toc-list {
    list-style: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 30px;
  }
  .toc-list li {
    font-size: 12px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .toc-num {
    background: var(--orange);
    color: white;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }

  /* ─── Page Sections ─── */
  .page-section {
    page-break-before: always;
    padding: 0;
  }
  .page-header {
    background: linear-gradient(135deg, var(--navy) 0%, var(--blue) 100%);
    color: white;
    padding: 30px 50px 25px;
    position: relative;
  }
  .page-header::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--orange), var(--teal));
  }
  .page-header .page-num {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: rgba(255,255,255,0.5);
    margin-bottom: 6px;
  }
  .page-header h2 {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .page-header .page-url {
    font-size: 10px;
    color: rgba(255,255,255,0.5);
    margin-top: 4px;
    font-family: monospace;
  }

  .page-body {
    padding: 30px 50px 40px;
  }

  /* ─── Section Blocks ─── */
  .block {
    margin-bottom: 28px;
  }
  .block-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--navy);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--orange);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .block-title .icon {
    width: 24px;
    height: 24px;
    background: var(--orange);
    color: white;
    border-radius: 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    flex-shrink: 0;
  }

  /* ─── Meta Box ─── */
  .meta-box {
    background: var(--light);
    border-left: 4px solid var(--teal);
    border-radius: 0 8px 8px 0;
    padding: 16px 20px;
    margin-bottom: 24px;
  }
  .meta-row {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 11px;
  }
  .meta-label {
    font-weight: 600;
    color: var(--navy);
    min-width: 120px;
  }
  .meta-value {
    color: var(--body);
  }

  /* ─── Content ─── */
  .content-section {
    background: #fafbfd;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 18px 20px;
    margin-bottom: 14px;
  }
  .content-section h3 {
    font-size: 15px;
    font-weight: 700;
    color: var(--navy);
    margin-bottom: 8px;
  }
  .content-section h4 {
    font-size: 13px;
    font-weight: 600;
    color: var(--blue);
    margin-bottom: 6px;
  }
  .content-section h5 {
    font-size: 12px;
    font-weight: 600;
    color: var(--teal);
    margin-bottom: 5px;
  }
  .content-section p {
    font-size: 11px;
    line-height: 1.7;
    color: var(--body);
    margin-bottom: 8px;
  }
  .content-section ul {
    margin: 6px 0 8px 18px;
    font-size: 11px;
  }
  .content-section li {
    margin-bottom: 3px;
    color: var(--body);
  }

  /* ─── CTA Buttons ─── */
  .cta-list { margin-top: 8px; }
  .cta-item {
    display: inline-block;
    background: linear-gradient(135deg, var(--orange), #d14420);
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 5px 14px;
    border-radius: 4px;
    margin: 3px 6px 3px 0;
  }
  .cta-item .cta-url {
    display: block;
    font-size: 8px;
    font-weight: 400;
    opacity: 0.8;
    margin-top: 2px;
  }

  /* ─── Navigation ─── */
  .nav-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    list-style: none;
  }
  .nav-item {
    background: var(--navy);
    color: white;
    font-size: 10px;
    font-weight: 500;
    padding: 6px 14px;
    border-radius: 20px;
  }
  .nav-item .nav-url {
    display: block;
    font-size: 8px;
    opacity: 0.6;
    margin-top: 2px;
  }

  /* ─── Tables ─── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-top: 8px;
  }
  thead th {
    background: var(--navy);
    color: white;
    font-weight: 600;
    text-align: left;
    padding: 8px 10px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  thead th:first-child { border-radius: 6px 0 0 0; }
  thead th:last-child { border-radius: 0 6px 0 0; }
  tbody td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
    font-size: 10px;
    word-break: break-all;
  }
  tbody tr:nth-child(even) { background: #f8f9fb; }
  tbody tr:hover { background: #eef2f7; }

  /* ─── Links List ─── */
  .link-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .link-item {
    background: var(--light);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 10px;
  }
  .link-text {
    font-weight: 600;
    color: var(--teal);
  }
  .link-href {
    color: var(--muted);
    font-size: 9px;
    word-break: break-all;
    margin-top: 2px;
  }

  /* ─── Forms ─── */
  .form-block {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 14px;
  }
  .form-header {
    background: var(--light);
    padding: 10px 16px;
    font-size: 10px;
    border-bottom: 1px solid var(--border);
  }
  .form-header strong { color: var(--navy); }

  /* ─── Footer Block ─── */
  .footer-block {
    background: var(--light);
    border-radius: 8px;
    padding: 16px 20px;
    font-size: 10px;
    color: var(--muted);
  }

  /* ─── Raw Text ─── */
  .raw-text {
    background: #1e1e2e;
    color: #cdd6f4;
    border-radius: 8px;
    padding: 18px 20px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 9.5px;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: none;
  }

  /* ─── Print / PDF ─── */
  @media print {
    .page-section { page-break-before: always; }
    .block { break-inside: avoid; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
`;

  // ─── Cover Page ───
  html += `
<div class="cover">
  <div class="cover-content">
    <div class="cover-badge">Website Content Extraction</div>
    <h1>Capital <span>Services</span></h1>
    <div class="subtitle">Complete website content extracted for redesign reference</div>

    <div class="cover-meta">
      <div class="cover-meta-item">
        <div class="label">Website</div>
        <div class="value" style="font-size:13px">${esc(siteData.site)}</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">Date Crawled</div>
        <div class="value" style="font-size:13px">${crawlDate}</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">Pages</div>
        <div class="value">${siteData.totalPages}</div>
      </div>
      <div class="cover-meta-item">
        <div class="label">Images</div>
        <div class="value">${siteData.totalImages}</div>
      </div>
    </div>

    <div class="cover-toc">
      <h3>Table of Contents</h3>
      <ul class="toc-list">
        ${siteData.pages.map((p, i) => {
          const name = slugFromPath(new URL(p.url).pathname);
          return `<li><span class="toc-num">${i + 1}</span> ${esc(name)}</li>`;
        }).join('\n')}
      </ul>
    </div>
  </div>
</div>
`;

  // ─── Each Page ───
  siteData.pages.forEach((page, pageIdx) => {
    const pageName = slugFromPath(new URL(page.url).pathname);

    html += `
<div class="page-section">
  <div class="page-header">
    <div class="page-num">Page ${pageIdx + 1} of ${siteData.totalPages}</div>
    <h2>${esc(pageName)}</h2>
    <div class="page-url">${esc(page.url)}</div>
  </div>
  <div class="page-body">
`;

    // ── Meta Information ──
    if (page.meta) {
      html += `
    <div class="block">
      <div class="block-title"><span class="icon">ℹ</span> Page Meta Information</div>
      <div class="meta-box">
        ${page.meta.title ? `<div class="meta-row"><span class="meta-label">Title:</span><span class="meta-value">${esc(page.meta.title)}</span></div>` : ''}
        ${page.meta.description ? `<div class="meta-row"><span class="meta-label">Description:</span><span class="meta-value">${esc(page.meta.description)}</span></div>` : ''}
        ${page.meta.ogTitle ? `<div class="meta-row"><span class="meta-label">OG Title:</span><span class="meta-value">${esc(page.meta.ogTitle)}</span></div>` : ''}
        ${page.meta.canonical ? `<div class="meta-row"><span class="meta-label">Canonical URL:</span><span class="meta-value">${esc(page.meta.canonical)}</span></div>` : ''}
      </div>
    </div>
`;
    }

    // ── Navigation ──
    if (page.navigation && page.navigation.length > 0) {
      html += `
    <div class="block">
      <div class="block-title"><span class="icon">☰</span> Navigation</div>
      <ul class="nav-list">
        ${page.navigation.map(n => `
          <li class="nav-item">${esc(n.text)}<span class="nav-url">${esc(n.href)}</span></li>
        `).join('')}
      </ul>
    </div>
`;
    }

    // ── Content Sections ──
    if (page.content?.sections?.length > 0) {
      // Filter to only sections that have real content
      const realSections = page.content.sections.filter(s =>
        (s.headings?.length > 0) || (s.paragraphs?.length > 0) || (s.lists?.length > 0)
      );

      if (realSections.length > 0) {
        html += `
    <div class="block">
      <div class="block-title"><span class="icon">📄</span> Page Content</div>
`;

        realSections.forEach((section, si) => {
          // Skip duplicate nav / footer sections (usually widget text)
          const allText = [
            ...(section.headings || []).map(h => h.text),
            ...(section.paragraphs || []),
          ].join(' ');

          // Skip if too short or looks like a duplicate nav
          if (allText.length < 5) return;

          html += `      <div class="content-section">\n`;

          // Headings
          (section.headings || []).forEach(h => {
            const tag = `h${Math.min(h.level + 1, 5)}`;
            html += `        <${tag}>${esc(h.text)}</${tag}>\n`;
          });

          // Paragraphs
          (section.paragraphs || []).forEach(p => {
            if (p.length > 3) {
              html += `        <p>${esc(p)}</p>\n`;
            }
          });

          // Lists
          (section.lists || []).forEach(list => {
            html += `        <ul>\n`;
            list.items.forEach(item => {
              html += `          <li>${esc(item)}</li>\n`;
            });
            html += `        </ul>\n`;
          });

          // Buttons/CTAs
          if (section.buttons?.length > 0) {
            html += `        <div class="cta-list">\n`;
            section.buttons.forEach(btn => {
              html += `          <span class="cta-item">${esc(btn.text)}<span class="cta-url">${esc(btn.href)}</span></span>\n`;
            });
            html += `        </div>\n`;
          }

          html += `      </div>\n`;
        });

        html += `    </div>\n`;
      }
    }

    // ── Images ──
    if (page.images?.length > 0) {
      html += `
    <div class="block">
      <div class="block-title"><span class="icon">🖼</span> Images (${page.images.length})</div>
      <table>
        <thead>
          <tr><th>#</th><th>Source URL</th><th>Alt Text</th><th>Dimensions</th></tr>
        </thead>
        <tbody>
          ${page.images.map((img, i) => {
            const dims = img.width && img.height ? `${img.width} × ${img.height}` : '—';
            return `<tr>
              <td>${i + 1}</td>
              <td>${esc(img.src)}</td>
              <td>${esc(img.alt || '—')}</td>
              <td>${dims}</td>
            </tr>`;
          }).join('\n')}
        </tbody>
      </table>
    </div>
`;
    }

    // ── Links ──
    if (page.links?.length > 0) {
      html += `
    <div class="block">
      <div class="block-title"><span class="icon">🔗</span> Links (${page.links.length})</div>
      <div class="link-grid">
        ${page.links.map(link => `
          <div class="link-item">
            <div class="link-text">${esc(link.text || 'No text')}</div>
            <div class="link-href">${esc(link.href)}</div>
          </div>
        `).join('')}
      </div>
    </div>
`;
    }

    // ── Forms ──
    if (page.forms?.length > 0) {
      html += `
    <div class="block">
      <div class="block-title"><span class="icon">📝</span> Forms (${page.forms.length})</div>
      ${page.forms.map((form, fi) => `
        <div class="form-block">
          <div class="form-header">
            <strong>Form ${fi + 1}</strong> &nbsp;|&nbsp;
            Action: <code>${esc(form.action || 'N/A')}</code> &nbsp;|&nbsp;
            Method: <code>${esc(form.method)}</code> &nbsp;|&nbsp;
            ID: <code>${esc(form.id || 'N/A')}</code>
          </div>
          <table>
            <thead>
              <tr><th>Label</th><th>Type</th><th>Name</th><th>Placeholder</th><th>Required</th></tr>
            </thead>
            <tbody>
              ${form.fields.map(f => `
                <tr>
                  <td>${esc(f.label || '—')}</td>
                  <td><code>${esc(f.type)}</code></td>
                  <td><code>${esc(f.name || '—')}</code></td>
                  <td>${esc(f.placeholder || '—')}</td>
                  <td>${f.required ? '✅ Yes' : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>
`;
    }

    // ── Footer ──
    if (page.content?.footer?.text) {
      html += `
    <div class="block">
      <div class="block-title"><span class="icon">⬇</span> Footer Content</div>
      <div class="footer-block">${esc(page.content.footer.text)}</div>
    </div>
`;
    }

    // ── Raw Text ──
    if (page.rawTextContent) {
      html += `
    <div class="block">
      <div class="block-title"><span class="icon">T</span> Full Text Content</div>
      <div class="raw-text">${esc(page.rawTextContent)}</div>
    </div>
`;
    }

    html += `
  </div>
</div>
`;
  });

  html += `
</body>
</html>`;

  return html;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Capital Services — PDF Generator v2                 ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('📄 Reading crawled data...');
  const rawData = await fs.readFile(JSON_PATH, 'utf-8');
  const siteData = JSON.parse(rawData);
  console.log(`   Found ${siteData.pages.length} pages\n`);

  console.log('🎨 Building styled HTML...');
  const html = buildHTML(siteData);

  // Save the HTML too (useful on its own)
  await fs.writeFile(HTML_PATH, html, 'utf-8');
  console.log(`   ✅ HTML saved: ${HTML_PATH}\n`);

  console.log('🖨️  Launching browser to render PDF...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const browserPage = await browser.newPage();

  // Load the HTML content
  await browserPage.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });

  console.log('📄 Generating PDF...');
  await browserPage.pdf({
    path: PDF_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    displayHeaderFooter: false,
    preferCSSPageSize: false,
  });

  await browser.close();

  console.log(`\n✅ PDF generated successfully!`);
  console.log(`📄 ${PDF_PATH}`);

  const stats = await fs.stat(PDF_PATH);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`   File size: ${sizeMB} MB`);
  console.log(`\n📝 HTML version also saved at: ${HTML_PATH}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
