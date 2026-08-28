-- Resume metadata described by SPECS/MVP/01-ResumeParsing.md.
-- The CREATE statement supports a fresh database; the ALTER statements below
-- bring the existing project table up to the same schema without deleting it.
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size integer not null,
  extracted_text text,
  created_at timestamptz not null default now()
);

alter table public.resumes
  add column if not exists file_size integer;

-- Existing rows cannot be assigned a trustworthy historical file size. Stop
-- instead of inventing data if such rows exist; otherwise enforce the field.
do $$
begin
  if exists (select 1 from public.resumes where file_size is null) then
    raise exception
      'Existing resumes need file_size values before this migration can finish';
  end if;

  alter table public.resumes alter column file_size set not null;
  alter table public.resumes alter column mime_type set not null;
end
$$;

create unique index if not exists resumes_storage_path_idx
  on public.resumes (storage_path);

create index if not exists resumes_candidate_profile_id_idx
  on public.resumes (candidate_profile_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.resumes'::regclass
      and conname = 'resumes_mime_type_check'
  ) then
    alter table public.resumes
      add constraint resumes_mime_type_check check (
        mime_type in (
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.resumes'::regclass
      and conname = 'resumes_file_size_check'
  ) then
    alter table public.resumes
      add constraint resumes_file_size_check check (
        file_size > 0 and file_size <= 5 * 1024 * 1024
      );
  end if;
end
$$;

alter table public.resumes enable row level security;

-- Resume metadata is written by the backend using its service-role client.
-- Authenticated candidates may only read metadata belonging to their profile.
revoke all on table public.resumes from anon, authenticated;
grant select on table public.resumes to authenticated;

drop policy if exists "Candidates can view their own resume metadata"
  on public.resumes;

create policy "Candidates can view their own resume metadata"
on public.resumes
for select
to authenticated
using (
  exists (
    select 1
    from public.candidate_profiles
    where candidate_profiles.id = resumes.candidate_profile_id
      and candidate_profiles.user_id = (select auth.uid())
  )
);

-- Private bucket: files are written and read through the backend. The service
-- role bypasses Storage RLS, so no direct client policy is added here.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'resumes',
  'resumes',
  false,
  5 * 1024 * 1024,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
