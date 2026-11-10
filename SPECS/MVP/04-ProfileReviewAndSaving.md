# 04 - Profile Review, Confirmation, Manual Editing, and Saving

## 1. Purpose

Let the candidate control the exact profile that becomes authoritative. This
specification covers private draft review through final saving, plus later
manual editing. It follows [03](./03-ProfileRefinement.md) and uses the content
contract in [02](./02-CandidateProfileContract.md).

## 2. Review and Confirmation

- Display the complete proposed profile with changed or added content clearly
  identified relative to the draft before polishing. Keep that baseline available.
- Candidate can accept the proposed result, edit it, reject AI changes and return
  to the prior draft, or request another refinement round.
- Provide section-level manual editing during review. Candidate can add, change,
  or remove entries in named collections and additional sections, as well as
  edit name, contact information, headline, and summary.
- Confirming means approving the exact currently displayed draft revision.
- Confirmation does not enable sharing. The candidate next explicitly saves
  the final profile; confirmation and saving may be consecutive UI actions.
- Further content changes invalidate the earlier confirmation. The final Save
  action must clearly approve and save the current edited version; it must not
  silently rely on approval of an older proposal.
- Skipping AI refinement leads to the same review and approval requirements.

## 3. Workflow and Storage

Conceptual draft states are `refining`, `review`, `confirmed`, and `saved`.
Question/proposal requests have their own loading/error state. These are separate
from resume processing states such as `parsed` and `parsing_failed`.

| Action | Result |
| --- | --- |
| Successful initial parse | Create a private draft; enter refining. |
| Generate proposal or skip refinement | Enter review with valid draft content. |
| Confirm current content | Enter confirmed with the approved draft revision. |
| Change confirmed content | Return to review; clear prior confirmation. |
| Explicitly approve and save current content | Validate and atomically update the saved profile; mark draft saved. |
| Edit a saved profile or upload another resume | Open a private editing revision (or a separate draft for a new upload) based on the saved revision; preserve the saved profile. |

Persist private draft work separately from the last saved profile. Track draft
revision, base saved-profile revision, and the revision approved by the candidate.
For a first-time candidate, there is no shareable profile until final saving.
Existing stored profiles must not automatically be treated as approved or made
public when this workflow is introduced; owners must review and save them.

Acknowledged draft updates survive refresh and login. Clearly distinguish a
persisted private draft from a saved final profile. Warn before leaving with
unacknowledged local changes; do not show a successful save until the backend
acknowledges it.

## 4. Final Save and Later Edits

- Require authenticated ownership and backend validation of the entire v1 shape.
- Save name, headline, summary, and JSONB content together, using spec 02's mapping.
- Save atomically; a failure must not leave a partly updated authoritative profile.
- Require matching draft and base saved-profile revisions. Reject stale writes
  from another tab or AI response and offer reload/review rather than overwriting.
- Repeating a successful save request must not create duplicate profile records
  or apply an older draft over a newer saved version.
- After saving, render the persisted profile and show a clear success state.
- Later manual edits use a private draft and explicit Save. An explicit Save
  approves those edits; another AI polishing round is optional.
- Re-parsing or re-uploading never silently replaces approved content or edits.

## 5. Sharing and Recruiter Boundary

Sharing is a separate, opt-in, revocable action. A shared link displays the
current saved profile, including subsequently saved edits. Explain that saving
changes updates an already shared profile. Private draft edits remain invisible.

Recruiter Q&A uses only the current saved shared content. Original resume text,
private answers, drafts, internal metadata, and deleted/superseded facts must
not be exposed or used as hidden sources. Recruiters cannot edit or approve.
Detailed share-link authorization, revocation, and Q&A behavior require their
own specifications before that work begins.

## 6. Acceptance Criteria

- Candidate sees the complete proposal and can understand what AI changed.
- Candidate can reject polishing or manually add, edit, and delete profile content.
- Approval refers to the current revision; changing it requires renewed approval
  through confirmation or an explicit approve-and-save action.
- Draft persistence does not alter the last saved or shared profile.
- Final saving persists all fields together and survives refresh/login.
- Failed or stale saves preserve both the last saved profile and recoverable draft.
- Concurrent edits, re-uploads, and delayed AI responses cannot silently overwrite
  candidate work.
- Sharing is never enabled automatically by parsing, confirmation, or saving.
- Other users cannot read drafts or modify the candidate's profile.

## 7. Current Implementation

Review includes editable fields for all candidate sections, adding/removing
entries, before/after section comparisons, rejecting AI changes, returning to
questions, and optional repeated polishing. Saving draft edits persists private
work. The explicit **Approve and save final profile** action combines final
confirmation and saving for the exact current revision. There is no separate
confirmation button. Changes require another explicit approval when saved.

The final database function checks ownership and both draft/saved-profile
revisions, and writes profile fields, approval timestamp, and draft saved state
in one transaction. Later editing reopens the existing private draft record at
a new revision based on current saved content; it does not change the saved
profile until final saving. Original parsed baseline remains available in storage;
complete version history is outside this implementation. Sharing and recruiter
Q&A are not implemented.
