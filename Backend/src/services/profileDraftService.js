const { CandidateProfileServiceError } = require('./candidateProfileService');
const { validateCandidateProfile } = require('../validation/candidateProfileValidator');

function createProfileDraftService(supabase) {
  return {
    async saveParsedDraft({ userId, resumeId, parsedProfile }) {
      if (!validateCandidateProfile(parsedProfile).valid) {
        throw new CandidateProfileServiceError('Invalid candidate profile draft', 422);
      }
      const { data, error } = await supabase.rpc('create_parsed_profile_draft', {
        p_user_id: userId, p_resume_id: resumeId, p_content: parsedProfile,
      });
      if (error) {
        throw new CandidateProfileServiceError(
          error.code === 'P0002' ? 'Resume not found' : 'Unable to save profile draft',
          error.code === 'P0002' ? 404 : 500,
        );
      }
      return data;
    },
    async getLatestDraft({ profileId }) {
      const { data, error } = await supabase.from('candidate_profile_drafts')
        .select('*').eq('candidate_profile_id', profileId)
        .order('source_uploaded_at', { ascending: false })
        .order('source_resume_id', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new CandidateProfileServiceError('Unable to load profile draft');
      if (!data) throw new CandidateProfileServiceError('A parsed profile draft is not available yet', 404);
      return data;
    },
  };
}

module.exports = { createProfileDraftService };
