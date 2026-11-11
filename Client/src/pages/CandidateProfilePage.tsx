import { useEffect, useState } from 'react'
import ProfileSections from '../components/candidate/ProfileSections'
import ProfileReview from '../components/candidate/ProfileReview'
import ProfileFollowupQuestions from '../components/candidate/ProfileFollowupQuestions'
import ProfileSharing from '../components/candidate/ProfileSharing'
import { getCandidateProfileDraft, type ProfileDraft } from '../services/api'
import '../styles/candidate-profile.css'

interface CandidateProfilePageProps {
  accessToken: string
  onBackToUpload: () => void
  onSignOut: () => void
}

function CandidateProfilePage({ accessToken, onBackToUpload, onSignOut }: CandidateProfilePageProps) {
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const profile = draft?.content
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  function leave(action: () => void) {
    if (!dirty || window.confirm('You have unsaved changes. Leave and discard them?')) action()
  }

  useEffect(() => {
    const controller = new AbortController()
    getCandidateProfileDraft(accessToken, controller.signal)
      .then(setDraft)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Unable to load candidate profile.')
        }
      })
    return () => controller.abort()
  }, [accessToken])

  if (error || !profile) {
    return (
      <main className="connection-error" role={error ? 'alert' : 'status'}>
        <h1>{error ? 'Unable to show profile' : 'Loading private draft...'}</h1>
        {error && <p>{error}</p>}
        {error && <button className="primary-button" type="button" onClick={() => leave(onBackToUpload)}>Back to upload</button>}
      </main>
    )
  }

  const displayName = profile.fullName || 'Candidate'
  const initials = displayName.split(' ').map((name) => name[0]).join('').slice(0, 3)

  return (
    <div className="app-shell">
      <header className="site-header">
        <span className="brand">Career Profile</span>
        <div className="header-actions">
          <button className="header-link" type="button" onClick={() => leave(onBackToUpload)}>Upload resume</button>
          <button className="header-link" type="button" onClick={() => leave(onSignOut)}>Sign out</button>
        </div>
      </header>

      <main className="profile-page">
        <ProfileSharing accessToken={accessToken} revision={draft?.revision || 0} canEnable={draft?.state === 'saved' || (draft?.base_profile_revision || 0) > 0} />
        <p className="eyebrow">{draft?.state === 'saved' ? 'Saved candidate profile' : 'Private profile draft'}</p>
        <p>{draft?.state === 'saved' ? 'Your approved profile is saved.' : 'Refine your profile, review the result, and approve the final content.'}</p>
        <section className="profile-intro" aria-labelledby="candidate-name">
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div>
            <h1 id="candidate-name">{displayName}</h1>
            <p className="headline">{profile.headline || 'No headline found in resume'}</p>
            <p className="summary">{profile.summary || 'No summary found in resume'}</p>
          </div>
        </section>

        {draft && draft.state !== 'refining' ? (
          <ProfileReview key={`${draft.id}:${draft.revision}`} draft={draft} accessToken={accessToken} onUpdate={setDraft} onDirty={setDirty} />
        ) : <div className="profile-grid">
          <ProfileSections profile={profile} />

          {draft && <ProfileFollowupQuestions key={draft.id} draft={draft} accessToken={accessToken} onUpdate={setDraft} onDirty={setDirty} />}
        </div>}
      </main>
    </div>
  )
}

export default CandidateProfilePage
