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
    // Request body'yi parse et
    const { action, category, title, description, condition } = await req.json();

    console.log('AI Assistant Request:', { action, category, title, condition });

    // OpenAI API Key kontrolü
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let prompt = '';
    const systemPrompt = 'Sen profesyonel bir ilan yazma uzmanısın. Türkiye pazarına özel, çekici ve satış odaklı içerikler üretiyorsun.';

    // Action'a göre prompt oluştur
    switch (action) {
      case 'suggest_title':
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
        prompt = `"${category}" kategorisinde "${title}" ürünü için profesyonel, çekici ve detaylı bir başlık oluştur. 

Kurallar:
- Kullanıcının yazdığı "${title}" kelimesini mutlaka kullan ve ona uygun başlık üret
- Kategori: "${category}" - Bu kategoriye uygun başlık olmalı
- Başlık maksimum 80 karakter olsun
- Ürün özelliklerini ekle (marka, model, özellikler)
- Türkiye pazarına uygun olsun
- Sadece başlığı yaz, başka açıklama ekleme

Örnek: Kullanıcı "laptop" yazdıysa → "Dell Inspiron 15 Laptop - i7 İşlemci, 16GB RAM, 512GB SSD"`;
        break;

      case 'suggest_description':
        prompt = `"${category}" kategorisinde "${title}" başlıklı bir ürün için profesyonel bir açıklama yaz. Açıklama:
- Emoji kullan
- Ürün özelliklerini listele
- Satış odaklı olsun
- Maksimum 500 karakter
- WhatsApp iletişim bilgisi ekle`;
        break;

      case 'improve_text':
        prompt = `Şu ilan açıklamasını iyileştir ve daha profesyonel hale getir:

"${description}"

İyileştirme kuralları:
- Emoji ekle
- Daha çekici yap
- Satış odaklı detaylar ekle
- Maksimum 500 karakter
- WhatsApp iletişim vurgusu yap`;
        break;

      case 'suggest_price':
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
            // Benzer başlıklı ürünleri filtrele
            const similarListings = listings.filter((listing: any) => {
              const listingTitle = listing.title.toLowerCase();
              const searchTitle = title.toLowerCase();
              const keywords = searchTitle.split(' ');
              return keywords.some((keyword: string) => listingTitle.includes(keyword));
            });

            if (similarListings.length > 0) {
              const total = similarListings.reduce((sum: number, item: any) => sum + (parseFloat(item.price) || 0), 0);
              siteAverage = total / similarListings.length;
              siteCount = similarListings.length;
              console.log(`📊 Site ortalaması: ${siteAverage.toFixed(2)} ₺ (${siteCount} ilan)`);
            } else {
              // Benzer ürün yoksa kategori ortalaması
              const total = listings.reduce((sum: number, item: any) => sum + (parseFloat(item.price) || 0), 0);
              siteAverage = total / listings.length;
              siteCount = listings.length;
              console.log(`📊 Kategori ortalaması: ${siteAverage.toFixed(2)} ₺ (${siteCount} ilan)`);
            }
          }
        } catch (err) {
          console.error('Site ortalaması hesaplanamadı:', err);
        }

        // 2️⃣ WEB SEARCH ile gerçek piyasa fiyatı al (Perplexity)
        let webSearchPrice = 0;
        let webSearchMin = 0;
        let webSearchMax = 0;
        let webSearchSource = '';
        
        try {
          console.log('🌐 Perplexity Web Search başlatılıyor...');
          
          const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
          
          if (PERPLEXITY_API_KEY) {
            // Daha spesifik arama sorgusu
            const searchQuery = `${title} ${category} 2.el satış fiyatı Türkiye sahibinden arabam letgo`;
            
            console.log('🔍 Arama sorgusu:', searchQuery);
            
            const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'llama-3.1-sonar-large-128k-online',
                messages: [
                  {
                    role: 'system',
                    content: 'Sen bir fiyat araştırma uzmanısın. Türkiye\'deki sahibinden.com, arabam.com, letgo gibi sitelerden güncel 2.el fiyatları araştırıyorsun. SADECE sayısal fiyat aralığı ver, başka hiçbir şey yazma.'
                  },
                  {
                    role: 'user',
                    content: `"${title}" için Türkiye'de sahibinden.com, arabam.com ve letgo'daki güncel 2.el satış fiyatları nedir? 

ÖNEMLI: 
- Sadece minimum ve maksimum fiyatı yaz
- Format: XXXXXX-YYYYYY (örnek: 950000-1050000)
- TL, ₺, virgül, nokta gibi işaretler kullanma
- Sadece rakam ve tire kullan
- Başka açıklama ekleme

Örnek yanıt: 950000-1050000`
                  }
                ],
                temperature: 0.1,
                max_tokens: 100,
                return_citations: true,
                search_recency_filter: 'month'
              }),
            });

            console.log('🌐 Perplexity yanıt durumu:', perplexityResponse.status);

            if (perplexityResponse.ok) {
              const perplexityData = await perplexityResponse.json();
              const webPriceText = perplexityData.choices[0]?.message?.content?.trim() || '';
              const citations = perplexityData.citations || [];
              
              console.log('🌐 Perplexity RAW yanıt:', webPriceText);
              console.log('🔗 Kaynaklar:', citations);
              
              // Fiyat aralığını parse et
              // Format: 950000-1050000 veya "950000-1050000" veya 950.000-1.050.000
              
              // Tüm nokta, virgül, TL, ₺ gibi karakterleri temizle
              const cleanText = webPriceText
                .replace(/TL|₺|lira/gi, '')
                .replace(/[.,]/g, '')
                .trim();
              
              console.log('🧹 Temizlenmiş metin:', cleanText);
              
              // Tire ile ayrılmış iki sayı ara
              const rangeMatch = cleanText.match(/(\d{5,})\s*[-–—]\s*(\d{5,})/);
              
              if (rangeMatch) {
                webSearchMin = parseInt(rangeMatch[1]);
                webSearchMax = parseInt(rangeMatch[2]);
                webSearchPrice = (webSearchMin + webSearchMax) / 2;
                webSearchSource = 'Perplexity Web Search';
                
                console.log(`✅ Fiyat aralığı bulundu: ${webSearchMin.toLocaleString('tr-TR')} - ${webSearchMax.toLocaleString('tr-TR')} ₺`);
                console.log(`💰 Ortalama fiyat: ${webSearchPrice.toLocaleString('tr-TR')} ₺`);
              } else {
                // Tek fiyat ara
                const singleMatch = cleanText.match(/(\d{5,})/);
                if (singleMatch) {
                  const singlePrice = parseInt(singleMatch[1]);
                  webSearchMin = Math.round(singlePrice * 0.9);
                  webSearchMax = Math.round(singlePrice * 1.1);
                  webSearchPrice = singlePrice;
                  webSearchSource = 'Perplexity Web Search (tek fiyat)';
                  
                  console.log(`✅ Tek fiyat bulundu: ${webSearchPrice.toLocaleString('tr-TR')} ₺`);
                } else {
                  console.log('⚠️ Fiyat parse edilemedi:', webPriceText);
                }
              }
            } else {
              const errorText = await perplexityResponse.text();
              console.error('❌ Perplexity API hatası:', perplexityResponse.status, errorText);
            }
          } else {
            console.log('⚠️ PERPLEXITY_API_KEY bulunamadı');
          }
        } catch (err) {
          console.error('❌ Web search hatası:', err);
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
          // Web search verisi varsa (en güvenilir)
          finalPrice = Math.round(webSearchPrice * conditionMultiplier);
          explanation = `🌐 Güncel Piyasa Verisi (${webSearchSource}):\n\n` +
            `📊 Piyasa Fiyat Aralığı: ${webSearchMin.toLocaleString('tr-TR')} - ${webSearchMax.toLocaleString('tr-TR')} ₺\n` +
            `📈 Ortalama: ${webSearchPrice.toLocaleString('tr-TR')} ₺\n` +
            `⚙️ Durum: ${condition || 'İyi Durumda'} (×${conditionMultiplier})\n\n` +
            `💰 Önerilen Satış Fiyatı: ${finalPrice.toLocaleString('tr-TR')} ₺`;
          
          if (siteCount > 0) {
            explanation += `\n\nℹ️ Sitemizdeki benzer ilanlar: ${siteAverage.toLocaleString('tr-TR')} ₺ (${siteCount} ilan)`;
          }
          
          console.log('✅ Web search tabanlı hesaplama tamamlandı:', finalPrice);
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
        temperature: 0.7,
        max_tokens: 500,
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

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('AI Assistant Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Bir hata oluştu' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});