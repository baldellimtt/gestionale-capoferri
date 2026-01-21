import { useState, useEffect, Suspense, lazy } from 'react'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import api from './services/api'
import { ToastContainer } from './components/Toast'
import { useToast } from './hooks/useToast'
import { AttivitaProvider } from './contexts/AttivitaContext'

// Lazy loading dei componenti principali per code splitting
const Login = lazy(() => import('./components/Login'))
const TabellaAttivita = lazy(() => import('./components/TabellaAttivita'))
const Commesse = lazy(() => import('./components/Commesse'))
const AnagraficaClienti = lazy(() => import('./components/AnagraficaClienti'))
const KanbanBoard = lazy(() => import('./components/KanbanBoard'))
const Home = lazy(() => import('./components/Home'))
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
  const [activeView, setActiveView] = useState('home')
  const [impostazioniView, setImpostazioniView] = useState(null)
  const [clienti, setClienti] = useState([])
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState(null)
  const toast = useToast()

  // Verifica autenticazione
  useEffect(() => {
    const checkAuth = async () => {
      if (!api.getToken()) {
        // Se non c'è token, resetta eventuali errori precedenti e mostra login
        setAuthError(null)
        setAuthChecking(false)
        return
      }

      try {
        const me = await api.me()
        setUser(me)
        setAuthError(null) // Reset errori se il login è riuscito
      } catch (err) {
        // Gestione errori specifica per rate limiting
        if (err.status === 429) {
          console.warn('Rate limit raggiunto per /auth/me:', err.retryAfter, 'secondi')
          // Non fare logout, solo mostra errore e usa cache se disponibile
          setAuthError(`Troppe richieste. Riprova tra ${err.retryAfter} secondi.`)
        } else if (err.status === 401) {
          // Per errori 401 (token scaduto o non valido), pulisci token e non mostrare errore
          // perché l'utente può semplicemente fare login di nuovo
          api.setToken(null)
          setAuthError(null) // Non mostrare errore se il token è scaduto/invalido
        } else {
          // Per altri errori, mostra un messaggio generico
          setAuthError('Errore di connessione. Riprova.')
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
      setAuthError(null) // Reset errori se il login è riuscito
    } catch (err) {
      console.error('Errore login:', err)
      // Mostra messaggi di errore più specifici
      if (err.status === 401) {
        setAuthError('Credenziali non valide. Riprova.')
      } else if (err.status === 429) {
        setAuthError(`Troppe richieste. Riprova tra ${err.retryAfter || 60} secondi.`)
      } else if (err.message && err.message.includes('fetch')) {
        setAuthError('Errore di connessione. Verifica che il server sia avviato.')
      } else {
        setAuthError(err.message || 'Errore durante il login. Riprova.')
      }
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
      setActiveView('home')
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
            onClick={() => setActiveView('home')}
            style={{ cursor: 'pointer' }}
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
          {user && (
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
              {user.role === 'admin' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setActiveView('impostazioni')
                    setImpostazioniView(null)
                  }}
                >
                  Impostazioni
                </button>
              )}
              <button 
                className="btn btn-secondary" 
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
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
          <div className="app-layout">
            <nav className="topbar-nav">
              <button
                className={`topbar-link ${activeView === 'anagrafica' ? 'active' : ''}`}
                onClick={() => setActiveView('anagrafica')}
                type="button"
              >
                Anagrafica
              </button>
              <button
                className={`topbar-link ${activeView === 'commesse' ? 'active' : ''}`}
                onClick={() => setActiveView('commesse')}
                type="button"
              >
                Commesse
              </button>
              <button
                className={`topbar-link ${activeView === 'kanban' ? 'active' : ''}`}
                onClick={() => setActiveView('kanban')}
                type="button"
              >
                Kanban
              </button>
              <button
                className={`topbar-link ${activeView === 'attivita' ? 'active' : ''}`}
                onClick={() => setActiveView('attivita')}
                type="button"
              >
                Rimborsi
              </button>
            </nav>
            <div className="content-col">
              <main className="content-area">
                {loading ? (
                  <LoadingFallback />
                ) : (
                  <AttivitaProvider>
                    <Suspense fallback={<LoadingFallback />}>
                      {activeView === 'home' && (
                        <Home key="home" clienti={clienti} user={user} toast={toast} />
                      )}
                      {activeView === 'attivita' && (
                        <TabellaAttivita key="attivita" clienti={clienti} user={user} toast={toast} />
                      )}
                      {activeView === 'commesse' && (
                        <Commesse clienti={clienti} toast={toast} />
                      )}
                      {activeView === 'anagrafica' && (
                        <AnagraficaClienti
                          clienti={clienti}
                          onUpdateClienti={updateClienti}
                          onBack={() => setActiveView('home')}
                          currentUser={user}
                          toast={toast}
                        />
                      )}
                      {activeView === 'kanban' && (
                        <KanbanBoard clienti={clienti} user={user} toast={toast} />
                      )}
                      {activeView === 'impostazioni' && user?.role === 'admin' && (
                        <>
                          {!impostazioniView && (
                            <Impostazioni
                              onNavigate={(view) => setImpostazioniView(view)}
                              onBack={() => setActiveView('home')}
                            />
                          )}
                          {impostazioniView === 'utenti' && (
                            <ImpostazioniUtenti
                              currentUser={user}
                              onUserUpdated={handleUserUpdated}
                              onBack={() => setImpostazioniView(null)}
                              toast={toast}
                            />
                          )}
                          {impostazioniView === 'dati-aziendali' && (
                            <DatiAziendali
                              onBack={() => setImpostazioniView(null)}
                              toast={toast}
                            />
                          )}
                          {impostazioniView === 'dati-fiscali' && (
                            <DatiFiscali
                              onBack={() => setImpostazioniView(null)}
                              toast={toast}
                            />
                          )}
                        </>
                      )}
                    </Suspense>
                  </AttivitaProvider>
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
      <ToastContainer 
        toasts={toast.toasts} 
        removeToast={toast.removeToast}
        key="toast-container"
      />
    </ErrorBoundary>
  )
}

export default App
