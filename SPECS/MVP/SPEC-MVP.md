# Resume Career Analysis - MVP Specification

## 1. Goal
Build a cloud-deployed web application where a candidate can upload a resume and receive an interactive professional profile.
AI asks follow-up questions to clarify and enrich the candidate's information,
then proposes polished profile content. The candidate reviews and confirms the
result, can manually edit it, and saves an interactive professional profile.
In this MVP, polishing means improving profile content; generating a revised
PDF/DOCX resume is outside scope.
A recruiter/company can access the shared candidate profile and ask natural-language questions about the candidate.

## 2. MVP User Types

### Candidate
- Upload resume
- Generate profile from resume
- View generated profile
- Answer or skip AI follow-up questions
- Review and approve polished profile content
- Edit/correct profile information
- Share profile with recruiter/company

### Recruiter / Company
- Open shared candidate profile
- View candidate information
- Ask questions about the candidate
- Receive answers based only on the candidate's stored profile/resume information

## 3. Core MVP Flow
1. Candidate creates/logs into an account.
2. Candidate uploads a resume.
3. System extracts resume content.
4. AI converts the resume into structured profile data.
5. System saves the parsed result as a private draft.
6. AI asks relevant follow-up questions; the candidate can answer or skip them.
7. AI proposes clearer wording and a polished profile using supported facts.
8. Candidate reviews the proposal, requests revisions or edits it, and confirms it.
9. Candidate can make further manual edits and explicitly save the interactive profile.
10. Candidate separately enables a shareable profile link.
11. Recruiter opens the saved shared profile and asks questions.
12. AI answers using only the approved, saved profile information.

Draft work is persisted privately so the candidate can resume after refresh or
login. Saving a draft is distinct from confirming a proposal, saving the final
profile, and enabling sharing. Skipping questions or declining AI wording must
not prevent the candidate from reviewing and saving a factual profile.

## 4. Core Features
### Authentication
- Candidate can register and log in.
- Candidate profiles belong to authenticated users.
### Resume Upload
- Candidate can upload a supported resume file.
- Original resume is stored securely.
### Resume Parsing
- Resume text is extracted.
- AI identifies relevant sections dynamically.
- The system must not assume every resume has identical sections.

Examples may include:
- Education
- Work experience
- Skills
- Projects
- Military service
- Certifications
- Volunteering
- Awards
### Follow-up Questions and Profile Polishing
- Questions address meaningful gaps, unclear facts, and missing project or work details.
- Candidates can answer, correct previous answers, skip, and finish questioning.
- AI improves wording using resume facts and candidate-provided information.
- AI must not invent achievements, metrics, skills, qualifications, or employment facts.
- Generated headlines and summaries are allowed here, subject to candidate approval.
- Proposed changes remain private until reviewed and explicitly saved.
- See [03 - Profile Refinement](./03-ProfileRefinement.md).
### Interactive Candidate Profile
- Generated information is displayed as a structured profile.
- Profile sections can vary between candidates.
- Candidate can edit incorrect or missing information.
- Candidate edits become the authoritative profile information.
- Confirmation, manual editing, saving, and draft recovery follow
  [04 - Profile Review and Saving](./04-ProfileReviewAndSaving.md).

### Profile Sharing
- Candidate can generate/use a shareable profile URL.
- Recruiter does not need access to candidate editing functionality.
- Sharing is opt-in and revocable. Only the saved profile is exposed; drafts,
  follow-up answers, original files, and extracted text remain private.

### Recruiter Q&A
- Recruiter can ask natural-language questions.
- Answers must be based only on the current approved, saved shared profile.
- Private resume text, refinement conversations, and superseded facts must not
  be used to reintroduce information the candidate removed or corrected.
- The system should avoid inventing information not present in the candidate data.
## 5. Out of Scope for MVP
The MVP will NOT include:
- Job listings
- Candidate job search
- Job applications
- Automatic candidate-job matching
- Recruiter candidate search
- Recommendation algorithms connecting candidates and companies
- Full recruitment marketplace
- Revised PDF/DOCX resume generation or export
- Resume scoring and job-specific resume tailoring

