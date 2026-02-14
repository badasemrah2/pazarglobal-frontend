-- 20260214_rls_hardening.sql
-- Goal: Harden RLS without breaking application flows by routing unsafe browser writes through Edge Functions.

begin;

-- ============================================================
-- listings
-- ============================================================
alter table if exists public.listings enable row level security;

do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'listings'
  ) loop
    execute format('drop policy if exists %I on public.listings', p.policyname);
  end loop;
end $$;

-- Public can read visible listings (match frontend behavior: active/published/null are visible)
create policy "public_read_visible_listings"
on public.listings
for select
to public
using (
  status is null
  or status = 'active'
  or status = 'published'
);

-- Authenticated: own listings (draft/any status)
create policy "authenticated_select_own_listings"
on public.listings
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy "authenticated_insert_own_listings"
on public.listings
for insert
to authenticated
with check (
  auth.uid() = user_id
);

create policy "authenticated_update_own_listings"
on public.listings
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "authenticated_delete_own_listings"
on public.listings
for delete
to authenticated
using (
  auth.uid() = user_id
);

create policy "service_role_full_access_listings"
on public.listings
for all
to service_role
using (true)
with check (true);


-- ============================================================
-- user_security
-- ============================================================
alter table if exists public.user_security enable row level security;

do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'user_security'
  ) loop
    execute format('drop policy if exists %I on public.user_security', p.policyname);
  end loop;
end $$;

create policy "service_role_full_access_user_security"
on public.user_security
for all
to service_role
using (true)
with check (true);

create policy "authenticated_read_own_user_security"
on public.user_security
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy "authenticated_update_own_user_security"
on public.user_security
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);


-- ============================================================
-- audit_logs
-- ============================================================
alter table if exists public.audit_logs enable row level security;

do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'audit_logs'
  ) loop
    execute format('drop policy if exists %I on public.audit_logs', p.policyname);
  end loop;
end $$;

create policy "service_role_insert_audit_logs"
on public.audit_logs
for insert
to service_role
with check (true);

-- Authenticated users can view their own logs
create policy "authenticated_view_own_audit_logs"
on public.audit_logs
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- rate_limits
-- ============================================================
alter table if exists public.rate_limits enable row level security;

do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'rate_limits'
  ) loop
    execute format('drop policy if exists %I on public.rate_limits', p.policyname);
  end loop;
end $$;

create policy "service_role_full_access_rate_limits"
on public.rate_limits
for all
to service_role
using (true)
with check (true);

create policy "authenticated_view_own_rate_limits"
on public.rate_limits
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- wallets + wallet_transactions
-- ============================================================
alter table if exists public.wallets enable row level security;
alter table if exists public.wallet_transactions enable row level security;

do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'wallets'
  ) loop
    execute format('drop policy if exists %I on public.wallets', p.policyname);
  end loop;
end $$;

do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'wallet_transactions'
  ) loop
    execute format('drop policy if exists %I on public.wallet_transactions', p.policyname);
  end loop;
end $$;

create policy "service_role_full_access_wallets"
on public.wallets
for all
to service_role
using (true)
with check (true);

create policy "authenticated_read_own_wallets"
on public.wallets
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy "service_role_full_access_wallet_transactions"
on public.wallet_transactions
for all
to service_role
using (true)
with check (true);

create policy "authenticated_read_own_wallet_transactions"
on public.wallet_transactions
for select
to authenticated
using (
  auth.uid() = user_id
);

commit;
