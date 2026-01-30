import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const KanbanBoard = lazy(() => import('./KanbanBoard'))

const parseDateTime = (value) => {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatElapsed = (minutes) => {
  const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : 0
  const hours = Math.floor(safe / 60)
  const mins = Math.floor(safe % 60)
  return `${hours}h ${String(mins).padStart(2, '0')}m`
}

const formatStartLabel = (value) => {
  const parsed = parseDateTime(value)
  if (!parsed) return '-'
  return parsed.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const computeElapsedMinutes = (entry) => {
  if (!entry) return 0
  if (entry.end_time && Number.isFinite(entry.durata_minuti)) {
    return entry.durata_minuti
  }
  const start = parseDateTime(entry.start_time)
  if (!start) return 0
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000))
}

const getUserLabel = (entry) => {
  const fullName = [entry?.nome, entry?.cognome].filter(Boolean).join(' ').trim()
  return fullName || entry?.username || (entry?.user_id ? `Utente #${entry.user_id}` : 'Utente')
}

function Home({ clienti, user, toast, onOpenTracking }) {
  const [activeEntries, setActiveEntries] = useState([])
  const [commesse, setCommesse] = useState([])
  const [loadingActive, setLoadingActive] = useState(true)
  const [activeError, setActiveError] = useState(null)
  const [tick, setTick] = useState(0)
  const [stoppingId, setStoppingId] = useState(null)

  const loadActiveTracking = useCallback(async () => {
    let success = true
    try {
      setLoadingActive(true)
      setActiveError(null)
      const [active, commesseData] = await Promise.all([
        api.getTrackingActive(),
        api.getCommesse()
      ])

      const list = Array.isArray(active)
        ? active
        : active?.id
          ? [active]
          : []

      setActiveEntries(list)
      setCommesse(Array.isArray(commesseData) ? commesseData : [])
    } catch (err) {
      success = false
      console.error('Errore caricamento tracking attivi in home:', err)
      setActiveError('Impossibile caricare i tracking attivi.')
    } finally {
      setLoadingActive(false)
    }
    return success
  }, [])

  useEffect(() => {
    loadActiveTracking()
  }, [loadActiveTracking])

  useEffect(() => {
    if (!activeEntries.length) return undefined
    const interval = setInterval(() => {
      setTick((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeEntries])

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      loadActiveTracking()
    }, 15 * 60 * 1000)
    return () => clearInterval(refreshInterval)
  }, [loadActiveTracking])

  const clientiById = useMemo(() => {
    const map = new Map()
    ;(clienti || []).forEach((cliente) => {
      if (cliente?.id != null) {
        map.set(String(cliente.id), cliente.denominazione)
      }
    })
    return map
  }, [clienti])

  const commesseById = useMemo(() => {
    const map = new Map()
    commesse.forEach((commessa) => {
      if (commessa?.id != null) {
        map.set(String(commessa.id), commessa)
      }
    })
    return map
  }, [commesse])

  const activeCards = useMemo(() => {
    return activeEntries.map((entry) => {
      const commessa = commesseById.get(String(entry.commessa_id))
      const elapsedMinutes = computeElapsedMinutes(entry)
      const elapsedHours = elapsedMinutes / 60
      const progressValue = Math.min(100, Math.max(5, elapsedHours * 12))
      const clienteLabel = commessa?.cliente_id ? clientiById.get(String(commessa.cliente_id)) : null

      return {
        id: entry.id,
        entry,
        commessaId: entry.commessa_id,
        titolo: commessa?.titolo || entry.commessa_titolo || `Commessa #${entry.commessa_id}`,
        codice: commessa?.codice || commessa?.numero || null,
        clienteLabel,
        utente: getUserLabel(entry),
        startLabel: formatStartLabel(entry.start_time),
        elapsedLabel: formatElapsed(elapsedMinutes),
        progressValue
      }
    })
  }, [activeEntries, commesseById, clientiById, tick])

  const subtitleText = useMemo(() => {
    if (loadingActive) return 'Caricamento in corso...'
    if (activeCards.length) return `${activeCards.length} timer in esecuzione`
    return ''
  }, [loadingActive, activeCards])

  const handleStopActiveEntry = useCallback(async (entry) => {
    if (!entry?.id) return
    setStoppingId(entry.id)
    try {
      await api.stopTracking(entry.id, entry.row_version)
      toast?.showSuccess('Tracking fermato', 'Home')
      await loadActiveTracking()
    } catch (err) {
      toast?.showError(err.message || 'Errore nel fermare il tracking', 'Home')
    } finally {
      setStoppingId(null)
    }
  }, [loadActiveTracking, toast])

  const handleCardClick = useCallback((commessaId) => {
    if (!commessaId) return
    onOpenTracking?.(commessaId)
  }, [onOpenTracking])

  const handleCardKeyDown = (event, commessaId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick(commessaId)
    }
  }

  return (
    <div className="home-section">
      <div className="home-hero-heading">
        <h2 className="section-title mb-0 no-title-line">Tracking attivi</h2>
        <div className="home-hero-subtitle">{subtitleText}</div>
      </div>
      <section className="home-hero-tracking">

        {activeError && (
          <div className="alert alert-warning home-hero-alert" role="alert">
            {activeError}
          </div>
        )}

        {!!activeCards.length && (
          <div className="home-hero-grid">
            {activeCards.map((card) => (
              <article
                key={card.id}
                className="home-hero-card"
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(card.commessaId)}
                onKeyDown={(event) => handleCardKeyDown(event, card.commessaId)}
              >
                <div className="home-hero-card-top">
                  <div className="home-hero-chip">
                    <span className="home-hero-chip-dot" />
                    LIVE
                  </div>
                  <div className="home-hero-time">{card.elapsedLabel}</div>
                </div>

                <div className="home-hero-card-title">{card.titolo}</div>
                {card.clienteLabel && (
                  <div className="home-hero-card-meta">{card.clienteLabel}</div>
                )}

                <div className="home-hero-card-details">
                  <div>
                    <span className="home-hero-detail-label">Utente</span>
                    <span className="home-hero-detail-value">{card.utente}</span>
                  </div>
                  <div>
                    <span className="home-hero-detail-label">Start</span>
                    <span className="home-hero-detail-value">{card.startLabel}</span>
                  </div>
                  {card.codice && (
                    <div>
                      <span className="home-hero-detail-label">Codice</span>
                      <span className="home-hero-detail-value">{card.codice}</span>
                    </div>
                  )}
                </div>

                <div className="home-hero-card-actions">
                  <button
                    type="button"
                    className="home-hero-stop-btn"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleStopActiveEntry(card.entry)
                    }}
                    disabled={stoppingId === card.entry.id}
                  >
                    {stoppingId === card.entry.id ? 'Fermando...' : 'Stop'}
                  </button>
                </div>

                <div className="home-hero-progress">
                  <div
                    className="home-hero-progress-bar"
                    style={{ width: `${card.progressValue}%` }}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
        {!loadingActive && !activeCards.length && !activeError && (
          <div className="home-hero-empty">Nessun tracking attività</div>
        )}
      </section>

      <div>
        <Suspense fallback={<div className="text-center py-3">Caricamento kanban...</div>}>
          <KanbanBoard clienti={clienti} user={user} toast={toast} />
        </Suspense>
      </div>
    </div>
  )
}

export default Home
