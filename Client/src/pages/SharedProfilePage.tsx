import { useEffect, useState } from 'react'
import ProfileSections from '../components/candidate/ProfileSections'
import { getSharedProfile, type SharedProfileSnapshot } from '../services/api'
import RecruiterQuestions from '../components/candidate/RecruiterQuestions'
import '../styles/candidate-profile.css'

export default function SharedProfilePage({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<SharedProfileSnapshot | null>(null)
  const profile = snapshot?.profile
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return
    getSharedProfile(token, controller.signal).then(setSnapshot).catch((reason: Error) => {
      if (!controller.signal.aborted) setError(reason.message)
    })
    return () => controller.abort()
  }, [token, attempt])
  return <div className="app-shell">
    <header className="site-header"><span className="brand">Career Profile</span></header>
    <main className="profile-page">
      {!profile ? <section role={error ? 'alert' : 'status'}>
        <h1>{!/^[A-Za-z0-9_-]{43}$/.test(token) ? 'Shared profile unavailable' : error || 'Loading shared profile...'}</h1>
        {error && error !== 'Shared profile unavailable' && <button className="primary-button" type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button>}
      </section> : <>
        <p className="eyebrow">Shared professional profile</p>
        <h1>{profile.fullName || 'Candidate'}</h1>
        {profile.headline && <p className="headline">{profile.headline}</p>}
        {profile.summary && <p className="summary">{profile.summary}</p>}
        <ProfileSections profile={profile} />
        {snapshot && <RecruiterQuestions token={token} profileRevision={snapshot.profileRevision}
          onUnavailable={() => { setSnapshot(null); setError('Shared profile unavailable') }}
          onRefresh={async () => {
            const updated = await getSharedProfile(token, new AbortController().signal)
            setSnapshot(updated)
            return updated.profileRevision
          }} />}
      </>}
    </main>
  </div>
}
