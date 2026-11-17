const Ajv = require('ajv');
const { profileAnalyticsSchema } = require('../schemas/profileAnalyticsSchema');
const validate = new Ajv({ allErrors: true, strict: true }).compile(profileAnalyticsSchema);

function validateProfileAnalytics(content, profile) {
  if (!validate(content)) return { valid: false, errors: structuredClone(validate.errors) };
  const errors = [];
  const fail = message => errors.push({ keyword: 'analyticsRelationship', message });
  const groups = ['projects', 'skillUsages', 'outcomes', 'decisions', 'artifacts', 'evidence', 'collaborations'];
  const allIds = new Set();
  for (const group of groups) for (const item of content[group]) {
    if (allIds.has(item.id)) fail(`Duplicate entity ID: ${item.id}`);
    allIds.add(item.id);
  }
  const byId = group => new Map(content[group].map(item => [item.id, item]));
  const projects = byId('projects'), outcomes = byId('outcomes'), decisions = byId('decisions'), artifacts = byId('artifacts');
  const projectIndexes = new Set();
  for (const project of content.projects) {
    if (!profile.projects[project.profileProjectIndex]) fail(`Project ${project.id} refers to missing profile project`);
    if (projectIndexes.has(project.profileProjectIndex)) fail('A profile project must have only one analytics entity');
    projectIndexes.add(project.profileProjectIndex);
  }
  for (const usage of content.skillUsages) {
    if (!profile.skills[usage.profileSkillIndex]?.name) fail(`Skill usage ${usage.id} refers to missing or unnamed skill`);
    if (usage.profileExperienceIndex !== null && !profile.experience[usage.profileExperienceIndex]) fail(`Skill usage ${usage.id} refers to missing employment`);
    for (const projectId of usage.projectIds) if (!projects.has(projectId)) fail(`Unknown project ${projectId}`);
    if (usage.depth !== null && !usage.assessmentBasis) fail('Depth requires an explicit assessment basis');
  }
  for (const group of ['outcomes', 'decisions', 'artifacts', 'collaborations']) {
    for (const item of content[group]) if (!projects.has(item.projectId)) fail(`Unknown project ${item.projectId}`);
  }
  for (const decision of content.decisions) for (const outcomeId of decision.outcomeIds) {
    if (outcomes.get(outcomeId)?.projectId !== decision.projectId) fail(`Decision ${decision.id} needs an outcome from the same project`);
  }
  for (const evidence of content.evidence) {
    const claim = (evidence.claimType === 'outcome' ? outcomes : decisions).get(evidence.claimId);
    const artifact = artifacts.get(evidence.artifactId);
    if (!claim || !artifact || claim.projectId !== artifact.projectId) fail(`Evidence ${evidence.id} needs a claim and artifact from the same project`);
  }
  for (const item of [...content.projects, ...content.skillUsages]) {
    if (item.current === true && item.endDate !== null) fail(`${item.id}: ongoing entries cannot have an end date`);
    // Compare possible bounds without assuming a month for year-only dates.
    if (item.startDate && item.endDate && `${item.startDate.length === 4 ? item.startDate + '-01' : item.startDate}` > `${item.endDate.length === 4 ? item.endDate + '-12' : item.endDate}`) fail(`${item.id}: reversed date range`);
  }
  for (const outcome of content.outcomes) if ((outcome.baseline !== null || outcome.result !== null) && !outcome.unit) fail(`Outcome ${outcome.id}: measured values require units`);
  return { valid: errors.length === 0, errors };
}
module.exports = { validateProfileAnalytics };
