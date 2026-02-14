-- 20260214_rls_hardening_rollback.sql
-- Rolls back to a permissive state (NOT recommended for production).

begin;

-- Disable RLS (emergency)
alter table if exists public.listings disable row level security;
alter table if exists public.user_security disable row level security;
alter table if exists public.audit_logs disable row level security;
alter table if exists public.rate_limits disable row level security;
alter table if exists public.wallets disable row level security;
alter table if exists public.wallet_transactions disable row level security;

commit;
