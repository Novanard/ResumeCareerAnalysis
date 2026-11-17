import { useEffect, useState } from 'react'
import { getProfileAnalytics, type PublicProfile } from '../../services/api'
import type { AnalyticsSnapshot } from '../../types/analytics'
import ProfileAnalytics from './ProfileAnalytics'

export default function OwnProfileAnalytics({ accessToken, profile }: { accessToken: string; profile: PublicProfile }) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    getProfileAnalytics(accessToken, controller.signal).then(result => {
      if (!controller.signal.aborted) { setSnapshot(result); setError('') }
    }).catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message) })
    return () => controller.abort()
  }, [accessToken, attempt])
  return <section className="own-profile-analytics" aria-label="Automatically derived profile analytics">
    <p className="analytics-note">Analytics are automatically extracted from your saved profile. To correct the underlying facts, edit and save your profile. No separate analytics approval is needed.</p>
    {error ? <p role="status">{error} <button className="header-link" type="button" onClick={() => setAttempt(value => value + 1)}>Retry analytics</button></p>
      : snapshot ? <ProfileAnalytics profile={profile} revision={snapshot.profileRevision} analytics={snapshot.analytics.content} companyTools={false} />
        : <p role="status">Extracting analytics from your saved profile...</p>}
  </section>
}
