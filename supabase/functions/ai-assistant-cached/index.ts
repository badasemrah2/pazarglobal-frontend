import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(Math.max(v, 0), 1);
}

function normalizeForMatch(text: unknown): string {
  if (typeof text !== 'string') return '';
  const turkishMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g',
    'ı': 'i', 'I': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o',
    'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u'
  };
  let normalized = text;
  for (const [tr, en] of Object.entries(turkishMap)) {
    normalized = normalized.replace(new RegExp(tr, 'g'), en);
  }
  return normalized.toLowerCase();
}

function normalizeConditionInput(raw: unknown): string {
  const msg = normalizeForMatch(raw || '');
  if (!msg) return '';

  if (msg.includes('sifir') || msg.includes('sıfır')) return 'Sıfır';
  if (msg.includes('az kullan')) return 'Az Kullanılmış';

  // 2. El variants - normalize dots and spaces
  const msg2 = msg.replace(/\./g, '').replace(/\s+/g, '');
  if (
    msg2.includes('2el') ||
    msg.includes('ikinci el') ||
    msg.includes('ikinci')
  ) {
    return '2. El';
  }

  if (msg.includes('iyi')) return 'İyi Durumda';
  if (msg.includes('orta')) return 'Orta Durumda';

  return '';
}

function computeEvidenceFactor(args: {
  vision?: any;
  userClaim?: string;
}): { factor: number; reasons: string[] } {
  const reasons: string[] = [];
  const user = normalizeForMatch(args.userClaim || '');
  const visionCondition = normalizeForMatch(args.vision?.condition || '');
  const visionProduct = normalizeForMatch(args.vision?.product || '');
  const visionCategory = normalizeForMatch(args.vision?.category || '');
  const hasVision = Boolean(visionCondition || visionProduct || visionCategory);
  const hasUser = Boolean(user.trim());

  if (!hasVision || !hasUser) {
    return { factor: 1.0, reasons };
  }

  // User-reported issues that materially change pricing context.
  const severeDamageTokens = [
    'agir hasar',
    'ağir hasar',
    'ağır hasar',
    'hasar kaydi',
    'hasar kaydı',
    'tramer',
    'pert',
    'sase',
    'şase',
    'motor ariza',
    'motor arıza',
    'calismiyor',
    'çalışmıyor',
    'kaza',
  ];
  const userSaysSevereDamage = severeDamageTokens.some(t => user.includes(normalizeForMatch(t)));

  // Vision often outputs generic buckets like "İyi Durumda"; treat these as "looks good".
  const visionLooksGood = ['sifir', 'az kullan', 'iyi durum'].some(t => visionCondition.includes(normalizeForMatch(t)));

  if (userSaysSevereDamage && visionLooksGood) {
    reasons.push('user_reports_damage_vs_vision_looks_good');
    return { factor: 0.75, reasons };
  }

  // If user provides detailed caveats (even if not conflicting), keep a slight penalty: price variance tends to be higher.
  if (userSaysSevereDamage) {
    reasons.push('user_reports_damage');
    return { factor: 0.90, reasons };
  }

  return { factor: 1.0, reasons };
}

