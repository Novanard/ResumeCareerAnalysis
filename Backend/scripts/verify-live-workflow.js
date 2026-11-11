// Explicitly invoked integration check; uses live Supabase and paid AI requests.
// Only synthetic data is submitted. The temporary user and files are cleaned up.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const request = require('supertest');
const { createApp } = require('../src/app');

function syntheticPdf() {
  const text = 'Test Candidate. Software Developer at Example Company since January 2024. Built React interfaces. Skills: React, JavaScript.';
  const stream = `BT /F1 10 Tf 10 100 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 150] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  return Buffer.from(`${pdf}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}

async function main() {
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEEPSEEK_API_KEY']) {
    assert.ok(process.env[key], `${key} must be configured`);
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const app = createApp({ supabaseClient: supabase });
  // Keep password sessions off the service-role client used by backend services.
  const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `mvp-smoke-${randomUUID()}@example.com`;
  const password = randomUUID() + randomUUID();
  let userId;
  try {
    const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(created.error);
    userId = created.data.user.id;
    const login = await authClient.auth.signInWithPassword({ email, password });
    assert.ifError(login.error);
    let token = login.data.session.access_token;
    const get = (path) => request(app).get(path).auth(token, { type: 'bearer' });
    const post = (path, body) => request(app).post(path).auth(token, { type: 'bearer' }).send(body);
    await get('/api/auth/me').expect(200);
    console.log('PASS real authentication and profile creation');
    const upload = await request(app).post('/api/resumes').auth(token, { type: 'bearer' })
      .attach('resume', syntheticPdf(), { filename: 'synthetic-resume.pdf', contentType: 'application/pdf' }).expect(201);
    assert.equal(upload.body.resume.processing_status, 'parsed');
    let draft = upload.body.draft;
    console.log('PASS storage upload, PDF extraction, live AI parsing and private draft creation');
    await get('/api/profile').expect(404);
    const action = async (name, extra = {}, expected = 200) => {
      const result = await post(`/api/profile/drafts/${draft.id}/${name}`, { revision: draft.revision, ...extra }).expect(expected);
      if (expected === 200) draft = result.body.draft;
      return result;
    };
    await action('questions');
    if (draft.questions.length) {
      await action(`questions/${draft.questions[0].id}`, { status: 'answered', answer: 'I implemented the React user interface and file upload form.' });
      for (const question of draft.questions.slice(1)) await action(`questions/${question.id}`, { status: 'skipped' });
    }
    await action('finish', { finished: true });
    const restored = await get('/api/profile/draft').expect(200);
    assert.deepEqual(restored.body.draft, draft);
    console.log('PASS live follow-up generation, answer/skip and persisted draft recovery');
    await action('polish');
    const content = { ...draft.content, headline: 'Manually reviewed test profile' };
    await action('edit', { content });
    await get('/api/profile').expect(404);
    const stale = await post(`/api/profile/drafts/${draft.id}/edit`, { revision: draft.revision - 1, content }).expect(409);
    assert.ok(stale.body.error);
    await action('save', { approved: false }, 400);
    await action('save', { approved: true });
    assert.equal(draft.state, 'saved');
    await action('save', { approved: true });
    const saved = await get('/api/profile').expect(200);
    assert.equal(saved.body.profile.headline, content.headline);
    console.log('PASS polishing, manual editing, stale-write rejection, atomic final save and retry');
    await action('reopen');
    await action('edit', { content: { ...draft.content, headline: 'Private unsaved change' } });
    const stillSaved = await get('/api/profile').expect(200);
    assert.equal(stillSaved.body.profile.headline, content.headline);
    const relogin = await authClient.auth.signInWithPassword({ email, password });
    assert.ifError(relogin.error);
    token = relogin.data.session.access_token;
    const resumed = await get('/api/profile/draft').expect(200);
    assert.equal(resumed.body.draft.content.headline, 'Private unsaved change');
    console.log('PASS later edits preserve saved content and survive a new login');
  } finally {
    if (userId) {
      const files = await supabase.storage.from('resumes').list(userId);
      assert.ifError(files.error);
      if (files.data.length) {
        const removed = await supabase.storage.from('resumes').remove(files.data.map(file => `${userId}/${file.name}`));
        assert.ifError(removed.error);
      }
      const deleted = await supabase.auth.admin.deleteUser(userId);
      assert.ifError(deleted.error);
      console.log('PASS temporary account, database records and storage files cleaned up');
    }
  }
}

main().catch(error => {
  // Do not print request objects, tokens, credentials, or provider payloads.
  console.error(`Live workflow check failed: ${error.message}`);
  process.exitCode = 1;
});
