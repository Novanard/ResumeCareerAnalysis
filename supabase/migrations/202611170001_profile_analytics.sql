-- Optional sidecar documents preserve the frozen candidate profile v1 contract.
-- No backfill or inferred approval. Only backend service-role access is allowed.
create table public.candidate_analytics_drafts (
  candidate_profile_id uuid primary key references public.candidate_profiles(id) on delete cascade,
  base_profile_revision bigint not null check (base_profile_revision >= 0),
  revision bigint not null default 1 check (revision > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object' and content->'schemaVersion' is not distinct from '1'::jsonb),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.candidate_analytics (
  candidate_profile_id uuid primary key references public.candidate_profiles(id) on delete cascade,
  profile_revision bigint not null check (profile_revision >= 0),
  source_draft_revision bigint not null check (source_draft_revision > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object' and content->'schemaVersion' is not distinct from '1'::jsonb),
  approved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.candidate_analytics_drafts enable row level security;
alter table public.candidate_analytics enable row level security;
revoke all on public.candidate_analytics_drafts, public.candidate_analytics from public, anon, authenticated;
grant all on public.candidate_analytics_drafts, public.candidate_analytics to service_role;

-- All writes take the same profile lock as profile final-save. JSON schema and
-- relationship validation are performed by the backend before calling this RPC.
-- p_revision = 0 means create-only; every subsequent write requires exact revision.
create function public.write_candidate_analytics_draft(
  p_user_id uuid, p_profile_revision bigint, p_revision bigint, p_content jsonb
) returns public.candidate_analytics_drafts
language plpgsql set search_path = '' as $$
declare
  p public.candidate_profiles;
  d public.candidate_analytics_drafts;
begin
  if p_revision is null or p_revision < 0 or p_profile_revision is null then
    raise exception 'Revisions required' using errcode = '22023';
  end if;
  select * into p from public.candidate_profiles where user_id = p_user_id for update;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  if p.approved_at is null or p.revision <> p_profile_revision then
    raise exception 'Review the current saved profile first' using errcode = '40001';
  end if;
  select * into d from public.candidate_analytics_drafts where candidate_profile_id = p.id for update;
  if not found then
    if p_revision <> 0 then raise exception 'Analytics draft changed' using errcode = '40001'; end if;
    insert into public.candidate_analytics_drafts(candidate_profile_id, base_profile_revision, content)
      values(p.id, p.revision, p_content) returning * into d;
  else
    if d.revision <> p_revision then raise exception 'Analytics draft changed' using errcode = '40001'; end if;
    update public.candidate_analytics_drafts set content = p_content,
      base_profile_revision = p.revision, revision = revision + 1, updated_at = now()
      where candidate_profile_id = p.id returning * into d;
  end if;
  return d;
end;
$$;

create function public.approve_candidate_analytics(
  p_user_id uuid, p_profile_revision bigint, p_revision bigint, p_approved boolean
) returns public.candidate_analytics
language plpgsql set search_path = '' as $$
declare
  p public.candidate_profiles;
  d public.candidate_analytics_drafts;
  a public.candidate_analytics;
begin
  if p_approved is distinct from true then raise exception 'Explicit approval required' using errcode = '22023'; end if;
  if p_revision is null or p_revision < 1 or p_profile_revision is null then
    raise exception 'Revisions required' using errcode = '22023';
  end if;
  select * into p from public.candidate_profiles where user_id = p_user_id for update;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  select * into d from public.candidate_analytics_drafts where candidate_profile_id = p.id for update;
  if not found then raise exception 'Analytics draft not found' using errcode = 'P0002'; end if;
  if p.approved_at is null or p.revision <> p_profile_revision or d.base_profile_revision <> p.revision or d.revision <> p_revision then
    raise exception 'Profile or analytics changed. Review again.' using errcode = '40001';
  end if;
  select * into a from public.candidate_analytics where candidate_profile_id = p.id;
  if found and a.profile_revision = p.revision and a.source_draft_revision = d.revision then return a; end if;
  insert into public.candidate_analytics(candidate_profile_id, profile_revision, source_draft_revision, content)
    values(p.id, p.revision, d.revision, d.content)
    on conflict(candidate_profile_id) do update set profile_revision = excluded.profile_revision,
      source_draft_revision = excluded.source_draft_revision, content = excluded.content,
      approved_at = now(), updated_at = now() returning * into a;
  return a;
end;
$$;
revoke all on function public.write_candidate_analytics_draft(uuid, bigint, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.approve_candidate_analytics(uuid, bigint, bigint, boolean) from public, anon, authenticated;
grant execute on function public.write_candidate_analytics_draft(uuid, bigint, bigint, jsonb) to service_role;
grant execute on function public.approve_candidate_analytics(uuid, bigint, bigint, boolean) to service_role;
