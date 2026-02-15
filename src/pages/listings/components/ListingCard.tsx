import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Listing } from '../../../types/listing';
import { toCanonicalCondition } from '../../../lib/condition';
import { getPremiumBadgeUI } from '../../../lib/premiumBadge';

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

  const premiumUi = getPremiumBadgeUI(listing.premiumBadge);

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
    navigate(`/listing/${listing.id}`);
  };

  if (viewMode === 'list') {
    return (
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
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                    {listing.title}
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
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden cursor-pointer group"
      data-product-shop
    >
      <div className="relative h-56">
        <MagnifierImage
          src={listing.image}
          alt={listing.title}
          containerClassName="h-56 bg-gray-50"
          imageClassName="w-full h-full object-contain"
        />
        {listing.isPremium && (
          <div className={`absolute top-3 right-3 px-3 py-1 ${premiumUi.className} text-white text-xs font-bold rounded-full flex items-center space-x-1`}>
            <i className={premiumUi.icon} />
            <span>{premiumUi.label}</span>
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
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {listing.title}
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
      </div>
    </motion.div>
  );
}
