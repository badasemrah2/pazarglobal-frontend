import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL veya Anon Key bulunamadı!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helper fonksiyonları
export const authHelpers = {
  // Kayıt ol
  signUp: async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    return { data, error };
  },

  // Giriş yap
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Çıkış yap
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Mevcut kullanıcıyı al
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Şifre sıfırlama
  resetPassword: async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    return { data, error };
  },
};

// Listing helper fonksiyonları
export const listingHelpers = {
  // Tüm ilanları getir
  getAll: async (filters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    location?: string;
    condition?: string;
  }) => {
    let query = supabase
      .from('listings')
      .select(`
        *,
        profiles:user_id (
          full_name,
          display_name,
          rating,
          is_verified,
          avatar_url
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.minPrice) {
      query = query.gte('price', filters.minPrice);
    }
    if (filters?.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }
    if (filters?.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }
    if (filters?.condition) {
      query = query.eq('condition', filters.condition);
    }

    const { data, error } = await query;
    return { data, error };
  },

  // Tek bir ilan getir
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        profiles:user_id (
          full_name,
          display_name,
          rating,
          is_verified,
          avatar_url
        )
      `)
      .eq('id', id)
      .single();
    return { data, error };
  },

  // Kullanıcının ilanlarını getir
  getUserListings: async (userId: string) => {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // Yeni ilan oluştur
  create: async (listing: {
    title: string;
    description: string;
    price: number;
    category: string;
    condition: string;
    location: string;
    images: string[];
    is_premium?: boolean;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Kullanıcı girişi gerekli') };
    }

    const { data, error } = await supabase
      .from('listings')
      .insert({
        ...listing,
        user_id: user.id,
        status: 'active',
        view_count: 0,
      })
      .select()
      .single();
    return { data, error };
  },

  // İlan güncelle
  update: async (id: string, updates: Partial<{
    title: string;
    description: string;
    price: number;
    category: string;
    condition: string;
    location: string;
    images: string[];
    status: string;
  }>) => {
    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // İlan sil
  delete: async (id: string) => {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);
    return { error };
  },

  // Görüntülenme sayısını artır
  incrementViews: async (id: string) => {
    const { error } = await supabase.rpc('increment_view_count', { listing_id: id });
    return { error };
  },
};

// Favorite helper fonksiyonları
export const favoriteHelpers = {
  // Kullanıcının favorilerini getir
  getUserFavorites: async (userId: string) => {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        *,
        listings (
          *,
          profiles:user_id (
            full_name,
            display_name,
            rating,
            is_verified
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // Favorilere ekle
  add: async (listingId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Kullanıcı girişi gerekli') };
    }

    const { data, error } = await supabase
      .from('favorites')
      .insert({
        user_id: user.id,
        listing_id: listingId,
      })
      .select()
      .single();
    return { data, error };
  },

  // Favorilerden çıkar
  remove: async (listingId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: new Error('Kullanıcı girişi gerekli') };
    }

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', listingId);
    return { error };
  },

  // İlan favoride mi kontrol et
  isFavorite: async (listingId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { isFavorite: false };
    }

    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', listingId)
      .single();
    
    return { isFavorite: !error && !!data };
  },
};

// Profile helper fonksiyonları
export const profileHelpers = {
  // Profil getir
  get: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  // Profil güncelle
  update: async (userId: string, updates: Partial<{
    full_name: string;
    display_name: string;
    bio: string;
    location: string;
    phone: string;
    avatar_url: string;
  }>) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },
};
