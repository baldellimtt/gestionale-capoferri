import { useState, useEffect } from 'react'
import './App.css'
import AnagraficaClienti from './components/AnagraficaClienti'
import TabellaAttivita from './components/TabellaAttivita'
import Login from './components/Login'
import ImpostazioniUtenti from './components/ImpostazioniUtenti'
import api from './services/api'

function App() {
  const [activeView, setActiveView] = useState('attivita')
  const [clienti, setClienti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState(null)

  // Verifica autenticazione
  useEffect(() => {
    const checkAuth = async () => {
      if (!api.getToken()) {
        setAuthChecking(false)
        return
      }

      try {
        const me = await api.me()
        setUser(me)
      } catch (err) {
        api.setToken(null)
      } finally {
        setAuthChecking(false)
      }
    }

    checkAuth()
  }, [])

  // Carica clienti dal server quando autenticato
  useEffect(() => {
    if (user) {
      loadClienti()
    }
  }, [user])

  const loadClienti = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getClienti()
      setClienti(data)
    } catch (err) {
      console.error('Errore caricamento clienti:', err)
      if (err.status === 401) {
        setUser(null)
        api.setToken(null)
        setAuthError('Sessione scaduta. Effettua nuovamente l’accesso.')
      } else {
        setError('Errore nel caricamento dei clienti. Verifica che il server sia avviato.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Aggiorna clienti (ricarica dal server)
  const updateClienti = async () => {
    await loadClienti()
  }

  const handleLogin = async (credentials) => {
    try {
      setAuthLoading(true)
      setAuthError(null)
      const data = await api.login(credentials)
      setUser(data.user)
    } catch (err) {
      setAuthError('Credenziali non valide. Riprova.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await api.logout()
    setUser(null)
    setClienti([])
    setActiveView('attivita')
  }

  const handleUserUpdated = (updated) => {
    setUser((prev) => ({
      ...(prev || {}),
      ...updated,
    }))
  }

  return (
    <div className="app container-fluid py-3">
      <header>
        <img
          src="/logo-studio-ingegneria-removebg-preview.png"
          alt="Studio Capoferri"
          className="logo"
          onError={(e) => {
            // Fallback se il logo non è disponibile
            e.target.style.display = 'none'
          }}
        />
        <div className="header-title">
          <h1>Gestionale Studio Capoferri</h1>
          {user && (
            <span className="header-sub">Benvenuto, {user.username} ({user.role})</span>
          )}
        </div>
        {user && user.role === 'admin' && (
          <button
            className="btn btn-secondary btn-sm ms-auto"
            onClick={() => setActiveView('utenti')}
          >
            Gestione Utenti
          </button>
        )}
        {user && (
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Logout
          </button>
        )}
      </header>

      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      {authChecking ? (
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Caricamento...</span>
          </div>
        </div>
      ) : user ? (
        <div className="row g-3">
          <div className="col-md-3">
            <aside className="sidebar">
              <nav>
                <ul className="sidebar-nav">
                  <li>
                    <a
                      href="#attivita"
                      className={activeView === 'attivita' ? 'active' : ''}
                      onClick={(e) => {
                        e.preventDefault()
                        setActiveView('attivita')
                      }}
                    >
                      Attività
                    </a>
                  </li>
                  <li>
                  <a 
                    href="#anagrafica" 
                    className={activeView === 'anagrafica' ? 'active' : ''}
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveView('anagrafica')
                    }}
                  >
                    Anagrafica Clienti
                  </a>
                </li>
              </ul>
            </nav>
          </aside>
          </div>

          <div className="col-md-9">
            <main className="content-area">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Caricamento...</span>
                  </div>
                </div>
              ) : (
                <>
                {activeView === 'attivita' && (
                  <TabellaAttivita clienti={clienti} user={user} />
                )}
                {activeView === 'anagrafica' && (
                  <AnagraficaClienti
                    clienti={clienti}
                    onUpdateClienti={updateClienti}
                    onBack={() => setActiveView('attivita')}
                  />
                )}
                {activeView === 'utenti' && user?.role === 'admin' && (
                  <ImpostazioniUtenti
                    currentUser={user}
                    onUserUpdated={handleUserUpdated}
                    onBack={() => setActiveView('attivita')}
                  />
                )}
                </>
              )}
            </main>
          </div>
        </div>
      ) : (
        <Login onLogin={handleLogin} loading={authLoading} error={authError} />
      )}
    </div>
  )
}

export default App
