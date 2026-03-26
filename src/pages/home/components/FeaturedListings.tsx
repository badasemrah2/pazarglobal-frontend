import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchListings, type DBListing } from '../../../services/supabase';
import { supabase } from '../../../lib/supabase';
import { buildListingPath } from '../../../lib/seo';

type FeaturedItem = {
  id: string;
  title: string;
  price: number;
  category: string;
  location: string;
  image: string;
  path: string;
};

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

export default function FeaturedListings() {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const rows = await fetchListings();
        const mapped = rows
          .filter((row) => Boolean(row.id) && Boolean(row.title))
          .slice(0, 6)
          .map((row: DBListing) => ({
            id: row.id,
            title: row.title,
            price: row.price,
            category: row.category,
            location: row.location || 'Türkiye',
            image:
              resolveImageUrl(row.images?.[0]) ||
              resolveImageUrl(row.image_url) ||
              'https://via.placeholder.com/400x300',
            path: buildListingPath(row.id, row.title),
          }));

        setItems(mapped);
      } catch (error) {
        console.error('Featured listings loading failed:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const hasItems = useMemo(() => items.length > 0, [items.length]);

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Keşfet</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900">Öne Çıkan İlanlar</h2>
          </div>
          <Link to="/listings" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            Tüm ilanları gör
          </Link>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-72 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : hasItems ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, idx) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow"
              >
                <Link to={item.path} className="block" aria-label={item.title}>
                  <img src={item.image} alt={item.title} className="w-full h-44 object-cover" loading="lazy" />
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 line-clamp-2 min-h-[48px]">{item.title}</h3>
                    <p className="text-xs text-gray-500 mt-2">{item.category} • {item.location}</p>
                    <p className="mt-3 text-lg font-bold text-primary-700">{item.price.toLocaleString('tr-TR')} ₺</p>
                  </div>
                </Link>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-gray-100 p-8 text-center text-gray-600">
            Şu anda öne çıkan ilan bulunmuyor.
          </div>
        )}
      </div>
    </section>
  );
}
