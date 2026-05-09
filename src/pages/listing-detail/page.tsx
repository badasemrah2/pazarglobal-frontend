
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import TopNavigation from '../../components/feature/TopNavigation';
import Footer from '../home/components/Footer';
import ChatBox from '../../components/feature/ChatBox';
import { toCanonicalCondition } from '../../lib/condition';
import { supabase } from '../../lib/supabase';
import { getExampleListingBadgeUI, isExampleListingOwner } from '../../lib/exampleListing';
import { isOwnedByViewer, resolveViewerUserId } from '../../lib/listingOwnership';
import { getPremiumBadgeUI } from '../../lib/premiumBadge';
import { buildCanonicalUrl, buildListingPath, PREFERRED_ORIGIN } from '../../lib/seo';
import { fetchPublicContactLink, resolveContactToken } from '../../services/agentApi';
import { useAuthStore } from '../../stores/authStore';

// ── Report Modal ─────────────────────────────────────────────────────────────
const REPORT_REASONS = [
  'Sahte / yanıltıcı ilan',
  'Yasadışı ürün veya hizmet',
  'Dolandırıcılık şüphesi',
  'Uygunsuz / müstehcen içerik',
  'Nefret söylemi veya taciz',
  'Diğer',
] as const;

type ReportReason = (typeof REPORT_REASONS)[number];

interface ReportModalProps {
  listingId: string;
  listingTitle: string;
  onClose: () => void;
}

