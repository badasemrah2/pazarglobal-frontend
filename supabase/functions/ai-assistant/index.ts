// @ts-expect-error Deno remote module resolution handled by Deno runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error Deno remote module resolution handled by Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JsonRecord = Record<string, unknown>;
type ListingRow = {
  price: string | number | null;
  title: string;
  condition?: string | null;
};
type SearchResult = { title?: string; url?: string };

const denoEnv = (globalThis as unknown as {
  Deno?: { env?: { get?: (key: string) => string | undefined } };
}).Deno?.env;

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Request body'yi parse et
    const { action, category, title, description, condition } = await req.json();

    console.log('AI Assistant Request:', { action, category, title, condition });

    // OpenAI API Key kontrolü
    const OPENAI_API_KEY = denoEnv?.get?.('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY bulunamadı!');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'API anahtarı yapılandırılmamış. Lütfen Supabase Dashboard\'dan OPENAI_API_KEY ekleyin.' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    // Supabase client oluştur
    const supabaseUrl = denoEnv?.get?.('SUPABASE_URL') ?? '';
    const supabaseKey = denoEnv?.get?.('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let prompt = '';
    let systemPrompt = 'Sen profesyonel bir ilan yazma uzmanısın. Türkiye pazarına özel, çekici ve satış odaklı içerikler üretiyorsun.';
    let expectsJsonResult = false;
    let maxTokens = 500;
    let temperature = 0.7;

    const inferSynonyms = (input: { category?: string; title?: string; description?: string }): string[] => {
      const categoryLc = (input.category || '').toLowerCase();
      const titleLc = (input.title || '').toLowerCase();
      const descLc = (input.description || '').toLowerCase();
      const haystack = `${categoryLc} ${titleLc} ${descLc}`;
      const add = new Set<string>();

      if (categoryLc.includes('otomotiv') || categoryLc.includes('vasıta') || categoryLc.includes('vasita') || categoryLc.includes('araç') || categoryLc.includes('arac')) {
        for (const w of ['araba', 'otomobil', 'araç', 'otomotiv']) add.add(w);
      }

      if (categoryLc.includes('emlak') || categoryLc.includes('konut') || categoryLc.includes('gayrimenkul')) {
        for (const w of ['emlak', 'ev', 'daire', 'konut']) add.add(w);
      }

      if (categoryLc.includes('elektronik') || haystack.includes('telefon') || haystack.includes('iphone') || haystack.includes('samsung') || haystack.includes('xiaomi')) {
        for (const w of ['elektronik', 'telefon', 'cep telefonu', 'akıllı telefon']) add.add(w);
      }

      if (haystack.includes('laptop') || haystack.includes('notebook') || haystack.includes('lenovo') || haystack.includes('dell') || haystack.includes('asus') || haystack.includes('hp') || haystack.includes('macbook')) {
        for (const w of ['bilgisayar', 'laptop', 'notebook']) add.add(w);
      }

      return Array.from(add);
    };

    const sanitizeKeywords = (
      keywords: unknown,
      fallbackText: string,
      context: { category?: string; title?: string; description?: string }
    ): { keywords: string[]; keywords_text: string } => {
      const list = Array.isArray(keywords) ? keywords : [];
      const cleaned = list
        .map((k) => (typeof k === 'string' ? k.trim().toLowerCase() : ''))
        .filter(Boolean)
        .map((k) => k.replace(/[^0-9a-zçğıöşü+\s-]/gi, ''))
        .map((k) => k.trim())
        .filter(Boolean);

      for (const s of inferSynonyms(context)) {
        cleaned.push(s.toLowerCase());
      }

      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const k of cleaned) {
        if (seen.has(k)) continue;
        seen.add(k);
        deduped.push(k);
        if (deduped.length >= 20) break;
      }
      const keywords_text = deduped.join(' ');
      return {
        keywords: deduped,
        keywords_text: keywords_text || (fallbackText || '').trim(),
      };
    };

    const tryParseJsonObject = (text: string): JsonRecord | null => {
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        // try to extract first JSON object
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
          const sliced = text.slice(start, end + 1);
          try {
            return JSON.parse(sliced);
          } catch {
            return null;
          }
        }
        return null;
      }
    };

    // Action'a göre prompt oluştur
    switch (action) {
      case 'generate_keywords': {
        if (!title || title.trim().length < 2) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Lütfen önce ürün başlığını yazın.' 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }

        expectsJsonResult = true;
        maxTokens = 250;
        temperature = 0.2;
        systemPrompt =
          'Sen bir ilan arama indeksleme uzmanısın. Görevin arama için anahtar kelimeler üretmek. PII üretme (telefon, isim, adres, e-posta). Sadece ürün/kategori/özellik odaklı anahtar kelimeler üret.';

        prompt = `Aşağıdaki ilan için arama anahtar kelimeleri üret.

Veriler:
- Kategori: ${category || ''}
- Başlık: ${title}
- Açıklama: ${description || ''}
- Durum: ${condition || ''}

Kurallar:
- Sadece JSON döndür, başka hiçbir metin yazma.
- Şema: {"keywords": ["..."], "keywords_text": "..."}
- keywords: 10-20 adet, küçük harf, kısa (1-3 kelime), tekrar yok.
- Geniş aramalar için 2-4 adet genel kategori kelimesi ekle (örn otomotiv/araba/araç, telefon/akıllı telefon).
- Marka/model/özellik/ölçü (örn 2+1, 128gb, i7) gibi ifadeleri dahil et.
- PII yok: isim, telefon, adres, whatsapp, kullanıcı bilgisi YAZMA.
`;
        break;
      }

      case 'suggest_title': {
        if (!title || title.trim().length < 2) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Lütfen önce ürününüzü kısaca yazın (örn: "laptop i7")' 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }
        prompt = `"${category}" kategorisinde "${title}" ürünü için satış odaklı, doğal ve güven veren bir ilan başlığı yaz.

Kurallar:
      - Kullanıcının verdiği ana ürünü koru, uydurma özellik ekleme
      - 45-80 karakter aralığında tek satır başlık üret
      - Marka/model varsa başa yakın konumlandır
      - Gereksiz abartı, clickbait ve ünlem zinciri kullanma
      - Türkiye ilan diline uygun yaz
      - Sadece başlığı yaz, başka açıklama ekleme

Örnek: Kullanıcı "laptop" yazdıysa → "Dell Inspiron 15 Laptop - i7 İşlemci, 16GB RAM, 512GB SSD"`;
        break;
      }

      case 'suggest_description': {
        prompt = `"${category}" kategorisinde "${title}" başlıklı ürün için ilan açıklaması oluştur.

      Kurallar:
      - Doğal konuşma dili kullan, robotik metin üretme
      - Uydurma özellik, garanti, kutu bilgisi ekleme
      - 3 kısa paragraf veya maddeli yapı kullan
      - Ürün durumu, öne çıkan özellikler, teslimat/pazarlık notu içersin
      - İletişim bilgisi/telefon numarası ekleme
      - Maksimum 550 karakter`;
        break;
      }

      case 'improve_text': {
        prompt = `Aşağıdaki ilan açıklamasını iyileştir. Anlamı koru, daha net ve güven verici hale getir:

"${description}"

İyileştirme kuralları:
      - Bilgiyi bozmadan düzenle, yeni teknik özellik uydurma
      - Gereksiz süslü dil ve spam kelimeler kullanma
      - Okunabilirliği artır, kısa cümleler tercih et
      - Uygunsa 1-2 adet sade emoji kullan
      - İletişim bilgisi/telefon ekleme
      - Maksimum 550 karakter`;
        break;
      }

      case 'suggest_price': {
        // 🎯 HİBRİT FİYAT HESAPLAMA SİSTEMİ + WEB SEARCH
        console.log('🔍 Hibrit fiyat hesaplama başlıyor...');
        
        // 1️⃣ Site ortalaması hesapla
        let siteAverage = 0;
        let siteCount = 0;
        
        try {
          const { data: listings, error: dbError } = await supabase
            .from('listings')
            .select('price, title, condition')
            .eq('category', category)
            .not('price', 'is', null);

          if (!dbError && listings && listings.length > 0) {
            const typedListings = listings as ListingRow[];
            // Benzer başlıklı ürünleri filtrele
            const similarListings = typedListings.filter((listing) => {
              const listingTitle = listing.title.toLowerCase();
              const searchTitle = title.toLowerCase();
              const keywords = searchTitle.split(' ');
              return keywords.some((keyword: string) => listingTitle.includes(keyword));
            });

            if (similarListings.length > 0) {
              const total = similarListings.reduce(
                (sum, item) => sum + (parseFloat(String(item.price ?? 0)) || 0),
                0
              );
              siteAverage = total / similarListings.length;
              siteCount = similarListings.length;
              console.log(`📊 Site ortalaması: ${siteAverage.toFixed(2)} ₺ (${siteCount} ilan)`);
            } else {
              // Benzer ürün yoksa kategori ortalaması
              const total = typedListings.reduce(
                (sum, item) => sum + (parseFloat(String(item.price ?? 0)) || 0),
                0
              );
              siteAverage = total / typedListings.length;
              siteCount = typedListings.length;
              console.log(`📊 Kategori ortalaması: ${siteAverage.toFixed(2)} ₺ (${siteCount} ilan)`);
            }
          }
        } catch (err) {
          console.error('Site ortalaması hesaplanamadı:', err);
        }

        // 2️⃣ WEB SCRAPING ile gerçek piyasa fiyatı al (Güncel API)
        let webSearchPrice = 0;
        let webSearchMin = 0;
        let webSearchMax = 0;
        let webSearchSource = '';
        
        try {
          console.log('🌐 Gerçek zamanlı piyasa verisi çekiliyor...');
          
          const PERPLEXITY_API_KEY = denoEnv?.get?.('PERPLEXITY_API_KEY');
          
          if (PERPLEXITY_API_KEY) {
            console.log('🔍 E-ticaret sitelerinden güncel fiyatlar aranıyor...');
            
            const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar',  // ✅ YENİ MODEL (eski: llama-3.1-sonar-large-128k-online)
                messages: [
                  {
                    role: 'system',
                    content: 'Sen bir fiyat araştırma uzmanısın. Türkiye\'deki sahibinden.com, arabam.com, letgo, hepsiburada gibi e-ticaret sitelerinden GERÇEK GÜNCEL fiyat verilerini topluyorsun. SADECE sayısal fiyat aralığı ver.'
                  },
                  {
                    role: 'user',
                    content: `"${title}" ürünü için Türkiye'deki e-ticaret sitelerindeki (sahibinden.com, arabam.com, letgo, hepsiburada) GÜNCEL satış fiyatları nedir?

Kategori: ${category}
Durum: ${condition || '2.el'}

ÖNEMLİ KURALLAR:
- Sadece minimum ve maksimum fiyatı yaz
- Format: XXXXXX-YYYYYY (örnek: 25000-35000)
- TL, ₺, virgül, nokta, açıklama EKLEME
- Sadece rakam ve tire kullan
- Gerçek sitelerden aldığın güncel verileri kullan

Örnek yanıt: 25000-35000`
                  }
                ],
                temperature: 0.1,
                max_tokens: 150,
                search_mode: 'web',  // ✅ YENİ PARAMETRE
                web_search_options: {  // ✅ YENİ PARAMETRE (eski: return_citations)
                  search_context_size: 'high',
                  image_search_relevance_enhanced: false
                },
                search_domain_filter: [  // ✅ Sadece güvenilir siteler
                  'sahibinden.com',
                  'arabam.com', 
                  'letgo.com',
                  'hepsiburada.com',
                  'trendyol.com'
                ],
                search_recency_filter: 'week'  // ✅ Son 1 hafta
              }),
            });

            console.log('🌐 API yanıt durumu:', perplexityResponse.status);

            if (perplexityResponse.ok) {
              const perplexityData = await perplexityResponse.json();
              const webPriceText = perplexityData.choices[0]?.message?.content?.trim() || '';
              const searchResults: SearchResult[] = perplexityData.search_results || [];  // ✅ YENİ FORMAT (eski: citations)
              
              console.log('🌐 RAW yanıt:', webPriceText);
              console.log('🔗 Kaynaklar:', searchResults.map((r) => `${r.title} - ${r.url}`).join('\n'));
              
              // Fiyat aralığını parse et
              // Format: 950000-1050000 veya "950000-1050000" veya 950.000-1.050.000
              
              // Tüm nokta, virgül, TL, ₺ gibi karakterleri temizle
              const cleanText = webPriceText
                .replace(/TL|₺|lira|try/gi, '')
                .replace(/[.,]/g, '')
                .trim();
              
              console.log('🧹 Temizlenmiş metin:', cleanText);
              
              // Tire ile ayrılmış iki sayı ara
              const rangeMatch = cleanText.match(/(\d{4,})\s*[-–—]\s*(\d{4,})/);
              
              if (rangeMatch) {
                webSearchMin = parseInt(rangeMatch[1]);
                webSearchMax = parseInt(rangeMatch[2]);
                webSearchPrice = (webSearchMin + webSearchMax) / 2;
                
                // Kaynak sitelerini listele
                const sources = searchResults.map((r) => {
                  const url = r.url || '';
                  if (url.includes('sahibinden')) return '🏪 Sahibinden';
                  if (url.includes('arabam')) return '🚗 Arabam';
                  if (url.includes('letgo')) return '📱 Letgo';
                  if (url.includes('hepsiburada')) return '🛒 Hepsiburada';
                  if (url.includes('trendyol')) return '🛍️ Trendyol';
                  return '🌐 Web';
                }).filter((v, i, a) => a.indexOf(v) === i).join(', ');
                
                webSearchSource = sources || 'Gerçek E-Ticaret Siteleri';
                
                console.log(`✅ Fiyat aralığı bulundu: ${webSearchMin.toLocaleString('tr-TR')} - ${webSearchMax.toLocaleString('tr-TR')} ₺`);
                console.log(`💰 Ortalama fiyat: ${webSearchPrice.toLocaleString('tr-TR')} ₺`);
                console.log(`🔗 Kaynaklar: ${webSearchSource}`);
              } else {
                // Tek fiyat ara
                const singleMatch = cleanText.match(/(\d{4,})/);
                if (singleMatch) {
                  const singlePrice = parseInt(singleMatch[1]);
                  webSearchMin = Math.round(singlePrice * 0.85);
                  webSearchMax = Math.round(singlePrice * 1.15);
                  webSearchPrice = singlePrice;
                  webSearchSource = 'E-Ticaret Sitesi (tek fiyat)';
                  
                  console.log(`✅ Tek fiyat bulundu: ${webSearchPrice.toLocaleString('tr-TR')} ₺`);
                } else {
                  console.log('⚠️ Fiyat parse edilemedi:', webPriceText);
                }
              }
            } else {
              const errorText = await perplexityResponse.text();
              console.error('❌ API hatası:', perplexityResponse.status, errorText);
            }
          } else {
            console.log('⚠️ PERPLEXITY_API_KEY bulunamadı');
          }
        } catch (err) {
          console.error('❌ Web scraping hatası:', err);
        }

        // 3️⃣ AI'dan piyasa fiyatı al (fallback)
        let aiAverage = 0;
        
        if (webSearchPrice === 0) {
          const pricePrompt = `"${category}" kategorisinde "${title}" başlıklı ürün için Türkiye piyasasında makul bir fiyat aralığı öner. 

Kurallar:
- Sadece sayısal fiyat aralığı yaz (örn: "950000-1050000")
- Para birimi veya açıklama ekleme
- Gerçekçi piyasa fiyatları ver
- Ürün durumu: ${condition || 'used'}`;

          console.log('🤖 AI\'dan piyasa fiyatı isteniyor...');

          const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: pricePrompt }
              ],
              temperature: 0.7,
              max_tokens: 100,
            }),
          });

          if (!aiResponse.ok) {
            throw new Error(`OpenAI API hatası: ${aiResponse.status}`);
          }

          const aiData = await aiResponse.json();
          const aiPriceText = aiData.choices[0]?.message?.content?.trim() || '';
          console.log('🤖 AI yanıtı:', aiPriceText);

          // AI fiyatını parse et
          const priceMatch = aiPriceText.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
          let aiMinPrice = 0;
          let aiMaxPrice = 0;
          
          if (priceMatch) {
            aiMinPrice = parseFloat(priceMatch[1].replace(/[.,]/g, ''));
            aiMaxPrice = parseFloat(priceMatch[2].replace(/[.,]/g, ''));
          } else {
            // Tek fiyat varsa
            const singlePrice = aiPriceText.match(/(\d+)/);
            if (singlePrice) {
              aiMinPrice = parseInt(singlePrice[1]);
              aiMaxPrice = aiMinPrice * 1.2;
            }
          }

          aiAverage = (aiMinPrice + aiMaxPrice) / 2;
          console.log(`🤖 AI ortalaması: ${aiAverage.toFixed(2)} ₺`);
        }

        // 4️⃣ Durum katsayısı
        const conditionMultipliers: { [key: string]: number } = {
          'Sıfır': 1.0,
          'Az Kullanılmış': 0.85,
          'İyi Durumda': 0.70,
          'Orta Durumda': 0.55
        };

        const conditionMultiplier = conditionMultipliers[condition || 'İyi Durumda'] || 0.70;
        console.log(`⚙️ Durum katsayısı: ${conditionMultiplier} (${condition || 'İyi Durumda'})`);

        // 5️⃣ Hibrit hesaplama
        let finalPrice = 0;
        let explanation = '';

        if (webSearchPrice > 0) {
          // Web scraping verisi varsa (en güvenilir - GERÇEK SİTE VERİLERİ)
          finalPrice = Math.round(webSearchPrice * conditionMultiplier);
          explanation = `🌐 GERÇEK PİYASA VERİSİ (${webSearchSource}):\n\n` +
            `📊 Güncel Fiyat Aralığı: ${webSearchMin.toLocaleString('tr-TR')} - ${webSearchMax.toLocaleString('tr-TR')} ₺\n` +
            `📈 Piyasa Ortalaması: ${webSearchPrice.toLocaleString('tr-TR')} ₺\n` +
            `⚙️ Durum Katsayısı: ${condition || 'İyi Durumda'} (×${conditionMultiplier})\n\n` +
            `💰 ÖNERİLEN SATIŞ FİYATI: ${finalPrice.toLocaleString('tr-TR')} ₺\n\n` +
            `✅ Bu fiyat gerçek e-ticaret sitelerinden alınan güncel verilere dayanmaktadır.`;
          
          if (siteCount > 0) {
            explanation += `\n\n📱 PazarGlobal Platformu: ${siteAverage.toLocaleString('tr-TR')} ₺ (${siteCount} benzer ilan)`;
          }
          
          console.log('✅ Web scraping tabanlı hesaplama tamamlandı:', finalPrice);
        } else if (siteCount > 0 && aiAverage > 0) {
          // Hem site hem AI verisi var
          const hybridPrice = (aiAverage * 0.6) + (siteAverage * 0.4);
          finalPrice = Math.round(hybridPrice * conditionMultiplier);
          explanation = `🎯 Hibrit Hesaplama:\n\n` +
            `📊 Site Ortalaması: ${siteAverage.toLocaleString('tr-TR')} ₺ (${siteCount} ilan)\n` +
            `🤖 AI Piyasa Tahmini: ${aiAverage.toLocaleString('tr-TR')} ₺\n` +
            `⚙️ Durum: ${condition || 'İyi Durumda'} (×${conditionMultiplier})\n\n` +
            `💰 Önerilen Fiyat: ${finalPrice.toLocaleString('tr-TR')} ₺`;
          
          console.log('✅ Hibrit hesaplama tamamlandı:', finalPrice);
        } else if (aiAverage > 0) {
          // Sadece AI verisi var
          finalPrice = Math.round(aiAverage * conditionMultiplier);
          explanation = `🤖 AI Piyasa Tahmini:\n\n` +
            `📊 Piyasa Fiyatı: ${aiAverage.toLocaleString('tr-TR')} ₺\n` +
            `⚙️ Durum: ${condition || 'İyi Durumda'} (×${conditionMultiplier})\n\n` +
            `💰 Önerilen Fiyat: ${finalPrice.toLocaleString('tr-TR')} ₺\n\n` +
            `ℹ️ Sitede henüz benzer ilan yok, sadece piyasa verisi kullanıldı.`;
          
          console.log('✅ AI tabanlı hesaplama tamamlandı:', finalPrice);
        } else if (siteCount > 0) {
          // Sadece site verisi var
          finalPrice = Math.round(siteAverage * conditionMultiplier);
          explanation = `📊 Site Verisi:\n\n` +
            `📊 Site Ortalaması: ${siteAverage.toLocaleString('tr-TR')} ₺ (${siteCount} ilan)\n` +
            `⚙️ Durum: ${condition || 'İyi Durumda'} (×${conditionMultiplier})\n\n` +
            `💰 Önerilen Fiyat: ${finalPrice.toLocaleString('tr-TR')} ₺`;
          
          console.log('✅ Site tabanlı hesaplama tamamlandı:', finalPrice);
        } else {
          // Hiç veri yok
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Fiyat önerisi için yeterli veri bulunamadı. Lütfen daha detaylı başlık yazın.' 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400 
            }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            result: explanation,
            price: finalPrice 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Geçersiz action');
    }

    console.log('OpenAI API çağrısı yapılıyor...');

    // OpenAI API çağrısı (diğer action'lar için)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', errorText);
      
      if (response.status === 401) {
        throw new Error('API anahtarı geçersiz. Lütfen OPENAI_API_KEY\'i kontrol edin.');
      } else if (response.status === 429) {
        throw new Error('API limit aşıldı. Lütfen daha sonra tekrar deneyin.');
      } else {
        throw new Error(`OpenAI API hatası: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content?.trim() || '';

    console.log('AI Response:', result);

    if (expectsJsonResult) {
      const parsed = tryParseJsonObject(result);
      const keywords = parsed?.keywords;
      const keywordsText = typeof parsed?.keywords_text === 'string' ? parsed.keywords_text : '';
      const sanitized = sanitizeKeywords(keywords, keywordsText, {
        category: typeof category === 'string' ? category : '',
        title: typeof title === 'string' ? title : '',
        description: typeof description === 'string' ? description : '',
      });

      // If model returned nothing useful, treat as failure so caller can fallback.
      if (!sanitized.keywords || sanitized.keywords.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI keyword üretimi başarısız' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, result: sanitized }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Bir hata oluştu';
    console.error('AI Assistant Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});