const test = require('node:test');
const assert = require('node:assert/strict');
const { createProfileRefinementService } = require('../src/services/profileRefinementService');

const { validCandidateProfile } = require('../testSupport/validCandidateProfile');

const input = { userId: 'u1', draftId: 'd1', revision: 1 };
function setup(generate, race = false, initial = {}) {
  let draft = { id: 'd1', candidate_profile_id: 'p1', revision: 1, state: 'refining',
    content: { fullName: 'Candidate' }, questions: [], questions_generated: false, questions_finished: false, ...initial };
  const supabase = { from(table) {
    const filters = {}; let changes;
    const query = {
      select() { return query; }, eq(k, v) { filters[k] = v; return query; },
      update(value) { changes = value; return query; },
      async maybeSingle() {
        if (table === 'candidate_profiles') return { data: filters.user_id === 'u1' ? { id: 'p1' } : null };
        if (changes && race) return { data: null };
        if (Object.entries(filters).some(([k, v]) => draft[k] !== v)) return { data: null };
        if (changes) draft = { ...draft, ...changes };
        return { data: structuredClone(draft) };
      },
    }; return query;
  }, async rpc(name, args) {
    assert.equal(name, 'save_reviewed_profile_draft');
    assert.deepEqual(args, { p_user_id: 'u1', p_draft_id: 'd1', p_revision: draft.revision });
    if (race) return { error: { code: '40001' } };
    draft = { ...draft, state: 'saved', confirmed_revision: draft.revision };
    return { data: structuredClone(draft) };
  } };
  return { service: createProfileRefinementService({ supabase, modelClient: { generateCandidateProfile: generate } }), get: () => draft };
}
const generate = async () => ({ questions: [{ section: 'Projects', text: 'What did you build?', reason: 'Clarify your contribution.' }] });

test('questions, answers, skips, and finish persist without modifying profile content', async () => {
  let calls = 0;
  const { service } = setup(async () => { calls++; return generate(); });
  let draft = await service.generate(input);
  assert.deepEqual(await service.generate({ ...input, revision: 2 }), draft);
  assert.equal(calls, 1);
  const questionId = draft.questions[0].id;
  draft = await service.respond({ ...input, revision: 2, questionId, status: 'answered', answer: 'Built the UI' });
  assert.equal(draft.questions[0].answer, 'Built the UI');
  draft = await service.respond({ ...input, revision: 3, questionId, status: 'skipped' });
  assert.equal(draft.questions[0].answer, null);
  draft = await service.finish({ ...input, revision: 4, finished: true });
  assert.equal(draft.questions_finished, true);
  await assert.rejects(service.respond({ ...input, revision: 5, questionId, status: 'skipped' }), { statusCode: 409 });
  draft = await service.finish({ ...input, revision: 5, finished: false });
  assert.equal(draft.questions_finished, false);
  assert.deepEqual(draft.content, { fullName: 'Candidate' });
});
test('ownership is checked before AI generation', async () => {
  const { service } = setup(() => assert.fail('AI must not run'));
  await assert.rejects(service.generate({ ...input, userId: 'other' }), { statusCode: 404 });
});
test('invalid AI output and provider failures preserve draft state', async () => {
  for (const fn of [async () => { throw Error('provider'); }, async () => ({ questions: [{}] })]) {
    const { service, get } = setup(fn);
    await assert.rejects(service.generate(input));
    assert.equal(get().revision, 1);
    assert.deepEqual(get().questions, []);
  }
});
test('stale requests and concurrent updates cannot overwrite progress', async () => {
  const { service, get } = setup(generate, true);
  await assert.rejects(service.generate({ ...input, revision: 99 }), { statusCode: 409 });
  await assert.rejects(service.generate(input), { statusCode: 409 });
  assert.equal(get().revision, 1);
});
test('empty answers and unknown questions are rejected', async () => {
  const { service } = setup(generate);
  await assert.rejects(service.respond({ ...input, status: 'answered', answer: ' ' }), { statusCode: 400 });
  await assert.rejects(service.respond({ ...input, questionId: 'missing', status: 'skipped' }), { statusCode: 404 });
});

