-- 0002_rbac_chat_tables.sql
-- RLS policies for persistent chatbot memory tables.

-- chat_conversations policies
alter table public.chat_conversations enable row level security;

-- select
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_conversations' and policyname='chat_conversations_select_own'
  ) then
    create policy chat_conversations_select_own
      on public.chat_conversations
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- insert
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_conversations' and policyname='chat_conversations_insert_own'
  ) then
    create policy chat_conversations_insert_own
      on public.chat_conversations
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- update
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_conversations' and policyname='chat_conversations_update_own'
  ) then
    create policy chat_conversations_update_own
      on public.chat_conversations
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- delete
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_conversations' and policyname='chat_conversations_delete_own'
  ) then
    create policy chat_conversations_delete_own
      on public.chat_conversations
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- chat_messages policies
alter table public.chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_messages' and policyname='chat_messages_select_own'
  ) then
    create policy chat_messages_select_own
      on public.chat_messages
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_messages' and policyname='chat_messages_insert_own'
  ) then
    create policy chat_messages_insert_own
      on public.chat_messages
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_messages' and policyname='chat_messages_update_own'
  ) then
    create policy chat_messages_update_own
      on public.chat_messages
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='chat_messages' and policyname='chat_messages_delete_own'
  ) then
    create policy chat_messages_delete_own
      on public.chat_messages
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

