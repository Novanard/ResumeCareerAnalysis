import { useState, type ChangeEvent } from 'react'
import '../styles/resume-upload.css'

interface ResumeUploadPageProps {
  onViewProfile: () => void
  onSignOut: () => void
}

type FileStatus =
  | { type: 'idle'; message: string }
  | { type: 'valid'; message: string }
  | { type: 'error'; message: string }
  | { type: 'pending'; message: string }

const acceptedExtensions = ['pdf', 'docx']

function ResumeUploadPage({ onViewProfile, onSignOut }: ResumeUploadPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<FileStatus>({
    type: 'idle',
    message: 'No file selected.',
  })

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      setSelectedFile(null)
      setStatus({ type: 'idle', message: 'No file selected.' })
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase()

    if (!extension || !acceptedExtensions.includes(extension)) {
      setSelectedFile(null)
      setStatus({ type: 'error', message: 'Please select a PDF or DOCX file.' })
      event.target.value = ''
      return
    }

    setSelectedFile(file)
    setStatus({ type: 'valid', message: `${file.name} is ready.` })
  }

  function handleUpload() {
    if (!selectedFile) return

    setStatus({
      type: 'pending',
      message: 'File validated. Backend upload will be connected in the next step.',
    })
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <span className="brand">Career Profile</span>
        <div className="header-actions">
          <button className="header-link" type="button" onClick={onViewProfile}>
            View profile preview
          </button>
          <button className="header-link" type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="upload-page">
        <p className="eyebrow">Resume analysis</p>
        <h1>Upload your resume</h1>
        <p className="upload-introduction">
          Choose your resume to begin building your candidate profile.
        </p>

        <section className="upload-card" aria-labelledby="resume-file-title">
          <h2 id="resume-file-title">Resume file</h2>
          <p>Supported formats: PDF and DOCX.</p>

          <label className="file-label" htmlFor="resume-file">Choose a file</label>
          <input
            id="resume-file"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
          />

          <p className={`file-status file-status-${status.type}`} role="status">
            {status.message}
          </p>

          <button
            className="primary-button"
            type="button"
            disabled={!selectedFile}
            onClick={handleUpload}
          >
            Upload resume
          </button>
        </section>
      </main>
    </div>
  )
}

export default ResumeUploadPage
