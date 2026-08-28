const test = require("node:test");
const assert = require("node:assert/strict");
const { createCandidateProfileParser } = require("../src/services/candidateProfileParser");
const { validCandidateProfile } = require("../testSupport/validCandidateProfile");

test("parser sends resume text, instructions and the frozen schema to its model client", async () => {
  let request;
  const parser = createCandidateProfileParser({
    async generateCandidateProfile(value) {
      request = value;
      return structuredClone(validCandidateProfile);
    },
  });
  const result = await parser.parse("Maya Cohen\nSoftware Engineer");
  assert.deepEqual(result, validCandidateProfile);
  assert.equal(request.input, "Maya Cohen\nSoftware Engineer");
  assert.match(request.instructions, /Do not invent facts/);
  assert.equal(request.schema.properties.schemaVersion.const, 1);
});

test("parser rejects invalid model JSON before persistence", async () => {
  const parser = createCandidateProfileParser({
    async generateCandidateProfile() { return { fullName: "Maya" }; },
  });
  await assert.rejects(parser.parse("resume"), {
    statusCode: 422,
    code: "INVALID_AI_OUTPUT",
  });
});

test("parser hides provider errors behind a stable application error", async () => {
  const parser = createCandidateProfileParser({
    async generateCandidateProfile() { throw new Error("secret provider detail"); },
  });
  await assert.rejects(parser.parse("resume"), {
    statusCode: 502,
    code: "AI_PROVIDER_FAILED",
    message: "AI resume parsing failed",
  });
});

test("parser explicitly reports that no AI adapter is configured", async () => {
  const parser = createCandidateProfileParser();
  assert.equal(parser.isConfigured(), false);
  await assert.rejects(parser.parse("resume"), {
    statusCode: 503,
    code: "AI_NOT_CONFIGURED",
  });
});
