import React from 'react'

function ConfirmDeleteModal({ 
  show, 
  onClose, 
  onConfirm, 
  loading = false,
  title = 'Elimina',
  message = 'Sei sicuro di voler eliminare questo elemento?'
}) {
  if (!show) return null

  return (
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
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content" style={{ 
          background: '#ffffff', 
          borderColor: 'rgba(42, 63, 84, 0.2)',
          borderRadius: '4px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          <div className="modal-header" style={{ 
            borderBottomColor: 'rgba(42, 63, 84, 0.15)',
            padding: '1.25rem 1.5rem'
          }}>
            <h5 className="modal-title" style={{ 
              color: '#2a3f54',
              fontWeight: 700,
              fontFamily: 'var(--font-display)'
            }}>
              {title}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
              style={{ opacity: loading ? 0.5 : 1 }}
            />
          </div>

          <div className="modal-body" style={{ padding: '1.5rem' }}>
            <p style={{ 
              color: '#1a1a1a',
              marginBottom: '1rem',
              fontSize: '1rem',
              fontFamily: 'var(--font-sans)'
            }}>
              {message}
            </p>
            <div className="alert alert-warning" style={{ 
              backgroundColor: 'rgba(245, 158, 11, 0.1)', 
              borderColor: 'rgba(245, 158, 11, 0.3)',
              color: '#92400e',
              borderRadius: '4px',
              padding: '0.75rem 1rem',
              marginBottom: 0
            }}>
              <strong>Attenzione:</strong> Questa azione e irreversibile.
            </div>
          </div>

          <div className="modal-footer" style={{ 
            borderTopColor: 'rgba(42, 63, 84, 0.15)',
            padding: '1rem 1.5rem'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
              style={{ borderRadius: '2px' }}
            >
              Annulla
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
              disabled={loading}
              style={{ borderRadius: '2px' }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Eliminazione...
                </>
              ) : (
                'Elimina'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDeleteModal



