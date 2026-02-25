-- 20260217_auth_users_trigger_profiles_backfill.sql
-- Goal:
-- 1) Ensure a trigger exists to automatically create a row in public.profiles when a new auth.users row is created.
-- 2) Keep handle_new_user() compatible with evolving profiles schema (role vs user_role vs neither).
-- 3) Backfill public.profiles (and wallets) for any already-created auth.users rows missing a profile.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $$
declare
  promo_deadline timestamptz;
  has_role boolean;
  has_user_role boolean;
  has_wallet_promo boolean;
  has_profiles_phone boolean;
  has_profiles_email boolean;
  has_profiles_full_name boolean;
  has_profiles_display_name boolean;
  has_profiles_is_verified boolean;
  has_profiles_is_active boolean;
  col_sql text;
  val_sql text;
  phone_value text;
begin
  -- Detect schema differences safely.
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) into has_role;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_role'
  ) into has_user_role;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) into has_profiles_phone;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) into has_profiles_email;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) into has_profiles_full_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) into has_profiles_display_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_verified'
  ) into has_profiles_is_verified;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_active'
  ) into has_profiles_is_active;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'wallets' and column_name = 'free_unlimited_until'
  ) into has_wallet_promo;

  -- Insert profile row with only the columns that exist (idempotent),
  -- to avoid breaking signup if the schema differs (or has NOT NULL constraints).
  col_sql := 'id';
  val_sql := format('%L', new.id);

  -- Phone can come from Auth phone column (phone auth) or signup metadata.
  phone_value := nullif(new.raw_user_meta_data->>'phone', '');
  if phone_value is null then
    phone_value := nullif(new.phone, '');
  end if;

  if has_profiles_phone then
    col_sql := col_sql || ', phone';
    val_sql := val_sql || ', ' || format('%L', phone_value);
  end if;

  if has_profiles_full_name then
    col_sql := col_sql || ', full_name';
    val_sql := val_sql || ', ' || format('%L', coalesce(new.raw_user_meta_data->>'full_name', ''));
  end if;

  if has_profiles_display_name then
    col_sql := col_sql || ', display_name';
    val_sql := val_sql || ', ' || format('%L', coalesce(new.raw_user_meta_data->>'display_name', ''));
  end if;

  if has_profiles_email then
    col_sql := col_sql || ', email';
    val_sql := val_sql || ', ' || format('%L', new.email);
  end if;

  if has_role then
    col_sql := col_sql || ', role';
    val_sql := val_sql || ', ' || format('%L', 'user');
  elsif has_user_role then
    col_sql := col_sql || ', user_role';
    val_sql := val_sql || ', ' || format('%L', 'user');
  end if;

  if has_profiles_is_verified then
    col_sql := col_sql || ', is_verified';
    val_sql := val_sql || ', false';
  end if;

  if has_profiles_is_active then
    col_sql := col_sql || ', is_active';
    val_sql := val_sql || ', true';
  end if;

  execute 'insert into public.profiles (' || col_sql || ') values (' || val_sql || ') on conflict (id) do nothing';

  -- Determine promo deadline (if promo_config exists).
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

  -- Ensure wallet row exists (idempotent).
  if has_wallet_promo then
    insert into public.wallets (user_id, balance_bigint, free_unlimited_until)
    values (new.id, 0, promo_deadline)
    on conflict (user_id) do update
      set free_unlimited_until = promo_deadline;
  else
    insert into public.wallets (user_id, balance_bigint)
    values (new.id, 0)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Ensure trigger exists on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill for already-created users that are missing a profile.
do $$
declare
  has_role boolean;
  has_user_role boolean;
  has_profiles_phone boolean;
  has_profiles_email boolean;
  has_profiles_full_name boolean;
  has_profiles_display_name boolean;
  has_profiles_is_verified boolean;
  has_profiles_is_active boolean;
  has_wallet_promo boolean;
  promo_deadline timestamptz;
  r record;
  col_sql text;
  val_sql text;
  phone_value text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) into has_role;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_role'
  ) into has_user_role;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) into has_profiles_phone;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) into has_profiles_email;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) into has_profiles_full_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) into has_profiles_display_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_verified'
  ) into has_profiles_is_verified;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_active'
  ) into has_profiles_is_active;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'wallets' and column_name = 'free_unlimited_until'
  ) into has_wallet_promo;

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

  -- Backfill missing profiles by inserting the columns that actually exist.
  for r in
    select u.id, u.email, u.raw_user_meta_data, u.phone
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    col_sql := 'id';
    val_sql := format('%L', r.id);

    phone_value := nullif(r.raw_user_meta_data->>'phone', '');
    if phone_value is null then
      phone_value := nullif(r.phone, '');
    end if;

    if has_profiles_phone then
      col_sql := col_sql || ', phone';
      val_sql := val_sql || ', ' || format('%L', phone_value);
    end if;

    if has_profiles_full_name then
      col_sql := col_sql || ', full_name';
      val_sql := val_sql || ', ' || format('%L', coalesce(r.raw_user_meta_data->>'full_name', ''));
    end if;

    if has_profiles_display_name then
      col_sql := col_sql || ', display_name';
      val_sql := val_sql || ', ' || format('%L', coalesce(r.raw_user_meta_data->>'display_name', ''));
    end if;

    if has_profiles_email then
      col_sql := col_sql || ', email';
      val_sql := val_sql || ', ' || format('%L', r.email);
    end if;

    if has_role then
      col_sql := col_sql || ', role';
      val_sql := val_sql || ', ' || format('%L', 'user');
    elsif has_user_role then
      col_sql := col_sql || ', user_role';
      val_sql := val_sql || ', ' || format('%L', 'user');
    end if;

    if has_profiles_is_verified then
      col_sql := col_sql || ', is_verified';
      val_sql := val_sql || ', false';
    end if;

    if has_profiles_is_active then
      col_sql := col_sql || ', is_active';
      val_sql := val_sql || ', true';
    end if;

    execute 'insert into public.profiles (' || col_sql || ') values (' || val_sql || ') on conflict (id) do nothing';
  end loop;

  -- Backfill wallets for any profiles that still don't have one.
  if has_wallet_promo then
    insert into public.wallets (user_id, balance_bigint, free_unlimited_until)
    select p.id, 0, promo_deadline
    from public.profiles p
    left join public.wallets w on w.user_id = p.id
    where w.user_id is null
    on conflict (user_id) do update
      set free_unlimited_until = promo_deadline;
  else
    insert into public.wallets (user_id, balance_bigint)
    select p.id, 0
    from public.profiles p
    left join public.wallets w on w.user_id = p.id
    where w.user_id is null
    on conflict (user_id) do nothing;
  end if;
end;
$$;

commit;
