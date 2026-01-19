import { useState, useEffect } from 'react'
import api from '../services/api'

function AnagraficaClienti({ clienti, onUpdateClienti, onBack }) {
  const [showForm, setShowForm] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filteredClienti, setFilteredClienti] = useState([])
  const [formData, setFormData] = useState({
    denominazione: '',
    paese: '',
    codiceDestinatarioSDI: '',
    indirizzo: '',
    comune: '',
    cap: '',
    provincia: '',
    partitaIva: '',
    codiceFiscale: ''
  })

  // Filtra clienti localmente o usa ricerca server-side
  useEffect(() => {
    if (searchTerm) {
      loadClienti(searchTerm)
    } else {
      setFilteredClienti(clienti)
    }
  }, [clienti, searchTerm])

  const loadClienti = async (search = '') => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getClienti(search)
      setFilteredClienti(data)
    } catch (err) {
      console.error('Errore caricamento clienti:', err)
      setError('Errore nel caricamento dei clienti')
      setFilteredClienti([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const clienteData = {
        denominazione: formData.denominazione,
        paese: formData.paese || null,
        codiceDestinatarioSDI: formData.codiceDestinatarioSDI || null,
        indirizzo: formData.indirizzo || null,
        comune: formData.comune || null,
        cap: formData.cap || null,
        provincia: formData.provincia || null,
        partitaIva: formData.partitaIva || null,
        codiceFiscale: formData.codiceFiscale || null
      }
      
      // Mappa camelCase a snake_case per l'API
      const apiData = {
        denominazione: clienteData.denominazione,
        paese: clienteData.paese,
        codiceDestinatarioSDI: clienteData.codiceDestinatarioSDI,
        indirizzo: clienteData.indirizzo,
        comune: clienteData.comune,
        cap: clienteData.cap,
        provincia: clienteData.provincia,
        partitaIva: clienteData.partitaIva,
        codiceFiscale: clienteData.codiceFiscale
      }

      if (editingCliente !== null) {
        await api.updateCliente(editingCliente.id, apiData)
      } else {
        await api.createCliente(apiData)
      }

      await onUpdateClienti()
      handleCancel()
    } catch (err) {
      console.error('Errore salvataggio cliente:', err)
      setError('Errore nel salvataggio del cliente: ' + (err.message || 'Errore sconosciuto'))
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (cliente) => {
    setFormData({
      denominazione: cliente.denominazione || '',
      paese: cliente.paese || '',
      codiceDestinatarioSDI: cliente.codice_destinatario_sdi || '',
      indirizzo: cliente.indirizzo || '',
      comune: cliente.comune || '',
      cap: cliente.cap || '',
      provincia: cliente.provincia || '',
      partitaIva: cliente.partita_iva || '',
      codiceFiscale: cliente.codice_fiscale || ''
    })
    setEditingCliente(cliente)
    setShowForm(true)
  }

  const handleDelete = async (cliente) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo cliente?')) {
      return
    }

    setError(null)
    setLoading(true)

    try {
      await api.deleteCliente(cliente.id)
      await onUpdateClienti()
    } catch (err) {
      console.error('Errore eliminazione cliente:', err)
      setError('Errore nell\'eliminazione del cliente: ' + (err.message || 'Errore sconosciuto'))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCliente(null)
    setFormData({
      denominazione: '',
      paese: '',
      codiceDestinatarioSDI: '',
      indirizzo: '',
      comune: '',
      cap: '',
      provincia: '',
      partitaIva: '',
      codiceFiscale: ''
    })
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Anagrafica Clienti</h2>
        <div className="d-flex gap-2">
          {onBack && (
            <button 
              className="btn btn-secondary"
              onClick={onBack}
            >
              Indietro
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      {!showForm && (
        <div className="mb-4 d-flex gap-2 align-items-center flex-wrap">
          <div style={{ flex: '1', minWidth: '250px', maxWidth: '400px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Cerca clienti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
            disabled={loading}
          >
            + Aggiungi Cliente
          </button>
        </div>
      )}

      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            {editingCliente !== null ? 'Modifica Cliente' : 'Nuovo Cliente'}
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Denominazione *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.denominazione}
                    onChange={(e) => setFormData({ ...formData, denominazione: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Paese</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.paese}
                    onChange={(e) => setFormData({ ...formData, paese: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Codice Destinatario SDI</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.codiceDestinatarioSDI}
                    onChange={(e) => setFormData({ ...formData, codiceDestinatarioSDI: e.target.value })}
                  />
                </div>
                <div className="col-md-12">
                  <label className="form-label">Indirizzo</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.indirizzo}
                    onChange={(e) => setFormData({ ...formData, indirizzo: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Comune</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.comune}
                    onChange={(e) => setFormData({ ...formData, comune: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">CAP</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.cap}
                    onChange={(e) => setFormData({ ...formData, cap: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Provincia</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.provincia}
                    onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Partita IVA</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.partitaIva}
                    onChange={(e) => setFormData({ ...formData, partitaIva: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Codice Fiscale</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.codiceFiscale}
                    onChange={(e) => setFormData({ ...formData, codiceFiscale: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-3 d-flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Salvataggio...' : (editingCliente !== null ? 'Salva Modifiche' : 'Aggiungi Cliente')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={loading}>
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="clienti-list">
        {filteredClienti.length === 0 ? (
          <div className="alert alert-info">
            {searchTerm ? 'Nessun cliente trovato per la ricerca.' : 'Nessun cliente presente. Clicca su "Aggiungi Cliente" per iniziare.'}
          </div>
        ) : (
          filteredClienti.map((cliente) => (
            <div key={cliente.id} className="cliente-card">
              <div className="cliente-card-header">
                <h3>{cliente.denominazione || 'Cliente senza nome'}</h3>
                <div className="cliente-actions">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleEdit(cliente)}
                    disabled={loading}
                  >
                    Modifica
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(cliente)}
                    disabled={loading}
                  >
                    Elimina
                  </button>
                </div>
              </div>
              <div className="row g-2">
                {cliente.paese && (
                  <div className="col-md-6">
                    <strong>Paese:</strong> {cliente.paese}
                  </div>
                )}
                {(cliente.codice_destinatario_sdi || cliente.codiceDestinatarioSDI) && (
                  <div className="col-md-6">
                    <strong>Codice SDI:</strong> {cliente.codice_destinatario_sdi || cliente.codiceDestinatarioSDI}
                  </div>
                )}
                {cliente.indirizzo && (
                  <div className="col-md-12">
                    <strong>Indirizzo:</strong> {cliente.indirizzo}
                  </div>
                )}
                {(cliente.comune || cliente.cap || cliente.provincia) && (
                  <div className="col-md-12">
                    <strong>Località:</strong> {[cliente.comune, cliente.cap, cliente.provincia].filter(Boolean).join(' ')}
                  </div>
                )}
                {(cliente.partita_iva || cliente.partitaIva) && (
                  <div className="col-md-6">
                    <strong>P.IVA:</strong> {cliente.partita_iva || cliente.partitaIva}
                  </div>
                )}
                {(cliente.codice_fiscale || cliente.codiceFiscale) && (
                  <div className="col-md-6">
                    <strong>CF:</strong> {cliente.codice_fiscale || cliente.codiceFiscale}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default AnagraficaClienti



