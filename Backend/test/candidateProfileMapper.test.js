const test = require("node:test");
const assert = require("node:assert/strict");

const {
  fromCandidateProfileRow,
  toCandidateProfileRow,
} = require("../src/mappers/candidateProfileMapper");
const {
  validCandidateProfile,
} = require("../testSupport/validCandidateProfile");

test("candidate profile mapper separates stable columns from JSONB", () => {
  const row = toCandidateProfileRow(validCandidateProfile);

  assert.equal(row.full_name, "Maya Cohen");
  assert.equal(row.headline, null);
  assert.equal(row.summary, null);
  assert.equal("fullName" in row.profile_data, false);
  assert.equal("headline" in row.profile_data, false);
  assert.equal("summary" in row.profile_data, false);
  assert.equal(row.profile_data.schemaVersion, 1);
  assert.deepEqual(row.profile_data.skills, validCandidateProfile.skills);
});

test("candidate profile mapper reconstructs the API contract", () => {
  const mappedRow = toCandidateProfileRow(validCandidateProfile);
  const profile = fromCandidateProfileRow(mappedRow);

  assert.deepEqual(profile, validCandidateProfile);
});

test("relational fields remain authoritative when reading a profile", () => {
  const mappedRow = toCandidateProfileRow(validCandidateProfile);
  mappedRow.full_name = "Corrected Name";
  mappedRow.profile_data.fullName = "Stale Name";

  const profile = fromCandidateProfileRow(mappedRow);

  assert.equal(profile.fullName, "Corrected Name");
});
