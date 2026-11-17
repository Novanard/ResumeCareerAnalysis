const { createProfileAnalyticsService } = require('../services/profileAnalyticsService');
const { CandidateProfileServiceError } = require('../services/candidateProfileService');

function registerProfileAnalytics(app, { supabase, authenticateUser, service, modelClient }) {
  const analytics = service || createProfileAnalyticsService(supabase, modelClient);
  app.get('/api/profile/analytics', authenticateUser, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(await analytics.read(req.user.id)); }
    catch (error) { res.status(error instanceof CandidateProfileServiceError ? error.statusCode : 500)
      .json({ error: error instanceof CandidateProfileServiceError ? error.message : 'Unable to load profile analytics' }); }
  });
  // Former analytics editing/approval/generation endpoints are deliberately absent.
}
module.exports = { registerProfileAnalytics };
