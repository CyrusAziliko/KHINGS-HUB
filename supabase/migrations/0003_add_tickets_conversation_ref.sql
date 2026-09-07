-- Phase 7.3.1
-- Add tickets.conversation_id reference to public.conversations
-- Requirements:
-- - No backfill
-- - tickets.conversation_id nullable
-- - FK ON DELETE SET NULL
-- - Add index
-- - RLS updates if required

begin;

-- Ensure uuid generator available (if needed by FK targets / future migrations)
create extension if not exists pgcrypto;

-- Add column
alter table public.tickets
  add column if not exists conversation_id uuid;

-- FK relationship
-- Tickets are enterprise audit records; do not delete them when a conversation is removed.
alter table public.tickets
  drop constraint if exists tickets_conversation_id_fkey;

alter table public.tickets
  add constraint tickets_conversation_id_fkey
  foreign key (conversation_id)
  references public.conversations(id)
  on delete set null;

-- Index for lookup performance
create index if not exists tickets_conversation_id_idx
  on public.tickets (conversation_id);

commit;

