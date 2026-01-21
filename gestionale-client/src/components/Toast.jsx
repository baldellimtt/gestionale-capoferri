import { useEffect, useState } from 'react'

export const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: '400px',
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

const Toast = ({ toast, onClose }) => {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Animazione di entrata con piccolo delay per assicurarsi che il DOM sia pronto
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)
    return () => clearTimeout(timer)

    // Progress bar animata
    if (toast.type === 'loading') {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev
          return prev + Math.random() * 15
        })
      }, 200)
      return () => clearInterval(interval)
    } else {
      // Per toast di successo/errore, progress bar completa
      setProgress(100)
    }
  }, [toast.type])

  useEffect(() => {
    if (toast.type !== 'loading' && toast.duration) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onClose, 300) // Aspetta animazione di uscita
      }, toast.duration)

      return () => clearTimeout(timer)
    }
  }, [toast.type, toast.duration, onClose])

  const getToastStyles = () => {
    const baseStyles = {
      background: 'var(--bg-1)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-md)',
      padding: '1rem 1.25rem',
      boxShadow: 'var(--shadow-3)',
      minWidth: '300px',
      maxWidth: '400px',
      pointerEvents: 'auto',
      transform: isVisible ? 'translateX(0)' : 'translateX(400px)',
      opacity: isVisible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden'
    }

    switch (toast.type) {
      case 'success':
        return {
          ...baseStyles,
          borderLeft: '4px solid #10b981'
        }
      case 'error':
        return {
          ...baseStyles,
          borderLeft: '4px solid #ef4444'
        }
      case 'loading':
        return {
          ...baseStyles,
          borderLeft: '4px solid var(--brand-500)'
        }
      default:
        return baseStyles
    }
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: '#10b981' }}
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )
      case 'error':
        return (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: '#ef4444' }}
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )
      case 'loading':
        return (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: 'var(--brand-500)' }}
            className="spinning"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div style={getToastStyles()}>
      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'var(--bg-3)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background:
              toast.type === 'success'
                ? '#10b981'
                : toast.type === 'error'
                ? '#ef4444'
                : 'var(--brand-500)',
            transition: 'width 0.3s ease',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)'
          }}
        />
      </div>

      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ flexShrink: 0, marginTop: '2px' }}>{getIcon()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {toast.title && (
            <div
              style={{
                fontWeight: 600,
                fontSize: '0.95rem',
                color: 'var(--ink-800)',
                marginBottom: toast.message ? '0.25rem' : 0
              }}
            >
              {toast.title}
            </div>
          )}
          {toast.message && (
            <div style={{ fontSize: '0.85rem', color: 'var(--ink-600)', lineHeight: '1.4' }}>
              {toast.message}
            </div>
          )}
        </div>
        {toast.type !== 'loading' && (
          <button
            onClick={() => {
              setIsVisible(false)
              setTimeout(onClose, 300)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink-400)',
              cursor: 'pointer',
              padding: '0',
              marginLeft: '0.5rem',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--bg-3)'
              e.target.style.color = 'var(--ink-600)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none'
              e.target.style.color = 'var(--ink-400)'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}

