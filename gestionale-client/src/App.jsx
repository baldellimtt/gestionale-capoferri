import { useState, useEffect, Suspense, lazy } from 'react'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import api from './services/api'

// Lazy loading dei componenti principali per code splitting
const Login = lazy(() => import('./components/Login'))
const TabellaAttivita = lazy(() => import('./components/TabellaAttivita'))
const Commesse = lazy(() => import('./components/Commesse'))
const AnagraficaClienti = lazy(() => import('./components/AnagraficaClienti'))
const KanbanBoard = lazy(() => import('./components/KanbanBoard'))
const Impostazioni = lazy(() => import('./components/Impostazioni'))
const ImpostazioniUtenti = lazy(() => import('./components/ImpostazioniUtenti'))
const DatiAziendali = lazy(() => import('./components/DatiAziendali'))
const DatiFiscali = lazy(() => import('./components/DatiFiscali'))

// Componente di loading per Suspense
const LoadingFallback = () => (
  <div className="text-center py-5">
    <div className="spinner-border" role="status">
      <span className="visually-hidden">Caricamento...</span>
    </div>
  </div>
)

function App() {
  const [activeView, setActiveView] = useState('attivita')
  const [impostazioniView, setImpostazioniView] = useState(null)
  const [clienti, setClienti] = useState([])
  const [utenti, setUtenti] = useState([])
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
        // Gestione errori specifica per rate limiting
        if (err.status === 429) {
          console.warn('Rate limit raggiunto per /auth/me:', err.retryAfter, 'secondi')
          // Non fare logout, solo mostra errore e usa cache se disponibile
          setAuthError(`Troppe richieste. Riprova tra ${err.retryAfter} secondi.`)
        }
        // Per altri errori (401, etc.), pulisci token
        if (err.status === 401) {
          api.setToken(null)
        }
      } finally {
        setAuthChecking(false)
      }
    }

    checkAuth()
  }, [])

  // Carica clienti e utenti dal server quando autenticato
  useEffect(() => {
    if (user) {
      loadClienti()
      loadUtenti()
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

  const loadUtenti = async () => {
    try {
      const data = await api.getUtenti()
      setUtenti(data || [])
    } catch (err) {
      console.error('Errore caricamento utenti:', err)
      setUtenti([])
    }
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
    try {
      await api.logout()
    } catch (err) {
      // Ignora errori di logout, pulisci comunque lo stato locale
      console.error('Errore durante logout:', err)
    } finally {
      api.clearTokens()
      setUser(null)
      setClienti([])
      setActiveView('attivita')
    }
  }

  const handleUserUpdated = (updated) => {
    setUser((prev) => ({
      ...(prev || {}),
      ...updated,
    }))
  }

  return (
    <ErrorBoundary>
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
              onClick={() => {
                setActiveView('impostazioni')
                setImpostazioniView(null)
              }}
            >
              Impostazioni
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
          <LoadingFallback />
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
                        Rimborsi
                      </a>
                    </li>
                    <li>
                      <a
                        href="#commesse"
                        className={activeView === 'commesse' ? 'active' : ''}
                        onClick={(e) => {
                          e.preventDefault()
                          setActiveView('commesse')
                        }}
                      >
                        Commesse
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
                    <li>
                      <a 
                        href="#kanban" 
                        className={activeView === 'kanban' ? 'active' : ''}
                        onClick={(e) => {
                          e.preventDefault()
                          setActiveView('kanban')
                        }}
                      >
                        Kanban
                      </a>
                    </li>
                  </ul>
              </nav>
            </aside>
            </div>

            <div className="col-md-9">
              <main className="content-area">
                {loading ? (
                  <LoadingFallback />
                ) : (
                  <Suspense fallback={<LoadingFallback />}>
                    {activeView === 'attivita' && (
                      <TabellaAttivita clienti={clienti} user={user} />
                    )}
                    {activeView === 'commesse' && (
                      <Commesse clienti={clienti} />
                    )}
                    {activeView === 'anagrafica' && (
                      <AnagraficaClienti
                        clienti={clienti}
                        onUpdateClienti={updateClienti}
                        onBack={() => setActiveView('attivita')}
                      />
                    )}
                    {activeView === 'kanban' && (
                      <KanbanBoard clienti={clienti} user={user} />
                    )}
                    {activeView === 'impostazioni' && user?.role === 'admin' && (
                      <>
                        {!impostazioniView && (
                          <Impostazioni
                            onNavigate={(view) => setImpostazioniView(view)}
                            onBack={() => setActiveView('attivita')}
                          />
                        )}
                        {impostazioniView === 'utenti' && (
                          <ImpostazioniUtenti
                            currentUser={user}
                            onUserUpdated={handleUserUpdated}
                            onBack={() => setImpostazioniView(null)}
                          />
                        )}
                        {impostazioniView === 'dati-aziendali' && (
                          <DatiAziendali
                            onBack={() => setImpostazioniView(null)}
                          />
                        )}
                        {impostazioniView === 'dati-fiscali' && (
                          <DatiFiscali
                            onBack={() => setImpostazioniView(null)}
                          />
                        )}
                      </>
                    )}
                  </Suspense>
                )}
              </main>
            </div>
          </div>
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <Login onLogin={handleLogin} loading={authLoading} error={authError} />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
