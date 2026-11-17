const Ajv = require('ajv');
const { answerSchema } = require('../ai/candidateQuestionPrompt');
const { CandidateProfileServiceError: ServiceError } = require('./candidateProfileService');
const validate = new Ajv({ strict: true }).compile(answerSchema);

function hasInformation(value) {
  if (typeof value === 'string') return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(hasInformation);
  if (value && typeof value === 'object') return Object.values(value).some(hasInformation);
  // Flags alone (e.g. current: false) are not supporting profile facts.
  return false;
}

function createCandidateQuestionService({ sharing, modelClient, capacity = 5, timeoutMs = 30000 }) {
  let active = 0;
  return {
    async answer({ token, question }) {
      const snapshot = await sharing.readSnapshot(token);
      if (!Number.isSafeInteger(snapshot.profileRevision) || snapshot.profileRevision < 0) {
        throw new ServiceError('Unable to load shared profile', 500);
      }
      if (typeof modelClient?.answerCandidateQuestion !== 'function' || active >= capacity) {
        throw new ServiceError('Candidate Q&A is temporarily unavailable. Try again later.', 503);
      }
      active++;
      const controller = new AbortController();
      let timer;
      let timedOut = false;
      try {
        let output;
        let generationError;
        try {
          output = await Promise.race([
            Promise.resolve().then(() => modelClient.answerCandidateQuestion({
              profile: snapshot.profile, question, signal: controller.signal,
            })),
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
                reject(new ServiceError('Answer generation timed out. Please try again.', 504));
              }, timeoutMs);
            }),
          ]);
        } catch (error) { generationError = error; }
        clearTimeout(timer);
        // Always recheck access, including failed generations. Revocation takes priority.
        const current = await sharing.readSnapshot(token);
        if (current.profileRevision !== snapshot.profileRevision) {
          throw new ServiceError('The shared profile changed. Reload it and submit your question again.', 409);
        }
        if (generationError) {
          if (timedOut) throw new ServiceError('Answer generation timed out. Please try again.', 504);
          throw new ServiceError('Unable to generate an answer. Please try again.', 502);
        }
        if (!validate(output) ||
            (output.status === 'unavailable' ? output.sources.length !== 0 : output.sources.length === 0) ||
            output.sources.some(source => !hasInformation(snapshot.profile[source]))) {
          throw new ServiceError('Unable to generate an answer. Please try again.', 502);
        }
        return { ...output, profileRevision: snapshot.profileRevision };
      } finally {
        clearTimeout(timer);
        active--;
      }
    },
  };
}
module.exports = { createCandidateQuestionService, hasInformation };
