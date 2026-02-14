-- 20260214_fix_handle_new_user_profiles_role.sql
-- Goal: Fix handle_new_user() to match current public.profiles schema (uses column `role`, not `user_role`).
-- Also keeps wallet promo provisioning (uses promo_config global deadline if present).

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $$
declare
  promo_deadline timestamptz;
begin
  insert into public.profiles (
    id,
    full_name,
    display_name,
    email,
    role,
    is_verified,
    is_active
  )
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

  -- Use global promo deadline if configured.
  begin
    select free_unlimited_until into promo_deadline
    from public.promo_config
    where id = 1;
  exception when undefined_table then
    promo_deadline := null;
  end;

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
