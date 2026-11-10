alter table public.candidate_profile_drafts
  add column review_baseline jsonb,
  add column proposal jsonb,
  add column proposal_answers jsonb,
  add column proposal_source_revision bigint;
alter table public.candidate_profiles add column approved_at timestamptz;

-- A single transaction approves the exact draft revision and updates all profile
-- fields. Profile locks serialize saves across different drafts for one owner.
create function public.save_reviewed_profile_draft(
  p_user_id uuid, p_draft_id uuid, p_revision bigint
) returns public.candidate_profile_drafts
language plpgsql set search_path = '' as $$
declare
  owner_profile public.candidate_profiles;
  draft public.candidate_profile_drafts;
begin
  select p.* into owner_profile from public.candidate_profiles p
    join public.candidate_profile_drafts d on d.candidate_profile_id = p.id
    where d.id = p_draft_id and p.user_id = p_user_id for update of p;
  if not found then raise exception 'Draft not found' using errcode = 'P0002'; end if;
  select * into draft from public.candidate_profile_drafts where id = p_draft_id for update;
  -- Retried saves of the same revision are harmless, even after another draft saves.
  if draft.state = 'saved' and draft.confirmed_revision = p_revision then return draft; end if;
  if draft.revision <> p_revision or draft.state not in ('review', 'confirmed') then
    raise exception 'Draft changed. Reload and review before saving.' using errcode = '40001';
  end if;
  if owner_profile.revision <> draft.base_profile_revision then
    raise exception 'Saved profile changed. Start from the current saved profile.' using errcode = '40001';
  end if;
  update public.candidate_profiles set
    full_name = draft.content->>'fullName', headline = draft.content->>'headline',
    summary = draft.content->>'summary',
    profile_data = draft.content - 'fullName' - 'headline' - 'summary',
    revision = revision + 1, approved_at = now(), updated_at = now()
    where id = owner_profile.id;
  update public.candidate_profile_drafts set state = 'saved',
    confirmed_revision = revision, updated_at = now()
    where id = draft.id returning * into draft;
  return draft;
end;
$$;
revoke all on function public.save_reviewed_profile_draft(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.save_reviewed_profile_draft(uuid, uuid, bigint) to service_role;
