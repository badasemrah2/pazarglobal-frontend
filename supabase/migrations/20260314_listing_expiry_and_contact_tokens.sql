-- ============================================================
-- Migration: Listing Expiry Enforcement + Contact Tokens
-- Date: 2026-03-14
-- ============================================================
-- Bu migration 3 şeyi yapar:
--   1) Yeni ilanlar publish edilirken expires_at = now() + 30 gün otomatik set edilir (trigger)
--   2) expires_at geçmiş ve status='active' ilanları otomatik 'expired' yapar (pg_cron JOB)
--   3) contact_tokens tablosunu oluşturur (ilan süresiyle senkron token sistemi)
-- ============================================================

-- -------------------------------------------------------
-- BÖLÜM 1: expires_at otomatik doldurma (INSERT trigger)
-- -------------------------------------------------------
-- Yeni ilan eklenirken expires_at NULL ise 30 gün sonrası atanır.
-- Böylece publish_listing her seferinde expires_at göndermek zorunda kalmaz.

CREATE OR REPLACE FUNCTION public.set_listing_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sadece NULL ise set et; açıkça verilmişse dokunma
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at := now() + INTERVAL '30 days';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_listing_expires_at ON public.listings;
CREATE TRIGGER trg_set_listing_expires_at
    BEFORE INSERT ON public.listings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_listing_expires_at();

-- -------------------------------------------------------
-- BÖLÜM 2: Süresi dolan ilanları otomatik pasife al
-- -------------------------------------------------------
-- İki yöntem sunulmuştur. İkisi de aynı işi yapar, birini seçin.
--
-- YÖNTEM A: pg_cron (Supabase Pro / Enterprise planında aktif)
--           Her gece 03:00'de çalışır.
-- YÖNTEM B: Supabase Edge Function veya harici cron çağrısı için
--           doğrudan çalıştırılabilir SQL fonksiyon.
--
-- Her iki yöntemde de aşağıdaki fonksiyon kullanılır:

CREATE OR REPLACE FUNCTION public.expire_stale_listings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.listings
    SET
        status     = 'expired',
        updated_at = now()
    WHERE
        status     = 'active'
        AND expires_at IS NOT NULL
        AND expires_at < now();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Audit log kaydı (audit_logs tablosu varsa)
    BEGIN
        INSERT INTO public.audit_logs (action, metadata, created_at)
        VALUES (
            'auto_expire_listings',
            jsonb_build_object('expired_count', v_count, 'ran_at', now()),
            now()
        );
    EXCEPTION WHEN OTHERS THEN
        -- audit_logs yoksa sessizce geç
        NULL;
    END;

    RETURN v_count;
END;
$$;

-- YÖNTEM A: pg_cron (sadece pg_cron extension aktifse uncomment edin)
-- SELECT cron.schedule(
--     'expire-listings-nightly',   -- job adı
--     '0 3 * * *',                  -- her gece 03:00 UTC
--     $$ SELECT public.expire_stale_listings(); $$
-- );

-- YÖNTEM B: Manuel / Edge Function çağrısı için hiçbir şey eklemenize gerek yok.
-- Edge Function içinden veya Supabase Dashboard → SQL Editor'dan şu komutu çalıştırın:
--   SELECT public.expire_stale_listings();

-- -------------------------------------------------------
-- BÖLÜM 3: Mevcut süresi dolmuş ilanları düzelt (tek seferlik)
-- -------------------------------------------------------
-- Bu satır migration çalıştırıldığında mevcut eski ilanları da expired yapar.
-- Eğer süresi dolmuş ilanları active tutmak istiyorsanız yorum satırı yapın.

UPDATE public.listings
SET
    status     = 'expired',
    updated_at = now()
WHERE
    status     = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();

-- -------------------------------------------------------
-- BÖLÜM 4: contact_tokens tablosu
-- -------------------------------------------------------
-- Telefon/isim gizleyen ilan sahipleri için iletişim token sistemi.
-- Token ömrü = ilanın expires_at değeri (senkron).
-- İlan silinince/expire olunca token da geçersiz kılınır (ON DELETE CASCADE + trigger).

