/**
 * Capital Services Website Crawler
 * =================================
 * Crawls https://capitalservices.com/ and extracts all content from every page.
 * Stores results in structured Markdown documents + a master JSON file.
 *
 * Usage: node crawler.mjs
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { URL } from 'url';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

// ─── Configuration ───────────────────────────────────────────────────────────
const BASE_URL = 'https://capitalservices.com';
const OUTPUT_DIR = path.resolve('output');
const PAGES_DIR = path.join(OUTPUT_DIR, 'pages');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');
const DELAY_MS = 1000; // Polite delay between requests

// All known pages from the sitemap
const PAGES_TO_CRAWL = [
  '/',
  '/about-us/',
  '/bespoke-building-services/',
  '/insurance-repair/',
  '/customer-care/',
  '/contact-us/',
  '/privacy-policy/',
  '/thank-you/',
  '/thank-you-vacancies/',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeFilename(str) {
  return str
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function slugFromPath(urlPath) {
  if (urlPath === '/') return 'home';
  return urlPath.replace(/^\/|\/$/g, '').replace(/\//g, '_');
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return await response.text();
}

async function downloadImage(imageUrl, destPath) {
  try {
    const protocol = imageUrl.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
      protocol.get(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Follow redirect
          downloadImage(response.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${imageUrl}`));
          return;
        }
        const fileStream = createWriteStream(destPath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destPath);
        });
        fileStream.on('error', reject);
      }).on('error', reject);
    });
  } catch (err) {
    console.error(`  ⚠ Failed to download image: ${imageUrl} - ${err.message}`);
    return null;
  }
}

// ─── Content Extraction ──────────────────────────────────────────────────────

function extractPageData($, url) {
  const pageData = {
    url,
    crawledAt: new Date().toISOString(),
    meta: {},
    navigation: [],
    content: {},
    images: [],
    links: [],
    forms: [],
    rawTextContent: '',
  };

  // ── Meta Information ──
  pageData.meta.title = $('title').text().trim();
  pageData.meta.description = $('meta[name="description"]').attr('content') || '';
  pageData.meta.ogTitle = $('meta[property="og:title"]').attr('content') || '';
  pageData.meta.ogDescription = $('meta[property="og:description"]').attr('content') || '';
  pageData.meta.ogImage = $('meta[property="og:image"]').attr('content') || '';
  pageData.meta.canonical = $('link[rel="canonical"]').attr('href') || '';

  // ── Structured Data (JSON-LD) ──
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push(JSON.parse($(el).html()));
    } catch {}
  });
  pageData.meta.structuredData = jsonLd;

  // ── Navigation ──
  $('nav a, .menu a, .navbar a, #menu-main-menu a, .elementor-nav-menu a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (text && href) {
      pageData.navigation.push({ text, href });
    }
  });
  // Deduplicate nav items
  const navSeen = new Set();
  pageData.navigation = pageData.navigation.filter(item => {
    const key = `${item.text}|${item.href}`;
    if (navSeen.has(key)) return false;
    navSeen.add(key);
    return true;
  });

  // ── Headings ──
  pageData.content.headings = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const text = $(el).text().trim();
    const level = parseInt(el.tagName.replace('h', ''));
    if (text) {
      pageData.content.headings.push({ level, text });
    }
  });

  // ── Main Content Sections ──
  // Try to get the main content area (Elementor-based site)
  pageData.content.sections = [];

  // Extract Elementor sections
  $('.elementor-section, .elementor-top-section, section').each((i, section) => {
    const sectionData = {
      index: i,
      headings: [],
      paragraphs: [],
      lists: [],
      buttons: [],
      images: [],
      widgets: [],
    };

    $(section).find('h1, h2, h3, h4, h5, h6').each((_, h) => {
      const text = $(h).text().trim();
      if (text) sectionData.headings.push({
        level: parseInt(h.tagName.replace('h', '')),
        text,
      });
    });

    $(section).find('p').each((_, p) => {
      const text = $(p).text().trim();
      if (text && text.length > 1) sectionData.paragraphs.push(text);
    });

    $(section).find('ul, ol').each((_, list) => {
      const items = [];
      $(list).find('li').each((_, li) => {
        const text = $(li).text().trim();
        if (text) items.push(text);
      });
      if (items.length) sectionData.lists.push({
        type: list.tagName.toLowerCase(),
        items,
      });
    });

    $(section).find('a.elementor-button, .btn, button, [role="button"]').each((_, btn) => {
      const text = $(btn).text().trim();
      const href = $(btn).attr('href') || '';
      if (text) sectionData.buttons.push({ text, href });
    });

    $(section).find('img').each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src') || '';
      const alt = $(img).attr('alt') || '';
      if (src) sectionData.images.push({ src, alt });
    });

    // Elementor widget titles
    $(section).find('.elementor-widget-container').each((_, widget) => {
      const widgetText = $(widget).text().trim();
      if (widgetText && widgetText.length > 5) {
        sectionData.widgets.push(widgetText.substring(0, 500));
      }
    });

    // Only add sections that have actual content
    const hasContent = sectionData.headings.length > 0 ||
      sectionData.paragraphs.length > 0 ||
      sectionData.lists.length > 0 ||
      sectionData.buttons.length > 0;

    if (hasContent) {
      pageData.content.sections.push(sectionData);
    }
  });

  // ── All Images ──
  const imageSeen = new Set();
  $('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src') || '';
    const alt = $(img).attr('alt') || '';
    const srcset = $(img).attr('srcset') || '';
    const width = $(img).attr('width') || '';
    const height = $(img).attr('height') || '';

    if (src && !imageSeen.has(src)) {
      imageSeen.add(src);
      pageData.images.push({ src, alt, srcset, width, height });
    }
  });

  // Also grab background images from inline styles
  $('[style*="background-image"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (match && match[1] && !imageSeen.has(match[1])) {
      imageSeen.add(match[1]);
      pageData.images.push({ src: match[1], alt: 'background-image', srcset: '', width: '', height: '' });
    }
  });

  // ── All Links ──
  const linkSeen = new Set();
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const title = $(el).attr('title') || '';
    if (href && !linkSeen.has(href)) {
      linkSeen.add(href);
      pageData.links.push({ href, text, title });
    }
  });

  // ── Forms ──
  $('form').each((_, form) => {
    const formData = {
      action: $(form).attr('action') || '',
      method: $(form).attr('method') || 'GET',
      id: $(form).attr('id') || '',
      fields: [],
    };

    $(form).find('input, textarea, select').each((_, field) => {
      formData.fields.push({
        type: $(field).attr('type') || field.tagName.toLowerCase(),
        name: $(field).attr('name') || '',
        placeholder: $(field).attr('placeholder') || '',
        required: $(field).attr('required') !== undefined,
        label: '',
      });

      // Try to find associated label
      const fieldId = $(field).attr('id');
      if (fieldId) {
        const label = $(`label[for="${fieldId}"]`).text().trim();
        if (label) formData.fields[formData.fields.length - 1].label = label;
      }
    });

    if (formData.fields.length > 0) {
      pageData.forms.push(formData);
    }
  });

  // ── Footer Content ──
  pageData.content.footer = {};
  const footer = $('footer, .footer, .site-footer, #footer');
  if (footer.length) {
    pageData.content.footer.text = footer.text().trim().replace(/\s+/g, ' ');
    pageData.content.footer.links = [];
    footer.find('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (href && text) {
        pageData.content.footer.links.push({ href, text });
      }
    });
  }

  // ── Raw Text ──
  // Get clean text content from body, excluding scripts/styles
  const body = $('body').clone();
  body.find('script, style, noscript').remove();
  pageData.rawTextContent = body.text()
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return pageData;
}

// ─── Output Formatters ──────────────────────────────────────────────────────

function pageDataToMarkdown(pageData) {
  let md = '';
  const slug = slugFromPath(new URL(pageData.url).pathname);

  md += `# ${pageData.meta.title || slug}\n\n`;
  md += `> **URL:** ${pageData.url}  \n`;
  md += `> **Crawled:** ${pageData.crawledAt}  \n`;
  if (pageData.meta.description) {
    md += `> **Meta Description:** ${pageData.meta.description}  \n`;
  }
  md += '\n---\n\n';

  // Navigation
  if (pageData.navigation.length > 0) {
    md += `## 🧭 Navigation\n\n`;
    pageData.navigation.forEach(nav => {
      md += `- [${nav.text}](${nav.href})\n`;
    });
    md += '\n---\n\n';
  }

  // Content Sections
  if (pageData.content.sections && pageData.content.sections.length > 0) {
    md += `## 📄 Page Content\n\n`;

    pageData.content.sections.forEach((section, i) => {
      md += `### Section ${i + 1}\n\n`;

      if (section.headings.length > 0) {
        section.headings.forEach(h => {
          md += `${'#'.repeat(Math.min(h.level + 2, 6))} ${h.text}\n\n`;
        });
      }

      if (section.paragraphs.length > 0) {
        section.paragraphs.forEach(p => {
          md += `${p}\n\n`;
        });
      }

      if (section.lists.length > 0) {
        section.lists.forEach(list => {
          list.items.forEach(item => {
            md += `- ${item}\n`;
          });
          md += '\n';
        });
      }

      if (section.buttons.length > 0) {
        md += `**Buttons/CTAs:**\n`;
        section.buttons.forEach(btn => {
          md += `- 🔘 [${btn.text}](${btn.href})\n`;
        });
        md += '\n';
      }

      if (section.images.length > 0) {
        md += `**Images in section:**\n`;
        section.images.forEach(img => {
          md += `- ![${img.alt || 'image'}](${img.src})\n`;
        });
        md += '\n';
      }

      md += '---\n\n';
    });
  }

  // All Images
  if (pageData.images.length > 0) {
    md += `## 🖼️ All Images (${pageData.images.length})\n\n`;
    md += `| # | Source | Alt Text | Dimensions |\n`;
    md += `|---|--------|----------|------------|\n`;
    pageData.images.forEach((img, i) => {
      const dims = img.width && img.height ? `${img.width}x${img.height}` : '-';
      const altText = (img.alt || '-').replace(/\|/g, '\\|');
      const src = img.src.replace(/\|/g, '\\|');
      md += `| ${i + 1} | ${src} | ${altText} | ${dims} |\n`;
    });
    md += '\n---\n\n';
  }

  // Links
  if (pageData.links.length > 0) {
    md += `## 🔗 All Links (${pageData.links.length})\n\n`;
    pageData.links.forEach(link => {
      const text = link.text || link.href;
      md += `- [${text}](${link.href})`;
      if (link.title) md += ` — _${link.title}_`;
      md += '\n';
    });
    md += '\n---\n\n';
  }

  // Forms
  if (pageData.forms.length > 0) {
    md += `## 📝 Forms (${pageData.forms.length})\n\n`;
    pageData.forms.forEach((form, i) => {
      md += `### Form ${i + 1}\n`;
      md += `- **Action:** ${form.action || 'N/A'}\n`;
      md += `- **Method:** ${form.method}\n`;
      md += `- **ID:** ${form.id || 'N/A'}\n\n`;

      md += `| Field | Type | Name | Placeholder | Required |\n`;
      md += `|-------|------|------|-------------|----------|\n`;
      form.fields.forEach(field => {
        md += `| ${field.label || '-'} | ${field.type} | ${field.name} | ${field.placeholder} | ${field.required ? '✅' : '❌'} |\n`;
      });
      md += '\n';
    });
    md += '---\n\n';
  }

  // Footer
  if (pageData.content.footer && pageData.content.footer.text) {
    md += `## 🦶 Footer\n\n`;
    md += `${pageData.content.footer.text}\n\n`;
    if (pageData.content.footer.links && pageData.content.footer.links.length > 0) {
      md += `**Footer Links:**\n`;
      pageData.content.footer.links.forEach(link => {
        md += `- [${link.text}](${link.href})\n`;
      });
    }
    md += '\n---\n\n';
  }

  // Raw Text
  md += `## 📃 Raw Text Content\n\n`;
  md += '```\n';
  md += pageData.rawTextContent.substring(0, 5000);
  if (pageData.rawTextContent.length > 5000) {
    md += '\n\n[... truncated, see full text in JSON output ...]';
  }
  md += '\n```\n';

  return md;
}

// ─── Main Crawler ────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Capital Services Website Crawler                    ║');
  console.log('║  https://capitalservices.com                         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log();

  // Create output directories
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(PAGES_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  const allPagesData = [];
  const allImages = new Set();

  // ── Crawl Each Page ──
  for (const pagePath of PAGES_TO_CRAWL) {
    const url = `${BASE_URL}${pagePath}`;
    const slug = slugFromPath(pagePath);

    console.log(`\n🌐 Crawling: ${url}`);
    console.log(`   Slug: ${slug}`);

    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);
      const pageData = extractPageData($, url);

      // Save Markdown document
      const mdContent = pageDataToMarkdown(pageData);
      const mdPath = path.join(PAGES_DIR, `${slug}.md`);
      await fs.writeFile(mdPath, mdContent, 'utf-8');
      console.log(`   ✅ Saved: ${mdPath}`);

      // Save raw HTML
      const htmlPath = path.join(PAGES_DIR, `${slug}.html`);
      await fs.writeFile(htmlPath, html, 'utf-8');
      console.log(`   ✅ Saved HTML: ${htmlPath}`);

      // Collect images
      pageData.images.forEach(img => {
        if (img.src && img.src.includes('capitalservices.com')) {
          allImages.add(img.src);
        }
      });

      allPagesData.push(pageData);

      console.log(`   📝 Headings: ${pageData.content.headings?.length || 0}`);
      console.log(`   📄 Sections: ${pageData.content.sections?.length || 0}`);
      console.log(`   🖼️  Images: ${pageData.images.length}`);
      console.log(`   🔗 Links: ${pageData.links.length}`);
      console.log(`   📝 Forms: ${pageData.forms.length}`);

      // Polite delay
      await sleep(DELAY_MS);

    } catch (err) {
      console.error(`   ❌ Error crawling ${url}: ${err.message}`);
    }
  }

  // ── Download Images ──
  console.log(`\n\n🖼️  Downloading ${allImages.size} unique images...\n`);
  let downloadedCount = 0;

  for (const imageUrl of allImages) {
    try {
      const urlObj = new URL(imageUrl);
      const ext = path.extname(urlObj.pathname) || '.jpg';
      const filename = sanitizeFilename(path.basename(urlObj.pathname, ext)) + ext;
      const destPath = path.join(IMAGES_DIR, filename);

      // Check if already downloaded
      try {
        await fs.access(destPath);
        console.log(`   ⏭️  Already exists: ${filename}`);
        downloadedCount++;
        continue;
      } catch {}

      console.log(`   ⬇️  Downloading: ${filename}`);
      await downloadImage(imageUrl, destPath);
      downloadedCount++;
      await sleep(300);
    } catch (err) {
      console.error(`   ⚠ Failed: ${imageUrl} - ${err.message}`);
    }
  }

  console.log(`\n   ✅ Downloaded ${downloadedCount}/${allImages.size} images`);

  // ── Save Master JSON ──
  const masterData = {
    site: BASE_URL,
    crawledAt: new Date().toISOString(),
    totalPages: allPagesData.length,
    totalImages: allImages.size,
    pages: allPagesData,
    imageUrls: [...allImages],
  };

  const jsonPath = path.join(OUTPUT_DIR, 'site_data.json');
  await fs.writeFile(jsonPath, JSON.stringify(masterData, null, 2), 'utf-8');
  console.log(`\n📦 Master JSON saved: ${jsonPath}`);

  // ── Generate Site Summary ──
  let summary = `# Capital Services - Complete Site Content\n\n`;
  summary += `> **Site:** ${BASE_URL}  \n`;
  summary += `> **Crawled:** ${new Date().toISOString()}  \n`;
  summary += `> **Total Pages:** ${allPagesData.length}  \n`;
  summary += `> **Total Images:** ${allImages.size}  \n\n`;
  summary += `---\n\n`;
  summary += `## Pages Crawled\n\n`;
  summary += `| # | Page | URL | Headings | Sections | Images | Links | Forms |\n`;
  summary += `|---|------|-----|----------|----------|--------|-------|-------|\n`;

  allPagesData.forEach((page, i) => {
    const slug = slugFromPath(new URL(page.url).pathname);
    summary += `| ${i + 1} | [${slug}](pages/${slug}.md) | ${page.url} | ${page.content.headings?.length || 0} | ${page.content.sections?.length || 0} | ${page.images.length} | ${page.links.length} | ${page.forms.length} |\n`;
  });

  summary += `\n---\n\n`;
  summary += `## Site Navigation Structure\n\n`;

  // Use navigation from first page (home)
  if (allPagesData.length > 0 && allPagesData[0].navigation.length > 0) {
    allPagesData[0].navigation.forEach(nav => {
      summary += `- [${nav.text}](${nav.href})\n`;
    });
  }

  summary += `\n---\n\n`;
  summary += `## All Downloaded Images\n\n`;
  [...allImages].forEach((img, i) => {
    const filename = path.basename(new URL(img).pathname);
    summary += `${i + 1}. \`${filename}\` — ${img}\n`;
  });

  summary += `\n---\n\n`;
  summary += `## Output Files\n\n`;
  summary += `- \`output/site_data.json\` — Complete structured data (JSON)\n`;
  summary += `- \`output/pages/*.md\` — Individual page content (Markdown)\n`;
  summary += `- \`output/pages/*.html\` — Raw HTML for each page\n`;
  summary += `- \`output/images/\` — Downloaded image assets\n`;

  const summaryPath = path.join(OUTPUT_DIR, 'SITE_SUMMARY.md');
  await fs.writeFile(summaryPath, summary, 'utf-8');
  console.log(`📋 Site summary saved: ${summaryPath}`);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  ✅ Crawling Complete!                                ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n📂 Output directory: ${OUTPUT_DIR}`);
  console.log(`   📄 ${allPagesData.length} pages extracted`);
  console.log(`   🖼️  ${downloadedCount} images downloaded`);
  console.log(`   📦 Master JSON: site_data.json`);
  console.log(`   📋 Summary: SITE_SUMMARY.md\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
