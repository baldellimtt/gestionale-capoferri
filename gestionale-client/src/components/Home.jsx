import { Suspense, lazy } from 'react'

const TabellaAttivita = lazy(() => import('./TabellaAttivita'))
const KanbanBoard = lazy(() => import('./KanbanBoard'))

function Home({ clienti, user, toast }) {
  return (
    <div className="home-section">
      {/* Sezione Rimborsi */}
      <div style={{ marginBottom: '2rem' }}>
        <Suspense fallback={<div className="text-center py-3">Caricamento rimborsi...</div>}>
          <TabellaAttivita clienti={clienti} user={user} toast={toast} hideControls={true} />
        </Suspense>
      </div>

      {/* Sezione Kanban */}
      <div>
        <Suspense fallback={<div className="text-center py-3">Caricamento kanban...</div>}>
          <KanbanBoard clienti={clienti} user={user} toast={toast} hideControls={true} />
        </Suspense>
      </div>
    </div>
  )
}

export default Home

