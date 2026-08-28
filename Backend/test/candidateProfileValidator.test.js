const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateCandidateProfile,
} = require("../src/validation/candidateProfileValidator");
const {
  validCandidateProfile,
} = require("../testSupport/validCandidateProfile");

function copyProfile() {
  return structuredClone(validCandidateProfile);
}

test("candidate profile v1 accepts the frozen contract", () => {
  const result = validateCandidateProfile(copyProfile());

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("candidate profile v1 requires every top-level key", () => {
  const profile = copyProfile();
  delete profile.projects;

  const result = validateCandidateProfile(profile);

  assert.equal(result.valid, false);
});

test("candidate profile v1 accepts null unknown scalar fields", () => {
  const profile = copyProfile();
  profile.fullName = null;
  profile.contact.email = null;
  profile.experience[0].current = null;

  assert.equal(validateCandidateProfile(profile).valid, true);
});

test("candidate profile v1 requires arrays for collections", () => {
  const profile = copyProfile();
  profile.skills = null;

  assert.equal(validateCandidateProfile(profile).valid, false);
});

test("candidate profile v1 rejects invalid dates and Present strings", () => {
  for (const invalidDate of ["03/2024", "2024-13", "Present"] ) {
    const profile = copyProfile();
    profile.experience[0].startDate = invalidDate;

    assert.equal(validateCandidateProfile(profile).valid, false);
  }
});

test("candidate profile v1 rejects undefined extra fields", () => {
  const profile = copyProfile();
  profile.yearsOfExperience = 4.7;

  assert.equal(validateCandidateProfile(profile).valid, false);
});

test("candidate profile v1 rejects placeholder strings for unknown data", () => {
  for (const placeholder of ["Not provided", "Unknown", "N/A"]) {
    const profile = copyProfile();
    profile.contact.phone = placeholder;

    const result = validateCandidateProfile(profile);
    assert.equal(result.valid, false);
  }
});

test("candidate profile v1 supports minimal additional sections", () => {
  const profile = copyProfile();
  profile.additionalSections = [
    {
      title: "Military Service",
      items: [
        {
          heading: "Technical Unit",
          subheading: null,
          date: "2020",
          description: [],
        },
      ],
    },
  ];

  assert.equal(validateCandidateProfile(profile).valid, true);
});
