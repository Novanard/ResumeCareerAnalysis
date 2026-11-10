import type { CandidateProfile } from '../../types/candidate'

function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function list(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [] }
function dates(start: string | null, end: string | null, current: boolean | null) {
  return [start, current ? 'Present' : end].filter(Boolean).join(' - ')
}
function Description({ lines }: { lines: string[] }) {
  return lines.length ? <ul className="profile-description">{lines.map((line, i) => <li key={i}>{line}</li>)}</ul> : null
}
function ProfileLink({ url, children }: { url: unknown; children: string }) {
  const value = text(url)
  if (!/^https?:\/\//i.test(value)) return value ? <span>{value}</span> : null
  return <a href={value} target="_blank" rel="noreferrer">{children}</a>
}
export default function ProfileSections({ profile }: { profile: CandidateProfile }) {
  return <div className="profile-display-grid">
    <div className="profile-content">
      {profile.skills.length > 0 && <section className="profile-section"><h2>Skills</h2>
        <ul className="skill-list">{profile.skills.map((skill, i) => skill.name && <li key={i}>{skill.name}</li>)}</ul>
      </section>}
      {profile.experience.length > 0 && <section className="profile-section"><h2>Experience</h2><div className="timeline">
        {profile.experience.map((item, i) => <article className="timeline-item" key={i}>
          <div className="item-heading"><div><h3>{item.role || item.company || 'Experience'}</h3>
            <p className="organization">{[item.company, item.location].filter(Boolean).join(' / ')}</p></div>
            <p className="period">{dates(item.startDate, item.endDate, item.current)}</p></div>
          <Description lines={item.description} />
        </article>)}
      </div></section>}
      {profile.education.length > 0 && <section className="profile-section"><h2>Education</h2><div className="timeline">
        {profile.education.map((item, i) => <article key={i}>
          <div className="item-heading"><div><h3>{item.degree || item.field || 'Education'}</h3>
            <p className="organization">{item.institution}</p>
            {item.field && item.field !== item.degree && <p className="organization">{item.field}</p>}</div>
            <p className="period">{dates(item.startDate, item.endDate, item.current)}</p></div>
          <Description lines={item.description} />
        </article>)}
      </div></section>}
      {profile.projects.length > 0 && <section className="profile-section"><h2>Projects</h2><div className="profile-projects">
        {profile.projects.map((item, i) => <article className="profile-project" key={i}>
          <h3>{text(item.name) || 'Project'}</h3>
          {text(item.description) && <p>{text(item.description)}</p>}
          <ul className="skill-list">{list(item.technologies).map((tech, j) => <li key={j}>{tech}</li>)}</ul>
          {text(item.url) && <ProfileLink url={item.url}>View project</ProfileLink>}
        </article>)}
      </div></section>}
      {profile.additionalSections.map((section, i) => <section className="profile-section" key={i}>
        <h2>{text(section.title) || 'Additional information'}</h2><div className="timeline">
          {(Array.isArray(section.items) ? section.items : []).map((item, j) => <article key={j}>
            <div className="item-heading"><div><h3>{text(item.heading)}</h3><p className="organization">{text(item.subheading)}</p></div>
              <p className="period">{text(item.date)}</p></div>
            <Description lines={list(item.description)} />
          </article>)}
        </div>
      </section>)}
    </div>
    <aside className="profile-sidebar">
      {Object.values(profile.contact).some(Boolean) && <section className="profile-side-card"><h2>Contact</h2>
        <dl className="profile-contact">{Object.entries(profile.contact).filter(([, value]) => value).map(([key, value]) => <div key={key}>
          <dt>{key === 'linkedin' ? 'LinkedIn' : key === 'github' ? 'GitHub' : key[0].toUpperCase() + key.slice(1)}</dt>
          <dd>{key === 'linkedin' || key === 'github' ? <ProfileLink url={value}>{value || ''}</ProfileLink> : value}</dd>
        </div>)}</dl>
      </section>}
      {profile.languages.length > 0 && <section className="profile-side-card"><h2>Languages</h2>
        {profile.languages.map((item, i) => <div className="profile-side-entry" key={i}>
          <h3>{text(item.language)}</h3>{text(item.level) && <p>{text(item.level)}</p>}
        </div>)}
      </section>}
      {profile.certifications.length > 0 && <section className="profile-side-card"><h2>Certifications</h2>
        {profile.certifications.map((item, i) => <div className="profile-side-entry" key={i}>
          <h3>{text(item.name)}</h3><p>{[text(item.issuer), text(item.date)].filter(Boolean).join(' / ')}</p>
          {text(item.url) && <ProfileLink url={item.url}>View credential</ProfileLink>}
        </div>)}
      </section>}
    </aside>
  </div>
}
