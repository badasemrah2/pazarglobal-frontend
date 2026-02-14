-- 20260214_rls_cleanup_active_drafts_conversations_rollback.sql
-- Emergency rollback: disable RLS for the touched tables.

begin;

alter table if exists public.active_drafts disable row level security;
alter table if exists public.conversations disable row level security;
alter table if exists public.user_sessions disable row level security;

commit;
