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
  const [question, setQuestion] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef<AbortController | null>(null)
  useEffect(() => () => inFlight.current?.abort(), [])

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

  return <section className="question-card recruiter-questions" aria-labelledby="question-title">
    <h2 id="question-title">Ask about this candidate</h2>
    <p>AI answers use only the saved shared profile and may be incomplete.
      Ask a complete question; previous messages are not used as context.</p>
    <p>Your question and the shared profile are sent to our AI provider to generate an answer.</p>
    <div className="question-suggestions">
      {['What technologies has this candidate used?', 'What work experience is listed?'].map(text =>
        <button key={text} type="button" disabled={pending} onClick={() => setQuestion(text)}>{text}</button>)}
    </div>
    <ol className="question-transcript" aria-live="polite" aria-relevant="additions text">
      {exchanges.map((item, index) => <li key={index}>
        <p><strong>You:</strong> {item.question}</p>
        <p><strong>AI answer:</strong> {item.result.answer}</p>
        {item.result.status !== 'answered' && <p>{item.result.status === 'partial' ? 'Partially supported by the profile' : 'Information unavailable in the profile'}</p>}
        {item.result.sources.length > 0 && <p>Sources: {item.result.sources.map(source => labels[source]).join(', ')}</p>}
      </li>)}
    </ol>
    <form onSubmit={submit}>
      <label htmlFor="candidate-question">Your question</label>
      <textarea id="candidate-question" rows={4} maxLength={1000} value={question}
        disabled={pending} onChange={event => setQuestion(event.target.value)}
        aria-describedby="question-help" />
      <small id="question-help">{question.length}/1,000 characters. This conversation clears when you refresh or leave.</small>
      <button type="submit" disabled={pending || !question.trim() || question.trim().length > 1000}>
        {pending ? 'Generating answer...' : 'Ask candidate profile'}
      </button>
    </form>
    <p role="status">{pending ? 'Generating an answer from the shared profile...' : ''}</p>
    {error && <p role="alert">{error} Your question is kept above; select Ask candidate profile to retry.</p>}
    <button type="button" disabled={pending} onClick={() => { setExchanges([]); setQuestion(''); setError('') }}>New conversation</button>
  </section>
}