function ReportModal({ listingId, listingTitle, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneType, setDoneType] = useState<'created' | 'duplicate'>('created');
  const [doneMessage, setDoneMessage] = useState('');
  const [err, setErr] = useState('');

  const extractErrorMessage = (input: unknown): string => {
    if (!input) return 'Bilinmeyen hata';
    if (typeof input === 'string') return input;
    if (input instanceof Error) return input.message;
    if (typeof input === 'object') {
      const obj = input as Record<string, unknown>;
      const parts = [obj.message, obj.error, obj.detail, obj.code]
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
      if (parts.length > 0) return parts.join(' | ');
      try {
        return JSON.stringify(obj);
      } catch {
        return 'Bilinmeyen hata';
      }
    }
    return String(input);
  };

  const handleSubmit = async () => {
    if (!reason) { setErr('Lütfen bir şikayet sebebi seçin.'); return; }
    setSubmitting(true);
    setErr('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('report-illegal-listing', {
        body: {
          listing_id: listingId,
          reason,
          evidence: details.trim() ? { details: details.trim() } : null,
        },
      });

      if (fnErr) {
        throw fnErr;
      }
      if (!data?.success) {
        throw data;
      }

      if (data?.duplicate) {
        setDoneType('duplicate');
        setDoneMessage(data?.message || 'Bu ilan için daha önce şikayet gönderdiniz.');
        setDone(true);
        return;
      }

      setDoneType('created');
      setDoneMessage(data?.message || 'Ekibimiz ilanı inceleyecek ve gerekli işlemi yapacak.');
      setDone(true);
    } catch (e: unknown) {
      const message = extractErrorMessage(e);
      setErr('Şikayet gönderilemedi: ' + message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
          aria-label="Kapat"
        >
          <i className="ri-close-line" />
        </button>

        {done ? (
          <div className="text-center py-6">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              doneType === 'duplicate' ? 'bg-amber-100' : 'bg-green-100'
            }`}>
              <i className={`text-3xl ${doneType === 'duplicate' ? 'ri-information-line text-amber-600' : 'ri-check-line text-green-600'}`} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {doneType === 'duplicate' ? 'Bu İlanı Zaten Şikayet Ettiniz' : 'Şikayetiniz Alındı'}
            </h3>
            <p className="text-gray-500 text-sm">
              {doneMessage || 'Ekibimiz ilanı inceleyecek ve gerekli işlemi yapacak. Bildiriminiz için teşekkür ederiz.'}
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              Kapat
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-flag-2-line text-red-600 text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">İlanı Şikayet Et</h3>
                <p className="text-xs text-gray-400 truncate max-w-[240px]">{listingTitle}</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Şikayet sebebinizi seçin. Her şikayet ekibimiz tarafından incelenir ve herhangi bir aksiyon almadan önce değerlendirilir.
            </p>

            <div className="space-y-2 mb-4">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center space-x-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    reason === r
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="report_reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-red-500"
                  />
                  <span className="text-sm text-gray-700">{r}</span>
                </label>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 500))}
              placeholder="Ek detay (isteğe bağlı, max 500 karakter)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 mb-2"
            />
            <p className="text-xs text-gray-400 text-right mb-4">{details.length}/500</p>

            {err && <p className="text-sm text-red-500 mb-3">{err}</p>}

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <i className="ri-flag-2-line" />
                )}
                <span>{submitting ? 'Gönderiliyor...' : 'Şikayet Et'}</span>
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

interface ListingDetail {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  location: string;
  images: string[];
  is_premium: boolean;
  premium_badge?: string | null;
  views: number;
  created_at: string;
  user_name: string;
  user_phone: string;
  phone_visibility: 'public' | 'hidden';
  name_visibility: 'public' | 'hidden';
}

const upsertMetaTag = (selector: string, attrs: Record<string, string>) => {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([k, v]) => element?.setAttribute(k, v));
};

const upsertCanonical = (href: string) => {
  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
};

export default function ListingDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string; slug?: string }>();
  const { user, customUser } = useAuthStore();
  const [showReport, setShowReport] = useState(false);
  const [showContactOptions, setShowContactOptions] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactPath, setContactPath] = useState('');
  const [contactOwnerPhone, setContactOwnerPhone] = useState('');
  const [contactPhoneVisibility, setContactPhoneVisibility] = useState<'public' | 'hidden'>('hidden');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const exampleUi = getExampleListingBadgeUI();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchListing = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
        const bucketBase = supabaseUrl
          ? `${supabaseUrl}/storage/v1/object/public/product-images`
          : '';

        const toAbsoluteUrl = (value: string) => {
          if (/^https?:\/\//i.test(value)) {
            return value;
          }
          if (!bucketBase) {
            return value;
          }
          const sanitized = value.replace(/^\/+/, '');
          return `${bucketBase}/${sanitized}`;
        };

        const resolveImageUrl = (entry: unknown): string | null => {
          if (!entry) {
            return null;
          }
          if (typeof entry === 'string') {
            const trimmed = entry.trim();
            return trimmed ? toAbsoluteUrl(trimmed) : null;
          }
          if (typeof entry === 'object') {
            const typed = entry as {
              image_url?: string;
              public_url?: string;
              url?: string;
              path?: string;
            };
            const candidate = typed.image_url || typed.public_url || typed.url || typed.path;
            if (candidate && typeof candidate === 'string' && candidate.trim()) {
              return toAbsoluteUrl(candidate.trim());
            }
          }
          return null;
        };

        let imageUrls: string[] = [];
        if (Array.isArray(data.images) && data.images.length > 0) {
          imageUrls = data.images
            .map(resolveImageUrl)
            .filter((url): url is string => Boolean(url));
        }

        if (imageUrls.length === 0 && data.image_url) {
          const fallback = resolveImageUrl(data.image_url);
          if (fallback) {
            imageUrls = [fallback];
          }
        }

        if (imageUrls.length === 0) {
          imageUrls = [
            'https://readdy.ai/api/search-image?query=product%20placeholder%20simple%20clean%20background&width=800&height=600&seq=placeholder&orientation=landscape',
          ];
        }

        console.log('📸 Resim URL\'leri:', imageUrls);

        setListing({
          id: data.id,
          user_id: data.user_id,
          title: data.title,
          description: data.description || '',
          price: data.price,
          category: data.category,
          condition: data.condition,
          location: data.location,
          images: imageUrls,
          is_premium: data.is_premium || false,
          premium_badge: (data as any).premium_badge ?? null,
          views: data.view_count || 0,
          created_at: data.created_at,
          user_name: data.user_name || 'Satıcı',
          user_phone: data.user_phone || '',
          phone_visibility: ((data as any).phone_visibility || 'public') as 'public' | 'hidden',
          name_visibility: ((data as any).name_visibility || 'public') as 'public' | 'hidden',
        });

        // Increment views
        await supabase.rpc('increment_listing_views', { listing_id: id });
      }
    } catch (error) {
      console.error('Error fetching listing:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      void fetchListing();
    }
  }, [id, fetchListing]);

  useEffect(() => {
    const listingPath = listing
      ? buildListingPath(id || '', listing.title)
      : buildListingPath(id || '');
    const canonical = buildCanonicalUrl(listingPath);

    if (!loading && !listing) {
      document.title = 'İlan Bulunamadı - PazarGlobal';
      upsertMetaTag('meta[name="robots"]', { name: 'robots', content: 'noindex,follow' });
      upsertCanonical(canonical);
      const oldScript = document.getElementById('pg-listing-jsonld');
      if (oldScript) oldScript.remove();
      return;
    }

    if (!listing) return;

    const safeTitle = `${listing.title} | ${Number(listing.price || 0).toLocaleString('tr-TR')} TL - PazarGlobal`;
    const descriptionRaw = (listing.description || '').trim();
    const safeDescription = (descriptionRaw || `${listing.category} kategorisinde ilan detayı.`).slice(0, 160);
    const primaryImage = listing.images?.[0] || `${PREFERRED_ORIGIN}/logo.png`;

    document.title = safeTitle;
    upsertMetaTag('meta[name="description"]', { name: 'description', content: safeDescription });
    upsertMetaTag('meta[name="robots"]', { name: 'robots', content: 'index,follow,max-image-preview:large' });
    upsertMetaTag('meta[property="og:title"]', { property: 'og:title', content: safeTitle });
    upsertMetaTag('meta[property="og:description"]', { property: 'og:description', content: safeDescription });
    upsertMetaTag('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMetaTag('meta[property="og:type"]', { property: 'og:type', content: 'product' });
    upsertMetaTag('meta[property="og:image"]', { property: 'og:image', content: primaryImage });
    upsertMetaTag('meta[name="twitter:title"]', { name: 'twitter:title', content: safeTitle });
    upsertMetaTag('meta[name="twitter:description"]', { name: 'twitter:description', content: safeDescription });
    upsertMetaTag('meta[name="twitter:image"]', { name: 'twitter:image', content: primaryImage });
    upsertCanonical(canonical);

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: listing.title,
      description: descriptionRaw,
      image: listing.images,
      category: listing.category,
      brand: {
        '@type': 'Brand',
        name: 'PazarGlobal',
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'TRY',
        price: Number(listing.price || 0),
        availability: 'https://schema.org/InStock',
        url: canonical,
      },
    };

    let script = document.getElementById('pg-listing-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'pg-listing-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      const existing = document.getElementById('pg-listing-jsonld');
      if (existing) existing.remove();
    };
  }, [id, listing, loading]);

  const formatDate = (date: string) => {
    const itemDate = new Date(date);
    return itemDate.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleWhatsAppContact = () => {
    if (!viewerUserId) {
      setShowContactOptions(false);
      navigate('/auth/login');
      return;
    }

    if (contactPhoneVisibility !== 'hidden' && contactOwnerPhone) {
      setShowContactOptions(false);
      const message = encodeURIComponent(`Merhaba, "${listing?.title || 'ilan'}" ilanınız hakkında bilgi almak istiyorum.`);
      window.open(`https://wa.me/${contactOwnerPhone.replace(/\D/g, '')}?text=${message}`, '_blank');
    }
  };

  const handleContactMessage = async () => {
    if (!listing?.id || contactLoading || isOwnedByViewer(viewerUserId, listing.user_id)) return;
    const fallbackPath = `/contact/listing/${encodeURIComponent(listing.id)}`;

    setContactPath(fallbackPath);
    setContactOwnerPhone(String(listing.user_phone || '').trim());
    setContactPhoneVisibility(listing.phone_visibility === 'public' ? 'public' : 'hidden');
    setShowContactOptions(true);

    try {
      setContactLoading(true);
      const res = await fetchPublicContactLink(listing.id);
      const path = res?.data?.contact_path;
      const token = res?.data?.token;

      if (path) {
        setContactPath(path);
      }

      if (token) {
        let ownerPhone = String(listing.user_phone || '').trim();
        let phoneVisibility: 'public' | 'hidden' = listing.phone_visibility === 'public' ? 'public' : 'hidden';

        try {
          const resolved = await resolveContactToken(token);
          ownerPhone = String(resolved?.data?.listing?.owner_phone || ownerPhone || '').trim();
          const resolvedVisibility = String(resolved?.data?.listing?.phone_visibility || phoneVisibility).trim().toLowerCase();
          phoneVisibility = resolvedVisibility === 'public' ? 'public' : 'hidden';
        } catch {
          // Keep listing-level fallback values when resolve call fails.
        }

        setContactOwnerPhone(ownerPhone);
        setContactPhoneVisibility(phoneVisibility);
      }
    } catch {
      // Fail-safe: modal remains open with internal messaging fallback path.
    } finally {
      setContactLoading(false);
    }
  };

  const handleInternalMessageContact = async () => {
    if (!listing?.id || contactLoading || isOwnedByViewer(viewerUserId, listing.user_id)) return;
    try {
      setContactLoading(true);
      setShowContactOptions(false);
      navigate(contactPath || `/contact/listing/${encodeURIComponent(listing.id)}`);
    } catch {
      alert('Mesaj bağlantısı oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setContactLoading(false);
    }
  };

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <TopNavigation isScrolled={isScrolled} />
        <div className="pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">İlan yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
        <TopNavigation isScrolled={isScrolled} />
        <div className="pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <i className="ri-error-warning-line text-6xl text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">İlan Bulunamadı</h3>
            <p className="text-gray-500">Aradığınız ilan mevcut değil veya kaldırılmış olabilir.</p>
          </div>
        </div>
      </div>
    );
  }

  const viewerUserId = resolveViewerUserId({ userId: user?.id, customUserId: customUser?.id });
  const isExampleListing = isExampleListingOwner(listing.user_id);
  const isOwnListing = isOwnedByViewer(viewerUserId, listing.user_id);
  const needsLoginForWhatsApp = !viewerUserId;
  const canContactViaWhatsApp = !isOwnListing && !needsLoginForWhatsApp && contactPhoneVisibility !== 'hidden' && Boolean(contactOwnerPhone);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <TopNavigation isScrolled={isScrolled} />

      <div className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Image Gallery */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              {/* Main Image */}
              <div className="relative h-96 lg:h-[500px] rounded-2xl overflow-hidden bg-white shadow-lg">
                <img
                  src={listing.images[currentImageIndex] || 'https://readdy.ai/api/search-image?query=product%20placeholder%20simple%20clean%20background&width=800&height=600&seq=placeholder&orientation=landscape'}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
                {isExampleListing ? (
                  <div className={`absolute top-4 left-4 px-4 py-2 ${exampleUi.solidClassName} text-sm font-bold rounded-full flex items-center space-x-2 shadow-lg`}>
                    <i className={exampleUi.icon} />
                    <span>{exampleUi.label}</span>
                  </div>
                ) : null}
                {listing.is_premium && (
                  (() => {
                    const ui = getPremiumBadgeUI(listing.premium_badge);
                    return (
                      <div className={`absolute top-4 right-4 px-4 py-2 ${ui.className} text-white text-sm font-bold rounded-full flex items-center space-x-2`}>
                        <i className={ui.icon} />
                        <span>{ui.label}</span>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Thumbnail Gallery */}
              {listing.images.length > 1 && (
                <div className="grid grid-cols-4 gap-3">
                  {listing.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => handleImageClick(index)}
                      className={`relative h-24 rounded-lg overflow-hidden cursor-pointer transition-all ${
                        currentImageIndex === index
                          ? 'ring-4 ring-primary-500 scale-105'
                          : 'hover:scale-105 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`${listing.title} - ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Listing Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Title & Price */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className="mr-3 mt-1 flex flex-shrink-0 flex-wrap gap-2">
                    {listing.is_premium ? (
                      (() => {
                        const ui = getPremiumBadgeUI(listing.premium_badge);
                        return (
                          <div className={`inline-flex items-center space-x-2 px-4 py-2 ${ui.className} text-white text-sm font-bold rounded-full`}>
                            <i className={ui.icon} />
                            <span>{ui.label}</span>
                          </div>
                        );
                      })()
                    ) : null}
                    {isExampleListing ? (
                      <div className={`inline-flex items-center space-x-2 px-4 py-2 ${exampleUi.softClassName} text-sm font-semibold rounded-full`}>
                        <i className={exampleUi.icon} />
                        <span>{exampleUi.label}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {listing.title}
                    </h1>
                    {isExampleListing ? (
                      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                        {exampleUi.note}
                      </p>
                    ) : null}
                    <div className="mt-2 text-sm text-gray-500 flex items-center space-x-2">
                      <i className="ri-hashtag" />
                      <span title={listing.id}>İlan ID: {listing.id}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    {listing.price.toLocaleString('tr-TR')} ₺
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <i className="ri-eye-line" />
                    <span>{listing.views} görüntülenme</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mb-6">
                  <span className="px-4 py-2 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                    {listing.category}
                  </span>
                  <span className="px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    {toCanonicalCondition(listing.condition) || listing.condition}
                  </span>
                  <span className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-full flex items-center space-x-1">
                    <i className="ri-map-pin-line" />
                    <span>{listing.location}</span>
                  </span>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">İlan Tarihi</p>
                  <p className="text-gray-900 font-medium">{formatDate(listing.created_at)}</p>
                </div>
              </div>

              {/* Description */}
              {listing.description && (
                <div className="bg-white rounded-2xl p-6 shadow-lg">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Açıklama</h2>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {listing.description}
                  </p>
                </div>
              )}

              {/* Seller Info */}
              <div className="bg-white rounded-2xl p-6 shadow-lg">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Satıcı Bilgileri</h2>
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {(listing.name_visibility === 'hidden' ? 'İ' : listing.user_name).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {listing.name_visibility === 'hidden' ? 'İlan Sahibi' : listing.user_name}
                    </p>
                    <p className="text-sm text-gray-500">Satıcı</p>
                  </div>
                </div>

                <button
                  onClick={() => void handleContactMessage()}
                  disabled={contactLoading || isOwnListing}
                  className={`w-full py-4 font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 whitespace-nowrap mb-2 ${
                    isOwnListing
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-primary text-white hover:shadow-lg cursor-pointer'
                  } disabled:opacity-60`}
                >
                  <i className="ri-message-3-line text-xl" />
                  <span>{isOwnListing ? 'Sizin ilanınız' : contactLoading ? 'Bağlantı hazırlanıyor...' : 'İlan Sahibine Mesaj Gönder'}</span>
                </button>

                <button
                  onClick={() => setShowReport(true)}
                  className="w-full py-3 border border-red-200 text-red-500 hover:bg-red-50 font-medium rounded-xl transition-colors flex items-center justify-center space-x-2 mt-2 text-sm"
                >
                  <i className="ri-flag-2-line" />
                  <span>İlanı Şikayet Et</span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showContactOptions && !isOwnListing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setShowContactOptions(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">İletişim Seçenekleri</h3>
                <p className="mt-1 text-sm text-gray-500">İlan sahibiyle nasıl iletişime geçmek istediğinizi seçin.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => void handleInternalMessageContact()}
                  className="w-full rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4 text-left transition-colors hover:bg-teal-100"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white">
                      <i className="ri-message-3-line text-xl" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Site içi mesajlaşma</p>
                      <p className="text-sm text-gray-600">Mesajınız ilan sahibinin mesaj kutusuna düşer.</p>
                    </div>
                  </div>
                </button>

                {canContactViaWhatsApp ? (
                  <button
                    onClick={handleWhatsAppContact}
                    className="w-full rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-left transition-colors hover:bg-green-100"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-white">
                        <i className="ri-whatsapp-line text-xl" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">WhatsApp ile mesaj gönder</p>
                        <p className="text-sm text-gray-600">Satıcının görünür telefon numarasına WhatsApp açılır.</p>
                      </div>
                    </div>
                  </button>
                ) : (
                  needsLoginForWhatsApp ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-800">
                      WhatsApp ile iletişim için önce giriş yapmanız gerekiyor.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                      Satıcı telefonunu gizlediği için yalnızca site içi mesajlaşma kullanılabilir.
                    </div>
                  )
                )}
              </div>

              <button
                onClick={() => setShowContactOptions(false)}
                className="mt-4 w-full rounded-2xl bg-gray-100 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                Vazgeç
              </button>
            </motion.div>
          </motion.div>
        )}

        {showReport && (
          <ReportModal
            listingId={listing.id}
            listingTitle={listing.title}
            onClose={() => setShowReport(false)}
          />
        )}
      </AnimatePresence>

      <Footer />
      <ChatBox />
    </div>
  );
}
