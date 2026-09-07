begin;

create extension if not exists pgcrypto;

create table if not exists public.message_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null default 'direct' check (conversation_type in ('direct', 'group')),
  title text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  participant_role text not null default 'member' check (participant_role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique (conversation_id, user_id)
);

create table if not exists public.message_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists message_conversations_created_by_idx
  on public.message_conversations (created_by);

create index if not exists message_conversations_updated_at_idx
  on public.message_conversations (updated_at desc);

create index if not exists message_participants_conversation_id_idx
  on public.message_participants (conversation_id);

create index if not exists message_participants_user_id_idx
  on public.message_participants (user_id);

create index if not exists message_messages_conversation_created_at_idx
  on public.message_messages (conversation_id, created_at);

create index if not exists message_messages_sender_id_idx
  on public.message_messages (sender_id);

create or replace function public.update_message_tables_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_message_conversations_updated_at on public.message_conversations;
create trigger trg_message_conversations_updated_at
before update on public.message_conversations
for each row
execute function public.update_message_tables_updated_at();

drop trigger if exists trg_message_messages_updated_at on public.message_messages;
create trigger trg_message_messages_updated_at
before update on public.message_messages
for each row
execute function public.update_message_tables_updated_at();

create or replace function public.is_message_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.message_participants mp
    where mp.conversation_id = p_conversation_id
      and mp.user_id = p_user_id
  );
$$;

grant execute on function public.is_message_conversation_participant(uuid, uuid)
  to authenticated, service_role;

alter table public.message_conversations enable row level security;
alter table public.message_participants enable row level security;
alter table public.message_messages enable row level security;

drop policy if exists message_conversations_select_participant on public.message_conversations;
create policy message_conversations_select_participant
  on public.message_conversations
  for select
  using (public.is_message_conversation_participant(id, auth.uid()));

drop policy if exists message_conversations_insert_self on public.message_conversations;
create policy message_conversations_insert_self
  on public.message_conversations
  for insert
  with check (auth.uid() = created_by);

drop policy if exists message_conversations_update_owner on public.message_conversations;
create policy message_conversations_update_owner
  on public.message_conversations
  for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists message_conversations_delete_owner on public.message_conversations;
create policy message_conversations_delete_owner
  on public.message_conversations
  for delete
  using (auth.uid() = created_by);

drop policy if exists message_participants_select_participant on public.message_participants;
create policy message_participants_select_participant
  on public.message_participants
  for select
  using (public.is_message_conversation_participant(conversation_id, auth.uid()));

drop policy if exists message_participants_insert_owner on public.message_participants;
create policy message_participants_insert_owner
  on public.message_participants
  for insert
  with check (
    exists (
      select 1
      from public.message_conversations mc
      where mc.id = message_participants.conversation_id
        and mc.created_by = auth.uid()
    )
  );

drop policy if exists message_participants_update_self_or_owner on public.message_participants;
create policy message_participants_update_self_or_owner
  on public.message_participants
  for update
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.message_conversations mc
      where mc.id = message_participants.conversation_id
        and mc.created_by = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1
      from public.message_conversations mc
      where mc.id = message_participants.conversation_id
        and mc.created_by = auth.uid()
    )
  );

drop policy if exists message_participants_delete_self_or_owner on public.message_participants;
create policy message_participants_delete_self_or_owner
  on public.message_participants
  for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.message_conversations mc
      where mc.id = message_participants.conversation_id
        and mc.created_by = auth.uid()
    )
  );

drop policy if exists message_messages_select_participant on public.message_messages;
create policy message_messages_select_participant
  on public.message_messages
  for select
  using (public.is_message_conversation_participant(conversation_id, auth.uid()));

drop policy if exists message_messages_insert_self on public.message_messages;
create policy message_messages_insert_self
  on public.message_messages
  for insert
  with check (
    auth.uid() = sender_id
    and public.is_message_conversation_participant(conversation_id, auth.uid())
  );

drop policy if exists message_messages_update_self on public.message_messages;
create policy message_messages_update_self
  on public.message_messages
  for update
  using (
    auth.uid() = sender_id
    and public.is_message_conversation_participant(conversation_id, auth.uid())
  )
  with check (
    auth.uid() = sender_id
    and public.is_message_conversation_participant(conversation_id, auth.uid())
  );

drop policy if exists message_messages_delete_self on public.message_messages;
create policy message_messages_delete_self
  on public.message_messages
  for delete
  using (
    auth.uid() = sender_id
    and public.is_message_conversation_participant(conversation_id, auth.uid())
  );

grant select, insert, update, delete on public.message_conversations to authenticated, service_role;
grant select, insert, update, delete on public.message_participants to authenticated, service_role;
grant select, insert, update, delete on public.message_messages to authenticated, service_role;

alter table public.message_conversations replica identity full;
alter table public.message_participants replica identity full;
alter table public.message_messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_conversations'
  ) then
    alter publication supabase_realtime add table public.message_conversations;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_participants'
  ) then
    alter publication supabase_realtime add table public.message_participants;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_messages'
  ) then
    alter publication supabase_realtime add table public.message_messages;
  end if;
end $$;

commit;