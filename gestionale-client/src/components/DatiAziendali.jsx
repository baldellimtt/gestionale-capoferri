import { useEffect, useState } from 'react'
import api from '../services/api'

function DatiAziendali({ onBack, toast }) {
  const [formData, setFormData] = useState({
    ragione_sociale: '',
    partita_iva: '',
    codice_fiscale: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getDatiAziendali()
      setFormData({
        ragione_sociale: data.ragione_sociale || '',
        partita_iva: data.partita_iva || '',
        codice_fiscale: data.codice_fiscale || ''
      })
    } catch (err) {
      console.error('Errore caricamento dati aziendali:', err)
      setError('Errore nel caricamento dei dati aziendali.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Salvataggio dati aziendali')
      await api.updateDatiAziendali(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Dati aziendali aggiornati con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Dati aziendali aggiornati con successo')
      }
    } catch (err) {
      console.error('Errore salvataggio dati aziendali:', err)
      const errorMsg = err.message || 'Errore nel salvataggio dei dati aziendali.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (text) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }).catch(err => {
      console.error('Errore copia:', err)
      setError('Errore nella copia del testo.')
    })
  }

  if (loading) {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="section-title mb-0">Dati Aziendali</h2>
          <button className="btn btn-secondary" onClick={onBack}>
            Indietro
          </button>
        </div>
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Caricamento...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0">Dati Aziendali</h2>
        <button className="btn btn-secondary" onClick={onBack}>
          Indietro
        </button>
      </div>

      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success mb-3">
          Dati salvati con successo!
        </div>
      )}

      {copySuccess && (
        <div className="alert alert-success mb-3">
          Testo copiato!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-12">
                <label className="form-label">Ragione Sociale</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    value={formData.ragione_sociale}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ragione_sociale: e.target.value }))}
                    placeholder="Inserisci ragione sociale"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => copyToClipboard(formData.ragione_sociale)}
                    disabled={!formData.ragione_sociale}
                    title="Copia"
                  >
                    📋
                  </button>
                </div>
              </div>
              <div className="col-md-12">
                <label className="form-label">Partita IVA</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    value={formData.partita_iva}
                    onChange={(e) => setFormData((prev) => ({ ...prev, partita_iva: e.target.value }))}
                    placeholder="Inserisci partita IVA"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => copyToClipboard(formData.partita_iva)}
                    disabled={!formData.partita_iva}
                    title="Copia"
                  >
                    📋
                  </button>
                </div>
              </div>
              <div className="col-md-12">
                <label className="form-label">Codice Fiscale</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    value={formData.codice_fiscale}
                    onChange={(e) => setFormData((prev) => ({ ...prev, codice_fiscale: e.target.value }))}
                    placeholder="Inserisci codice fiscale"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => copyToClipboard(formData.codice_fiscale)}
                    disabled={!formData.codice_fiscale}
                    title="Copia"
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>
            <div className="actions-sticky mt-4 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default DatiAziendali
