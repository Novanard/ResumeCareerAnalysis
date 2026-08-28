const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createCandidateProfileService,
} = require("../src/services/candidateProfileService");

function createSupabaseMock({ existingProfile, selectError, insertError } = {}) {
  const calls = { inserts: [] };

  const client = {
    from(table) {
      assert.equal(table, "candidate_profiles");
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return {
                    data: existingProfile || null,
                    error: selectError || null,
                  };
                },
              };
            },
          };
        },
        insert(payload) {
          calls.inserts.push(payload);
          return {
            select() {
              return {
                async single() {
                  return {
                    data: insertError
                      ? null
                      : { id: "profile-123", profile_data: {}, ...payload },
                    error: insertError || null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return { client, calls };
}

test("ensureProfile returns an existing candidate profile", async () => {
  const existingProfile = { id: "profile-123", user_id: "user-123" };
  const { client, calls } = createSupabaseMock({ existingProfile });
  const service = createCandidateProfileService(client);

  const profile = await service.ensureProfile({ id: "user-123" });

  assert.equal(profile, existingProfile);
  assert.equal(calls.inserts.length, 0);
});

test("ensureProfile creates a minimal profile for a new user", async () => {
  const { client, calls } = createSupabaseMock();
  const service = createCandidateProfileService(client);
  const user = {
    id: "user-123",
    user_metadata: { full_name: "Maya Cohen" },
  };

  const profile = await service.ensureProfile(user);

  assert.equal(profile.id, "profile-123");
  assert.deepEqual(calls.inserts, [
    { user_id: "user-123", full_name: "Maya Cohen" },
  ]);
});

test("ensureProfile uses a null name when the provider supplies none", async () => {
  const { client, calls } = createSupabaseMock();
  const service = createCandidateProfileService(client);

  await service.ensureProfile({ id: "user-123", user_metadata: {} });

  assert.deepEqual(calls.inserts, [
    { user_id: "user-123", full_name: null },
  ]);
});

test("ensureProfile reports database failures", async () => {
  const { client } = createSupabaseMock({
    selectError: new Error("Database unavailable"),
  });
  const service = createCandidateProfileService(client);

  await assert.rejects(
    service.ensureProfile({ id: "user-123" }),
    { message: "Unable to load candidate profile", statusCode: 500 },
  );
});
