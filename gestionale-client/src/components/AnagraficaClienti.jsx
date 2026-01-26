import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import ContattiList from './ContattiList'

// Helper per ottenere il label del campo in italiano
const getFieldLabel = (fieldName) => {
  const labels = {
    'denominazione': 'Denominazione',
    'qualifica': 'Qualifica',
    'nome': 'Nome',
    'cognome': 'Cognome',
    'paese': 'Paese',
    'codiceDestinatarioSDI': 'Codice Destinatario SDI',
    'codice_destinatario_sdi': 'Codice Destinatario SDI',
    'indirizzo': 'Indirizzo',
    'comune': 'Comune',
    'cap': 'CAP',
    'provincia': 'Provincia',
    'partitaIva': 'Partita IVA',
    'partita_iva': 'Partita IVA',
    'codiceFiscale': 'Codice Fiscale',
    'codice_fiscale': 'Codice Fiscale',
    'email': 'Email',
    'pec': 'PEC'
  }
  return labels[fieldName] || fieldName
}

const QUALIFICHE = [
  'Società',
  'Ingegnere',
  'Architetto',
  'Geometra',
  'Persona fisica',
  'Altro'
]

function AnagraficaClienti({ clienti, onUpdateClienti, onBack, currentUser, toast }) {
  const [showForm, setShowForm] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [formTab, setFormTab] = useState('anagrafica')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filteredClienti, setFilteredClienti] = useState([])
  const [formData, setFormData] = useState({
    denominazione: '',
    qualifica: '',
    nome: '',
    cognome: '',
    paese: '',
    codiceDestinatarioSDI: '',
    indirizzo: '',
    comune: '',
    cap: '',
    provincia: '',
    partitaIva: '',
    codiceFiscale: '',
    email: '',
    pec: ''
  })
  const [initialFormData, setInitialFormData] = useState({
    denominazione: '',
    qualifica: '',
    nome: '',
    cognome: '',
    paese: '',
    codiceDestinatarioSDI: '',
    indirizzo: '',
    comune: '',
    cap: '',
    provincia: '',
    partitaIva: '',
    codiceFiscale: '',
    email: '',
    pec: ''
  })
  const [contatti, setContatti] = useState([])
  const [initialContatti, setInitialContatti] = useState([])

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
      // Normalizza i dati: stringhe vuote diventano null
      const normalizeValue = (value) => {
        if (value === null || value === undefined) return null
        const trimmed = String(value).trim()
        return trimmed === '' ? null : trimmed
      }
      
      const clienteData = {
        denominazione: normalizeValue(formData.denominazione) || '',
        qualifica: normalizeValue(formData.qualifica),
        nome: normalizeValue(formData.nome),
        cognome: normalizeValue(formData.cognome),
        paese: normalizeValue(formData.paese),
        codiceDestinatarioSDI: normalizeValue(formData.codiceDestinatarioSDI),
        indirizzo: normalizeValue(formData.indirizzo),
        comune: normalizeValue(formData.comune),
        cap: normalizeValue(formData.cap),
        provincia: normalizeValue(formData.provincia),
        partitaIva: normalizeValue(formData.partitaIva),
        codiceFiscale: normalizeValue(formData.codiceFiscale),
        email: normalizeValue(formData.email),
        pec: normalizeValue(formData.pec)
      }
      
      // Mappa camelCase a snake_case per l'API
      const apiData = {
        denominazione: clienteData.denominazione,
        qualifica: clienteData.qualifica,
        nome: clienteData.nome,
        cognome: clienteData.cognome,
        paese: clienteData.paese,
        codiceDestinatarioSDI: clienteData.codiceDestinatarioSDI,
        indirizzo: clienteData.indirizzo,
        comune: clienteData.comune,
        cap: clienteData.cap,
        provincia: clienteData.provincia,
        partitaIva: clienteData.partitaIva,
        codiceFiscale: clienteData.codiceFiscale,
        email: clienteData.email,
        pec: clienteData.pec
      }

      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Salvataggio cliente')
      
      if (editingCliente !== null) {
        await api.updateCliente(editingCliente.id, apiData)
        // Sincronizza i contatti iniziali dopo il salvataggio
        setInitialContatti(JSON.parse(JSON.stringify(contatti)))
        if (loadingToastId) {
          toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Cliente aggiornato con successo', duration: 3000 })
        } else {
          toast?.showSuccess('Cliente aggiornato con successo')
        }
      } else {
        await api.createCliente(apiData)
        if (loadingToastId) {
          toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Cliente creato con successo', duration: 3000 })
        } else {
          toast?.showSuccess('Cliente creato con successo')
        }
      }

      await onUpdateClienti()
      handleCancel()
    } catch (err) {
      console.error('Errore salvataggio cliente:', err)
      
      // Se ci sono dettagli di validazione, mostra quelli
      let errorMsg = 'Errore nel salvataggio del cliente'
      if (err.details && Array.isArray(err.details) && err.details.length > 0) {
        // Mostra i dettagli di validazione specifici
        const detailsMessages = err.details.map(d => {
          const fieldName = d.field || d.param || 'campo'
          const fieldLabel = getFieldLabel(fieldName)
          return `${fieldLabel}: ${d.message}`
        })
        errorMsg = 'Errore di validazione:\n' + detailsMessages.join('\n')
      } else if (err.message) {
        errorMsg = 'Errore nel salvataggio del cliente: ' + err.message
      } else {
        errorMsg = 'Errore nel salvataggio del cliente: Errore sconosciuto'
      }
      
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (cliente) => {
    const nextFormData = {
      denominazione: cliente.denominazione || '',
      qualifica: cliente.qualifica || '',
      nome: cliente.nome || '',
      cognome: cliente.cognome || '',
      paese: cliente.paese || '',
      codiceDestinatarioSDI: cliente.codice_destinatario_sdi || '',
      indirizzo: cliente.indirizzo || '',
      comune: cliente.comune || '',
      cap: cliente.cap || '',
      provincia: cliente.provincia || '',
      partitaIva: cliente.partita_iva || '',
      codiceFiscale: cliente.codice_fiscale || '',
      email: cliente.email || '',
      pec: cliente.pec || ''
    }
    setFormData(nextFormData)
    setInitialFormData(nextFormData)
    setEditingCliente(cliente)
    setShowForm(true)
    setFormTab('anagrafica')
    
    // Carica i contatti iniziali
    try {
      const initialContattiData = await api.getClienteContatti(cliente.id)
      setContatti(initialContattiData)
      setInitialContatti(JSON.parse(JSON.stringify(initialContattiData)))
    } catch (err) {
      console.error('Errore caricamento contatti:', err)
      setContatti([])
      setInitialContatti([])
    }
    
    // Scroll to top quando si apre il form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (cliente) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo cliente?')) {
      return
    }

    setError(null)
    setLoading(true)

    try {
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Eliminazione cliente')
      await api.deleteCliente(cliente.id)
      await onUpdateClienti()
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Cliente eliminato con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Cliente eliminato con successo')
      }
    } catch (err) {
      console.error('Errore eliminazione cliente:', err)
      const errorMsg = 'Errore nell\'eliminazione del cliente: ' + (err.message || 'Errore sconosciuto')
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCliente(null)
    setFormTab('anagrafica')
    const emptyForm = {
      denominazione: '',
      qualifica: '',
      nome: '',
      cognome: '',
      paese: '',
      codiceDestinatarioSDI: '',
      indirizzo: '',
      comune: '',
      cap: '',
      provincia: '',
      partitaIva: '',
      codiceFiscale: '',
      email: '',
      pec: ''
    }
    setFormData(emptyForm)
    setInitialFormData(emptyForm)
    setContatti([])
    setInitialContatti([])
  }
  
  const handleContattiChange = (newContatti) => {
    setContatti(newContatti || [])
  }
  
  const isDirty = useMemo(() => {
    // Verifica se il form è cambiato
    const formChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData)
    
    // Verifica se i contatti sono cambiati
    const contattiChanged = JSON.stringify(contatti.map(c => ({ id: c.id, nome: c.nome, ruolo: c.ruolo, telefono: c.telefono, email: c.email })).sort((a, b) => (a.id || 0) - (b.id || 0))) !== 
                           JSON.stringify(initialContatti.map(c => ({ id: c.id, nome: c.nome, ruolo: c.ruolo, telefono: c.telefono, email: c.email })).sort((a, b) => (a.id || 0) - (b.id || 0)))
    
    return formChanged || contattiChanged
  }, [formData, initialFormData, contatti, initialContatti])
  
  const canSave = isDirty && formData.denominazione.trim() !== '' && !loading
  const clientiCount = filteredClienti.length
  const totalClienti = clienti.length
  const countLabel = searchTerm ? `Mostrati ${clientiCount} su ${totalClienti}` : `${clientiCount}`

  return (
    <div key={`anagrafica-${showForm}`}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-2">
          <h2 className="section-title mb-0 no-title-line">Clienti</h2>
          <span
            className="badge bg-secondary"
            style={{ fontSize: '0.8rem' }}
            title={searchTerm ? 'Clienti filtrati sul totale' : 'Numero clienti'}
          >
            {countLabel}
          </span>
        </div>
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
          <div style={{ whiteSpace: 'pre-line' }}>{error}</div>
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
              aria-busy={loading}
            />
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setShowForm(true)
              setFormTab('anagrafica')
            }}
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
              <div className="commessa-form-tabs">
                <button
                  type="button"
                  className={`btn btn-sm ${formTab === 'anagrafica' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormTab('anagrafica')}
                >
                  Anagrafica
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${formTab === 'fiscale' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormTab('fiscale')}
                >
                  Dati fiscali
                </button>
              </div>
              <div className="row g-3">
                {formTab === 'anagrafica' && (
                  <>
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
                    <div className="col-md-3">
                      <label className="form-label">Qualifica</label>
                      <select
                        className="form-select"
                        value={formData.qualifica}
                        onChange={(e) => setFormData({ ...formData, qualifica: e.target.value })}
                      >
                        <option value="">Seleziona</option>
                        {QUALIFICHE.map((qualifica) => (
                          <option key={qualifica} value={qualifica}>{qualifica}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Paese</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.paese}
                        onChange={(e) => setFormData({ ...formData, paese: e.target.value })}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Nome</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Cognome</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.cognome}
                        onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
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
                  </>
                )}
                {formTab === 'fiscale' && (
                  <>
                    <div className="col-md-4">
                      <label className="form-label">Partita IVA</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.partitaIva}
                        onChange={(e) => setFormData({ ...formData, partitaIva: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Codice Fiscale</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.codiceFiscale}
                        onChange={(e) => setFormData({ ...formData, codiceFiscale: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Codice Destinatario SDI</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.codiceDestinatarioSDI}
                        onChange={(e) => setFormData({ ...formData, codiceDestinatarioSDI: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">PEC</label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.pec}
                        onChange={(e) => setFormData({ ...formData, pec: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="actions-sticky mt-3 d-flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={!canSave}>
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

      {showForm && editingCliente && editingCliente.id && (
        <div className="card mb-4">
          <div className="card-body">
            <ContattiList 
              clienteId={editingCliente.id} 
              onContattiChange={handleContattiChange}
              currentUser={currentUser}
              toast={toast}
            />
          </div>
        </div>
      )}

      {!showForm && (
        <div className="clienti-list">
          {filteredClienti.length === 0 ? (
            <div className="alert alert-info">
              {searchTerm ? 'Nessun cliente trovato per la ricerca.' : 'Nessun cliente presente. Clicca su "Aggiungi Cliente" per iniziare.'}
            </div>
          ) : (
            filteredClienti.map((cliente) => (
              <div 
                key={cliente.id} 
                className="cliente-card"
                onClick={(e) => {
                  // Non aprire se si clicca sui pulsanti
                  if (e.target.closest('.cliente-actions')) return
                  e.preventDefault()
                  e.stopPropagation()
                  handleEdit(cliente)
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="cliente-card-header">
                  <h3>{cliente.denominazione || 'Cliente senza nome'}</h3>
                  <div className="cliente-actions">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleEdit(cliente)
                      }}
                      disabled={loading}
                    >
                      Modifica
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDelete(cliente)
                      }}
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
      )}
    </div>
  )
}

export default AnagraficaClienti
