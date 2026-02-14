-- 20260214_rls_lockdown_unused_sensitive_tables_rollback.sql
-- Emergency rollback: disables RLS on tables locked down by 20260214_rls_lockdown_unused_sensitive_tables.sql

begin;

alter table if exists public.admin_actions disable row level security;
alter table if exists public.backup_profiles_full disable row level security;
alter table if exists public.backup_user_with_security_jsonb disable row level security;
alter table if exists public.illegal_reports disable row level security;
alter table if exists public.image_safety_flags disable row level security;
alter table if exists public.payments disable row level security;

commit;
