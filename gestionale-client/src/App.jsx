import { useState, Suspense, lazy } from 'react'
import './App.css'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastContainer } from './components/Toast'
import { useToast } from './hooks/useToast'
import { AttivitaProvider } from './contexts/AttivitaContext'
import { useAuth } from './hooks/useAuth'
import { useAppData } from './hooks/useAppData'
import { usePresence } from './hooks/usePresence'
import AppHeader from './components/layout/AppHeader'
import TopbarNav from './components/layout/TopbarNav'
import AppLayout from './components/layout/AppLayout'

// Lazy loading dei componenti principali per code splitting
const Login = lazy(() => import('./components/Login'))
const TabellaAttivita = lazy(() => import('./components/TabellaAttivita'))
const Commesse = lazy(() => import('./components/Commesse'))
const Consuntivi = lazy(() => import('./components/Consuntivi'))
const AnagraficaClienti = lazy(() => import('./components/AnagraficaClienti'))
const KanbanBoard = lazy(() => import('./components/KanbanBoard'))
const TrackingOre = lazy(() => import('./components/TrackingOre'))
const Home = lazy(() => import('./components/Home'))
const Team = lazy(() => import('./components/Team'))
const DatiAziendali = lazy(() => import('./components/DatiAziendali'))
const DatiFiscali = lazy(() => import('./components/DatiFiscali'))
const ActiveUsers = lazy(() => import('./components/ActiveUsers'))

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
  const [trackingCommessaId, setTrackingCommessaId] = useState(null)
  const [commessaOpenId, setCommessaOpenId] = useState(null)
  const toast = useToast()
  const {
    user,
    setUser,
    authChecking,
    authLoading,
    authError,
    login,
    logout
  } = useAuth()
  const {
    clienti,
    utenti,
    loading,
    error,
    loadUtenti,
    updateClienti,
    resetData
  } = useAppData(user)
  const {
    activeUsers,
    presenceLoading,
    presenceError
  } = usePresence(user, activeView)
  const handleLogin = async (credentials) => {
    await login(credentials)
  }

  const handleLogout = async () => {
    await logout()
    resetData()
    setTrackingCommessaId(null)
    setCommessaOpenId(null)
    setActiveView('home')
  }

  const handleHomeTrackingOpen = (commessaId) => {
    if (!commessaId) return
    setTrackingCommessaId(commessaId)
    setActiveView('tracking')
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
        <AppHeader
          user={user}
          onLogoClick={() => setActiveView('home')}
          onLogout={handleLogout}
          activeUsersSlot={user ? (
            <Suspense fallback={null}>
              <ActiveUsers
                users={activeUsers}
                loading={presenceLoading}
                error={presenceError}
              />
            </Suspense>
          ) : null}
        />

        {error && (
          <div className="alert alert-warning mb-3">
            {error}
          </div>
        )}

        {authChecking ? (
          <LoadingFallback />
        ) : user ? (
          <AppLayout
            nav={(
              <TopbarNav
                activeView={activeView}
                onChangeView={setActiveView}
                isAdmin={user?.role === 'admin'}
              />
            )}
          >
            {loading ? (
              <LoadingFallback />
            ) : (
              <AttivitaProvider>
                <Suspense fallback={<LoadingFallback />}>
                  {activeView === 'home' && (
                    <Home
                      key="home"
                      clienti={clienti}
                      user={user}
                      toast={toast}
                      onOpenTracking={handleHomeTrackingOpen}
                    />
                  )}
                  {activeView === 'attivita' && (
                    <TabellaAttivita key="attivita" clienti={clienti} user={user} toast={toast} />
                  )}
                  {activeView === 'commesse' && (
                    <Commesse
                      clienti={clienti}
                      toast={toast}
                      openCommessaId={commessaOpenId}
                      onOpenCommessaHandled={() => setCommessaOpenId(null)}
                      onOpenTracking={(commessaId) => {
                        setTrackingCommessaId(commessaId)
                        setActiveView('tracking')
                      }}
                    />
                  )}
                  {activeView === 'consuntivi' && (
                    <Consuntivi />
                  )}
                  {activeView === 'tracking' && (
                    <TrackingOre
                      clienti={clienti}
                      user={user}
                      toast={toast}
                      selectedCommessaId={trackingCommessaId}
                      onSelectCommessa={setTrackingCommessaId}
                      onOpenCommessa={(commessaId) => {
                        setCommessaOpenId(commessaId)
                        setActiveView('commesse')
                      }}
                    />
                  )}
                  {activeView === 'team' && (
                    <Team
                      clienti={clienti}
                      user={user}
                      utenti={utenti}
                      toast={toast}
                      onUserUpdated={handleUserUpdated}
                      onUsersChanged={loadUtenti}
                    />
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
                  {activeView === 'dati-aziendali' && user?.role === 'admin' && (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2 className="section-title mb-0 no-title-line">Dati aziendali</h2>
                      </div>
                      <div className="row g-4">
                        <div className="col-12">
                          <DatiAziendali showHeader={false} toast={toast} />
                        </div>
                        <div className="col-12">
                          <DatiFiscali showHeader={false} toast={toast} />
                        </div>
                      </div>
                    </div>
                  )}
                </Suspense>
              </AttivitaProvider>
            )}
          </AppLayout>
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