const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { emptyProfileAnalytics } = require('../src/schemas/profileAnalyticsSchema');
const { validateProfileAnalytics } = require('../src/validation/profileAnalyticsValidator');
const { createProfileAnalyticsService } = require('../src/services/profileAnalyticsService');
const { registerProfileAnalytics } = require('../src/routes/profileAnalytics');
const { createAuthenticateUser } = require('../src/middleware/authenticateUser');
const { validCandidateProfile } = require('../testSupport/validCandidateProfile');
const { toCandidateProfileRow } = require('../src/mappers/candidateProfileMapper');

function fixture() {
  const profile = structuredClone(validCandidateProfile);
  profile.projects = [{ name: 'App', description: null, technologies: ['React'], url: null }];
  profile.skills = [{ name: 'React', category: null }];
  const content = emptyProfileAnalytics();
  content.projects.push({ id: 'p1', profileProjectIndex: 0, startDate: '2023', endDate: null, current: true, source: 'manual' });
  content.skillUsages.push({ id: 'u1', profileSkillIndex: 0, projectIds: ['p1'], profileExperienceIndex: null, startDate: '2023', endDate: null, current: true, usage: 'hands_on', intensity: 'regular', depth: 'applied', assessmentBasis: 'Candidate described implementation work.', source: 'candidate_answer' });
  content.outcomes.push({ id: 'o1', projectId: 'p1', description: 'Reduced request latency', metric: 'Latency', baseline: 100, result: 50, unit: 'ms', timeframe: '2023', measurementMethod: null, preferredDirection: 'decrease', source: 'manual' });
  content.decisions.push({ id: 'd1', projectId: 'p1', description: 'Added a cache', rationale: null, outcomeIds: ['o1'], source: 'manual' });
  content.artifacts.push({ id: 'a1', projectId: 'p1', title: 'Report', kind: 'report', url: 'https://example.com/report', source: 'manual' });
  content.evidence.push({ id: 'e1', claimType: 'outcome', claimId: 'o1', artifactId: 'a1', snippet: 'Measured latency fell to 50ms.', source: 'manual' });
  content.collaborations.push({ id: 'c1', projectId: 'p1', collaborator: 'Platform team', relationship: 'cross_functional', description: null, source: 'manual' });
  return { profile, content };
}

test('analytics allow an empty versioned document and complete linked candidate facts', () => {
  const { content, profile } = fixture();
  assert.equal(validateProfileAnalytics(emptyProfileAnalytics(), profile).valid, true);
  assert.equal(validateProfileAnalytics(content, profile).valid, true);
});

for (const [name, mutate] of [
  ['undefined scoring and private fields', c => { c.fitScore = 90; }],
  ['unsupported verification status', c => { c.evidence[0].verified = true; }],
  ['duplicate entity identifiers', c => { c.outcomes[0].id = 'p1'; }],
  ['dangling project references', c => { c.skillUsages[0].projectIds = ['absent']; }],
  ['missing profile entries', c => { c.projects[0].profileProjectIndex = 99; }],
  ['depth without assessment basis', c => { c.skillUsages[0].assessmentBasis = null; }],
  ['reversed dates', c => { Object.assign(c.projects[0], { startDate: '2025', endDate: '2023', current: false }); }],
  ['invalid month', c => { c.projects[0].startDate = '2023-13'; }],
  ['ongoing entry with end date', c => { c.projects[0].endDate = '2024'; }],
  ['metrics without units', c => { c.outcomes[0].unit = null; }],
  ['unknown evidence claim', c => { c.evidence[0].claimId = 'absent'; }],
  ['unsafe artifact URL', c => { c.artifacts[0].url = 'javascript:alert(1)'; }],
]) test(`analytics reject ${name}`, () => {
  const { content, profile } = fixture(); mutate(content);
  assert.equal(validateProfileAnalytics(content, profile).valid, false);
});

test('relationships cannot silently connect different projects', () => {
  const { content, profile } = fixture();
  profile.projects.push({ ...profile.projects[0] });
  content.projects.push({ ...content.projects[0], id: 'p2', profileProjectIndex: 1 });
  content.artifacts[0].projectId = 'p2';
  assert.equal(validateProfileAnalytics(content, profile).valid, false);
});

