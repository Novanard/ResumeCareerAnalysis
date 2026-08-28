# 02 - Candidate Profile v1 Contract

## 1. Goal

Define the exact structured candidate profile returned by resume parsing. The
backend, frontend, database mapper, runtime validator, and later AI structured
output must use this contract.

This document freezes schema version 1. Changes that break this shape require a
new schema version.

## 2. Complete JSON Shape

Every key shown below is required. Unknown scalar values use `null`. Missing
collections use `[]`.

```json
{
  "schemaVersion": 1,
  "fullName": null,
  "headline": null,
  "summary": null,
  "contact": {
    "email": null,
    "phone": null,
    "location": null,
    "linkedin": null,
    "github": null
  },
  "skills": [
    {
      "name": "React",
      "category": "Framework"
    }
  ],
  "experience": [
    {
      "company": "Example Company",
      "role": "Software Developer",
      "location": null,
      "startDate": "2024-01",
      "endDate": null,
      "current": true,
      "description": ["Developed web applications using React."]
    }
  ],
  "education": [
    {
      "institution": "Afeka College of Engineering",
      "degree": "B.Sc. Software Engineering",
      "field": "Software Engineering",
      "startDate": "2022",
      "endDate": "2027",
      "current": true,
      "description": []
    }
  ],
  "projects": [
    {
      "name": "AllDay Market",
      "description": "Online marketplace application.",
      "technologies": ["Java", "SQL"],
      "url": null
    }
  ],
  "languages": [
    {
      "language": "English",
      "level": "Professional"
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": null,
      "date": null,
      "url": null
    }
  ],
  "additionalSections": [
    {
      "title": "Military Service",
      "items": [
        {
          "heading": null,
          "subheading": null,
          "date": null,
          "description": []
        }
      ]
    }
  ],
  "rawMetadata": {
    "source": "cv",
    "warnings": []
  }
}
```

## 3. Extraction Rules

* Only include information explicitly supported by the CV.
* Do not guess or invent missing facts.
* Use `null` for an unknown scalar value.
* Use `[]` for a missing collection.
* All defined keys must still be returned when their values are unknown.
* Do not use placeholder strings such as `"Not provided"`, `"Unknown"`, or
  `"N/A"` in place of `null`.
* Do not add keys not defined by this contract.
* Do not calculate durations, scores, confidence percentages, or years of
  experience.
* `headline` and `summary` are extracted only when present in the CV. They are
  not generated marketing content.
* Uncertainty belongs in `rawMetadata.warnings`, not in per-field confidence
  values.

## 4. Dates and Current Status

Dates use `YYYY-MM` when a month is available and `YYYY` when only a year is
available. Other strings, including `"Present"`, are invalid date values.

For an explicitly ongoing experience or education entry:

```json
{
  "endDate": null,
  "current": true
}
```

For an explicitly completed entry, `current` is `false`. When current status
cannot be determined, it is `null`.

## 5. Additional Sections

`additionalSections` represents relevant CV sections that do not fit the named
v1 collections, such as military service, volunteering, awards, or
publications. It intentionally uses a small generic item shape.

Do not duplicate named sections such as experience or education inside
`additionalSections`.

## 6. Database Mapping

The live `candidate_profiles` table already supports this contract:

| JSON field | Database destination |
| --- | --- |
| `fullName` | `candidate_profiles.full_name` |
| `headline` | `candidate_profiles.headline` |
| `summary` | `candidate_profiles.summary` |
| All remaining fields | `candidate_profiles.profile_data` JSONB |

`fullName`, `headline`, and `summary` must not also be stored in
`profile_data`. Candidate edits will later become the authoritative values in
these same locations.

## 7. Validation Requirements

The backend must reject parsing output that:

* omits a required key;
* adds an undefined key;
* uses `null` for a collection;
* uses an invalid date format;
* uses a placeholder string instead of `null` for unknown scalar data;
* uses a schema version other than `1`.

Invalid output must not overwrite an existing candidate profile.

## 8. Out of Scope for v1

* Per-field confidence scores
* Evidence arrays
* Calculated years of experience
* Skill proficiency scoring
* Conversation or message persistence
* Generated career recommendations
* Generated professional summaries
