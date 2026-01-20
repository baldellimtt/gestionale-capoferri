import { useState, useEffect } from 'react'
import api from '../services/api'

function KanbanNotifications({ onNotificationClick }) {
  const [notifiche, setNotifiche] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadUnreadCount()
    if (showDropdown) {
      loadNotifiche()
    }
  }, [showDropdown])

  // Polling per aggiornare il conteggio ogni 30 secondi
  useEffect(() => {
    const interval = setInterval(() => {
      loadUnreadCount()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadUnreadCount = async () => {
    try {
      const data = await api.getKanbanUnreadCount()
      setUnreadCount(data.count || 0)
    } catch (err) {
      console.error('Errore caricamento conteggio notifiche:', err)
    }
  }

  const loadNotifiche = async () => {
    try {
      setLoading(true)
      const data = await api.getKanbanNotifiche(false)
      setNotifiche(data || [])
    } catch (err) {
      console.error('Errore caricamento notifiche:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id) => {
    try {
      await api.markKanbanNotificaAsRead(id)
      setNotifiche(notifiche.map(n => n.id === id ? { ...n, letto: 1 } : n))
      setUnreadCount(Math.max(0, unreadCount - 1))
    } catch (err) {
      console.error('Errore marcatura notifica come letta:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllKanbanNotificheAsRead()
      setNotifiche(notifiche.map(n => ({ ...n, letto: 1 })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Errore marcatura tutte le notifiche come lette:', err)
    }
  }

  const handleNotificationClick = (notifica) => {
    if (!notifica.letto) {
      handleMarkAsRead(notifica.id)
    }
    if (onNotificationClick) {
      onNotificationClick(notifica)
    }
    setShowDropdown(false)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Adesso'
    if (diffMins < 60) return `${diffMins} min fa`
    if (diffHours < 24) return `${diffHours} ore fa`
    if (diffDays < 7) return `${diffDays} giorni fa`
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getNotificationIcon = (tipo) => {
    const iconStyle = { width: '16px', height: '16px', display: 'inline-block', verticalAlign: 'middle' }
    
    switch (tipo) {
      case 'card_creata':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="3" y1="9" x2="21" y2="9" />
          </svg>
        )
      case 'card_modificata':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        )
      case 'card_spostata':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )
      case 'scadenza_creata':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        )
      case 'commento_aggiunto':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconStyle}>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        )
    }
  }

  return (
    <div className="kanban-notifications" style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary btn-sm position-relative"
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          minWidth: '44px',
          height: '38px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-soft)',
          background: 'var(--bg-1)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: showDropdown ? 'var(--shadow-2)' : 'var(--shadow-1)',
          transform: showDropdown ? 'scale(1.05)' : 'scale(1)',
          color: 'var(--ink-700)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = 'var(--shadow-2)'
          e.currentTarget.style.background = 'var(--bg-2)'
          e.currentTarget.style.color = 'var(--ink-800)'
        }}
        onMouseLeave={(e) => {
          if (!showDropdown) {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = 'var(--shadow-1)'
            e.currentTarget.style.background = 'var(--bg-1)'
            e.currentTarget.style.color = 'var(--ink-700)'
          }
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: unreadCount > 0 ? 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))' : 'none',
            color: 'inherit'
          }}
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="badge bg-danger position-absolute top-0 start-100 translate-middle"
            style={{
              fontSize: '0.7rem',
              padding: '0.25rem 0.4rem',
              borderRadius: '50%',
              minWidth: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 2s ease-in-out infinite',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
              border: '2px solid var(--bg-1)'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1040
            }}
            onClick={() => setShowDropdown(false)}
          />
          <div
            className="card"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              minWidth: '350px',
              maxWidth: '400px',
              maxHeight: '500px',
              zIndex: 1050,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px var(--border-soft)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-soft)',
              background: 'var(--bg-1)',
              animation: 'slideIn 0.2s ease-out',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Notifiche</strong>
              {unreadCount > 0 && (
                <button
                  className="btn btn-sm btn-link p-0"
                  onClick={handleMarkAllAsRead}
                  style={{ fontSize: '0.8rem' }}
                >
                  Segna tutte come lette
                </button>
              )}
            </div>
            <div className="card-body p-0" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              {loading ? (
                <div className="text-center py-3">
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Caricamento...</span>
                  </div>
                </div>
              ) : notifiche.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  Nessuna notifica
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {notifiche.map((notifica) => (
                    <div
                      key={notifica.id}
                      className={`list-group-item list-group-item-action ${
                        !notifica.letto ? 'bg-light' : ''
                      }`}
                      style={{
                        cursor: 'pointer',
                        padding: '0.75rem',
                        borderLeft: !notifica.letto ? '3px solid var(--brand-500)' : 'none',
                        transition: 'all 0.2s ease',
                        borderRadius: 'var(--radius-sm)',
                        margin: '0.25rem',
                        background: !notifica.letto 
                          ? 'linear-gradient(90deg, var(--brand-500)08 0%, transparent 100%)'
                          : 'transparent'
                      }}
                      onClick={() => handleNotificationClick(notifica)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-2)'
                        e.currentTarget.style.transform = 'translateX(4px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = !notifica.letto 
                          ? 'linear-gradient(90deg, var(--brand-500)08 0%, transparent 100%)'
                          : 'transparent'
                        e.currentTarget.style.transform = 'translateX(0)'
                      }}
                    >
                      <div className="d-flex align-items-start gap-2">
                        <span style={{ 
                          color: 'var(--ink-600)',
                          display: 'flex',
                          alignItems: 'center',
                          marginTop: '2px'
                        }}>
                          {getNotificationIcon(notifica.tipo)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <strong style={{ fontSize: '0.9rem' }}>
                              {notifica.titolo}
                            </strong>
                            {!notifica.letto && (
                              <span
                                className="badge bg-primary"
                                style={{ fontSize: '0.65rem' }}
                              >
                                Nuova
                              </span>
                            )}
                          </div>
                          {notifica.messaggio && (
                            <p style={{ fontSize: '0.85rem', margin: '0.25rem 0', color: 'var(--ink-600)' }}>
                              {notifica.messaggio}
                            </p>
                          )}
                          <small style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>
                            {formatDate(notifica.created_at)}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default KanbanNotifications

