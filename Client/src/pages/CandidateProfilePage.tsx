import CandidateQuestionBox from '../components/candidate/CandidateQuestionBox'
import { mockCandidate } from '../data/mockCandidate'
import '../styles/candidate-profile.css'

interface CandidateProfilePageProps {
  onBackToUpload: () => void
  onSignOut: () => void
}

function CandidateProfilePage({ onBackToUpload, onSignOut }: CandidateProfilePageProps) {
  const initials = mockCandidate.fullName
    .split(' ')
    .map((name) => name[0])
    .join('')

  return (
    <div className="app-shell">
      <header className="site-header">
        <span className="brand">Career Profile</span>
        <div className="header-actions">
          <button className="header-link" type="button" onClick={onBackToUpload}>
            Upload resume
          </button>
          <button className="header-link" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="profile-page">
        <p className="eyebrow">Candidate Profile</p>
        <section className="profile-intro" aria-labelledby="candidate-name">
          <div className="avatar" aria-hidden="true">{initials}</div>
          <div>
            <h1 id="candidate-name">{mockCandidate.fullName}</h1>
            <p className="headline">{mockCandidate.headline}</p>
            <p className="summary">{mockCandidate.summary}</p>
          </div>
        </section>

        <div className="profile-grid">
          <div className="profile-content">
            <section className="profile-section" aria-labelledby="skills-title">
              <h2 id="skills-title">Skills</h2>
              <ul className="skill-list">
                {mockCandidate.skills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            </section>

            <section className="profile-section" aria-labelledby="experience-title">
              <h2 id="experience-title">Experience</h2>
              <div className="timeline">
                {mockCandidate.experience.map((item) => (
                  <article className="timeline-item" key={`${item.company}-${item.role}`}>
                    <div className="item-heading">
                      <div>
                        <h3>{item.role}</h3>
                        <p className="organization">{item.company}</p>
                      </div>
                      <p className="period">{item.period}</p>
                    </div>
                    <p>{item.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="profile-section" aria-labelledby="education-title">
              <h2 id="education-title">Education</h2>
              {mockCandidate.education.map((item) => (
                <article className="education-item" key={item.qualification}>
                  <div>
                    <h3>{item.qualification}</h3>
                    <p className="organization">{item.institution}</p>
                  </div>
                  <p className="period">{item.period}</p>
                </article>
              ))}
            </section>
          </div>

          <CandidateQuestionBox candidateName={mockCandidate.fullName} />
        </div>
      </main>
    </div>
  )
}

export default CandidateProfilePage
