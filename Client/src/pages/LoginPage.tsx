import { useState, type FormEvent } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import '../styles/login.css'

type RequestState = 'idle' | 'loading' | 'sent' | 'error'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [requestState, setRequestState] = useState<RequestState>('idle')
  const [message, setMessage] = useState('')

  async function signInWithProvider(provider: 'google' | 'azure') {
    if (!supabase) return

    setRequestState('loading')
    setMessage('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        ...(provider === 'azure' ? { scopes: 'email' } : {}),
      },
    })

    if (error) {
      setRequestState('error')
      setMessage(error.message)
    }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setRequestState('loading')
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setRequestState('error')
      setMessage(error.message)
      return
    }

    setRequestState('sent')
    setMessage('Check your email for the sign-in link.')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <span className="brand">Career Profile</span>
      </header>

      <main className="login-page">
        <section className="login-card" aria-labelledby="login-title">
          <p className="eyebrow">Welcome</p>
          <h1 id="login-title">Sign in to continue</h1>
          <p className="login-introduction">
            Access your resume upload and candidate profile.
          </p>

          {!isSupabaseConfigured && (
            <p className="auth-message auth-message-error" role="alert">
              Supabase frontend environment variables are not configured.
            </p>
          )}

          <div className="social-actions">
            <button
              type="button"
              disabled={!isSupabaseConfigured || requestState === 'loading'}
              onClick={() => signInWithProvider('google')}
            >
              Continue with Google
            </button>
            <button
              type="button"
              disabled={!isSupabaseConfigured || requestState === 'loading'}
              onClick={() => signInWithProvider('azure')}
            >
              Continue with Microsoft
            </button>
          </div>

          <div className="login-divider"><span>or use email</span></div>

          <form onSubmit={sendMagicLink}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <button
              className="primary-button"
              type="submit"
              disabled={!isSupabaseConfigured || requestState === 'loading'}
            >
              Email me a magic link
            </button>
          </form>

          {message && (
            <p
              className={`auth-message auth-message-${requestState}`}
              role={requestState === 'error' ? 'alert' : 'status'}
            >
              {message}
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

export default LoginPage
