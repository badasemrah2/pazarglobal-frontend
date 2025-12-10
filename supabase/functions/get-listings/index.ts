import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { category, search, limit = 20 } = await req.json();

    console.log('Get Listings Request:', { category, search, limit });

    // Supabase client oluştur
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query oluştur
    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Kategori filtresi
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    // Arama filtresi
    if (search && search.trim()) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: listings, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // ✅ Resim URL'lerini düzelt
    const listingsWithImages = listings?.map((listing: any) => {
      let imageUrls: string[] = [];
      
      if (listing.images && Array.isArray(listing.images) && listing.images.length > 0) {
        // images array'inden URL'ler oluştur
        imageUrls = listing.images.map((path: string) => 
          `${supabaseUrl}/storage/v1/object/public/product-images/${path}`
        );
      } else if (listing.image_url) {
        // Fallback: image_url kullan
        imageUrls = [listing.image_url];
      }

      return {
        ...listing,
        image_urls: imageUrls,
        primary_image: imageUrls[0] || listing.image_url
      };
    }) || [];

    console.log(`✅ ${listingsWithImages.length} ilan bulundu`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        listings: listingsWithImages,
        count: listingsWithImages.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Get Listings Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'İlanlar alınırken bir hata oluştu',
        listings: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
