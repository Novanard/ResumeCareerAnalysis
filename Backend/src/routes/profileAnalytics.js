const { createProfileAnalyticsService } = require('../services/profileAnalyticsService');
const { CandidateProfileServiceError } = require('../services/candidateProfileService');

function registerProfileAnalytics(app, { supabase, authenticateUser, service }) {
  const analytics = service || createProfileAnalyticsService(supabase);
  function handle(action) {
    return async (req, res) => {
      res.set('Cache-Control', 'no-store');
      try {
        const result = action === 'read' ? await analytics.read(req.user.id) : await analytics[action]({
          userId: req.user.id, profileRevision: req.body?.profileRevision,
          revision: req.body?.revision, content: req.body?.content, approved: req.body?.approved,
        });
        res.json(action === 'read' ? result : { [action === 'edit' ? 'draft' : 'saved']: result });
      } catch (error) {
        res.status(error instanceof CandidateProfileServiceError ? error.statusCode : 500)
          .json({ error: error instanceof CandidateProfileServiceError ? error.message : 'Unable to access profile analytics' });
      }
    };
  }
  app.get('/api/profile/analytics', authenticateUser, handle('read'));
  app.put('/api/profile/analytics/draft', authenticateUser, handle('edit'));
  app.post('/api/profile/analytics/approve', authenticateUser, handle('approve'));
}
module.exports = { registerProfileAnalytics };
