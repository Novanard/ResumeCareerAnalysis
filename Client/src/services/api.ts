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

export async function getCandidateProfile(
  accessToken: string,
  signal?: AbortSignal,
): Promise<CandidateProfile> {
  if (!apiUrl) throw new Error('The frontend API URL is not configured.')

  const response = await fetch(`${apiUrl}/api/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  })
  const body = (await response.json()) as { profile?: CandidateProfile; error?: string }

  if (!response.ok || !body.profile) {
    throw new Error(body.error || 'Unable to load candidate profile.')
  }

  return body.profile
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
