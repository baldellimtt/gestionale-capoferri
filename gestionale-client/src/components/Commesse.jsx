import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'

const STATI_COMMESSA = ['In corso', 'Chiusa']
const STATI_PAGAMENTI = ['Non iniziato', 'Parziale', 'Saldo']
const SOTTOSTATI_IN_CORSO = [
  'Piano di sicurezza',
  'Pratica strutturale',
  'Variante pratica edilizia',
  'Variante pratica strutturale',
  'Fine lavori',
  'Accatastamento',
  'Relazione di calcolo',
  'Documentazione per pratica strutturale',
  'Documentazione per pratica edilizia',
  'In attesa di approvazione',
  'Personalizzato'
]

const createEmptyForm = () => ({
  titolo: '',
  cliente_id: '',
  cliente_nome: '',
  stato: 'In corso',
  sotto_stato: '',
  sotto_stato_custom: '',
  stato_pagamenti: 'Non iniziato',
  preventivo: false,
  importo_preventivo: '',
  importo_totale: '',
  importo_pagato: '',
  avanzamento_lavori: 0,
  responsabile: '',
  data_inizio: '',
  data_fine: '',
  note: '',
  allegati: ''
})

function Commesse({ clienti }) {
  const [commesse, setCommesse] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ clienteId: '', stato: '' })
  const [clienteFilterInput, setClienteFilterInput] = useState('')
  const [showClienteFilterAutocomplete, setShowClienteFilterAutocomplete] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(createEmptyForm())
  const [initialFormData, setInitialFormData] = useState(createEmptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null })
  const [deleting, setDeleting] = useState(false)
  const [allegatiByCommessa, setAllegatiByCommessa] = useState({})
  const [uploading, setUploading] = useState({})
  const [allegatiError, setAllegatiError] = useState(null)
  const [selectedCommessaId, setSelectedCommessaId] = useState('')
  const [utenti, setUtenti] = useState([])

  const loadCommesse = async (nextFilters = filters) => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getCommesse(nextFilters)
      setCommesse(data)
    } catch (err) {
      console.error('Errore caricamento commesse:', err)
      setError('Errore nel caricamento delle commesse. Verifica che il server sia avviato.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCommesse()
  }, [])

  useEffect(() => {
    loadCommesse(filters)
  }, [filters])

  useEffect(() => {
    const loadUtenti = async () => {
      try {
        const data = await api.getUtenti()
        setUtenti(data || [])
      } catch (err) {
        console.warn('Impossibile caricare utenti per responsabile:', err)
        setUtenti([])
      }
    }
    loadUtenti()
  }, [])

  useEffect(() => {
    if (formData.stato === 'Chiusa' && formData.sotto_stato) {
      setFormData((prev) => ({ ...prev, sotto_stato: '', sotto_stato_custom: '' }))
    }
  }, [formData.stato, formData.sotto_stato])

  useEffect(() => {
    if (commesse.length === 0) {
      setAllegatiByCommessa({})
      return
    }

    const loadAll = async () => {
      try {
        const results = await Promise.all(
          commesse.map(async (commessa) => {
            const allegati = await api.getCommessaAllegati(commessa.id)
            return [commessa.id, allegati]
          })
        )
        const next = {}
        results.forEach(([id, allegati]) => {
          next[id] = allegati
        })
        setAllegatiByCommessa(next)
      } catch (err) {
        console.error('Errore caricamento allegati:', err)
        setAllegatiError('Errore nel caricamento degli allegati.')
      }
    }

    loadAll()
  }, [commesse])

  useEffect(() => {
    if (!editingId) {
      setSelectedCommessaId('')
    }
  }, [editingId])

  const parseNumber = (value) => {
    if (value == null || value === '') return 0
    const parsed = Number(String(value).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : NaN
  }

  const clampPercent = (value) => {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(100, parsed))
  }

  const resetForm = () => {
    const empty = createEmptyForm()
    setFormData(empty)
    setInitialFormData(empty)
    setEditingId(null)
    setShowForm(false)
    setSelectedCommessaId('')
  }

  const handleClienteChange = (value) => {
    if (!value) {
      setFormData((prev) => ({ ...prev, cliente_id: '', cliente_nome: '' }))
      return
    }
    const selected = clienti.find((cliente) => String(cliente.id) === String(value))
    setFormData((prev) => ({
      ...prev,
      cliente_id: selected?.id || '',
      cliente_nome: selected?.denominazione || ''
    }))
  }

  const handleClienteFilterChange = (value) => {
    setClienteFilterInput(value)
    if (!value) {
      setFilters((prev) => ({ ...prev, clienteId: '' }))
      setShowClienteFilterAutocomplete(false)
      return
    }

    const match = clienti.find(
      (cliente) => cliente.denominazione?.toLowerCase() === value.toLowerCase()
    )
    if (match) {
      setFilters((prev) => ({ ...prev, clienteId: match.id }))
    } else {
      setFilters((prev) => ({ ...prev, clienteId: '' }))
    }
    setShowClienteFilterAutocomplete(true)
  }

  const handleSubmit = async () => {
    if (!formData.titolo.trim()) {
      setError('Titolo commessa obbligatorio.')
      return
    }

    const importoPreventivo = parseNumber(formData.importo_preventivo)
    const importoTotale = parseNumber(formData.importo_totale)
    const importoPagato = parseNumber(formData.importo_pagato)

    if ([importoPreventivo, importoTotale, importoPagato].some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Importi non validi.')
      return
    }

    const resolvedSottoStato = formData.sotto_stato === 'Personalizzato'
      ? formData.sotto_stato_custom
      : formData.sotto_stato

    const payload = {
      ...formData,
      titolo: formData.titolo.trim(),
      cliente_id: formData.cliente_id || null,
      cliente_nome: formData.cliente_nome || null,
      sotto_stato: formData.stato === 'Chiusa' ? null : (resolvedSottoStato || null),
      stato_pagamenti: formData.stato_pagamenti || 'Non iniziato',
      preventivo: !!formData.preventivo,
      importo_preventivo: importoPreventivo,
      importo_totale: importoTotale,
      importo_pagato: importoPagato,
      avanzamento_lavori: clampPercent(formData.avanzamento_lavori),
      note: formData.note || null,
      allegati: formData.allegati || null
    }

    try {
      setSaving(true)
      setError(null)
      if (editingId) {
        const updated = await api.updateCommessa(editingId, payload)
        setCommesse((prev) => prev.map((item) => (item.id === editingId ? updated : item)))
      } else {
        const created = await api.createCommessa(payload)
        setCommesse((prev) => [created, ...prev])
      }
      resetForm()
    } catch (err) {
      console.error('Errore salvataggio commessa:', err)
      setError(err.message || 'Errore nel salvataggio della commessa.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (commessa) => {
    const isCustomSottoStato = commessa.sotto_stato
      && !SOTTOSTATI_IN_CORSO.filter((item) => item !== 'Personalizzato').includes(commessa.sotto_stato)
    const nextForm = {
      titolo: commessa.titolo || '',
      cliente_id: commessa.cliente_id || '',
      cliente_nome: commessa.cliente_nome || '',
      stato: commessa.stato || 'In corso',
      sotto_stato: isCustomSottoStato ? 'Personalizzato' : (commessa.sotto_stato || ''),
      sotto_stato_custom: isCustomSottoStato ? commessa.sotto_stato : '',
      stato_pagamenti: commessa.stato_pagamenti || 'Non iniziato',
      preventivo: !!commessa.preventivo,
      importo_preventivo: commessa.importo_preventivo ?? 0,
      importo_totale: commessa.importo_totale ?? 0,
      importo_pagato: commessa.importo_pagato ?? 0,
      avanzamento_lavori: commessa.avanzamento_lavori ?? 0,
      responsabile: commessa.responsabile || '',
      data_inizio: commessa.data_inizio || '',
      data_fine: commessa.data_fine || '',
      note: commessa.note || '',
      allegati: commessa.allegati || ''
    }
    setEditingId(commessa.id)
    setShowForm(true)
    setSelectedCommessaId(String(commessa.id))
    setFormData(nextForm)
    setInitialFormData(nextForm)
  }

  const handleDelete = (commessa) => {
    setDeleteConfirm({ show: true, id: commessa.id })
  }

  const handleUpload = async (commessaId, file) => {
    if (!file) return
    setUploading((prev) => ({ ...prev, [commessaId]: true }))
    setAllegatiError(null)
    try {
      const created = await api.uploadCommessaAllegato(commessaId, file)
      setAllegatiByCommessa((prev) => ({
        ...prev,
        [commessaId]: [created, ...(prev[commessaId] || [])]
      }))
    } catch (err) {
      console.error('Errore upload allegato:', err)
      setAllegatiError(err.message || 'Errore nel caricamento allegato.')
    } finally {
      setUploading((prev) => ({ ...prev, [commessaId]: false }))
    }
  }

  const handleDeleteAllegato = async (commessaId, allegatoId) => {
    try {
      await api.deleteCommessaAllegato(allegatoId)
      setAllegatiByCommessa((prev) => ({
        ...prev,
        [commessaId]: (prev[commessaId] || []).filter((item) => item.id !== allegatoId)
      }))
    } catch (err) {
      console.error('Errore eliminazione allegato:', err)
      setAllegatiError(err.message || 'Errore eliminazione allegato.')
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) {
      setDeleteConfirm({ show: false, id: null })
      return
    }

    try {
      setDeleting(true)
      await api.deleteCommessa(deleteConfirm.id)
      setCommesse((prev) => prev.filter((item) => item.id !== deleteConfirm.id))
    } catch (err) {
      console.error('Errore eliminazione commessa:', err)
      setError(err.message || 'Errore nell\'eliminazione della commessa.')
    } finally {
      setDeleting(false)
      setDeleteConfirm({ show: false, id: null })
    }
  }

  const commesseSorted = useMemo(() => {
    return [...commesse].sort((a, b) => {
      const dateA = a.data_inizio || ''
      const dateB = b.data_inizio || ''
      if (dateA !== dateB) return dateB.localeCompare(dateA)
      return Number(b.id) - Number(a.id)
    })
  }, [commesse])

  const uploadsBase = api.baseURL.replace(/\/api\/?$/, '') + '/uploads'
  const selectedCommessa = commesse.find((item) => String(item.id) === String(selectedCommessaId))
  const selectedAllegati = selectedCommessa ? (allegatiByCommessa[selectedCommessa.id] || []) : []
  const getUtenteLabel = (utente) => {
    const fullName = [utente?.nome, utente?.cognome].filter(Boolean).join(' ').trim()
    return fullName || utente?.username || ''
  }
  const toSlug = (value) => (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const getStatoClass = (value) => (value === 'Chiusa' ? 'status-closed' : 'status-open')
  const getSottoStatoClass = (value) => (value ? `substatus-${toSlug(value)}` : '')
  const normalizeForm = (data) => {
    const normalized = {
      titolo: (data.titolo || '').trim(),
      cliente_id: data.cliente_id || '',
      cliente_nome: data.cliente_nome || '',
      stato: data.stato || 'In corso',
      sotto_stato: data.sotto_stato || '',
      sotto_stato_custom: data.sotto_stato_custom || '',
      stato_pagamenti: data.stato_pagamenti || 'Non iniziato',
      preventivo: !!data.preventivo,
      importo_preventivo: Number(String(data.importo_preventivo ?? 0).replace(',', '.')) || 0,
      importo_totale: Number(String(data.importo_totale ?? 0).replace(',', '.')) || 0,
      importo_pagato: Number(String(data.importo_pagato ?? 0).replace(',', '.')) || 0,
      avanzamento_lavori: Number.parseInt(data.avanzamento_lavori ?? 0, 10) || 0,
      responsabile: data.responsabile || '',
      data_inizio: data.data_inizio || '',
      data_fine: data.data_fine || '',
      note: data.note || '',
      allegati: data.allegati || ''
    }
    return normalized
  }

  const isDirty = useMemo(() => {
    return JSON.stringify(normalizeForm(formData)) !== JSON.stringify(normalizeForm(initialFormData))
  }, [formData, initialFormData])

  const canSave = isDirty && formData.titolo.trim() !== '' && !saving
  const filteredClienti = useMemo(() => {
    if (!clienteFilterInput) return []
    const search = clienteFilterInput.toLowerCase()
    return clienti
      .filter((cliente) => cliente.denominazione?.toLowerCase().includes(search))
      .slice(0, 10)
  }, [clienteFilterInput, clienti])

  const truncate = (value, max = 80) => {
    if (!value) return ''
    return value.length > max ? `${value.slice(0, max)}…` : value
  }

  return (
    <div className="commesse-section">
      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}
      {allegatiError && (
        <div className="alert alert-warning mb-3">
          {allegatiError}
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Commesse</h2>
        <div className="d-flex gap-2">
          {showForm ? (
            <button className="btn btn-secondary" onClick={resetForm}>
              Torna alla lista
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => {
                const empty = createEmptyForm()
                setFormData(empty)
                setInitialFormData(empty)
                setEditingId(null)
                setShowForm(true)
                setSelectedCommessaId('')
              }}
            >
              + Nuova Commessa
            </button>
          )}
        </div>
      </div>

      {!showForm && (
        <div className="filters-section">
          <label>Cliente:</label>
          <div className="autocomplete-container" style={{ width: 'auto' }}>
            <input
              className="form-control"
              value={clienteFilterInput}
              onChange={(e) => handleClienteFilterChange(e.target.value)}
              onFocus={() => setShowClienteFilterAutocomplete(true)}
              onBlur={() => {
                setTimeout(() => setShowClienteFilterAutocomplete(false), 200)
              }}
              placeholder="Cerca cliente..."
              style={{ width: 'auto' }}
            />
            {showClienteFilterAutocomplete && filteredClienti.length > 0 && (
              <div className="autocomplete-list">
                {filteredClienti.map((cliente) => (
                  <div
                    key={cliente.id}
                    className="autocomplete-item"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setClienteFilterInput(cliente.denominazione)
                      setFilters((prev) => ({ ...prev, clienteId: cliente.id }))
                      setShowClienteFilterAutocomplete(false)
                    }}
                  >
                    {cliente.denominazione}
                  </div>
                ))}
              </div>
            )}
          </div>
          <label>Stato:</label>
          <select
            className="form-select"
            value={filters.stato}
            onChange={(e) => setFilters((prev) => ({ ...prev, stato: e.target.value }))}
            style={{ width: 'auto' }}
          >
            <option value="">Tutti</option>
            {STATI_COMMESSA.map((stato) => (
              <option key={stato} value={stato}>{stato}</option>
            ))}
          </select>
        </div>
      )}

      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            {editingId ? 'Modifica commessa' : 'Nuova commessa'}
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Titolo commessa</label>
                <input
                  className="form-control"
                  value={formData.titolo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, titolo: e.target.value }))}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Cliente</label>
                <select
                  className="form-select"
                  value={formData.cliente_id}
                  onChange={(e) => handleClienteChange(e.target.value)}
                >
                  <option value="">Seleziona cliente</option>
                  {clienti.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>{cliente.denominazione}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Stato</label>
                <select
                  className={`form-select stato-select ${getStatoClass(formData.stato)}`}
                  value={formData.stato}
                  onChange={(e) => setFormData((prev) => ({ ...prev, stato: e.target.value }))}
                >
                  {STATI_COMMESSA.map((stato) => (
                    <option key={stato} value={stato}>{stato}</option>
                  ))}
                </select>
              </div>
              {formData.stato === 'In corso' && (
                <div className="col-md-3">
                  <label className="form-label">Sotto-stato</label>
                  <select
                    className={`form-select sottostato-select ${getSottoStatoClass(formData.sotto_stato === 'Personalizzato' ? formData.sotto_stato_custom : formData.sotto_stato)}`}
                    value={formData.sotto_stato}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sotto_stato: e.target.value }))}
                  >
                    <option value="">Seleziona...</option>
                    {SOTTOSTATI_IN_CORSO.map((stato) => (
                      <option key={stato} value={stato}>{stato}</option>
                    ))}
                  </select>
                </div>
              )}
              {formData.stato === 'In corso' && formData.sotto_stato === 'Personalizzato' && (
                <div className="col-md-6">
                  <label className="form-label">Sotto-stato personalizzato</label>
                  <input
                    className="form-control"
                    value={formData.sotto_stato_custom}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sotto_stato_custom: e.target.value }))}
                    placeholder="Inserisci sottostato"
                  />
                </div>
              )}
              <div className="col-md-3">
                <label className="form-label">Preventivo</label>
                <select
                  className="form-select"
                  value={formData.preventivo ? 'si' : 'no'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, preventivo: e.target.value === 'si' }))}
                >
                  <option value="si">Sì</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Importo preventivo (€)</label>
                <input
                  className="form-control"
                  value={formData.importo_preventivo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, importo_preventivo: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Importo totale (€)</label>
                <input
                  className="form-control"
                  value={formData.importo_totale}
                  onChange={(e) => setFormData((prev) => ({ ...prev, importo_totale: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Importo pagato (€)</label>
                <input
                  className="form-control"
                  value={formData.importo_pagato}
                  onChange={(e) => setFormData((prev) => ({ ...prev, importo_pagato: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Stato pagamenti</label>
                <select
                  className="form-select"
                  value={formData.stato_pagamenti}
                  onChange={(e) => setFormData((prev) => ({ ...prev, stato_pagamenti: e.target.value }))}
                >
                  {STATI_PAGAMENTI.map((stato) => (
                    <option key={stato} value={stato}>{stato}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Responsabile</label>
                <select
                  className="form-select"
                  value={formData.responsabile}
                  onChange={(e) => setFormData((prev) => ({ ...prev, responsabile: e.target.value }))}
                >
                  <option value="">Seleziona responsabile</option>
                  {utenti.map((utente) => {
                    const label = getUtenteLabel(utente)
                    return (
                      <option key={utente.id} value={label}>
                        {label}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Data inizio</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.data_inizio}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_inizio: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Data fine</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.data_fine}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_fine: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Note</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.note}
                  onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Riferimenti (link o note extra)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.allegati}
                  onChange={(e) => setFormData((prev) => ({ ...prev, allegati: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 d-flex gap-2">
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSave}>
              {saving ? 'Salvataggio...' : editingId ? 'Salva modifiche' : 'Crea commessa'}
            </button>
              {editingId && (
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete({ id: editingId })}
                  disabled={saving}
                >
                  Elimina
                </button>
              )}
              <button className="btn btn-secondary" onClick={resetForm} disabled={saving}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && editingId && (
        <div className="card mb-4">
          <div className="card-header">Allegati commessa</div>
          <div className="card-body">
            {!selectedCommessa ? (
              <div className="alert alert-info">Seleziona una commessa per vedere gli allegati.</div>
            ) : (
              <>
                <div className="row g-3 align-items-end">
                  <div className="col-md-12">
                    <label className="form-label">Carica nuovo allegato</label>
                    <div className="commessa-attachment-actions">
                      <input
                        id="commessa-file-global"
                        type="file"
                        className="commessa-file-input"
                        onChange={(e) => handleUpload(selectedCommessaId, e.target.files?.[0])}
                        disabled={!selectedCommessaId || uploading[selectedCommessaId]}
                      />
                      <label
                        className="btn btn-secondary btn-sm btn-icon"
                        htmlFor="commessa-file-global"
                        title="Carica allegato"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10.5V16a5 5 0 0 1-5 5H8a5 5 0 0 1 0-10h8a3 3 0 0 1 0 6H9a1 1 0 0 1 0-2h7" />
                        </svg>
                      </label>
                      {uploading[selectedCommessaId] && (
                        <span className="commessa-meta">Caricamento...</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="commessa-attachments mt-4">
                  <div className="commessa-meta">
                    Allegati per: {selectedCommessa.titolo}
                  </div>
                  {selectedAllegati.length === 0 && (
                    <div className="commessa-meta">Nessun allegato presente.</div>
                  )}
                  {selectedAllegati.length > 0 && (
                    <ul className="commessa-attachments-list">
                      {selectedAllegati.map((allegato) => (
                        <li key={allegato.id}>
                          <a
                            href={`${uploadsBase}/${allegato.file_path}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {allegato.original_name}
                          </a>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteAllegato(selectedCommessa.id, allegato.id)}
                          >
                            Rimuovi
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!showForm && (
        <div className="attivita-table-container">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Caricamento...</span>
            </div>
          </div>
        ) : commesseSorted.length === 0 ? (
          <div className="alert alert-info mt-3">
            Nessuna commessa presente.
          </div>
        ) : (
          <div className="attivita-table-scroll">
            <table className="table table-dark attivita-table commesse-table">
              <thead>
                <tr>
                  <th>Commessa</th>
                  <th>Cliente</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {commesseSorted.map((commessa) => {
                  const totale = Number(commessa.importo_totale || 0)
                  const pagato = Number(commessa.importo_pagato || 0)
                  const allegati = allegatiByCommessa[commessa.id] || []
                  return (
                    <tr
                      key={commessa.id}
                      className="commessa-row"
                      onClick={() => handleEdit(commessa)}
                    >
                      <td>
                        <div className="commessa-title">{commessa.titolo}</div>
                        {commessa.responsabile && (
                          <div className="commessa-meta">Responsabile: {commessa.responsabile}</div>
                        )}
                        {commessa.stato === 'In corso' && commessa.sotto_stato && (
                          <div className="commessa-meta">Sotto-stato: {commessa.sotto_stato}</div>
                        )}
                        {commessa.note && (
                          <div className="commessa-meta">{commessa.note}</div>
                        )}
                        {allegati.length > 0 && (
                          <div className="commessa-meta">Allegati: {allegati.length}</div>
                        )}
                      </td>
                      <td>{commessa.cliente_nome || '-'}</td>
                      <td>
                        <span className={`status-badge ${getStatoClass(commessa.stato)}`}>
                          {commessa.stato || 'In corso'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      <ConfirmDeleteModal
        show={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  )
}

export default Commesse
