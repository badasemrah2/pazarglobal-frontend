-- 20260214_rls_user_sessions_service_role.sql
-- Ensure service_role access to user_sessions (used by whatsapp-traffic-controller).

begin;

alter table if exists public.user_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='user_sessions'
      and policyname='service_role_full_access_user_sessions'
  ) then
    execute 'create policy "service_role_full_access_user_sessions" on public.user_sessions for all to service_role using (true) with check (true)';
  end if;
end $$;

commit;
