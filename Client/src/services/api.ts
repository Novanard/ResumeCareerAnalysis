import type { CandidateProfile } from '../types/candidate'

export interface AuthenticatedUser {
  id: string
  email?: string
}

interface AuthMeResponse {
  user: AuthenticatedUser
}

export interface UploadedResume {
  id: string
  candidate_profile_id: string
  storage_path: string
  original_filename: string
  mime_type: string
  file_size: number
  extracted_text: string | null
  created_at: string
  processing_status: 'uploaded' | 'text_extracted' | 'parsing' | 'parsed' | 'parsing_failed'
  processing_error: string | null
  parsed_at: string | null
}

interface UploadResumeResponse {
  resume: UploadedResume
}

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

export interface SharingStatus { enabled: boolean; url: string | null }
export async function manageSharing(accessToken: string, action?: 'enable' | 'disable'): Promise<SharingStatus> {
  if (!apiUrl) throw new Error('The frontend API URL is not configured.')
  const response = await fetch(`${apiUrl}/api/profile/sharing${action ? `/${action}` : ''}`, {
    method: action ? 'POST' : 'GET', headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Unable to update sharing.')
  return body.sharing
}
export async function getSharedProfile(token: string, signal: AbortSignal): Promise<Omit<CandidateProfile, 'rawMetadata'>> {
  if (!apiUrl) throw new Error('The frontend API URL is not configured.')
  const response = await fetch(`${apiUrl}/api/shared/profiles/${encodeURIComponent(token)}`, { signal, cache: 'no-store', referrerPolicy: 'no-referrer' })
  if (response.status === 404) throw new Error('Shared profile unavailable')
  if (response.status === 429) throw new Error(`Too many requests. Retry after ${response.headers.get('Retry-After') || '60'} seconds.`)
  if (!response.ok) throw new Error('Unable to load shared profile. Please try again.')
  return (await response.json()).profile
}

export interface FollowupQuestion {
  id: string
  section: string
  text: string
  reason: string
  status: 'pending' | 'answered' | 'skipped'
  answer: string | null
}

export interface ProfileDraft {
  review_baseline: CandidateProfile | null
  proposal: CandidateProfile | null
  questions: FollowupQuestion[]
  questions_generated: boolean
  questions_finished: boolean
  id: string
  revision: number
  state: 'refining' | 'review' | 'confirmed' | 'saved'
  source_resume_id: string
  base_profile_revision: number
  content: CandidateProfile
}

export async function getCandidateProfileDraft(
  accessToken: string,
  signal?: AbortSignal,
): Promise<ProfileDraft> {
  if (!apiUrl) throw new Error('The frontend API URL is not configured.')
  const response = await fetch(`${apiUrl}/api/profile/draft`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
  })
  const body = (await response.json()) as { draft?: ProfileDraft; error?: string }
  if (!response.ok || !body.draft) {
    throw new Error(body.error || 'Unable to load profile draft.')
  }
  return body.draft
}

export async function verifyBackendSession(
  accessToken: string,
  signal?: AbortSignal,
): Promise<AuthenticatedUser> {
  if (!apiUrl) {
    throw new Error('The frontend API URL is not configured.')
  }

  const response = await fetch(`${apiUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  })

  const body = (await response.json()) as AuthMeResponse | { error?: string }

  if (!response.ok) {
    const message = 'error' in body && body.error
      ? body.error
      : 'The backend rejected the session.'
    throw new Error(message)
  }

  return (body as AuthMeResponse).user
}

export async function uploadResume(
  file: File,
  accessToken: string,
): Promise<UploadedResume> {
  if (!apiUrl) {
    throw new Error('The frontend API URL is not configured.')
  }

  const formData = new FormData()
  formData.append('resume', file)

  const response = await fetch(`${apiUrl}/api/resumes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })

  const body = (await response.json()) as UploadResumeResponse | { error?: string }

  if (!response.ok) {
    const message = 'error' in body && body.error
      ? body.error
      : 'Unable to upload resume.'
    throw new Error(message)
  }

  return (body as UploadResumeResponse).resume
}

export async function retryResumeParsing(
  resumeId: string,
  accessToken: string,
): Promise<UploadedResume> {
  if (!apiUrl) throw new Error('The frontend API URL is not configured.')

  const response = await fetch(`${apiUrl}/api/resumes/${resumeId}/parse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const body = (await response.json()) as UploadResumeResponse | { error?: string }
  if (!response.ok) {
    throw new Error('error' in body && body.error ? body.error : 'Unable to parse resume.')
  }
  return (body as UploadResumeResponse).resume
}

export async function updateRefinement(
  draftId: string, action: string, accessToken: string, input: Record<string, unknown>,
): Promise<ProfileDraft> {
  if (!apiUrl) throw new Error('The frontend API URL is not configured.')
  const response = await fetch(`${apiUrl}/api/profile/drafts/${draftId}/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await response.json() as { draft?: ProfileDraft; error?: string }
  if (!response.ok || !body.draft) throw new Error(body.error || 'Unable to update refinement.')
  return body.draft
}
