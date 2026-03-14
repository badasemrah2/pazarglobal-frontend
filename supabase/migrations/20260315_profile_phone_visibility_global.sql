-- ============================================================
-- Migration: Profile-level phone visibility (global)
-- Date: 2026-03-15
-- ============================================================
-- Amaç:
-- - Telefon görünürlüğünü ilan bazından profile bazına taşımak
-- - Profil ayarı değiştiğinde tüm ilanlara otomatik yansıtmak
-- ============================================================

begin;

alter table public.profiles
  add column if not exists phone_visibility text not null default 'public'
    check (phone_visibility in ('public', 'hidden')),
  add column if not exists name_visibility text not null default 'public'
    check (name_visibility in ('public', 'hidden'));

comment on column public.profiles.phone_visibility is 'public=telefon görünür, hidden=telefon gizli (site içi mesaj)';
comment on column public.profiles.name_visibility is 'public=isim görünür, hidden=isim gizli';

-- Mevcut ilanlar için bir kez profile değerine senkronla
update public.listings l
set
  phone_visibility = coalesce(p.phone_visibility, 'public'),
  name_visibility  = coalesce(p.name_visibility, 'public')
from public.profiles p
where p.id = l.user_id;

-- Profil görünürlüğü değişince ilanlara otomatik yansıt
create or replace function public.sync_listings_visibility_from_profile()
returns trigger
language plpgsql
as $$
begin
  if new.phone_visibility is distinct from old.phone_visibility
     or new.name_visibility is distinct from old.name_visibility then
    update public.listings
    set
      phone_visibility = new.phone_visibility,
      name_visibility  = new.name_visibility,
      updated_at       = now()
    where user_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_listings_visibility_from_profile on public.profiles;
create trigger trg_sync_listings_visibility_from_profile
  after update on public.profiles
  for each row
  execute function public.sync_listings_visibility_from_profile();

commit;
