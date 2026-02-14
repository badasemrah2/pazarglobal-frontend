-- 20260214_rls_fixup_enable_flags.sql
-- Goal: Fix RLS drift by re-enabling RLS flags on critical tables.

begin;

alter table if exists public.audit_logs enable row level security;
alter table if exists public.listings enable row level security;
alter table if exists public.rate_limits enable row level security;
alter table if exists public.user_security enable row level security;
alter table if exists public.wallets enable row level security;
alter table if exists public.wallet_transactions enable row level security;

commit;
