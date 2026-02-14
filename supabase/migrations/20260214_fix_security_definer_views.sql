-- 20260214_fix_security_definer_views.sql
-- Goal: Fix Supabase Advisor lints for SECURITY DEFINER views by converting to SECURITY INVOKER
-- and restricting external grants.

begin;

-- Convert to SECURITY INVOKER so views do not run with creator privileges (helps prevent RLS bypass).
alter view if exists public.user_wallets set (security_invoker = true);
alter view if exists public.v_cost_savings set (security_invoker = true);
alter view if exists public.v_cache_stats set (security_invoker = true);
alter view if exists public.v_popular_products set (security_invoker = true);
alter view if exists public.session_stats set (security_invoker = true);

-- Remove broad grants from external roles.
revoke all on table public.user_wallets from anon, authenticated, public;
revoke all on table public.v_cost_savings from anon, authenticated, public;
revoke all on table public.v_cache_stats from anon, authenticated, public;
revoke all on table public.v_popular_products from anon, authenticated, public;
revoke all on table public.session_stats from anon, authenticated, public;

-- Allow only backend/service role access.
grant select on table public.user_wallets to service_role;
grant select on table public.v_cost_savings to service_role;
grant select on table public.v_cache_stats to service_role;
grant select on table public.v_popular_products to service_role;
grant select on table public.session_stats to service_role;

commit;
