const test = require("node:test");
const assert = require("node:assert/strict");
const { createDeepSeekClient } = require("../src/ai/deepSeekClient");

test("placeholder key leaves DeepSeek disabled without making a request", () => {
  assert.equal(createDeepSeekClient({ apiKey: "PLACEHOLDER" }), undefined);
});

test("DeepSeek adapter sends JSON mode request and parses its JSON response", async () => {
  let request;
  const client = createDeepSeekClient({
    apiKey: "test-key",
    model: "test-model",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        async json() {
          return {
            choices: [{ finish_reason: "stop", message: { content: '{"schemaVersion":1}' } }],
          };
        },
      };
    },
  });

  const result = await client.generateCandidateProfile({
    instructions: "Return JSON",
    input: "resume text",
    schema: { type: "object" },
  });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal(request.options.headers.Authorization, "Bearer test-key");
  assert.equal(body.model, "test-model");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.match(body.messages[0].content, /JSON Schema/);
  assert.equal(body.messages[1].content, "resume text");
  assert.deepEqual(result, { schemaVersion: 1 });
});

test("DeepSeek adapter rejects HTTP, empty, truncated, and invalid JSON responses", async () => {
  const cases = [
    { ok: false, status: 401, json: async () => ({}) },
    { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: "" } }] }) },
    { ok: true, json: async () => ({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }) },
    { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: "not json" } }] }) },
  ];

  for (const response of cases) {
    const client = createDeepSeekClient({
      apiKey: "test-key",
      fetchImpl: async () => response,
    });
    await assert.rejects(
      client.generateCandidateProfile({ instructions: "json", input: "resume", schema: {} }),
    );
  }
});
