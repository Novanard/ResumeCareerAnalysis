# Project instructions

- Before changing behavior or storage, read the relevant documents in `SPECS/MVP`.
- Keep implementation and specifications aligned in the same change. If the
  intended behavior changes, revise the affected specifications and overall
  specification rather than silently diverging from them.
- Distinguish implemented, planned, and verified behavior. Record unapplied
  migrations and pending live/database checks explicitly.
- Preserve candidate ownership, private drafts, explicit approval, and the
  saved-public-profile boundary when extending data or analytics.
- The candidate approves only their main profile. Candidate analytics must be
  automatically derived from the current saved profile, read-only, and refreshed
  when it changes. Do not introduce separate analytics editing or approval steps.
