-- 20260214_wallets_free_unlimited_90d_rollback.sql
-- Emergency rollback: remove promo column (keeps wallets intact).
-- NOTE: Dropping the column will remove promo state for all users.

begin;

alter table if exists public.wallets
  drop column if exists free_unlimited_until;

commit;
