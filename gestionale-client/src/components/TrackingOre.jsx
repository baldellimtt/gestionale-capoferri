import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const getTodayDate = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMinutes = (minutes) => {
  const safe = Number.isFinite(minutes) ? minutes : 0
  const hours = Math.floor(safe / 60)
  const mins = Math.floor(safe % 60)
  return `${hours}h ${String(mins).padStart(2, '0')}m`
}

const parseDateTime = (value) => {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function TrackingOre({ clienti, user, toast, selectedCommessaId, onSelectCommessa }) {
  const [commesse, setCommesse] = useState([])
  const [selectedId, setSelectedId] = useState(selectedCommessaId ? String(selectedCommessaId) : '')
  const [selectedCommessa, setSelectedCommessa] = useState(null)
  const [entries, setEntries] = useState([])
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeEntry, setActiveEntry] = useState(null)
  const [showActiveModal, setShowActiveModal] = useState(false)
  const [clienteFilterInput, setClienteFilterInput] = useState('')
  const [showClienteAutocomplete, setShowClienteAutocomplete] = useState(false)
  const [selectedClienteId, setSelectedClienteId] = useState('')
  const [commessaSearch, setCommessaSearch] = useState('')
  const [showCommessaAutocomplete, setShowCommessaAutocomplete] = useState(false)
  const [manualForm, setManualForm] = useState({
    data: getTodayDate(),
    ore: '',
    note: ''
  })
  const [manualSaving, setManualSaving] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setSelectedId(selectedCommessaId ? String(selectedCommessaId) : '')
  }, [selectedCommessaId])

  useEffect(() => {
    const loadCommesse = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await api.getCommesse()
        setCommesse(data || [])
      } catch (err) {
        console.error('Errore caricamento commesse per tracking:', err)
        setError('Errore nel caricamento delle commesse. Verifica che il server sia avviato.')
      } finally {
        setLoading(false)
      }
    }
    loadCommesse()
  }, [])

  useEffect(() => {
    const loadActive = async () => {
      try {
        const active = await api.getTrackingActive()
        if (active && active.id) {
          setActiveEntry(active)
          setShowActiveModal(true)
        } else {
          setActiveEntry(null)
        }
      } catch (err) {
        console.error('Errore caricamento tracking attivo:', err)
      }
    }
    loadActive()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setSelectedCommessa(null)
      setEntries([])
      setTotalMinutes(0)
      return
    }

    const commessa = commesse.find((item) => String(item.id) === String(selectedId))
    setSelectedCommessa(commessa || null)
    if (commessa?.titolo) {
      setCommessaSearch(commessa.titolo)
    }

    const loadEntries = async () => {
      try {
        setEntriesLoading(true)
        const data = await api.getCommessaTrackingEntries(selectedId)
        setEntries(data?.entries || [])
        setTotalMinutes(data?.total_minuti || 0)
      } catch (err) {
        console.error('Errore caricamento tracking commessa:', err)
        toast?.showError('Errore nel caricamento delle ore della commessa', 'Tracking ore')
      } finally {
        setEntriesLoading(false)
      }
    }
    loadEntries()
  }, [selectedId, commesse, toast])

  useEffect(() => {
    if (!activeEntry) return undefined
    const interval = setInterval(() => {
      setTick((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeEntry])

  const filteredClienti = useMemo(() => {
    if (!clienteFilterInput) return clienti || []
    const searchLower = clienteFilterInput.toLowerCase()
    return (clienti || []).filter((cliente) =>
      cliente.denominazione?.toLowerCase().includes(searchLower)
    )
  }, [clienti, clienteFilterInput])

  const filteredCommesseByCliente = useMemo(() => {
    let list = commesse
    if (selectedClienteId) {
      list = list.filter((commessa) => String(commessa.cliente_id) === String(selectedClienteId))
    }
    if (!commessaSearch) return list
    const searchLower = commessaSearch.toLowerCase()
    return list.filter((commessa) => commessa.titolo?.toLowerCase().includes(searchLower))
  }, [commesse, selectedClienteId, commessaSearch])

  const getEntryMinutes = (entry) => {
    if (!entry) return 0
    if (entry.end_time && Number.isFinite(entry.durata_minuti)) {
      return entry.durata_minuti
    }
    const start = parseDateTime(entry.start_time)
    if (!start) return 0
    return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000))
  }

  const totalTrackedHours = useMemo(() => {
    const runningMinutes = activeEntry && String(activeEntry.commessa_id) === String(selectedId)
      ? getEntryMinutes(activeEntry)
      : 0
    return (totalMinutes + runningMinutes) / 60
  }, [activeEntry, selectedId, totalMinutes, tick])

  const estimatedHours = useMemo(() => {
    const value = selectedCommessa?.monte_ore_stimato
    if (value == null || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }, [selectedCommessa])

  const progressPercent = useMemo(() => {
    if (!estimatedHours || estimatedHours <= 0) return 0
    return Math.min(100, (totalTrackedHours / estimatedHours) * 100)
  }, [estimatedHours, totalTrackedHours])

  const formatEntryHours = (entry) => {
    const minutes = getEntryMinutes(entry)
    return (minutes / 60).toFixed(2)
  }

  const formatEntryDate = (entry) => {
    if (!entry?.data) return ''
    const [year, month, day] = entry.data.split('-')
    return `${day}/${month}/${year}`
  }

  const formatDateTime = (value) => {
    const parsed = parseDateTime(value)
    if (!parsed) return '-'
    return parsed.toLocaleString('it-IT')
  }

  const getUserLabel = (entry) => {
    const fullName = [entry?.nome, entry?.cognome].filter(Boolean).join(' ').trim()
    return fullName || entry?.username || (entry?.user_id ? `Utente #${entry.user_id}` : '-')
  }

  const handleSelectCommessa = (value) => {
    const next = value ? String(value) : ''
    setSelectedId(next)
    if (onSelectCommessa) {
      onSelectCommessa(next || null)
    }
  }

  const handleClienteSelect = (cliente) => {
    if (!cliente?.id) return
    setSelectedClienteId(String(cliente.id))
    setClienteFilterInput(cliente.denominazione || '')
    setShowClienteAutocomplete(false)
    setCommessaSearch('')
    handleSelectCommessa('')
  }

  const handleCommessaSelect = (commessa) => {
    if (!commessa?.id) return
    setCommessaSearch(commessa.titolo || '')
    setShowCommessaAutocomplete(false)
    handleSelectCommessa(commessa.id)
  }

  const refreshActive = async () => {
    try {
      const active = await api.getTrackingActive()
      setActiveEntry(active && active.id ? active : null)
    } catch (err) {
      console.error('Errore refresh tracking attivo:', err)
    }
  }

  const handleStart = async () => {
    if (!selectedId) return
    try {
      await api.startTracking(selectedId)
      toast?.showSuccess('Tracking avviato', 'Tracking ore')
      await refreshActive()
      const data = await api.getCommessaTrackingEntries(selectedId)
      setEntries(data?.entries || [])
      setTotalMinutes(data?.total_minuti || 0)
    } catch (err) {
      if (err.status === 409) {
        toast?.showError('Hai gia un tracking attivo. Fermalo prima di iniziare un nuovo.', 'Tracking ore')
        await refreshActive()
        setShowActiveModal(true)
      } else {
        toast?.showError(err.message || 'Errore nell\'avvio del tracking', 'Tracking ore')
      }
    }
  }

  const handleStop = async () => {
    if (!activeEntry?.id) return
    try {
      await api.stopTracking(activeEntry.id)
      toast?.showSuccess('Tracking fermato', 'Tracking ore')
      setActiveEntry(null)
      await refreshActive()
      if (selectedId) {
        const data = await api.getCommessaTrackingEntries(selectedId)
        setEntries(data?.entries || [])
        setTotalMinutes(data?.total_minuti || 0)
      }
    } catch (err) {
      toast?.showError(err.message || 'Errore nel fermare il tracking', 'Tracking ore')
    }
  }

  const handleManualSubmit = async () => {
    if (!selectedId) return
    const oreValue = Number(String(manualForm.ore || '').replace(',', '.'))
    if (!Number.isFinite(oreValue) || oreValue < 0) {
      toast?.showError('Inserisci un numero di ore valido', 'Tracking ore')
      return
    }
    try {
      setManualSaving(true)
      await api.addTrackingManual(selectedId, manualForm.data, oreValue, manualForm.note)
      toast?.showSuccess('Ore registrate', 'Tracking ore')
      setManualForm({ data: getTodayDate(), ore: '', note: '' })
      const data = await api.getCommessaTrackingEntries(selectedId)
      setEntries(data?.entries || [])
      setTotalMinutes(data?.total_minuti || 0)
    } catch (err) {
      toast?.showError(err.message || 'Errore nel salvataggio ore', 'Tracking ore')
    } finally {
      setManualSaving(false)
    }
  }

  const activeOnSelected = activeEntry && String(activeEntry.commessa_id) === String(selectedId)
  const activeElapsed = activeEntry ? formatMinutes(getEntryMinutes(activeEntry)) : ''

  return (
    <div className="tracking-section">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Tracking ore</h2>
        {activeEntry && (
          <div className="tracking-active-pill">
            <span>Tracking attivo</span>
            <strong>{activeElapsed}</strong>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-warning">{error}</div>
      )}

      <div className="tracking-layout">
        <div className="tracking-panel">
          <div className="card mb-4">
            <div className="card-header">Seleziona commessa</div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Cliente</label>
                <div className="autocomplete-container">
                  <input
                    className="form-control"
                    value={clienteFilterInput}
                    onChange={(e) => {
                      setClienteFilterInput(e.target.value)
                      setShowClienteAutocomplete(true)
                      if (!e.target.value) {
                        setSelectedClienteId('')
                        handleSelectCommessa('')
                      }
                    }}
                    onFocus={() => setShowClienteAutocomplete(true)}
                    onBlur={() => {
                      setTimeout(() => setShowClienteAutocomplete(false), 200)
                    }}
                    placeholder="Cerca cliente..."
                  />
                  {showClienteAutocomplete && filteredClienti.length > 0 && (
                    <div className="autocomplete-list">
                      {filteredClienti.map((cliente) => (
                        <div
                          key={cliente.id}
                          className="autocomplete-item"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleClienteSelect(cliente)
                          }}
                        >
                          {cliente.denominazione}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Commessa</label>
                <div className="autocomplete-container">
                  <input
                    className="form-control"
                    value={commessaSearch}
                    onChange={(e) => {
                      setCommessaSearch(e.target.value)
                      setShowCommessaAutocomplete(true)
                      if (!e.target.value) {
                        handleSelectCommessa('')
                      }
                    }}
                    onFocus={() => setShowCommessaAutocomplete(true)}
                    onBlur={() => {
                      setTimeout(() => setShowCommessaAutocomplete(false), 200)
                    }}
                    placeholder={selectedClienteId ? 'Cerca commessa del cliente...' : 'Seleziona prima un cliente'}
                    disabled={!selectedClienteId || loading}
                  />
                  {showCommessaAutocomplete && filteredCommesseByCliente.length > 0 && (
                    <div className="autocomplete-list">
                      {filteredCommesseByCliente.map((commessa) => (
                        <div
                          key={commessa.id}
                          className="autocomplete-item"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleCommessaSelect(commessa)
                          }}
                        >
                          <strong>{commessa.titolo}</strong>
                          {commessa.cliente_nome && (
                            <div className="commessa-meta">{commessa.cliente_nome}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {selectedCommessa && (
                <div className="tracking-summary">
                  <div className="tracking-summary-title">{selectedCommessa.titolo}</div>
                  <div className="tracking-summary-meta">
                    <span>{selectedCommessa.cliente_nome || 'Cliente non indicato'}</span>
                  </div>
                  <div className="tracking-summary-stats">
                    <div>
                      <div className="tracking-summary-label">Ore registrate</div>
                      <div className="tracking-summary-value">{totalTrackedHours.toFixed(2)} h</div>
                    </div>
                    <div>
                      <div className="tracking-summary-label">Monte ore stimato</div>
                      <div className="tracking-summary-value">
                        {estimatedHours ? `${estimatedHours.toFixed(2)} h` : 'Non impostato'}
                      </div>
                    </div>
                  </div>
                  {estimatedHours ? (
                    <>
                      <div className="progress-track">
                        <div
                          className="progress-bar"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="progress-label">
                        {progressPercent.toFixed(0)}% completato
                      </div>
                    </>
                  ) : (
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      Inserisci il monte ore stimato per vedere l\'avanzamento.
                    </div>
                  )}
                </div>
              )}
              <div className="tracking-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStart}
                  disabled={!selectedId || (activeEntry && !activeOnSelected)}
                >
                  Avvia tracking
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleStop}
                  disabled={!activeOnSelected}
                >
                  Ferma tracking
                </button>
              </div>
              {activeEntry && !activeOnSelected && (
                <div className="alert alert-info mt-3">
                  Tracking attivo su un\'altra commessa. Ferma prima di iniziarne uno nuovo.
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">Inserisci ore manualmente</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Data</label>
                  <input
                    type="date"
                    className="form-control"
                    value={manualForm.data}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, data: e.target.value }))}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Ore</label>
                  <input
                    type="number"
                    className="form-control"
                    value={manualForm.ore}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, ore: e.target.value }))}
                    min="0"
                    step="0.25"
                    placeholder="Es. 2.5"
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Nota</label>
                  <input
                    className="form-control"
                    value={manualForm.note}
                    onChange={(e) => setManualForm((prev) => ({ ...prev, note: e.target.value }))}
                    placeholder="Facoltativo"
                  />
                </div>
              </div>
              <div className="d-grid mt-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleManualSubmit}
                  disabled={!selectedId || manualSaving}
                >
                  {manualSaving ? 'Salvataggio...' : 'Aggiungi ore'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="tracking-panel">
          <div className="card">
            <div className="card-header">Storico ore</div>
            <div className="card-body">
              {!selectedId && (
                <div className="alert alert-info mb-0">Seleziona una commessa per visualizzare le ore.</div>
              )}
              {selectedId && entriesLoading && (
                <div className="text-muted">Caricamento ore...</div>
              )}
              {selectedId && !entriesLoading && entries.length === 0 && (
                <div className="text-muted">Nessuna ora registrata.</div>
              )}
              {selectedId && !entriesLoading && entries.length > 0 && (
                <div className="attivita-table-scroll">
                  <table className="table table-striped commesse-table">
                    <thead className="table-dark visually-hidden">
                      <tr>
                        <th>Data</th>
                        <th>Ore</th>
                        <th>Tipo</th>
                        <th>Utente</th>
                        <th>Note</th>
                        <th>Inizio</th>
                        <th>Fine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <div className="commessa-title">{formatEntryDate(entry)}</div>
                          </td>
                          <td>
                            <div className="commessa-title">{formatEntryHours(entry)} h</div>
                          </td>
                          <td>
                            <span className="status-badge status-open">
                              {entry.source === 'manual' ? 'Manuale' : 'Timer'}
                            </span>
                          </td>
                          <td>
                            <div className="commessa-meta">{getUserLabel(entry)}</div>
                          </td>
                          <td>
                            <div className="commessa-meta">{entry.note || '-'}</div>
                          </td>
                          <td>
                            <div className="commessa-meta">{formatDateTime(entry.start_time)}</div>
                          </td>
                          <td>
                            <div className="commessa-meta">
                              {entry.end_time ? formatDateTime(entry.end_time) : 'In corso'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showActiveModal && activeEntry && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1060,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowActiveModal(false)
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '12px' }}>
              <div className="modal-header">
                <h5 className="modal-title">Tracking attivo non fermato</h5>
                <button type="button" className="btn-close" onClick={() => setShowActiveModal(false)} />
              </div>
              <div className="modal-body">
                <p>
                  Hai un tracking in corso da {activeElapsed}.
                </p>
                <div className="tracking-active-summary">
                  <div><strong>Commessa:</strong> {activeEntry.commessa_titolo || `#${activeEntry.commessa_id}`}</div>
                  {activeEntry.cliente_nome && (
                    <div><strong>Cliente:</strong> {activeEntry.cliente_nome}</div>
                  )}
                  <div><strong>Inizio:</strong> {formatDateTime(activeEntry.start_time)}</div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowActiveModal(false)}
                >
                  Lascia attivo
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    handleSelectCommessa(activeEntry.commessa_id)
                    setShowActiveModal(false)
                  }}
                >
                  Vai alla commessa
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    await handleStop()
                    setShowActiveModal(false)
                  }}
                >
                  Ferma ora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrackingOre
