const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-flash";

class DeepSeekClientError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeepSeekClientError";
  }
}

function hasRealApiKey(apiKey) {
  return Boolean(apiKey && !apiKey.toUpperCase().includes("PLACEHOLDER"));
}

function createDeepSeekClient({ apiKey, model = DEFAULT_MODEL, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch }) {
  if (!hasRealApiKey(apiKey)) return undefined;

  return {
    async generateCandidateProfile({ instructions, input, schema }) {
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `${instructions}\nReturn only a JSON object. It must match this JSON Schema:\n${JSON.stringify(schema)}`,
            },
            { role: "user", content: input },
          ],
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new DeepSeekClientError(`DeepSeek request failed with status ${response.status}`);
      }

      const body = await response.json();
      const choice = body.choices?.[0];
      if (choice?.finish_reason === "length") {
        throw new DeepSeekClientError("DeepSeek response was truncated");
      }

      const content = choice?.message?.content;
      if (!content?.trim()) {
        throw new DeepSeekClientError("DeepSeek returned an empty response");
      }

      try {
        return JSON.parse(content);
      } catch (_error) {
        throw new DeepSeekClientError("DeepSeek returned invalid JSON");
      }
    },
  };
}

function createDeepSeekClientFromEnv(environment = process.env) {
  return createDeepSeekClient({
    apiKey: environment.DEEPSEEK_API_KEY,
    model: environment.DEEPSEEK_MODEL || DEFAULT_MODEL,
    baseUrl: environment.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
  });
}

module.exports = {
  createDeepSeekClient,
  createDeepSeekClientFromEnv,
  DeepSeekClientError,
};
