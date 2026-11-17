// Live quality evaluation: four paid AI requests with synthetic public data only.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
const assert = require('node:assert/strict');
const { createDeepSeekClientFromEnv } = require('../src/ai/deepSeekClient');
const { createCandidateQuestionService } = require('../src/services/candidateQuestionService');
const { validCandidateProfile } = require('../testSupport/validCandidateProfile');
const { publicProfile } = require('../src/services/profileSharingService');
const { toCandidateProfileRow } = require('../src/mappers/candidateProfileMapper');

async function main() {
  const modelClient = createDeepSeekClientFromEnv();
  assert.ok(modelClient, 'DEEPSEEK_API_KEY must be configured');
  const content = structuredClone(validCandidateProfile);
  content.skills.push({ name: 'Java', category: 'Language' }, { name: 'Python', category: 'Language' });
  content.projects = [
    { name: 'Campus Library', description: 'Built a Java application for borrowing and returning books, persisting loan records through JDBC.', technologies: ['Java', 'JDBC'], url: null },
    { name: 'Task Scheduler', description: 'Implemented a Java task scheduler with worker threads and task cancellation.', technologies: ['Java'], url: null },
  ];
  const profile = publicProfile(toCandidateProfileRow(content));
  const service = createCandidateQuestionService({ modelClient,
    sharing: { readSnapshot: async () => ({ profile, profileRevision: 1 }) } });
  const cases = [
    { name: 'hands-on Java', question: 'Does this person have hands-on experience in Java?', status: 'answered',
      check(result) {
        assert.match(result.answer, /Campus Library/i);
        assert.match(result.answer, /Task Scheduler/i);
        assert.match(result.answer, /JDBC|loan|borrow/i);
        assert.match(result.answer, /thread|cancellation/i);
        assert.ok(result.sources.includes('projects'));
      } },
    { name: 'skills-only Python', question: 'Does this person have hands-on experience in Python?', status: 'partial',
      check(result) {
        assert.match(result.answer, /Python/i);
        assert.match(result.answer, /not (?:documented|specified|shown|established|demonstrated)|does not (?:document|provide|describe|include|establish|show)|no (?:project|work|specific|documented)|cannot (?:confirm|establish)/i);
        assert.ok(result.sources.includes('skills'));
      } },
    { name: 'professional Java', question: 'What professional Java work experience is documented?', status: 'partial',
      check(result) {
        assert.match(result.answer, /project/i);
        assert.ok(result.sources.includes('projects'));
      } },
    { name: 'unsupported Kafka', question: 'Describe their Kafka experience.', status: 'unavailable', check(result) {
      assert.deepEqual(result.sources, []);
    } },
  ];
  for (const item of cases) {
    const result = await service.answer({ token: 'synthetic-evaluation', question: item.question });
    console.log(JSON.stringify({ case: item.name, ...result }));
    assert.equal(result.status, item.status);
    assert.ok(!result.answer.includes('**'), 'Answer should be plain text');
    assert.doesNotMatch(result.answer, /academic\/personal|in (?:academic|personal) projects|university project|student project/i,
      'Do not classify unlabeled projects');
    item.check(result);
  }
  console.log('PASS evidence quality checks. Review factual claims against the synthetic profile; these checks cannot prove all answers are grounded.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
