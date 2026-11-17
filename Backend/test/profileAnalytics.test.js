const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { emptyProfileAnalytics } = require('../src/schemas/profileAnalyticsSchema');
const { validateProfileAnalytics } = require('../src/validation/profileAnalyticsValidator');
const { createProfileAnalyticsService, baselineAnalytics } = require('../src/services/profileAnalyticsService');
const { registerProfileAnalytics } = require('../src/routes/profileAnalytics');
const { createAuthenticateUser } = require('../src/middleware/authenticateUser');
const { validCandidateProfile } = require('../testSupport/validCandidateProfile');
const { toCandidateProfileRow } = require('../src/mappers/candidateProfileMapper');

function fixture() {
  const profile = structuredClone(validCandidateProfile);
  profile.projects = [{ name: 'App', description: 'Latency fell from 100ms to 50ms.', technologies: ['React'], url: 'https://example.com/report' }];
  profile.skills = [{ name: 'React', category: null }];
  const content = baselineAnalytics(profile);
  content.outcomes = [{ id: 'o1', projectId: 'project-0', description: 'Reduced latency', metric: 'Latency', baseline: 100, result: 50, unit: 'ms', timeframe: null, measurementMethod: null, preferredDirection: 'decrease', source: 'profile' }];
  content.evidence = [{ id: 'e1', claimType: 'outcome', claimId: 'o1', artifactId: 'artifact-0', snippet: profile.projects[0].description, source: 'profile' }];
  return { profile, content, row: { ...toCandidateProfileRow(profile), id: 'profile', revision: 4, approved_at: 'date' } };
}

test('analytics schema accepts empty and linked profile-derived documents', () => {
  const { profile, content } = fixture();
  assert.equal(validateProfileAnalytics(emptyProfileAnalytics(), profile).valid, true);
  assert.equal(validateProfileAnalytics(content, profile).valid, true);
});
for (const [name, mutate] of [
  ['extra scoring', c => { c.fitScore = 90; }],
  ['verification claims', c => { c.evidence[0].verified = true; }],
  ['duplicate IDs', c => { c.outcomes[0].id = 'project-0'; }],
  ['unknown profile project', c => { c.projects[0].profileProjectIndex = 99; }],
  ['dangling references', c => { c.evidence[0].claimId = 'absent'; }],
  ['reversed dates', c => { Object.assign(c.projects[0], { startDate: '2025', endDate: '2023', current: false }); }],
  ['invalid months', c => { c.projects[0].startDate = '2023-13'; }],
  ['ongoing completed range', c => { Object.assign(c.projects[0], { current: true, endDate: '2024' }); }],
  ['measurements without units', c => { c.outcomes[0].unit = null; }],
  ['unsafe URL', c => { c.artifacts[0].url = 'javascript:alert(1)'; }],
]) test(`analytics reject ${name}`, () => {
  const { profile, content } = fixture(); mutate(content);
  assert.equal(validateProfileAnalytics(content, profile).valid, false);
});

function database({ cached = null, race = false } = {}) {
  const { row, content } = fixture(); const calls = [];
  const client = {
    from(table) { return { select() { return this; }, eq(key, value) { calls.push([table, key, value]); return this; }, async maybeSingle() { return { data: table === 'candidate_profiles' ? row : cached, error: null }; } }; },
    async rpc(name, args) { calls.push([name, args]); return { data: { content: args.p_content, generated_at: 'now' }, error: race ? { code: '40001' } : null }; },
  };
  return { row, content, calls, client };
}

test('automatic extraction reads only current saved facts and stores a read-only cache', async () => {
  const db = database(); let sent;
  const service = createProfileAnalyticsService(db.client, { generateCandidateProfile: async input => { sent = input; return db.content; } });
  const result = await service.read('owner');
  assert.equal(result.profileRevision, 4);
  assert.equal(JSON.parse(sent.input).profile.rawMetadata, undefined);
  assert.equal(JSON.parse(sent.input).candidateNotes, undefined);
  assert.match(sent.instructions, /ONLY from the current approved saved profile/);
  const write = db.calls.find(([name]) => name === 'store_derived_candidate_analytics');
  assert.equal(write[1].p_profile_revision, 4);
  assert.equal(write[1].p_extraction_method, 'model');
  assert.ok(db.calls.every(([name]) => !['candidate_analytics_drafts', 'approve_candidate_analytics', 'write_candidate_analytics_draft'].includes(name)));
  assert.equal(service.approve, undefined); assert.equal(service.edit, undefined);
});

test('matching derived cache is reused without AI; old manually approved content is not reused', async () => {
  const { content } = fixture(); let calls = 0;
  for (const automatic of [true, false]) {
    const db = database({ cached: { content, profile_revision: 4, approved_at: 'date', extraction_version: automatic ? 1 : null, extraction_method: 'model', generated_at: 'old' } });
    await createProfileAnalyticsService(db.client, { generateCandidateProfile: async () => { calls++; return content; } }).read('owner');
    assert.equal(db.calls.some(([name]) => name === 'store_derived_candidate_analytics'), !automatic);
  }
  assert.equal(calls, 1);
});

