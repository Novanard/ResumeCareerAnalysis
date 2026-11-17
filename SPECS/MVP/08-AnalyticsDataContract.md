# 08 - Automatically Derived Profile Analytics

## 1. Source of Truth and Approval

The current approved, saved profile is the sole factual source for candidate
analytics. The candidate approves that profile once under spec 04. Analytics
are a read-only projection: no separate candidate facts, analytics editor,
analytics questions, private notes, draft, approval, or publishing action.
Corrections go through editing and saving the main profile. New saved profile
revisions automatically invalidate old analytics and trigger fresh extraction.

This supersedes the former analytics draft/approval design and its mutation API.
Keep the frozen profile v1 shape unchanged. Private resumes, refinement answers,
raw metadata, removed facts, and historical profiles are not extraction sources.
Company requirements and pipelines are separate data, not derivable candidate facts.

## 2. Versioned Derived Content

`Backend/src/schemas/profileAnalyticsSchema.js` defines analytics schemaVersion 1.
Every specified key is required; unknown scalars use null, absent collections use
[], and extra fields are rejected. Arrays allow at most 200 entries. IDs are
globally unique local references (1–80 letters, digits, underscores or hyphens).
Text is nonempty, at most 2,000 characters. Dates preserve YYYY or YYYY-MM precision.

| Collection | Fields on every item |
| --- | --- |
| projects | id, profileProjectIndex, startDate, endDate, current, source |
| skillUsages | id, profileSkillIndex, projectIds, profileExperienceIndex, startDate, endDate, current, usage, intensity, depth, assessmentBasis, source |
| outcomes | id, projectId, description, metric, baseline, result, unit, timeframe, measurementMethod, preferredDirection, source |
| decisions | id, projectId, description, rationale, outcomeIds, source |
| artifacts | id, projectId, title, kind, url, source |
| evidence | id, claimType, claimId, artifactId, snippet, source |
| collaborations | id, projectId, collaborator, relationship, description, source |

- Source is assigned by the backend as `profile`. Historical source enum values
  remain accepted by the validator for storage compatibility, but no manual or
  historical analytics document is used as an automatic extraction cache.
- Profile indexes are nonnegative indexes into the saved profile at exactly the
  cache's profile_revision. Employment index may be null. A profile project has
  at most one analytics entity. All local references must resolve.
- Dates/current may be null; ongoing entries require a null endDate. Reject
  definitely reversed ranges without inventing months for year-only dates.
- Skill usage is hands_on/led/assisted/null; intensity is occasional/regular/
  primary/null; depth is exposure/applied/independent/ownership/null. These must
  be explicit saved facts. Non-null depth requires an explicit assessmentBasis.
  Never infer skill periods from employment dates, depth from technologies, or
  leadership from job titles. Unknown dates/intensity/depth remain unknown.
- Outcomes require metric and description; baseline/result are numbers or null.
  Any number requires a unit. Timeframe and measurementMethod are nullable.
  Preferred direction is increase/decrease/null. Do not invent baselines from
  a percentage-only claim or aggregate incompatible metrics.
- Decisions have description, nullable rationale, and outcome references in the
  same project. Artifacts have title, kind (code/design/report/other), and a
  supplied HTTP(S) URL or null. Do not fetch or embed artifact URLs.
- Evidence links an outcome/decision to an artifact in the same project, with a
  verbatim supporting snippet from the profile. A link alone is not verification.
  No verified flags or confidence scores are accepted.
- Collaboration uses an explicit collaborator/team label and relationship
  (team/cross_functional/mentoring/other), with nullable description. Do not infer
  reporting lines, relationship strength, or unmentioned collaborators.

## 3. Automatic Extraction and Cache

After a successful final profile save, backend extraction starts automatically
without delaying or invalidating the successful save. Owner/shared analytics
reads also generate a missing/stale cache, covering previously saved profiles
and recovery after an interrupted process. An exact current cache is reused.

