import { useEffect, useState } from 'react'
import { updateRefinement, type ProfileDraft } from '../../services/api'

export default function ProfileFollowupQuestions({ draft, accessToken, onUpdate, onDirty }: {
  draft: ProfileDraft; accessToken: string; onUpdate: (draft: ProfileDraft) => void; onDirty: (dirty: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const questions = draft.questions || []
  const current = questions.find(q => q.id === editing) || questions.find(q => q.status === 'pending')
  const hasUnsavedAnswer = Object.entries(answers).some(([id, answer]) => {
    const saved = questions.find(q => q.id === id)
    return saved && answer !== (saved.answer ?? '')
  })
  useEffect(() => { onDirty(hasUnsavedAnswer); return () => onDirty(false) }, [hasUnsavedAnswer, onDirty])
  useEffect(() => {
    if (!hasUnsavedAnswer) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasUnsavedAnswer])
  async function act(action: string, input: Record<string, unknown> = {}) {
    setBusy(true); setError('')
    try {
      onUpdate(await updateRefinement(draft.id, action, accessToken, { revision: draft.revision, ...input }))
      if (action.startsWith('questions/')) {
        const id = action.slice('questions/'.length)
        setAnswers(previous => { const next = { ...previous }; delete next[id]; return next })
      }
      setEditing(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save progress.')
    } finally { setBusy(false) }
  }
  return <aside className="question-card" aria-labelledby="followup-title">
    <h2 id="followup-title">Improve your profile</h2>
    <p>Answer a few optional questions to clarify your experience. Answers are saved privately.</p>
    {error && <p role="alert">{error}</p>}
    {hasUnsavedAnswer && <p role="status">You have unsaved answer text. Use Save answer before leaving.</p>}
    {busy && <p role="status">Working...</p>}
    <fieldset disabled={busy} className="followup-controls">
      {!draft.questions_generated && !draft.questions_finished &&
        <button type="button" onClick={() => act('questions')}>Generate follow-up questions</button>}
      {!draft.questions_finished && current && <div>
        <p><strong>{current.section}</strong></p>
        <label htmlFor="followup-answer">{current.text}</label>
        <p>{current.reason}</p>
        <textarea id="followup-answer" rows={5} maxLength={5000}
          value={answers[current.id] ?? current.answer ?? ''}
          onChange={event => setAnswers({ ...answers, [current.id]: event.target.value })} />
        <button type="button" disabled={!(answers[current.id] ?? current.answer ?? '').trim()}
          onClick={() => act(`questions/${current.id}`, { status: 'answered', answer: answers[current.id] ?? current.answer })}>
          Save answer
        </button>
        <button type="button" onClick={() => act(`questions/${current.id}`, { status: 'skipped' })}>Skip</button>
      </div>}
      {!draft.questions_finished && draft.questions_generated && !current &&
        <p>No more questions. You can revise an answer below or finish.</p>}
      {questions.filter(q => q.status !== 'pending').map(q => <div key={q.id}>
        <p>{q.text}</p><p>{q.status === 'skipped' ? 'Skipped' : q.answer}</p>
        {!draft.questions_finished && <button type="button" onClick={() => setEditing(q.id)}>Revise</button>}
      </div>)}
      {draft.questions_finished ? <div>
        <p>Your answers are saved. Generate a polished proposal or review the current profile without AI changes.</p>
        <button type="button" onClick={() => act('polish')}>Generate polished profile</button>
        <button type="button" onClick={() => act('review')}>Review and edit without polishing</button>
        <button type="button" onClick={() => act('finish', { finished: false })}>Resume questions</button>
      </div> : <button type="button" disabled={hasUnsavedAnswer} onClick={() => act('finish', { finished: true })}>Finish questions for now</button>}
    </fieldset>
    <small>Your answers do not change the profile until the polishing and review stage.</small>
  </aside>
}
