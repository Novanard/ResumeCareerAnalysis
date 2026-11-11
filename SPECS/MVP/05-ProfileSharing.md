# 05 - Profile Sharing

## 1. Purpose and Status

Proposed specification; sharing is not implemented yet.

Let a candidate explicitly share their approved, saved professional profile
with a recruiter through a read-only URL. This follows
[04 - Profile Review and Saving](./04-ProfileReviewAndSaving.md).
Recruiter Q&A requires a separate specification and is outside this milestone.

## 2. Candidate Flow

1. Candidate approves and saves a final profile under spec 04.
2. The profile area shows sharing as disabled by default.
3. Candidate selects **Enable sharing** after seeing the disclosure below.
4. Backend creates an unguessable link and persists sharing as enabled.
5. Candidate can copy the link, open the visitor view, or disable sharing.
6. Disabling sharing invalidates that link. Enabling again creates a new link;
   previously revoked links never become valid again.

The disclosure must explain:

- Anyone with the link can view and forward it without logging in.
- The link includes all saved profile sections and saved contact details.
- Later approved final saves update the profile available through this link.
- Private draft edits remain private until approved and saved.
- Disabling sharing prevents future access through the app; it cannot remove
  copies or screenshots already obtained by a visitor.

Before the first final save, show **Save your profile before enabling sharing**.
Parsing, polishing, review, final saving, and reopening a draft never enable
sharing automatically. Existing profiles without an approval timestamp are not
eligible until explicitly approved and saved.

## 3. Visitor Flow

- Open `/shared/:token` without candidate authentication.
- Load the current approved, saved profile and render its populated sections.
- Show a neutral unavailable page for missing, malformed, revoked, or unknown
  links, or when there is no valid approved profile behind the link.
- Show a retryable error for service outages rather than describing a temporary
  failure as a revoked link.
- Provide no editing, approval, draft, resume-download, or candidate account controls.
- Refresh loads the latest saved version. Live push updates are outside scope.
- Direct navigation and browser refresh must work on the deployed frontend;
  hosting must serve the application entry point for this route.

The shared route is resolved before the candidate login gate in `App.tsx`.
An existing candidate login does not grant editing controls in the visitor view.

## 4. Shared Content Contract

Build a dedicated allowlisted public projection from the saved profile mapping
in spec 02. The public response contains `{ profile: ... }` with:

`schemaVersion`, `fullName`, `headline`, `summary`, `contact`, `skills`,
`experience`, `education`, `projects`, `languages`, `certifications`, and
`additionalSections`.

These fields retain spec 02's types, nulls, arrays, and nested field shapes.
The public type omits `rawMetadata`; it is a projection rather than a change
to the stored v1 contract. Allowlist nested keys as well as top-level keys.

Never return database row objects directly. Exclude user/profile/resume/draft
IDs, approval and revision metadata, storage paths, original files, extracted
text, parsed baselines, questions, answers, proposals, and parsing warnings.
No fallback to private resume text or drafts is allowed.

All saved contact fields are included in this MVP. Field-by-field visibility
controls are outside scope; the candidate can edit/remove details through the
private review-and-save flow before sharing.

Render supplied text as text, without executing HTML. Only safe `http:` and
`https:` values become external web links, with safe new-tab attributes where
used. Do not embed or automatically fetch candidate-supplied URLs.

## 5. Ownership, Tokens, and Storage

- Sharing management requires the existing bearer-token authentication.
- Derive ownership from `req.user.id`; never accept an owner ID from the browser.
- Keep sharing state outside profile JSON in a `candidate_profile_shares` table.
- One row per candidate profile; `candidate_profile_id` is unique and references
  the profile with cascading deletion. Store `token`, `enabled`, `created_at`,
  `updated_at`, and nullable `revoked_at` separately.
- Generate tokens using a cryptographic random generator with at least 32 random
  bytes, encoded as URL-safe text, and enforce token uniqueness in the database.
  Do not derive tokens from emails or sequential identifiers.
- Proposed MVP storage keeps the token retrievable by the backend so the owner
  can recover and copy the active link after login. Enable RLS and deny direct
  anonymous/authenticated table access; only the backend service role accesses
  this table. Tokens act as access credentials and must not appear in logs or
  analytics. Do not log complete shared-request paths.
- Public reads require an exact active token match and a saved profile with
  non-null `approved_at`. Check these conditions on every request through the
  backend; the browser never reads this table directly.
