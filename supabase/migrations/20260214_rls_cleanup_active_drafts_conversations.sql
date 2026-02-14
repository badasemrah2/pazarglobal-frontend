-- 20260214_rls_cleanup_active_drafts_conversations.sql
-- Goal: Avoid breaking the agent/whatsapp flows while removing fragile/unused policies.
-- - active_drafts is backend-managed (service_role). Current policies rely on current_setting('app.user_id'), which we don't set.
-- - conversations appears unused in code; keep service_role access only.
-- - user_sessions is used by whatsapp-traffic-controller via service_role.

begin;

-- ============================================================
-- active_drafts: service_role only (backend/FSM)
-- ============================================================
alter table if exists public.active_drafts enable row level security;

do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'active_drafts'
  ) loop
    execute format('drop policy if exists %I on public.active_drafts', p.policyname);
  end loop;
end $$;

create policy "service_role_full_access_active_drafts"
on public.active_drafts
for all
to service_role
using (true)
with check (true);


-- ============================================================
-- conversations: service_role only (cleanup duplicates / reduce surface area)
-- ============================================================
alter table if exists public.conversations enable row level security;

do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'conversations'
  ) loop
    execute format('drop policy if exists %I on public.conversations', p.policyname);
  end loop;
end $$;

create policy "service_role_full_access_conversations"
on public.conversations
for all
to service_role
using (true)
with check (true);


-- ============================================================
-- user_sessions: service_role needs access (whatsapp-traffic-controller)
-- ============================================================
alter table if exists public.user_sessions enable row level security;

-- Keep any existing policies, but ensure service_role isn't blocked.
create policy if not exists "service_role_full_access_user_sessions"
on public.user_sessions
for all
to service_role
using (true)
with check (true);

commit;
