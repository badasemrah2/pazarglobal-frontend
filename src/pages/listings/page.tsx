import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FilterSidebar from './components/FilterSidebar';
import ListingCard from './components/ListingCard';
import ChatBox from '../../components/feature/ChatBox';
import TopNavigation from '../../components/feature/TopNavigation';
import Footer from '../home/components/Footer';
import { fetchListingsWithFilters, type DBListing } from '../../services/supabase';
import { supabase } from '../../lib/supabase';
import type { Listing, FilterState } from '../../types/listing';

const normalizeForSearch = (value: unknown): string => {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');
};

// Resolve a Supabase storage path or direct URL to a public URL.
// Supports both string arrays and object-based image entries.
const resolveImageUrl = (entry?: unknown) => {
  if (!entry) return null;

  const extractCandidate = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    if (typeof value === 'object') {
      const typed = value as {
        image_url?: unknown;
        public_url?: unknown;
        url?: unknown;
        path?: unknown;
      };
      const candidate = typed.image_url ?? typed.public_url ?? typed.url ?? typed.path;
      return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
    }
    return null;
  };

  const candidate = extractCandidate(entry);
  if (!candidate) return null;
  if (/^https?:\/\//i.test(candidate)) return candidate;

  const { data } = supabase.storage.from('product-images').getPublicUrl(candidate);
  return data.publicUrl || null;
};

