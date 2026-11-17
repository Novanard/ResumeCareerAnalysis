# 07 - Dashboard Graphs and Analytics

## 1. Purpose and Status

Product requirements with an initial local implementation (see section 7). The reference is
`Final Project/mockup/dashboard.html` and its `js/charts.js` and `js/data.js`.
These files supply visual inspiration and a capability inventory; their sample
data, embedded instructions, layout, scoring, and library choices are not
requirements to copy verbatim.

Provide a company/recruiter dashboard for understanding a shared candidate's
experience, skills, outcomes, and supporting evidence. Include all ten types
below in the overall product roadmap. Company stakeholder tabs, viewing-as
selectors, and role-specific chart selection or permissions are deferred.
Employment roles in the career timeline are still ordinary candidate data.

## 2. Visualization Requirements

| ID | Visualization | Required analytics and interactions | Data prerequisites |
| --- | --- | --- | --- |
| timeline | Career timeline / Gantt chart | Show employment and projects on one time axis, with overlaps and ongoing entries. Select a bar for details and supporting public profile content. Gaps are descriptive, not negative assessments. | Employment dates exist in v1; project dates and employment/project links require an extension. |
| skill_heatmap | Skill recency and usage heatmap | Show skills against calendar periods, with a legend explaining recency and usage intensity. Select a cell for the associated work or projects. | Explicit dated skill-use intervals and an explained intensity measure; a skills list alone is insufficient. |
| skill_depth | Skill depth versus experience scatter plot | Compare supported usage duration with an explicitly defined depth scale; distinguish hands-on work and leadership/ownership when supported. Select a point for context. | Skill-use intervals, depth assessment source and scale, and usage/ownership facts. Do not infer proficiency from keywords or duration alone. |
| tech_stack | Technology stack by project sunburst | Explore project-to-technology relationships by selecting project segments and drilling into their technologies. Segment size must have a stated meaning rather than imply proficiency. | v1 project names and technologies support an initial version; stable entity references support drill-down. |
| impact_waterfall | Quantified impact waterfall / before-and-after view | Show outcome baselines, resulting values, direction of change, units, timeframe, measurement method, and evidence status. Select an outcome for its details. | Structured outcomes linked to projects, measurement context, and evidence. Never sum unrelated metrics or mix units into a misleading cumulative waterfall; use separate compatible series or before-and-after panels. |
| rubric_radar | Job-requirement rubric radar | Compare candidate dimensions with explicit requirement thresholds. Explain scales, evidence, weights, and missing dimensions. Adjustable weights may update a transparent aggregate fit indicator. | A separately supplied job rubric, documented assessment method, supported dimension values, and thresholds. Job requirements are distinct from company viewer roles. |
| eligibility | Eligibility checklist / audit table | Show each explicit must-have requirement as met, not met, or unknown, with supporting public evidence and rationale. Missing evidence is unknown, not failure. | Supplied screening criteria and supported facts. Do not infer citizenship or work authorization from location or other proxies. |
| evidence_trace | Evidence trace network | Link outcomes, decisions, and artifacts; distinguish relationship types. Select a node or edge for the relevant approved source snippet or permitted artifact link. | Structured claims, decisions, artifacts, evidence references, and explicit relationships. A link or candidate assertion is not independent verification. |
| collaboration | Collaboration network | Show supported work with teams, functions, and collaborators across projects. Explain node size and edge weight; select an edge for project context. | Explicit collaboration relationships, project links, and a defined engagement measure. Do not invent reporting lines or strength from job titles. |
| pipeline_funnel | Recruitment pipeline funnel and comparison table | Show candidate counts by actual recruitment stage and a comparison table with stage, rubric dimensions, must-have coverage, and fit where supported. Highlight the selected candidate. | Company-owned candidate pipeline, stage history/current stage, authorized candidate access, and a common rubric/version for comparisons. A single shared profile cannot provide pipeline analytics. |

The dashboard also includes summary indicators: project count, outcome count,
employment-role count, and profile completeness. Counts reflect the displayed
data. Completeness requires a documented checklist and denominator, and measures
information coverage rather than candidate quality. Rubric fit is displayed
only when a rubric and transparent calculation exist. Do not copy sample
percentages or sample experience totals from the reference.

## 3. Delivery and Existing Scope

- Initial dashboard work can use saved v1 facts for employment timelines,
  project/technology exploration, and supported counts. Year-only dates retain
  their uncertainty; undated items remain accessible outside dated bars.
- The remaining visualizations are required planned capabilities with the data
  dependencies above. They are not silently added to the current MVP release
  gate. Their implementation requires the relevant data contracts and workflows.
- Rubric assessment, eligibility screening, and multi-candidate pipelines extend
  beyond the current MVP. They do not introduce job listings, candidate search,
  job applications, or automatic candidate/job matching into the MVP.
