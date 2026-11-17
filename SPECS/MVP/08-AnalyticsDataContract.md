# 08 - Candidate Analytics Storage and Contract

## 1. Purpose and Boundary

Implement the candidate-data foundation for [07](./07-DashboardAnalytics.md)
without changing the frozen [profile v1 contract](./02-CandidateProfileContract.md).
An optional, separately versioned analytics document stores facts that v1 cannot
represent. Existing profiles need no backfill and remain usable without it.

This milestone implements schema validation, private owner APIs, draft storage,
and explicit approval. It does not yet implement analytics extraction, follow-up
collection, candidate editing/review UI, public analytics responses, or the eight
remaining charts. It also does not implement company rubrics, eligibility
assessments, pipeline records, or company viewer roles. Those need separate
company ownership/access contracts; they never belong in candidate JSON.

## 2. Exact Content Contract

`Backend/src/schemas/profileAnalyticsSchema.js` defines analytics schema version
1. Every key is required, unknown scalars use `null`, missing collections use
`[]`, and additional keys are rejected at every object level. Each collection
has at most 200 entries. IDs are globally unique within a document and use
1–80 ASCII letters, digits, underscores, or hyphens. Nonempty text has at most
2,000 characters. Dates retain `YYYY` or `YYYY-MM` precision.

| Collection | Fields on each item |
| --- | --- |
| projects | id, profileProjectIndex, startDate, endDate, current, source |
| skillUsages | id, profileSkillIndex, projectIds, profileExperienceIndex, startDate, endDate, current, usage, intensity, depth, assessmentBasis, source |
| outcomes | id, projectId, description, metric, baseline, result, unit, timeframe, measurementMethod, preferredDirection, source |
| decisions | id, projectId, description, rationale, outcomeIds, source |
| artifacts | id, projectId, title, kind, url, source |
| evidence | id, claimType, claimId, artifactId, snippet, source |
| collaborations | id, projectId, collaborator, relationship, description, source |

The document additionally requires `schemaVersion: 1`.

- `profileProjectIndex` and `profileSkillIndex` are nonnegative indexes into
  the associated saved profile arrays. `profileExperienceIndex` is an index or
  null. These references are valid only at the captured profile revision.
  Project analytics entities cannot duplicate a profile project index.
- `source` is `resume`, `candidate_answer`, or `manual`. It records the declared
  origin without embedding private resume text or refinement history. This is
  provenance, not independent verification. Automatic source attribution is
  deferred until the collection workflow is implemented.
- `current` is boolean or null; true requires a null endDate. Missing dates are
  allowed. Reject definitely reversed intervals, but do not invent months to
  resolve year-only ambiguity.
- `usage` is `hands_on`, `led`, `assisted`, or null. `intensity` is `occasional`,
  `regular`, `primary`, or null. `depth` is `exposure`, `applied`, `independent`,
  `ownership`, or null. Non-null depth requires assessmentBasis text. These are
  explicitly supplied descriptive labels, not generated proficiency scores.
  A numeric scatter scale must be specified before that chart is implemented.
- `projectIds` and `outcomeIds` are unique ID arrays. Project references must
  resolve in this document. Decisions may link only outcomes in their project.
- Outcome description and metric are required text. Baseline/result are numbers
  or null. A supplied number requires a unit. Timeframe, measurementMethod,
  and unit otherwise allow null. Preferred direction is increase/decrease/null.
  Missing numeric context is retained without calculating invented changes.
- Artifacts require a title and kind (`code`, `design`, `report`, `other`).
  URLs are HTTP(S) strings or null. Do not fetch, embed, or execute their content.
- Evidence links an outcome or decision (`claimType`) to an artifact from the
  same project, with a required snippet. No verified flag or confidence score
  is accepted. Evidence is candidate-supplied support, not independently checked.
- Collaboration requires a collaborator/team label and relationship (`team`,
  `cross_functional`, `mentoring`, `other`); description is nullable. Strength,
  node weighting, and reporting hierarchy are not inferred or stored here.

