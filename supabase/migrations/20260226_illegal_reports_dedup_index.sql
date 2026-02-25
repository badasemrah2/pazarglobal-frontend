-- 20260226_illegal_reports_dedup_index.sql
-- Aynı kullanıcının aynı ilanı tekrar tekrar şikayet etmesini DB seviyesinde engeller.

create unique index if not exists idx_illegal_reports_reporter_listing_unique
on public.illegal_reports (reporter_user, listing_id)
where reporter_user is not null and listing_id is not null;
