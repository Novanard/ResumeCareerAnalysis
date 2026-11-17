import { useState } from 'react'
import type { AnalyticsData } from '../../types/analytics'
import type { PublicProfile } from '../../services/api'

const depthScale = ['exposure', 'applied', 'independent', 'ownership'] as const
const month = (date: string | null) => date && /^\d{4}-\d{2}$/.test(date) ? Number(date.slice(0, 4)) * 12 + Number(date.slice(5)) - 1 : null
const nowMonth = () => new Date().getFullYear() * 12 + new Date().getMonth()
const skillName = (profile: PublicProfile, index: number) => profile.skills[index]?.name || 'Unnamed skill'
function projectName(data: AnalyticsData, profile: PublicProfile, id: string) {
  const project = data.projects.find(item => item.id === id)
  return String(profile.projects[project?.profileProjectIndex ?? -1]?.name || 'Project')
}
export function EmptyAnalytics({ children }: { children: string }) {
  return <p className="analytics-empty">{children}</p>
}

function SkillHeatmap({ data, profile }: { data: AnalyticsData; profile: PublicProfile }) {
  const [selected, setSelected] = useState<string | null>(null)
  const current = nowMonth()
  const quarter = Math.floor(current / 3)
  const quarters = Array.from({ length: 12 }, (_, i) => quarter - 11 + i)
  const skills = [...new Set(data.skillUsages.map(item => item.profileSkillIndex))]
  const selectedRows = data.skillUsages.filter(item => selected?.split(':')[0] === String(item.profileSkillIndex))
  return <article className="analytics-card"><h3>Skill recency heatmap</h3>
    <p className="analytics-note">Last 12 calendar quarters. Intensity is candidate-reported: occasional (1), regular (2), primary (3). A striped cell means year-only dates or unspecified intensity; blank means no recorded usage, not no skill.</p>
    {skills.length ? <div className="analytics-table-scroll"><table className="skill-heatmap"><caption>Skill usage by quarter; select a cell for context.</caption><thead><tr><th scope="col">Skill</th>{quarters.map(q => <th scope="col" key={q}>{Math.floor(q / 4)} Q{q % 4 + 1}</th>)}</tr></thead>
      <tbody>{skills.map(index => <tr key={index}><th scope="row">{skillName(profile, index)}</th>{quarters.map(q => {
        const usages = data.skillUsages.filter(item => {
          if (item.profileSkillIndex !== index || !item.startDate || (!item.endDate && !item.current)) return false
          const start = month(item.startDate) ?? Number(item.startDate) * 12
          const end = item.current ? current : month(item.endDate) ?? Number(item.endDate) * 12 + 11
          return start <= q * 3 + 2 && end >= q * 3
        })
        const intensity = Math.max(0, ...usages.map(item => item.intensity === 'primary' ? 3 : item.intensity === 'regular' ? 2 : item.intensity === 'occasional' ? 1 : 0))
        const uncertain = usages.some(item => month(item.startDate) === null || (!item.current && month(item.endDate) === null) || !item.intensity)
        const label = `${skillName(profile, index)}, ${Math.floor(q / 4)} Q${q % 4 + 1}: ${usages.length ? uncertain ? 'possible usage / incomplete intensity' : `usage intensity ${intensity}` : 'no recorded usage'}`
        return <td key={q}><button type="button" className={`heat-cell heat-${intensity} ${uncertain ? 'heat-uncertain' : ''}`} aria-label={label} aria-pressed={selected === `${index}:${q}`} onClick={() => setSelected(`${index}:${q}`)}>{usages.length ? uncertain ? '?' : intensity : '—'}</button></td>
      })}</tr>)}</tbody></table></div> : <EmptyAnalytics>The saved profile does not specify dated skill usage.</EmptyAnalytics>}
    {selected && <div className="chart-context" aria-live="polite">{selectedRows.map(item => <p key={item.id}><strong>{skillName(profile, item.profileSkillIndex)}</strong>: {item.startDate || 'Start unknown'} to {item.current ? 'Present' : item.endDate || 'End unknown'}; {item.intensity || 'intensity unspecified'}. {item.projectIds.map(id => projectName(data, profile, id)).join(', ')} {item.assessmentBasis}</p>)}</div>}
    {data.skillUsages.length > 0 && <details className="analytics-details"><summary>All skill usage, including undated entries</summary>{data.skillUsages.map(item => <p key={item.id}>{skillName(profile, item.profileSkillIndex)}: {item.startDate || 'Start unknown'} to {item.current ? 'Present' : item.endDate || 'End unknown'}; {item.usage || 'usage unspecified'}; {item.intensity || 'intensity unspecified'}</p>)}</details>}
  </article>
}

