create table public.candidate_profile_shares (
  candidate_profile_id uuid primary key references public.candidate_profiles(id) on delete cascade,
  token text not null unique,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.candidate_profile_shares enable row level security;
revoke all on public.candidate_profile_shares from public, anon, authenticated;
grant all on public.candidate_profile_shares to service_role;

create function public.set_profile_sharing(p_user_id uuid, p_enabled boolean, p_token text)
returns setof public.candidate_profile_shares
language plpgsql set search_path = '' as $$
declare p public.candidate_profiles;
begin
  select * into p from public.candidate_profiles where user_id = p_user_id for update;
  if not found then
    if p_enabled then raise exception 'Save your profile first' using errcode = 'P0001'; end if;
    return;
  end if;
  if p_enabled and (p.approved_at is null or p.profile_data->>'schemaVersion' is distinct from '1') then
    raise exception 'Save your profile first' using errcode = 'P0001';
  end if;
  if p_enabled then
    insert into public.candidate_profile_shares(candidate_profile_id, token, enabled)
      values(p.id, p_token, true)
      on conflict(candidate_profile_id) do update set
        token = case when candidate_profile_shares.enabled then candidate_profile_shares.token else excluded.token end,
        enabled = true, revoked_at = null, updated_at = now();
  else
    update public.candidate_profile_shares set enabled = false,
      revoked_at = coalesce(revoked_at, now()), updated_at = now()
      where candidate_profile_id = p.id;
  end if;
  return query select * from public.candidate_profile_shares where candidate_profile_id = p.id;
end;
$$;
revoke all on function public.set_profile_sharing(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.set_profile_sharing(uuid, boolean, text) to service_role;
