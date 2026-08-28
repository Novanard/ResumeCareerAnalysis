import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import CandidateProfilePage from './pages/CandidateProfilePage'
import LoginPage from './pages/LoginPage'
import ResumeUploadPage from './pages/ResumeUploadPage'

type Page = 'upload' | 'profile'

function App() {
  const [page, setPage] = useState<Page>('upload')
  const [session, setSession] = useState<Session | null | undefined>(
    supabase ? undefined : null,
  )

  useEffect(() => {
    if (!supabase) {
      return
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase?.auth.signOut()
  }

  if (session === undefined) {
    return <p className="app-loading">Loading…</p>
  }

  if (!session) {
    return <LoginPage />
  }

  return page === 'upload' ? (
    <ResumeUploadPage
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
