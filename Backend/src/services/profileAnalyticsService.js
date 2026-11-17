const { CandidateProfileServiceError: ServiceError } = require('./candidateProfileService');
const { fromCandidateProfileRow } = require('../mappers/candidateProfileMapper');
const { validateProfileAnalytics } = require('../validation/profileAnalyticsValidator');
const { emptyProfileAnalytics } = require('../schemas/profileAnalyticsSchema');
const { analyticsRequest } = require('../ai/profileAnalyticsPrompt');

const EXTRACTION_VERSION = 1;
// Deterministic facts that remain available without an AI adapter.
function baselineAnalytics(profile) {
  const content = emptyProfileAnalytics();
  for (const [index, project] of profile.projects.entries()) {
    const id = `project-${index}`;
    content.projects.push({ id, profileProjectIndex: index, startDate: null, endDate: null, current: null, source: 'profile' });
    for (const [skillIndex, skill] of profile.skills.entries()) {
      if (skill.name && (project.technologies || []).some(tech => tech.toLowerCase() === skill.name.toLowerCase())) {
        content.skillUsages.push({ id: `usage-${index}-${skillIndex}`, profileSkillIndex: skillIndex, projectIds: [id], profileExperienceIndex: null,
          startDate: null, endDate: null, current: null, usage: null, intensity: null, depth: null, assessmentBasis: null, source: 'profile' });
      }
    }
    if (typeof project.url === 'string' && /^https?:\/\/[^\s]+$/.test(project.url)) content.artifacts.push({ id: `artifact-${index}`, projectId: id, title: project.name || 'Project link', kind: 'other', url: project.url, source: 'profile' });
  }
  return content;
}

function createProfileAnalyticsService(supabase, modelClient) {
  const inFlight = new Map();
  const failedUntil = new Map();
  let active = 0;
  function storageError(error) {
    const missing = ['PGRST202', 'PGRST204', 'PGRST205', '42703', '42883', '42P01'].includes(error?.code);
    throw new ServiceError(missing ? 'Automatic analytics storage needs the latest database migration.' : 'Unable to load profile analytics', missing ? 503 : 500);
  }
  async function forProfile(row) {
    if (!row?.approved_at) throw new ServiceError('Save your profile before viewing analytics', 409);
    const { rawMetadata: _metadata, ...profile } = fromCandidateProfileRow(row);
    const key = `${row.id}:${row.revision}:${EXTRACTION_VERSION}`;
    const { data: cached, error } = await supabase.from('candidate_analytics').select('*').eq('candidate_profile_id', row.id).maybeSingle();
    if (error) storageError(error);
    const method = modelClient?.generateCandidateProfile ? 'model' : 'baseline';
    if (cached?.profile_revision === row.revision && cached.extraction_version === EXTRACTION_VERSION && cached.extraction_method === method && validateProfileAnalytics(cached.content, profile).valid) {
      return { content: cached.content, generatedAt: cached.generated_at, method, extractionVersion: EXTRACTION_VERSION };
    }
    if (inFlight.has(key)) return inFlight.get(key);
    const now = Date.now();
    for (const [entry, until] of failedUntil) if (until <= now) failedUntil.delete(entry);
    if ((failedUntil.get(key) || 0) > now) throw new ServiceError('Analytics extraction failed recently. Please retry in a minute.', 503);
    if (active >= 4) throw new ServiceError('Analytics extraction is busy. Please retry shortly.', 503);
    active++;
    // Start on the next microtask so even synchronous validation failures clear
    // a registered in-flight entry instead of leaving a rejected promise cached.
    const operation = Promise.resolve().then(async () => {
      try {
        let content = baselineAnalytics(profile);
        if (method === 'model') {
          try { content = await modelClient.generateCandidateProfile(analyticsRequest(profile)); }
          catch { throw new ServiceError('Unable to extract analytics from the saved profile. Please retry.', 502); }
          // Origin is assigned by the backend, never by user input or AI output.
          for (const collection of Object.values(content || {})) if (Array.isArray(collection)) {
            for (const item of collection) if (item && typeof item === 'object') item.source = 'profile';
          }
        }
        if (!validateProfileAnalytics(content, profile).valid) throw new ServiceError('Extracted analytics did not pass validation. Please retry.', 502);
        const { data, error: writeError } = await supabase.rpc('store_derived_candidate_analytics', {
          p_profile_id: row.id, p_profile_revision: row.revision, p_extraction_version: EXTRACTION_VERSION,
          p_extraction_method: method, p_content: content,
        });
        if (writeError?.code === '40001') throw new ServiceError('Profile changed. Refresh to view current analytics.', 409);
        if (writeError) storageError(writeError);
        return { content: data.content, generatedAt: data.generated_at, method, extractionVersion: EXTRACTION_VERSION };
      } catch (error) {
        if (error.statusCode !== 409) failedUntil.set(key, Date.now() + 60000);
        throw error;
      } finally { active--; inFlight.delete(key); }
    });
    inFlight.set(key, operation);
    return operation;
  }
  return {
    forProfile,
    async read(userId) {
      const { data: row, error } = await supabase.from('candidate_profiles').select('*').eq('user_id', userId).maybeSingle();
      if (error) storageError(error);
      if (!row) throw new ServiceError('Profile not found', 404);
      const analytics = await forProfile(row);
      const { data: current, error: currentError } = await supabase.from('candidate_profiles').select('revision,approved_at').eq('id', row.id).eq('user_id', userId).maybeSingle();
      if (currentError) storageError(currentError);
      if (!current?.approved_at || current.revision !== row.revision) throw new ServiceError('Profile changed. Refresh analytics.', 409);
      return { profileRevision: row.revision, analytics };
    },
  };
}
module.exports = { createProfileAnalyticsService, baselineAnalytics, EXTRACTION_VERSION };
