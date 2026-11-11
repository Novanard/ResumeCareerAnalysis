const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { registerProfileSharing } = require('../src/routes/profileSharing');
const { createAuthenticateUser } = require('../src/middleware/authenticateUser');
const { createProfileSharingService, publicProfile } = require('../src/services/profileSharingService');
const { CandidateProfileServiceError } = require('../src/services/candidateProfileService');
const { validCandidateProfile } = require('../testSupport/validCandidateProfile');
const { toCandidateProfileRow } = require('../src/mappers/candidateProfileMapper');

function appFor(service, environment = {}) {
  const app = express();
  app.use(express.json());
  const supabase = { auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'owner' } : null } }) } };
  registerProfileSharing(app, { supabase, authenticateUser: createAuthenticateUser(supabase), service, environment });
  return app;
}

test('sharing management requires authentication and derives ownership from session', async () => {
  const calls = [];
  const service = { status: async id => { calls.push(id); return { enabled: false, url: null }; },
    set: async (id, enabled) => { calls.push([id, enabled]); return { enabled, url: null }; } };
  const app = appFor(service);
  for (const path of ['enable', 'disable']) await request(app).post(`/api/profile/sharing/${path}`).expect(401);
  await request(app).get('/api/profile/sharing').expect(401);
  await request(app).get('/api/profile/sharing').auth('valid', { type: 'bearer' }).expect(200);
  await request(app).post('/api/profile/sharing/enable').auth('valid', { type: 'bearer' }).send({ userId: 'victim' }).expect(200);
  assert.deepEqual(calls, ['owner', ['owner', true]]);
});

test('public route needs no login, prevents caching and indexing, and limits forwarded-header bypass', async () => {
  const app = appFor({ read: async () => ({ fullName: 'Candidate' }) }, { SHARED_PROFILE_RATE_LIMIT: '1' });
  const first = await request(app).get('/api/shared/profiles/example').expect(200);
  assert.equal(first.headers['cache-control'], 'no-store');
  assert.equal(first.headers['referrer-policy'], 'no-referrer');
  assert.equal(first.headers['x-robots-tag'], 'noindex, nofollow');
  const limited = await request(app).get('/api/shared/profiles/example').set('X-Forwarded-For', '1.2.3.4').expect(429);
  assert.ok(Number(limited.headers['retry-after']) > 0);
});

test('known unavailable links are 404 and unexpected errors are generic 500', async () => {
  let outage = false;
  const app = appFor({ read: async () => { throw outage ? new Error('secret') : new CandidateProfileServiceError('Shared profile unavailable', 404); } });
  const missing = await request(app).get('/api/shared/profiles').expect(404);
  assert.deepEqual(missing.body, { error: 'Shared profile unavailable' });
  outage = true;
  const failed = await request(app).get('/api/shared/profiles/test').expect(500);
  assert.ok(!JSON.stringify(failed.body).includes('secret'));
});

test('public projection strips private metadata and extra nested keys', () => {
  const content = structuredClone(validCandidateProfile);
  content.contact.internalSecret = 'secret';
  content.skills[0].internalSecret = 'secret';
  const row = { ...toCandidateProfileRow(content), id: 'private-id', user_id: 'private-user', extracted_text: 'private text' };
  const result = publicProfile(row);
  assert.equal(result.fullName, content.fullName);
  assert.equal(result.rawMetadata, undefined);
  assert.equal(result.contact.internalSecret, undefined);
  assert.equal(result.skills[0].internalSecret, undefined);
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('sharing validates configured origin before mutating and passes only owned state to atomic RPC', async () => {
  let call;
  const supabase = { rpc: async (name, args) => {
    call = { name, args };
    return { data: [{ enabled: true, token: args.p_token }] };
  } };
  await assert.rejects(createProfileSharingService(supabase, { FRONTEND_ORIGIN: 'http://evil.example' }).set('owner', true));
  assert.equal(call, undefined);
  const service = createProfileSharingService(supabase, { FRONTEND_ORIGIN: 'https://career.example' });
  const result = await service.set('owner', true);
  assert.equal(call.name, 'set_profile_sharing');
  assert.equal(call.args.p_user_id, 'owner');
  assert.match(call.args.p_token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.url, `https://career.example/shared/${call.args.p_token}`);
});

test('public reads reject malformed, inactive and unapproved profiles; join active token to current saved row', async () => {
  let data = null;
  const filters = [];
  const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; }, async maybeSingle() { return { data }; } };
  const service = createProfileSharingService({ from: () => query });
  await assert.rejects(service.read('bad'), error => error.statusCode === 404);
  assert.equal(filters.length, 0);
  const token = 'a'.repeat(43);
  await assert.rejects(service.read(token), error => error.statusCode === 404);
  data = { candidate_profiles: { ...toCandidateProfileRow(validCandidateProfile), approved_at: null } };
  await assert.rejects(service.read(token), error => error.statusCode === 404);
  data.candidate_profiles.approved_at = '2026-11-11';
  assert.equal((await service.read(token)).fullName, validCandidateProfile.fullName);
  assert.ok(filters.some(([key, value]) => key === 'enabled' && value === true));
  assert.ok(filters.some(([key, value]) => key === 'token' && value === token));
});