export default function ListingsPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Only use real data from Supabase
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [isLoadingFromSupabase, setIsLoadingFromSupabase] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    priceRange: [0, 100000000],
    location: '',
    condition: [],
    isPremium: false,
    dateRange: 'all',
    searchText: '',
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch from Supabase when filters change
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingFromSupabase(true);
      try {
        const data = await fetchListingsWithFilters(filters);

        // Convert Supabase data to frontend Listing type
        const convertedListings: Listing[] = data.map((item: DBListing) => ({
          id: item.id,
          userId: item.user_id,
          title: item.title,
          description: item.description,
          price: item.price,
          category: item.category,
          location: item.location,
          condition: item.condition,
          image:
            resolveImageUrl(item.images?.[0]) ||
            resolveImageUrl(item.image_url) ||
            'https://via.placeholder.com/400x300',
          images: item.images
            ?.map(img => resolveImageUrl(img))
            .filter((url): url is string => Boolean(url)),
          isPremium: item.is_premium || false,
          premiumBadge: (item as any).premium_badge ?? null,
          views: item.views,
          createdAt: item.created_at,
          seller: {
            name: 'Kullanıcı',
            rating: 4.5,
            verified: false,
          },
        }));

        // Apply client-side search filter
        let searchFiltered = convertedListings;
        if (filters.searchText.trim()) {
          const searchLower = normalizeForSearch(filters.searchText);
          searchFiltered = convertedListings.filter(item => 
            normalizeForSearch(item.title).includes(searchLower) ||
            normalizeForSearch(item.description).includes(searchLower) ||
            normalizeForSearch(item.category).includes(searchLower) ||
            normalizeForSearch(item.location).includes(searchLower)
          );
        }

        // Sort the listings
        const sortedListings = [...searchFiltered];

        const premiumFirst = (a: Listing, b: Listing) => {
          const ap = a.isPremium ? 1 : 0;
          const bp = b.isPremium ? 1 : 0;
          return bp - ap; // premium first
        };

        switch (sortBy) {
          case 'newest':
            sortedListings.sort((a, b) => {
              const p = premiumFirst(a, b);
              if (p !== 0) return p;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            break;
          case 'oldest':
            sortedListings.sort((a, b) => {
              const p = premiumFirst(a, b);
              if (p !== 0) return p;
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });
            break;
          case 'price-low':
            sortedListings.sort((a, b) => {
              const p = premiumFirst(a, b);
              if (p !== 0) return p;
              return a.price - b.price;
            });
            break;
          case 'price-high':
            sortedListings.sort((a, b) => {
              const p = premiumFirst(a, b);
              if (p !== 0) return p;
              return b.price - a.price;
            });
            break;
          case 'popular':
            sortedListings.sort((a, b) => {
              const p = premiumFirst(a, b);
              if (p !== 0) return p;
              return b.views - a.views;
            });
            break;
          default:
            sortedListings.sort((a, b) => {
              const p = premiumFirst(a, b);
              if (p !== 0) return p;
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            break;
        }

        setFilteredListings(sortedListings);
      } catch (error) {
        console.error('Failed to fetch from Supabase:', error);
        setFilteredListings([]);
      } finally {
        setIsLoadingFromSupabase(false);
      }
    };

    fetchData();
  }, [filters, sortBy]);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      categories: [],
      priceRange: [0, 100000000],
      location: '',
      condition: [],
      isPremium: false,
      dateRange: 'all',
      searchText: '',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <TopNavigation isScrolled={isScrolled} />

      <div className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-display font-bold mb-4">
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Tüm İlanlar
              </span>
            </h1>
            <p className="text-lg text-gray-600">
              {filteredListings.length} ilan bulundu
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-2xl">
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
              <input
                type="text"
                value={filters.searchText}
                onChange={(e) => handleFilterChange({ searchText: e.target.value })}
                placeholder="Başlık veya açıklamada ara..."
                className="w-full pl-12 pr-4 py-3.5 bg-white rounded-full shadow-md text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {filters.searchText && (
                <button
                  onClick={() => handleFilterChange({ searchText: '' })}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  aria-label="Aramayı temizle"
                >
                  <i className="ri-close-circle-fill text-xl" />
                </button>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 px-5 py-2.5 bg-white rounded-full shadow-md hover:shadow-lg transition-all whitespace-nowrap cursor-pointer"
              >
                <i className="ri-filter-3-line text-lg" />
                <span className="text-sm font-medium">Filtreler</span>
                {(filters.categories.length > 0 || filters.condition.length > 0 || filters.isPremium) && (
                  <span className="w-5 h-5 bg-gradient-primary text-white text-xs rounded-full flex items-center justify-center">
                    {filters.categories.length + filters.condition.length + (filters.isPremium ? 1 : 0)}
                  </span>
                )}
              </button>

              {(filters.categories.length > 0 || filters.condition.length > 0 || filters.isPremium || filters.location || filters.searchText) && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-600 hover:text-red-600 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Filtreleri Temizle
                </button>
              )}
            </div>

            <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-3">
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2.5 bg-white rounded-full shadow-md text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="İlanları sırala"
              >
                <option value="newest">En Yeni</option>
                <option value="oldest">En Eski</option>
                <option value="price-low">Fiyat: Düşükten Yükseğe</option>
                <option value="price-high">Fiyat: Yüksekten Düşüğe</option>
                <option value="popular">En Popüler</option>
              </select>

              {/* View Mode */}
              <div className="flex items-center bg-white rounded-full shadow-md p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  aria-label="Izgara görünümü"
                >
                  <i className="ri-grid-line text-lg" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${viewMode === 'list' ? 'bg-gradient-primary text-white' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  aria-label="Liste görünümü"
                >
                  <i className="ri-list-check text-lg" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Filter Sidebar */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="w-full lg:w-80 lg:flex-shrink-0"
                >
                  <FilterSidebar filters={filters} onFilterChange={handleFilterChange} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Listings Grid/List */}
            <div className="flex-1">
              {isLoadingFromSupabase ? (
                <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                  {Array.from({ length: viewMode === 'grid' ? 6 : 4 }).map((_, index) => (
                    <div key={index} className="bg-white rounded-2xl shadow-md overflow-hidden animate-pulse">
                      <div className={viewMode === 'grid' ? 'h-64 bg-gray-100' : 'h-48 bg-gray-100'} />
                      <div className="p-5 space-y-3">
                        <div className="h-5 bg-gray-100 rounded w-2/3" />
                        <div className="h-4 bg-gray-100 rounded w-full" />
                        <div className="h-4 bg-gray-100 rounded w-4/5" />
                        <div className="h-6 bg-gray-100 rounded w-1/3 mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="text-center py-20">
                  <i className="ri-inbox-line text-6xl text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">İlan Bulunamadı</h3>
                  <p className="text-gray-500">Filtrelerinizi değiştirmeyi deneyin</p>
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6'
                      : 'space-y-4'
                  }
                >
                  {filteredListings.map((listing, index) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      viewMode={viewMode}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
      {/* AI Chat Panel */}
      <ChatBox />
    </div>
  );
}
