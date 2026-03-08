# Ücretliye Geçiş Öncesi

Bu doküman, sistemin şu an neden kredi düşmediğini ve ücretli moda geçişte **Supabase** ve **kod** tarafında neler yapılacağını özetler.

## 1) Mevcut Durum (Neden kredi düşmüyor?)

Şu an kampanya mantığı aktiftir:

- `wallets.free_unlimited_until` alanı gelecekte bir tarih ise kullanıcı "sınırsız" kabul edilir.
- Bu nedenle yayın sırasında kredi kontrolü pozitif geçer ve kredi düşümü atlanır.
- Davranış hem WebChat hem WhatsApp publish akışında backend tarafından uygulanır.

Kodda ilgili noktalar:

- `services/supabase_client.py`
  - `get_wallet_balance(...)` promo aktifse yüksek bakiye döner
  - `deduct_credits(...)` promo aktifse `deduct_credits_skipped_promo` loglayıp düşümü atlar
- `routers/gateway_v3.py`
  - `check_wallet(...)`, `_fsm_show_confirmation_preview(...)`, `_fsm_handle_confirmation(...)`, `deduct_credit(...)` promo tarihini okuyup "sınırsız" davranışı uygular

Veri tarafı (kampanya kaynağı):

- `promo_config.free_unlimited_until` (global kampanya bitişi)
- `wallets.free_unlimited_until` (kullanıcı bazlı alan, global deadline ile normalize ediliyor)

İlgili migration örneği:

- `pazarglobal-frontend/supabase/migrations/20260214_wallets_free_unlimited_global_deadline.sql`

---

## 2) Ücretli Moda Geçiş (Önerilen: önce Supabase-only)

En güvenli ve hızlı geçiş, önce sadece veri tarafını kapatmaktır.

### 2.1 Supabase SQL (kampanyayı kapat)

```sql
-- 1) Global promo bitişini geçmiş bir tarihe çek
update public.promo_config
set free_unlimited_until = now()
where id = 1;

-- 2) Tüm cüzdanların promo süresini de bitir
update public.wallets
set free_unlimited_until = now()
where free_unlimited_until is not null;
```

### 2.2 Doğrulama SQL

```sql
select id, free_unlimited_until from public.promo_config where id = 1;

select
  count(*) as total_wallets,
  count(*) filter (where free_unlimited_until > now()) as active_promo_wallets
from public.wallets;
```

Beklenen sonuç:

- `active_promo_wallets = 0`

### 2.3 Fiyat kontrolü

- Railway env: `LISTING_CREDIT_COST=55` (veya istediğiniz yeni değer)
- Değer değiştirildiyse backend redeploy edin.

---

## 3) Kod Tarafı (Opsiyonel ama tavsiye edilir)

Supabase-only geçiş teknik olarak yeterlidir. Ancak uzun vadede kampanya mantığına artık ihtiyaç yoksa kod sadeleştirme önerilir.

### 3.1 Sadeleştirilecek noktalar

- `services/supabase_client.py`
  - `get_wallet_balance(...)` içindeki promo override bloğu kaldırılabilir
  - `deduct_credits(...)` içindeki promo skip bloğu kaldırılabilir
- `routers/gateway_v3.py`
  - `check_wallet(...)` promo "10^12" gösterimi kaldırılabilir
  - `deduct_credit(...)` promo skip bloğu kaldırılabilir
  - `_fsm_show_confirmation_preview(...)` ve `_fsm_handle_confirmation(...)` içindeki promo tabanlı yüksek bakiye gösterimi kaldırılabilir

### 3.2 Neden opsiyonel?

- Çünkü promo tarihi geçmişse mevcut kod otomatik olarak normal kredi düşümüne döner.
- Yani acil geçiş için kod değişikliği şart değildir.

---

## 4) Geçiş Sonrası Test Senaryoları

1. Bakiyesi yeterli kullanıcı ile ilan yayınla
   - Beklenen: publish başarılı, kredi düşer
2. Bakiyesi yetersiz kullanıcı ile ilan yayınla
   - Beklenen: "bakiye yetersiz" hatası
3. WebChat + WhatsApp kanallarında ayrı ayrı test
   - Beklenen: aynı kredi davranışı
4. Audit kontrolü
   - Beklenen: `deduct_credits` logları görünür, `deduct_credits_skipped_promo` görünmez

---

## 5) Rollback (Gerekirse tekrar ücretsiz moda dön)

```sql
-- Örnek: kampanyayı 30 gün uzat
update public.promo_config
set free_unlimited_until = now() + interval '30 days'
where id = 1;

update public.wallets
set free_unlimited_until = (select free_unlimited_until from public.promo_config where id = 1);
```

---

## 6) Kısa Karar Özeti

- "Hızlı geçiş" için: **Sadece Supabase tarihini geçmişe çekmek yeterli**.
- "Temiz mimari" için: sonrasında promo kod blokları da kaldırılmalı.
- Operasyon sırası: **Supabase güncelle → kısa test → gerekirse kod sadeleştirme**.