test('saved profile revisions invalidate derived cache without any second approval', async () => {
  const { content } = fixture();
  const db = database({ cached: { content, profile_revision: 3, extraction_version: 1, extraction_method: 'model' } });
  await createProfileAnalyticsService(db.client, { generateCandidateProfile: async () => content }).read('owner');
  assert.ok(db.calls.some(([name]) => name === 'store_derived_candidate_analytics'));
});

test('baseline extraction retains unknown dates/depth and links only explicit technologies', async () => {
  const db = database();
  const result = await createProfileAnalyticsService(db.client).read('owner');
  const usage = result.analytics.content.skillUsages[0];
  assert.equal(usage.startDate, null); assert.equal(usage.depth, null); assert.equal(usage.usage, null);
  assert.equal(result.analytics.content.outcomes.length, 0);
  assert.equal(result.analytics.method, 'baseline');
});

test('invalid output, provider failure and racing profile saves never store stale analytics', async () => {
  for (const scenario of ['invalid', 'failure', 'race']) {
    const db = database({ race: scenario === 'race' });
    const service = createProfileAnalyticsService(db.client, { generateCandidateProfile: async () => {
      if (scenario === 'failure') throw new Error('provider secret');
      return scenario === 'invalid' ? { schemaVersion: 1 } : db.content;
    } });
    await assert.rejects(service.read('owner'), e => e.statusCode === (scenario === 'race' ? 409 : 502));
    if (scenario !== 'race') assert.ok(!db.calls.some(([name]) => name === 'store_derived_candidate_analytics'));
  }
});

test('parallel reads share one extraction and failed attempts have a retry cooldown', async () => {
  const db = database(); let release; let started;
  const pending = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { started = resolve; });
  let calls = 0;
  const service = createProfileAnalyticsService(db.client, { generateCandidateProfile: async () => { calls++; started(); await pending; return db.content; } });
  const first = service.read('owner'); await ready; const second = service.read('owner'); release(); await Promise.all([first, second]);
  assert.equal(calls, 1);
  const broken = createProfileAnalyticsService(db.client, { generateCandidateProfile: async () => { throw new Error(); } });
  await assert.rejects(broken.read('owner'), e => e.statusCode === 502);
  await assert.rejects(broken.read('owner'), e => e.statusCode === 503);
});

test('owner analytics are authenticated and read-only; old mutation endpoints are absent', async () => {
  const calls = []; const app = express(); app.use(express.json());
  const supabase = { auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'owner' } : null } }) } };
  registerProfileAnalytics(app, { supabase, authenticateUser: createAuthenticateUser(supabase), service: { read: async id => { calls.push(id); return { profileRevision: 4, analytics: {} }; } } });
  await request(app).get('/api/profile/analytics').expect(401);
  const result = await request(app).get('/api/profile/analytics').auth('valid', { type: 'bearer' }).expect(200);
  assert.equal(result.headers['cache-control'], 'no-store'); assert.deepEqual(calls, ['owner']);
  await request(app).put('/api/profile/analytics/draft').auth('valid', { type: 'bearer' }).send({}).expect(404);
  for (const action of ['approve', 'generate']) await request(app).post(`/api/profile/analytics/${action}`).auth('valid', { type: 'bearer' }).send({}).expect(404);
});

test('final main-profile save triggers extraction without requiring analytics approval or failing the save', async () => {
  const { createApp } = require('../src/app'); const calls = [];
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) } };
  const app = createApp({ supabaseClient: supabase, modelClient: {},
    profileRefinementService: { save: async () => ({ id: 'draft', state: 'saved', revision: 2 }) },
    profileAnalyticsService: { read: async id => { calls.push(id); throw new Error('temporary extraction failure'); } },
  });
  await request(app).post('/api/profile/drafts/draft/save').auth('valid', { type: 'bearer' }).send({ revision: 1, approved: true }).expect(200);
  assert.deepEqual(calls, ['owner']);
});

test('public projection strips provenance and undefined private fields', () => {
  const { publicAnalytics } = require('../src/services/profileSharingService');
  const { content } = fixture(); content.projects[0].privateNotes = 'secret'; content.internal = 'secret';
  const projected = publicAnalytics(content);
  assert.equal(projected.projects[0].source, undefined); assert.equal(projected.projects[0].privateNotes, undefined); assert.equal(projected.internal, undefined);
});

test('shared derived analytics recheck revocation and profile revision after extraction', async () => {
  const { createProfileSharingService } = require('../src/services/profileSharingService');
  for (const scenario of ['current', 'revoked', 'changed']) {
    const { row, content } = fixture(); let reads = 0;
    const client = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() {
      reads++;
      return { data: scenario === 'revoked' && reads === 3 ? null : { candidate_profiles: { ...row, revision: scenario === 'changed' && reads === 3 ? 5 : 4 } }, error: null };
    } }; } };
    const derived = { forProfile: async () => ({ content, generatedAt: 'date', method: 'model', extractionVersion: 1 }) };
    const service = createProfileSharingService(client, {}, derived);
    if (scenario !== 'current') await assert.rejects(service.readAnalytics('a'.repeat(43)), e => e.statusCode === (scenario === 'revoked' ? 404 : 409));
    else {
      const result = await service.readAnalytics('a'.repeat(43));
      assert.equal(result.analytics.content.projects[0].source, undefined);
      assert.equal(result.analytics.extractionVersion, 1);
    }
  }
});
