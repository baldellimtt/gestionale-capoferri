import { useMemo, useState, useEffect } from 'react'
import api from '../services/api'
import KanbanColumn from './KanbanColumn'
import KanbanCardDetail from './KanbanCardDetail'
import KanbanNotifications from './KanbanNotifications'
import KanbanFilters from './KanbanFilters'
import KanbanCalendar from './KanbanCalendar'

function KanbanBoard({ clienti, user, toast, hideControls = false }) {
  const [colonne, setColonne] = useState([])
  const [card, setCard] = useState([])
  const [scadenze, setScadenze] = useState([])
  const [commesse, setCommesse] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCard, setSelectedCard] = useState(null)
  const [showCardDetail, setShowCardDetail] = useState(false)
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' o 'calendar'
  const [inboxBusyIds, setInboxBusyIds] = useState([])
  const [showColonneManager, setShowColonneManager] = useState(false)
  const [colonneDrafts, setColonneDrafts] = useState({})
  const [colonnaCreating, setColonnaCreating] = useState(false)
  const [colonnaSavingId, setColonnaSavingId] = useState(null)
  const [colonnaDeletingId, setColonnaDeletingId] = useState(null)
  const [newColonna, setNewColonna] = useState({
    nome: '',
    colore: '#3b82f6',
    ordine: ''
  })
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
      setColonneDrafts((prev) => {
        if (!colonneData?.length) return prev
        const next = { ...prev }
        colonneData.forEach((col) => {
          if (!next[col.id]) {
            next[col.id] = {
              nome: col.nome || '',
              colore: col.colore || '#3b82f6',
              ordine: col.ordine ?? ''
            }
          }
        })
        return next
      })
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
          const ids = card.map((c) => c.id)
          const allScadenze = await api.getKanbanScadenzeBulk(ids)
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
      // Ricarica la card aggiornata dal server per avere i dati completi
      const refreshedCard = await api.getKanbanCardById(updatedCard.id)
      if (refreshedCard) {
        setSelectedCard(refreshedCard)
        // Aggiorna la card nella lista locale senza ricaricare tutto
        setCard((prevCards) => {
          const updated = prevCards.map(c => c.id === refreshedCard.id ? refreshedCard : c)
          // Se la card non è nella lista (potrebbe essere filtrata), aggiungila
          if (!updated.find(c => c.id === refreshedCard.id)) {
            return [...updated, refreshedCard]
          }
          return updated
        })
      } else {
        // Se la card non viene trovata, usa i dati aggiornati e ricarica tutto
        setSelectedCard(updatedCard)
        await loadData()
      }
      // Restituisci esplicitamente per indicare successo
      return { success: true }
    } catch (err) {
      console.error('Errore aggiornamento card:', err)
      const errorMsg = 'Errore nell\'aggiornamento della card'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
      throw err // Rilancia l'errore per gestirlo in KanbanCardDetail
    }
  }

  const markInboxBusy = (id, busy) => {
    setInboxBusyIds((prev) => {
      if (busy) {
        return prev.includes(id) ? prev : [...prev, id]
      }
      return prev.filter((item) => item !== id)
    })
  }

  const parseDateOnly = (dateStr) => {
    if (!dateStr) return null
    const clean = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr
    return new Date(`${clean}T00:00:00`)
  }

  const normalizeDate = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const addDays = (dateStr, days) => {
    const base = parseDateOnly(dateStr)
    if (!base) return dateStr
    const next = new Date(base)
    next.setDate(next.getDate() + days)
    const yyyy = next.getFullYear()
    const mm = String(next.getMonth() + 1).padStart(2, '0')
    const dd = String(next.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const formatShortDate = (dateStr) => {
    const date = parseDateOnly(dateStr)
    if (!date) return ''
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
  }

  const scadenzeInbox = useMemo(() => {
    const today = normalizeDate(new Date())
    const items = scadenze
      .filter((s) => !s.completata)
      .map((s) => {
        const due = parseDateOnly(s.data_scadenza)
        if (!due) return null
        const dueDay = normalizeDate(due)
        const diffDays = Math.round((dueDay - today) / 86400000)
        let bucket = null
        if (diffDays < 0) bucket = 'overdue'
        if (diffDays === 0) bucket = 'today'
        if (diffDays === 1) bucket = 'tomorrow'
        if (!bucket) return null
        return { scadenza: s, dueDay, diffDays, bucket }
      })
      .filter(Boolean)
      .sort((a, b) => a.dueDay - b.dueDay)

    return items.slice(0, 6)
  }, [scadenze])

  const openCardFromScadenza = async (scadenza) => {
    const localCard = card.find((c) => c.id === scadenza.card_id)
    if (localCard) {
      handleCardClick(localCard)
      return
    }
    try {
      const fetched = await api.getKanbanCardById(scadenza.card_id)
      if (fetched) {
        setSelectedCard(fetched)
        setShowCardDetail(true)
      }
    } catch (err) {
      console.error('Errore apertura card da scadenza:', err)
      toast?.showError('Impossibile aprire la card', 'Errore')
    }
  }

  const handleCompleteScadenza = async (scadenza) => {
    if (inboxBusyIds.includes(scadenza.id)) return
    markInboxBusy(scadenza.id, true)
    try {
      await api.completeKanbanScadenza(scadenza.id)
      toast?.showSuccess('Scadenza completata')
      await loadData()
    } catch (err) {
      console.error('Errore completamento scadenza:', err)
      toast?.showError('Errore completamento scadenza', 'Errore')
    } finally {
      markInboxBusy(scadenza.id, false)
    }
  }

  const handlePostponeScadenza = async (scadenza) => {
    if (inboxBusyIds.includes(scadenza.id)) return
    markInboxBusy(scadenza.id, true)
    try {
      const updated = {
        titolo: scadenza.titolo,
        descrizione: scadenza.descrizione,
        data_scadenza: addDays(scadenza.data_scadenza, 1),
        tipo: scadenza.tipo,
        priorita: scadenza.priorita
      }
      await api.updateKanbanScadenza(scadenza.id, updated)
      toast?.showSuccess('Scadenza rinviata di 1 giorno')
      await loadData()
    } catch (err) {
      console.error('Errore rinvio scadenza:', err)
      toast?.showError('Errore rinvio scadenza', 'Errore')
    } finally {
      markInboxBusy(scadenza.id, false)
    }
  }

  const normalizeTags = (value) => {
    if (!value) return null
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return [value]
      }
    }
    return null
  }

  const handleQuickUpdate = async (cardId, patch) => {
    const existing = card.find((item) => item.id === cardId)
    if (!existing) return
    const payload = {
      commessa_id: existing.commessa_id || null,
      titolo: patch.titolo ?? existing.titolo,
      descrizione: patch.descrizione ?? existing.descrizione,
      colonna_id: patch.colonna_id ?? existing.colonna_id,
      priorita: patch.priorita ?? existing.priorita,
      responsabile_id: patch.responsabile_id ?? existing.responsabile_id,
      cliente_id: patch.cliente_id ?? existing.cliente_id,
      cliente_nome: patch.cliente_nome ?? existing.cliente_nome,
      ordine: patch.ordine ?? existing.ordine,
      avanzamento: patch.avanzamento ?? existing.avanzamento,
      data_inizio: patch.data_inizio ?? existing.data_inizio,
      data_fine_prevista: patch.data_fine_prevista ?? existing.data_fine_prevista,
      data_fine_effettiva: patch.data_fine_effettiva ?? existing.data_fine_effettiva,
      budget: patch.budget ?? existing.budget,
      tags: patch.tags ?? normalizeTags(existing.tags)
    }
    try {
      const updated = await api.updateKanbanCard(cardId, payload)
      setCard((prev) => prev.map((item) => (item.id === cardId ? updated : item)))
      if (selectedCard?.id === cardId) {
        setSelectedCard(updated)
      }
      return updated
    } catch (err) {
      console.error('Errore quick update card:', err)
      toast?.showError('Errore aggiornamento rapido', 'Errore')
      throw err
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
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Eliminazione card')
      await api.deleteKanbanCard(cardId)
      await loadData()
      if (selectedCard?.id === cardId) {
        setShowCardDetail(false)
        setSelectedCard(null)
      }
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Card eliminata con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Card eliminata con successo')
      }
    } catch (err) {
      console.error('Errore eliminazione card:', err)
      const errorMsg = 'Errore nell\'eliminazione della card'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    }
  }

  const normalizeColonnaDraft = (draft) => ({
    nome: String(draft.nome || '').trim(),
    colore: draft.colore || '#3b82f6',
    ordine: Number.isFinite(Number(draft.ordine)) ? Number(draft.ordine) : null
  })

  const handleCreateColonna = async (e) => {
    e.preventDefault()
    const payload = normalizeColonnaDraft(newColonna)
    if (!payload.nome) {
      toast?.showError('Inserisci il nome della colonna', 'Dati mancanti')
      return
    }
    const maxOrdine = colonne.reduce((max, col) => Math.max(max, Number(col.ordine) || 0), 0)
    const ordine = payload.ordine ?? maxOrdine + 1
    try {
      setColonnaCreating(true)
      const created = await api.createKanbanColonna({
        nome: payload.nome,
        colore: payload.colore,
        ordine
      })
      setColonne((prev) => [...prev, created].sort((a, b) => (a.ordine || 0) - (b.ordine || 0)))
      setColonneDrafts((prev) => ({
        ...prev,
        [created.id]: {
          nome: created.nome || '',
          colore: created.colore || '#3b82f6',
          ordine: created.ordine ?? ''
        }
      }))
      setNewColonna({ nome: '', colore: '#3b82f6', ordine: '' })
      toast?.showSuccess('Colonna creata')
    } catch (err) {
      console.error('Errore creazione colonna:', err)
      toast?.showError('Errore creazione colonna', 'Errore')
    } finally {
      setColonnaCreating(false)
    }
  }

  const handleUpdateColonna = async (colonnaId) => {
    const draft = colonneDrafts[colonnaId]
    if (!draft) return
    const payload = normalizeColonnaDraft(draft)
    if (!payload.nome) {
      toast?.showError('Il nome colonna è obbligatorio', 'Dati mancanti')
      return
    }
    const current = colonne.find((col) => col.id === colonnaId)
    try {
      setColonnaSavingId(colonnaId)
      const updated = await api.updateKanbanColonna(colonnaId, {
        nome: payload.nome,
        colore: payload.colore,
        ordine: payload.ordine ?? (current?.ordine ?? 0)
      })
      setColonne((prev) =>
        prev
          .map((col) => (col.id === colonnaId ? updated : col))
          .sort((a, b) => (a.ordine || 0) - (b.ordine || 0))
      )
      toast?.showSuccess('Colonna aggiornata')
    } catch (err) {
      console.error('Errore aggiornamento colonna:', err)
      toast?.showError('Errore aggiornamento colonna', 'Errore')
    } finally {
      setColonnaSavingId(null)
    }
  }

  const handleDeleteColonna = async (colonnaId) => {
    const colonna = colonne.find((item) => item.id === colonnaId)
    const label = colonna?.nome ? ` "${colonna.nome}"` : ''
    if (!window.confirm(`Eliminare la colonna${label}? Se ci sono card collegate l'eliminazione potrebbe fallire.`)) {
      return
    }
    try {
      setColonnaDeletingId(colonnaId)
      await api.deleteKanbanColonna(colonnaId)
      setColonne((prev) => prev.filter((col) => col.id !== colonnaId))
      setColonneDrafts((prev) => {
        const next = { ...prev }
        delete next[colonnaId]
        return next
      })
      toast?.showSuccess('Colonna eliminata')
      await loadData()
    } catch (err) {
      console.error('Errore eliminazione colonna:', err)
      toast?.showError('Errore eliminazione colonna', 'Errore')
    } finally {
      setColonnaDeletingId(null)
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
      {!hideControls && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="section-title mb-0 no-title-line">Kanban</h2>
            <div className="d-flex gap-2 align-items-center">
              <div className="btn-group" role="group">
                <button
                  className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`}
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
                  className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
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
              {user?.role === 'admin' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowColonneManager((prev) => !prev)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    height: '38px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="21" y1="4" x2="14" y2="4" />
                    <line x1="10" y1="4" x2="3" y2="4" />
                    <line x1="21" y1="12" x2="12" y2="12" />
                    <line x1="8" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="20" x2="16" y2="20" />
                    <line x1="12" y1="20" x2="3" y2="20" />
                    <circle cx="12" cy="4" r="2" />
                    <circle cx="10" cy="12" r="2" />
                    <circle cx="14" cy="20" r="2" />
                  </svg>
                  {showColonneManager ? 'Nascondi gestione colonne' : 'Gestione colonne'}
                </button>
              )}
            </div>
          </div>

          {!showColonneManager && viewMode === 'kanban' && (
            <div
              className="mb-3 p-3"
              style={{
                background: 'linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-soft)',
                boxShadow: 'var(--shadow-1)'
              }}
            >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ink-800)' }}>Inbox giornaliera</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--ink-600)' }}>Oggi, domani e in ritardo</div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-600)' }}>
                {scadenzeInbox.length} item
              </div>
            </div>

            {scadenzeInbox.length === 0 ? (
              <div style={{ color: 'var(--ink-500)', fontSize: '0.9rem' }}>
                Nessuna scadenza urgente.
              </div>
            ) : (
              <div className="d-grid gap-2">
                {scadenzeInbox.map(({ scadenza, diffDays, bucket }) => {
                  const label =
                    bucket === 'overdue'
                      ? `In ritardo di ${Math.abs(diffDays)}g`
                      : bucket === 'today'
                        ? 'Oggi'
                        : 'Domani'
                  const badgeColor =
                    bucket === 'overdue' ? '#ef4444' : bucket === 'today' ? '#f59e0b' : '#3b82f6'
                  const cardRef = card.find((c) => c.id === scadenza.card_id)
                  const commessaRef = commesse.find((c) => String(c.id) === String(cardRef?.commessa_id))
                  const clienteLabel = commessaRef?.cliente_nome || cardRef?.cliente_nome || 'Cliente'
                  const commessaLabel = commessaRef?.titolo || (cardRef?.commessa_id ? `Commessa #${cardRef.commessa_id}` : 'Commessa')
                  const metaLabel = `${clienteLabel} - ${commessaLabel}`
                  return (
                    <div
                      key={scadenza.id}
                      className="d-flex justify-content-between align-items-center"
                      style={{
                        padding: '0.6rem 0.8rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-soft)',
                        background: 'var(--bg-1)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.45rem',
                            borderRadius: '999px',
                            background: `${badgeColor}20`,
                            color: badgeColor,
                            fontWeight: 600
                          }}
                        >
                          {label}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--ink-800)' }}>{scadenza.titolo}</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--ink-500)' }}>
                            {metaLabel} · {formatShortDate(scadenza.data_scadenza)}
                          </div>
                        </div>
                      </div>

                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-success"
                          onClick={() => handleCompleteScadenza(scadenza)}
                          disabled={inboxBusyIds.includes(scadenza.id)}
                        >
                          Segna fatto
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handlePostponeScadenza(scadenza)}
                          disabled={inboxBusyIds.includes(scadenza.id)}
                        >
                          Rinvia 1g
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openCardFromScadenza(scadenza)}
                        >
                          Apri
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          )}

          {!showColonneManager && (
            <div className="mb-3">
              <KanbanFilters
                colonne={colonne}
                clienti={clienti}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>
          )}

          {user?.role === 'admin' && showColonneManager && (
            <div className="card mb-3">
              <div className="card-header">Gestione colonne Kanban</div>
              <div className="card-body">
                <form onSubmit={handleCreateColonna} className="mb-4">
                  <div className="row g-3 align-items-end">
                    <div className="col-md-5">
                      <label className="form-label">Nome colonna</label>
                      <input
                        className="form-control"
                        value={newColonna.nome}
                        onChange={(e) => setNewColonna((prev) => ({ ...prev, nome: e.target.value }))}
                        placeholder="Es. Verifica, Approvazione"
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Colore</label>
                      <input
                        type="color"
                        className="form-control form-control-color"
                        value={newColonna.colore}
                        onChange={(e) => setNewColonna((prev) => ({ ...prev, colore: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Ordine</label>
                      <input
                        type="number"
                        className="form-control"
                        value={newColonna.ordine}
                        onChange={(e) => setNewColonna((prev) => ({ ...prev, ordine: e.target.value }))}
                        placeholder="Auto"
                      />
                    </div>
                    <div className="col-md-2 d-grid">
                      <button className="btn btn-primary" type="submit" disabled={colonnaCreating}>
                        {colonnaCreating ? 'Creazione...' : 'Crea'}
                      </button>
                    </div>
                  </div>
                </form>

                {colonne.length === 0 ? (
                  <div className="alert alert-info mb-0">Nessuna colonna disponibile.</div>
                ) : (
                  <div className="list-group">
                    {colonne.map((col) => {
                      const draft = colonneDrafts[col.id] || { nome: col.nome || '', colore: col.colore || '#3b82f6', ordine: col.ordine ?? '' }
                      return (
                        <div key={col.id} className="list-group-item">
                          <div className="row g-3 align-items-end">
                            <div className="col-md-4">
                              <label className="form-label">Nome</label>
                              <input
                                className="form-control"
                                value={draft.nome}
                                onChange={(e) =>
                                  setColonneDrafts((prev) => ({
                                    ...prev,
                                    [col.id]: { ...draft, nome: e.target.value }
                                  }))
                                }
                              />
                            </div>
                            <div className="col-md-2">
                              <label className="form-label">Colore</label>
                              <input
                                type="color"
                                className="form-control form-control-color"
                                value={draft.colore || '#3b82f6'}
                                onChange={(e) =>
                                  setColonneDrafts((prev) => ({
                                    ...prev,
                                    [col.id]: { ...draft, colore: e.target.value }
                                  }))
                                }
                              />
                            </div>
                            <div className="col-md-2">
                              <label className="form-label">Ordine</label>
                              <input
                                type="number"
                                className="form-control"
                                value={draft.ordine}
                                onChange={(e) =>
                                  setColonneDrafts((prev) => ({
                                    ...prev,
                                    [col.id]: { ...draft, ordine: e.target.value }
                                  }))
                                }
                              />
                            </div>
                            <div className="col-md-4 d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-outline-primary"
                                onClick={() => handleUpdateColonna(col.id)}
                                disabled={colonnaSavingId === col.id}
                              >
                                {colonnaSavingId === col.id ? 'Salvataggio...' : 'Salva'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger"
                                onClick={() => handleDeleteColonna(col.id)}
                                disabled={colonnaDeletingId === col.id}
                              >
                                {colonnaDeletingId === col.id ? 'Eliminazione...' : 'Elimina'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {hideControls && (
        <div className="mb-4">
          <h2 className="section-title mb-0 no-title-line">Kanban</h2>
        </div>
      )}

      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      {viewMode === 'kanban' ? (
        !showColonneManager && (
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
                commesse={commesse}
                onCardClick={handleCardClick}
                onMoveCard={handleCardMove}
                onQuickUpdate={handleQuickUpdate}
              />
            ))}
          </div>
        )
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
          toast={toast}
        />
      )}
    </div>
  )
}

export default KanbanBoard


