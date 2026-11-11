import { useEffect, useState } from 'react'
import { manageSharing, type SharingStatus } from '../../services/api'

export default function ProfileSharing({ accessToken, revision, canEnable }: { accessToken: string; revision: number; canEnable: boolean }) {
  const [status, setStatus] = useState<SharingStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    manageSharing(accessToken).then(value => { if (active) { setStatus(value); setError('') } })
      .catch((reason: Error) => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [accessToken, revision, attempt])
  async function change(action: 'enable' | 'disable') {
    setBusy(true); setError(''); setMessage('')
    try { setStatus(await manageSharing(accessToken, action)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update sharing.') }
    finally { setBusy(false) }
  }
  async function copy() {
    if (!status?.url) return
    setBusy(true)
    try { await navigator.clipboard.writeText(status.url); setMessage('Link copied.') }
    catch { setMessage('Copy failed. Select the link below and copy it manually.') }
    finally { setBusy(false) }
  }
  return <section className="sharing-card" aria-labelledby="sharing-heading" aria-busy={loading || busy}>
    <div className="sharing-heading-row">
      <div className="sharing-title">
        <span className="sharing-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)" /></svg>
        </span>
        <div><h2 id="sharing-heading">Share your profile</h2><p>One link to introduce yourself to recruiters.</p></div>
      </div>
      <span className={`sharing-badge${status?.enabled ? ' is-enabled' : ''}`} role="status">
        <span aria-hidden="true" />{loading ? 'Checking status' : status?.enabled ? 'Link active' : status ? 'Private' : 'Unavailable'}
      </span>
    </div>
    <p className="sharing-description">Anyone with your link can view your saved profile, including contact details. Your private draft stays visible only to you.</p>
    {!canEnable && <p className="sharing-hint">Save your profile before enabling sharing.</p>}
    {status?.url && <div className="sharing-link-group">
      <label htmlFor="share-url">Your profile link</label>
      <div className="sharing-link-row">
        <input id="share-url" readOnly value={status.url} onFocus={event => event.target.select()} />
        <button className="primary-button sharing-copy" type="button" disabled={busy || loading} onClick={copy}>Copy link</button>
      </div>
    </div>}
    <div className="sharing-actions">
      {status?.url && <a className="sharing-preview" href={status.url} target="_blank" rel="noreferrer noopener">Preview shared profile <span aria-hidden="true">↗</span></a>}
      {status && <button className={status.enabled ? 'sharing-disable' : 'primary-button'} type="button" disabled={busy || loading || (!status.enabled && !canEnable)} onClick={() => change(status.enabled ? 'disable' : 'enable')}>
        {busy ? 'Please wait...' : status.enabled ? 'Disable link' : 'Enable sharing'}
      </button>}
      {error && <button className="primary-button" type="button" disabled={busy || loading} onClick={() => { setLoading(true); setError(''); setAttempt(value => value + 1) }}>Retry</button>}
    </div>
    {error && <p className="sharing-error" role="alert">{error}</p>}
    {message && <p className="sharing-feedback" role="status">{message}</p>}
    <details className="sharing-details">
      <summary>How sharing works</summary>
      <p>Anyone with the link can forward it without logging in. All saved sections and contact details are included. Later approved saves update the shared profile; private draft edits remain private.</p>
      <p>Disabling the link blocks future access. It cannot remove copies or screenshots someone has already saved.</p>
    </details>
  </section>
}
