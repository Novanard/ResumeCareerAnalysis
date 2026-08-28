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

function createApp({
  supabaseClient,
  resumeService,
  candidateProfileService,
  resumeTextExtractor,
  modelClient,
  resumeParsingService,
} = {}) {
  const supabase = supabaseClient || require("./supabase");
  const resumes = resumeService || createResumeService(supabase);
  const candidateProfiles =
    candidateProfileService || createCandidateProfileService(supabase);
  const textExtractor = resumeTextExtractor || createResumeTextExtractor();
  const parser = createCandidateProfileParser(
    modelClient || createDeepSeekClientFromEnv(),
  );
  const resumeParser = resumeParsingService || createResumeParsingService({
    resumeService: resumes,
    candidateProfileService: candidateProfiles,
    parser,
  });
  const authenticateUser = createAuthenticateUser(supabase);
  const app = express();

  app.use(cors());
  app.use(express.json());

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
        if (error instanceof ResumeServiceError) {
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
