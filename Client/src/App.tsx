import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import CandidateProfilePage from './pages/CandidateProfilePage'
import LoginPage from './pages/LoginPage'
import ResumeUploadPage from './pages/ResumeUploadPage'
import { verifyBackendSession } from './services/api'

type Page = 'upload' | 'profile'

interface BackendVerification {
  token: string
  status: 'verified' | 'error'
  error: string
}

function App() {
  const [page, setPage] = useState<Page>('upload')
  const [session, setSession] = useState<Session | null | undefined>(
    supabase ? undefined : null,
  )
  const [backendVerification, setBackendVerification] =
    useState<BackendVerification | null>(null)
  const [verificationAttempt, setVerificationAttempt] = useState(0)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    verifyBackendSession(session.access_token, controller.signal)
      .then(() => {
        setBackendVerification({
          token: session.access_token,
          status: 'verified',
          error: '',
        })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return

        setBackendVerification({
          token: session.access_token,
          status: 'error',
          error: error instanceof Error
            ? error.message
            : 'Unable to verify the session.',
        })
      })

    return () => controller.abort()
  }, [session, verificationAttempt])

  async function signOut() {
    await supabase?.auth.signOut()
  }

  if (session === undefined) {
    return <p className="app-loading">Loading...</p>
  }

  if (!session) {
    return <LoginPage />
  }

  if (backendVerification?.token !== session.access_token) {
    return <p className="app-loading">Verifying your session...</p>
  }

  if (backendVerification.status === 'error') {
    return (
      <main className="connection-error" role="alert">
        <h1>Unable to connect to the API</h1>
        <p>{backendVerification.error}</p>
        <div className="connection-error-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setBackendVerification(null)
              setVerificationAttempt((attempt) => attempt + 1)
            }}
          >
            Try again
          </button>
          <button className="header-link" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </main>
    )
  }

  return page === 'upload' ? (
    <ResumeUploadPage
      accessToken={session.access_token}
      onViewProfile={() => setPage('profile')}
      onSignOut={signOut}
    />
  ) : (
    <CandidateProfilePage
      onBackToUpload={() => setPage('upload')}
      onSignOut={signOut}
    />
  )
}

export default App
