class CandidateProfileServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "CandidateProfileServiceError";
    this.statusCode = statusCode;
  }
}

function createCandidateProfileService(supabaseClient) {
  const { toCandidateProfileRow } = require("../mappers/candidateProfileMapper");
  return {
    async ensureProfile(user) {
      const { data: existingProfile, error: selectError } = await supabaseClient
        .from("candidate_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (selectError) {
        throw new CandidateProfileServiceError(
          "Unable to load candidate profile",
        );
      }

      if (existingProfile) {
        return existingProfile;
      }

      const fullName =
        user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;

      const { data: createdProfile, error: insertError } = await supabaseClient
        .from("candidate_profiles")
        .insert({ user_id: user.id, full_name: fullName })
        .select()
        .single();

      if (insertError) {
        throw new CandidateProfileServiceError(
          "Unable to create candidate profile",
        );
      }

      return createdProfile;
    },

    async saveParsedProfile({ profileId, parsedProfile }) {
      const { data, error } = await supabaseClient
        .from("candidate_profiles")
        .update(toCandidateProfileRow(parsedProfile))
        .eq("id", profileId)
        .select()
        .single();

      if (error) {
        throw new CandidateProfileServiceError("Unable to save parsed candidate profile");
      }
      return data;
    },
  };
}

module.exports = {
  createCandidateProfileService,
  CandidateProfileServiceError,
};
