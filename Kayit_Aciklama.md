# Railway WhatsApp Bridge Entegrasyon Kodu

## 📋 Genel Bakış

Bu dokümantasyon, Railway üzerinde çalışan WhatsApp Bridge'e Supabase `user_security` entegrasyonunu eklemek için gerekli kodu içerir.

---

## 🔧 1. Gerekli Paketler

Railway WhatsApp Bridge projenize şu paketi ekleyin:

```bash
npm install @supabase/supabase-js
```

---

## 🔐 2. Environment Variables

Railway projenize şu environment variable'ları ekleyin:

```env
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Not:** Service Role Key'i Supabase Dashboard → Settings → API'den alabilirsiniz.

---

## 📝 3. WhatsApp Bridge Kodu

Mevcut Railway WhatsApp Bridge projenizde `/webhook` endpoint'ine şu kodu ekleyin:

```javascript
// ============================================
// Railway WhatsApp Bridge - Supabase Entegrasyonu
// ============================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// Yardımcı Fonksiyonlar
// ============================================

/**
 * PIN hash'ini doğrula
 */
async function verifyPIN(phone, pin, storedHash) {
  const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
  return pinHash === storedHash;
}

/**
 * Session oluştur
 */
async function createSession(phone) {
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 gün

  const { error } = await supabase
    .from('user_security')
    .update({
      session_token: sessionToken,
      session_expires_at: expiresAt,
      last_login_at: new Date().toISOString(),
      last_login_ip: null, // WhatsApp'tan geldiği için IP yok
      failed_attempts: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('phone', phone);

  if (error) {
    console.error('Session oluşturma hatası:', error);
    throw error;
  }

  return sessionToken;
}

/**
 * Başarısız deneme sayısını artır
 */
async function incrementFailedAttempts(phone) {
  const { data } = await supabase
    .from('user_security')
    .select('failed_attempts')
    .eq('phone', phone)
    .single();

  const newAttempts = (data?.failed_attempts || 0) + 1;
  const shouldLock = newAttempts >= 5;

  await supabase
    .from('user_security')
    .update({
      failed_attempts: newAttempts,
      is_locked: shouldLock,
      blocked_until: shouldLock 
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 dakika
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('phone', phone);

  return { newAttempts, shouldLock };
}

/**
 * Session'ın geçerli olup olmadığını kontrol et
 */
function isSessionExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
}

/**
 * Hesabın kilitli olup olmadığını kontrol et
 */
function isAccountLocked(security) {
  if (!security.is_locked) return false;
  if (!security.blocked_until) return false;
  
  const blockedUntil = new Date(security.blocked_until);
  if (blockedUntil < new Date()) {
    // Kilit süresi dolmuş, kilidi kaldır
    supabase
      .from('user_security')
      .update({
        is_locked: false,
        blocked_until: null,
        failed_attempts: 0,
      })
      .eq('phone', security.phone);
    return false;
  }
  
  return true;
}

/**
 * Twilio ile WhatsApp mesajı gönder
 */
async function sendWhatsAppMessage(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  const response = await fetch(
    \`https://api.twilio.com/2010-04-01/Accounts/\${accountSid}/Messages.json\`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(\`\${accountSid}:\${authToken}\`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: \`whatsapp:\${whatsappNumber}\`,
        To: \`whatsapp:\${to}\`,
        Body: message,
      }),
    }
  );

  if (!response.ok) {
    console.error('Twilio mesaj gönderme hatası:', await response.text());
    throw new Error('Mesaj gönderilemedi');
  }

  return await response.json();
}

// ============================================
// Webhook Endpoint (Mevcut kodunuza ekleyin)
// ============================================

app.post('/webhook', async (req, res) => {
  try {
    const { From, Body, MessageSid, MediaUrl0 } = req.body;
    const phone = From.replace('whatsapp:', '');
    const message = Body?.trim() || '';

    console.log('📩 WhatsApp mesajı alındı:', { phone, message, MessageSid });

    // ============================================
    // 1️⃣ Kullanıcı Kontrolü (Supabase)
    // ============================================
    const { data: security, error: securityError } = await supabase
      .from('user_security')
      .select('*')
      .eq('phone', phone)
      .single();

    if (securityError || !security) {
      console.log('❌ Kayıtlı kullanıcı bulunamadı:', phone);
      await sendWhatsAppMessage(phone, 
        '❌ Kayıtlı kullanıcı bulunamadı.\\n\\n' +
        '🔗 Kayıt olmak için:\\n' +
        'https://pazarglobal.com/auth/register'
      );
      return res.status(200).send('OK');
    }

    // ============================================
    // 2️⃣ Hesap Kilidi Kontrolü
    // ============================================
    if (isAccountLocked(security)) {
      const blockedUntil = new Date(security.blocked_until);
      const remainingMinutes = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
      
      console.log('🔒 Hesap kilitli:', phone, 'Kalan süre:', remainingMinutes, 'dakika');
      await sendWhatsAppMessage(phone,
        \`🔒 Hesabınız geçici olarak kilitlendi.\\n\\n\` +
        \`⏰ \${remainingMinutes} dakika sonra tekrar deneyin.\\n\\n\` +
        \`ℹ️ 5 başarısız PIN denemesinden sonra hesabınız 15 dakika kilitlenir.\`
      );
      return res.status(200).send('OK');
    }

    // ============================================
    // 3️⃣ Session Kontrolü
    // ============================================
    if (!security.session_token || isSessionExpired(security.session_expires_at)) {
      console.log('🔐 Session yok veya süresi dolmuş:', phone);

      // PIN bekleniyor
      if (/^\d{4}$/.test(message)) {
        console.log('🔑 PIN girişi yapılıyor:', phone);

        // PIN doğrulama
        const isValid = await verifyPIN(phone, message, security.pin_hash);
        
        if (isValid) {
          console.log('✅ PIN doğru, session oluşturuluyor:', phone);
          
          // Session oluştur
          await createSession(phone);
          
          await sendWhatsAppMessage(phone,
            '✅ Giriş başarılı!\\n\\n' +
            '🎉 Artık ilan verebilirsiniz.\\n\\n' +
            '📸 Fotoğraf göndererek veya ürününüzü anlatarak ilan oluşturabilirsiniz.'
          );
        } else {
          console.log('❌ Hatalı PIN:', phone);
          
          // Başarısız deneme sayısını artır
          const { newAttempts, shouldLock } = await incrementFailedAttempts(phone);
          
          if (shouldLock) {
            await sendWhatsAppMessage(phone,
              '🔒 5 başarısız deneme!\\n\\n' +
              '⏰ Hesabınız 15 dakika kilitlendi.\\n\\n' +
              'Lütfen daha sonra tekrar deneyin.'
            );
          } else {
            const remainingAttempts = 5 - newAttempts;
            await sendWhatsAppMessage(phone,
              \`❌ Hatalı PIN!\\n\\n\` +
              \`⚠️ Kalan deneme hakkı: \${remainingAttempts}\\n\\n\` +
              \`Lütfen tekrar deneyin.\`
            );
          }
        }
        
        return res.status(200).send('OK');
      } else if (message.toLowerCase().includes('pin') && message.toLowerCase().includes('unuttum')) {
        // PIN unutma durumu
        console.log('🔄 PIN sıfırlama talebi:', phone);
        
        await sendWhatsAppMessage(phone,
          '🔐 PIN\'inizi sıfırlamak için:\\n\\n' +
          \`🔗 https://pazarglobal.com/auth/whatsapp-reset-pin?phone=\${encodeURIComponent(phone)}\\n\\n\` +
          'Bu linke tıklayarak yeni PIN belirleyebilirsiniz.'
        );
        
        return res.status(200).send('OK');
      } else {
        // PIN isteme mesajı
        await sendWhatsAppMessage(phone,
          '🔐 Giriş yapmanız gerekiyor.\\n\\n' +
          '🔢 Lütfen 4 haneli PIN kodunuzu gönderin.\\n\\n' +
          'ℹ️ PIN\'inizi unuttuysan "PIN unuttum" yazın.'
        );
        
        return res.status(200).send('OK');
      }
    }

    // ============================================
    // 4️⃣ Session Geçerli - İlan Verme İşlemleri
    // ============================================
    console.log('✅ Session geçerli, ilan verme işlemine devam:', phone);

    // Kullanıcı bilgilerini al
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phone)
      .single();

    // Buradan sonra mevcut Agent Backend entegrasyonunuz devam eder
    // Fotoğraf yükleme, AI ile ilan oluşturma vb.
    
    if (MediaUrl0) {
      console.log('📷 Fotoğraf alındı:', MediaUrl0);
      
      // Agent Backend'e fotoğraf gönder
      // ... Mevcut kodunuz ...
      
      await sendWhatsAppMessage(phone,
        '📷 Fotoğraf alındı!\\n\\n' +
        'Ürününüz hakkında bilgi verin:\\n' +
        '• Başlık\\n' +
        '• Fiyat\\n' +
        '• Kategori'
      );
    } else {
      console.log('💬 Metin mesajı alındı:', message);
      
      // Agent Backend'e mesaj gönder
      // ... Mevcut kodunuz ...
      
      // Örnek yanıt
      await sendWhatsAppMessage(phone,
        'Mesajınız alındı! Agent Backend işleme alıyor...'
      );
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Webhook hatası:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// Rate Limiting (Opsiyonel)
// ============================================

const rateLimitMap = new Map();

function checkRateLimit(phone) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(phone) || { count: 0, resetAt: now + 60000 };

  if (now > userLimit.resetAt) {
    // Reset
    rateLimitMap.set(phone, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (userLimit.count >= 10) {
    // Rate limit aşıldı
    return false;
  }

  userLimit.count++;
  rateLimitMap.set(phone, userLimit);
  return true;
}

// Webhook başında kullanım:
// if (!checkRateLimit(phone)) {
//   await sendWhatsAppMessage(phone, '⚠️ Çok fazla istek gönderdiniz. Lütfen 1 dakika bekleyin.');
//   return res.status(429).send('Too Many Requests');
// }
```

---

## 🎯 4. Twilio Webhook Ayarları

Twilio Dashboard'da webhook URL'inizi ayarlayın:

1. Twilio Console → Messaging → Settings → WhatsApp Sandbox Settings
2. **When a message comes in:** `https://[your-railway-domain]/webhook`
3. **HTTP Method:** POST
4. Save

---

## 📊 5. Test Senaryoları

### **Senaryo 1: İlk Giriş**
```
Kullanıcı: "Merhaba"
Bot: "🔐 Giriş yapmanız gerekiyor. Lütfen 4 haneli PIN kodunuzu gönderin."

Kullanıcı: "1234"
Bot: "✅ Giriş başarılı! Artık ilan verebilirsiniz."
```

### **Senaryo 2: Hatalı PIN**
```
Kullanıcı: "9999"
Bot: "❌ Hatalı PIN! ⚠️ Kalan deneme hakkı: 4"

Kullanıcı: "8888"
Bot: "❌ Hatalı PIN! ⚠️ Kalan deneme hakkı: 3"
```

### **Senaryo 3: Hesap Kilidi**
```
Kullanıcı: "1111" (5. hatalı deneme)
Bot: "🔒 5 başarısız deneme! ⏰ Hesabınız 15 dakika kilitlendi."
```

### **Senaryo 4: PIN Unutma**
```
Kullanıcı: "PIN unuttum"
Bot: "🔐 PIN'inizi sıfırlamak için: 🔗 https://pazarglobal.com/auth/whatsapp-reset-pin?phone=+905412879705"
```

### **Senaryo 5: İlan Verme**
```
Kullanıcı: [Fotoğraf gönderir]
Bot: "📷 Fotoğraf alındı! Ürününüz hakkında bilgi verin..."

Kullanıcı: "iPhone 15 Pro Max, 45000 TL, Elektronik"
Bot: "✅ İlanınız yayınlandı! 🔗 https://pazarglobal.com/listing/abc123"
```

---

## 🔍 6. Debugging

Railway logs'larını kontrol edin:

```bash
railway logs
```

Önemli log mesajları:
- `📩 WhatsApp mesajı alındı`
- `❌ Kayıtlı kullanıcı bulunamadı`
- `🔐 Session yok veya süresi dolmuş`
- `✅ PIN doğru, session oluşturuluyor`
- `❌ Hatalı PIN`
- `🔒 Hesap kilitli`
- `✅ Session geçerli, ilan verme işlemine devam`

---

## 📋 7. Checklist

- [ ] `@supabase/supabase-js` paketi yüklendi
- [ ] Environment variables eklendi (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Webhook endpoint'ine kod eklendi
- [ ] Twilio webhook URL'i güncellendi
- [ ] Test mesajları gönderildi
- [ ] Logs kontrol edildi
- [ ] PIN doğrulama çalışıyor
- [ ] Session oluşturma çalışıyor
- [ ] Başarısız deneme sayısı artıyor
- [ ] Hesap kilitleme çalışıyor

---

## 🚀 8. Sonraki Adımlar

1. ✅ **Web sitesinde WhatsApp Reset PIN sayfası oluşturuldu** (`/auth/whatsapp-reset-pin`)
2. ✅ **ChatBox tamamlandı** (eksik fonksiyonlar eklendi)
3. ✅ **Railway entegrasyon kodu hazırlandı** (bu dosya)
4. ⏳ **Railway'e kod eklenmesi** (sizin yapmanız gerekiyor)
5. ⏳ **Twilio webhook URL güncellenmesi** (sizin yapmanız gerekiyor)
6. ⏳ **Test edilmesi** (WhatsApp'tan mesaj göndererek)

---

## 💡 9. Notlar

- **Güvenlik:** Service Role Key'i asla frontend'de kullanmayın, sadece backend'de kullanın
- **Session Süresi:** 7 gün olarak ayarlandı, ihtiyacınıza göre değiştirebilirsiniz
- **Kilit Süresi:** 15 dakika olarak ayarlandı, ihtiyacınıza göre değiştirebilirsiniz
- **Başarısız Deneme Limiti:** 5 olarak ayarlandı, ihtiyacınıza göre değiştirebilirsiniz
- **Rate Limiting:** Opsiyonel olarak eklenebilir, kötüye kullanımı önler

---

## 📞 Destek

Herhangi bir sorun yaşarsanız:
1. Railway logs'larını kontrol edin
2. Supabase logs'larını kontrol edin
3. Twilio logs'larını kontrol edin
4. Environment variables'ları kontrol edin

---

**Hazırlayan:** PazarGlobal AI Assistant  
**Tarih:** 2025-12-09  
**Versiyon:** 1.0