Stable local entity IDs support relationships within this document. Profile
array references deliberately avoid adding IDs to frozen profile v1. Every
later profile revision requires analytics review and reference remapping, even
for edits that happen to leave array order unchanged.

## 3. Database and Revision Safety

Migration: `supabase/migrations/202611170001_profile_analytics.sql`.

| Table | Stored state |
| --- | --- |
| candidate_analytics_drafts | One private document per profile, base_profile_revision, revision, content JSONB, created_at, updated_at |
| candidate_analytics | One approved document per profile, profile_revision, source_draft_revision, content JSONB, approved_at, updated_at |

Both tables reference candidate_profiles with cascading deletion. RLS is enabled
and public/anonymous/authenticated database access is revoked; only the backend
service role may access them. Their existence never enables profile sharing.
Database constraints check JSON object/version shape and revision bounds;
the backend checks the full schema and relationships before storage/approval.

Draft writes require an already approved saved profile and the current profile
revision. Revision 0 creates a draft only if none exists. Subsequent writes
require the exact draft revision and increment it. Existing approved content
remains unchanged until an explicit approval request. Draft saves are not
automatically retried; a lost acknowledgment requires reload before resubmission.

Approval requires `approved: true`, the current draft revision, and the matching
saved profile revision. The SQL functions lock the profile before analytics
records, using the same lock as final profile saving. Writes and approval reject
stale races transactionally. Repeating approval of the same document/revisions
returns the existing saved record without changing its timestamps.

An owner may replace stale draft content using the current profile revision and
the existing draft revision after reviewing/remapping the entire document. The
backend revalidates references. There is no automatic carry-forward of analytics
when the saved profile changes. Stale approved data is retained for owner review;
it must never power public charts until reviewed and reapproved.

## 4. Private API

All routes require the existing candidate bearer-token authentication, derive
ownership from `req.user.id`, and use `Cache-Control: no-store`.

| Method/path | Request | Response |
| --- | --- | --- |
| GET /api/profile/analytics | No body | profileRevision, draft, saved |
| PUT /api/profile/analytics/draft | profileRevision, revision, content | `{ draft }` |
| POST /api/profile/analytics/approve | profileRevision, revision, approved: true | `{ saved }` |

Draft views contain revision, profileRevision, stale, content. Saved views contain
those fields plus approvedAt. Absent records return null. An absent profile is
404; unauthenticated requests are 401; invalid input is 400; stale/unapproved
profile conflicts are 409; database outages are generic 500. Storage IDs and
raw database rows are not returned. Reads have no creation side effects.

The existing shared profile response and Q&A factual sources remain unchanged.
A future public analytics endpoint must check active sharing, approval, matching
profile revision, and a dedicated nested allowlist; private source annotations
must not become public by accident. No current public route exposes these tables.

## 5. Collection and Review Follow-up

Before connecting AI or candidate UI, extend specs 03/04 to define joint review
of profile facts and analytics, source attribution, editable entity references,
skipping unsupported metrics, and revision handling. Current parsing/refinement
continues returning v1 only. New facts must not be inserted into additionalSections
as a substitute for this contract. Approval of the main profile does not approve
analytics; this milestone uses an independent explicit analytics approval.

## 6. Verification and Status

Implemented locally: migration, strict schema/relationship validator, service,
and owner-only API registration. Eighteen automated tests cover valid/invalid
documents, dates, unknown/duplicate references, cross-project evidence, unsafe
URLs, missing assessment basis and units, approval, stale records, RPC conflicts,
authentication, owner identity, and privacy headers.

Full backend suite: 97 tests pass. Two pre-existing prompt assertions were
updated to match the current equivalent no-invention/no-hiring-recommendation
wording; prompt behavior was not changed in this milestone.

The migration has not been applied to Supabase. SQL execution, approval retry
idempotency, concurrent writes/saves, deletion cascading, actual RLS privileges,
and transaction rollback still require database integration checks. Mock service
tests do not establish these database guarantees. No UI or live AI collection
is claimed by this milestone.
