const express = require('express');
const { createHash } = require('node:crypto');
const { CandidateProfileServiceError: ServiceError } = require('../services/candidateProfileService');
const { createCandidateQuestionService } = require('../services/candidateQuestionService');

function positiveSetting(environment, key, fallback) {
  const value = Number(environment[key] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${key}`);
  return value;
}

function registerCandidateQuestions(app, { sharing, modelClient, environment = process.env }) {
  const limits = [
    positiveSetting(environment, 'QA_IP_RATE_LIMIT', 10),
    positiveSetting(environment, 'QA_TOKEN_RATE_LIMIT', 20),
    positiveSetting(environment, 'QA_GLOBAL_RATE_LIMIT', 100),
  ];
  const service = createCandidateQuestionService({ sharing, modelClient,
    capacity: positiveSetting(environment, 'QA_MAX_CONCURRENT', 5) });
  const buckets = new Map();
  function budget(req, res, next) {
    const now = Date.now();
    for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
    const keys = [`ip:${req.ip}`, `token:${createHash('sha256').update(req.params.token || '').digest('hex')}`, 'global'];
    const entries = keys.map(key => buckets.get(key) || { count: 0, until: now + 60000 });
    const blocked = entries.filter((entry, index) => entry.count >= limits[index]);
    if (blocked.length) return res.set('Retry-After', String(Math.max(1,
      Math.ceil((Math.max(...blocked.map(entry => entry.until)) - now) / 1000))))
      .status(429).json({ error: 'Too many questions. Please try again later.' });
    entries.forEach((entry, index) => { entry.count++; buckets.set(keys[index], entry); });
    next();
  }
  const parse = express.json({ limit: '4kb' });
  app.post(['/api/shared/profiles/:token/questions', '/api/shared/profiles/questions'], budget,
    (req, res, next) => parse(req, res, error => {
      if (error) return res.status(error.type === 'entity.too.large' ? 413 : 400)
        .json({ error: error.type === 'entity.too.large' ? 'Question request is too large.' : 'Provide a valid JSON question.' });
      next();
    }), async (req, res) => {
      const body = req.body;
      if (!body || Array.isArray(body) || Object.keys(body).length !== 1 ||
          typeof body.question !== 'string' || !body.question.trim() || body.question.trim().length > 1000) {
        return res.status(400).json({ error: 'Provide only a question between 1 and 1,000 characters.' });
      }
      try {
        res.json(await service.answer({ token: req.params.token || '', question: body.question.trim() }));
      } catch (error) {
        const known = error instanceof ServiceError;
        res.status(known ? error.statusCode : 500).json({ error: known ? error.message : 'Unable to answer the question. Please try again.' });
      }
    });
}
module.exports = { registerCandidateQuestions };
