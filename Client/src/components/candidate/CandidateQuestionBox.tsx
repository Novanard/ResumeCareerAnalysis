interface CandidateQuestionBoxProps {
  candidateName: string
}

function CandidateQuestionBox({ candidateName }: CandidateQuestionBoxProps) {
  const firstName = candidateName.split(' ')[0]

  return (
    <aside className="question-card" aria-labelledby="question-title">
      <h2 id="question-title">Ask about {firstName}</h2>
      <p>This will let recruiters ask questions about the candidate.</p>
      <label htmlFor="candidate-question">Your question</label>
      <textarea
        id="candidate-question"
        placeholder={`What experience does ${firstName} have with React?`}
        rows={4}
      />
      <button type="button" disabled>Ask candidate profile</button>
      <small>Coming in a later step</small>
    </aside>
  )
}

export default CandidateQuestionBox
