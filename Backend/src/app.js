const express = require("express");
const cors = require("cors");
const { createAuthenticateUser } = require("./middleware/authenticateUser");
const { handleResumeUpload } = require("./middleware/uploadResume");
const {
  createResumeService,
  ResumeServiceError,
} = require("./services/resumeService");
const {
  createCandidateProfileService,
  CandidateProfileServiceError,
} = require("./services/candidateProfileService");
const {
  createResumeTextExtractor,
  ResumeTextExtractionError,
} = require("./services/resumeTextExtractor");
const { createCandidateProfileParser, CandidateProfileParsingError } = require("./services/candidateProfileParser");
const { createResumeParsingService } = require("./services/resumeParsingService");
const { createDeepSeekClientFromEnv } = require("./ai/deepSeekClient");
const { fromCandidateProfileRow } = require("./mappers/candidateProfileMapper");
const { createProfileDraftService } = require("./services/profileDraftService");

const { createProfileRefinementService } = require("./services/profileRefinementService");

function createApp({
  supabaseClient,
  resumeService,
  candidateProfileService,
  profileDraftService,
  resumeTextExtractor,
  modelClient,
  resumeParsingService,
  profileRefinementService,
  profileSharingService,
} = {}) {
  const supabase = supabaseClient || require("./supabase");
  const resumes = resumeService || createResumeService(supabase);
  const candidateProfiles =
    candidateProfileService || createCandidateProfileService(supabase);
  const textExtractor = resumeTextExtractor || createResumeTextExtractor();
  const drafts = profileDraftService || createProfileDraftService(supabase);
  const aiClient = modelClient || createDeepSeekClientFromEnv();
  const parser = createCandidateProfileParser(aiClient);
  const refinement = profileRefinementService || createProfileRefinementService({ supabase, modelClient: aiClient });
  const resumeParser = resumeParsingService || createResumeParsingService({
    resumeService: resumes,
    profileDraftService: drafts,
    parser,
  });
  const authenticateUser = createAuthenticateUser(supabase);
  const app = express();

  app.use(cors());
  app.use(express.json());
  require('./routes/profileSharing').registerProfileSharing(app, {
    supabase, authenticateUser, service: profileSharingService,
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/auth/me", authenticateUser, async (req, res) => {
    try {
      const profile = await candidateProfiles.ensureProfile(req.user);
      return res.json({ user: req.user, profile });
    } catch (error) {
      if (error instanceof CandidateProfileServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: "Unable to prepare candidate profile" });
    }
  });

  app.get("/api/profile/draft", authenticateUser, async (req, res) => {
    try {
      const profile = await candidateProfiles.ensureProfile(req.user);
      const draft = await drafts.getLatestDraft({ profileId: profile.id });
      return res.json({ draft });
    } catch (error) {
      if (error instanceof CandidateProfileServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Unable to load profile draft" });
    }
  });

  const refinementActions = [
    ['questions', 'generate'], ['questions/:questionId', 'respond'], ['finish', 'finish'],
    ...['polish', 'review', 'edit', 'reject', 'save', 'reopen'].map(action => [action, action]),
  ];
  for (const [path, method] of refinementActions) {
    app.post(`/api/profile/drafts/:draftId/${path}`, authenticateUser, async (req, res) => {
      try {
        const draft = await refinement[method]({
          revision: req.body?.revision, status: req.body?.status,
          answer: req.body?.answer, finished: req.body?.finished,
          content: req.body?.content, approved: req.body?.approved,
          userId: req.user.id, draftId: req.params.draftId, questionId: req.params.questionId,
        });
        return res.json({ draft });
      } catch (error) {
        return res.status(error instanceof CandidateProfileServiceError ? error.statusCode : 500)
          .json({ error: error instanceof CandidateProfileServiceError ? error.message : 'Unable to update refinement' });
      }
    });
  }

  app.get("/api/profile", authenticateUser, async (req, res) => {
    try {
      const profile = await candidateProfiles.ensureProfile(req.user);

      if (profile.profile_data?.schemaVersion !== 1) {
        return res.status(404).json({ error: "A parsed candidate profile is not available yet" });
      }

      return res.json({ profile: fromCandidateProfileRow(profile) });
    } catch (error) {
      if (error instanceof CandidateProfileServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: "Unable to load candidate profile" });
    }
  });

  app.post(
    "/api/resumes",
    authenticateUser,
    handleResumeUpload,
    async (req, res) => {
      try {
        const storedResume = await resumes.saveResume({
          file: req.file,
          userId: req.user.id,
        });

        try {
          const extractedText = await textExtractor.extractText(req.file);
          const processedResume = await resumes.saveExtractedText({
            resumeId: storedResume.id,
            extractedText,
          });

          if (resumeParser.isConfigured()) {
            const result = await resumeParser.parseResume({
              resumeId: processedResume.id,
              userId: req.user.id,
            });
            return res.status(201).json(result);
          }

          return res.status(201).json({ resume: processedResume });
        } catch (error) {
          if (error instanceof ResumeTextExtractionError) {
            return res.status(error.statusCode).json({
              error: error.message,
              resume: {
                id: storedResume.id,
                status: "extraction_failed",
              },
            });
          }

          throw error;
        }
      } catch (error) {
        if (error instanceof ResumeServiceError || error instanceof CandidateProfileServiceError || error instanceof CandidateProfileParsingError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to save resume" });
      }
    },
  );

  app.post("/api/resumes/:resumeId/parse", authenticateUser, async (req, res) => {
    try {
      const result = await resumeParser.parseResume({
        resumeId: req.params.resumeId,
        userId: req.user.id,
      });
      return res.json(result);
    } catch (error) {
      if (
        error instanceof CandidateProfileParsingError ||
        error instanceof ResumeServiceError ||
        error instanceof CandidateProfileServiceError
      ) {
        return res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
        });
      }
      return res.status(500).json({ error: "Unable to parse resume" });
    }
  });

  return app;
}

module.exports = { createApp };
