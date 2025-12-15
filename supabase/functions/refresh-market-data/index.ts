import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * 🔄 BACKGROUND REFRESH SCHEDULER
 * 
 * Bu edge function cron job olarak çalışır:
 * - Bayat cache kayıtlarını günceller
 * - Popüler ürünleri önceliklendirir
 * - Maliyeti optimize eder
 * 
 * Çalışma: Günde 1 kez (her gece 03:00)
 * Supabase Cron: 0 3 * * *
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketSnapshot {
  product_key: string;
  query_count: number;
  category: string;
  title: string;
  condition: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Background Refresh başlıyor...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1️⃣ Bayat kayıtları bul (expires_at geçmiş)
    const { data: expiredItems, error: fetchError } = await supabase
      .from('market_price_snapshots')
      .select('*')
      .lt('expires_at', new Date().toISOString())
      .order('query_count', { ascending: false })
      .limit(50); // En fazla 50 kayıt

    if (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    console.log(`📊 ${expiredItems?.length || 0} bayat kayıt bulundu`);

    if (!expiredItems || expiredItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Güncellenecek kayıt yok',
          refreshed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2️⃣ Popüler ürünleri önceliklendir (query_count > 5)
    const priorityItems = expiredItems.filter((item: MarketSnapshot) => item.query_count > 5);
    const regularItems = expiredItems.filter((item: MarketSnapshot) => item.query_count <= 5);

    console.log(`⭐ ${priorityItems.length} öncelikli ürün`);
    console.log(`📦 ${regularItems.length} normal ürün`);

    // 3️⃣ Güncelleme yap (önce popüler olanlar)
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY bulunamadı');
    }

    let refreshedCount = 0;
    let errorCount = 0;
    const maxRefresh = 20; // Günde max 20 API çağrısı ($0.24)

    const itemsToRefresh = [...priorityItems, ...regularItems].slice(0, maxRefresh);

    for (const item of itemsToRefresh) {
      try {
        console.log(`🔄 Güncelleniyor: ${item.original_title}`);

        // Perplexity çağır
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              {
                role: 'system',
                content: 'Sen bir fiyat araştırma uzmanısın. SADECE sayısal fiyat aralığı ver.'
              },
              {
                role: 'user',
                content: `"${item.original_title}" için Türkiye'de güncel satış fiyatları?

KURALLAR:
- Format: XXXXXX-YYYYYY
- Sadece rakam ve tire

Örnek: 25000-35000`
              }
            ],
            temperature: 0.1,
            max_tokens: 150,
            search_mode: 'web',
            web_search_options: { search_context_size: 'high' },
            search_domain_filter: [
              'sahibinden.com',
              'arabam.com',
              'letgo.com',
              'hepsiburada.com',
              'trendyol.com'
            ],
            search_recency_filter: 'week'
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const priceText = data.choices[0]?.message?.content?.trim() || '';
        const searchResults = data.search_results || [];

        // Parse
        const cleanText = priceText.replace(/TL|₺|lira|try/gi, '').replace(/[.,]/g, '').trim();
        const rangeMatch = cleanText.match(/(\d{4,})\s*[-–—]\s*(\d{4,})/);

        if (rangeMatch) {
          const minPrice = parseInt(rangeMatch[1]);
          const maxPrice = parseInt(rangeMatch[2]);
          const avgPrice = (minPrice + maxPrice) / 2;

          // Kaynakları parse et
          interface SearchResult {
            url?: string;
            date?: string;
          }
          const sources = searchResults.map((r: SearchResult) => ({
            name: r.url?.includes('sahibinden') ? 'Sahibinden' :
                  r.url?.includes('hepsiburada') ? 'Hepsiburada' :
                  r.url?.includes('trendyol') ? 'Trendyol' :
                  r.url?.includes('arabam') ? 'Arabam' : 'Web',
            url: r.url,
            date: r.date
          }));

          // Confidence hesapla
          const priceRange = maxPrice - minPrice;
          const priceRangeRatio = priceRange / avgPrice;
          const sourceScore = Math.min(searchResults.length / 10, 1.0) * 0.4;
          const freshnessScore = 1.0 * 0.3;
          const consistencyScore = Math.max(0, 1 - priceRangeRatio) * 0.3;
          const confidence = sourceScore + freshnessScore + consistencyScore;

          // TTL hesapla
          const ttlMap: Record<string, number> = {
            'Elektronik': 7,
            'Otomotiv': 14,
            'Emlak': 30,
            'Moda & Aksesuar': 7,
            'Ev & Yaşam': 14,
            'Spor & Outdoor': 14,
            'Kitap & Hobi': 30,
            'Mobilya': 21,
            'Diğer': 14
          };
          const ttlDays = ttlMap[item.category] || 14;

          const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

          // Güncelle
          const { error: updateError } = await supabase
            .from('market_price_snapshots')
            .update({
              min_price: minPrice,
              max_price: maxPrice,
              avg_price: avgPrice,
              sources: sources,
              confidence: confidence,
              last_updated_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              raw_data: data
            })
            .eq('product_key', item.product_key);

          if (updateError) {
            throw updateError;
          }

          refreshedCount++;
          console.log(`✅ Güncellendi: ${item.product_key}`);
        } else {
          console.log(`⚠️ Fiyat parse edilemedi: ${item.product_key}`);
          errorCount++;
        }

        // Rate limit: 1 saniye bekle
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Hata (${item.product_key}):`, errorMessage);
        errorCount++;
      }
    }

    // 4️⃣ Eski bayat kayıtları sil (30 günden eski ve hiç sorgulanmayan)
    const { data: deletedData } = await supabase
      .from('market_price_snapshots')
      .delete()
      .lt('expires_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .eq('query_count', 0)
      .select('product_key');

    const deletedCount = deletedData?.length || 0;

    console.log('📊 Özet:');
    console.log(`  ✅ Güncellendi: ${refreshedCount}`);
    console.log(`  ❌ Hata: ${errorCount}`);
    console.log(`  🗑️ Silindi: ${deletedCount}`);
    console.log(`  💰 Maliyet: $${(refreshedCount * 0.012).toFixed(2)}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        refreshed: refreshedCount,
        errors: errorCount,
        deleted: deletedCount,
        cost: refreshedCount * 0.012
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Background refresh error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
