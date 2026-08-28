export interface AuthenticatedUser {
  id: string
  email?: string
}

interface AuthMeResponse {
  user: AuthenticatedUser
}

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

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
