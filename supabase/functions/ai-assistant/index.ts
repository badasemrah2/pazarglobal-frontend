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

// ─────────────────────────────────────────────
// KATEGORİ PROFİL SİSTEMİ
// ─────────────────────────────────────────────
type CategoryProfile = {
  group: string;
  systemPrompt: string;
  titlePattern: string;
  titleExample: string;
  descriptionFramework: string;
  descriptionRules: string[];
  improveFramework: string;
  improveRules: string[];
  toneKeywords: string[];
  emojiStyle: string;
};

function getCategoryProfile(category: string): CategoryProfile {
  const cat = category.trim();

  // ─── GRUP 1: OTOMOTİV ───────────────────────────────────────
  if (cat === 'Otomotiv' || cat === 'Yedek Parça & Aksesuar') {
    return {
      group: 'otomotiv',
      systemPrompt: `Sen Türkiye'nin en iyi ikinci el ilan platformlarında (Sahibinden, Arabam.com) yıllarca çalışmış deneyimli bir araç ilan danışmanısın. Alıcılar hasar kaydı, tramer ve bakım geçmişi konusunda endişelidir. Görevin: satıcının verdiği bilgiyi şüphe bırakmayan, güven veren bir dille yazmak. Asla bilgi uydurmak yok.`,
      titlePattern: '[Marka] [Model] [Yıl] - [km veya öne çıkan özellik]',
      titleExample: 'Volkswagen Golf 2019 - 85.000 km, Otomatik, Boyasız',
      descriptionFramework: `1. GÜVEN AÇILIŞI: Araç durumunu dürüstçe 1 cümleyle özetle
2. TEKNİK DETAY: Motor, km, donanım, bakım bilgisi
3. DURUM NOTU: Hasar/boya durumu (varsa açıkça yaz, yoksa "hasar kaydı yoktur" de)
4. NEDEN SATILIYOR + KAPANIŞ: Satış sebebi + pazarlık/takas notu`,
      descriptionRules: [
        'Hasar kaydı bilgisi mutlaka olsun (var/yok)',
        'km bilgisi varsa başa yakın konumlandır',
        'Uydurma bakım geçmişi yazma',
        'Takas veya pazarlık durumunu belirt',
        'İletişim bilgisi ekleme',
        'Max 550 karakter',
      ],
      improveFramework: `Mevcut metni şu sıraya göre yeniden düzenle:
1. Araç durumu ve km → öne al
2. Teknik detaylar → ortaya topla
3. Hasar/boya durumu → açıkça belirt (yoksa "hasar kaydı yoktur" ekle)
4. Satış sebebi + pazarlık notu → sona bırak`,
      improveRules: [
        'Hasar kaydı bilgisi yoksa "hasar kaydı yoktur" ekle',
        'km bilgisi varsa ilk 2 cümlede geçsin',
        'Abartılı sıfatları (muhteşem, süper, harika) kaldır',
        'Teknik bilgileri kısaltma, sadece düzenle',
        'Tramer/boya ifadesi geçiyorsa doğrudan bırak, yumuşatma',
        'Max 550 karakter',
      ],
      toneKeywords: ['güven', 'dürüst', 'teknik', 'net'],
      emojiStyle: '🚗 veya 🔧 — sadece bölüm başında, max 1 adet',
    };
  }

  // ─── GRUP 2: EMLAK ──────────────────────────────────────────
  if (cat === 'Emlak') {
    return {
      group: 'emlak',
      systemPrompt: `Sen Türkiye'nin en iyi ikinci el ilan platformlarında (Sahibinden, Emlakjet) yıllarca çalışmış deneyimli bir emlak ilan danışmanısın. Alıcılar "burada mutlu olur muyum?" sorusunu sorar. Görevin: rakamları ve konumu net ver, yaşam kalitesini somut detaylarla hissettir. Asla bilgi uydurmak yok.`,
      titlePattern: '[Tip] [m²] [Oda] - [Semt/İlçe], [öne çıkan özellik]',
      titleExample: '3+1 120m² Daire - Kadıköy, Asansörlü, Isıyalıtımlı',
      descriptionFramework: `1. LOKASYON & YAŞAM: Semt özellikleri, ulaşım, çevre
2. YAPI & DAİRE: m², oda sayısı, kat, bina yaşı, cephe
3. ÖNE ÇIKANLAR: Balkon, otopark, site/müstakil, ısınma
4. PRATİK DETAY + KAPANIŞ: Kullanım durumu (kiracılı/boş), tapu, pazarlık`,
      descriptionRules: [
        'Metrekare ve oda sayısı mutlaka belirt',
        'Bina yaşı veya yapı tarihi varsa yaz',
        'Ulaşım noktalarına mesafe (metro, durak) somut ol',
        '"Manzaralı" veya "lüks" gibi belirsiz sıfatlarla bilgi uydurma',
        'İletişim bilgisi ekleme',
        'Max 550 karakter',
      ],
      improveFramework: `Mevcut metni şu sıraya göre yeniden düzenle:
1. Konum ve semt avantajı → öne al
2. Fiziksel özellikler (m², oda, kat) → ortada topla
3. Öne çıkan donanım (balkon, otopark, ısıtma) → listele
4. Kullanım durumu + tapu/pazarlık notu → sona`,
      improveRules: [
        '"Merkezi konum", "nezih semt" gibi belirsiz ifadeleri somutlaştır',
        'Ulaşım bilgisi varsa koruyup öne al',
        'Oda/m² bilgisi eksikse var olanı daha görünür yap',
        '"Müstakil kullanım", "kiracılı" gibi kritik bilgileri kaybetme',
        'Emlak spam kelimeleri (acil, şans, kaçmaz fırsat) kaldır',
        'Max 550 karakter',
      ],
      toneKeywords: ['güven', 'somut', 'lokasyon', 'yaşam'],
      emojiStyle: '🏠 veya 📍 — sadece bölüm geçişinde, max 2 adet',
    };
  }

  // ─── GRUP 3: ELEKTRONİK ────────────────────────────────────
  if (cat === 'Elektronik' || cat === 'Dijital Ürün & Hizmetler') {
    return {
      group: 'elektronik',
      systemPrompt: `Sen Türkiye'nin en iyi ikinci el ilan platformlarında (Sahibinden, Letgo) yıllarca çalışmış, teknoloji ürünlerini iyi tanıyan deneyimli bir elektronik ilan danışmanısın. Alıcılar fiyat/performans karşılaştırması yapar, ekran/batarya/hasar durumunu mutlaka sorar. Görevin: teknik detayı önce ver, güveni garanti ve aksesuar bilgisiyle tamamla. Asla bilgi uydurmak yok.`,
      titlePattern: '[Marka] [Model] [Kapasite/Spec] - [Renk veya durum notu]',
      titleExample: 'Apple iPhone 15 Pro 256GB - Titanyum Siyah, Kutulu',
      descriptionFramework: `1. SPEC ÖZET: En önemli 3-4 teknik özellik (depolama, RAM, işlemci vb.)
2. DURUM: Ekran, kasa, batarya sağlığı — dürüst ve net
3. AKSESUAR & GARANTİ: Kutu, şarj aleti, kılıf, garanti durumu
4. KAPANIŞ: Fiyat sabit/pazarlık + teslimat notu`,
      descriptionRules: [
        'Batarya sağlığı veya genel durum mutlaka belirt',
        'Ekranda çizik/kırık varsa açıkça yaz',
        '"Sıfır gibi" ifadesi kullanma, somut durum yaz (örn: "ekranda çizik yok, kasa temiz")',
        'Aksesuar listesi kısa ve net olsun',
        'İletişim bilgisi ekleme',
        'Max 550 karakter',
      ],
      improveFramework: `Mevcut metni şu sıraya göre yeniden düzenle:
1. Model ve kritik spec (depolama, RAM, işlemci) → ilk cümle
2. Fiziksel ve batarya durumu → ikinci blok
3. Aksesuar/kutu bilgisi → üçüncü blok
4. Fiyat tutumu + teslimat → kapanış`,
      improveRules: [
        '"Sıfır gibi" ifadesini somut durumla değiştir (örn: "ekranda çizik yok, kasa temiz")',
        'Batarya sağlığı % olarak geçiyorsa koru ve öne al',
        'Teknik spec kısaltma, sadece sıralamayı düzenle',
        'Gereksiz ünlem ve emoji zincirini temizle',
        'Aksesuar listesini virgülle ayır, madde yapma',
        'Max 550 karakter',
      ],
      toneKeywords: ['teknik', 'net', 'dürüst', 'karşılaştırmalı'],
      emojiStyle: '📱 veya 💻 — başlıkta 1 kez, metinde kullanma',
    };
  }

  // ─── GRUP 4: YAŞAM & TÜKETİM ────────────────────────────────
  if (
    cat === 'Ev & Yaşam' ||
    cat === 'Moda & Aksesuar' ||
    cat === 'Spor & Outdoor' ||
    cat === 'Anne, Bebek & Oyuncak' ||
    cat === 'Hayvanlar Alemi' ||
    cat === 'Tarım & Gıda'
  ) {
    const subTone =
      cat === 'Anne, Bebek & Oyuncak'
        ? 'güvenli, temiz, sıcak'
        : cat === 'Hayvanlar Alemi'
        ? 'sevecen, bilgilendirici, güven veren'
        : cat === 'Moda & Aksesuar'
        ? 'şık, özlü, görsel odaklı'
        : cat === 'Tarım & Gıda'
        ? 'doğal, dürüst, ürün odaklı'
        : 'pratik, sade, fayda odaklı';

    return {
      group: 'yasam-tuketim',
      systemPrompt: `Sen Türkiye'nin en iyi ikinci el ilan platformlarında (Sahibinden, Letgo) yıllarca çalışmış deneyimli bir ilan danışmanısın. Bu kategoride alıcı "durumu nasıl?" sorusunu sorar. Ton: ${subTone}. Görevin: satıcının verdiği bilgiyi koruyarak pratik fayda ve ürün durumunu net anlat. Asla bilgi uydurmak yok.`,
      titlePattern: '[Marka/Tür] [Ürün Adı] - [Beden/Renk/Boyut veya durum]',
      titleExample:
        cat === 'Moda & Aksesuar'
          ? 'Zara Oversize Keten Gömlek - L Beden, Sadece 1 Kez Giyildi'
          : cat === 'Spor & Outdoor'
          ? 'Nike Air Max 270 - 42 Numara, Az Kullanılmış'
          : 'IKEA Billy Kitaplık - Beyaz, Demonte, Eksiksiz',
      descriptionFramework: `1. ÜRÜN TANIMI: Ne olduğu, markası, modeli (1 cümle)
2. DURUM: Kaç kez kullanıldı, gözle görülür hasar/leke var mı
3. DETAY: Beden, renk, ölçü, malzeme (kategoriye göre)
4. KAPANIŞ: Teslimat/kargo bilgisi + pazarlık notu`,
      descriptionRules: [
        'Durum bilgisi (az kullanılmış / 1 kez kullanıldı / hiç kullanılmadı) mutlaka belirt',
        'Görünür bir kusur varsa açıkça yaz, gizleme',
        'Beden/ölçü/renk bilgisini net ver',
        ...(cat === 'Anne, Bebek & Oyuncak' ? ['Hijyen ve güvenlik durumunu vurgula'] : ['Marka biliniyorsa başa yakın konumlandır']),
        'İletişim bilgisi ekleme',
        'Max 550 karakter',
      ],
      improveFramework: `Mevcut metni şu sıraya göre yeniden düzenle:
1. Ürün tanımı ve marka → kısa ve net aç
2. Kullanım durumu → dürüstçe ve somut belirt
3. Beden/renk/ölçü detayı → kaybetme
4. Teslimat veya teslim şekli → sona`,
      improveRules: [
        'Kullanım sayısı veya durumu varsa öne al ("1 kez kullanıldı" gibi)',
        'Görünür kusur varsa yumuşatma, olduğu gibi bırak',
        'Beden/numara bilgisi geçiyorsa vurgula',
        ...(cat === 'Anne, Bebek & Oyuncak' ? ['Hijyen ve güvenlik vurgusunu koru'] : []),
        '"Az kullanıldı" gibi muğlak ifadeleri somutlaştır',
        'Max 550 karakter',
      ],
      toneKeywords: [subTone],
      emojiStyle: 'Uygun 1 emoji — bölüm ayracı olarak (✅ 🔹 📦)',
    };
  }

  // ─── GRUP 5: HİZMET & B2B ───────────────────────────────────
  if (
    cat === 'Hizmetler' ||
    cat === 'İş İlanları' ||
    cat === 'Eğitim & Kurs' ||
    cat === 'İş Makineleri & Sanayi'
  ) {
    return {
      group: 'hizmet-b2b',
      systemPrompt: `Sen profesyonel hizmet ve iş ilanları yazan deneyimli bir kopya yazarısın. Bu kategoride alıcı değil, müşteri veya işveren var. Uzmanlık, kapsam ve güvenilirlik ön planda olmalı. Net teklif dili kullan, belirsiz ifadelerden kaçın. Asla bilgi uydurmak yok.`,
      titlePattern: '[Hizmet/Pozisyon Adı] - [Uzmanlık Alanı veya Lokasyon]',
      titleExample:
        cat === 'Eğitim & Kurs'
          ? 'Matematik Özel Dersi - LGS/YKS, Online & Yüz Yüze'
          : cat === 'İş İlanları'
          ? 'Grafik Tasarımcı Aranıyor - Uzaktan, Tam Zamanlı'
          : 'Tadilat & Boya Hizmeti - İstanbul Anadolu Yakası',
      descriptionFramework: `1. HİZMET/KAPSAM: Ne sunuluyor, tam olarak ne kapsıyor
2. UZMANLIK: Deneyim, sertifika, referans (varsa)
3. DETAY: Lokasyon, çalışma şekli (online/yüz yüze/saha), süre
4. ÇAĞRI: Nasıl iletişime geçilmeli, süreç nasıl işliyor`,
      descriptionRules: [
        'Hizmet kapsamını net yaz, muğlak bırakma',
        'Deneyim yılı veya referans varsa belirt',
        'Fiyat politikasını belirt (sabit / teklif üzerine / ücretsiz görüşme)',
        'Çalışma bölgesi veya online imkanı net yaz',
        'Hizmet ilanlarında iletişim çağrısı eklenebilir — telefon numarası ekleme',
        'Max 550 karakter',
      ],
      improveFramework: `Mevcut metni şu sıraya göre yeniden düzenle:
1. Hizmet/pozisyon tanımı → ilk cümle, net ve özlü
2. Kapsam ve detay → madde veya kısa paragraf
3. Deneyim/uzmanlık → varsa koru, yoksa ekleme
4. İletişim/başvuru yöntemi → kapanışta açık bırak`,
      improveRules: [
        'Hizmet kapsamını netleştir, muğlak fiilleri kaldır',
        'Deneyim bilgisi varsa "yıl" olarak somutlaştır',
        'Lokasyon veya online bilgisi geçiyorsa koru',
        'Fiyat politikası belirsizse "teklif alın" yönlendirmesi yap',
        'Resmi ama sıcak ton koru',
        'Max 550 karakter',
      ],
      toneKeywords: ['uzman', 'güvenilir', 'net', 'profesyonel'],
      emojiStyle: '✅ veya 🔹 — madde başlarında kullanılabilir, max 3',
    };
  }

  // ─── GRUP 6: HOBİ & NİŞ ────────────────────────────────────
  if (cat === 'Hobi, Koleksiyon & Sanat' || cat === 'Diğer') {
    return {
      group: 'hobi-nis',
      systemPrompt: `Sen Türkiye'nin en iyi ikinci el ilan platformlarında koleksiyon ve hobi ürünlerini değerini bilen deneyimli bir ilan danışmanısın. Bu kategoride alıcı genellikle bilgili ve istekli. Ürünün özgünlüğü, nadirliği veya hikayesi değer katar. Net ve özgün bir dil kullan. Asla bilgi uydurmak yok.`,
      titlePattern: '[Ürün Adı] - [Dönem/Seri/Özellik], [Durum]',
      titleExample: 'Lego Technic 42083 Bugatti - Kutulu, Tamamlanmış Set',
      descriptionFramework: `1. ÜRÜN KİMLİĞİ: Ne olduğu, hangi seri/dönem/koleksiyon
2. DURUM: Orijinallik, eksik parça var mı, kutu/sertifika durumu
3. HİKAYESİ: Neden değerli, nereden edinildi (kısa)
4. KAPANIŞ: Fiyat ve pazarlık tutumu`,
      descriptionRules: [
        'Orijinallik ve komple/eksik durumu net belirt',
        'Koleksiyon değeri olan detayları öne çıkar',
        '"Nadir" veya "değerli" deme, kanıtla',
        'Kutu/sertifika varsa mutlaka belirt',
        'İletişim bilgisi ekleme',
        'Max 550 karakter',
      ],
      improveFramework: `Mevcut metni şu sıraya göre yeniden düzenle:
1. Ürün kimliği ve koleksiyon değeri → öne al
2. Orijinallik ve eksiksizlik durumu → net belirt
3. Kutu/sertifika/aksesuar → varsa koru
4. Fiyat tutumu → kapanışta`,
      improveRules: [
        'Koleksiyon detaylarını (seri no, baskı yılı, üretim) koru',
        '"Nadir" veya "değerli" ifadesi geçiyorsa kanıtla ya da kaldır',
        'Eksik parça bilgisi varsa gizleme',
        'Özgün hikayeyi koruyup sıkıştır',
        'Max 550 karakter',
      ],
      toneKeywords: ['özgün', 'bilgili', 'tutkulu', 'net'],
      emojiStyle: 'Tematik 1 emoji (🎨 🎮 🏆) — sadece başlıkta',
    };
  }

  // ─── FALLBACK ────────────────────────────────────────────────
  return {
    group: 'genel',
    systemPrompt: `Sen Türkiye'nin en iyi ikinci el ilan platformlarında (Sahibinden, Letgo) yıllarca çalışmış deneyimli bir ilan danışmanısın. Satıcının verdiği bilgiyi koruyarak güven veren, sade ve net bir metin oluştur. Asla bilgi uydurmak yok.`,
    titlePattern: '[Ürün Adı] - [En ayırt edici özellik]',
    titleExample: 'Bisiklet Çantası - Su Geçirmez, 20L, Sırt',
    descriptionFramework: `1. ÜRÜN: Ne olduğu, markası
2. DURUM: Kullanım durumu, gözle görülür kusur var mı
3. DETAY: Öne çıkan özellikler
4. KAPANIŞ: Teslimat/pazarlık notu`,
    descriptionRules: [
      'Durum bilgisi mutlaka belirt',
      'Bilgi uydurma',
      'İletişim bilgisi ekleme',
      'Max 550 karakter',
    ],
    improveFramework: `Mevcut metni şu sıraya göre yeniden düzenle:
1. Ürün ve durum → öne al
2. Detaylar → kısa ve net
3. Kapanış → pazarlık/teslimat notu`,
    improveRules: [
      'Mevcut bilgileri koru, yeni bilgi uydurma',
      'Abartılı sıfatları kaldır',
      'Okunabilirliği artır, kısa cümleler tercih et',
      'Max 550 karakter',
    ],
    toneKeywords: ['sade', 'dürüst', 'net'],
    emojiStyle: 'Max 1 emoji, gerekirse',
  };
}

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

    const profile = getCategoryProfile(category ?? '');
    let prompt = '';
    let systemPrompt = profile.systemPrompt;
    let expectsJsonResult = false;
    let maxTokens = 500;
    let temperature = 0.65;

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
        maxTokens = 120;
        temperature = 0.5;
        prompt = `Kategori: ${category}
Ürün: ${title}
Durum: ${condition || 'belirtilmedi'}

Başlık deseni: ${profile.titlePattern}
Örnek çıktı: ${profile.titleExample}

Bu desene uygun, alıcının arama sorgusunu karşılayan, 45-75 karakter arası tek satır başlık yaz.
Clickbait yok. Ünlem zinciri yok. Uydurma özellik ekleme.
Sadece başlığı döndür.`;
        break;
      }

      case 'suggest_description': {
        maxTokens = 500;
        temperature = 0.65;
        prompt = `Kategori: ${category}
Başlık: ${title}
Durum: ${condition || 'belirtilmedi'}

Açıklama yapısı:
${profile.descriptionFramework}

Kurallar:
${profile.descriptionRules.map((r) => `- ${r}`).join('\n')}

Emoji stili: ${profile.emojiStyle}
Ton: ${profile.toneKeywords.join(', ')}`;
        break;
      }

      case 'improve_text': {
        if (!description || description.trim().length < 10) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'İyileştirilecek metin çok kısa veya boş.',
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400,
            }
          );
        }
        maxTokens = 400;
        temperature = 0.4;
        prompt = `Kategori: ${category}
Ürün: ${title || 'belirtilmedi'}

İyileştirilecek metin:
"${description}"

Yeniden düzenleme yapısı:
${profile.improveFramework}

Kurallar:
${profile.improveRules.map((r) => `- ${r}`).join('\n')}

Genel kurallar:
- Mevcut bilgileri koru, bilgi uydurma
- Emoji stili: ${profile.emojiStyle}
- Ton: ${profile.toneKeywords.join(', ')}
- İletişim bilgisi/telefon ekleme
- Sadece iyileştirilmiş metni döndür`;
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