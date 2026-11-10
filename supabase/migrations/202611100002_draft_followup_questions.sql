-- Private refinement history belongs to the draft, not public profile content.
alter table public.candidate_profile_drafts
  add column questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(questions) = 'array'),
  add column questions_generated boolean not null default false,
  add column questions_finished boolean not null default false;
