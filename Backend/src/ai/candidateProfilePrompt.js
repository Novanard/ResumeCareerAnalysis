const { candidateProfileSchema } = require("../schemas/candidateProfileSchema");

const candidateProfileInstructions = `Extract candidate information only from the supplied resume.
Return JSON matching the supplied schema exactly.
Use null for unknown scalar values and [] for missing collections.
Do not invent facts, employers, dates, skills, or contact details.
Dates must use YYYY or YYYY-MM. Put unusual resume sections in additionalSections.
Record extraction uncertainty in rawMetadata.warnings.`;

function buildCandidateProfileRequest(resumeText) {
  return {
    instructions: candidateProfileInstructions,
    input: resumeText,
    schema: candidateProfileSchema,
  };
}

module.exports = { candidateProfileInstructions, buildCandidateProfileRequest };
