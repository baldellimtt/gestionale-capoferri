import { useState } from 'react'

function Login({ onLogin, loading, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    // IMPORTANTE: Rimuovi spazi bianchi iniziali/finali per evitare problemi
    // Questo risolve il problema quando si copia/incolla la password con spazi
    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()
    
    // Verifica che username e password non siano vuoti dopo il trim
    if (!trimmedUsername || !trimmedPassword) {
      return // Il form HTML5 required dovrebbe già gestire questo, ma aggiungiamo un controllo extra
    }
    
    onLogin({ 
      username: trimmedUsername, 
      password: trimmedPassword 
    })
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-card-header">
          <h2>Accesso riservato</h2>
          <p>Inserisci le credenziali per continuare.</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="mb-3">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="lcapoferri"
              required
              autoComplete="username"
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="alert alert-warning mb-3">
              {error}
            </div>
          )}
          <button className="btn btn-primary w-100" type="submit" disabled={loading}>
            {loading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
