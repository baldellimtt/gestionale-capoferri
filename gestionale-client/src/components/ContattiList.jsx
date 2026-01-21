import { useState, useEffect } from 'react'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'

function ContattiList({ clienteId, onUpdate, onContattiChange, currentUser, toast }) {
  const [contatti, setContatti] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null })
  const [deleting, setDeleting] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    ruolo: '',
    telefono: '',
    email: ''
  })

  useEffect(() => {
    if (clienteId) {
      loadContatti()
    }
  }, [clienteId])

  const loadContatti = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getClienteContatti(clienteId)
      setContatti(data)
      // Notifica il componente padre che i contatti sono cambiati
      if (onContattiChange) {
        onContattiChange(data)
      }
    } catch (err) {
      console.error('Errore caricamento contatti:', err)
      setError('Errore nel caricamento dei contatti')
      setContatti([])
      if (onContattiChange) {
        onContattiChange([])
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation() // Previene la propagazione al form padre
    setError(null)
    setLoading(true)

    try {
      // Pulisce i campi vuoti e li converte in null
      const payload = {
        nome: formData.nome && typeof formData.nome === 'string' && formData.nome.trim() ? formData.nome.trim() : null,
        ruolo: formData.ruolo && typeof formData.ruolo === 'string' && formData.ruolo.trim() ? formData.ruolo.trim() : null,
        telefono: formData.telefono && typeof formData.telefono === 'string' && formData.telefono.trim() ? formData.telefono.trim() : null,
        email: formData.email && typeof formData.email === 'string' && formData.email.trim() ? formData.email.trim() : null
      }
      
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Salvataggio contatto')
      await api.createClienteContatto(clienteId, payload)
      await loadContatti()
      setFormData({ nome: '', ruolo: '', telefono: '', email: '' })
      setShowAddForm(false)
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Contatto creato con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Contatto creato con successo')
      }
      // Non chiamiamo onUpdate qui per evitare refresh che chiude il form
    } catch (err) {
      console.error('Errore salvataggio contatto:', err)
      const errorMsg = 'Errore nel salvataggio del contatto: ' + (err.message || 'Errore sconosciuto')
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (contattoId) => {
    setDeleteConfirm({ show: true, id: contattoId })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) {
      setDeleteConfirm({ show: false, id: null })
      return
    }

    setError(null)
    setDeleting(true)
    setLoading(true)

    try {
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Eliminazione contatto')
      await api.deleteClienteContatto(clienteId, deleteConfirm.id)
      await loadContatti()
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Contatto eliminato con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Contatto eliminato con successo')
      }
      // Non chiamiamo onUpdate qui per evitare refresh che chiude il form
    } catch (err) {
      console.error('Errore eliminazione contatto:', err)
      const errorMsg = 'Errore nell\'eliminazione del contatto: ' + (err.message || 'Errore sconosciuto')
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    } finally {
      setDeleting(false)
      setLoading(false)
      setDeleteConfirm({ show: false, id: null })
    }
  }

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, id: null })
  }

  const handleEmailClick = (email) => {
    if (email) {
      // Costruisce il link mailto con il mittente dall'utente loggato
      // Nota: mailto non può impostare direttamente il mittente,
      // ma possiamo includere informazioni nell'oggetto o nel corpo
      const userEmail = currentUser?.email || ''
      const userName = currentUser?.nome || currentUser?.username || ''
      const userFullName = currentUser?.nome && currentUser?.cognome 
        ? `${currentUser.nome} ${currentUser.cognome}`
        : userName
      
      // Se l'utente ha un'email, la includiamo come riferimento nel corpo
      const body = userEmail 
        ? `Cordiali saluti,\n${userFullName}\n${userEmail}`
        : `Cordiali saluti,\n${userFullName}`
      
      // Crea il link mailto con oggetto e corpo precompilati
      const mailtoLink = `mailto:${email}?subject=&body=${encodeURIComponent(body)}`
      window.location.href = mailtoLink
    }
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setFormData({ nome: '', ruolo: '', telefono: '', email: '' })
  }

  if (!clienteId) {
    return null
  }

  return (
    <div className="contatti-section">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink-800)' }}>
          Contatti
        </h4>
        {!showAddForm && (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowAddForm(true)}
            disabled={loading}
          >
            + Aggiungi Contatto
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-warning mb-3" style={{ fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="card mb-3" style={{ border: '1px solid var(--border-soft)' }}>
          <div className="card-body" style={{ padding: '1rem' }}>
            <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Nome
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome contatto"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Ruolo
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={formData.ruolo}
                    onChange={(e) => setFormData({ ...formData, ruolo: e.target.value })}
                    placeholder="Ruolo"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Telefono
                  </label>
                  <input
                    type="tel"
                    className="form-control form-control-sm"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="Numero telefono"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    className="form-control form-control-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email"
                  />
                </div>
              </div>
              <div className="mt-2 d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Salvataggio...' : 'Salva'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && contatti.length === 0 && !showAddForm && (
        <div className="text-muted" style={{ fontSize: '0.85rem' }}>Caricamento...</div>
      )}

      {!loading && contatti.length === 0 && !showAddForm && (
        <div className="text-muted" style={{ fontSize: '0.85rem' }}>
          Nessun contatto presente. Clicca su "Aggiungi Contatto" per iniziare.
        </div>
      )}

      {contatti.length > 0 && (
        <div className="contatti-list">
          {contatti.map((contatto) => (
            <div
              key={contatto.id}
              className="contatto-item"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  {contatto.nome && (
                    <div style={{ fontWeight: 600, color: 'var(--ink-800)' }}>
                      {contatto.nome}
                    </div>
                  )}
                  {contatto.ruolo && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--ink-500)', 
                      fontStyle: 'italic',
                      padding: '0.15rem 0.5rem',
                      background: 'var(--bg-3)',
                      borderRadius: '4px'
                    }}>
                      {contatto.ruolo}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
                  {contatto.telefono && (
                    <div style={{ color: 'var(--ink-600)' }}>
                      <strong>Tel:</strong> {contatto.telefono}
                    </div>
                  )}
                  {contatto.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink-600)' }}>
                      <strong>Email:</strong> {contatto.email}
                      <button
                        className="btn btn-sm"
                        onClick={() => handleEmailClick(contatto.email)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          background: 'var(--brand-500)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = 'var(--brand-600)'
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = 'var(--brand-500)'
                        }}
                        title="Scrivi email"
                      >
                        ✉
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDelete(contatto.id)}
                disabled={loading}
                style={{ flexShrink: 0 }}
              >
                Elimina
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        show={deleteConfirm.show}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Elimina contatto"
        message="Sei sicuro di voler eliminare questo contatto?"
      />
    </div>
  )
}

export default ContattiList
