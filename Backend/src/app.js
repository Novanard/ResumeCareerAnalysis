const express = require("express");
const cors = require("cors");
const { createAuthenticateUser } = require("./middleware/authenticateUser");
const { handleResumeUpload } = require("./middleware/uploadResume");
const {
  createResumeService,
  ResumeServiceError,
} = require("./services/resumeService");

function createApp({ supabaseClient, resumeService } = {}) {
  const supabase = supabaseClient || require("./supabase");
  const resumes = resumeService || createResumeService(supabase);
  const authenticateUser = createAuthenticateUser(supabase);
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/auth/me", authenticateUser, (req, res) => {
    res.json({ user: req.user });
  });

  app.post(
    "/api/resumes",
    authenticateUser,
    handleResumeUpload,
    async (req, res) => {
      try {
        const resume = await resumes.saveResume({
          file: req.file,
          userId: req.user.id,
        });

        return res.status(201).json({ resume });
      } catch (error) {
        if (error instanceof ResumeServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to save resume" });
      }
    },
  );

  app.get("/api/test-db", authenticateUser, async (_req, res) => {
    const { data, error } = await supabase
      .from("candidate_profiles")
      .select("*");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  });

  return app;
}

module.exports = { createApp };
