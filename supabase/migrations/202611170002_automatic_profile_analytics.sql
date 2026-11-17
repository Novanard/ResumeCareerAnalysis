-- Analytics are a read-only cache of an approved profile, not separately approved facts.
-- Preserve old records for migration compatibility; extraction_version null makes
-- legacy manually authored analytics ineligible for the automatic reader.
alter table public.candidate_analytics
  alter column source_draft_revision drop not null,
  alter column approved_at drop not null,
  alter column approved_at drop default,
  add column extraction_version integer check (extraction_version > 0),
  add column extraction_method text check (extraction_method in ('model', 'baseline')),
  add column generated_at timestamptz;

-- Retire the former backend mutation workflow. Existing private draft rows remain
-- private and inert; no content from them is promoted into the derived cache.
revoke execute on function public.write_candidate_analytics_draft(uuid, bigint, bigint, jsonb) from service_role;
revoke execute on function public.approve_candidate_analytics(uuid, bigint, bigint, boolean) from service_role;

create function public.store_derived_candidate_analytics(
  p_profile_id uuid, p_profile_revision bigint, p_extraction_version integer,
  p_extraction_method text, p_content jsonb
) returns public.candidate_analytics
language plpgsql set search_path = '' as $$
declare
  p public.candidate_profiles;
  a public.candidate_analytics;
begin
  if p_profile_revision is null or p_extraction_version is null or p_extraction_version < 1
    or p_extraction_method is null or p_extraction_method not in ('model', 'baseline') then
    raise exception 'Invalid extraction metadata' using errcode = '22023';
  end if;
  select * into p from public.candidate_profiles where id = p_profile_id for update;
  if not found or p.approved_at is null or p.revision <> p_profile_revision then
    raise exception 'Saved profile changed' using errcode = '40001';
  end if;
  select * into a from public.candidate_analytics where candidate_profile_id = p.id;
  if found and a.profile_revision = p.revision and a.extraction_version = p_extraction_version
    and a.extraction_method = p_extraction_method and a.content = p_content then return a; end if;
  insert into public.candidate_analytics(candidate_profile_id, profile_revision,
    source_draft_revision, approved_at, content, extraction_version, extraction_method, generated_at)
    values(p.id, p.revision, null, null, p_content, p_extraction_version, p_extraction_method, now())
    on conflict(candidate_profile_id) do update set profile_revision = excluded.profile_revision,
      source_draft_revision = null, approved_at = null, content = excluded.content,
      extraction_version = excluded.extraction_version, extraction_method = excluded.extraction_method,
      generated_at = now(), updated_at = now() returning * into a;
  return a;
end;
$$;
revoke all on function public.store_derived_candidate_analytics(uuid, bigint, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.store_derived_candidate_analytics(uuid, bigint, integer, text, jsonb) to service_role;
