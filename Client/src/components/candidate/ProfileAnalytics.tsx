import { useState } from 'react'
import type { PublicProfile } from '../../services/api'
import '../../styles/profile-analytics.css'
import { emptyAnalytics, type AnalyticsData } from '../../types/analytics'
import CandidateAnalyticsCharts from './CandidateAnalyticsCharts'
import CompanyAnalyticsTools from './CompanyAnalyticsTools'

const colors = ['#2563eb', '#7c3aed', '#0f766e', '#b45309', '#be185d', '#475569']

// Bounds express uncertainty instead of inventing a month for year-only dates.
function dateBounds(value: string | null): [number, number] | null {
  if (!value || !/^\d{4}(-\d{2})?$/.test(value)) return null
  const [year, month] = value.split('-').map(Number)
  if (month !== undefined && (month < 1 || month > 12)) return null
  return month === undefined ? [year * 12, year * 12 + 11] : [year * 12 + month - 1, year * 12 + month - 1]
}

function CareerTimeline({ profile, analytics }: { profile: PublicProfile; analytics?: AnalyticsData | null }) {
  const [selected, setSelected] = useState<string | null>(null)
  const now = new Date()
  const currentMonth = now.getFullYear() * 12 + now.getMonth()
  const rows = profile.experience.map((item, index) => {
    const start = dateBounds(item.startDate)
    const end = item.current ? [currentMonth, currentMonth] : dateBounds(item.endDate)
    return { item, index, start, end, valid: !!start && !!end && start[0] <= end[1] }
  })
  const projectRows = (analytics?.projects || []).map((project, index) => {
    const start = dateBounds(project.startDate), end = project.current ? [currentMonth, currentMonth] : dateBounds(project.endDate)
    const saved = profile.projects[project.profileProjectIndex]
    return { item: { role: `Project: ${String(saved?.name || 'Project')}`, company: null, description: [String(saved?.description || '')] }, index: rows.length + index, start, end, valid: !!start && !!end && start[0] <= end[1] }
  })
  const dated = [...rows, ...projectRows].filter(row => row.valid)
  const min = Math.min(...dated.map(row => row.start![0]))
  const max = Math.max(...dated.map(row => row.end![1])) + 1
  const span = max - min
  return <>
    <p className="analytics-note">Employment and dated projects from the saved profile on a shared calendar axis. Striped bars include year-only date uncertainty; they do not represent exact months. Select a bar for details.</p>
    {dated.length > 0 ? <div className="career-chart" aria-label="Employment timeline">
      <div className="career-axis"><span>{Math.floor(min / 12)}</span><span>{Math.floor((max - 1) / 12)}</span></div>
      {dated.map(({ item, index, start, end }) => <div className="career-chart-row" key={index}>
        <span>{item.role || item.company || 'Employment'}</span>
        <div className="career-track"><button type="button" aria-label={`Timeline details: ${item.role || item.company || 'Employment'}`} onClick={() => setSelected(`${item.role || item.company}: ${item.description.join(' ')}`)} className={`career-bar ${start![0] !== start![1] || end![0] !== end![1] ? 'is-approximate' : ''}`}
          style={{ left: `${(start![0] - min) / span * 100}%`, width: `${(end![1] + 1 - start![0]) / span * 100}%` }} />
        </div>
      </div>)}
    </div> : <p className="analytics-empty">No employment entries have a usable start and end date yet.</p>}
    {selected && <p className="chart-context" aria-live="polite">{selected}</p>}
    <details className="analytics-details"><summary>Employment dates and details ({rows.length})</summary>
      <div className="analytics-table-scroll"><table><caption>Saved employment facts; missing dates remain unspecified.</caption>
        <thead><tr><th scope="col">Employment</th><th scope="col">Dates</th><th scope="col">Details</th></tr></thead>
        <tbody>{rows.map(({ item, index, valid }) => <tr key={index}>
          <th scope="row">{[item.role, item.company].filter(Boolean).join(' · ') || 'Employment'}</th>
          <td>{item.startDate || 'Start unspecified'} → {item.current ? 'Present' : item.endDate || 'End unspecified'}{!valid && ' (not plotted)'}</td>
          <td>{item.description.join(' ') || 'No description provided.'}</td>
        </tr>)}</tbody>
      </table></div>
    </details>
    <p className="analytics-note">{projectRows.some(row => row.valid) ? 'Projects without usable dates remain listed in the project section.' : 'Projects have no usable dates in the saved profile and are not plotted.'}</p>
  </>
}

function arc(inner: number, outer: number, start: number, end: number) {
  const point = (r: number, a: number) => `${160 + r * Math.cos(a)},${160 + r * Math.sin(a)}`
  const large = end - start > Math.PI ? 1 : 0
  return `M${point(outer, start)} A${outer},${outer} 0 ${large} 1 ${point(outer, end)} L${point(inner, end)} A${inner},${inner} 0 ${large} 0 ${point(inner, start)} Z`
}

