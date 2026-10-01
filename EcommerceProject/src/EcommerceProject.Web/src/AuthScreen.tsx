import { FormEvent, useState } from 'react'
import { api, saveSession } from './lib/api'

type AuthScreenProps = { onAuthenticated: () => void; onDemo: () => void }

export default function AuthScreen({ onAuthenticated, onDemo }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const session = mode === 'login'
        ? await api.login({ email, password })
        : await api.register({ email, password, firstName, lastName })
      saveSession(session)
      onAuthenticated()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not complete that request.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-shell">
    <section className="auth-visual">
      <div className="auth-brand"><span className="brand-mark">e</span><span>Ecommerce<span className="brand-light">Project</span></span></div>
      <div className="auth-message"><p className="eyebrow">Your commerce workspace</p><h1>Make every store day feel a little easier.</h1><p>Bring products, orders, customers, and momentum into one calm, focused workspace.</p><div className="auth-mini-chart"><span /><span /><span /><span /><span /><span /><span /></div><small>Built for productive merchant teams</small></div>
    </section>
    <section className="auth-card-wrap"><div className="auth-card">
      <div className="auth-heading"><p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Start selling'}</p><h2>{mode === 'login' ? 'Sign in to your store' : 'Create your merchant account'}</h2><p>{mode === 'login' ? 'Use your account details to continue.' : 'Set up your workspace in less than a minute.'}</p></div>
      <div className="auth-tabs"><button className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('login'); setError('') }}>Sign in</button><button className={mode === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setMode('register'); setError('') }}>Create account</button></div>
      <form onSubmit={submit}>
        {mode === 'register' && <div className="form-row"><label>First name<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Jordan" /></label><label>Last name<input required value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Davis" /></label></div>}
        <label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@yourstore.com" autoComplete="email" /></label>
        <label>Password<input required type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        {mode === 'register' && <p className="password-hint">Use 12+ characters with a number, uppercase letter, and symbol.</p>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button>
      </form>
      <button className="demo-link" onClick={onDemo}>Preview the dashboard with sample data</button>
      <p className="auth-footer">By continuing, you agree to use Ecommerce Project for legitimate commerce operations.</p>
    </div></section>
  </main>
}