test('refinement routes require authentication and ignore spoofed ownership', async () => {
  const request = require('supertest');
  const { createApp } = require('../src/app');
  let received;
  const app = createApp({
    supabaseClient: { auth: { async getUser() { return { data: { user: { id: 'u1' } } }; } } },
    profileRefinementService: { async generate(args) { received = args; return { id: args.draftId }; } },
  });
  await request(app).post('/api/profile/drafts/d1/questions').send({ revision: 1 }).expect(401);
  await request(app).post('/api/profile/drafts/d1/questions')
    .set('Authorization', 'Bearer token').send({ revision: 1, userId: 'other', draftId: 'other' }).expect(200);
  assert.equal(received.userId, 'u1');
  assert.equal(received.draftId, 'd1');
});

test('polishing uses candidate answers and stores a private review proposal', async () => {
  let received;
  const content = structuredClone(validCandidateProfile);
  content.summary = 'Improved wording';
  const questions = [{ id: 'q1', text: 'Contribution?', answer: 'Built UI', status: 'answered' },
    { id: 'q2', text: 'Other?', answer: null, status: 'skipped' }];
  const { service } = setup(async request => { received = request; return content; }, false,
    { content: validCandidateProfile, questions });
  const result = await service.polish(input);
  assert.equal(result.state, 'review');
  assert.deepEqual(result.review_baseline, validCandidateProfile);
  assert.equal(result.content.summary, 'Improved wording');
  assert.equal(JSON.parse(received.input).answers.length, 1);
  assert.equal(result.proposal_source_revision, 1);
});
test('invalid or failed polishing and delayed AI results preserve the current draft', async () => {
  for (const generate of [async () => ({}), async () => { throw Error('provider'); }]) {
    const { service, get } = setup(generate, false, { content: validCandidateProfile });
    await assert.rejects(service.polish(input));
    assert.equal(get().revision, 1);
    assert.equal(get().state, 'refining');
  }
  const { service, get } = setup(async () => validCandidateProfile, true, { content: validCandidateProfile });
  await assert.rejects(service.polish(input), { statusCode: 409 });
  assert.equal(get().revision, 1);
});
test('review without AI, manual edits, and rejecting a proposal preserve the baseline', async () => {
  const { service } = setup(undefined, false, { content: validCandidateProfile });
  let result = await service.review(input);
  assert.equal(result.state, 'review');
  const content = { ...validCandidateProfile, fullName: 'Corrected Name' };
  result = await service.edit({ ...input, revision: 2, content });
  assert.equal(result.content.fullName, 'Corrected Name');
  assert.equal(result.confirmed_revision, null);
  await assert.rejects(service.edit({ ...input, revision: 3, content: {} }), { statusCode: 422 });
  result = await service.reject({ ...input, revision: 3 });
  assert.deepEqual(result.content, validCandidateProfile);
});
test('final saving requires explicit approval before touching the database', async () => {
  const { service } = setup(undefined);
  await assert.rejects(service.save(input), { statusCode: 400 });
});

test('final save passes the exact reviewed revision and reports stale database writes', async () => {
  const { service } = setup(undefined, false, { content: validCandidateProfile, state: 'review' });
  const saved = await service.save({ ...input, approved: true });
  assert.equal(saved.state, 'saved');
  assert.equal(saved.confirmed_revision, 1);
  const conflict = setup(undefined, true, { content: validCandidateProfile, state: 'review' });
  await assert.rejects(conflict.service.save({ ...input, approved: true }), { statusCode: 409 });
  assert.equal(conflict.get().state, 'review');
});
test('later polishing does not replay old answers over manual edits or deletions', async () => {
  let prompt;
  const oldAnswer = { id: 'q1', status: 'answered', answer: 'Original detail' };
  const { service } = setup(async request => { prompt = JSON.parse(request.input); return validCandidateProfile; }, false,
    { content: validCandidateProfile, state: 'review', questions: [oldAnswer], proposal_answers: [oldAnswer] });
  await service.polish(input);
  assert.deepEqual(prompt.answers, []);
});
