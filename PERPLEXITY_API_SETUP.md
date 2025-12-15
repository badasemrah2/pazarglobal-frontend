# 🌐 Perplexity API Güncellemesi - Gerçek Piyasa Fiyatları

## 📋 Değişiklikler (15 Aralık 2025)

### ❌ **ESKİ SİSTEM (Çalışmıyordu)**
```typescript
model: 'llama-3.1-sonar-large-128k-online'  // ❌ Eski model
return_citations: true                       // ❌ Kaldırıldı
search_recency_filter: 'month'               // ❌ Root seviyede
```

### ✅ **YENİ SİSTEM (Güncel API)**
```typescript
model: 'sonar'  // ✅ Yeni model
search_mode: 'web'  // ✅ Web arama modu
web_search_options: {  // ✅ Yeni yapı
  search_context_size: 'high',
  image_search_relevance_enhanced: false
}
search_domain_filter: [  // ✅ Sadece güvenilir siteler
  'sahibinden.com',
  'arabam.com', 
  'letgo.com',
  'hepsiburada.com',
  'trendyol.com'
]
search_recency_filter: 'week'  // ✅ Son 1 hafta (root seviyede doğru)
```

---

## 🔑 **Perplexity API Parametreleri**

### **1. Model Seçimi**
```typescript
model: 'sonar'              // Hafif, hızlı, genel arama
model: 'sonar-pro'          // Daha detaylı analiz
model: 'sonar-deep-research'  // Derinlemesine araştırma
model: 'sonar-reasoning'    // Hızlı mantık yürütme
model: 'sonar-reasoning-pro'  // Premier mantık yürütme
```

**Bizim Kullanımımız:** `sonar` - Hızlı ve güncel piyasa verileri için yeterli

---

### **2. Arama Modu (search_mode)**
```typescript
search_mode: 'web'       // ✅ Genel web arama (bizim kullandığımız)
search_mode: 'academic'  // Akademik kaynaklar
search_mode: 'sec'       // SEC dosyaları (ABD)
```

---

### **3. Web Arama Seçenekleri (web_search_options)**
```typescript
web_search_options: {
  search_context_size: 'low' | 'high',  // Arama bağlamı boyutu
  image_search_relevance_enhanced: boolean  // Görsel arama iyileştirmesi
}
```

**Bizim Kullanımımız:**
```typescript
web_search_options: {
  search_context_size: 'high',  // Daha fazla veri
  image_search_relevance_enhanced: false  // Sadece metin
}
```

---

### **4. Domain Filtreleme (search_domain_filter)**
```typescript
search_domain_filter: ['site1.com', 'site2.com']  // Sadece bu sitelerden ara
search_domain_filter: ['-spam.com']  // Bu siteyi hariç tut
```

**Bizim Kullanımımız:**
```typescript
search_domain_filter: [
  'sahibinden.com',
  'arabam.com', 
  'letgo.com',
  'hepsiburada.com',
  'trendyol.com'
]
```

---

### **5. Zaman Filtreleri**
```typescript
search_recency_filter: 'hour' | 'day' | 'week' | 'month' | 'year'
search_after_date_filter: '3/1/2025'   // Bu tarihten sonra
search_before_date_filter: '12/31/2025'  // Bu tarihten önce
last_updated_after_filter: '1/1/2025'   // Son güncelleme sonrası
last_updated_before_filter: '12/15/2025'  // Son güncelleme öncesi
```

**Bizim Kullanımımız:**
```typescript
search_recency_filter: 'week'  // Son 1 hafta
```

---

### **6. Yanıt Formatı**
```typescript
// Eski format (citations)
const citations = data.citations  // ❌ Artık yok

// Yeni format (search_results)
const searchResults = data.search_results  // ✅ Doğru
```

**search_results yapısı:**
```typescript
search_results: [
  {
    title: "Ürün başlığı",
    url: "https://sahibinden.com/...",
    date: "2025-12-15"
  }
]
```

---

## 🚀 **Sistem Akışı**

### **1. Kullanıcı İsteği**
```
Başlık: "iPhone 14 Pro 256GB"
Kategori: "Elektronik"
Durum: "Az Kullanılmış"
```