- Use one shared dashboard presentation initially. Company viewer roles and
  their viewing options will be specified separately later.

## 4. Data, Calculations, and Sharing

The frozen [v1 contract](./02-CandidateProfileContract.md) remains unchanged.
Do not add arbitrary analytics fields to parsing output or repurpose
`additionalSections` as an undocumented analytics schema. Specify a versioned
extension or separate analytics entities before implementing richer data:
stable IDs and relationships; dated skill usage; project dates; outcomes and
measurements; decisions; artifacts and evidence; collaboration; job rubrics and
assessments; and company pipeline stages and membership.

[08 - Analytics Data Contract](./08-AnalyticsDataContract.md) now defines and
implements the separate candidate analytics storage/API foundation. Its migration
is not yet applied. Company rubric/pipeline contracts and collection/public UI
integration remain future work; the unavailable charts remain unimplemented.

Candidate-provided additions follow review and explicit saving in specs 03/04.
Company rubrics and pipeline records are separate company data, not candidate
profile edits. Future company access must be specified before exposing those
records; deferring stakeholder views does not authorize public pipeline access.

Public candidate analytics use only the current saved public projection under
[05 - Profile Sharing](./05-ProfileSharing.md). Private resumes, drafts,
refinement answers, raw metadata, and unshared artifacts remain private. Public
evidence drill-down cannot bypass that boundary. Revoked sharing and changes to
the saved profile invalidate corresponding analytics and cached evidence.

Derived results must identify their input revision, calculation method, and
relevant as-of date or rubric version. Union overlapping intervals when
calculating usage duration; never treat missing dates as zero or silently fill
in precise dates. Distinguish percent change from percentage-point change and
handle zero baselines as undefined for relative change. Candidate approval of
a claim does not make it independently verified. AI must not fabricate scores,
metrics, evidence, or relationships to populate a chart.

## 5. Dashboard Behavior

- Provide titles, legends, units, date ranges, and a short explanation of what
  each visualization means and how its values were derived.
- Support detail/expand views and evidence drill-down where relevant, with
  keyboard access, visible focus, and dismissal that returns focus correctly.
- Provide readable table/text equivalents and do not communicate status by
  color alone. Charts must remain usable on smaller screens.
- Distinguish loading, errors, no data, partial data, and unmet prerequisites.
  Explain unavailable analytics without substituting demo data or invented
  values. Failure of one chart must not prevent reading the profile or others.
- Display supported candidate charts together, with an optional show-all
  control if needed; do not introduce stakeholder-specific subsets yet.

The reference's Export PDF button is not an export requirement. Exact styling,
Plotly adoption, and a pixel-identical layout are not prescribed.

## 6. Acceptance Criteria for Implementation

- Every visualization above has a traceable implementation milestone and its
  prerequisites satisfied before it presents computed results.
- Supported charts agree with the current saved facts; missing and partial
  information remains visibly incomplete rather than becoming a zero score.
- Details and evidence resolve to approved, accessible sources; edits and
  sharing revocation do not leave stale public analytics available.
- Duration, metric, completeness, and rubric calculations have documented
  examples covering overlaps, missing dates, incompatible units, unknown
  criteria, and incomparable rubric versions where applicable.
- Pipeline counts reflect actual stages, comparisons use a common rubric,
  and unauthorized candidate/company data is excluded.
- Keyboard, mobile, text equivalents, and independent chart failure states
  are verified. No company viewer-role selector is required for this work.

## 7. Implementation and Verification Status

Implemented locally on the shared profile page:
- Employment timeline on a common calendar axis, year-only uncertainty
  markings, and an expandable table of all employment facts. Missing or
  reversed ranges are excluded from bars and remain readable in the table.
- Project/technology sunburst with keyboard-operable project selection,
  project descriptions, and a text equivalent of technology relationships.
- Counts of saved projects, employment entries, and named skills, plus the
  public saved-profile revision used for these views.
- An expandable inventory of the eight remaining visualization types with
  explicit unavailable states explaining their data prerequisites.

Calculations use only the already-loaded public projection. No new API,
profile fields, external chart services, company roles, or database migrations
are introduced. Ongoing employment ends at the viewer's current calendar month.
Summary completeness, outcomes, and fit indicators await their structured data
and documented calculations; they are not presented as zero or sample scores.

Verification: production frontend build and lint pass. All 12 Playwright tests
pass, including three analytics tests covering uncertain/missing/reversed dates,
keyboard drill-down, untrusted text, mobile overflow, capability descriptions,
and empty profiles. Existing Q&A tests continue to cover profile revision
refresh and removal of the shared content after a detected revocation.
Live provider/database and deployed-browser checks were not run for this change.
