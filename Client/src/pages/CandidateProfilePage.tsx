import { useEffect, useState } from 'react'
import CandidateQuestionBox from '../components/candidate/CandidateQuestionBox'
import { getCandidateProfile } from '../services/api'
import type { CandidateProfile } from '../types/candidate'
import '../styles/candidate-profile.css'

interface CandidateProfilePageProps {
  accessToken: string
  onBackToUpload: () => void
  onSignOut: () => void
}

function period(start: string | null, end: string | null, current: boolean | null) {
  return [start, current ? 'Present' : end].filter(Boolean).join(' – ') || 'Date not provided'
}

function CandidateProfilePage({ accessToken, onBackToUpload, onSignOut }: CandidateProfilePageProps) {
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getCandidateProfile(accessToken, controller.signal)
      .then(setProfile)
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
        <h1>{error ? 'Unable to show profile' : 'Loading parsed profile...'}</h1>
        {error && <p>{error}</p>}
        {error && <button className="primary-button" type="button" onClick={onBackToUpload}>Back to upload</button>}
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
          <button className="header-link" type="button" onClick={onBackToUpload}>Upload resume</button>
          <button className="header-link" type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <main className="profile-page">
        <p className="eyebrow">Candidate Profile</p>
        <section className="profile-intro" aria-labelledby="candidate-name">
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div>
            <h1 id="candidate-name">{displayName}</h1>
            <p className="headline">{profile.headline || 'No headline found in resume'}</p>
            <p className="summary">{profile.summary || 'No summary found in resume'}</p>
          </div>
        </section>

        <div className="profile-grid">
          <div className="profile-content">
            <section className="profile-section" aria-labelledby="skills-title">
              <h2 id="skills-title">Skills</h2>
              <ul className="skill-list">
                {profile.skills.map((skill, index) => <li key={`${skill.name}-${index}`}>{skill.name || 'Unnamed skill'}</li>)}
              </ul>
            </section>

            <section className="profile-section" aria-labelledby="experience-title">
              <h2 id="experience-title">Experience</h2>
              <div className="timeline">
                {profile.experience.map((item, index) => (
                  <article className="timeline-item" key={`${item.company}-${item.role}-${index}`}>
                    <div className="item-heading">
                      <div><h3>{item.role || 'Role not provided'}</h3><p className="organization">{item.company || 'Company not provided'}</p></div>
                      <p className="period">{period(item.startDate, item.endDate, item.current)}</p>
                    </div>
                    <p>{item.description.join(' ') || 'No description provided.'}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="profile-section" aria-labelledby="education-title">
              <h2 id="education-title">Education</h2>
              {profile.education.map((item, index) => (
                <article className="education-item" key={`${item.institution}-${item.degree}-${index}`}>
                  <div><h3>{[item.degree, item.field].filter(Boolean).join(', ') || 'Qualification not provided'}</h3><p className="organization">{item.institution || 'Institution not provided'}</p></div>
                  <p className="period">{period(item.startDate, item.endDate, item.current)}</p>
                </article>
              ))}
            </section>

            <section className="profile-section" aria-labelledby="parsed-json-title">
              <h2 id="parsed-json-title">DeepSeek parsed data</h2>
              <details>
                <summary>View exact parsed JSON</summary>
                <pre className="parsed-profile-json">{JSON.stringify(profile, null, 2)}</pre>
              </details>
            </section>
          </div>

          <CandidateQuestionBox candidateName={displayName} />
        </div>
      </main>
    </div>
  )
}

export default CandidateProfilePage
