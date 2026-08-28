const { buildCandidateProfileRequest } = require("../ai/candidateProfilePrompt");
const { validateCandidateProfile } = require("../validation/candidateProfileValidator");

class CandidateProfileParsingError extends Error {
  constructor(message, statusCode, code, details = []) {
    super(message);
    this.name = "CandidateProfileParsingError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function createCandidateProfileParser(modelClient) {
  const isConfigured = () =>
    typeof modelClient?.generateCandidateProfile === "function";

  return {
    isConfigured,
    async parse(resumeText) {
      if (!isConfigured()) {
        throw new CandidateProfileParsingError(
          "AI resume parsing is not configured yet",
          503,
          "AI_NOT_CONFIGURED",
        );
      }

      let profile;
      try {
        profile = await modelClient.generateCandidateProfile(
          buildCandidateProfileRequest(resumeText),
        );
      } catch (_error) {
        throw new CandidateProfileParsingError(
          "AI resume parsing failed",
          502,
          "AI_PROVIDER_FAILED",
        );
      }

      const validation = validateCandidateProfile(profile);
      if (!validation.valid) {
        throw new CandidateProfileParsingError(
          "AI returned an invalid candidate profile",
          422,
          "INVALID_AI_OUTPUT",
          validation.errors,
        );
      }

      return profile;
    },
  };
}

module.exports = { createCandidateProfileParser, CandidateProfileParsingError };