function SkillScatter({ data, profile }: { data: AnalyticsData; profile: PublicProfile }) {
  const [selected, setSelected] = useState<string | null>(null)
  const points = data.skillUsages.flatMap(item => {
    const start = month(item.startDate), end = item.current ? nowMonth() : month(item.endDate)
    if (start === null || end === null || end < start || !item.depth) return []
    return [{ ...item, duration: end - start + 1, level: depthScale.indexOf(item.depth) + 1 }]
  })
  const max = Math.max(12, ...points.map(item => item.duration))
  const chosen = data.skillUsages.find(item => item.id === selected)
  return <article className="analytics-card"><h3>Skill depth vs. experience</h3><p className="analytics-note">Each point is one recorded usage period, not a summed career total. Only month-precise periods with explicit depth are plotted. Depth: 1 exposure, 2 applied, 3 independent, 4 ownership. ★ indicates reported leadership.</p>
    {points.length ? <svg className="analytics-plot" viewBox="0 0 480 270" role="img" aria-label="Recorded skill usage duration versus reported depth; select a skill below for details.">
      {[1, 2, 3, 4].map(level => <g key={level}><line x1="45" x2="450" y1={230 - level * 45} y2={230 - level * 45} stroke="#e2e8f0" /><text x="25" y={235 - level * 45}>{level}</text></g>)}
      <line x1="45" x2="450" y1="230" y2="230" stroke="#94a3b8" /><text x="45" y="250">0 months</text><text x="380" y="250">{max} months</text>
      {points.map(point => <g key={point.id}><circle cx={45 + point.duration / max * 400} cy={230 - point.level * 45} r="8" fill="#2563eb"><title>{skillName(profile, point.profileSkillIndex)}: {point.duration} months, {point.depth}</title></circle>{point.usage === 'led' && <text x={41 + point.duration / max * 400} y={215 - point.level * 45}>★</text>}</g>)}
    </svg> : <EmptyAnalytics>No recorded skill periods have both month-precise dates and an explicit depth assessment.</EmptyAnalytics>}
    <div className="chart-selection">{points.map(point => <button type="button" key={point.id} aria-pressed={selected === point.id} onClick={() => setSelected(point.id)}>{skillName(profile, point.profileSkillIndex)} · {point.duration} months · {point.depth}</button>)}</div>
    {chosen && <p className="chart-context" aria-live="polite">{chosen.assessmentBasis} {chosen.projectIds.map(id => projectName(data, profile, id)).join(', ')}</p>}
    {data.skillUsages.length > points.length && <p className="analytics-note">{data.skillUsages.length - points.length} usage records are not plotted because dates or depth are incomplete.</p>}
  </article>
}

function Impact({ data, profile }: { data: AnalyticsData; profile: PublicProfile }) {
  return <article className="analytics-card"><h3>Quantified impact</h3><p className="analytics-note">Before-and-after panels keep unrelated metrics separate. Values are candidate-reported. A supporting artifact does not establish independent verification.</p>
    {data.outcomes.length ? data.outcomes.map(item => {
      const scale = Math.max(Math.abs(item.baseline || 0), Math.abs(item.result || 0), 1)
      const change = item.baseline !== null && item.result !== null ? item.result - item.baseline : null
      const relative = change !== null && item.baseline !== null && item.baseline !== 0 ? change / Math.abs(item.baseline) * 100 : null
      return <details className="impact-outcome" key={item.id} open><summary>{item.metric} · {projectName(data, profile, item.projectId)}</summary>
        {[['Before', item.baseline], ['After', item.result]].map(([label, value]) => <div className="impact-row" key={String(label)}><span>{label}</span><div><span style={{ width: `${typeof value === 'number' ? Math.abs(value) / scale * 100 : 0}%` }} /></div><strong>{value ?? 'Unknown'} {item.unit}</strong></div>)}
        <p>{change === null ? 'Change unknown' : `${change > 0 ? '+' : ''}${Number(change.toFixed(3))} ${item.unit === '%' ? 'percentage points' : item.unit || ''}`}{relative !== null && ` (${relative > 0 ? '+' : ''}${relative.toFixed(1)}% relative change)`}</p>
        <p className="analytics-note">{item.description} · {item.timeframe || 'Timeframe unspecified'} · Measurement: {item.measurementMethod || 'Not supplied'} · {data.evidence.filter(e => e.claimType === 'outcome' && e.claimId === item.id).length} supporting references</p>
      </details>
    }) : <EmptyAnalytics>The saved profile does not contain measurable project outcomes with sufficient context.</EmptyAnalytics>}
  </article>
}