- State changes must serialize per profile. Concurrent enable requests return
  one active link; retries while enabled preserve that link. Repeated disable
  requests succeed without changing saved content. A later enable after disable
  always replaces the revoked token atomically.
- Revocation governs requests authorized after its transaction commits. An
  already authorized in-flight response or already displayed page may retain
  content; subsequent requests must be denied.

## 6. Proposed API

| Endpoint | Authentication | Behavior |
| --- | --- | --- |
| `GET /api/profile/sharing` | Candidate bearer token | Return owned sharing status and active URL. |
| `POST /api/profile/sharing/enable` | Candidate bearer token | Require an approved saved profile; atomically enable or return the existing active link. |
| `POST /api/profile/sharing/disable` | Candidate bearer token | Revoke the active link; succeed if already disabled or absent. |
| `GET /api/shared/profiles/:token` | Share token in path | Return only the current public profile projection. |

Management responses use `{ sharing: { enabled: boolean, url: string | null } }`.
Return a URL only while enabled. Successful reads and actions return HTTP 200.
No profile or share row is created by a status read; no saved profile means
disabled status. Enable requires no request body and returns HTTP 409 with a
clear instruction when an approved saved profile is unavailable.

Generate URLs from a configured, validated frontend origin, never from an
untrusted request Host header. Use HTTPS in production; localhost HTTP is allowed
for development. Report missing URL configuration as a server error without
enabling sharing or showing a successful link.

Management requests without valid authentication return HTTP 401. Unavailable
public links return HTTP 404 with `{ error: "Shared profile unavailable" }`.
Unexpected backend failures return a generic HTTP 500 and preserve existing state.
Management routes do not accept arbitrary profile IDs or draft content.

## 7. Privacy and Operational Behavior

- Public and management responses use `Cache-Control: no-store`; no CDN or
  service-worker caching of shared profile responses.
- Visitor pages use `Referrer-Policy: no-referrer` and request no search indexing
  through `noindex, nofollow` directives. These directives do not authorize access;
  the share token remains the access check.
- Apply a configurable per-client public endpoint rate limit. Return HTTP 429
  with `Retry-After` when exceeded. Configure trusted proxies explicitly so
  arbitrary forwarded headers cannot bypass the limit.
- Loading, copy, enable, disable, and fetch failures have clear UI states. Show
  enable/disable success only after backend acknowledgment; prevent duplicate
  in-flight actions. Clipboard failure offers a selectable URL for manual copy.
- A failed revocation must leave the UI showing sharing as enabled with a retry
  action; do not claim access has been revoked until acknowledged.

## 8. Acceptance Criteria and Verification Plan

- A new or legacy unapproved profile cannot be shared; direct enable requests
  are rejected even if frontend controls are bypassed.
- An authenticated owner can enable sharing, recover the active URL after
  refresh/login, and copy or open it.
- Concurrent/retried enables produce one stable active URL.
- A visitor without a login can open and refresh the link and see saved content.
- Persisted private draft edits remain invisible; a subsequent approved final
  save becomes visible on the next visitor fetch without changing the active URL.
- Public JSON contains only allowlisted public fields, including nested fields;
  seeded private/internal metadata never leaks.
- One candidate cannot manage another candidate's sharing state.
- Disabled/unknown/malformed links have the same unavailable response. Disable
  retries succeed; re-enabling produces a new URL and the old URL stays invalid.
- Requests after acknowledged revocation fail even if the URL was previously used.
- Public pages provide no editing access and safely render untrusted profile text.
- No-store, no-referrer, indexing directives, rate limiting, and retryable errors
  behave as specified, including behind the production proxy configuration.
- Account/profile deletion removes its sharing record and invalidates its URL.

Use backend route/service tests for access checks, projection, errors, and limits;
real database integration checks for state transitions and concurrent operations;
and browser checks for direct navigation, anonymous viewing, copying, disclosure,
and error states. Use temporary synthetic accounts and clean up test artifacts.
Record actual verification results separately from these target requirements.

## 9. Out of Scope

Recruiter Q&A, recruiter accounts, search/discovery, per-recipient permissions,
password-protected links, expiration dates, access analytics, multiple simultaneous
links, field-level visibility, resume downloads, and social preview generation.
This milestone introduces no automatic public sharing and no public profile list.
