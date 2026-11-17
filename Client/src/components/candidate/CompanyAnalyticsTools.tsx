// Read-only renderers. Company context must come from a future authorized
// company workflow; it cannot be manufactured from a candidate profile.
export interface CompanyAnalyticsContext {
  rubricVersion: string | null
  dimensions: Array<{ name: string; score: number | null; minimum: number; weight: number; evidence: string | null }>
  criteria: Array<{ name: string; status: 'unknown' | 'met' | 'not_met'; evidence: string | null }>
  stages: string[]
  pipeline: Array<{ id: string; label: string; stage: string; score: number | null; rubricVersion: string | null; selected: boolean }>
}

function Rubric({ context }: { context?: CompanyAnalyticsContext }) {
  const supported = (context?.dimensions || []).filter(item => item.score !== null && item.evidence && item.score >= 0 && item.score <= 5)
  const point = (index: number, value: number) => {
    const angle = index / supported.length * Math.PI * 2 - Math.PI / 2
    return `${180 + 115 * value / 5 * Math.cos(angle)},${150 + 115 * value / 5 * Math.sin(angle)}`
  }
  return <article className="analytics-card"><h3>Job rubric radar</h3><p className="analytics-note">Company-supplied rubric scores and thresholds on a 0–5 scale. The candidate profile does not define job requirements or suitability scores.</p>
    {supported.length >= 3 ? <svg className="analytics-plot" viewBox="0 0 360 310" role="img" aria-label="Company rubric scores and minimum thresholds">
      {[1, 2, 3, 4, 5].map(level => <polygon key={level} points={supported.map((_, i) => point(i, level)).join(' ')} fill="none" stroke="#e2e8f0" />)}
      <polygon points={supported.map((item, i) => point(i, item.minimum)).join(' ')} fill="none" stroke="#b45309" strokeDasharray="5 4" />
      <polygon points={supported.map((item, i) => point(i, item.score!)).join(' ')} fill="#2563eb33" stroke="#2563eb" />
      {supported.map((item, i) => { const [x, y] = point(i, 5.8).split(','); return <text key={i} x={x} y={y} textAnchor="middle">{item.name.slice(0, 18)}</text> })}
    </svg> : <p className="analytics-empty">No company job rubric with at least three supported assessments has been supplied. A candidate profile alone cannot populate this chart.</p>}
    {context?.dimensions.length ? <div className="analytics-table-scroll"><table><caption>Rubric {context.rubricVersion || 'version unspecified'} · blue: score; dashed amber: minimum</caption><thead><tr><th scope="col">Dimension</th><th scope="col">Score /5</th><th scope="col">Minimum /5</th><th scope="col">Evidence</th></tr></thead><tbody>{context.dimensions.map((item, i) => <tr key={i}><th scope="row">{item.name}</th><td>{item.evidence ? item.score ?? 'Unknown' : 'Unknown'}</td><td>{item.minimum}</td><td>{item.evidence || 'Not supplied'}</td></tr>)}</tbody></table></div> : null}
  </article>
}

function Eligibility({ context }: { context?: CompanyAnalyticsContext }) {
  return <article className="analytics-card"><h3>Eligibility checklist</h3><p className="analytics-note">Company must-have requirements with evidence. Missing evidence stays unknown. No eligibility determination is inferred from a candidate's location or job title.</p>
    {context?.criteria.length ? <div className="analytics-table-scroll"><table><caption>Company eligibility criteria</caption><thead><tr><th scope="col">Requirement</th><th scope="col">Status</th><th scope="col">Evidence</th></tr></thead><tbody>{context.criteria.map((item, i) => <tr key={i}><th scope="row">{item.name}</th><td>{item.evidence ? item.status.replace('_', ' ') : 'unknown'}</td><td>{item.evidence || 'Not supplied'}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">No company screening criteria have been supplied. Candidate facts alone do not establish which requirements must be met.</p>}
  </article>
}

function Pipeline({ context }: { context?: CompanyAnalyticsContext }) {
  const stages = context?.stages || []
  const rows = context?.pipeline || []
  const counts = stages.map(stage => rows.filter(row => row.stage === stage).length)
  const max = Math.max(1, ...counts)
  return <article className="analytics-card"><h3>Pipeline funnel</h3><p className="analytics-note">Current stage membership from authorized company pipeline records. Counts are not historical conversion rates. Other candidates cannot be obtained from a shared profile link.</p>
    {rows.length && stages.length ? <><svg className="analytics-plot" viewBox={`0 0 480 ${stages.length * 42 + 10}`} role="img" aria-label="Company pipeline counts by current stage">{stages.map((stage, index) => {
      const width = counts[index] / max * 260
      return <g key={stage}><text x="5" y={index * 42 + 25}>{stage}</text><rect x={260 - width / 2} y={index * 42 + 7} width={width} height="28" rx="4" fill="#2563eb" /><text x="415" y={index * 42 + 25}>{counts[index]}</text></g>
    })}</svg><div className="analytics-table-scroll"><table><caption>Authorized pipeline · rubric {context?.rubricVersion || 'not supplied'}</caption><thead><tr><th scope="col">Candidate</th><th scope="col">Stage</th><th scope="col">Score /100</th></tr></thead><tbody>{rows.map(row => <tr className={row.selected ? 'pipeline-current' : ''} key={row.id}><th scope="row">{row.label}{row.selected ? ' (this profile)' : ''}</th><td>{row.stage}</td><td>{context?.rubricVersion && row.rubricVersion === context.rubricVersion ? row.score ?? 'Unknown' : 'Incomparable'}</td></tr>)}</tbody></table></div></> : <p className="analytics-empty">No authorized company pipeline has been supplied. A single candidate profile contains no recruitment-stage or comparison data.</p>}
  </article>
}

export default function CompanyAnalyticsTools({ context }: { context?: CompanyAnalyticsContext }) {
  return <section className="company-analytics" aria-labelledby="company-tools-title"><h3 id="company-tools-title">Company context</h3><p className="analytics-note">These read-only views need company job requirements and authorized recruitment records. They are separate from the candidate's automatically derived analytics.</p><div className="analytics-grid"><Rubric context={context} /><Eligibility context={context} /><Pipeline context={context} /></div></section>
}