// 🔑 Product Key Normalizasyon (inline)
function normalizeProductKey(title: string, category: string): string {
  const turkishMap: { [key: string]: string } = {
    'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G',
    'ı': 'i', 'I': 'I', 'İ': 'I', 'i': 'i',
    'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S',
    'ü': 'u', 'Ü': 'U'
  };

  let normalized = title;
  for (const [turkish, english] of Object.entries(turkishMap)) {
    normalized = normalized.replace(new RegExp(turkish, 'g'), english);
  }

  normalized = normalized.toLowerCase();

  const stopWords = [
    'satilik', 'temiz', 'bakimli', 'orjinal', 'orijinal',
    'az', 'kullanilmis', 'sifir', 'ayarinda', 'gibi',
    'hatasiz', 'boyasiz', 'degisensiz', 'garantili',
    'acil', 'ucuz', 'uygun', 'firsat', 'son', 'model',
    'yeni', 'ikinci', 'el', '2.el', 'ikinciel'
  ];

  stopWords.forEach(word => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });

  normalized = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const categoryKey = category.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  const words = normalized.split(' ').filter(w => w.length > 0);
  const productKey = words.join('_');

  return `${categoryKey}_${productKey}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, category, title, description, condition, vision, user_claim } = await req.json();
    const normalizedCondition = normalizeConditionInput(condition) || 'İyi Durumda';

    console.log('📦 Request:', { action, category, title, description, condition, normalizedCondition, has_vision: !!vision, has_user_claim: !!user_claim });

    if (action !== 'suggest_price') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only suggest_price action supported in cache mode' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1️⃣ Product key oluştur
    const productKey = normalizeProductKey(title, category);
    console.log('🔑 Product Key:', productKey);

    // 2️⃣ Cache'te var mı kontrol et
    const { data: cachedData, error: cacheError } = await supabase
      .from('market_price_snapshots')
      .select('*')
      .eq('product_key', productKey)
      .single();

    console.log('💾 Cache lookup:', { found: !!cachedData, expired: cachedData?.expires_at < new Date().toISOString() });

    // 3️⃣ CACHE HIT - Taze veri varsa (with basic sanity checks)
    if (cachedData && !cacheError && new Date(cachedData.expires_at) > new Date()) {
      const looksLikePhone = /\b(iphone|telefon|samsung|galaxy|xiaomi|redmi|huawei|oppo|realme|oneplus)\b/i.test(title);
      const looksLikeShoes = /\b(nike|adidas|puma|reebok|new balance|converse|vans|ayakkab|sneaker|spor ayakkab|kosu)\b/i.test(title);
      const avg = Number(cachedData.avg_price);
      
      // Sanity checks for cached data (too low OR too high)
      const phoneCacheBad = looksLikePhone && Number.isFinite(avg) && avg > 0 && avg < 1000;
      const shoesCacheTooLow = looksLikeShoes && Number.isFinite(avg) && avg > 0 && avg < 500;
      const shoesCacheTooHigh = looksLikeShoes && Number.isFinite(avg) && avg > 12000;
      const shoesCacheBad = shoesCacheTooLow || shoesCacheTooHigh;
      const generalCacheBad = Number.isFinite(avg) && avg > 0 && avg < 100;
      const cacheLooksWrong = phoneCacheBad || shoesCacheBad || generalCacheBad;

      if (cacheLooksWrong) {
        console.log('⚠️ CACHE HIT but value looks wrong; refreshing from web', { avg, phoneCacheBad, shoesCacheBad, generalCacheBad });
        // Delete bad cache entry
        await supabase.from('market_price_snapshots').delete().eq('product_key', productKey);
      } else {
        console.log('✅ CACHE HIT - Önbellekten dönüyor');

        // Sorgu sayısını artır
        await supabase.rpc('increment_query_count', { p_product_key: productKey });

        // Log query
        await supabase.from('market_data_query_log').insert({
          product_key: productKey,
          category: category,
          hit_type: 'cache_hit',
          response_time_ms: 50,
          cost: 0.0
        });

      // Durum katsayısı uygula
      const conditionMultipliers: { [key: string]: number } = {
        'Sıfır': 1.0,
        'Az Kullanılmış': 0.85,
        '2. El': 0.75,
        'İyi Durumda': 0.70,
        'Orta Durumda': 0.55
      };
        const multiplier = conditionMultipliers[normalizedCondition] ?? 0.70;
        const finalPrice = Math.round(Number(cachedData.avg_price) * multiplier);

        const evidence = computeEvidenceFactor({ vision, userClaim: typeof user_claim === 'string' ? user_claim : '' });
        const baseConfidence = Number(cachedData.confidence) || 0;
        const adjustedConfidence = clamp01(baseConfidence * evidence.factor);

        const explanation = `🌐 GÜNCEL PİYASA VERİSİ (Önbellek):\n\n` +
          `📊 Fiyat Aralığı: ${cachedData.min_price.toLocaleString('tr-TR')} - ${cachedData.max_price.toLocaleString('tr-TR')} ₺\n` +
          `📈 Piyasa Ortalaması: ${cachedData.avg_price.toLocaleString('tr-TR')} ₺\n` +
          `⚙️ Durum Katsayısı: ${normalizedCondition} (×${multiplier})\n` +
          `🎯 Güven Skoru: ${(adjustedConfidence * 100).toFixed(0)}%` +
          (evidence.factor !== 1.0 ? ` (kanıt uyumu ×${evidence.factor})` : '') +
          `\n\n` +
          `💰 ÖNERİLEN SATIŞ FİYATI: ${finalPrice.toLocaleString('tr-TR')} ₺\n\n` +
          `📅 Son Güncelleme: ${new Date(cachedData.last_updated_at).toLocaleDateString('tr-TR')}\n` +
          `✅ Veriler ${cachedData.sources.length} farklı kaynaktan toplanmıştır.`;

        return new Response(
          JSON.stringify({
            success: true,
            result: explanation,
            price: finalPrice,
            cached: true,
            confidence: adjustedConfidence,
            base_confidence: baseConfidence,
            evidence_factor: evidence.factor,
            evidence_reasons: evidence.reasons,
            min_price: Number(cachedData.min_price),
            max_price: Number(cachedData.max_price),
            avg_price: Number(cachedData.avg_price),
            condition_used: normalizedCondition,
            condition_multiplier: multiplier,
            product_key: productKey
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4️⃣ CACHE MISS - Perplexity çağır
    console.log('❌ CACHE MISS - Perplexity çağrılıyor');

    // Log cache miss (analytics)
    try {
      await supabase.from('market_data_query_log').insert({
        product_key: productKey,
        category: category,
        hit_type: 'cache_miss',
        response_time_ms: 0,
        cost: 0.0
      });
    } catch (_e) {
      // best-effort
    }

    const startTime = Date.now();
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY bulunamadı');
    }

    // Define product type detection early for category-specific logic
    const looksLikePhone = /\b(iphone|telefon|samsung|galaxy|xiaomi|redmi|huawei|oppo|realme|oneplus)\b/i.test(title);
    const looksLikeShoes = /\b(nike|adidas|puma|reebok|new balance|converse|vans|ayakkab|sneaker|spor ayakkab|kosu)\b/i.test(title);

    // Category-specific search domains and prompts
    const isShoeCategory = looksLikeShoes || /ayakkab|spor|kosu/i.test(category);
    const isPhoneCategory = looksLikePhone || /telefon|elektronik/i.test(category);
    const isCarCategory = /araba|otomobil|ara[cç]/i.test(category);

    const searchDomains = isShoeCategory
      ? ['trendyol.com', 'hepsiburada.com', 'sportive.com.tr', 'superstep.com.tr', 'sneakscloud.com']
      : isPhoneCategory
      ? ['hepsiburada.com', 'trendyol.com', 'n11.com', 'teknosa.com', 'mediamarkt.com.tr']
      : isCarCategory
      ? ['sahibinden.com', 'arabam.com', 'letgo.com']
      : ['sahibinden.com', 'hepsiburada.com', 'trendyol.com', 'letgo.com', 'n11.com'];

    const categoryHint = isShoeCategory
      ? '\n\nÖNEMLİ: Bu bir AYAKKABI. Türkiye\'de spor ayakkabı fiyatları genelde 1.500-12.000 TL arasındadır. Lütfen SADECE ayakkabı fiyatlarını ara.'
      : isPhoneCategory
      ? '\n\nÖNEMLİ: Bu bir CEP TELEFONU. Fiyatlar genelde 5.000-80.000 TL arasındadır.'
      : '';

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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
            content: 'Sen bir fiyat araştırma uzmanısın. Türkiye\'deki e-ticaret sitelerinden GERÇEK GÜNCEL fiyat verilerini topluyorsun. SADECE sayısal fiyat aralığı ver. TL cinsinden.'
          },
          {
            role: 'user',
            content: `"${title}" için Türkiye'deki e-ticaret sitelerindeki GÜNCEL satış fiyatları nedir?

