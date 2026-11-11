# 03 - Follow-up Questions and Profile Polishing

## 1. Purpose and Boundary

Turn a parsed resume draft into a clearer, more complete interactive profile
through candidate answers and AI wording suggestions. This stage follows
[01](./01-ResumeParsing.md), uses the content shape in
[02](./02-CandidateProfileContract.md), and hands its proposal to
[04](./04-ProfileReviewAndSaving.md) for review and saving.

Polishing improves profile content. Revised resume file generation, scoring,
career recommendations, and job-specific tailoring are outside this MVP.

## 2. Candidate Flow

1. Load the candidate's private parsed draft and show what was extracted.
2. Offer relevant follow-up questions, one at a time, with the affected section
   and a short explanation of why the answer would help.
3. Candidate answers, corrects an answer, skips a question, or finishes questioning.
4. Persist acknowledged answers and skipped questions so work survives refresh.
5. When the candidate chooses to continue, generate a polished proposal using
   the current draft and supplied answers. Questions are optional.
6. Show the proposed result and meaningful changes for review under spec 04.
7. Allow another refinement round if requested; do not require endless questions.

If no useful questions exist, proceed directly to proposing content. If the
candidate declines AI polishing, allow review and saving of the factual draft.

## 3. Question Rules

- Ask about meaningful ambiguities or missing details: personal contribution,
  project purpose, responsibilities, technologies used, or unclear dates.
- Prioritize parsing warnings and information that improves existing sections.
- Do not ask for every empty field or invent experience for absent sections.
- Avoid repeating answered or skipped questions unless the candidate reopens
  them or new conflicting information requires clarification.
- Do not request unnecessary sensitive personal information or credentials.
- Do not infer that skipping means a fact is false; leave unknown facts unknown.
- New candidate corrections take precedence over old resume facts. If a conflict
  cannot be resolved clearly, ask or leave the proposed change unresolved.

Example: for a project saying only "Built a React app," ask what the app did
and which parts the candidate built. Do not suggest unsupported user counts,
revenue improvements, leadership, or performance metrics as established facts.

## 4. Polishing Rules

- Improve clarity, grammar, organization, and descriptions without changing facts.
- Incorporate explicitly supplied candidate facts, including facts absent from
  the original resume. Preserve manual corrections and deletions.
- Propose a headline or professional summary when useful, grounded in available
  facts. The parser's extract-only summary rule does not apply to this stage.
- Do not fabricate skills, qualifications, achievements, dates, metrics, or roles.
- Do not turn "helped implement" into "led" without supporting information.
- Do not infer skill proficiency, compute experience totals, or assign scores.
- Return valid v1 content; validate AI output on the backend before storing it.
- Store the proposal separately from the saved profile, with its draft revision
  and the source answers used. Resume files and answers are data, not executable
  instructions capable of overriding these rules or ownership checks.

## 5. Persistence, Access, and Failure Handling

Persist the owned draft, source resume reference, parsed baseline, question IDs,
question text, answer/skip state, proposed content, and revisions. Keep this
history private and separate from recruiter conversations and the v1 JSON.

Only the authenticated owner can read or modify refinement work. The backend
checks ownership for every operation; AI credentials stay on the backend.

If question or proposal generation fails, retain all acknowledged work, show a
clear retry action, and allow manual review/editing of the existing valid draft.
Invalid AI output does not replace a valid draft or saved profile. Apply an AI
response only if its source draft revision still matches; otherwise discard the
stale result and offer regeneration. Retries must not duplicate persisted answers.

## 6. Acceptance Criteria

- Questions reflect the actual candidate draft and avoid unsupported assumptions.
- Answering, correcting, skipping, and ending questions are supported.
- Refresh/login restores acknowledged refinement work.
- Candidate answers can enrich the proposal without changing the saved profile.
- Generated summaries and rewrites contain only supported claims.
- Manual corrections/deletions survive subsequent AI rounds unless the candidate
  explicitly accepts a proposed replacement.
- AI failures and stale responses preserve existing valid work.
- Another candidate and a recruiter cannot access private refinement history.
- The candidate can reach final review without answering questions or accepting
  AI polishing.

## 7. Current Implementation Boundary

The question stage is implemented: one persisted batch of up to five questions,
answer/skip/revise controls, finish/resume, owner-only access, and optimistic
revision checks. Existing drafts receive empty question history when migration
202611100002 is applied. Questions are generated explicitly by the candidate.
AI polishing and repeated proposal generation are implemented, with full v1
validation and revision checks before storing results. Review and editing are
implemented under specification 04. Question answers alone do not change profile
content; the candidate explicitly generates a proposal. Only newly supplied or
changed answers are reapplied in later polishing rounds so unchanged historical
answers do not restore manually deleted facts. Questions remain one batch per
import; candidates can return to revise its answers. Automatic generation of
additional question batches is not implemented.

## 8. Verification Coverage

Run `node scripts/verify-live-workflow.js` from `Backend` with live Supabase
and AI configured. The synthetic candidate flow must:

- Explicitly generate and persist questions from the parsed draft.
- When questions exist, save an answer to the first question and skip remaining
  questions; persist the answer/skip states and the finish action.
- Reload the draft through the API and recover the exact acknowledged progress.
- Generate a valid polished proposal with the live AI provider and proceed to
  review under spec 04 without creating a saved final profile.

The AI may validly return no questions; in that case this run does not exercise
answer/skip behavior. Deterministic service tests cover those operations as well
as answer corrections, failures, stale responses, and preservation of manual
deletions. A successful live response verifies integration and schema validation;
factual quality and question relevance still require review against the synthetic
source and candidate answers. Browser interaction requires separate verification.