interface Node { id: string; label: string; kind: string; description: string; url?: string | null }
interface Edge { from: string; to: string; label: string }
function Network({ nodes, edges, label }: { nodes: Node[]; edges: Edge[]; label: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const positions = new Map(nodes.map((node, index) => [node.id, { x: 240 + 165 * Math.cos(index / nodes.length * Math.PI * 2), y: 160 + 115 * Math.sin(index / nodes.length * Math.PI * 2) }]))
  const chosen = nodes.find(node => node.id === selected)
  return <>
    <svg className="analytics-plot" viewBox="0 0 480 320" role="img" aria-label={label}>
      {edges.map((edge, index) => {
        const from = positions.get(edge.from), to = positions.get(edge.to)
        return from && to ? <line key={index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#94a3b8" strokeWidth="2"><title>{edge.label}</title></line> : null
      })}
      {nodes.map(node => {
        const position = positions.get(node.id)!
        return <g key={node.id}><circle cx={position.x} cy={position.y} r="12" fill={node.kind === 'outcome' ? '#0f766e' : node.kind === 'artifact' ? '#7c3aed' : '#2563eb'} /><text x={position.x} y={position.y + 26} textAnchor="middle">{node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label}</text><title>{node.kind}: {node.label}</title></g>
      })}
    </svg>
    <div className="chart-selection">{nodes.map(node => <button type="button" key={node.id} aria-pressed={selected === node.id} onClick={() => setSelected(node.id)}>{node.kind}: {node.label}</button>)}</div>
    {chosen && <div className="chart-context" aria-live="polite"><strong>{chosen.label}</strong><p>{chosen.description}</p>{chosen.url && /^https?:\/\//i.test(chosen.url) && <a href={chosen.url} target="_blank" rel="noreferrer">Open supporting artifact</a>}</div>}
    <details className="analytics-details"><summary>Relationships ({edges.length})</summary><ul>{edges.map((edge, i) => <li key={i}>{nodes.find(n => n.id === edge.from)?.label} → {nodes.find(n => n.id === edge.to)?.label}: {edge.label}</li>)}</ul></details>
  </>
}

function Evidence({ data }: { data: AnalyticsData }) {
  const nodes: Node[] = [
    ...data.outcomes.map(item => ({ id: item.id, label: item.metric, kind: 'outcome', description: item.description })),
    ...data.decisions.map(item => ({ id: item.id, label: item.description, kind: 'decision', description: item.rationale || 'Rationale not supplied' })),
    ...data.artifacts.map(item => ({ id: item.id, label: item.title, kind: 'artifact', description: item.kind, url: item.url })),
  ]
  const edges = [...data.evidence.map(item => ({ from: item.artifactId, to: item.claimId, label: item.snippet })), ...data.decisions.flatMap(item => item.outcomeIds.map(id => ({ from: item.id, to: id, label: 'Reported contribution' })))]
  return <article className="analytics-card"><h3>Evidence trace graph</h3><p className="analytics-note">Outcomes (green), decisions (blue), and artifacts (purple). Lines show reported support or contribution, not verified causation. Select a node or read the relationship list.</p>{nodes.length ? <Network nodes={nodes} edges={edges} label="Evidence relationships" /> : <EmptyAnalytics>The saved profile does not specify outcomes, decisions, or supporting artifacts.</EmptyAnalytics>}</article>
}

function Collaboration({ data, profile }: { data: AnalyticsData; profile: PublicProfile }) {
  const groups = [...new Set(data.collaborations.map(item => item.collaborator))]
  const nodes: Node[] = [{ id: 'candidate', label: profile.fullName || 'Candidate', kind: 'candidate', description: 'Reported collaboration relationships.' }, ...groups.map((name, index) => ({ id: `team-${index}`, label: name, kind: 'team', description: data.collaborations.filter(item => item.collaborator === name).map(item => `${item.relationship}: ${item.description || ''} (${projectName(data, profile, item.projectId)})`).join('; ') }))]
  const edges = data.collaborations.map(item => ({ from: 'candidate', to: `team-${groups.indexOf(item.collaborator)}`, label: `${item.relationship} · ${projectName(data, profile, item.projectId)}` }))
  return <article className="analytics-card"><h3>Collaboration network</h3><p className="analytics-note">One node per reported team/collaborator. Equal node sizes and line widths avoid implying unrecorded strength or reporting hierarchy.</p>{groups.length ? <Network nodes={nodes} edges={edges} label="Candidate collaboration network" /> : <EmptyAnalytics>The saved profile does not specify project collaboration relationships.</EmptyAnalytics>}</article>
}

export default function CandidateAnalyticsCharts({ data, profile }: { data: AnalyticsData; profile: PublicProfile }) {
  return <><SkillHeatmap data={data} profile={profile} /><SkillScatter data={data} profile={profile} /><Impact data={data} profile={profile} /><Evidence data={data} /><Collaboration data={data} profile={profile} /></>
}
