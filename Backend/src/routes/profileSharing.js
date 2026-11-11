const { createProfileSharingService } = require('../services/profileSharingService');
const { CandidateProfileServiceError } = require('../services/candidateProfileService');

function registerProfileSharing(app, { supabase, authenticateUser, service, environment = process.env }) {
  const sharing = service || createProfileSharingService(supabase, environment);
  // Trust only explicitly configured proxy hops/addresses, never arbitrary forwarded headers.
  if (environment.TRUST_PROXY) app.set('trust proxy', environment.TRUST_PROXY.split(',').map(v => v.trim()));
  const limit = Number(environment.SHARED_PROFILE_RATE_LIMIT || 60);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid SHARED_PROFILE_RATE_LIMIT');
  const clients = new Map();
  const privacy = (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  };
  function failure(res, error) {
    const known = error instanceof CandidateProfileServiceError;
    return res.status(known ? error.statusCode : 500).json({ error: known ? error.message : 'Unable to access sharing' });
  }
  app.use('/api/profile/sharing', privacy);
  app.get('/api/profile/sharing', authenticateUser, async (req, res) => {
    try { res.json({ sharing: await sharing.status(req.user.id) }); } catch (error) { failure(res, error); }
  });
  for (const [action, enabled] of [['enable', true], ['disable', false]]) {
    app.post(`/api/profile/sharing/${action}`, authenticateUser, async (req, res) => {
      try { res.json({ sharing: await sharing.set(req.user.id, enabled) }); } catch (error) { failure(res, error); }
    });
  }
  app.use('/api/shared/profiles', privacy, (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of clients) if (value.until <= now) clients.delete(key);
    const key = req.ip;
    const entry = clients.get(key) || { count: 0, until: now + 60000 };
    entry.count++;
    clients.set(key, entry);
    if (entry.count > limit) return res.set('Retry-After', String(Math.max(1, Math.ceil((entry.until - now) / 1000)))).status(429).json({ error: 'Too many requests. Try again shortly.' });
    next();
  });
  app.get(['/api/shared/profiles/:token', '/api/shared/profiles'], async (req, res) => {
    try { res.json({ profile: await sharing.read(req.params.token || '') }); } catch (error) { failure(res, error); }
  });
}
module.exports = { registerProfileSharing };
