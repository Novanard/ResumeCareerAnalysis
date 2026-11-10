const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createProfileDraftService } = require('../src/services/profileDraftService');
const { createApp } = require('../src/app');
const { validCandidateProfile } = require('../testSupport/validCandidateProfile');

test('invalid draft content is rejected before any database call', async () => {
  const service = createProfileDraftService({ rpc() { assert.fail('Unexpected write'); } });
  await assert.rejects(service.saveParsedDraft({
    userId: 'u1', resumeId: 'r1', parsedProfile: {},
  }), { statusCode: 422 });
});

test('draft creation passes ownership to the atomic database operation', async () => {
  const draft = { id: 'd1', revision: 3, content: validCandidateProfile };
  const service = createProfileDraftService({
    async rpc(name, args) {
      assert.equal(name, 'create_parsed_profile_draft');
      assert.deepEqual(args, {
        p_user_id: 'u1', p_resume_id: 'r1', p_content: validCandidateProfile,
      });
      return { data: draft, error: null };
    },
  });
  assert.equal(await service.saveParsedDraft({
    userId: 'u1', resumeId: 'r1', parsedProfile: validCandidateProfile,
  }), draft);
});

test('unowned resume errors do not return draft data', async () => {
  const service = createProfileDraftService({
    async rpc() { return { data: null, error: { code: 'P0002' } }; },
  });
  await assert.rejects(service.saveParsedDraft({
    userId: 'other-user', resumeId: 'r1', parsedProfile: validCandidateProfile,
  }), { statusCode: 404, message: 'Resume not found' });
});

test('draft read requires authentication and scopes lookup to the owner profile', async () => {
  const app = createApp({
    supabaseClient: { auth: { async getUser() { return { data: { user: { id: 'u1' } } }; } } },
    candidateProfileService: {
      async ensureProfile(user) { assert.equal(user.id, 'u1'); return { id: 'p1' }; },
    },
    profileDraftService: {
      async getLatestDraft(args) {
        assert.deepEqual(args, { profileId: 'p1' });
        return { id: 'd1', content: validCandidateProfile };
      },
    },
  });
  await request(app).get('/api/profile/draft').expect(401);
  const response = await request(app).get('/api/profile/draft')
    .set('Authorization', 'Bearer token').expect(200);
  assert.deepEqual(response.body.draft.content, validCandidateProfile);
});
