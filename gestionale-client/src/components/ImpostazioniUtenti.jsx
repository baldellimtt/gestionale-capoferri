import { useEffect, useState } from 'react'
import api from '../services/api'

function ImpostazioniUtenti({ currentUser, onUserUpdated, onUsersChanged, onBack, toast, showHeader = true, title = 'Impostazioni utenti' }) {
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createData, setCreateData] = useState({
    username: '',
    password: '',
    role: 'user',
    email: '',
    telefono: '',
    nome: '',
    cognome: '',
    mezzo: '',
    targa: '',
    rimborso_km: ''
  })

  const normalizeErrorPayload = (value) => {
    if (!value) {
      return null
    }
    if (typeof value === 'string') {
      return { message: value, details: [], suggestions: [] }
    }
    return {
      message: value.message || 'Errore',
      details: Array.isArray(value.details) ? value.details : [],
      suggestions: Array.isArray(value.suggestions) ? value.suggestions : [],
    }
  }

  const showError = (value) => {
    setError(normalizeErrorPayload(value))
  }

  const loadUtenti = async () => {
    try {
      setLoading(true)
      showError(null)
      const data = await api.getUtenti()
      setUtenti(data)
    } catch (err) {
      console.error('Errore caricamento utenti:', err)
      showError('Errore nel caricamento degli utenti.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUtenti()
  }, [])

  const startEdit = (utente) => {
    setEditingId(utente.id)
    setEditData({
      username: utente.username || '',
      password: '',
      role: utente.role || 'user',
      email: utente.email || '',
      telefono: utente.telefono || '',
      nome: utente.nome || '',
      cognome: utente.cognome || '',
      mezzo: utente.mezzo || '',
      targa: utente.targa || '',
      rimborso_km: utente.rimborso_km ?? 0
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
  }

  const handleCreate = async () => {
    if (!createData.username || !createData.password) {
      showError('Username e password sono obbligatori.')
      return
    }

    const rimborso = Number(String(createData.rimborso_km || 0).replace(',', '.'))
    if (!Number.isFinite(rimborso) || rimborso < 0) {
      showError('Costo km non valido.')
      return
    }

    try {
      setSaving(true)
      showError(null)
      const created = await api.createUtente({
        ...createData,
        rimborso_km: rimborso
      })
      setUtenti((prev) => [...prev, created])
      if (onUsersChanged) {
        onUsersChanged()
      }
      setCreateData({
        username: '',
        password: '',
        role: 'user',
        email: '',
        telefono: '',
        nome: '',
        cognome: '',
        mezzo: '',
        targa: '',
        rimborso_km: ''
      })
      setShowCreate(false)
    } catch (err) {
      console.error('Errore creazione utente:', err)
      const message = err.message || 'Errore nella creazione utente.'
      showError({ ...err, message })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (id) => {
    const rimborso = Number(String(editData.rimborso_km || 0).replace(',', '.'))
    if (!Number.isFinite(rimborso) || rimborso < 0) {
      showError('Costo km non valido.')
      return
    }

    try {
      setSaving(true)
      showError(null)
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Salvataggio utente')
      
      // IMPORTANTE: Non inviare il campo password se è vuoto
      // Questo evita di modificare accidentalmente la password quando si aggiorna un utente
      const updateData = {
        ...editData,
        rimborso_km: rimborso
      }
      // Rimuovi password se è vuota o non definita
      if (!updateData.password || updateData.password.trim() === '') {
        delete updateData.password
      }
      
      const updated = await api.updateUtente(id, updateData)
      setUtenti((prev) => prev.map((u) => (u.id === id ? updated : u)))
      if (currentUser?.id === updated.id && onUserUpdated) {
        onUserUpdated(updated)
      }
      if (onUsersChanged) {
        onUsersChanged()
      }
      cancelEdit()
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Utente aggiornato con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Utente aggiornato con successo')
      }
    } catch (err) {
      console.error('Errore aggiornamento utente:', err)
      const errorMsg = err.message || 'Errore nel salvataggio utente.'
      showError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (utente) => {
    if (!window.confirm(`Eliminare l'utente ${utente.username}?`)) {
      return
    }

    try {
      setSaving(true)
      showError(null)
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Eliminazione utente')
      await api.deleteUtente(utente.id)
      setUtenti((prev) => prev.filter((u) => u.id !== utente.id))
      if (onUsersChanged) {
        onUsersChanged()
      }
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Utente eliminato con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Utente eliminato con successo')
      }
    } catch (err) {
      console.error('Errore eliminazione utente:', err)
      const errorMsg = err.message || 'Errore nell\'eliminazione utente.'
      showError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {showHeader && (
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="section-title mb-0">{title}</h2>
          {onBack && (
            <button className="btn btn-secondary" onClick={onBack}>
              Indietro
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="alert alert-warning mb-3">
          <p className="mb-2 fw-semibold">{error.message}</p>
          {error.details?.length > 0 && (
            <ul className="mb-2 ps-3">
              {error.details.map((detail, index) => (
                <li key={`error-detail-${index}`} className="small mb-1">
                  {detail}
                </li>
              ))}
            </ul>
          )}
          {error.suggestions?.length > 0 && (
            <p className="mb-0 small text-muted">
              Suggerimenti: {error.suggestions.join(', ')}
            </p>
          )}
        </div>
      )}

      {!showCreate && (
        <div className="mb-4 d-flex gap-2 align-items-center flex-wrap">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
            disabled={saving}
          >
            + Aggiungi Utente
          </button>
        </div>
      )}

      {showCreate && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Username</label>
                <input
                  className="form-control"
                  value={createData.username}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={createData.password}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Ruolo</label>
                <select
                  className="form-select"
                  value={createData.role}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="user">Utente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={createData.email}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Telefono</label>
                <input
                  type="tel"
                  className="form-control"
                  value={createData.telefono}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, telefono: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Nome</label>
                <input
                  className="form-control"
                  value={createData.nome}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, nome: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Cognome</label>
                <input
                  className="form-control"
                  value={createData.cognome}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, cognome: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Veicolo</label>
                <input
                  className="form-control"
                  value={createData.mezzo}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, mezzo: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Targa</label>
                <input
                  className="form-control"
                  value={createData.targa}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, targa: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Costo km</label>
                <input
                  className="form-control"
                  value={createData.rimborso_km}
                  onChange={(e) => setCreateData((prev) => ({ ...prev, rimborso_km: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="actions-sticky mt-4 d-flex gap-2">
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Salvataggio...' : 'Crea utente'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={saving}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">Dati operatore</div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Caricamento...</span>
              </div>
            </div>
          ) : utenti.length === 0 ? (
            <div className="alert alert-info">Nessun utente presente.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Ruolo</th>
                    <th>Email</th>
                    <th>Telefono</th>
                    <th>Nome</th>
                    <th>Veicolo</th>
                    <th>Targa</th>
                    <th>Costo km</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {utenti.map((utente) => {
                    const isEditing = editingId === utente.id
                    return (
                      <tr key={utente.id}>
                        <td className="azioni-cell">
                          {isEditing ? (
                            <input
                              className="form-control"
                              value={editData.username}
                              onChange={(e) => setEditData((prev) => ({ ...prev, username: e.target.value }))}
                            />
                          ) : (
                            utente.username
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <select
                              className="form-select"
                              value={editData.role}
                              onChange={(e) => setEditData((prev) => ({ ...prev, role: e.target.value }))}
                            >
                              <option value="user">Utente</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            utente.role
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="email"
                              className="form-control"
                              value={editData.email}
                              onChange={(e) => setEditData((prev) => ({ ...prev, email: e.target.value }))}
                            />
                          ) : (
                            utente.email || '-'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="tel"
                              className="form-control"
                              value={editData.telefono}
                              onChange={(e) => setEditData((prev) => ({ ...prev, telefono: e.target.value }))}
                            />
                          ) : (
                            utente.telefono || '-'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <>
                              <input
                                className="form-control mb-2"
                                placeholder="Nome"
                                value={editData.nome}
                                onChange={(e) => setEditData((prev) => ({ ...prev, nome: e.target.value }))}
                              />
                              <input
                                className="form-control"
                                placeholder="Cognome"
                                value={editData.cognome}
                                onChange={(e) => setEditData((prev) => ({ ...prev, cognome: e.target.value }))}
                              />
                            </>
                          ) : (
                            `${utente.nome || ''} ${utente.cognome || ''}`.trim()
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              className="form-control"
                              value={editData.mezzo}
                              onChange={(e) => setEditData((prev) => ({ ...prev, mezzo: e.target.value }))}
                            />
                          ) : (
                            utente.mezzo || '-'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              className="form-control"
                              value={editData.targa}
                              onChange={(e) => setEditData((prev) => ({ ...prev, targa: e.target.value }))}
                            />
                          ) : (
                            utente.targa || '-'
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              className="form-control"
                              value={editData.rimborso_km}
                              onChange={(e) => setEditData((prev) => ({ ...prev, rimborso_km: e.target.value }))}
                              placeholder="0.00"
                            />
                          ) : (
                            Number(utente.rimborso_km || 0).toFixed(2)
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <>
                              <input
                                type="password"
                                className="form-control mb-2"
                                placeholder="Nuova password (opzionale)"
                                value={editData.password}
                                onChange={(e) => setEditData((prev) => ({ ...prev, password: e.target.value }))}
                              />
                              <div className="d-flex gap-2 justify-content-center">
                                <button className="btn btn-primary btn-sm" onClick={() => handleSave(utente.id)} disabled={saving}>
                                  Salva
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={cancelEdit} disabled={saving}>
                                  Annulla
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="d-flex gap-2 justify-content-center">
                              <button className="btn btn-secondary btn-sm" onClick={() => startEdit(utente)} disabled={saving}>
                                Modifica
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDelete(utente)}
                                disabled={saving || utente.id === currentUser?.id}
                                title={utente.id === currentUser?.id ? 'Non puoi eliminare il tuo utente' : ''}
                              >
                                Elimina
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImpostazioniUtenti
