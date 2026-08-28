-- Resume metadata described by SPECS/MVP/01-ResumeParsing.md.
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null
    references public.candidate_profiles (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  file_size integer not null check (
    file_size > 0 and file_size <= 5 * 1024 * 1024
  ),
  extracted_text text,
  uploaded_at timestamptz not null default now()
);

create index resumes_candidate_profile_id_idx
  on public.resumes (candidate_profile_id);

alter table public.resumes enable row level security;

-- Resume metadata is written by the backend using its service-role client.
-- Authenticated candidates may only read metadata belonging to their profile.
revoke all on table public.resumes from anon, authenticated;
grant select on table public.resumes to authenticated;

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
