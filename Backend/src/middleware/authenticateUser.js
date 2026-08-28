function createAuthenticateUser(supabaseClient) {
  return async function authenticateUser(req, res, next) {
    const authorization = req.get("authorization");
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const accessToken = match[1];

    try {
      const { data, error } = await supabaseClient.auth.getUser(accessToken);

      if (error || !data.user) {
        return res
          .status(401)
          .json({ error: "Invalid or expired access token" });
      }

      req.user = data.user;
      return next();
    } catch {
      return res
        .status(401)
        .json({ error: "Invalid or expired access token" });
    }
  };
}

module.exports = { createAuthenticateUser };
