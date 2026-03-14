-- ============================================================
-- Migration: Listing Contact Messaging Core (MVP)
-- Date: 2026-03-14
-- ============================================================
-- Amaç:
-- 1) İlan bazlı site içi mesajlaşma tabloları
-- 2) contact_tokens için tek aktif token kuralı
-- 3) service_role üzerinden güvenli backend erişimi
-- ============================================================

begin;

-- ------------------------------------------------------------
-- contact_tokens: listing başına tek aktif token (revoked=false)
-- ------------------------------------------------------------
create unique index if not exists uq_contact_tokens_listing_active
on public.contact_tokens(listing_id)
where revoked = false;

-- ------------------------------------------------------------
-- listing_conversations
-- ------------------------------------------------------------
create table if not exists public.listing_conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  contact_token_id uuid references public.contact_tokens(id) on delete set null,
  sender_user_id uuid references public.profiles(id) on delete set null,
  sender_session_id text,
  sender_name text,
  source_channel text not null default 'web',
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  owner_unread_count int not null default 0,
  buyer_unread_count int not null default 0,
  is_blocked_by_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listing_conversations_owner_last
  on public.listing_conversations(owner_user_id, last_message_at desc);

create index if not exists idx_listing_conversations_listing
  on public.listing_conversations(listing_id);

create index if not exists idx_listing_conversations_sender_session
  on public.listing_conversations(sender_session_id)
  where sender_session_id is not null;

-- ------------------------------------------------------------
-- listing_messages
-- ------------------------------------------------------------
create table if not exists public.listing_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.listing_conversations(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  sender_role text not null check (sender_role in ('buyer','owner','system')),
  body text not null,
  created_at timestamptz not null default now(),
  read_by_owner boolean not null default false,
  read_by_buyer boolean not null default false
);

create index if not exists idx_listing_messages_conversation_created
  on public.listing_messages(conversation_id, created_at asc);

create index if not exists idx_listing_messages_listing
  on public.listing_messages(listing_id, created_at desc);

-- ------------------------------------------------------------
-- RLS: backend service_role full access (MVP)
-- ------------------------------------------------------------
alter table public.listing_conversations enable row level security;
alter table public.listing_messages enable row level security;

-- drop existing policies safely
DO $$
DECLARE p record;
BEGIN
  FOR p IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' and tablename='listing_conversations'
  ) LOOP
    EXECUTE format('drop policy if exists %I on public.listing_conversations', p.policyname);
  END LOOP;

  FOR p IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' and tablename='listing_messages'
  ) LOOP
    EXECUTE format('drop policy if exists %I on public.listing_messages', p.policyname);
  END LOOP;
END $$;

create policy "service_role_full_access_listing_conversations"
on public.listing_conversations
for all
to service_role
using (true)
with check (true);

create policy "service_role_full_access_listing_messages"
on public.listing_messages
for all
to service_role
using (true)
with check (true);

commit;
