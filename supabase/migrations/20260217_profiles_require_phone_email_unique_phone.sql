-- 20260217_profiles_require_phone_email_unique_phone.sql
-- Goal:
-- - Enforce WhatsApp-first identity: public.profiles.phone is REQUIRED and UNIQUE.
-- - Enforce public.profiles.email is REQUIRED.
-- - Normalize phone values to a consistent +90... format before enforcing uniqueness.
--
-- Notes:
-- - This migration will RAISE EXCEPTION if existing data violates the constraints.
-- - Fix the offending rows (NULL/blank/duplicates) and re-run.

begin;

-- Normalize a phone number to +90XXXXXXXXXX (digits only with + prefix).
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $$
declare
  v text;
begin
  if p_phone is null then
    return null;
  end if;

  v := btrim(p_phone);
  if v = '' then
    return null;
  end if;

  -- Keep digits only
  v := regexp_replace(v, '[^0-9]', '', 'g');

  -- Trim leading 0 for TR local format
  if v ~ '^0' then
    v := substring(v from 2);
  end if;

  -- Ensure country code 90
  if v !~ '^90' then
    v := '90' || v;
  end if;

  return '+' || v;
end;
$$;

-- Trigger function to normalize phone on insert/update.
create or replace function public.normalize_phone_on_insert()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'extensions', 'pg_temp'
as $$
begin
  if new.phone is null or btrim(new.phone) = '' then
    return new;
  end if;

  new.phone := public.normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists normalize_phone_trigger on public.profiles;
create trigger normalize_phone_trigger
  before insert or update of phone
  on public.profiles
  for each row
  execute function public.normalize_phone_on_insert();

-- Backfill normalization for existing rows.
update public.profiles
set phone = public.normalize_phone(phone)
where phone is not null and btrim(phone) <> '';

update public.profiles
set email = nullif(btrim(email), '')
where email is not null;

-- Preflight checks: phone/email must be present
do $$
declare
  missing_phone_count int;
  missing_email_count int;
  duplicate_phone_count int;
begin
  select count(*) into missing_phone_count
  from public.profiles
  where phone is null or btrim(phone) = '';

  if missing_phone_count > 0 then
    raise exception 'Cannot enforce NOT NULL on public.profiles.phone: % rows have NULL/blank phone. Fix those rows first.', missing_phone_count;
  end if;

  select count(*) into missing_email_count
  from public.profiles
  where email is null or btrim(email) = '';

  if missing_email_count > 0 then
    raise exception 'Cannot enforce NOT NULL on public.profiles.email: % rows have NULL/blank email. Fix those rows first.', missing_email_count;
  end if;

  select count(*) into duplicate_phone_count
  from (
    select phone
    from public.profiles
    group by phone
    having count(*) > 1
  ) d;

  if duplicate_phone_count > 0 then
    raise exception 'Cannot enforce UNIQUE on public.profiles.phone: % duplicate phone values exist. Resolve duplicates first.', duplicate_phone_count;
  end if;
end;
$$;

-- Enforce constraints.
alter table public.profiles
  alter column phone set not null,
  alter column email set not null;

-- Prefer an index for uniqueness (and ease of existence checks).
create unique index if not exists profiles_phone_unique_idx
  on public.profiles (phone);

commit;
