-- 20260214_rls_lockdown_unused_sensitive_tables.sql
-- Goal: Lock down tables that are not referenced by the app code, but may contain sensitive/admin data.
-- Policy strategy: service_role-only full access.

begin;

-- Enable RLS
alter table if exists public.admin_actions enable row level security;
alter table if exists public.backup_profiles_full enable row level security;
alter table if exists public.backup_user_with_security_jsonb enable row level security;
alter table if exists public.illegal_reports enable row level security;
alter table if exists public.image_safety_flags enable row level security;
alter table if exists public.payments enable row level security;

-- Drop all existing policies (if any)
do $$
declare p record;
begin
  for p in (
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'admin_actions',
        'backup_profiles_full',
        'backup_user_with_security_jsonb',
        'illegal_reports',
        'image_safety_flags',
        'payments'
      )
  ) loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Create service_role full-access policies
create policy "service_role_full_access_admin_actions"
on public.admin_actions
for all
to service_role
using (true)
with check (true);

create policy "service_role_full_access_backup_profiles_full"
on public.backup_profiles_full
for all
to service_role
using (true)
with check (true);

create policy "service_role_full_access_backup_user_with_security_jsonb"
on public.backup_user_with_security_jsonb
for all
to service_role
using (true)
with check (true);

create policy "service_role_full_access_illegal_reports"
on public.illegal_reports
for all
to service_role
using (true)
with check (true);

create policy "service_role_full_access_image_safety_flags"
on public.image_safety_flags
for all
to service_role
using (true)
with check (true);

create policy "service_role_full_access_payments"
on public.payments
for all
to service_role
using (true)
with check (true);

commit;