function database({ profileRevision = 4, draftRevision = 2, baseRevision = 4, approved = true, rpcError = null } = {}) {
  const { profile, content } = fixture();
  const row = { ...toCandidateProfileRow(profile), id: 'profile', revision: profileRevision, approved_at: approved ? '2026-11-17' : null };
  const draft = { content, revision: draftRevision, base_profile_revision: baseRevision };
  const calls = [];
  return { calls, content, client: {
    from(table) {
      return { select() { return this; }, eq(key, value) { calls.push([table, key, value]); return this; }, async maybeSingle() {
        return { data: table === 'candidate_profiles' ? row : table === 'candidate_analytics_drafts' ? draft : { content, source_draft_revision: 1, profile_revision: baseRevision, approved_at: 'date' }, error: null };
      } };
    },
    async rpc(name, args) { calls.push([name, args]); return { error: rpcError, data: name === 'write_candidate_analytics_draft' ? draft : { content, source_draft_revision: draftRevision, profile_revision: profileRevision, approved_at: 'date' } }; },
  } };
}

test('service validates before writes and sends owner identity and both revisions', async () => {
  const db = database(); const service = createProfileAnalyticsService(db.client);
  await service.edit({ userId: 'owner', revision: 1, profileRevision: 4, content: db.content });
  const call = db.calls.find(([name]) => name === 'write_candidate_analytics_draft');
  assert.equal(call[1].p_user_id, 'owner'); assert.equal(call[1].p_revision, 1); assert.equal(call[1].p_profile_revision, 4);
  db.calls.length = 0;
  await assert.rejects(service.edit({ userId: 'owner', revision: 1, profileRevision: 4, content: { ...db.content, secret: true } }), e => e.statusCode === 400);
  assert.ok(!db.calls.some(([name]) => name === 'write_candidate_analytics_draft'));
});

test('service blocks unapproved profiles, stale content, missing approval, and invalid revisions', async () => {
  for (const options of [{ approved: false }, { profileRevision: 5 }, { baseRevision: 3 }]) {
    const db = database(options); const service = createProfileAnalyticsService(db.client);
    await assert.rejects(service.approve({ userId: 'owner', revision: 2, profileRevision: 4, approved: true }), e => e.statusCode === 409);
    assert.ok(!db.calls.some(([name]) => name === 'approve_candidate_analytics'));
  }
  const service = createProfileAnalyticsService(database().client);
  await assert.rejects(service.approve({ userId: 'owner', revision: 2, profileRevision: 4, approved: false }), e => e.statusCode === 400);
  await assert.rejects(service.edit({ userId: 'owner', revision: null, profileRevision: 4 }), e => e.statusCode === 400);
});

test('service reports stale records to owner and maps database race rejection', async () => {
  const service = createProfileAnalyticsService(database({ baseRevision: 3 }).client);
  const result = await service.read('owner');
  assert.equal(result.draft.stale, true); assert.equal(result.saved.stale, true);
  assert.equal(result.draft.candidate_profile_id, undefined);
  const db = database({ rpcError: { code: '40001' } });
  await assert.rejects(createProfileAnalyticsService(db.client).edit({ userId: 'owner', revision: 2, profileRevision: 4, content: db.content }), e => e.statusCode === 409);
});

test('private analytics routes require login and derive owner from authentication', async () => {
  const calls = [];
  const app = express(); app.use(express.json());
  const supabase = { auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'owner' } : null } }) } };
  const service = { read: async id => { calls.push(id); return { draft: null, saved: null }; },
    edit: async args => { calls.push(args); return { revision: 1 }; }, approve: async args => { calls.push(args); return { revision: 1 }; } };
  registerProfileAnalytics(app, { supabase, authenticateUser: createAuthenticateUser(supabase), service });
  await request(app).get('/api/profile/analytics').expect(401);
  await request(app).put('/api/profile/analytics/draft').send({}).expect(401);
  await request(app).post('/api/profile/analytics/approve').send({}).expect(401);
  const response = await request(app).get('/api/profile/analytics').auth('valid', { type: 'bearer' }).expect(200);
  assert.equal(response.headers['cache-control'], 'no-store');
  await request(app).put('/api/profile/analytics/draft').auth('valid', { type: 'bearer' }).send({ userId: 'victim', revision: 0, profileRevision: 4, content: emptyProfileAnalytics() }).expect(200);
  assert.equal(calls[0], 'owner'); assert.equal(calls[1].userId, 'owner');
});
