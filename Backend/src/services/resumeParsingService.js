const { CandidateProfileParsingError } = require("./candidateProfileParser");

function createResumeParsingService({ resumeService, candidateProfileService, parser }) {
  return {
    isConfigured: parser.isConfigured,
    async parseResume({ resumeId, userId }) {
      if (!parser.isConfigured()) {
        throw new CandidateProfileParsingError(
          "AI resume parsing is not configured yet",
          503,
          "AI_NOT_CONFIGURED",
        );
      }

      const resume = await resumeService.getOwnedResume({ resumeId, userId });
      if (!resume.extracted_text?.trim()) {
        throw new CandidateProfileParsingError(
          "Resume text is not available for parsing",
          409,
          "RESUME_TEXT_MISSING",
        );
      }

      await resumeService.updateProcessingState({ resumeId, status: "parsing", error: null });
      try {
        const parsedProfile = await parser.parse(resume.extracted_text);
        const profile = await candidateProfileService.saveParsedProfile({
          profileId: resume.candidate_profile_id,
          parsedProfile,
        });
        const updatedResume = await resumeService.updateProcessingState({
          resumeId,
          status: "parsed",
          error: null,
          parsedAt: new Date().toISOString(),
        });
        return { resume: updatedResume, profile };
      } catch (error) {
        await resumeService.updateProcessingState({
          resumeId,
          status: "parsing_failed",
          error: error.message,
        });
        throw error;
      }
    },
  };
}

module.exports = { createResumeParsingService };