Kategori: ${category}${description ? `\n\nÜrün Detayları: ${description}` : ''}${categoryHint}

KURALLAR:
- Format: XXXXXX-YYYYYY (TL cinsinden)
- Sadece rakam ve tire
- Gerçek sitelerden güncel veri
- ${isShoeCategory ? 'Sportive, Trendyol, Hepsiburada gibi sitelerden ayakkabı fiyatı bul' : 'Ürün detaylarını dikkate al'}

Örnek: ${isShoeCategory ? '4500-7500' : isPhoneCategory ? '25000-35000' : '5000-15000'}`
          }
        ],
        temperature: 0.1,
        max_tokens: 150,
        search_mode: 'web',
        web_search_options: {
          search_context_size: 'high'
        },
        search_domain_filter: searchDomains,
        search_recency_filter: 'week'
      }),
    });

    if (!perplexityResponse.ok) {
      throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
    }

    const perplexityData = await perplexityResponse.json();
    const responseTime = Date.now() - startTime;
    const priceText = perplexityData.choices[0]?.message?.content?.trim() || '';
    const searchResults = perplexityData.search_results || [];

    console.log('🌐 Perplexity yanıt:', priceText);
    console.log('🔗 Kaynaklar:', searchResults.length);

    // Parse fiyat (robust): accept either a range (X-Y) or a single price.
    const cleanText = priceText
      .replace(/TL|₺|lira|try/gi, '')
      .replace(/[.,]/g, '')
      .trim();

    // Accept values like "25-35 bin" too (Perplexity often answers like that).
    const numbers = cleanText.match(/\d{2,}/g) || [];
    let minPrice = 0;
    let maxPrice = 0;

    const hasThousandsHint = /\b(bin|k)\b/i.test(cleanText);

    const toPrice = (n: string): number => {
      const v = parseInt(n, 10);
      if (Number.isNaN(v)) return 0;
      if (hasThousandsHint && v > 0 && v < 1000) return v * 1000;
      return v;
    };

    if (numbers.length >= 2) {
      minPrice = toPrice(numbers[0]);
      maxPrice = toPrice(numbers[1]);
    } else if (numbers.length === 1) {
      const single = toPrice(numbers[0]);
      minPrice = Math.round(single * 0.85);
      maxPrice = Math.round(single * 1.15);
    } else {
      throw new Error('Fiyat parse edilemedi');
    }

    if (minPrice > maxPrice) {
      const tmp = minPrice;
      minPrice = maxPrice;
      maxPrice = tmp;
    }

    // Heuristic: phone listings sometimes yield small numbers (e.g., "12-64") from model/storage.
    // If it looks like a phone and the parsed numbers are unrealistically small, treat them as "bin" (×1000).
    if (looksLikePhone && maxPrice > 0 && maxPrice < 1000) {
      minPrice = minPrice * 1000;
      maxPrice = maxPrice * 1000;
    }

    // Heuristic: Nike/Adidas shoes - realistic price range is 500-12000 TL (Turkey 2024-2026)
    // Real data: Nike Structure 26 = 2000-10000 TL, most shoes 1500-8000 TL
    if (looksLikeShoes) {
      // Too low - likely parsed wrong (e.g., "26" -> "2600")
      if (maxPrice > 0 && maxPrice < 500) {
        minPrice = minPrice * 100;
        maxPrice = maxPrice * 100;
      }
      // Too high - Perplexity sometimes returns completely wrong data (e.g., 50000 TL for shoes)
      // Max realistic shoe price in Turkey is ~12000 TL (premium limited editions)
      if (maxPrice > 12000) {
        console.log('⚠️ Shoe price unrealistic, rejecting Perplexity response', { minPrice, maxPrice });
        // Don't trust this data at all - throw error to prevent bad cache
        throw new Error(`Ayakkabı fiyatı mantıksız (${maxPrice} TL) - veri güvenilir değil`);
      }
    }

    // General sanity check: if avg price is unrealistically low (< 100 TL), reject
    const avgPrice = (minPrice + maxPrice) / 2;
    if (avgPrice < 100) {
      throw new Error(`Fiyat çok düşük görünüyor (${avgPrice} TL) - parse hatası olabilir`);
    }

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
    const freshnessScore = 1.0 * 0.3; // Yeni veri
    const consistencyScore = Math.max(0, 1 - priceRangeRatio) * 0.3;
    const confidence = sourceScore + freshnessScore + consistencyScore;

    // TTL hesapla (DB-configured)
    let ttlDays = 14;
    try {
      const { data: ttlRow, error: ttlErr } = await supabase
        .from('market_data_ttl_config')
        .select('ttl_days')
        .eq('category', category)
        .maybeSingle();
      if (!ttlErr && ttlRow?.ttl_days && Number.isFinite(Number(ttlRow.ttl_days))) {
        ttlDays = Number(ttlRow.ttl_days);
      }
    } catch (_e) {
      // fallback to default
    }

    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    // 5️⃣ Cache'e kaydet
    const { error: insertError } = await supabase
      .from('market_price_snapshots')
      .upsert({
        product_key: productKey,
        original_title: title,
        category: category,
        condition: normalizedCondition,
        min_price: minPrice,
        max_price: maxPrice,
        avg_price: avgPrice,
        sources: sources,
        confidence: confidence,
        query_count: 1,
        last_query_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        raw_data: perplexityData
      }, {
        onConflict: 'product_key'
      });

    if (insertError) {
      console.error('❌ Cache kayıt hatası:', insertError);
    } else {
      console.log('✅ Cache kaydedildi');
    }

    // Log query
    await supabase.from('market_data_query_log').insert({
      product_key: productKey,
      category: category,
      hit_type: 'api_call',
      response_time_ms: responseTime,
      cost: 0.012 // Perplexity maliyeti
    });

    // Durum katsayısı uygula
    const conditionMultipliers: { [key: string]: number } = {
      'Sıfır': 1.0,
      'Az Kullanılmış': 0.85,
      '2. El': 0.75,
      'İyi Durumda': 0.70,
      'Orta Durumda': 0.55
    };
    const multiplier = conditionMultipliers[normalizedCondition] ?? 0.70;
    const finalPrice = Math.round(avgPrice * multiplier);

    const explanation = `🌐 GERÇEK PİYASA VERİSİ:\n\n` +
      `📊 Güncel Fiyat Aralığı: ${minPrice.toLocaleString('tr-TR')} - ${maxPrice.toLocaleString('tr-TR')} ₺\n` +
      `📈 Piyasa Ortalaması: ${avgPrice.toLocaleString('tr-TR')} ₺\n` +
      `⚙️ Durum Katsayısı: ${normalizedCondition} (×${multiplier})\n` +
      (() => {
        const evidence = computeEvidenceFactor({ vision, userClaim: typeof user_claim === 'string' ? user_claim : '' });
        const adjustedConfidence = clamp01(confidence * evidence.factor);
        return `🎯 Güven Skoru: ${(adjustedConfidence * 100).toFixed(0)}%` + (evidence.factor !== 1.0 ? ` (kanıt uyumu ×${evidence.factor})` : '') + `\n\n`;
      })() +
      `💰 ÖNERİLEN SATIŞ FİYATI: ${finalPrice.toLocaleString('tr-TR')} ₺\n\n` +
      `✅ Bu fiyat ${sources.length} farklı e-ticaret sitesinden alınan güncel verilere dayanmaktadır.`;

    const evidence = computeEvidenceFactor({ vision, userClaim: typeof user_claim === 'string' ? user_claim : '' });
    const adjustedConfidence = clamp01(confidence * evidence.factor);

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: explanation,
        price: finalPrice,
        cached: false,
        confidence: adjustedConfidence,
        base_confidence: clamp01(confidence),
        evidence_factor: evidence.factor,
        evidence_reasons: evidence.reasons,
        min_price: minPrice,
        max_price: maxPrice,
        avg_price: avgPrice,
        condition_used: normalizedCondition,
        condition_multiplier: multiplier,
        product_key: productKey
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
