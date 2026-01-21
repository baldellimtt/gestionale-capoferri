import { useState, useEffect } from 'react'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'

function KanbanComments({ cardId, currentUser, onCommentAdded, toast }) {
  const [commenti, setCommenti] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null })
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (cardId) {
      loadCommenti()
    }
  }, [cardId])

  const loadCommenti = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getKanbanCommenti(cardId)
      setCommenti(data || [])
    } catch (err) {
      console.error('Errore caricamento commenti:', err)
      setError('Errore nel caricamento dei commenti')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      setError(null)
      const created = await api.createKanbanCommento(cardId, newComment.trim())
      setCommenti([...commenti, created])
      setNewComment('')
      if (onCommentAdded) {
        onCommentAdded(created)
      }
    } catch (err) {
      console.error('Errore creazione commento:', err)
      setError('Errore nella creazione del commento')
    }
  }

  const handleEdit = (commento) => {
    setEditingId(commento.id)
    setEditText(commento.commento)
  }

  const handleUpdate = async (id) => {
    if (!editText.trim()) return

    try {
      setError(null)
      const updated = await api.updateKanbanCommento(id, editText.trim())
      setCommenti(commenti.map(c => c.id === id ? updated : c))
      setEditingId(null)
      setEditText('')
    } catch (err) {
      console.error('Errore aggiornamento commento:', err)
      setError('Errore nell\'aggiornamento del commento')
    }
  }

  const handleDeleteClick = (id) => {
    setDeleteConfirm({ show: true, id })
  }

  const handleDeleteConfirm = async () => {
    const { id } = deleteConfirm
    if (!id) {
      setDeleteConfirm({ show: false, id: null })
      return
    }

    setDeleting(true)
    try {
      setError(null)
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Eliminazione commento')
      await api.deleteKanbanCommento(id)
      setCommenti(commenti.filter(c => c.id !== id))
      setDeleteConfirm({ show: false, id: null })
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Commento eliminato con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Commento eliminato con successo')
      }
    } catch (err) {
      console.error('Errore eliminazione commento:', err)
      const errorMsg = 'Errore nell\'eliminazione del commento'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, id: null })
  }

  const getUserLabel = (commento) => {
    const fullName = [commento.nome, commento.cognome].filter(Boolean).join(' ').trim()
    return fullName || commento.username || 'Utente'
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!cardId) {
    return null
  }

  return (
    <div className="kanban-comments" style={{ marginTop: '1.5rem' }}>
      <h6 style={{ marginBottom: '1rem', fontWeight: 600 }}>Commenti</h6>

      {error && (
        <div className="alert alert-warning alert-sm mb-3">
          {error}
        </div>
      )}

      <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1rem' }}>
        {loading ? (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Caricamento...</span>
            </div>
          </div>
        ) : commenti.length === 0 ? (
          <p style={{ color: 'var(--ink-500)', fontStyle: 'italic' }}>Nessun commento</p>
        ) : (
          <div className="comment-list">
            {commenti.map((commento) => (
              <div
                key={commento.id}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.75rem',
                  background: 'var(--surface-soft)',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-soft)'
                }}
              >
                {editingId === commento.id ? (
                  <div>
                    <textarea
                      className="form-control form-control-sm"
                      rows="3"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      style={{ marginBottom: '0.5rem' }}
                    />
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleUpdate(commento.id)}
                      >
                        Salva
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setEditingId(null)
                          setEditText('')
                        }}
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <strong style={{ fontSize: '0.875rem' }}>
                          {getUserLabel(commento)}
                        </strong>
                        <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                          {formatDate(commento.created_at)}
                        </span>
                      </div>
                      {currentUser && commento.user_id === currentUser.id && (
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-sm btn-link p-0"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => handleEdit(commento)}
                          >
                            Modifica
                          </button>
                          <button
                            className="btn btn-sm btn-link p-0 text-danger"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => handleDeleteClick(commento.id)}
                          >
                            Elimina
                          </button>
                        </div>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                      {commento.commento}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          className="form-control form-control-sm"
          rows="3"
          placeholder="Aggiungi un commento..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          style={{ marginBottom: '0.5rem' }}
        />
        <button
          type="submit"
          className="btn btn-sm btn-primary"
          disabled={!newComment.trim()}
        >
          Aggiungi commento
        </button>
      </form>

      <ConfirmDeleteModal
        show={deleteConfirm.show}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Elimina commento"
        message="Sei sicuro di voler eliminare questo commento?"
      />
    </div>
  )
}

export default KanbanComments



