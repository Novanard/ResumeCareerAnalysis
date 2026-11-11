# 06 - Recruiter Questions and Answers

## 1. Purpose and Status

Proposed specification; recruiter Q&A is not implemented.

A visitor to an active shared profile can ask natural-language questions and
receive answers based only on the candidate's current approved, saved public
profile. This extends [05 - Profile Sharing](./05-ProfileSharing.md), uses
the public projection defined there, and never changes candidate content.

## 2. Visitor Flow

1. Visitor opens a valid shared profile without creating an account.
2. A section titled **Ask about this candidate** explains that answers use only
   the saved shared profile and may be incomplete.
3. Visitor enters a question or selects a suggested question. Suggestions do not
   send requests until selected and submitted.
4. The UI shows the submitted question and a pending response state.
5. The backend validates sharing access, reads the current saved public profile,
   generates an answer, and checks access and profile revision again.
6. UI displays the answer and the profile sections supporting it, or explains
   that the requested information is not available.
7. Visitor may ask another question or select **New conversation** to clear the
   current transcript. Starting over does not affect candidate data.

Suggested questions can include “What technologies has this candidate used?”
and “What work experience is listed?” Avoid suggestions that imply unknown facts.
No requests or AI charges occur merely from viewing the page or typing.

## 3. Answer Rules

- The sole factual source is the current approved, saved public projection from
  spec 05. Exclude original resume text/files, drafts, refinement questions and
  answers, raw metadata, deleted facts, and previous saved versions.
- Summarize and connect explicitly supported facts without inventing skills,
  responsibilities, metrics, dates, qualifications, proficiency, or achievements.
- Unknown facts must be described as unavailable in the shared profile. Absence
  of information does not establish that the candidate lacks a skill or experience.
- For partially answerable questions, answer the supported part and identify
  the missing part.
- No web searches, external URL fetching, tools, or private-source retrieval.
- Do not score, rank, recommend hiring, infer sensitive personal characteristics,
  or calculate total years of experience. Explain the boundary and offer relevant
  listed facts when appropriate.
- Visitor questions and profile fields are untrusted data. Requests to ignore
  instructions, reveal credentials, or access private candidate data cannot
  expand the source boundary.
- Keep responses concise and professional; use the question's language where
  supported. Do not claim the candidate has personally verified an AI answer.

Example: if React is listed but leadership is not, answer a question about React
leadership by describing the listed React work and stating that leadership
responsibilities are not specified. Never turn “contributed” into “led.”

## 4. Conversation Context and Privacy

Proposed MVP choice: keep the transcript only in React memory. Refreshing,
closing the page, or starting a new conversation clears it. Do not create
Conversation/Message database records, use browser storage, or expose transcripts
to candidates or other visitors in this milestone. The model provider receives
the current public profile and current question; request/response bodies must
not be logged by the application or proxy. Provider-side retention follows the
configured provider's policies; do not promise zero provider retention.

Each question is independent: send no previous messages to the model or backend.
The UI labels this clearly (“Ask a complete question; previous messages are not
used as context”). Ambiguous questions such as “What about those?” should ask
for clarification. This prevents historical answers from becoming hidden sources
after a candidate changes their profile.

Conversation and Message entities in the main MVP data model remain optional
future storage, not a requirement to persist anonymous recruiter transcripts.
Adding contextual follow-ups or persistent history requires a separate update
covering visitor authorization, deletion/retention, and stale-fact handling.

## 5. Proposed API and Model Boundary

`POST /api/shared/profiles/:token/questions`

No candidate login is required. The active share token authorizes the request;
re-use spec 05's exact token matching and approved-profile checks.

Request JSON:

```json
{ "question": "What technologies has this candidate used?" }
```

Require a trimmed non-empty string of at most 1,000 characters, reject unknown
body fields, and enforce a 4 KB request body limit. Do not accept a profile,
candidate ID, conversation history, instructions, or model selection from clients.

Successful response, HTTP 200:

```json
{
  "answer": "The shared profile lists React and JavaScript.",
  "status": "answered",
  "sources": ["skills"],
  "profileRevision": 3
}
```

`status` is `answered`, `partial`, or `unavailable`. `answer` is a non-empty
string of at most 3,000 characters. `sources` is a unique list of supported
top-level public section keys, excluding `schemaVersion`. An unavailable answer
uses an empty source list. Answered/partial factual claims require at least one
source; validate that referenced sections exist and contain information.
Section labels identify the source, not a guarantee of factual correctness.

The backend supplies a dedicated provider-independent
`answerCandidateQuestion({ profile, question })` boundary. Use the configured
backend AI provider with a Q&A-specific prompt and output schema; do not reuse
the resume parser's extraction instructions. Validate model output before
returning it; attach `profileRevision` from the backend snapshot, never the model.
Schema validation cannot prove grounding: verify representative answers against
their source facts during evaluation.