These may be part of the future/ambitious version.
## 6. Deployment Requirement
The application must be deployed to cloud infrastructure.

The final system must be accessible through a public URL and must not depend on localhost or the developer's computer being active.

## 7. Initial Technical Direction
Frontend:
- React + TypeScript

Backend:
- Node.js + Express

Database:
- PostgreSQL

Flexible candidate-specific profile information:
- PostgreSQL JSONB

Deployment:
- Cloud hosted frontend/backend/database
## 8. Initial Data Model
### User
- id
- email
- password/authentication information
- created_at

### CandidateProfile
- id
- user_id
- full_name
- headline
- summary
- profile_data (JSONB)
- created_at
- updated_at

### Private Profile Draft / Refinement Session
- candidate profile and source resume references
- base saved-profile revision (when one exists)
- parsed baseline and current draft in the v1 profile shape
- persisted questions, answers, skipped questions, and proposed changes
- workflow state, revision, and confirmation reference
- created_at and updated_at

Draft state and refinement history are separate from public profile content.
The candidate profile retains the last explicitly saved version while a new
draft is being worked on. Resume processing status describes parsing only;
it must not be reused as the refinement or approval state.

### Resume
- id
- candidate_profile_id
- file reference
- extracted_text
- uploaded_at

### Conversation
- id
- candidate_profile_id
- created_at

### Message
- id
- conversation_id
- role
- content
- created_at

Conversation and Message above refer to recruiter Q&A. Candidate refinement
history is private and must be distinguishable from recruiter conversations.
The exact database schema may change as individual feature specifications are developed.
## 9. MVP Completion Criteria

The MVP is considered functional when:
- A candidate can upload a resume.
- A candidate profile is automatically generated.
- Different resume structures can be represented.
- AI asks relevant follow-up questions and supports skipping them.
- AI proposes polished content grounded in the resume and candidate answers.
- Candidate reviews and confirms the exact proposed result before final saving.
- Candidate can edit generated information.
- Profile changes persist.
- Private draft work can be resumed without changing the last saved profile.
- AI failures, retries, and re-uploads do not silently overwrite saved edits.
- Candidate profile can be accessed through a shared link.
- Recruiter can ask questions about the candidate.
- Answers are grounded in the candidate's stored information.
- Application is deployed and accessible online.

## 10. Specification Map and Implementation Boundary

| Specification | Responsibility |
| --- | --- |
| [01 - Resume Parsing](./01-ResumeParsing.md) | Secure upload, extraction, factual parsing, and parsing failures/retries. |
| [02 - Candidate Profile Contract](./02-CandidateProfileContract.md) | Shared v1 content shape, validation, and database mapping. |
| [03 - Profile Refinement](./03-ProfileRefinement.md) | Private follow-up questions, candidate answers, and proposed polishing. |
| [04 - Profile Review and Saving](./04-ProfileReviewAndSaving.md) | Review, confirmation, manual editing, persistence, and revision safety. |
| [05 - Profile Sharing](./05-ProfileSharing.md) | Opt-in/revocable links, read-only public projection, sharing API/UI, and access checks. |

These documents describe target behavior, not a claim that every feature is
implemented. The current baseline includes login, upload, parsing, and viewing
a private parsed draft. Parsing now persists separate drafts with a parsed
baseline and revision metadata, preserving previously stored profiles.
Follow-up questions, AI polishing, review, manual editing, and explicit final
saving are implemented. Sharing is implemented locally, with its database
migration and live/browser verification pending under spec 05. Recruiter Q&A
and public deployment remain subsequent work. The live API smoke check in
`Backend/scripts/verify-live-workflow.js` passed against Supabase and AI on
2026-11-11, including the actual database final-save function. Coverage and
remaining checks are recorded in specs 01, 03, and 04. Browser end-to-end
verification and broader concurrency/security verification remain outstanding.
The approved sharing API/UI specification and verification boundaries are
recorded in spec 05. A detailed recruiter Q&A specification must still be
written before implementing Q&A.
