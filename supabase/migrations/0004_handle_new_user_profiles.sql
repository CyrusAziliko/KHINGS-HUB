-- 0004_handle_new_user_profiles.sql
-- Automatically provision public.profiles rows when a new auth user is created.
-- Requirements/assumptions:
-- - public.profiles table already exists with columns:
--   id, email, role, status, created_at, updated_at
-- - Do NOT modify the profiles table.

-- Create or replace the trigger function.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert a profile row only if it doesn't already exist.
  insert into public.profiles (
    id,
    email,
    role,
    status,
    created_at,
    updated_at
  )
  select
    new.id,
    new.email,
    'worker'::text,
    'active'::text,
    now(),
    now()
  where not exists (
    select 1
    from public.profiles p
    where p.id = new.id
  );

  return new;
end;
$$;

-- Drop & recreate trigger (idempotent).
drop trigger if exists handle_new_user_on_auth_users
on auth.users;

create trigger handle_new_user_on_auth_users
after insert on auth.users
for each row
execute procedure public.handle_new_user();

