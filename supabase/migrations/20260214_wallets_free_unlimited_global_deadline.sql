-- 20260214_wallets_free_unlimited_global_deadline.sql
-- Goal: Convert promo from per-user rolling window to a global campaign deadline for everyone.
-- Strategy:
--   - Create a single-row promo config table holding the campaign end timestamp.
--   - Ensure ALL wallets use that same timestamp.
--   - Ensure handle_new_user assigns the same global timestamp to new users.

begin;

create table if not exists public.promo_config (
  id integer primary key default 1,
  free_unlimited_until timestamptz not null,
  constraint promo_config_singleton check (id = 1)
);

-- Lock down promo_config (service-only)
alter table public.promo_config enable row level security;

do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'promo_config'
  ) loop
    execute format('drop policy if exists %I on public.promo_config', p.policyname);
  end loop;
end $$;

create policy "service_role_full_access_promo_config"
on public.promo_config
for all
to service_role
using (true)
with check (true);

revoke all on table public.promo_config from anon, authenticated, public;
grant select, insert, update, delete on table public.promo_config to service_role;

-- Set the global deadline once.
-- Default: reuse existing max(wallets.free_unlimited_until) so nothing changes for current users.
insert into public.promo_config (id, free_unlimited_until)
values (
  1,
  coalesce(
    (select max(free_unlimited_until) from public.wallets),
    now() + interval '90 days'
  )
)
on conflict (id) do update
set free_unlimited_until = excluded.free_unlimited_until;

-- Normalize all wallets to the same global deadline.
update public.wallets
set free_unlimited_until = (select free_unlimited_until from public.promo_config where id = 1);

-- Update new-user hook to use global deadline (not rolling now()+90).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $$
declare
  promo_deadline timestamptz;
begin
  insert into public.profiles (id, full_name, display_name, email, user_role, is_verified, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    new.email,
    'buyer',
    false,
    true
  )
  on conflict (id) do nothing;

  select free_unlimited_until into promo_deadline
  from public.promo_config
  where id = 1;

  if promo_deadline is null then
    promo_deadline := now() + interval '90 days';
  end if;

  insert into public.wallets (user_id, balance_bigint, free_unlimited_until)
  values (new.id, 0, promo_deadline)
  on conflict (user_id) do update
    set free_unlimited_until = promo_deadline;

  return new;
end;
$$;

commit;
