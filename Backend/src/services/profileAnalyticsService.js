const { CandidateProfileServiceError: ServiceError } = require('./candidateProfileService');
const { fromCandidateProfileRow } = require('../mappers/candidateProfileMapper');
const { validateProfileAnalytics } = require('../validation/profileAnalyticsValidator');

function check(error) {
  if (!error) return;
  const code = { '40001': 409, P0002: 404, '22023': 400 }[error.code];
  throw new ServiceError(code === 409 ? 'Profile or analytics changed. Reload and review again.'
    : code === 404 ? 'Profile or analytics not found'
    : code === 400 ? 'Invalid analytics request' : 'Unable to access profile analytics', code || 500);
}
function revision(value, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new ServiceError('Valid revisions are required', 400);
}
function createProfileAnalyticsService(supabase) {
  async function owner(userId) {
    const { data, error } = await supabase.from('candidate_profiles').select('*').eq('user_id', userId).maybeSingle();
    check(error);
    if (!data) throw new ServiceError('Profile not found', 404);
    return data;
  }
  async function record(table, profileId) {
    const { data, error } = await supabase.from(table).select('*').eq('candidate_profile_id', profileId).maybeSingle();
    check(error);
    return data;
  }
  // Explicit projections avoid making storage rows an accidental API contract.
  function draftView(row, profileRevision) {
    return row ? { revision: row.revision, profileRevision: row.base_profile_revision,
      stale: row.base_profile_revision !== profileRevision, content: row.content } : null;
  }
  function savedView(row, profileRevision) {
    return row ? { revision: row.source_draft_revision, profileRevision: row.profile_revision,
      stale: row.profile_revision !== profileRevision, approvedAt: row.approved_at, content: row.content } : null;
  }
  return {
    async read(userId) {
      const profile = await owner(userId);
      const [draft, saved] = await Promise.all([
        record('candidate_analytics_drafts', profile.id), record('candidate_analytics', profile.id),
      ]);
      return { profileRevision: profile.revision, draft: draftView(draft, profile.revision), saved: savedView(saved, profile.revision) };
    },
    async edit({ userId, profileRevision, revision: expected, content }) {
      revision(profileRevision); revision(expected);
      const profile = await owner(userId);
      if (!profile.approved_at || profile.revision !== profileRevision) throw new ServiceError('Review the current saved profile first', 409);
      if (!validateProfileAnalytics(content, fromCandidateProfileRow(profile)).valid) throw new ServiceError('Invalid analytics content or relationships', 400);
      const { data, error } = await supabase.rpc('write_candidate_analytics_draft', {
        p_user_id: userId, p_profile_revision: profileRevision, p_revision: expected, p_content: content,
      });
      check(error);
      return draftView(data, profileRevision);
    },
    async approve({ userId, profileRevision, revision: expected, approved }) {
      revision(profileRevision); revision(expected, 1);
      if (approved !== true) throw new ServiceError('Explicit approval is required', 400);
      const profile = await owner(userId);
      const draft = await record('candidate_analytics_drafts', profile.id);
      if (!profile.approved_at || profile.revision !== profileRevision || !draft || draft.revision !== expected || draft.base_profile_revision !== profileRevision) throw new ServiceError('Profile or analytics changed. Reload and review again.', 409);
      if (!validateProfileAnalytics(draft.content, fromCandidateProfileRow(profile)).valid) throw new ServiceError('Invalid analytics content or relationships', 400);
      const { data, error } = await supabase.rpc('approve_candidate_analytics', {
        p_user_id: userId, p_profile_revision: profileRevision, p_revision: expected, p_approved: true,
      });
      check(error);
      return savedView(data, profileRevision);
    },
  };
}
module.exports = { createProfileAnalyticsService };
