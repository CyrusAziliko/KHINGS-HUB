-- 0001_create_chat_conversations_and_messages.sql
-- Creates persistent AI chatbot memory tables.

-- Enable required extension for gen_random_uuid()
create extension if not exists pgcrypto;

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  created_at timestamp with time zone default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  conversation_id uuid references public.chat_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamp with time zone default now()
);

-- Indexes for performance
create index if not exists chat_messages_user_id_idx on public.chat_messages (user_id);
create index if not exists chat_messages_conversation_id_idx on public.chat_messages (conversation_id);
create index if not exists chat_messages_created_at_idx on public.chat_messages (created_at);

-- RLS (policies added in a separate migration to keep this one focused)
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;


