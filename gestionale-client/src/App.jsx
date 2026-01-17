import { useState, useEffect } from 'react'
import './App.css'
import AnagraficaClienti from './components/AnagraficaClienti'
import TabellaAttivita from './components/TabellaAttivita'
import api from './services/api'

function App() {
  const [activeView, setActiveView] = useState('attivita')
  const [clienti, setClienti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Carica clienti dal server
  useEffect(() => {
    loadClienti()
  }, [])

  const loadClienti = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getClienti()
      setClienti(data)
    } catch (err) {
      console.error('Errore caricamento clienti:', err)
      setError('Errore nel caricamento dei clienti. Verifica che il server sia avviato.')
    } finally {
      setLoading(false)
    }
  }

  // Aggiorna clienti (ricarica dal server)
  const updateClienti = async () => {
    await loadClienti()
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
        <h1>Gestionale Studio Capoferri</h1>
      </header>

      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

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
                <TabellaAttivita clienti={clienti} />
              )}
              {activeView === 'anagrafica' && (
                <AnagraficaClienti 
                  clienti={clienti} 
                  onUpdateClienti={updateClienti}
                  onBack={() => setActiveView('attivita')}
                />
              )}
            </>
          )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default App

