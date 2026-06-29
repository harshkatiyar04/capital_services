/**
 * Capital Services — PDF Generator
 * ==================================
 * Reads all crawled page data from site_data.json and generates
 * a single comprehensive PDF with all content from every page.
 *
 * Usage: node generate-pdf.mjs
 */

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const OUTPUT_DIR = path.resolve('output');
const JSON_PATH = path.join(OUTPUT_DIR, 'site_data.json');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');
const PDF_PATH = path.join(OUTPUT_DIR, 'Capital_Services_Complete_Content.pdf');

// ─── Color Palette ───────────────────────────────────────────────────────────
const COLORS = {
  primary: '#1B3A5C',      // Dark navy blue
  secondary: '#2E86AB',    // Teal-blue
  accent: '#E8592A',       // Orange accent
  headingDark: '#0F2439',  // Very dark blue
  bodyText: '#333333',
  lightGray: '#888888',
  bgLight: '#F0F4F8',
  white: '#FFFFFF',
  divider: '#D0D8E0',
  link: '#2E86AB',
  tableHeader: '#1B3A5C',
  tableAlt: '#F5F8FA',
  sectionBg: '#EBF0F5',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugFromPath(urlPath) {
  if (urlPath === '/') return 'Home';
  return urlPath
    .replace(/^\/|\/$/g, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function truncate(str, maxLen = 200) {
  if (!str || str.length <= maxLen) return str || '';
  return str.substring(0, maxLen) + '…';
}

function getLocalImagePath(imageUrl) {
  try {
    const urlObj = new URL(imageUrl);
    const ext = path.extname(urlObj.pathname) || '.jpg';
    const basename = path.basename(urlObj.pathname, ext);
    const sanitized = basename
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
    return path.join(IMAGES_DIR, sanitized + ext);
  } catch {
    return null;
  }
}

async function imageExists(imgPath) {
  if (!imgPath) return false;
  try {
    await fs.access(imgPath);
    return true;
  } catch {
    return false;
  }
}

// ─── PDF Generation ──────────────────────────────────────────────────────────

async function generatePDF() {
  console.log('📄 Reading crawled data...');
  const rawData = await fs.readFile(JSON_PATH, 'utf-8');
  const siteData = JSON.parse(rawData);

  console.log(`   Found ${siteData.pages.length} pages`);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: 55, right: 55 },
    bufferPages: true,
    info: {
      Title: 'Capital Services - Complete Website Content',
      Author: 'Website Crawler',
      Subject: 'Content extraction for website redesign',
      Creator: 'Capital Services Crawler',
    },
  });

  const stream = createWriteStream(PDF_PATH);
  doc.pipe(stream);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ─────────────────────────────────────────────────────────────────────────
  // COVER PAGE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('   📝 Creating cover page...');

  // Background gradient block
  const gradientHeight = 340;
  doc.rect(0, 0, doc.page.width, gradientHeight)
    .fill(COLORS.primary);

  // Accent bar
  doc.rect(0, gradientHeight, doc.page.width, 6)
    .fill(COLORS.accent);

  // Try to add logo
  const logoPath = path.join(IMAGES_DIR, 'capital-services-logo.png');
  if (await imageExists(logoPath)) {
    try {
      doc.image(logoPath, doc.page.margins.left + 10, 70, { width: 200 });
    } catch {}
  }

  // Title
  doc.font('Helvetica-Bold')
    .fontSize(36)
    .fillColor(COLORS.white)
    .text('Capital Services', doc.page.margins.left, 160, {
      width: pageWidth,
      align: 'left',
    });

  doc.font('Helvetica')
    .fontSize(16)
    .fillColor('#B0C8E0')
    .text('Complete Website Content Extraction', doc.page.margins.left, 210, {
      width: pageWidth,
      align: 'left',
    });

  doc.fontSize(12)
    .fillColor('#8AACCC')
    .text('For Website Redesign Reference', doc.page.margins.left, 235, {
      width: pageWidth,
      align: 'left',
    });

  // Info box below gradient
  const infoY = gradientHeight + 30;

  doc.font('Helvetica')
    .fontSize(11)
    .fillColor(COLORS.lightGray)
    .text(`Website: ${siteData.site}`, doc.page.margins.left, infoY)
    .text(`Crawled: ${new Date(siteData.crawledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, doc.page.margins.left, infoY + 20)
    .text(`Total Pages: ${siteData.totalPages}`, doc.page.margins.left, infoY + 40)
    .text(`Total Images: ${siteData.totalImages}`, doc.page.margins.left, infoY + 60);

  // Pages index
  const indexY = infoY + 100;
  doc.font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(COLORS.primary)
    .text('Pages Included', doc.page.margins.left, indexY);

  doc.moveTo(doc.page.margins.left, indexY + 20)
    .lineTo(doc.page.margins.left + 150, indexY + 20)
    .strokeColor(COLORS.accent)
    .lineWidth(2)
    .stroke();

  doc.font('Helvetica')
    .fontSize(11)
    .fillColor(COLORS.bodyText);

  siteData.pages.forEach((page, i) => {
    const pageName = slugFromPath(new URL(page.url).pathname);
    const y = indexY + 30 + (i * 22);
    doc.font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.secondary)
      .text(`${i + 1}.`, doc.page.margins.left, y, { width: 20, continued: true })
      .font('Helvetica')
      .fillColor(COLORS.bodyText)
      .text(`  ${pageName}`, { continued: true })
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.lightGray)
      .text(`  — ${page.url}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EACH PAGE
  // ─────────────────────────────────────────────────────────────────────────

  for (let pageIdx = 0; pageIdx < siteData.pages.length; pageIdx++) {
    const page = siteData.pages[pageIdx];
    const pageName = slugFromPath(new URL(page.url).pathname);

    console.log(`   📄 Processing: ${pageName} (${page.url})`);

    doc.addPage();

    // ── Page Title Header ──
    // Blue header bar
    doc.rect(0, 0, doc.page.width, 80)
      .fill(COLORS.primary);

    doc.rect(0, 80, doc.page.width, 4)
      .fill(COLORS.accent);

    doc.font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(COLORS.white)
      .text(pageName, doc.page.margins.left, 25, { width: pageWidth });

    doc.font('Helvetica')
      .fontSize(9)
      .fillColor('#8AACCC')
      .text(page.url, doc.page.margins.left, 55, { width: pageWidth });

    let cursorY = 100;

    // ── Meta Information ──
    if (page.meta) {
      cursorY += 5;

      // Title
      if (page.meta.title) {
        checkPageBreak(doc, cursorY, 50);
        cursorY = doc.y || cursorY;

        doc.font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COLORS.lightGray)
          .text('PAGE TITLE', doc.page.margins.left, cursorY);
        cursorY += 14;

        doc.font('Helvetica')
          .fontSize(11)
          .fillColor(COLORS.headingDark)
          .text(page.meta.title, doc.page.margins.left, cursorY, { width: pageWidth });
        cursorY = doc.y + 8;
      }

      // Meta Description
      if (page.meta.description) {
        checkPageBreak(doc, cursorY, 50);
        cursorY = doc.y || cursorY;

        doc.font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COLORS.lightGray)
          .text('META DESCRIPTION', doc.page.margins.left, cursorY);
        cursorY += 14;

        doc.font('Helvetica')
          .fontSize(10)
          .fillColor(COLORS.bodyText)
          .text(page.meta.description, doc.page.margins.left, cursorY, { width: pageWidth });
        cursorY = doc.y + 12;
      }

      // Divider
      drawDivider(doc, cursorY, pageWidth);
      cursorY += 15;
    }

    // ── Navigation ──
    if (page.navigation && page.navigation.length > 0) {
      checkPageBreak(doc, cursorY, 60);
      cursorY = doc.y || cursorY;

      cursorY = drawSectionHeader(doc, 'Navigation', cursorY, pageWidth);

      page.navigation.forEach(nav => {
        checkPageBreak(doc, cursorY, 18);
        cursorY = doc.y || cursorY;

        doc.font('Helvetica')
          .fontSize(10)
          .fillColor(COLORS.link)
          .text(`• ${nav.text}`, doc.page.margins.left + 10, cursorY, {
            width: pageWidth - 20,
            continued: true,
          })
          .fillColor(COLORS.lightGray)
          .fontSize(8)
          .text(`  → ${nav.href}`);
        cursorY = doc.y + 3;
      });

      cursorY += 5;
      drawDivider(doc, cursorY, pageWidth);
      cursorY += 15;
    }

    // ── Content Sections ──
    if (page.content && page.content.sections && page.content.sections.length > 0) {
      checkPageBreak(doc, cursorY, 40);
      cursorY = doc.y || cursorY;

      cursorY = drawSectionHeader(doc, 'Page Content', cursorY, pageWidth);

      for (const section of page.content.sections) {
        // Headings
        for (const heading of (section.headings || [])) {
          checkPageBreak(doc, cursorY, 30);
          cursorY = doc.y || cursorY;

          const hSize = Math.max(9, 18 - (heading.level * 2));
          doc.font('Helvetica-Bold')
            .fontSize(hSize)
            .fillColor(heading.level <= 2 ? COLORS.primary : COLORS.headingDark)
            .text(heading.text, doc.page.margins.left + (heading.level > 2 ? 10 : 0), cursorY, {
              width: pageWidth - (heading.level > 2 ? 10 : 0),
            });
          cursorY = doc.y + 6;
        }

        // Paragraphs
        for (const para of (section.paragraphs || [])) {
          checkPageBreak(doc, cursorY, 30);
          cursorY = doc.y || cursorY;

          doc.font('Helvetica')
            .fontSize(10)
            .fillColor(COLORS.bodyText)
            .text(para, doc.page.margins.left + 5, cursorY, {
              width: pageWidth - 10,
              lineGap: 3,
            });
          cursorY = doc.y + 8;
        }

        // Lists
        for (const list of (section.lists || [])) {
          for (const item of list.items) {
            checkPageBreak(doc, cursorY, 18);
            cursorY = doc.y || cursorY;

            const bullet = list.type === 'ol' ? '▸' : '•';
            doc.font('Helvetica')
              .fontSize(10)
              .fillColor(COLORS.bodyText)
              .text(`  ${bullet} ${item}`, doc.page.margins.left + 15, cursorY, {
                width: pageWidth - 30,
              });
            cursorY = doc.y + 2;
          }
          cursorY += 4;
        }

        // Buttons/CTAs
        if (section.buttons && section.buttons.length > 0) {
          checkPageBreak(doc, cursorY, 30);
          cursorY = doc.y || cursorY;

          doc.font('Helvetica-Bold')
            .fontSize(9)
            .fillColor(COLORS.accent)
            .text('Buttons / CTAs:', doc.page.margins.left + 5, cursorY);
          cursorY = doc.y + 4;

          for (const btn of section.buttons) {
            checkPageBreak(doc, cursorY, 20);
            cursorY = doc.y || cursorY;

            // Draw a small button-like box
            doc.roundedRect(doc.page.margins.left + 15, cursorY, 8, 8, 2)
              .fill(COLORS.accent);

            doc.font('Helvetica-Bold')
              .fontSize(9)
              .fillColor(COLORS.headingDark)
              .text(`  ${btn.text}`, doc.page.margins.left + 28, cursorY, {
                width: pageWidth - 50,
                continued: true,
              });

            if (btn.href) {
              doc.font('Helvetica')
                .fontSize(8)
                .fillColor(COLORS.lightGray)
                .text(`  → ${btn.href}`);
            } else {
              doc.text('');
            }
            cursorY = doc.y + 4;
          }
          cursorY += 4;
        }

        // Section separator (light)
        if (section.paragraphs?.length > 0 || section.headings?.length > 0) {
          checkPageBreak(doc, cursorY, 10);
          cursorY = doc.y || cursorY;

          doc.moveTo(doc.page.margins.left + 20, cursorY)
            .lineTo(doc.page.margins.left + pageWidth - 20, cursorY)
            .strokeColor(COLORS.bgLight)
            .lineWidth(0.5)
            .stroke();
          cursorY += 10;
        }
      }

      drawDivider(doc, cursorY, pageWidth);
      cursorY += 15;
    }

    // ── Images Table ──
    if (page.images && page.images.length > 0) {
      checkPageBreak(doc, cursorY, 60);
      cursorY = doc.y || cursorY;

      cursorY = drawSectionHeader(doc, `Images (${page.images.length})`, cursorY, pageWidth);

      // Table header
      const colWidths = [30, pageWidth - 170, 100, 40];
      const colX = [
        doc.page.margins.left,
        doc.page.margins.left + colWidths[0],
        doc.page.margins.left + colWidths[0] + colWidths[1],
        doc.page.margins.left + colWidths[0] + colWidths[1] + colWidths[2],
      ];

      // Header row
      doc.rect(doc.page.margins.left, cursorY, pageWidth, 18)
        .fill(COLORS.tableHeader);

      doc.font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.white);

      doc.text('#', colX[0] + 4, cursorY + 4, { width: colWidths[0] });
      doc.text('Source URL', colX[1] + 4, cursorY + 4, { width: colWidths[1] });
      doc.text('Alt Text', colX[2] + 4, cursorY + 4, { width: colWidths[2] });
      doc.text('Size', colX[3] + 4, cursorY + 4, { width: colWidths[3] });
      cursorY += 18;

      // Image rows
      page.images.forEach((img, i) => {
        checkPageBreak(doc, cursorY, 20);
        cursorY = doc.y || cursorY;

        // Alternating row bg
        if (i % 2 === 0) {
          doc.rect(doc.page.margins.left, cursorY, pageWidth, 16)
            .fill(COLORS.tableAlt);
        }

        const srcDisplay = truncate(img.src, 55);
        const dims = img.width && img.height ? `${img.width}×${img.height}` : '-';

        doc.font('Helvetica')
          .fontSize(7)
          .fillColor(COLORS.bodyText);

        doc.text(`${i + 1}`, colX[0] + 4, cursorY + 4, { width: colWidths[0] - 8 });
        doc.text(srcDisplay, colX[1] + 4, cursorY + 4, { width: colWidths[1] - 8 });
        doc.text(truncate(img.alt || '-', 20), colX[2] + 4, cursorY + 4, { width: colWidths[2] - 8 });
        doc.text(dims, colX[3] + 4, cursorY + 4, { width: colWidths[3] - 8 });

        cursorY += 16;
      });

      cursorY += 8;
      drawDivider(doc, cursorY, pageWidth);
      cursorY += 15;
    }

    // ── Links ──
    if (page.links && page.links.length > 0) {
      checkPageBreak(doc, cursorY, 60);
      cursorY = doc.y || cursorY;

      cursorY = drawSectionHeader(doc, `Links (${page.links.length})`, cursorY, pageWidth);

      for (const link of page.links) {
        checkPageBreak(doc, cursorY, 18);
        cursorY = doc.y || cursorY;

        const displayText = link.text || 'No text';
        doc.font('Helvetica')
          .fontSize(9)
          .fillColor(COLORS.link)
          .text(`• ${truncate(displayText, 40)}`, doc.page.margins.left + 10, cursorY, {
            width: pageWidth * 0.35,
            continued: true,
          })
          .fillColor(COLORS.lightGray)
          .fontSize(8)
          .text(`  ${truncate(link.href, 60)}`);
        cursorY = doc.y + 2;
      }

      cursorY += 5;
      drawDivider(doc, cursorY, pageWidth);
      cursorY += 15;
    }

    // ── Forms ──
    if (page.forms && page.forms.length > 0) {
      checkPageBreak(doc, cursorY, 80);
      cursorY = doc.y || cursorY;

      cursorY = drawSectionHeader(doc, `Forms (${page.forms.length})`, cursorY, pageWidth);

      for (const form of page.forms) {
        checkPageBreak(doc, cursorY, 40);
        cursorY = doc.y || cursorY;

        doc.font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(COLORS.headingDark)
          .text(`Action: ${form.action || 'N/A'}  |  Method: ${form.method}  |  ID: ${form.id || 'N/A'}`,
            doc.page.margins.left + 5, cursorY, { width: pageWidth - 10 });
        cursorY = doc.y + 6;

        // Form fields table
        const fColWidths = [80, 70, 120, 120, 50];
        const fColX = [doc.page.margins.left + 5];
        for (let c = 1; c < fColWidths.length; c++) {
          fColX.push(fColX[c - 1] + fColWidths[c - 1]);
        }

        // Header
        doc.rect(doc.page.margins.left + 5, cursorY, pageWidth - 10, 16)
          .fill(COLORS.tableHeader);

        doc.font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(COLORS.white);

        ['Label', 'Type', 'Name', 'Placeholder', 'Req?'].forEach((hdr, hi) => {
          doc.text(hdr, fColX[hi] + 3, cursorY + 4, { width: fColWidths[hi] - 6 });
        });
        cursorY += 16;

        // Rows
        form.fields.forEach((field, fi) => {
          checkPageBreak(doc, cursorY, 16);
          cursorY = doc.y || cursorY;

          if (fi % 2 === 0) {
            doc.rect(doc.page.margins.left + 5, cursorY, pageWidth - 10, 14)
              .fill(COLORS.tableAlt);
          }

          doc.font('Helvetica')
            .fontSize(7)
            .fillColor(COLORS.bodyText);

          const vals = [
            truncate(field.label || '-', 15),
            field.type || '-',
            truncate(field.name || '-', 20),
            truncate(field.placeholder || '-', 20),
            field.required ? '✓' : '-',
          ];

          vals.forEach((val, vi) => {
            doc.text(val, fColX[vi] + 3, cursorY + 3, { width: fColWidths[vi] - 6 });
          });

          cursorY += 14;
        });

        cursorY += 8;
      }

      drawDivider(doc, cursorY, pageWidth);
      cursorY += 15;
    }

    // ── Footer Content ──
    if (page.content?.footer?.text) {
      checkPageBreak(doc, cursorY, 50);
      cursorY = doc.y || cursorY;

      cursorY = drawSectionHeader(doc, 'Footer', cursorY, pageWidth);

      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.bodyText)
        .text(truncate(page.content.footer.text, 400), doc.page.margins.left + 5, cursorY, {
          width: pageWidth - 10,
        });
      cursorY = doc.y + 10;
    }

    // ── Raw Text Excerpt ──
    if (page.rawTextContent) {
      checkPageBreak(doc, cursorY, 80);
      cursorY = doc.y || cursorY;

      cursorY = drawSectionHeader(doc, 'Full Text Content', cursorY, pageWidth);

      // Light background box for raw text
      const textExcerpt = page.rawTextContent.substring(0, 2000);
      const boxHeight = Math.min(doc.heightOfString(textExcerpt, {
        width: pageWidth - 30,
        fontSize: 8,
      }) + 20, 350);

      doc.rect(doc.page.margins.left + 5, cursorY, pageWidth - 10, boxHeight)
        .fill('#F7F9FB');

      doc.font('Helvetica')
        .fontSize(8)
        .fillColor('#555555')
        .text(textExcerpt, doc.page.margins.left + 15, cursorY + 10, {
          width: pageWidth - 30,
          lineGap: 2,
          height: boxHeight - 15,
          ellipsis: true,
        });

      cursorY = doc.y + 15;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADD PAGE NUMBERS TO ALL PAGES
  // ─────────────────────────────────────────────────────────────────────────
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);

    // Footer line
    doc.moveTo(doc.page.margins.left, doc.page.height - 40)
      .lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 40)
      .strokeColor(COLORS.divider)
      .lineWidth(0.5)
      .stroke();

    doc.font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.lightGray);

    // Left side
    if (i > 0) {
      doc.text('Capital Services — Website Content', doc.page.margins.left, doc.page.height - 35, {
        width: pageWidth / 2,
        align: 'left',
      });
    }

    // Right side — page number
    doc.text(`Page ${i + 1} of ${totalPages}`, doc.page.width / 2, doc.page.height - 35, {
      width: pageWidth / 2,
      align: 'right',
    });
  }

  // Finalize
  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      console.log(`\n✅ PDF generated successfully!`);
      console.log(`📄 ${PDF_PATH}`);
      console.log(`   Total pages: ${totalPages}`);
      resolve();
    });
    stream.on('error', reject);
  });
}

// ─── Drawing Helpers ─────────────────────────────────────────────────────────

function checkPageBreak(doc, y, requiredSpace = 40) {
  const maxY = doc.page.height - doc.page.margins.bottom - 20;
  if (y + requiredSpace > maxY) {
    doc.addPage();
    doc.y = doc.page.margins.top;
    return doc.page.margins.top;
  }
  return y;
}

function drawDivider(doc, y, pageWidth) {
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.margins.left + pageWidth, y)
    .strokeColor(COLORS.divider)
    .lineWidth(1)
    .stroke();
}

function drawSectionHeader(doc, title, y, pageWidth) {
  // Accent bar
  doc.rect(doc.page.margins.left, y, 4, 18)
    .fill(COLORS.accent);

  doc.font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(COLORS.primary)
    .text(title, doc.page.margins.left + 12, y + 1, { width: pageWidth - 12 });

  return doc.y + 10;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  Capital Services — PDF Generator                    ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

generatePDF().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