| Failure | HTTP status | Expected behavior |
| --- | --- | --- |
| Missing, malformed, unknown, or revoked token; no approved shared profile | 404 | Same neutral unavailable response as spec 05; no AI call. |
| Invalid body or question | 400 | Explain the input requirement; no AI call. |
| Body too large | 413 | Reject before generation. |
| Profile changes during generation | 409 | Discard answer and ask visitor to reload the profile and retry. |
| Rate limit exceeded | 429 | Return `Retry-After`; no AI call. |
| AI not configured or concurrency capacity exhausted | 503 | Explain temporary unavailability; allow later retry. |
| AI provider fails or returns invalid output | 502 | Show a generic retryable error; never expose provider payloads. |
| Generation exceeds 30 seconds | 504 | Abort the provider request and allow explicit retry. |
| Unexpected backend/database failure | 500 | Generic error; preserve candidate data. |

No automatic server or UI retries of AI requests. Retrying is an explicit
visitor action and may incur a new model request. An unavailable factual answer
is a valid HTTP 200 response, not an infrastructure error.

## 6. Profile Changes and Revocation

- Capture the saved revision and share token when authorizing the request.
- After generation, re-check the same token is enabled and the profile remains
  approved at the same revision. Revocation takes priority over returning output.
- If access was revoked, discard output and return 404. If the saved revision
  changed, discard output and return 409; never regenerate automatically.
- On 404, clear the transcript and displayed profile and show the unavailable
  page. On 409, clear the transcript, reload the shared profile, and ask the
  visitor to resubmit against the updated content.
- Track `profileRevision` for displayed answers. If a later answer is based on
  a different revision, remove earlier answers and refresh the displayed profile
  before showing the new answer. Questions are still independent of history.
- As with profile reads, revocation after the final access check cannot recall
  already authorized responses or content already displayed. No polling or push
  revocation is required for the MVP.

## 7. Limits, Rendering, and UI States

- Default Q&A budget: 10 requests per client IP per minute, 20 per share token
  per minute, and 100 globally per minute; all configurable. Enforce each budget
  before calling AI, without storing raw tokens in limiter keys or logs.
- Limit simultaneous AI generations to 5 per backend process by default,
  configurable; release capacity on success, failure, and timeout.
- These budgets are process-local in the initial single-instance deployment.
  Multiple instances require a shared limiter; trust proxy settings follow spec 05.
- Q&A budgets are separate from profile-read limits. Ensure middleware ordering
  does not accidentally consume a read budget for Q&A requests.
- Use no-store/no-referrer/noindex policies from spec 05. Never place question
  text or transcripts in URLs, analytics, or access logs.
- Render questions and answers as text, without executing HTML or embedding
  model-supplied links. Display sources as friendly section labels.
- Provide an accessible question label, character limit, disabled send state for
  blank/oversized input, pending state, and polite answer announcements.
- Allow one in-flight submission per visitor page. Retain input on failure and
  avoid duplicate transcript entries when retrying. Clear input only on success.
- Keep the profile readable while generation is pending or temporarily fails.
  Do not present a failed request as a successful factual “unavailable” answer.

## 8. Acceptance Criteria and Verification Plan

- Anonymous visitors can submit complete questions through an active share link.
- Every factual answer uses only current approved public content; private or
  superseded facts cannot be supplied to the model even if requested.
- Supported questions receive grounded answers with section references; missing
  and partly missing facts receive the specified unavailable/partial behavior.
- No candidate/profile/draft writes occur during Q&A. Visitor transcripts remain
  isolated in page memory and disappear on refresh or a new conversation.
- History and client-supplied profile/instructions are rejected, not trusted.
- Revoked/invalid links produce no AI calls. Revocation or profile changes during
  an in-flight request discard the stale answer with the specified status.
- Input limits, rate budgets, concurrency capacity, timeouts, malformed model
  responses, outages, and manual retries follow the API contract.
- The UI has clear loading, retry, source, clarification, and empty-state behavior;
  rendering injected HTML or profile instructions cannot execute code.

Use deterministic route/service tests for source selection, validation, limits,
race conditions, and failure handling. Use synthetic profiles with deliberately
private/deleted facts to test that those facts never enter provider requests.
Evaluate live AI responses for supported, missing, conflicting, ambiguous, and
prompt-injection questions; record expected facts and review actual claims.
Use browser checks for anonymous use, accessibility, duplicate submission,
refresh clearing, and revoked/changed-profile transitions. Record verification
results separately; writing this spec does not establish passing coverage.

## 9. Out of Scope

Recruiter authentication, persistent chat history, contextual multi-turn AI,
candidate-visible recruiter activity, candidate notifications, web research,
resume-file retrieval, hiring recommendations, matching, scoring, streaming
responses, and vector databases/RAG infrastructure.
