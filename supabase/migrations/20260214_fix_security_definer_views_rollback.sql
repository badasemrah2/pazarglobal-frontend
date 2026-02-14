-- 20260214_fix_security_definer_views_rollback.sql
-- Emergency rollback: reset SECURITY INVOKER options and re-grant SELECT to anon/authenticated.

begin;

alter view if exists public.user_wallets reset (security_invoker);
alter view if exists public.v_cost_savings reset (security_invoker);
alter view if exists public.v_cache_stats reset (security_invoker);
alter view if exists public.v_popular_products reset (security_invoker);
alter view if exists public.session_stats reset (security_invoker);

grant select on table public.user_wallets to anon, authenticated;
grant select on table public.v_cost_savings to anon, authenticated;
grant select on table public.v_cache_stats to anon, authenticated;
grant select on table public.v_popular_products to anon, authenticated;
grant select on table public.session_stats to anon, authenticated;

commit;
