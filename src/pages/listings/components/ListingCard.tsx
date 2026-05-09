import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Listing } from '../../../types/listing';
import { toCanonicalCondition } from '../../../lib/condition';
import { getPremiumBadgeUI } from '../../../lib/premiumBadge';
import { getExampleListingBadgeUI, isExampleListingOwner } from '../../../lib/exampleListing';
import { isOwnedByViewer, resolveViewerUserId } from '../../../lib/listingOwnership';
import { fetchPublicContactLink, resolveContactToken } from '../../../services/agentApi';
import { buildListingPath } from '../../../lib/seo';
import { useAuthStore } from '../../../stores/authStore';

interface ListingCardProps {
  listing: Listing;
  viewMode: 'grid' | 'list';
  index: number;
}

type MagnifierImageProps = {
  src: string;
  alt: string;
  containerClassName?: string;
  imageClassName?: string;
  zoom?: number;
};

function MagnifierImage({
  src,
  alt,
  containerClassName = '',
  imageClassName = '',
  zoom = 1.8,
}: MagnifierImageProps) {
  const lensPx = 140;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [lensVisible, setLensVisible] = useState(false);
  const lensRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!lensVisible || !lensRef.current || !containerRef.current || !imageRef.current) return;
    const img = imageRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const imgWidth = img.naturalWidth || rect.width;
    const imgHeight = img.naturalHeight || rect.height;
    
    lensRef.current.style.backgroundImage = `url(${src})`;
    lensRef.current.style.backgroundRepeat = 'no-repeat';
    lensRef.current.style.backgroundSize = `${imgWidth * zoom}px ${imgHeight * zoom}px`;
  }, [lensVisible, src, zoom]);

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const clampedX = Math.max(0, Math.min(x, rect.width));
    const clampedY = Math.max(0, Math.min(y, rect.height));
    const percentX = (clampedX / rect.width) * 100;
    const percentY = (clampedY / rect.height) * 100;

    if (lensRef.current) {
      lensRef.current.style.left = `${clampedX - lensPx / 2}px`;
      lensRef.current.style.top = `${clampedY - lensPx / 2}px`;
      lensRef.current.style.backgroundPosition = `${percentX}% ${percentY}%`;
    }
    if (!lensVisible) setLensVisible(true);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden cursor-zoom-in ${containerClassName}`}
      onMouseEnter={() => setLensVisible(true)}
      onMouseLeave={() => setLensVisible(false)}
      onMouseMove={handleMove}
    >
      <img ref={imageRef} src={src} alt={alt} className={imageClassName} />
      {lensVisible && (
        <div
          ref={lensRef}
          className="pointer-events-none absolute rounded-full border-2 border-white/90 shadow-2xl w-36 h-36"
          data-lens
        />
      )}
    </div>
  );
}

export default function ListingCard({ listing, viewMode, index }: ListingCardProps) {
  const navigate = useNavigate();
  const { user, customUser } = useAuthStore();

  const premiumUi = getPremiumBadgeUI(listing.premiumBadge);
  const exampleUi = getExampleListingBadgeUI();
  const isExampleListing = isExampleListingOwner(listing.userId);
  const viewerUserId = resolveViewerUserId({ userId: user?.id, customUserId: customUser?.id });
  const isOwnListing = isOwnedByViewer(viewerUserId, listing.userId);
  const listingPath = buildListingPath(listing.id, listing.title);
  const fallbackContactPath = `/contact/listing/${encodeURIComponent(listing.id)}`;
  const [contactOptionsOpen, setContactOptionsOpen] = useState(false);
  const [contactPreparing, setContactPreparing] = useState(false);
  const [contactPath, setContactPath] = useState('');
  const [contactOwnerPhone, setContactOwnerPhone] = useState('');
  const [contactPhoneVisibility, setContactPhoneVisibility] = useState<'public' | 'hidden'>('hidden');

  const formatDate = (date: string) => {
    const now = new Date();
    const itemDate = new Date(date);
    const diffMs = now.getTime() - itemDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return itemDate.toLocaleDateString('tr-TR');
  };

  const handleClick = () => {
    navigate(listingPath);
  };

  const handleContactClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isOwnListing || contactPreparing) return;

    setContactPath(fallbackContactPath);
    setContactOwnerPhone('');
    setContactPhoneVisibility('hidden');
    setContactOptionsOpen(true);

    try {
      setContactPreparing(true);
      const res = await fetchPublicContactLink(listing.id);
      const path = res?.data?.contact_path;
      const token = res?.data?.token;

      if (path) {
        setContactPath(path);
      }

      if (token) {
        let ownerPhone = '';
        let phoneVisibility: 'public' | 'hidden' = 'hidden';
        try {
          const resolved = await resolveContactToken(token);
          ownerPhone = String(resolved?.data?.listing?.owner_phone || '').trim();
          const visibility = String(resolved?.data?.listing?.phone_visibility || 'hidden').trim().toLowerCase();
          phoneVisibility = visibility === 'public' ? 'public' : 'hidden';
        } catch {
          ownerPhone = '';
          phoneVisibility = 'hidden';
        }

        setContactOwnerPhone(ownerPhone);
        setContactPhoneVisibility(phoneVisibility);
      }
    } catch {
      // Fail-safe: modal stays open with internal messaging path.
    } finally {
      setContactPreparing(false);
    }
  };

  const handleInternalMessageOption = () => {
    setContactOptionsOpen(false);
    navigate(contactPath || fallbackContactPath);
  };

  const handleWhatsAppOption = () => {
    if (!viewerUserId) {
      setContactOptionsOpen(false);
      navigate('/auth/login');
      return;
    }
    if (contactPhoneVisibility === 'hidden' || !contactOwnerPhone) return;
    const message = encodeURIComponent(`Merhaba, "${listing.title}" ilanınız hakkında bilgi almak istiyorum.`);
    setContactOptionsOpen(false);
    window.open(`https://wa.me/${contactOwnerPhone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const needsLoginForWhatsApp = !viewerUserId;
  const canContactViaWhatsApp = !needsLoginForWhatsApp && contactPhoneVisibility !== 'hidden' && Boolean(contactOwnerPhone);

  const contactOptionsModal = (
    <AnimatePresence>
      {contactOptionsOpen && !isOwnListing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setContactOptionsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900">İletişim Seçenekleri</h3>
              <p className="mt-1 text-sm text-gray-500">İlan sahibiyle nasıl iletişime geçmek istediğinizi seçin.</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleInternalMessageOption}
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
                  onClick={handleWhatsAppOption}
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
              onClick={() => setContactOptionsOpen(false)}
              className="mt-4 w-full rounded-2xl bg-gray-100 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              Vazgeç
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (viewMode === 'list') {
    return (
      <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={handleClick}
        className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden cursor-pointer group"
      >
        <div className="flex">
          <div className="relative w-64 h-48 flex-shrink-0">
            <MagnifierImage
              src={listing.image}
              alt={listing.title}
              containerClassName="w-64 h-48 bg-gray-50"
              imageClassName="w-full h-full object-contain"
            />
            {listing.isPremium && (
              <div className={`absolute top-3 left-3 px-3 py-1 ${premiumUi.className} text-white text-xs font-bold rounded-full flex items-center space-x-1`}>
                <i className={premiumUi.icon} />
                <span>{premiumUi.label}</span>
              </div>
            )}
            {isExampleListing && (
              <div className={`absolute top-3 right-3 px-3 py-1 ${exampleUi.solidClassName} text-xs font-bold rounded-full flex items-center space-x-1 shadow-lg`}>
                <i className={exampleUi.icon} />
                <span>{exampleUi.label}</span>
              </div>
            )}
          </div>

          <div className="flex-1 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  {listing.isPremium ? (
                    <div className={`mb-2 inline-flex items-center space-x-1 px-3 py-1 ${premiumUi.className} text-white text-xs font-bold rounded-full`}>
                      <i className={premiumUi.icon} />
                      <span>{premiumUi.label}</span>
                    </div>
                  ) : null}
                  {isExampleListing ? (
                    <div className={`mb-2 ml-2 inline-flex items-center space-x-1 px-3 py-1 ${exampleUi.softClassName} text-xs font-semibold rounded-full`}>
                      <i className={exampleUi.icon} />
                      <span>{exampleUi.label}</span>
                    </div>
                  ) : null}
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                    <Link to={listingPath} className="hover:underline" onClick={(event) => event.stopPropagation()}>
                      {listing.title}
                    </Link>
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{listing.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    {listing.price.toLocaleString('tr-TR')} ₺
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                  {listing.category}
                </span>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  {toCanonicalCondition(listing.condition) || listing.condition}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <i className="ri-map-pin-line" />
                  <span>{listing.location}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <i className="ri-eye-line" />
                  <span>{listing.views}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <i className="ri-time-line" />
                <span>{formatDate(listing.createdAt)}</span>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={(event) => void handleContactClick(event)}
                disabled={isOwnListing || contactPreparing}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  isOwnListing || contactPreparing
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-primary text-white hover:shadow-md'
                }`}
              >
                {isOwnListing ? 'Sizin ilanınız' : contactPreparing ? 'Hazırlanıyor...' : 'İlan Sahibine Mesaj Gönder'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      {contactOptionsModal}
      </>
    );
  }

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden cursor-pointer group"
      data-product-shop
    >
      <div className="relative h-64">
        <MagnifierImage
          src={listing.image}
          alt={listing.title}
          containerClassName="h-64 bg-gray-50"
          imageClassName="w-full h-full object-cover"
        />
        {listing.isPremium && (
          <div className={`absolute top-3 right-3 px-3 py-1 ${premiumUi.className} text-white text-xs font-bold rounded-full flex items-center space-x-1`}>
            <i className={premiumUi.icon} />
            <span>{premiumUi.label}</span>
          </div>
        )}
        {isExampleListing && (
          <div className={`absolute top-3 left-3 px-3 py-1 ${exampleUi.solidClassName} text-xs font-bold rounded-full flex items-center space-x-1 shadow-lg`}>
            <i className={exampleUi.icon} />
            <span>{exampleUi.label}</span>
          </div>
        )}
        <div className="absolute bottom-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-700">
          {listing.category}
        </div>
      </div>

      <div className="p-5">
        {listing.isPremium ? (
          <div className={`mb-2 inline-flex items-center space-x-1 px-3 py-1 ${premiumUi.className} text-white text-xs font-bold rounded-full`}>
            <i className={premiumUi.icon} />
            <span>{premiumUi.label}</span>
          </div>
        ) : null}
        {isExampleListing ? (
          <div className={`mb-2 ml-2 inline-flex items-center space-x-1 px-3 py-1 ${exampleUi.softClassName} text-xs font-semibold rounded-full`}>
            <i className={exampleUi.icon} />
            <span>{exampleUi.label}</span>
          </div>
        ) : null}
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
          <Link to={listingPath} className="hover:underline" onClick={(event) => event.stopPropagation()}>
            {listing.title}
          </Link>
        </h3>
        
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{listing.description}</p>

        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {listing.price.toLocaleString('tr-TR')} ₺
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            {toCanonicalCondition(listing.condition) || listing.condition}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-1">
            <i className="ri-map-pin-line" />
            <span>{listing.location}</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <i className="ri-eye-line" />
              <span>{listing.views}</span>
            </div>
            <span>{formatDate(listing.createdAt)}</span>
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={(event) => void handleContactClick(event)}
            disabled={isOwnListing || contactPreparing}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              isOwnListing || contactPreparing
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-primary text-white hover:shadow-md'
            }`}
          >
            {isOwnListing ? 'Sizin ilanınız' : contactPreparing ? 'Hazırlanıyor...' : 'Mesaj Gönder'}
          </button>
        </div>
      </div>
    </motion.div>
    {contactOptionsModal}
    </>
  );
}
