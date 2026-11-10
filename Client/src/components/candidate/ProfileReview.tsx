import { useEffect, useState } from 'react'
import ProfileSections from './ProfileSections'
import { updateRefinement, type ProfileDraft } from '../../services/api'
import type { CandidateProfile } from '../../types/candidate'

type Value = string | boolean | null | Value[] | { [key: string]: Value }
const templates: Record<string, Value> = {
  skills: { name: null, category: null },
  experience: { company: null, role: null, location: null, startDate: null, endDate: null, current: null, description: [] },
  education: { institution: null, degree: null, field: null, startDate: null, endDate: null, current: null, description: [] },
  projects: { name: null, description: null, technologies: [], url: null },
  languages: { language: null, level: null },
  certifications: { name: null, issuer: null, date: null, url: null },
  additionalSections: { title: null, items: [] },
  items: { heading: null, subheading: null, date: null, description: [] },
}
function label(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/^./, ch => ch.toUpperCase()) }
function ReadValue({ value }: { value: Value }) {
  if (value === null || value === '') return <span>Not provided</span>
  if (typeof value !== 'object') return <span>{String(value)}</span>
  if (Array.isArray(value)) return value.length ? <ul>{value.map((v, i) => <li key={i}><ReadValue value={v} /></li>)}</ul> : <span>None</span>
  return <dl>{Object.entries(value).map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd><ReadValue value={v} /></dd></div>)}</dl>
}
function EditValue({ name, value, onChange }: { name: string; value: Value; onChange: (v: Value) => void }) {
  if (Array.isArray(value)) return <fieldset className="profile-editor-group"><legend>{label(name)}</legend>
    {value.map((item, index) => <div className="profile-editor-item" key={index}>
      <EditValue name={name === 'description' || name === 'technologies' ? 'Text' : `Entry ${index + 1}`} value={item}
        onChange={next => onChange(value.map((v, i) => i === index ? (typeof item === 'string' ? next ?? '' : next) : v))} />
      <button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove entry {index + 1}</button>
    </div>)}
    <button type="button" onClick={() => onChange([...value, structuredClone(templates[name] ?? '')])}>Add {label(name)}</button>
  </fieldset>
  if (value !== null && typeof value === 'object') return <fieldset className="profile-editor-group"><legend>{label(name)}</legend>
    {Object.entries(value).map(([key, item]) => <EditValue key={key} name={key} value={item}
      onChange={next => onChange({ ...value, [key]: next })} />)}
  </fieldset>
  if (name === 'current') return <label className="profile-editor-field">Currently ongoing
    <select value={value === null ? '' : String(value)} onChange={e => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
      <option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option>
    </select></label>
  return <label className="profile-editor-field">{label(name)}
    <textarea rows={name === 'summary' || name === 'description' ? 3 : 1} value={value === null ? '' : String(value)}
      onChange={e => onChange(e.target.value || null)} />
  </label>
}

export default function ProfileReview({ draft, accessToken, onUpdate, onDirty }: {
  draft: ProfileDraft; accessToken: string; onUpdate: (draft: ProfileDraft) => void; onDirty: (dirty: boolean) => void
}) {
  const [content, setContent] = useState<CandidateProfile>(() => structuredClone(draft.content))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = JSON.stringify(content) !== JSON.stringify(draft.content)
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  async function act(action: string, input: Record<string, unknown> = {}) {
    setBusy(true); setError('')
    try { onUpdate(await updateRefinement(draft.id, action, accessToken, { revision: draft.revision, ...input })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update profile.') }
    finally { setBusy(false) }
  }
  const fields = Object.entries(content).filter(([key]) => !['schemaVersion', 'rawMetadata'].includes(key))
  return <section className="profile-section profile-review" aria-labelledby="review-title">
    <h2 id="review-title">{draft.state === 'saved' ? 'Saved profile' : 'Review and edit your profile'}</h2>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Working...</p>}
    {draft.state === 'saved' ? <>
      <div className="saved-profile-toolbar"><p role="status">Your approved profile is saved.</p>
        <button className="primary-button" disabled={busy} type="button" onClick={() => act('reopen')}>Edit saved profile</button></div>
      <ProfileSections profile={content} />
    </> : <>
      <p>Check every section. You can change wording, add entries, or remove information. Dates must use YYYY or YYYY-MM.</p>
      <fieldset disabled={busy} className="followup-controls">
        {fields.map(([key, value]) => <details className="profile-edit-section" key={key}>
          <summary>{label(key)}<span>Edit section</span></summary>
          {draft.review_baseline && JSON.stringify(value) !== JSON.stringify(draft.review_baseline[key as keyof CandidateProfile]) &&
            <details className="profile-change"><summary>{label(key)} changed - view before and after</summary>
              <h4>Before polishing</h4><ReadValue value={draft.review_baseline[key as keyof CandidateProfile] as Value} />
              <h4>Current</h4><ReadValue value={value as Value} />
            </details>}
          <EditValue name={key} value={value as Value} onChange={next => setContent({ ...content, [key]: next })} />
        </details>)}
        {dirty && <p role="status">You have unsaved edits. Save draft edits before approving the final profile.</p>}
        <button type="button" disabled={!dirty} onClick={() => act('edit', { content })}>Save draft edits</button>
        <button type="button" disabled={dirty} onClick={() => act('polish')}>Polish again with AI</button>
        {draft.proposal && <button type="button" disabled={dirty} onClick={() => act('reject')}>Reject AI changes and restore prior draft</button>}
        <button type="button" disabled={dirty} onClick={() => act('finish', { finished: false })}>Return to questions</button>
        <p>By selecting Approve and save final profile, you confirm the current content. This does not enable sharing.</p>
        <button className="primary-button" type="button" disabled={dirty} onClick={() => act('save', { approved: true })}>Approve and save final profile</button>
      </fieldset>
    </>}
  </section>
}