function TechnologyStack({ profile }: { profile: PublicProfile }) {
  const [selected, setSelected] = useState<number | null>(null)
  const projects = profile.projects.map((project, index) => ({
    index, name: typeof project.name === 'string' && project.name ? project.name : `Project ${index + 1}`,
    description: typeof project.description === 'string' ? project.description : '',
    technologies: Array.isArray(project.technologies) ? [...new Set(project.technologies.filter((t): t is string => typeof t === 'string' && !!t.trim()).map(t => t.trim()))] : [],
  }))
  const visible = selected === null ? projects : projects.filter(project => project.index === selected)
  const total = visible.reduce((count, project) => count + Math.max(1, project.technologies.length), 0)
  const segments = visible.map((project, index) => {
    const offset = visible.slice(0, index).reduce((sum, item) => sum + Math.max(1, item.technologies.length), 0)
    const start = offset / total * Math.PI * 2 - Math.PI / 2
    // Keep a tiny gap so a complete circle is a valid SVG arc too.
    const end = (offset + Math.max(1, project.technologies.length)) / total * Math.PI * 2 - Math.PI / 2 - 0.008
    return { ...project, start, end }
  })
  return <>
    <p className="analytics-note">Inner ring: projects. Outer ring: listed technologies. Area counts project–technology links, not proficiency or time spent.</p>
    {projects.length ? <>
      <div className="stack-explorer">
        <svg viewBox="0 0 320 320" role="img" aria-label="Project technology sunburst. Use the project buttons below to explore.">
          {segments.map(project => <g key={project.index}>
            <path d={arc(57, 98, project.start, project.end)} fill={colors[project.index % colors.length]}><title>{project.name}</title></path>
            {(project.technologies.length ? project.technologies : ['Technologies unspecified']).map((tech, i, techs) => <path key={tech}
              d={arc(102, 145, project.start + (project.end - project.start) * i / techs.length, project.start + (project.end - project.start) * (i + 1) / techs.length - 0.004)}
              fill={colors[project.index % colors.length]} fillOpacity={0.55 + i % 3 * 0.15}><title>{project.name}: {tech}</title></path>)}
          </g>)}
          <text x="160" y="157" textAnchor="middle" className="stack-center-count">{visible.length}</text>
          <text x="160" y="178" textAnchor="middle" className="stack-center-label">{visible.length === 1 ? 'project' : 'projects'}</text>
        </svg>
        <div className="stack-project-buttons" aria-label="Explore project technologies">
          <button type="button" aria-pressed={selected === null} onClick={() => setSelected(null)}>All projects</button>
          {projects.map(project => <button type="button" key={project.index} aria-pressed={selected === project.index} onClick={() => setSelected(project.index)}>
            <span className="stack-key" style={{ background: colors[project.index % colors.length] }} />{project.name}
          </button>)}
        </div>
      </div>
      <div className="stack-project-details" aria-live="polite">{visible.map(project => <article key={project.index}>
        <h4>{project.name}</h4>{project.description && <p>{project.description}</p>}
        <p><strong>Technologies: </strong>{project.technologies.join(', ') || 'Not specified'}</p>
      </article>)}</div>
    </> : <p className="analytics-empty">No projects are listed in the saved profile.</p>}
  </>
}

export default function ProfileAnalytics({ profile, revision, analytics, companyTools = true, analyticsState = 'ready' }: { profile: PublicProfile; revision: number; analytics?: AnalyticsData | null; companyTools?: boolean; analyticsState?: 'ready' | 'loading' | 'error' }) {
  const [showPlanned, setShowPlanned] = useState(false)
  return <section className="profile-analytics" aria-labelledby="analytics-title">
    <div className="analytics-heading"><div><p className="eyebrow">Experience at a glance</p><h2 id="analytics-title">Profile analytics</h2></div><span className="analytics-revision">Saved version {revision}</span></div>
    <dl className="analytics-stats">
      {[[profile.projects.length, 'Projects'], [profile.experience.length, 'Employment roles'], [profile.skills.filter(skill => skill.name?.trim()).length, 'Listed skills'], ...(analytics ? [[analytics.outcomes.length, 'Reported outcomes']] : [])].map(([value, label]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <div className="analytics-grid">
      <article className="analytics-card"><h3>Career timeline</h3><CareerTimeline profile={profile} analytics={analytics} /></article>
      <article className="analytics-card"><h3>Technology stack by project</h3><TechnologyStack key={revision} profile={profile} /></article>
    </div>
    <button className="analytics-toggle" type="button" aria-expanded={showPlanned} aria-controls="planned-analytics" onClick={() => setShowPlanned(!showPlanned)}>{showPlanned ? 'Hide additional analytics' : 'Explore all 10 visualization types'}</button>
    {showPlanned && <div id="planned-analytics" className="analytics-planned">{analyticsState === 'ready' ? <div className="analytics-grid"><CandidateAnalyticsCharts data={analytics || emptyAnalytics()} profile={profile} /></div> : <p role="status">{analyticsState === 'loading' ? 'Extracting analytics from the saved profile...' : 'Candidate analytics could not be loaded. Use Retry analytics above.'}</p>}{companyTools && <CompanyAnalyticsTools />}</div>}
  </section>
}
