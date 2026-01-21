import { Suspense, lazy } from 'react'

const KanbanBoard = lazy(() => import('./KanbanBoard'))

function Home({ clienti, user, toast }) {
  return (
    <div className="home-section">
      {/* Sezione Kanban */}
      <div>
        <Suspense fallback={<div className="text-center py-3">Caricamento kanban...</div>}>
          <KanbanBoard clienti={clienti} user={user} toast={toast} />
        </Suspense>
      </div>
    </div>
  )
}

export default Home
