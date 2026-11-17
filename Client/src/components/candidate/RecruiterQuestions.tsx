import { useEffect, useRef, useState, type FormEvent } from 'react'
import { askCandidateQuestion, SharedProfileError, type CandidateAnswer, type PublicProfile } from '../../services/api'

const labels: Record<Exclude<keyof PublicProfile, 'schemaVersion'>, string> = {
  fullName: 'Name', headline: 'Headline', summary: 'Summary', contact: 'Contact details',
  skills: 'Skills', experience: 'Experience', education: 'Education', projects: 'Projects',
  languages: 'Languages', certifications: 'Certifications', additionalSections: 'Additional information',
}
interface Props {
  token: string
  profileRevision: number
  onUnavailable: () => void
  onRefresh: () => Promise<number>
}
interface Exchange { question: string; result: CandidateAnswer }

export default function RecruiterQuestions({ token, profileRevision, onUnavailable, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDialogElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const transcript = useRef<HTMLOListElement | null>(null)
  const [question, setQuestion] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef<AbortController | null>(null)
  useEffect(() => () => inFlight.current?.abort(), [])
  useEffect(() => {
    const dialog = panel.current
    if (!dialog) return
    if (!open) { dialog.close(); return }
    const mobile = window.matchMedia('(max-width: 1000px)')
    function show() {
      if (!dialog) return
      dialog.close()
      if (mobile.matches) dialog.showModal()
      else dialog.show()
    }
    show()
    mobile.addEventListener('change', show)
    return () => { mobile.removeEventListener('change', show); dialog.close() }
  }, [open])
  useEffect(() => {
    if (open && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [open, exchanges, pending])

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const submitted = question.trim()
    if (inFlight.current || !submitted || submitted.length > 1000) return
    const controller = new AbortController()
    inFlight.current = controller
    setPending(true)
    setError('')
    try {
      const result = await askCandidateQuestion(token, submitted, controller.signal)
      let revision = profileRevision
      if (result.profileRevision !== revision) {
        setExchanges([])
        revision = await onRefresh()
      }
      if (controller.signal.aborted) return
      if (result.profileRevision !== revision) {
        setError('The profile changed again. Please submit your question against the updated profile.')
        return
      }
      setExchanges(previous => [...previous.filter(item => item.result.profileRevision === result.profileRevision), { question: submitted, result }])
      setQuestion('')
    } catch (reason) {
      if (controller.signal.aborted) return
      if (reason instanceof SharedProfileError && reason.status === 404) {
        setExchanges([])
        onUnavailable()
      } else if (reason instanceof SharedProfileError && reason.status === 409) {
        setExchanges([])
        try {
          await onRefresh()
          if (!controller.signal.aborted) setError('The profile changed. Review the updated profile and submit your question again.')
        } catch (refreshError) {
          if (refreshError instanceof SharedProfileError && refreshError.status === 404) onUnavailable()
          else if (!controller.signal.aborted) setError('Unable to reload the updated profile. Refresh this page before retrying.')
        }
      } else setError(reason instanceof Error ? reason.message : 'Unable to answer. Please try again.')
    } finally {
      if (!controller.signal.aborted) setPending(false)
      inFlight.current = null
    }
  }

  return <div className="recruiter-entry">
    <button ref={trigger} className="qa-launcher" type="button" aria-expanded={open}
      aria-controls="recruiter-panel" onClick={() => open ? close() : setOpen(true)}>
      <span aria-hidden="true">✦</span> Ask about this candidate
    </button>
    <p>Explore their experience, projects, and skills with AI.</p>
    <dialog ref={panel} id="recruiter-panel" className="question-card qa-panel" aria-labelledby="question-title"
      onCancel={event => { event.preventDefault(); close() }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); return }
        if (event.key !== 'Tab' || !event.currentTarget.matches(':modal')) return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), summary, a[href], [tabindex="0"]',
        )).filter(element => element.getClientRects().length > 0)
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
    <header className="qa-panel-header">
      <div><p className="eyebrow">Profile assistant</p><h2 id="question-title">Ask about this candidate</h2></div>
      <button type="button" className="qa-close" aria-label="Close questions" onClick={close}>×</button>
    </header>
    <div className="qa-introduction">
    <p>AI answers use only the saved shared profile and may be incomplete.
      Ask a complete question; previous messages are not used as context.</p>
    <details><summary>About these answers</summary><p>Your question and the shared profile are sent to our AI provider to generate an answer. This conversation clears when you refresh or leave.</p></details>
    <div className="question-suggestions">
      {['What technologies has this candidate used?', 'What work experience is listed?'].map(text =>
        <button key={text} type="button" disabled={pending} onClick={() => setQuestion(text)}>{text}</button>)}
    </div>
    </div>
    {exchanges.length === 0 && <p className="qa-empty">What would you like to know? Choose a suggestion or ask a complete question below.</p>}
    <ol ref={transcript} className="question-transcript" aria-live="polite" aria-relevant="additions text">
      {exchanges.map((item, index) => <li key={index}>
        <p><strong>You:</strong> {item.question}</p>
        <p><strong>AI answer:</strong> {item.result.answer}</p>
        {item.result.status !== 'answered' && <p>{item.result.status === 'partial' ? 'Partially supported by the profile' : 'Information unavailable in the profile'}</p>}
        {item.result.sources.length > 0 && <p>Sources: {item.result.sources.map(source => labels[source]).join(', ')}</p>}
      </li>)}
    </ol>
    <div className="qa-composer">
    <form onSubmit={submit}>
      <label htmlFor="candidate-question">Your question</label>
      <textarea id="candidate-question" rows={3} maxLength={1000} value={question}
        disabled={pending} onChange={event => setQuestion(event.target.value)}
        aria-describedby="question-help" />
      <small id="question-help">{question.length}/1,000 characters</small>
      <button type="submit" disabled={pending || !question.trim() || question.trim().length > 1000}>
        {pending ? 'Generating answer...' : 'Ask candidate profile'}
      </button>
    </form>
    <p role="status">{pending ? 'Generating an answer from the shared profile...' : ''}</p>
    {error && <p role="alert">{error} Your question is kept above; select Ask candidate profile to retry.</p>}
    <button type="button" disabled={pending} onClick={() => { setExchanges([]); setQuestion(''); setError('') }}>New conversation</button>
    </div>
  </dialog>
  </div>
}
