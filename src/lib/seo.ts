const DEFAULT_SITE_URL = 'https://www.pazarglobal.com';

export const PREFERRED_ORIGIN = (
  import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL
).replace(/\/$/, '');

export function normalizePathname(pathname: string): string {
  if (!pathname) return '/';

  const cleaned = pathname.replace(/\/+$/, '') || '/';
  if (cleaned === '/' || cleaned.toLowerCase() === '/home') {
    return '/';
  }

  return cleaned;
}

export function buildCanonicalUrl(pathname: string): string {
  const normalized = normalizePathname(pathname);
  return `${PREFERRED_ORIGIN}${normalized === '/' ? '' : normalized}`;
}

export function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
}

export function buildListingPath(id: string, title?: string): string {
  const safeId = encodeURIComponent(id || '');
  const slug = slugify(title || '');
  return slug ? `/listing/${safeId}/${slug}` : `/listing/${safeId}`;
}
