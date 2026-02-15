-- 20260215_roles_admin_assist_user.sql
-- Goal: Standardize roles to: admin, assist, user.
-- - New users default to role='user'
-- - Existing roles are migrated:
--     buyer/seller -> user
--     support      -> assist

begin;

-- Migrate role column if present
do $do$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    execute $sql$
      update public.profiles
      set role = case
        when role is null or btrim(role) = '' then 'user'
        when lower(role) in ('buyer', 'seller', 'user') then 'user'
        when lower(role) in ('support', 'asist', 'assistant') then 'assist'
        when lower(role) = 'admin' then 'admin'
        when lower(role) = 'assist' then 'assist'
        else role
      end
      where role is not null;
    $sql$;
  end if;
end $do$;

-- Migrate legacy user_role column if present
do $do$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'user_role'
  ) then
    execute $sql$
      update public.profiles
      set user_role = case
        when user_role is null or btrim(user_role) = '' then 'user'
        when lower(user_role) in ('buyer', 'seller', 'user') then 'user'
        when lower(user_role) in ('support', 'asist', 'assistant') then 'assist'
        when lower(user_role) = 'admin' then 'admin'
        when lower(user_role) = 'assist' then 'assist'
        else user_role
      end
      where user_role is not null;
    $sql$;
  end if;
end $do$;

-- Ensure handle_new_user assigns role='user'
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
    'user',
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