CREATE TABLE IF NOT EXISTS public.contact_tokens (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id      uuid        NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    owner_user_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token           text        NOT NULL UNIQUE,   -- gen_random_uuid()::text veya encode(gen_random_bytes(24),'hex')
    expires_at      timestamptz NOT NULL,          -- = listings.expires_at ile senkron
    revoked         boolean     NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_tokens_token       ON public.contact_tokens(token);
CREATE INDEX IF NOT EXISTS idx_contact_tokens_listing_id  ON public.contact_tokens(listing_id);
CREATE INDEX IF NOT EXISTS idx_contact_tokens_owner       ON public.contact_tokens(owner_user_id);

-- -------------------------------------------------------
-- BÖLÜM 5: listings.expires_at güncellenince token da güncelle
-- -------------------------------------------------------
-- İlan süresi uzatılırsa token otomatik senkronize edilir.

CREATE OR REPLACE FUNCTION public.sync_contact_token_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- expires_at değişmişse token tablosunu güncelle
    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        UPDATE public.contact_tokens
        SET
            expires_at = NEW.expires_at,
            updated_at = now()
        WHERE
            listing_id = NEW.id
            AND revoked = false;
    END IF;

    -- İlan expired/deleted/hidden yapılırsa token da revoke et
    IF NEW.status IN ('expired', 'deleted', 'hidden')
       AND OLD.status NOT IN ('expired', 'deleted', 'hidden') THEN
        UPDATE public.contact_tokens
        SET
            revoked    = true,
            updated_at = now()
        WHERE
            listing_id = NEW.id
            AND revoked = false;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_token_expiry ON public.listings;
CREATE TRIGGER trg_sync_contact_token_expiry
    AFTER UPDATE ON public.listings
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_contact_token_expiry();

-- -------------------------------------------------------
-- BÖLÜM 6: RLS politikaları
-- -------------------------------------------------------

ALTER TABLE public.contact_tokens ENABLE ROW LEVEL SECURITY;

-- Token sahibi kendi tokenlarını görebilir
CREATE POLICY "owner_select_tokens"
    ON public.contact_tokens FOR SELECT
    USING (owner_user_id = auth.uid());

-- Token sahibi kendi tokenlarını oluşturabilir
CREATE POLICY "owner_insert_tokens"
    ON public.contact_tokens FOR INSERT
    WITH CHECK (owner_user_id = auth.uid());

-- Token sahibi kendi tokenlarını iptal edebilir (revoke)
CREATE POLICY "owner_update_tokens"
    ON public.contact_tokens FOR UPDATE
    USING (owner_user_id = auth.uid());

-- Service role her şeyi yapabilir (agent backend)
CREATE POLICY "service_role_all_tokens"
    ON public.contact_tokens FOR ALL
    USING (auth.role() = 'service_role');

-- -------------------------------------------------------
-- BÖLÜM 7: listings tablosuna phone/name görünürlük alanları
-- -------------------------------------------------------
-- Henüz yoksa ekle (idempotent).

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS phone_visibility text NOT NULL DEFAULT 'public'
        CHECK (phone_visibility IN ('public', 'hidden')),
    ADD COLUMN IF NOT EXISTS name_visibility  text NOT NULL DEFAULT 'public'
        CHECK (name_visibility  IN ('public', 'hidden'));

COMMENT ON COLUMN public.listings.phone_visibility IS 'public=telefon göster, hidden=gizle (sadece site içi mesaj)';
COMMENT ON COLUMN public.listings.name_visibility  IS 'public=isim göster, hidden=gizle';

-- -------------------------------------------------------
-- ÖZET
-- -------------------------------------------------------
-- Çalıştırdıktan sonra kontrol:
--   SELECT COUNT(*) FROM listings WHERE status='expired';   -- süresi dolmuş ilanlar
--   SELECT COUNT(*) FROM contact_tokens;                    -- token tablosu boş, normal
--   SELECT phone_visibility, COUNT(*) FROM listings GROUP BY 1; -- hepsi 'public', normal
-- -------------------------------------------------------
