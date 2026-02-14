-- 20260214_wallets_free_unlimited_90d.sql
-- Goal: Temporarily grant unlimited credits (promo) to all users for 90 days,
-- without requiring a payment integration. This keeps the wallet/credit architecture intact.

begin;

-- 1) Add promo column
alter table if exists public.wallets
  add column if not exists free_unlimited_until timestamptz;

-- 2) Ensure every existing profile has a wallet row (0 balance) and promo window
insert into public.wallets (user_id, balance_bigint, free_unlimited_until)
select p.id, 0, now() + interval '90 days'
from public.profiles p
left join public.wallets w on w.user_id = p.id
where w.user_id is null
on conflict (user_id) do nothing;

-- 3) Grant promo to all existing wallets (do not shorten if it already exists)
update public.wallets
set free_unlimited_until = greatest(
  coalesce(free_unlimited_until, now() + interval '90 days'),
  now() + interval '90 days'
);

-- 4) On new user registration, ensure wallet row exists and promo is set.
--    Keep SECURITY DEFINER and pinned search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $$
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

  insert into public.wallets (user_id, balance_bigint, free_unlimited_until)
  values (new.id, 0, now() + interval '90 days')
  on conflict (user_id) do update
    set free_unlimited_until = greatest(
      coalesce(public.wallets.free_unlimited_until, excluded.free_unlimited_until),
      excluded.free_unlimited_until
    );

  return new;
end;
$$;

commit;
