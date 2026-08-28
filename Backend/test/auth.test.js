const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createApp } = require("../src/app");

function createSupabaseMock(getUser) {
  return {
    auth: { getUser },
  };
}

test("GET /api/auth/me rejects a request without an access token", async () => {
  const supabase = createSupabaseMock(async () => {
    throw new Error("getUser should not be called");
  });

  const response = await request(createApp({ supabaseClient: supabase }))
    .get("/api/auth/me")
    .expect(401);

  assert.deepEqual(response.body, { error: "Authentication required" });
});

test("GET /api/auth/me rejects a malformed authorization header", async () => {
  const supabase = createSupabaseMock(async () => {
    throw new Error("getUser should not be called");
  });

  const response = await request(createApp({ supabaseClient: supabase }))
    .get("/api/auth/me")
    .set("Authorization", "Basic credentials")
    .expect(401);

  assert.deepEqual(response.body, { error: "Authentication required" });
});

test("GET /api/auth/me rejects an invalid access token", async () => {
  const supabase = createSupabaseMock(async (token) => {
    assert.equal(token, "invalid-token");
    return { data: { user: null }, error: new Error("Invalid token") };
  });

  const response = await request(createApp({ supabaseClient: supabase }))
    .get("/api/auth/me")
    .set("Authorization", "Bearer invalid-token")
    .expect(401);

  assert.deepEqual(response.body, { error: "Invalid or expired access token" });
});

test("GET /api/auth/me returns the authenticated user", async () => {
  const user = { id: "user-123", email: "candidate@example.com" };
  const profile = { id: "profile-123", user_id: user.id };
  const supabase = createSupabaseMock(async (token) => {
    assert.equal(token, "valid-token");
    return { data: { user }, error: null };
  });

  const candidateProfileService = {
    async ensureProfile(receivedUser) {
      assert.equal(receivedUser, user);
      return profile;
    },
  };

  const response = await request(createApp({
    supabaseClient: supabase,
    candidateProfileService,
  }))
    .get("/api/auth/me")
    .set("Authorization", "Bearer valid-token")
    .expect(200);

  assert.deepEqual(response.body, { user, profile });
});

test("obsolete database diagnostic route is not exposed", async () => {
  const supabase = createSupabaseMock(async () => {
    throw new Error("getUser should not be called");
  });

  await request(createApp({ supabaseClient: supabase }))
    .get("/api/test-db")
    .expect(404);
});
