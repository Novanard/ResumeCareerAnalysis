import { useState } from 'react'
import CandidateProfilePage from './pages/CandidateProfilePage'
import ResumeUploadPage from './pages/ResumeUploadPage'

type Page = 'upload' | 'profile'

function App() {
  const [page, setPage] = useState<Page>('upload')

  return page === 'upload' ? (
    <ResumeUploadPage onViewProfile={() => setPage('profile')} />
  ) : (
    <CandidateProfilePage onBackToUpload={() => setPage('upload')} />
  )
}

export default App
