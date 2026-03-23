import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

async function loadEnvFile() {
  const envPath = path.join(projectRoot, '.env');
  try {
    const content = await fs.readFile(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env dosyası yoksa sessizce devam et
  }
}

const STATIC_PATHS = [
  '/',
  '/listings',
  '/create-listing',
  '/about',
  '/reviews',
];

function toIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function escapeXml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildUrlNode({ loc, lastmod, changefreq, priority }) {
  const lines = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
  ];

  if (lastmod) lines.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (changefreq) lines.push(`    <changefreq>${escapeXml(changefreq)}</changefreq>`);
  if (priority) lines.push(`    <priority>${escapeXml(priority)}</priority>`);

  lines.push('  </url>');
  return lines.join('\n');
}

async function fetchActiveListings({ SUPABASE_URL, SUPABASE_KEY }) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[sitemap] Supabase env eksik, sadece statik sayfalar yazılacak.');
    return [];
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/listings`;
  const query = new URLSearchParams({
    select: 'id,created_at,updated_at,status,expires_at',
    status: 'eq.active',
    order: 'created_at.desc',
    limit: '5000',
  });

  const response = await fetch(`${endpoint}?${query.toString()}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`[sitemap] Listings fetch failed (${response.status}): ${body}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) return [];

  const now = Date.now();
  return rows.filter((row) => {
    if (!row || !row.id) return false;
    if (!row.expires_at) return true;
    const exp = new Date(row.expires_at).getTime();
    return Number.isFinite(exp) ? exp >= now : true;
  });
}

async function generateSitemap() {
  await loadEnvFile();

  const SITE_URL = (process.env.SITE_URL || 'https://pazarglobal.com').replace(/\/$/, '');
  const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

  const staticNodes = STATIC_PATHS.map((p, i) =>
    buildUrlNode({
      loc: `${SITE_URL}${p}`,
      changefreq: i === 0 ? 'daily' : 'weekly',
      priority: i === 0 ? '1.0' : i === 1 ? '0.9' : '0.7',
    }),
  );

  let listingRows = [];
  try {
    listingRows = await fetchActiveListings({ SUPABASE_URL, SUPABASE_KEY });
  } catch (error) {
    console.error(String(error));
    // Fail-soft: still write static sitemap so build can continue.
  }

  const listingNodes = listingRows.map((row) =>
    buildUrlNode({
      loc: `${SITE_URL}/listing/${row.id}`,
      lastmod: toIsoDate(row.updated_at) || toIsoDate(row.created_at) || undefined,
      changefreq: 'daily',
      priority: '0.8',
    }),
  );

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticNodes,
    ...listingNodes,
    '</urlset>',
    '',
  ].join('\n');

  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(sitemapPath, xml, 'utf8');

  console.log(`[sitemap] Yazıldı: ${sitemapPath}`);
  console.log(`[sitemap] Statik URL: ${STATIC_PATHS.length}, İlan URL: ${listingNodes.length}`);
}

generateSitemap().catch((error) => {
  console.error('[sitemap] Fatal error:', error);
  process.exit(1);
});
