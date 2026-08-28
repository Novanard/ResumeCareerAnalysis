const test = require("node:test");
const assert = require("node:assert/strict");
const { createResumeParsingService } = require("../src/services/resumeParsingService");
const { CandidateProfileParsingError } = require("../src/services/candidateProfileParser");
const { validCandidateProfile } = require("../testSupport/validCandidateProfile");

test("resume parsing persists validated data and marks the resume parsed", async () => {
  const states = [];
  let saved;
  const service = createResumeParsingService({
    resumeService: {
      async getOwnedResume(input) {
        assert.deepEqual(input, { resumeId: "r1", userId: "u1" });
        return { id: "r1", candidate_profile_id: "p1", extracted_text: "resume" };
      },
      async updateProcessingState(state) { states.push(state); return { id: "r1", ...state }; },
    },
    candidateProfileService: {
      async saveParsedProfile(input) { saved = input; return { id: "p1" }; },
    },
    parser: { isConfigured: () => true, async parse() { return validCandidateProfile; } },
  });
  const result = await service.parseResume({ resumeId: "r1", userId: "u1" });
  assert.deepEqual(saved, { profileId: "p1", parsedProfile: validCandidateProfile });
  assert.equal(states[0].status, "parsing");
  assert.equal(states[1].status, "parsed");
  assert.equal(result.profile.id, "p1");
});

test("failed parsing never writes a candidate profile and records retryable state", async () => {
  const states = [];
  let writes = 0;
  const parseError = new CandidateProfileParsingError("invalid", 422, "INVALID_AI_OUTPUT");
  const service = createResumeParsingService({
    resumeService: {
      async getOwnedResume() { return { id: "r1", candidate_profile_id: "p1", extracted_text: "resume" }; },
      async updateProcessingState(state) { states.push(state); return state; },
    },
    candidateProfileService: { async saveParsedProfile() { writes += 1; } },
    parser: { isConfigured: () => true, async parse() { throw parseError; } },
  });
  await assert.rejects(service.parseResume({ resumeId: "r1", userId: "u1" }), parseError);
  assert.equal(writes, 0);
  assert.equal(states.at(-1).status, "parsing_failed");
});
