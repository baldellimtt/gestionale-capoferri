import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const CATEGORIE = [
  'Trasferta',
  'Vitto',
  'Alloggio',
  'Carburante',
  'Materiali',
  'Altro'
]

const METODI = ['Carta aziendale', 'Carta personale', 'Contanti', 'Bonifico']

const STATI = ['Bozza', 'Inviata', 'Approvata', 'Rimborsata']

const createEmptyVoce = () => ({
  data: '',
  categoria: 'Trasferta',
  descrizione: '',
  importo: '',
  metodo: 'Carta aziendale',
  rimborsabile: true,
  allegato: null
})

function NoteSpese({ selectedMember, currentUser, toast }) {
  const [voci, setVoci] = useState([])
  const [formData, setFormData] = useState(createEmptyVoce())
  const [showSection, setShowSection] = useState(true)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [filters, setFilters] = useState({ stato: '', categoria: '' })

  const canManageOthers = currentUser?.role === 'admin'
  const effectiveUserId = selectedMember?.id || currentUser?.id || null

  const loadVoci = async () => {
    if (!effectiveUserId) return
    try {
      setLoading(true)
      setError(null)
      const data = await api.getNoteSpese({
        userId: canManageOthers ? effectiveUserId : undefined,
        categoria: filters.categoria || undefined,
        stato: filters.stato || undefined
      })
      setVoci(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Errore caricamento note spese:', err)
      setError('Errore nel caricamento delle note spese.')
      setVoci([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVoci()
  }, [effectiveUserId, filters.categoria, filters.stato])

  const addVoce = async () => {
    setError(null)
    const importo = Number(String(formData.importo || '').replace(',', '.'))
    if (!formData.descrizione.trim() || !Number.isFinite(importo) || importo <= 0) {
      setError('Inserisci descrizione e importo valido.')
      return
    }
    if (!effectiveUserId) {
      setError('Utente non valido.')
      return
    }
    const payload = {
      userId: canManageOthers ? effectiveUserId : undefined,
      data: formData.data || null,
      categoria: formData.categoria,
      descrizione: formData.descrizione.trim(),
      importo,
      metodo_pagamento: formData.metodo,
      rimborsabile: formData.rimborsabile ? 1 : 0,
      stato: 'Bozza'
    }
    try {
      setSaving(true)
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Nuova voce spesa')
      const created = await api.createNotaSpesa(payload)
      if (formData.allegato) {
        await api.uploadNotaSpesaAllegato(created.id, formData.allegato)
      }
      await loadVoci()
      setFormData(createEmptyVoce())
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Voce spesa salvata', duration: 3000 })
      } else {
        toast?.showSuccess('Voce spesa salvata')
      }
    } catch (err) {
      console.error('Errore salvataggio nota spesa:', err)
      const errorMsg = err.message || 'Errore nel salvataggio della voce.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const removeVoce = async (id) => {
    if (!id) return
    try {
      setDeletingId(id)
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Elimina voce spesa')
      await api.deleteNotaSpesa(id)
      await loadVoci()
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Voce eliminata', duration: 3000 })
      } else {
        toast?.showSuccess('Voce eliminata')
      }
    } catch (err) {
      console.error('Errore eliminazione nota spesa:', err)
      const errorMsg = err.message || 'Errore nell\'eliminazione della voce.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredVoci = useMemo(() => {
    return voci.filter((voce) => {
      if (filters.categoria && voce.categoria !== filters.categoria) return false
      if (filters.stato && voce.stato !== filters.stato) return false
      return true
    })
  }, [voci, filters])

  const totale = useMemo(() => {
    return filteredVoci.reduce((sum, voce) => sum + (Number(voce.importo) || 0), 0)
  }, [filteredVoci])

  if (!showSection) {
    return null
  }

  return (
    <div className="note-spese-section">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h3 className="section-title mb-1 no-title-line">Note spese</h3>
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setShowSection(false)}
          >
            Chiudi
          </button>
        </div>
      </div>

      <div className="filters-section note-spese-filters">
        <label>Categoria:</label>
        <select
          className="form-select"
          value={filters.categoria}
          onChange={(e) => setFilters((prev) => ({ ...prev, categoria: e.target.value }))}
          style={{ width: 'auto' }}
        >
          <option value="">Tutte</option>
          {CATEGORIE.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <label>Stato:</label>
        <select
          className="form-select"
          value={filters.stato}
          onChange={(e) => setFilters((prev) => ({ ...prev, stato: e.target.value }))}
          style={{ width: 'auto' }}
        >
          <option value="">Tutti</option>
          {STATI.map((stato) => (
            <option key={stato} value={stato}>{stato}</option>
          ))}
        </select>
      </div>

      <div className="note-spese-layout">
        <div className="card note-spese-form-card">
          <div className="card-header">Nuova voce spesa</div>
          <div className="card-body">
            {error && <div className="alert alert-warning mb-3">{error}</div>}
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Data</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.data}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Categoria</label>
                <select
                  className="form-select"
                  value={formData.categoria}
                  onChange={(e) => setFormData((prev) => ({ ...prev, categoria: e.target.value }))}
                >
                  {CATEGORIE.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Metodo pagamento</label>
                <select
                  className="form-select"
                  value={formData.metodo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, metodo: e.target.value }))}
                >
                  {METODI.map((metodo) => (
                    <option key={metodo} value={metodo}>{metodo}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-8">
                <label className="form-label">Descrizione</label>
                <input
                  className="form-control"
                  value={formData.descrizione}
                  onChange={(e) => setFormData((prev) => ({ ...prev, descrizione: e.target.value }))}
                  placeholder="Dettagli spesa"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Importo (EUR)</label>
                <input
                  className="form-control"
                  value={formData.importo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, importo: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Allegato</label>
                <input
                  type="file"
                  className="form-control"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setFormData((prev) => ({ ...prev, allegato: file }))
                  }}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">&nbsp;</label>
                <div className="d-flex align-items-center note-spese-check-row">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="rimborsabile"
                    checked={formData.rimborsabile}
                    onChange={(e) => setFormData((prev) => ({ ...prev, rimborsabile: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="rimborsabile">
                    Rimborsabile
                  </label>
                </div>
                </div>
              </div>
            </div>
            <div className="actions-sticky mt-4 d-flex gap-2">
              <button type="button" className="btn btn-primary" onClick={addVoce} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Aggiungi voce'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFormData(createEmptyVoce())
                  setError(null)
                }}
                disabled={saving}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        <div className="card note-spese-summary-card">
          <div className="card-header">Riepilogo</div>
          <div className="card-body">
            <div className="note-spese-summary">
              <div className="note-spese-summary-item">
                <span className="note-spese-summary-label">Voci</span>
                <strong>{filteredVoci.length}</strong>
              </div>
              <div className="note-spese-summary-item">
                <span className="note-spese-summary-label">Totale</span>
                <strong>EUR {totale.toFixed(2)}</strong>
              </div>
              <div className="note-spese-summary-item">
                <span className="note-spese-summary-label">Rimborsabili</span>
                <strong>
                  {filteredVoci.filter((voce) => voce.rimborsabile).length}
                </strong>
              </div>
            </div>

            <div className="note-spese-table-wrapper mt-3">
              <table className="table table-striped note-spese-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Categoria</th>
                    <th>Descrizione</th>
                    <th>Importo</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoci.map((voce) => (
                    <tr key={voce.id}>
                      <td>{voce.data || '-'}</td>
                      <td>{voce.categoria}</td>
                      <td>{voce.descrizione}</td>
                      <td>EUR {Number(voce.importo).toFixed(2)}</td>
                      <td>{voce.stato || 'Bozza'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => removeVoce(voce.id)}
                          disabled={deletingId === voce.id}
                        >
                          {deletingId === voce.id ? '...' : 'Elimina'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredVoci.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-muted">
                        {loading ? 'Caricamento...' : 'Nessuna voce presente. Usa il form per aggiungerne una.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NoteSpese
