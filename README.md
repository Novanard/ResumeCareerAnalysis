# Resume Career Analysis

## Local setup

Requirements: Node.js 24+, npm, and a Supabase project.

1. In Supabase, create a project and open **Project Settings > API**.
2. Copy `client/.env.example` to `client/.env` and fill in the project URL and
   anon/publishable key.
3. Copy `backend/.env.example` to `backend/.env` and fill in the same project
   URL and the service-role/secret key. Never expose this key to the client.
4. In the Supabase SQL editor, run the files under `supabase/migrations` in
   filename order.
5. Under **Authentication > URL Configuration**, set the site URL to
   `http://localhost:5173` and add it as an allowed redirect URL.
6. Install and run both applications:

   ```powershell
   cd backend
   npm ci
   npm run dev
   ```

   In a second terminal:

   ```powershell
   cd client
   npm ci
   npm run dev
   ```

Email magic-link authentication works once Supabase email authentication is
enabled. The Google button additionally requires its provider to be configured
under **Authentication > Providers**.

The frontend runs at `http://localhost:5173` and the API at
`http://localhost:3001` by default.

## Private parsed drafts

Apply `supabase/migrations/202611100001_create_profile_drafts.sql` before
running the updated upload flow. Parsing now creates a private draft instead
of updating `candidate_profiles`. The frontend preview loads the latest draft
through authenticated `GET /api/profile/draft`. Existing profile rows remain
unchanged and are not automatically approved or shared. Existing resumes can
be parsed again through `POST /api/resumes/:resumeId/parse` to create drafts.

Each resume has one draft. Retrying preserves its existing content, and another
upload creates a separate draft rather than deleting prior work. Draft revision,
base profile revision, and parsed baseline are stored for the upcoming refinement
and approval workflow. Follow-up questions, polishing, review, manual editing, and final saving are
implemented as described below. The legacy `GET /api/profile` still reads existing profile data;
it does not imply approval or public access.

## Candidate follow-up questions

After the draft migration, apply
`supabase/migrations/202611100002_draft_followup_questions.sql` in the Supabase
SQL editor. Restart the backend and open **View private draft**. Select
**Generate follow-up questions**, then answer or skip each question. Answers
are saved only when **Save answer** succeeds. Completed answers can be revised;
**Finish questions for now** pauses the workflow, and **Resume questions** reopens
it. Refresh restores acknowledged progress. Unsaved textarea text is local only.

The backend generates at most five questions in one batch and persists them so
refreshing or retrying does not regenerate already saved questions. Question answering itself
does not change profile content. The original draft content and saved profile remain
unchanged by answers. All refinement operations are authenticated, owner-scoped,
and use draft revisions to reject concurrent changes. After a conflict, reload
the page before continuing.

Endpoints (JSON bodies include the current `revision`):
- `POST /api/profile/drafts/:draftId/questions` generates the question batch.
- `POST /api/profile/drafts/:draftId/questions/:questionId` accepts
  `status: "answered"` with `answer`, or `status: "skipped"`.
- `POST /api/profile/drafts/:draftId/finish` accepts `finished: true` or `false`.

## Polishing, review, editing, and final saving

Apply `supabase/migrations/202611100003_profile_review_and_save.sql` after the
first two draft migrations, then restart the backend and refresh the frontend.
No new environment settings are required.

After **Finish questions for now**, select **Generate polished profile** or
**Review and edit without polishing**. The review screen displays all candidate
fields and shows before/after comparisons for changed sections. Add, change, or
remove entries, then select **Save draft edits**. This persists private work;
it does not replace the saved final profile.

Select **Approve and save final profile** to approve the exact current draft
revision and atomically persist the final profile. **Edit saved profile** opens
a new private editing revision based on the current saved profile. It reuses the
private draft record, preserves the original parsed baseline, and leaves saved
content intact until another explicit final save. Complete draft version history
is not implemented. Saving never enables public sharing.

AI failures leave existing work intact. Changed drafts or saved-profile revision
conflicts are rejected. Final-save retries are idempotent. Existing profile rows
are not marked approved by the migration. A newly approved profile gets an
`approved_at` timestamp. The new database function must be exercised against the
actual Supabase project; local service tests do not execute PostgreSQL.

Review endpoints use `POST /api/profile/drafts/:draftId/:action` with the current
`revision`: `polish`, `review`, `edit` (plus complete `content`), `reject`,
`save` (plus `approved: true`), and `reopen`. Existing finish/resume actions
allow returning from review to questions.