Configured AI receives only the current saved profile and the extraction schema.
All profile text is untrusted data, not executable instructions. Output must pass
schema and relationship validation before caching. Provider timeout is 60 seconds.
If AI is unconfigured, deterministic extraction provides explicit project/technology
links and supplied project URLs without inventing dates, depth, outcomes, or teams.
A baseline cache is regenerated if a model becomes available.

Within one backend process, concurrent reads of the same profile/revision share
one extraction. At most four extractions run concurrently; failures have a
60-second per-key cooldown. No automatic retries incur repeated provider calls.
These are per-process controls; multiple backend instances need shared deduplication
and generation budgets. Analytics may incur an automatic AI call on a cache miss
when viewing a saved/shared profile, unlike explicitly submitted recruiter Q&A.

The existing candidate_analytics table becomes a derived cache through migration
`202611170002_automatic_profile_analytics.sql` after the original migration 001:

- candidate_profile_id, profile_revision, content remain;
- extraction_version, extraction_method (model/baseline), generated_at are added;
- source_draft_revision and approved_at become nullable legacy columns and are
  null for newly derived rows;
- only matching profile_revision, extraction_version, and extraction_method may
  be reused. Legacy manually approved rows have no extraction version and are ignored.

The service-role-only store_derived_candidate_analytics RPC locks the saved
profile, requires its approval and exact revision, then atomically stores the
derived cache. A changed/deleted profile rejects the stale write with conflict.
Equivalent duplicate writes return the existing cache. The cache is disposable;
it is not an independent candidate authority.

RLS/service-role isolation and cascading deletion remain. Old analytics draft
rows are retained privately for non-destructive migration compatibility; no app
reads or promotes them. Migration 002 revokes service-role execution of the old
draft-write and analytics-approval functions. There is no backfill approval.

## 4. Read-only API and Sharing

| Endpoint | Access | Response |
| --- | --- | --- |
| GET /api/profile/analytics | Candidate authentication; own saved profile only | profileRevision, analytics |
| GET /api/shared/profiles/:token/analytics | Active share token; current saved profile only | profileRevision, analytics |

Analytics contains content, generatedAt, extractionVersion, method. The public
projection allowlists nested schema keys and removes source annotations. It
exposes no storage/profile/user IDs, drafts, private history, or approval metadata.
Former PUT draft and POST generate/approve endpoints are absent (404).

Owner reads verify ownership and profile revision again before returning.
Shared reads recheck sharing and profile revision after extraction, including
cache hits. Revocation returns neutral 404; concurrent profile changes return
409. Invalid model output/provider errors return retryable errors, not invented
or stale values. Missing migration returns a setup-specific 503. The UI keeps the
basic profile readable while analytics load or fail and offers retry separately.

Both routes use no-store. Public reads inherit no-referrer/noindex and the shared
read rate limiter. There is no public company pipeline lookup through a share
token. Profile response and Q&A grounding remain unchanged: Q&A does not gain an
implicit additional source from the analytics cache.

## 5. UI and Verification Status

Saved-profile and shared-profile dashboards show read-only derived charts. The
candidate workspace explains that changes belong in the profile editor and no
additional approval is required. Unsupported charts identify absent profile facts;
they do not ask candidates to author or approve analytics.

Implementation includes automatic extraction/cache service, post-save background
trigger, read-only endpoints, shared access/revision checks, candidate chart
renderers, and owner/shared read-only UI. Specs 03/04/05/07 and the overall spec
follow this single-approval boundary.

Verification: all 100 backend tests, all 15 Playwright browser tests, frontend
production build, and lint pass. Tests cover automatic extraction, current-only
cache reuse, invalidation, single-flight requests, failure cooldown, post-save
trigger, absent mutation endpoints, public projections, access/revision rechecks,
populated charts, and owner/shared read-only interfaces.

The user reported applying migration 001. Migration 002 is newly prepared and
has not been applied by the agent. Live Supabase/AI extraction, RPC execution,
concurrent database writes, RLS privileges, cascading deletion, and transaction
rollback remain integration checks. Automated tests use mocked providers/storage;
they do not prove those database or factual-extraction guarantees.
