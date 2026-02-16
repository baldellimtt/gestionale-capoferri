import { useEffect, useState } from 'react'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'

function ImpostazioniUtenti({ currentUser, onUserUpdated, onUsersChanged, onBack, toast, showHeader = true, title = 'Impostazioni utenti' }) {
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [showPasswordEdit, setShowPasswordEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteUtente, setDeleteUtente] = useState(null)
  const [deleteUtenteLoading, setDeleteUtenteLoading] = useState(false)
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
  const [inviti, setInviti] = useState([])
  const [invitiLoading, setInvitiLoading] = useState(false)
  const [invitoSaving, setInvitoSaving] = useState(false)
  const [latestInvito, setLatestInvito] = useState(null)
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'user',
    nome: '',
    cognome: '',
    note: '',
    expiresHours: 48
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
      const data = await api.getUtenti(true)
      setUtenti(data)
    } catch (err) {
      console.error('Errore caricamento utenti:', err)
      showError('Errore nel caricamento degli utenti.')
    } finally {
      setLoading(false)
    }
  }

  const loadInviti = async () => {
    try {
      setInvitiLoading(true)
      const data = await api.getInvitiUtente()
      setInviti(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Errore caricamento inviti:', err)
      toast?.showError(err.message || 'Errore caricamento inviti', 'Inviti utenti')
    } finally {
      setInvitiLoading(false)
    }
  }

  useEffect(() => {
    loadUtenti()
    loadInviti()
  }, [])

  const startEdit = (utente) => {
    setEditingId(utente.id)
    setShowPasswordEdit(false)
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
      rimborso_km: utente.rimborso_km ?? 0,
      row_version: utente.row_version
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
    setShowPasswordEdit(false)
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
    if (!Number.isInteger(Number(editData.row_version))) {
      showError('Versione dati non disponibile. Ricarica la lista utenti.')
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
      if (!showPasswordEdit) {
        delete updateData.password
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
      if (err?.status === 409 && err.current) {
        const current = err.current
        setUtenti((prev) => prev.map((u) => (u.id === current.id ? current : u)))
        if (editingId === current.id) {
          setEditData((prev) => ({
            ...prev,
            username: current.username || '',
            role: current.role || 'user',
            email: current.email || '',
            telefono: current.telefono || '',
            nome: current.nome || '',
            cognome: current.cognome || '',
            mezzo: current.mezzo || '',
            targa: current.targa || '',
            rimborso_km: current.rimborso_km ?? 0,
            row_version: current.row_version
          }))
        }
        const conflictMsg = 'Conflitto di aggiornamento: dati aggiornati da un altro utente. Riprova.'
        showError(conflictMsg)
        toast?.showError(conflictMsg, 'Conflitto aggiornamento')
      } else {
        const errorMsg = err.message || 'Errore nel salvataggio utente.'
        showError(errorMsg)
        toast?.showError(errorMsg, 'Errore salvataggio')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (utente) => {
    setDeleteUtente(utente)
  }

  const handleCreateInvite = async () => {
    const email = String(inviteData.email || '').trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Inserisci una email valida per l\'invito.')
      return
    }

    try {
      setInvitoSaving(true)
      showError(null)
      const result = await api.createInvitoUtente({
        email,
        role: inviteData.role || 'user',
        nome: inviteData.nome || '',
        cognome: inviteData.cognome || '',
        note: inviteData.note || '',
        expiresHours: Number(inviteData.expiresHours || 48)
      })
      setLatestInvito(result || null)
      setInviteData({
        email: '',
        role: 'user',
        nome: '',
        cognome: '',
        note: '',
        expiresHours: 48
      })
      await loadInviti()
      toast?.showSuccess('Invito creato con successo', 'Inviti utenti')
    } catch (err) {
      console.error('Errore creazione invito:', err)
      showError(err.message || 'Errore creazione invito')
    } finally {
      setInvitoSaving(false)
    }
  }

  const copyToClipboard = async (value, successMessage = 'Copiato') => {
    const text = String(value || '').trim()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast?.showSuccess(successMessage, 'Clipboard')
    } catch {
      toast?.showError('Copia non riuscita', 'Clipboard')
    }
  }

  const handleRevokeInvite = async (invito) => {
    if (!invito?.id || !Number.isInteger(Number(invito?.row_version))) return
    if (!window.confirm(`Revocare l'invito per ${invito.email}?`)) return
    try {
      setInvitoSaving(true)
      await api.revokeInvitoUtente(invito.id, invito.row_version)
      await loadInviti()
      toast?.showSuccess('Invito revocato', 'Inviti utenti')
    } catch (err) {
      console.error('Errore revoca invito:', err)
      showError(err.message || 'Errore revoca invito')
    } finally {
      setInvitoSaving(false)
    }
  }

  const confirmDeleteUtente = async () => {
    if (!deleteUtente?.id) return
    try {
      setDeleteUtenteLoading(true)
      showError(null)
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Eliminazione utente')
      await api.deleteUtente(deleteUtente.id)
      setUtenti((prev) => prev.filter((u) => u.id !== deleteUtente.id))
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
      setDeleteUtenteLoading(false)
      setDeleteUtente(null)
    }
  }

  return (
    <>
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

      <div className="card mb-4">
        <div className="card-header">Inviti onboarding utenti</div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                value={inviteData.email}
                onChange={(e) => setInviteData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="utente@azienda.it"
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Ruolo</label>
              <select
                className="form-select"
                value={inviteData.role}
                onChange={(e) => setInviteData((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="user">Utente</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Scadenza (ore)</label>
              <input
                type="number"
                min="1"
                max="336"
                className="form-control"
                value={inviteData.expiresHours}
                onChange={(e) => setInviteData((prev) => ({ ...prev, expiresHours: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Nome</label>
              <input
                className="form-control"
                value={inviteData.nome}
                onChange={(e) => setInviteData((prev) => ({ ...prev, nome: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Cognome</label>
              <input
                className="form-control"
                value={inviteData.cognome}
                onChange={(e) => setInviteData((prev) => ({ ...prev, cognome: e.target.value }))}
              />
            </div>
            <div className="col-12">
              <label className="form-label">Note (opzionale)</label>
              <input
                className="form-control"
                value={inviteData.note}
                onChange={(e) => setInviteData((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Note per il destinatario o per uso interno"
              />
            </div>
          </div>
          <div className="actions-sticky mt-3 d-flex gap-2">
            <button className="btn btn-primary" onClick={handleCreateInvite} disabled={invitoSaving}>
              {invitoSaving ? 'Creazione...' : 'Crea invito'}
            </button>
            <button className="btn btn-outline-secondary" onClick={loadInviti} disabled={invitiLoading || invitoSaving}>
              Aggiorna lista inviti
            </button>
          </div>

          {latestInvito?.onboarding_url && (
            <div className="alert alert-success mt-3">
              <div className="small fw-semibold mb-2">Invito creato</div>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  className="btn btn-sm btn-outline-success"
                  onClick={() => copyToClipboard(latestInvito.onboarding_url, 'Link invito copiato')}
                >
                  Copia link invito
                </button>
                <button
                  className="btn btn-sm btn-outline-success"
                  onClick={() => copyToClipboard(latestInvito.onboarding_token, 'Token invito copiato')}
                >
                  Copia token invito
                </button>
              </div>
              <div className="small text-break mt-2">{latestInvito.onboarding_url}</div>
            </div>
          )}

          <div className="mt-3">
            {invitiLoading ? (
              <div className="text-muted small">Caricamento inviti...</div>
            ) : inviti.length === 0 ? (
              <div className="text-muted small">Nessun invito presente.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Ruolo</th>
                      <th>Scade</th>
                      <th>Stato</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inviti.map((invito) => {
                      const isRevoked = Boolean(invito.revoked_at)
                      const isUsed = Boolean(invito.used_at)
                      const isExpired = invito.expires_at ? new Date(invito.expires_at) <= new Date() : false
                      const status = isRevoked
                        ? 'Revocato'
                        : isUsed
                          ? 'Usato'
                          : isExpired
                            ? 'Scaduto'
                            : 'Attivo'
                      const canRevoke = !isRevoked && !isUsed && !isExpired
                      return (
                        <tr key={invito.id}>
                          <td>{invito.email}</td>
                          <td>{invito.role}</td>
                          <td>{invito.expires_at ? new Date(invito.expires_at).toLocaleString('it-IT') : '-'}</td>
                          <td>{status}</td>
                          <td>
                            {canRevoke ? (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRevokeInvite(invito)}
                                disabled={invitoSaving}
                              >
                                Revoca
                              </button>
                            ) : (
                              <span className="text-muted small">-</span>
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
                              <div className="d-flex align-items-center gap-2 mb-2">
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => {
                                    setShowPasswordEdit((prev) => {
                                      const next = !prev
                                      if (!next) {
                                        setEditData((data) => ({ ...data, password: '' }))
                                      }
                                      return next
                                    })
                                  }}
                                >
                                  {showPasswordEdit ? 'Annulla password' : 'Cambia password'}
                                </button>
                              </div>
                              {showPasswordEdit && (
                                <input
                                  type="password"
                                  className="form-control mb-2"
                                  placeholder="Nuova password"
                                  value={editData.password}
                                  autoComplete="new-password"
                                  onChange={(e) => setEditData((prev) => ({ ...prev, password: e.target.value }))}
                                />
                              )}
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

    <ConfirmDeleteModal
      show={Boolean(deleteUtente)}
      title="Elimina utente"
      message={`Eliminare l'utente ${deleteUtente?.username || ''}?`}
      loading={deleteUtenteLoading}
      onClose={() => {
        if (!deleteUtenteLoading) setDeleteUtente(null)
      }}
      onConfirm={confirmDeleteUtente}
    />
    </>
  )
}

export default ImpostazioniUtenti