### **2. API Çağrısı**
```typescript
const response = await fetch('https://api.perplexity.ai/chat/completions', {
  body: JSON.stringify({
    model: 'sonar',
    messages: [{
      role: 'system',
      content: 'Sen bir fiyat araştırma uzmanısın...'
    }, {
      role: 'user',
      content: '"iPhone 14 Pro 256GB" için güncel fiyatlar?'
    }],
    search_mode: 'web',
    search_domain_filter: ['sahibinden.com', 'arabam.com', ...],
    search_recency_filter: 'week'
  })
});
```

### **3. API Yanıtı**
```typescript
{
  choices: [{
    message: {
      content: "25000-35000"  // Fiyat aralığı
    }
  }],
  search_results: [
    { title: "...", url: "https://sahibinden.com/...", date: "2025-12-15" },
    { title: "...", url: "https://hepsiburada.com/...", date: "2025-12-14" }
  ]
}
```

### **4. Parse ve Hesaplama**
```typescript
// Parse
webSearchMin = 25000
webSearchMax = 35000
webSearchPrice = 30000

// Durum katsayısı uygula
conditionMultiplier = 0.85  // "Az Kullanılmış"
finalPrice = 30000 × 0.85 = 25,500 ₺
```

### **5. Kullanıcıya Sonuç**
```
🌐 GERÇEK PİYASA VERİSİ (🏪 Sahibinden, 🛒 Hepsiburada):

📊 Güncel Fiyat Aralığı: 25,000 - 35,000 ₺
📈 Piyasa Ortalaması: 30,000 ₺
⚙️ Durum Katsayısı: Az Kullanılmış (×0.85)

💰 ÖNERİLEN SATIŞ FİYATI: 25,500 ₺

✅ Bu fiyat gerçek e-ticaret sitelerinden alınan güncel verilere dayanmaktadır.
```

---

## 🔧 **Supabase Edge Function Ayarları**

### **1. Environment Variables**
Supabase Dashboard → Project Settings → Edge Functions → Secrets

```bash
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyxxxxxxxxxxx
```

### **2. API Key Alma**
1. [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
2. "Generate API Key"
3. Key'i kopyala ve Supabase'e ekle

---

## 📊 **Fiyat Hesaplama Mantığı**

### **Öncelik Sırası:**
1. **Web Scraping** (En güvenilir) - Gerçek sitelerden güncel fiyatlar
2. **Hibrit** - Site içi + AI tahmini
3. **AI Tahmini** - Sadece GPT-4o-mini
4. **Site İçi** - Sadece platform verileri

### **Durum Katsayıları:**
```typescript
'Sıfır': 1.0           // %100
'Az Kullanılmış': 0.85 // %85
'İyi Durumda': 0.70    // %70
'Orta Durumda': 0.55   // %55
```

---

## 🐛 **Hata Ayıklama**

### **Console Logları**
```typescript
console.log('🌐 API yanıt durumu:', response.status);
console.log('🌐 RAW yanıt:', webPriceText);
console.log('🔗 Kaynaklar:', searchResults);
console.log('🧹 Temizlenmiş metin:', cleanText);
console.log('✅ Fiyat aralığı:', `${min}-${max}`);
```

### **Sık Karşılaşılan Hatalar**

**1. API Key Hatası**
```
❌ API hatası: 401
```
**Çözüm:** PERPLEXITY_API_KEY doğru eklenmiş mi kontrol et

**2. Model Hatası**
```
❌ model 'llama-3.1-sonar-large-128k-online' not found
```
**Çözüm:** Model'i `sonar` olarak değiştir

**3. Fiyat Parse Edilemedi**
```
⚠️ Fiyat parse edilemedi: [metin]
```
**Çözüm:** AI yanıtı format dışında, prompt'u iyileştir

---

## 📚 **Kaynaklar**

- [Perplexity API Docs](https://docs.perplexity.ai/)
- [Chat Completions SDK](https://docs.perplexity.ai/guides/chat-completions-sdk)
- [API Reference](https://docs.perplexity.ai/api-reference/chat-completions-post)
- [Web Search Options](https://docs.perplexity.ai/guides/search-domain-filters)

---

## ✅ **Sonuç**

Sistem artık **gerçek e-ticaret sitelerinden** güncel fiyat verileri çekiyor:
- ✅ Sahibinden.com
- ✅ Arabam.com
- ✅ Letgo
- ✅ Hepsiburada
- ✅ Trendyol

**Eski sistem:** AI tahminine dayalı (güvenilir değil)
**Yeni sistem:** Gerçek site verileri + AI fallback (çok güvenilir)

---

**Tarih:** 15 Aralık 2025
**Güncelleme:** Perplexity API v2025
