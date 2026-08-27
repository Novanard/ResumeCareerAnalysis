# 01 - Resume Upload and Parsing Specification

## 1. Goal

Allow an authenticated candidate to upload a resume and convert it into structured profile data that can later be displayed as an interactive candidate profile.

This feature is responsible for the first transformation from an uploaded resume file into machine-readable candidate information.

---

## 2. Preconditions

* Candidate is authenticated.
* Candidate has access to their own profile area.
* The application is connected to cloud file storage.
* The backend is available.

---

## 3. Supported Input

The system should initially support:

* PDF
* DOCX

The uploaded file represents one candidate resume.

The exact maximum file size may be decided during implementation.

---

## 4. Upload Flow

1. Candidate selects a resume file.
2. Frontend validates that the file type is supported.
3. File is uploaded to the backend.
4. Backend verifies that the request belongs to an authenticated candidate.
5. Original resume file is stored in cloud storage.
6. A resume record is created in the database.
7. Text is extracted from the uploaded resume.
8. Extracted text is sent to the AI parsing process.
9. AI converts the resume into structured candidate data.
10. Structured data is stored in the candidate profile.
11. Candidate is redirected to or shown the generated profile.

---

## 5. Resume Text Extraction

The system must extract readable text from the uploaded resume.

The extraction process should preserve enough information for the AI parser to understand:

* section names
* dates
* job titles
* organizations
* education
* skills
* descriptions
* projects
* other relevant resume content

The system does not need to perfectly preserve the original visual layout.

---

## 6. AI Parsing

The extracted resume text will be analyzed by an AI model.

The AI should identify relevant candidate information and return structured data.

The parser must not assume that every resume contains the same sections.

Possible sections may include:

* Personal information
* Professional summary
* Work experience
* Education
* Skills
* Projects
* Military service
* Certifications
* Volunteering
* Awards
* Languages
* Publications
* Other candidate-specific sections

A candidate may contain only some of these sections or may contain additional sections not listed above.

---

## 7. Dynamic Profile Structure

Resume-specific information should be represented flexibly.

The parsing result should support dynamic sections rather than requiring every candidate to have the same predefined fields.

Example conceptual structure:

```json
{
  "sections": [
    {
      "type": "experience",
      "title": "Work Experience",
      "items": []
    },
    {
      "type": "military_service",
      "title": "Military Service",
      "items": []
    },
    {
      "type": "projects",
      "title": "Projects",
      "items": []
    }
  ]
}
```

Different candidates may produce different sets of sections.

The exact JSON structure may change during implementation.

---

## 8. Database Behavior

The system should store:

### Resume Record

* resume ID
* candidate profile ID
* file reference
* extracted text
* upload timestamp

### Candidate Profile

Stable profile information may be stored in relational database fields.

Flexible resume-specific information should be stored using PostgreSQL JSONB.

The exact schema will be finalized when the profile specification is implemented.

---

## 9. Re-upload Behavior

A candidate should be able to upload another resume in the future.

For the MVP, uploading a new resume may replace or regenerate the current generated profile.

The application should avoid silently deleting previous data before the new resume has been successfully processed.

The exact resume-version-history behavior is outside the initial MVP unless required later.

---

## 10. Error Handling

The system must handle at least the following cases:

### Unsupported File

If the candidate uploads an unsupported file type:

* upload is rejected
* candidate receives a clear error message

### Upload Failure

If cloud storage or the backend fails:

* candidate receives an error
* incomplete upload should not be treated as successfully processed

### Text Extraction Failure

If text cannot be extracted:

* candidate is informed that the resume could not be processed
* no generated profile should be created from invalid or empty extraction output

### AI Parsing Failure

If the AI service fails:

* uploaded resume may remain stored
* candidate is informed that profile generation failed
* system should allow the operation to be retried later

### Unauthorized Request

A user must not be able to upload or modify resumes belonging to another candidate profile.

---

## 11. Security Requirements

* Resume files must not be publicly writable.
* Resume operations must be associated with the authenticated candidate.
* One candidate must not be able to modify another candidate's resume.
* Sensitive backend credentials and AI API keys must never be exposed to the React frontend.
* File validation must also occur on the backend and must not rely only on frontend validation.

---

## 12. User Interface Requirements

The upload interface should provide:

* file selection
* supported file type indication
* upload action
* processing/loading indication
* error state
* successful completion state

The user should be able to understand whether the system is:

* uploading the file
* extracting content
* generating the profile
* finished
* unable to complete the operation

---

## 13. Acceptance Criteria

This feature is considered complete when:

* An authenticated candidate can upload a valid PDF resume.
* An authenticated candidate can upload a valid DOCX resume.
* Unsupported file types are rejected.
* Uploaded resume is stored in cloud storage.
* A resume database record is created.
* Resume text can be extracted.
* Extracted content is converted into structured candidate data.
* The parser supports different resume structures.
* The generated structured data is persisted.
* Refreshing the application does not remove the generated data.
* Parsing failures are shown to the candidate instead of crashing the application.
* Another user cannot modify the candidate's uploaded resume.
* AI API credentials are kept exclusively on the backend.

---

## 14. Out of Scope

This specification does not cover:

* Candidate profile UI design
* Candidate editing of generated information
* Recruiter access
* Recruiter Q&A
* Job listings
* Job applications
* Candidate-job matching
* Resume comparison
* Resume scoring
* Full resume version history

These features are covered by later specifications or future versions of the project.
