// Explicitly invoked integration check; uses live Supabase and paid AI requests.
// Only synthetic data is submitted. The temporary user and files are cleaned up.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
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
  const verifySharing = process.argv.includes('--sharing');
  if (verifySharing) {
    assert.ok(process.env.FRONTEND_ORIGIN, 'FRONTEND_ORIGIN must be configured for sharing verification');
    const preflight = await supabase.from('candidate_profile_shares').select('candidate_profile_id').limit(0);
    assert.ifError(preflight.error);
  }
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
    if (verifySharing) {
      await post('/api/profile/sharing/enable', {}).expect(409);
      const disabled = await get('/api/profile/sharing').expect(200);
      assert.equal(disabled.body.sharing.enabled, false);
    }
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
    let publicPath;
    if (verifySharing) {
      const enables = await Promise.all(Array.from({ length: 3 }, () => post('/api/profile/sharing/enable', {}).expect(200)));
      const url = enables[0].body.sharing.url;
      for (const result of enables) assert.equal(result.body.sharing.url, url);
      const status = await get('/api/profile/sharing').expect(200);
      assert.equal(status.body.sharing.url, url);
      publicPath = `/api/shared/profiles/${new URL(url).pathname.split('/').pop()}`;
      const visitor = await request(app).get(publicPath).expect(200);
      assert.equal(visitor.body.profile.headline, content.headline);
      assert.equal(visitor.body.profile.rawMetadata, undefined);
      assert.equal(visitor.headers['cache-control'], 'no-store');
      console.log('PASS concurrent sharing enables, stable owner URL and anonymous saved-profile projection');
    }
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
    if (verifySharing) {
      const unchanged = await request(app).get(publicPath).expect(200);
      assert.equal(unchanged.body.profile.headline, content.headline);
      await action('save', { approved: true });
      const updated = await request(app).get(publicPath).expect(200);
      assert.equal(updated.body.profile.headline, 'Private unsaved change');
      await post('/api/profile/sharing/disable', {}).expect(200);
      await post('/api/profile/sharing/disable', {}).expect(200);
      await request(app).get(publicPath).expect(404);
      const enabled = await post('/api/profile/sharing/enable', {}).expect(200);
      const newPath = `/api/shared/profiles/${new URL(enabled.body.sharing.url).pathname.split('/').pop()}`;
      assert.notEqual(newPath, publicPath);
      await request(app).get(publicPath).expect(404);
      await request(app).get(newPath).expect(200);
      console.log('PASS private edits stay private, final saves update visitor content, revocation and token rotation');
    }
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
