-- Parsed imports are private drafts, never implicit approval of a profile.
alter table public.candidate_profiles
  add column if not exists revision bigint not null default 0;

create table public.candidate_profile_drafts (
  id uuid primary key default gen_random_uuid(),
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  source_resume_id uuid not null unique references public.resumes(id) on delete cascade,
  source_uploaded_at timestamptz not null,
  base_profile_revision bigint not null,
  revision bigint not null default 1 check (revision > 0),
  state text not null default 'refining' check (state in ('refining', 'review', 'confirmed', 'saved')),
  parsed_baseline jsonb not null check (jsonb_typeof(parsed_baseline) = 'object'),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  confirmed_revision bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (confirmed_revision is null or confirmed_revision = revision)
);

create index candidate_profile_drafts_latest
  on public.candidate_profile_drafts(candidate_profile_id, source_uploaded_at desc, source_resume_id desc);
alter table public.candidate_profile_drafts enable row level security;
revoke all on public.candidate_profile_drafts from anon, authenticated;
grant select on public.candidate_profile_drafts to authenticated;
grant all on public.candidate_profile_drafts to service_role;
create policy "Owners can read private drafts"
  on public.candidate_profile_drafts for select to authenticated
  using (exists (select 1 from public.candidate_profiles p
    where p.id = candidate_profile_id and p.user_id = (select auth.uid())));

-- Lock the profile while capturing its base revision. A retry returns the
-- existing draft rather than replacing future edits or a newer proposal.
create function public.create_parsed_profile_draft(
  p_user_id uuid, p_resume_id uuid, p_content jsonb
) returns public.candidate_profile_drafts
language plpgsql set search_path = '' as $$
declare
  owned_profile public.candidate_profiles;
  source_resume public.resumes;
  result public.candidate_profile_drafts;
begin
  select p.* into owned_profile from public.candidate_profiles p
    join public.resumes r on r.candidate_profile_id = p.id
    where r.id = p_resume_id and p.user_id = p_user_id for update of p;
  if not found then
    raise exception 'Resume not found' using errcode = 'P0002';
  end if;
  select * into source_resume from public.resumes where id = p_resume_id;
  insert into public.candidate_profile_drafts
    (candidate_profile_id, source_resume_id, source_uploaded_at,
     base_profile_revision, parsed_baseline, content)
    values (owned_profile.id, source_resume.id, source_resume.created_at,
      owned_profile.revision, p_content, p_content)
    on conflict (source_resume_id) do nothing;
  select * into result from public.candidate_profile_drafts
    where source_resume_id = p_resume_id;
  return result;
end;
$$;
revoke all on function public.create_parsed_profile_draft(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_parsed_profile_draft(uuid, uuid, jsonb) to service_role;
