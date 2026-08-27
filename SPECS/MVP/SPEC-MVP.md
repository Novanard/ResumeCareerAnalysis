# Resume Career Analysis - MVP Specification

## 1. Goal
Build a cloud-deployed web application where a candidate can upload a resume and receive an interactive professional profile.
The candidate can review and edit the generated profile.
A recruiter/company can access the shared candidate profile and ask natural-language questions about the candidate.

## 2. MVP User Types

### Candidate
- Upload resume
- Generate profile from resume
- View generated profile
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
5. System displays an interactive candidate profile.
6. Candidate can correct or edit the generated information.
7. Candidate receives a shareable profile link.
8. Recruiter opens the profile.
9. Recruiter asks questions about the candidate.
10. AI answers using the candidate's information.

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
### Interactive Candidate Profile
- Generated information is displayed as a structured profile.
- Profile sections can vary between candidates.
- Candidate can edit incorrect or missing information.
- Candidate edits become the authoritative profile information.

### Profile Sharing
- Candidate can generate/use a shareable profile URL.
- Recruiter does not need access to candidate editing functionality.

### Recruiter Q&A
- Recruiter can ask natural-language questions.
- Answers must be based on the candidate profile/resume information.
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

The exact database schema may change as individual feature specifications are developed.
## 9. MVP Completion Criteria

The MVP is considered functional when:
- A candidate can upload a resume.
- A candidate profile is automatically generated.
- Different resume structures can be represented.
- Candidate can edit generated information.
- Profile changes persist.
- Candidate profile can be accessed through a shared link.
- Recruiter can ask questions about the candidate.
- Answers are grounded in the candidate's stored information.
- Application is deployed and accessible online.