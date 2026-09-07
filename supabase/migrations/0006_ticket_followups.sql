-- 0006_ticket_followups.sql
-- Ticket Follow-Up & Resolution Confirmation
-- 
-- When an admin sets a ticket to "Resolved", a follow-up record is created
-- so the worker can Confirm Resolved, Reopen, or Remind Me Later.
--
-- Relationship: tickets.worker_id -> profiles.id -> auth.users.id (all same UUID)
-- tickets.assigned_admin also stores a profiles.id for the admin who owns the ticket.

begin;

-- ==============================
-- Create ticket_followups table
-- ==============================
create table if not exists public.ticket_followups (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','confirmed','reopened','remind_later')),
  remind_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Enforce one follow-up record per ticket
  constraint ticket_followups_ticket_id_key unique (ticket_id)
);

-- Indexes for common queries
create index if not exists idx_ticket_followups_worker_id
  on public.ticket_followups (worker_id);

create index if not exists idx_ticket_followups_status
  on public.ticket_followups (status);

create index if not exists idx_ticket_followups_remind_at
  on public.ticket_followups (remind_at);

-- ==============================
-- Enable Row Level Security
-- ==============================
alter table public.ticket_followups enable row level security;

-- ==============================
-- RLS Policies
-- ==============================

-- Workers can SELECT only their own follow-ups
create policy ticket_followups_select_worker
  on public.ticket_followups
  for select
  using (auth.uid() = worker_id);

-- Admins can SELECT all follow-ups (for admin dashboard visibility)
create policy ticket_followups_select_admin
  on public.ticket_followups
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Workers can INSERT their own follow-ups
create policy ticket_followups_insert_worker
  on public.ticket_followups
  for insert
  with check (auth.uid() = worker_id);

-- Admins can INSERT follow-ups for any ticket (needed when an admin
-- marks a ticket as "Resolved" — the INSERT runs as the admin, not the worker)
create policy ticket_followups_insert_admin
  on public.ticket_followups
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Workers can UPDATE their own follow-ups (for Confirm / Reopen / Remind)
create policy ticket_followups_update_worker
  on public.ticket_followups
  for update
  using (auth.uid() = worker_id)
  with check (auth.uid() = worker_id);

-- Admins can UPDATE any follow-up (e.g. to clear stale records)
create policy ticket_followups_update_admin
  on public.ticket_followups
  for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ==============================
-- Auto-update updated_at trigger
-- ==============================
create or replace function public.update_ticket_followups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ticket_followups_updated_at on public.ticket_followups;

create trigger trg_ticket_followups_updated_at
  before update on public.ticket_followups
  for each row
  execute function public.update_ticket_followups_updated_at();

commit;

