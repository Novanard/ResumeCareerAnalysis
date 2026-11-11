const { randomBytes } = require('node:crypto');
const { CandidateProfileServiceError: ServiceError } = require('./candidateProfileService');
const { fromCandidateProfileRow } = require('../mappers/candidateProfileMapper');
const { candidateProfileSchema } = require('../schemas/candidateProfileSchema');
const { validateCandidateProfile } = require('../validation/candidateProfileValidator');

function project(value, schema) {
  if (value === null) return null;
  if (schema.properties) return Object.fromEntries(Object.entries(schema.properties)
    .filter(([key]) => key !== 'rawMetadata')
    .map(([key, child]) => [key, project(value[key], child)]));
  if (schema.items) return value.map(item => project(item, schema.items));
  return value;
}
function publicProfile(row) {
  const profile = project(fromCandidateProfileRow(row), candidateProfileSchema);
  if (!validateCandidateProfile({ ...profile, rawMetadata: { source: 'cv', warnings: [] } }).valid) {
    throw new ServiceError('Shared profile unavailable', 404);
  }
  return profile;
}
function createProfileSharingService(supabase, environment = process.env) {
  function checkSetup(error) {
    if (['PGRST205', 'PGRST202', '42P01', '42883'].includes(error?.code)) {
      throw new ServiceError('Profile sharing is temporarily unavailable. Please try again later.', 503);
    }
  }
  function origin() {
    let url;
    try { url = new URL(environment.FRONTEND_ORIGIN); } catch { throw new ServiceError('Sharing URL is not configured'); }
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
      throw new ServiceError('Sharing URL is not configured');
    }
    return url.origin;
  }
  function status(row) {
    return { enabled: Boolean(row?.enabled), url: row?.enabled ? `${origin()}/shared/${row.token}` : null };
  }
  return {
    async status(userId) {
      const { data: profile, error } = await supabase.from('candidate_profiles').select('id').eq('user_id', userId).maybeSingle();
      if (error) throw new ServiceError('Unable to load sharing');
      if (!profile) return status(null);
      const result = await supabase.from('candidate_profile_shares').select('*').eq('candidate_profile_id', profile.id).maybeSingle();
      checkSetup(result.error);
      if (result.error) throw new ServiceError('Unable to load sharing');
      return status(result.data);
    },
    async set(userId, enabled) {
      if (enabled) origin();
      const { data, error } = await supabase.rpc('set_profile_sharing', {
        p_user_id: userId, p_enabled: enabled, p_token: randomBytes(32).toString('base64url'),
      });
      checkSetup(error);
      if (error) throw new ServiceError(error.code === 'P0001' ? 'Save your profile before enabling sharing' : 'Unable to update sharing', error.code === 'P0001' ? 409 : 500);
      return status(data?.[0]);
    },
    async read(token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ServiceError('Shared profile unavailable', 404);
      // One query joins active sharing and saved content for a consistent access check.
      const { data, error } = await supabase.from('candidate_profile_shares')
        .select('candidate_profiles!inner(*)').eq('token', token).eq('enabled', true).maybeSingle();
      checkSetup(error);
      if (error) throw new ServiceError('Unable to load shared profile');
      const profile = data?.candidate_profiles;
      if (!profile?.approved_at) throw new ServiceError('Shared profile unavailable', 404);
      return publicProfile(profile);
    },
  };
}
module.exports = { createProfileSharingService, publicProfile };
