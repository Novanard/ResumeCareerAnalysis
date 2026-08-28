-- A Supabase Auth user owns at most one candidate profile. This guarantees
-- profile creation remains safe if multiple authenticated requests arrive at
-- the same time.
create unique index if not exists candidate_profiles_user_id_idx
  on public.candidate_profiles (user_id);
