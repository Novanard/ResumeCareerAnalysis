-- Candidate profiles are owned by Supabase Auth users. The backend uses its
-- service-role client for writes; authenticated clients may only read their
-- own profile.
create table if not exists public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text,
  headline text,
  summary text,
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.candidate_profiles enable row level security;

revoke all on table public.candidate_profiles from anon, authenticated;
grant select on table public.candidate_profiles to authenticated;

drop policy if exists "Candidates can view their own profile"
  on public.candidate_profiles;

create policy "Candidates can view their own profile"
on public.candidate_profiles
for select
to authenticated
using (user_id = (select auth.uid()));
