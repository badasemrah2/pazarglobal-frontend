import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { buildCanonicalUrl, normalizePathname, PREFERRED_ORIGIN } from '../../lib/seo';

type SeoConfig = {
  title: string;
  description: string;
  index: boolean;
};

const SITE_NAME = 'PazarGlobal';
const DEFAULT_OG_IMAGE = '/logo.png';

function getSeoConfig(pathname: string): SeoConfig {
  if (pathname === '/') {
    return {
      title: 'PazarGlobal - AI ile Saniyeler İçinde İlan Ver',
      description:
        "Türkiye'nin AI destekli ilan platformu. WhatsApp ve WebChat ile hızlıca ilan oluşturun, arayın ve yönetin.",
      index: true,
    };
  }

  if (pathname === '/listings') {
    return {
      title: 'İlanlar - PazarGlobal',
      description: 'Güncel ilanları keşfedin, filtreleyin ve aradığınız ürünü hızlıca bulun.',
      index: true,
    };
  }

  if (pathname.startsWith('/listing/')) {
    return {
      title: 'İlan Detayı - PazarGlobal',
      description: 'İlan detaylarını inceleyin, satıcıyla iletişime geçin ve güvenle alışveriş yapın.',
      index: true,
    };
  }

  if (pathname === '/about') {
    return {
      title: 'Hakkımızda - PazarGlobal',
      description: 'PazarGlobal vizyonu, AI destekli ilan yaklaşımı ve platform hikayemiz.',
      index: true,
    };
  }

  if (pathname === '/reviews') {
    return {
      title: 'Yorumlar ve Değerlendirmeler - PazarGlobal',
      description: 'Kullanıcı deneyimlerini, değerlendirmeleri ve PazarGlobal geri bildirimlerini inceleyin.',
      index: true,
    };
  }

  if (pathname === '/create-listing') {
    return {
      title: 'İlan Oluştur - PazarGlobal',
      description: 'Fotoğraf, metin veya konuşma ile saniyeler içinde ilan oluşturun.',
      index: false,
    };
  }

  if (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/contact/')
  ) {
    return {
      title: `${SITE_NAME} - Hesap ve Mesajlaşma`,
      description: 'PazarGlobal hesap ve mesajlaşma alanı.',
      index: false,
    };
  }

  return {
    title: `${SITE_NAME} - Sayfa Bulunamadi`,
    description: 'Aradiginiz sayfa bulunamadi.',
    index: false,
  };
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
}

function upsertCanonical(href: string) {
  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
}

export default function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPathname = normalizePathname(pathname);
    const config = getSeoConfig(normalizedPathname);
    const canonical = buildCanonicalUrl(normalizedPathname);
    const robots = config.index ? 'index,follow,max-image-preview:large' : 'noindex,nofollow';

    document.title = config.title;

    upsertMeta('meta[name="description"]', { name: 'description', content: config.description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: config.title });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: config.description,
    });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: `${PREFERRED_ORIGIN}${DEFAULT_OG_IMAGE}` });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: config.title });
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: config.description,
    });
    upsertMeta('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: `${PREFERRED_ORIGIN}${DEFAULT_OG_IMAGE}`,
    });
    upsertCanonical(canonical);
  }, [pathname]);

  return null;
}
