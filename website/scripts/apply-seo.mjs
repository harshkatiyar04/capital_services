/**
 * Apply SEO meta, Open Graph, Twitter cards, canonicals & JSON-LD to public pages.
 * Also writes public/sitemap.xml and public/robots.txt
 *
 * Usage: node scripts/apply-seo.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'data', 'seo-config.json'), 'utf-8'));
const SITE = (process.env.SITE_URL || cfg.siteUrl).replace(/\/$/, '');

const LOGO = cfg.logo;
const IMAGE = cfg.defaultImage;

function orgJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': `${SITE}/#organization`,
    name: cfg.siteName,
    legalName: cfg.legalName,
    url: SITE,
    logo: LOGO,
    image: IMAGE,
    email: cfg.email,
    telephone: cfg.phone,
    slogan: 'We care and it shows',
    alternateName: ['Capital Services (Watford) Ltd'],
    areaServed: [
      { '@type': 'Country', name: 'United Kingdom' },
      { '@type': 'AdministrativeArea', name: 'England' },
      { '@type': 'AdministrativeArea', name: 'London' },
      { '@type': 'AdministrativeArea', name: 'Home Counties' },
      { '@type': 'AdministrativeArea', name: 'South Coast' },
      { '@type': 'AdministrativeArea', name: 'Hertfordshire' },
      { '@type': 'AdministrativeArea', name: 'Hampshire' },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: cfg.address.street,
      addressLocality: cfg.address.locality,
      addressRegion: cfg.address.region,
      postalCode: cfg.address.postal,
      addressCountry: cfg.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 51.715,
      longitude: -0.45,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '18:00',
    },
    location: [
      {
        '@type': 'Place',
        name: 'Capital Services Kings Langley',
        telephone: cfg.phone,
        address: {
          '@type': 'PostalAddress',
          streetAddress: cfg.address.street,
          addressLocality: 'Kings Langley',
          addressRegion: 'Hertfordshire',
          postalCode: cfg.address.postal,
          addressCountry: 'GB',
        },
      },
      {
        '@type': 'Place',
        name: 'Capital Services Watford',
        telephone: cfg.phone,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Watford',
          addressRegion: 'Hertfordshire',
          addressCountry: 'GB',
        },
      },
      {
        '@type': 'Place',
        name: 'Capital Services Yateley',
        telephone: cfg.phone,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Yateley',
          addressRegion: 'Hampshire',
          addressCountry: 'GB',
        },
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Insurance repair services',
      itemListElement: [
        'Fire and smoke damage',
        'Flood and escape of water',
        'Storm damage',
        'Subsidence',
        'Impact damage',
        'Emergency make-safe and drying',
        'Leak detection',
        'Commercial claims',
        'Major loss',
        'Claim validation',
      ].map((name) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name, provider: { '@id': `${SITE}/#organization` } },
      })),
    },
    sameAs: [
      'https://www.linkedin.com/company/capital-services-watford-ltd',
    ],
    knowsAbout: [
      'Insurance repair',
      'Property restoration',
      'Fire and smoke damage',
      'Flood damage',
      'Escape of water',
      'Storm damage',
      'Subsidence',
      'Impact damage',
      'Major loss claims',
      'Commercial insurance repair',
      'Emergency make-safe',
      'Leak detection',
    ],
  };
}

function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: SITE,
    name: cfg.siteName,
    description: cfg.pages['index.html'].description,
    publisher: { '@id': `${SITE}/#organization` },
    inLanguage: 'en-GB',
  };
}

function breadcrumbJsonLd(page) {
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
  ];
  if (page.path !== '/') {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: page.title.split('|')[0].trim(),
      item: `${SITE}${page.path}`,
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What do you repair?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We take insured homes and commercial buildings from the first make-safe through to handing them back. The work covers escape of water, flood, fire and smoke, storm, subsidence and impact.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who do you work with?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Insurers, property owners and their partners. We validate the claim, make the property safe, then carry it through drying and reinstatement. Where a policyholder would rather not use a nominated contractor, we manage the cash settlement instead.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where do you cover?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'London, the Home Counties and the South Coast, from offices in Watford, Yateley and Kings Langley. The coverage map shows the postcodes we attend.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I reach you?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Call 01923 270022 or email info@capitalservices.com. The offices are open Monday to Friday, 8:00am to 6:00pm, and every enquiry gets a reply within 24 hours.',
        },
      },
    ],
  };
}

function serviceJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Insurance Repair & Property Restoration',
    provider: { '@id': `${SITE}/#organization` },
    areaServed: 'GB',
    serviceType: [
      'Insurance repair',
      'Emergency make-safe',
      'Drying & reinstatement',
      'Major loss project management',
    ],
    url: `${SITE}/services`,
  };
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function buildHeadBlock(file, page) {
  const url = `${SITE}${page.path}`;
  const title = page.title;
  const desc = page.description;
  const keywords = page.keywords || '';
  const ogType = page.ogType || 'website';
  const image = page.image || IMAGE;
  const imageWidth = page.imageWidth || cfg.shareImageWidth || '1200';
  const imageHeight = page.imageHeight || cfg.shareImageHeight || '630';
  const imageAlt = `${cfg.siteName} — insurance repair specialists`;

  const graphs = [orgJsonLd(), breadcrumbJsonLd(page)];
  if (file === 'index.html') {
    graphs.push(websiteJsonLd());
  }
  if (file === 'services.html') graphs.push(serviceJsonLd());

  const jsonLd = graphs
    .map((g) => `  <script type="application/ld+json">${JSON.stringify(g)}</script>`)
    .join('\n');

  const consentBoot = cfg.gaMeasurementId
    ? `  <script>window.CS_GA_ID=${JSON.stringify(cfg.gaMeasurementId)};</script>
  <script src="/js/cookie-consent.js" defer></script>
`
    : '';

  const gscMeta = (file === 'index.html' && cfg.googleSiteVerification)
    ? `  <meta name="google-site-verification" content="${escapeAttr(cfg.googleSiteVerification)}">\n`
    : '';

  return `${consentBoot}  <title>${escapeAttr(title)}</title>
  <meta name="description" content="${escapeAttr(desc)}">
  <meta name="keywords" content="${escapeAttr(keywords)}">
  <meta name="author" content="${escapeAttr(cfg.legalName)}">
${gscMeta}  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="googlebot" content="index, follow">
  <meta name="bingbot" content="index, follow">
  <meta name="theme-color" content="#1a1a1a">
  <meta name="format-detection" content="telephone=yes">
  <meta name="geo.region" content="GB-HRT">
  <meta name="geo.placename" content="Kings Langley, Hertfordshire">
  <meta name="geo.position" content="51.715;-0.45">
  <meta name="ICBM" content="51.715, -0.45">
  <link rel="canonical" href="${escapeAttr(url)}">
  <link rel="alternate" hreflang="en-GB" href="${escapeAttr(url)}">
  <link rel="alternate" hreflang="x-default" href="${escapeAttr(url)}">
  <meta property="og:type" content="${escapeAttr(ogType)}">
  <meta property="og:locale" content="en_GB">
  <meta property="og:site_name" content="${escapeAttr(cfg.siteName)}">
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:description" content="${escapeAttr(desc)}">
  <meta property="og:url" content="${escapeAttr(url)}">
  <meta property="og:image" content="${escapeAttr(image)}">
  <meta property="og:image:secure_url" content="${escapeAttr(image)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="${escapeAttr(imageWidth)}">
  <meta property="og:image:height" content="${escapeAttr(imageHeight)}">
  <meta property="og:image:alt" content="${escapeAttr(imageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title)}">
  <meta name="twitter:description" content="${escapeAttr(desc)}">
  <meta name="twitter:image" content="${escapeAttr(image)}">
  <meta name="twitter:image:alt" content="${escapeAttr(imageAlt)}">
${jsonLd}`;
}

const MARK_START = '<!-- SEO:START -->';
const MARK_END = '<!-- SEO:END -->';

function applyToHtml(file, page) {
  const path = join(ROOT, file);
  let html = readFileSync(path, 'utf-8');
  const block = `${MARK_START}\n${buildHeadBlock(file, page)}\n  ${MARK_END}`;

  if (html.includes(MARK_START) && html.includes(MARK_END)) {
    html = html.replace(new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`), block);
  } else {
    // Replace existing title + description (first occurrence pair)
    const replaced = html.replace(
      /<title>[\s\S]*?<\/title>\s*<meta name="description" content="[^"]*">/i,
      block,
    );
    if (replaced === html) {
      // Fallback: insert after charset/viewport
      html = html.replace(
        /(<meta name="viewport"[^>]*>)/i,
        `$1\n  ${block}`,
      );
    } else {
      html = replaced;
    }
  }

  // Ensure lang is en-GB
  html = html.replace(/<html lang="en">/i, '<html lang="en-GB">');

  writeFileSync(path, html);
  console.log(`SEO applied: ${file}`);
}

function writeSitemap() {
  const publicDir = join(ROOT, 'public');
  mkdirSync(publicDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const urls = Object.entries(cfg.pages)
    .map(([file, page]) => {
      const loc = `${SITE}${page.path === '/' ? '/' : page.path}`;
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq || 'monthly'}</changefreq>
    <priority>${page.priority || '0.5'}</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  writeFileSync(join(publicDir, 'sitemap.xml'), xml);
  console.log('Wrote public/sitemap.xml');
}

function writeRobots() {
  const publicDir = join(ROOT, 'public');
  mkdirSync(publicDir, { recursive: true });
  const txt = `User-agent: *
Allow: /

# Internal portals - do not index
Disallow: /admin
Disallow: /admin.html
Disallow: /team
Disallow: /team.html
Disallow: /crew
Disallow: /crew.html
Disallow: /survey
Disallow: /survey.html
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`;
  writeFileSync(join(publicDir, 'robots.txt'), txt);
  console.log('Wrote public/robots.txt');
}

function writeHumans() {
  const publicDir = join(ROOT, 'public');
  const txt = `/* TEAM */
Capital Services (Watford) Ltd
Insurance repair & property restoration

/* SITE */
Standards: HTML5, CSS3, Schema.org
Components: Vite, Vercel, Cloudinary
`;
  writeFileSync(join(publicDir, 'humans.txt'), txt);
}

for (const [file, page] of Object.entries(cfg.pages)) {
  applyToHtml(file, page);
}
writeSitemap();
writeRobots();
writeHumans();
console.log(`\nSite URL: ${SITE}`);
console.log('Done. Set SITE_URL env if your live domain differs, then re-run.');
