// Analytics are a separate document, never extra keys in CandidateProfile v1.
const text = { type: 'string', minLength: 1, maxLength: 2000, pattern: '\\S' };
const id = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,80}$' };
const nullableText = { anyOf: [text, { type: 'null' }] };
const date = { type: ['string', 'null'], pattern: '^\\d{4}(-(0[1-9]|1[0-2]))?$' };
const index = { type: 'integer', minimum: 0 };
const number = { type: ['number', 'null'] };
const ids = { type: 'array', maxItems: 200, uniqueItems: true, items: id };
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const collection = properties => ({ type: 'array', maxItems: 200, items: object(properties) });
const source = { enum: ['resume', 'candidate_answer', 'manual'] };
const profileAnalyticsSchema = object({
  schemaVersion: { const: 1 },
  projects: collection({ id, profileProjectIndex: index, startDate: date, endDate: date, current: { type: ['boolean', 'null'] }, source }),
  skillUsages: collection({ id, profileSkillIndex: index, projectIds: ids,
    profileExperienceIndex: { type: ['integer', 'null'], minimum: 0 },
    startDate: date, endDate: date, current: { type: ['boolean', 'null'] },
    usage: { enum: ['hands_on', 'led', 'assisted', null] },
    intensity: { enum: ['occasional', 'regular', 'primary', null] },
    depth: { enum: ['exposure', 'applied', 'independent', 'ownership', null] },
    assessmentBasis: nullableText, source }),
  outcomes: collection({ id, projectId: id, description: text, metric: text,
    baseline: number, result: number, unit: nullableText, timeframe: nullableText,
    measurementMethod: nullableText, preferredDirection: { enum: ['increase', 'decrease', null] }, source }),
  decisions: collection({ id, projectId: id, description: text, rationale: nullableText, outcomeIds: ids, source }),
  artifacts: collection({ id, projectId: id, title: text, kind: { enum: ['code', 'design', 'report', 'other'] },
    url: { anyOf: [{ type: 'string', maxLength: 2000, pattern: '^https?://[^\\s]+$' }, { type: 'null' }] }, source }),
  evidence: collection({ id, claimType: { enum: ['outcome', 'decision'] }, claimId: id, artifactId: id, snippet: text, source }),
  collaborations: collection({ id, projectId: id, collaborator: text,
    relationship: { enum: ['team', 'cross_functional', 'mentoring', 'other'] }, description: nullableText, source }),
});
function emptyProfileAnalytics() {
  return { schemaVersion: 1, projects: [], skillUsages: [], outcomes: [], decisions: [], artifacts: [], evidence: [], collaborations: [] };
}
module.exports = { profileAnalyticsSchema, emptyProfileAnalytics };
