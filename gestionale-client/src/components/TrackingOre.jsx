import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'

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

const roundUpToHalfHour = (hoursValue) => {
  if (!Number.isFinite(hoursValue) || hoursValue <= 0) return 0
  return Math.ceil(hoursValue * 2) / 2
}

function TrackingOre({ clienti, user, toast, selectedCommessaId, onSelectCommessa, onOpenCommessa, onCreateFattura }) {
  const [commesse, setCommesse] = useState([])
  const [selectedId, setSelectedId] = useState(selectedCommessaId ? String(selectedCommessaId) : '')
  const [selectedCommessa, setSelectedCommessa] = useState(null)
  const [entries, setEntries] = useState([])
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeEntries, setActiveEntries] = useState([])
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
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [editingEntry, setEditingEntry] = useState({ data: '', ore: '', note: '' })
  const [editingSaving, setEditingSaving] = useState(false)
  const [deleteEntry, setDeleteEntry] = useState(null)
  const [deleteEntryLoading, setDeleteEntryLoading] = useState(false)
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
        const list = Array.isArray(active) ? active : (active && active.id ? [active] : [])
        setActiveEntries(list)
        setShowActiveModal(list.length > 0)
      } catch (err) {
        console.error('Errore caricamento tracking attivo:', err)
      }
    }
    loadActive()
  }, [])

  const loadEntries = useCallback(async (commessaId) => {
    if (!commessaId) return
    try {
      setEntriesLoading(true)
      const data = await api.getCommessaTrackingEntries(commessaId)
      setEntries(data?.entries || [])
      setTotalMinutes(data?.total_minuti || 0)
    } catch (err) {
      console.error('Errore caricamento tracking commessa:', err)
      toast?.showError('Errore nel caricamento delle ore della commessa', 'Tracking ore')
    } finally {
      setEntriesLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!selectedId) {
      setSelectedCommessa(null)
      setEntries([])
      setTotalMinutes(0)
      setEditingEntryId(null)
      return
    }

    const commessa = commesse.find((item) => String(item.id) === String(selectedId))
    setSelectedCommessa(commessa || null)
    if (commessa?.titolo) {
      setCommessaSearch(commessa.titolo)
    }

    loadEntries(selectedId)
  }, [selectedId, commesse, loadEntries])

  useEffect(() => {
    if (!activeEntries.length) return undefined
    const interval = setInterval(() => {
      setTick((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [activeEntries])

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
    const runningEntry = activeEntries.find((entry) => String(entry.commessa_id) === String(selectedId))
    const runningMinutes = runningEntry
      ? getEntryMinutes(runningEntry)
      : 0
    return (totalMinutes + runningMinutes) / 60
  }, [activeEntries, selectedId, totalMinutes, tick])

  const roundedTrackedHours = useMemo(() => roundUpToHalfHour(totalTrackedHours), [totalTrackedHours])

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
    return roundUpToHalfHour(minutes / 60).toFixed(2)
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

  const handleOpenCommessa = () => {
    if (!selectedCommessa?.id || !onOpenCommessa) return
    onOpenCommessa(selectedCommessa.id)
  }

  const handleCreateFattura = () => {
    if (!selectedCommessa?.id || !onCreateFattura) return
    const amount = Number(String(selectedCommessa.importo_totale || 0).replace(',', '.')) || 0
    const draft = {
      clienteId: selectedCommessa.cliente_id,
      commessaIds: [selectedCommessa.id],
      items: [
        {
          name: selectedCommessa.titolo || 'Commessa',
          qty: 1,
          net_price: amount
        }
      ],
      visibleSubject: `Commessa ${selectedCommessa.titolo || selectedCommessa.id}`
    }
    onCreateFattura(draft)
  }

  const handleOpenCommessaById = (commessaId) => {
    if (!commessaId || !onOpenCommessa) return
    onOpenCommessa(commessaId)
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
      const list = Array.isArray(active) ? active : (active && active.id ? [active] : [])
      setActiveEntries(list)
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
      await loadEntries(selectedId)
    } catch (err) {
      if (err.status === 409) {
        toast?.showError(err.message || 'Tracking già attivo su questa commessa.', 'Tracking ore')
        await refreshActive()
        setShowActiveModal(true)
      } else {
        toast?.showError(err.message || 'Errore nell\'avvio del tracking', 'Tracking ore')
      }
    }
  }

  const handleStopEntry = async (entry) => {
    if (!entry?.id) return
    try {
      await api.stopTracking(entry.id, entry.row_version)
      toast?.showSuccess('Tracking fermato', 'Tracking ore')
      await refreshActive()
      if (selectedId) {
        await loadEntries(selectedId)
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
    const roundedHours = roundUpToHalfHour(oreValue)
    try {
      setManualSaving(true)
      await api.addTrackingManual(selectedId, manualForm.data, roundedHours, manualForm.note)
      toast?.showSuccess('Ore registrate', 'Tracking ore')
      setManualForm({ data: getTodayDate(), ore: '', note: '' })
      await loadEntries(selectedId)
    } catch (err) {
      toast?.showError(err.message || 'Errore nel salvataggio ore', 'Tracking ore')
    } finally {
      setManualSaving(false)
    }
  }

  const handleEditEntry = (entry) => {
    if (!entry?.id) return
    const minutes = Number.isFinite(entry.durata_minuti) ? entry.durata_minuti : getEntryMinutes(entry)
    setEditingEntryId(entry.id)
    setEditingEntry({
      data: entry.data || getTodayDate(),
      ore: (minutes / 60).toFixed(2),
      note: entry.note || ''
    })
  }

  const handleCancelEdit = () => {
    setEditingEntryId(null)
    setEditingEntry({ data: '', ore: '', note: '' })
  }

  const handleSaveEdit = async (entryId) => {
    if (!entryId) return
    try {
      setEditingSaving(true)
      const payload = {
        note: editingEntry.note
      }
      if (editingEntry.data) {
        payload.data = editingEntry.data
      }
      if (editingEntry.ore !== '') {
        const oreValue = Number(String(editingEntry.ore || '').replace(',', '.'))
        payload.ore = roundUpToHalfHour(oreValue).toFixed(2)
      }
      await api.updateTrackingEntry(entryId, { ...payload, row_version: editingEntry?.row_version })
      toast?.showSuccess('Tracking aggiornato', 'Tracking ore')
      handleCancelEdit()
      await loadEntries(selectedId)
    } catch (err) {
      toast?.showError(err.message || 'Errore aggiornamento tracking', 'Tracking ore')
      if (err?.status === 409) {
        await loadEntries(selectedId)
      }
    } finally {
      setEditingSaving(false)
    }
  }

  const handleDeleteEntry = (entry) => {
    if (!entry?.id) return
    setDeleteEntry(entry)
  }

  const confirmDeleteEntry = async () => {
    if (!deleteEntry?.id) return
    try {
      setDeleteEntryLoading(true)
      await api.deleteTrackingEntry(deleteEntry.id)
      toast?.showSuccess('Tracking eliminato', 'Tracking ore')
      await loadEntries(selectedId)
    } catch (err) {
      toast?.showError(err.message || 'Errore eliminazione tracking', 'Tracking ore')
    } finally {
      setDeleteEntryLoading(false)
      setDeleteEntry(null)
    }
  }

  const activeOnSelected = activeEntries.find((entry) => String(entry.commessa_id) === String(selectedId))
  const activeElapsed = activeOnSelected ? formatMinutes(getEntryMinutes(activeOnSelected)) : ''

  return (
    <div className="tracking-section">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Tracking ore</h2>
        {activeEntries.length > 0 && (
          <div className="tracking-active-pill">
            <span>Tracking attivi</span>
            <strong>{activeEntries.length}</strong>
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
                  <div
                    className="tracking-summary-title"
                    role={onOpenCommessa ? 'button' : undefined}
                    tabIndex={onOpenCommessa ? 0 : undefined}
                    style={onOpenCommessa ? { cursor: 'pointer' } : undefined}
                    onClick={handleOpenCommessa}
                    onKeyDown={(event) => {
                      if (!onOpenCommessa) return
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleOpenCommessa()
                      }
                    }}
                  >
                    {selectedCommessa.titolo}
                  </div>
                  <div className="tracking-summary-meta">
                    <span>{selectedCommessa.cliente_nome || 'Cliente non indicato'}</span>
                  </div>
                  <div className="tracking-summary-stats">
                    <div>
                      <div className="tracking-summary-label">Ore registrate</div>
                    <div className="tracking-summary-value">{roundedTrackedHours.toFixed(2)} h</div>
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
                      Inserisci il monte ore stimato per vedere l'avanzamento.
                    </div>
                  )}
                  {onOpenCommessa && (
                    <button
                      type="button"
                      className="btn btn-link p-0 mt-2"
                      onClick={handleOpenCommessa}
                    >
                      Apri scheda commessa
                    </button>
                  )}
                  {onCreateFattura && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm mt-2"
                      onClick={handleCreateFattura}
                    >
                      Crea fattura
                    </button>
                  )}
                </div>
              )}
              <div className="tracking-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStart}
                  disabled={!selectedId || !!activeOnSelected}
                >
                  Avvia tracking
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleStopEntry(activeOnSelected)}
                  disabled={!activeOnSelected}
                >
                  Ferma tracking
                </button>
              </div>
              {activeEntries.length > 0 && (
                <div className="tracking-active-summary mt-3">
                  <div className="fw-semibold mb-2">Tracking attivi</div>
                  {activeEntries.map((entry) => (
                    <div key={entry.id} className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <div>
                          {onOpenCommessa ? (
                            <button
                              type="button"
                              className="btn btn-link p-0 fw-semibold text-start"
                              onClick={() => handleOpenCommessaById(entry.commessa_id)}
                            >
                              {entry.commessa_titolo || `#${entry.commessa_id}`}
                            </button>
                          ) : (
                            <strong>{entry.commessa_titolo || `#${entry.commessa_id}`}</strong>
                          )}
                        </div>
                        {entry.cliente_nome && (
                          <div className="commessa-meta">{entry.cliente_nome}</div>
                        )}
                        <div className="commessa-meta">In corso da {formatMinutes(getEntryMinutes(entry))}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleStopEntry(entry)}
                      >
                        Ferma
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">Inserisci ore manualmente</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Commessa</label>
                  <select
                    className="form-select"
                    value={selectedId}
                    onChange={(e) => handleSelectCommessa(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Seleziona commessa</option>
                    {(selectedClienteId ? filteredCommesseByCliente : commesse).map((commessa) => (
                      <option key={commessa.id} value={commessa.id}>
                        {commessa.titolo || `Commessa #${commessa.id}`}
                        {commessa.cliente_nome ? ` — ${commessa.cliente_nome}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
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
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            {editingEntryId === entry.id ? (
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={editingEntry.data}
                                onChange={(e) => setEditingEntry((prev) => ({ ...prev, data: e.target.value }))}
                              />
                            ) : (
                              <div className="commessa-meta">{formatEntryDate(entry)}</div>
                            )}
                          </td>
                          <td>
                            {editingEntryId === entry.id ? (
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                value={editingEntry.ore}
                                onChange={(e) => setEditingEntry((prev) => ({ ...prev, ore: e.target.value }))}
                                min="0"
                                step="0.25"
                              />
                            ) : (
                              <div className="commessa-meta">{formatEntryHours(entry)} h</div>
                            )}
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
                            {editingEntryId === entry.id ? (
                              <input
                                className="form-control form-control-sm"
                                value={editingEntry.note}
                                onChange={(e) => setEditingEntry((prev) => ({ ...prev, note: e.target.value }))}
                                placeholder="Nota"
                              />
                            ) : (
                              <div className="commessa-meta">{entry.note || '-'}</div>
                            )}
                          </td>
                          <td>
                            <div className="commessa-meta">{formatDateTime(entry.start_time)}</div>
                          </td>
                          <td>
                            <div className="commessa-meta">
                              {entry.end_time ? formatDateTime(entry.end_time) : 'In corso'}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex gap-2 justify-content-center">
                              {editingEntryId === entry.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    onClick={() => handleSaveEdit(entry.id)}
                                    disabled={editingSaving}
                                  >
                                    Salva
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={handleCancelEdit}
                                    disabled={editingSaving}
                                  >
                                    Annulla
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => handleEditEntry(entry)}
                                    disabled={!entry.end_time}
                                  >
                                    Modifica
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDeleteEntry(entry)}
                                    disabled={!entry.end_time}
                                  >
                                    Elimina
                                  </button>
                                </>
                              )}
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

      {showActiveModal && activeEntries.length > 0 && (
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
                <p>Hai {activeEntries.length} tracking attivi.</p>
                <div className="tracking-active-summary">
                  {activeEntries.map((entry) => (
                    <div key={entry.id} className="mb-3">
                      <div>
                        <strong>Commessa:</strong>{' '}
                        {onOpenCommessa ? (
                          <button
                            type="button"
                            className="btn btn-link p-0 align-baseline"
                            onClick={() => handleOpenCommessaById(entry.commessa_id)}
                          >
                            {entry.commessa_titolo || `#${entry.commessa_id}`}
                          </button>
                        ) : (
                          entry.commessa_titolo || `#${entry.commessa_id}`
                        )}
                      </div>
                      {entry.cliente_nome && (
                        <div><strong>Cliente:</strong> {entry.cliente_nome}</div>
                      )}
                      <div><strong>Inizio:</strong> {formatDateTime(entry.start_time)}</div>
                      <div><strong>In corso da:</strong> {formatMinutes(getEntryMinutes(entry))}</div>
                    </div>
                  ))}
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
                {activeEntries.length === 1 && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        handleSelectCommessa(activeEntries[0].commessa_id)
                        setShowActiveModal(false)
                      }}
                    >
                      Vai alla commessa
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        await handleStopEntry(activeEntries[0])
                        setShowActiveModal(false)
                      }}
                    >
                      Ferma ora
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        show={Boolean(deleteEntry)}
        title="Elimina tracking"
        message="Eliminare questa riga di tracking?"
        loading={deleteEntryLoading}
        onClose={() => {
          if (!deleteEntryLoading) setDeleteEntry(null)
        }}
        onConfirm={confirmDeleteEntry}
      />
    </div>
  )
}

export default TrackingOre
