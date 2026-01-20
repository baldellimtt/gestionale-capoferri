import { useState, useEffect } from 'react'
import api from '../services/api'
import KanbanColumn from './KanbanColumn'
import KanbanCardDetail from './KanbanCardDetail'
import KanbanNotifications from './KanbanNotifications'
import KanbanFilters from './KanbanFilters'
import KanbanCalendar from './KanbanCalendar'

function KanbanBoard({ clienti, user }) {
  const [colonne, setColonne] = useState([])
  const [card, setCard] = useState([])
  const [scadenze, setScadenze] = useState([])
  const [commesse, setCommesse] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCard, setSelectedCard] = useState(null)
  const [showCardDetail, setShowCardDetail] = useState(false)
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' o 'calendar'
  const [filters, setFilters] = useState({
    cliente_id: '',
    colonna_id: '',
    priorita: '',
    ricerca: '',
    data_inizio_da: '',
    data_inizio_a: '',
    data_fine_da: '',
    data_fine_a: ''
  })

  useEffect(() => {
    loadData()
  }, [filters])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [colonneData, cardData, commesseData] = await Promise.all([
        api.getKanbanColonne(),
        api.getKanbanCard(filters),
        api.getCommesse().catch(() => []) // Carica commesse, fallback a array vuoto se errore
      ])
      
      setColonne(colonneData)
      setCard(cardData)
      setCommesse(commesseData || [])
    } catch (err) {
      console.error('Errore caricamento Kanban:', err)
      setError('Errore nel caricamento dei dati. Verifica che il server sia avviato.')
    } finally {
      setLoading(false)
    }
  }
  
  // Ricarica scadenze quando cambiano le card
  useEffect(() => {
    const loadScadenze = async () => {
      if (card.length > 0) {
        try {
          const scadenzePromises = card.map(c => 
            api.getKanbanScadenze(c.id).catch(() => [])
          )
          const scadenzeResults = await Promise.all(scadenzePromises)
          const allScadenze = scadenzeResults.flat()
          setScadenze(allScadenze)
        } catch (err) {
          console.error('Errore caricamento scadenze:', err)
          setScadenze([])
        }
      } else {
        setScadenze([])
      }
    }
    loadScadenze()
  }, [card])

  const handleCardClick = (cardItem) => {
    setSelectedCard(cardItem)
    setShowCardDetail(true)
  }

  const handleCardUpdate = async (updatedCard) => {
    try {
      await api.updateKanbanCard(updatedCard.id, updatedCard)
      await loadData()
      setSelectedCard(updatedCard)
    } catch (err) {
      console.error('Errore aggiornamento card:', err)
      setError('Errore nell\'aggiornamento della card')
    }
  }

  const handleCardMove = async (cardId, newColonnaId, newOrdine) => {
    try {
      await api.moveKanbanCard(cardId, newColonnaId, newOrdine)
      await loadData()
    } catch (err) {
      console.error('Errore spostamento card:', err)
      setError('Errore nello spostamento della card')
    }
  }

  const handleCardDelete = async (cardId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa card?')) {
      return
    }
    try {
      await api.deleteKanbanCard(cardId)
      await loadData()
      if (selectedCard?.id === cardId) {
        setShowCardDetail(false)
        setSelectedCard(null)
      }
    } catch (err) {
      console.error('Errore eliminazione card:', err)
      setError('Errore nell\'eliminazione della card')
    }
  }

  const handleCloseDetail = () => {
    setShowCardDetail(false)
    setSelectedCard(null)
  }

  const handleNotificationClick = (notifica) => {
    if (notifica.card_id) {
      // Carica la card e apri il dettaglio
      api.getKanbanCardById(notifica.card_id)
        .then(card => {
          setSelectedCard(card)
          setShowCardDetail(true)
        })
        .catch(err => {
          console.error('Errore caricamento card dalla notifica:', err)
        })
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Caricamento...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="kanban-board">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Kanban</h2>
        <div className="d-flex gap-2 align-items-center">
          <div className="btn-group" role="group">
            <button
              className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setViewMode('kanban')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </svg>
              Kanban
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setViewMode('calendar')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Calendario
            </button>
          </div>
          <KanbanNotifications onNotificationClick={handleNotificationClick} />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setSelectedCard(null)
              setShowCardDetail(true)
            }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              height: '38px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuova Card
          </button>
        </div>
      </div>

      <div className="mb-3">
        <KanbanFilters
          colonne={colonne}
          clienti={clienti}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      {viewMode === 'kanban' ? (
        <div
          className="kanban-board-container"
          style={{
            display: 'flex',
            gap: '1rem',
            overflowX: 'auto',
            paddingBottom: '1rem',
            minHeight: '600px',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {colonne.map((colonna) => (
            <KanbanColumn
              key={colonna.id}
              colonna={colonna}
              card={card}
              onCardClick={handleCardClick}
              onMoveCard={handleCardMove}
            />
          ))}
        </div>
      ) : (
        <KanbanCalendar
          card={card}
          scadenze={scadenze}
          colonne={colonne}
          clienti={clienti}
          filters={filters}
          onCardClick={handleCardClick}
          onDateClick={(date) => {
            // Opzionale: apri modal per creare card in quella data
            setSelectedCard(null)
            setShowCardDetail(true)
          }}
        />
      )}

      {showCardDetail && (
        <KanbanCardDetail
          card={selectedCard}
          colonne={colonne}
          clienti={clienti}
          commesse={commesse}
          currentUser={user}
          onSave={handleCardUpdate}
          onDelete={handleCardDelete}
          onClose={handleCloseDetail}
          onRefresh={loadData}
        />
      )}
    </div>
  )
}

export default KanbanBoard


