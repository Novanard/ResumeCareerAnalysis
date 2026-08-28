const express = require("express");
const cors = require("cors");
const { createAuthenticateUser } = require("./middleware/authenticateUser");

function createApp({ supabaseClient } = {}) {
  const supabase = supabaseClient || require("./supabase");
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
