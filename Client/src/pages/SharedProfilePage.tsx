import { useEffect, useState } from 'react'
import ProfileSections from '../components/candidate/ProfileSections'
import { getSharedProfile, sharedAnalytics, SharedProfileError, type SharedProfileSnapshot } from '../services/api'
import type { AnalyticsData } from '../types/analytics'
import RecruiterQuestions from '../components/candidate/RecruiterQuestions'
import ProfileAnalytics from '../components/candidate/ProfileAnalytics'
import '../styles/candidate-profile.css'

export default function SharedProfilePage({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<SharedProfileSnapshot | null>(null)
  const profile = snapshot?.profile
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [analyticsSnapshot, setAnalyticsSnapshot] = useState<{ profileRevision: number; content: AnalyticsData | null } | null>(null)
  const [analyticsError, setAnalyticsError] = useState('')
  const [analyticsAttempt, setAnalyticsAttempt] = useState(0)
  const revision = snapshot?.profileRevision
  useEffect(() => {
    if (revision === undefined) return
    const controller = new AbortController()
    sharedAnalytics(token, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.profileRevision !== revision) { setAnalyticsError('The profile changed. Refresh this page to load matching analytics.'); return }
      setAnalyticsSnapshot({ profileRevision: result.profileRevision, content: result.analytics?.content || null })
      setAnalyticsError('')
    }).catch((reason: Error) => {
      if (controller.signal.aborted) return
      if (reason instanceof SharedProfileError && reason.status === 404) { setSnapshot(null); setError('Shared profile unavailable') }
      else setAnalyticsError(reason.message)
    })
    return () => controller.abort()
  }, [token, revision, analyticsAttempt])
  useEffect(() => {
    const controller = new AbortController()
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return
    getSharedProfile(token, controller.signal).then(setSnapshot).catch((reason: Error) => {
      if (!controller.signal.aborted) setError(reason.message)
    })
    return () => controller.abort()
  }, [token, attempt])
  return <div className="app-shell shared-shell">
    <header className="site-header shared-header">
      <a className="brand" href="/">Career Profile</a>
      <nav className="header-actions" aria-label="Your workspace">
        <a className="header-link" href="/?page=profile">My profile</a>
        <a className="header-link" href="/">Upload resume</a>
      </nav>
    </header>
    <main className="profile-page">
      {!profile ? <section role={error ? 'alert' : 'status'}>
        <h1>{!/^[A-Za-z0-9_-]{43}$/.test(token) ? 'Shared profile unavailable' : error || 'Loading shared profile...'}</h1>
        {error && error !== 'Shared profile unavailable' && <button className="primary-button" type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button>}
      </section> : <>
        <p className="eyebrow">Shared professional profile</p>
        <h1>{profile.fullName || 'Candidate'}</h1>
        {profile.headline && <p className="headline">{profile.headline}</p>}
        {profile.summary && <p className="summary">{profile.summary}</p>}
        {snapshot && <RecruiterQuestions token={token} profileRevision={snapshot.profileRevision}
          onUnavailable={() => { setSnapshot(null); setError('Shared profile unavailable') }}
          onRefresh={async () => {
            const updated = await getSharedProfile(token, new AbortController().signal)
            setSnapshot(updated)
            return updated.profileRevision
          }} />}
        {analyticsError && <p role="status">{analyticsError} <button className="header-link" type="button" onClick={() => setAnalyticsAttempt(value => value + 1)}>Retry analytics</button></p>}
        {snapshot && <ProfileAnalytics key={`${token}:${snapshot.profileRevision}`} profile={profile} revision={snapshot.profileRevision} analytics={!analyticsError && analyticsSnapshot?.profileRevision === snapshot.profileRevision ? analyticsSnapshot.content : null} analyticsState={analyticsError ? 'error' : analyticsSnapshot?.profileRevision === snapshot.profileRevision ? 'ready' : 'loading'} />}
        <ProfileSections profile={profile} />
      </>}
    </main>
  </div>
}
