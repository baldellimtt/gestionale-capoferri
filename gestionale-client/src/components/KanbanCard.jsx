import { useEffect, useRef, useState } from 'react'

function KanbanCard({ card, commesse = [], onCardClick, onQuickUpdate, onDelete }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(card.titolo || '')
  const [isEditingPriorita, setIsEditingPriorita] = useState(false)
  const [isEditingDueDate, setIsEditingDueDate] = useState(false)
  const [dueDateDraft, setDueDateDraft] = useState('')
  const suppressClickUntilRef = useRef(0)

  const getPrioritaColor = (priorita) => {
    switch (priorita) {
      case 'urgente':
        return '#ef4444'
      case 'alta':
        return '#f59e0b'
      case 'media':
        return '#3b82f6'
      case 'bassa':
        return '#10b981'
      default:
        return '#6b7280'
    }
  }

  const getPrioritaLabel = (priorita) => {
    return priorita ? priorita.charAt(0).toUpperCase() + priorita.slice(1) : 'Media'
  }

  const formatDateTime = (value) => {
    if (!value) return null
    const clean = String(value).trim()
    const [datePart, timePart] = clean.includes('T')
      ? clean.split('T')
      : clean.includes(' ')
        ? clean.split(' ')
        : [clean, '']
    if (!datePart) return null
    const [year, month, day] = datePart.split('-')
    if (!year || !month || !day) return null
    const dateLabel = `${day}/${month}/${year}`
    const time = timePart ? timePart.slice(0, 5) : ''
    if (!time) return dateLabel
    const timeLabel = time.replace(':', '.')
    return `${dateLabel} ore ${timeLabel}`
  }

  const toDateInputValue = (dateString) => {
    if (!dateString) return ''
    return dateString.length > 10 ? dateString.slice(0, 10) : dateString
  }

  const toLocalDateString = () => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  useEffect(() => {
    setTitleDraft(card.titolo || '')
    setDueDateDraft(toDateInputValue(card.data_fine_prevista))
  }, [card.id, card.titolo, card.data_fine_prevista])

  const isScaduta = (dateString) => {
    if (!dateString) return false
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const isScadenzaProssima = (dateString) => {
    if (!dateString) return false
    const date = new Date(dateString)
    const today = new Date()
    const in7Days = new Date(today)
    in7Days.setDate(today.getDate() + 7)
    today.setHours(0, 0, 0, 0)
    return date >= today && date <= in7Days
  }

  const handleCardClick = (e) => {
    e.stopPropagation()
    if (Date.now() < suppressClickUntilRef.current) {
      return
    }
    if (onCardClick && !isDragging && !isEditingTitle && !isEditingPriorita && !isEditingDueDate) {
      onCardClick(card)
    }
  }

  const handleDragStart = (e) => {
    if (isEditingTitle || isEditingPriorita || isEditingDueDate) {
      e.preventDefault()
      return
    }
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', card.id.toString())
    e.dataTransfer.setData('application/json', JSON.stringify(card))
    const dragImage = e.currentTarget.cloneNode(true)
    dragImage.style.opacity = '0.8'
    dragImage.style.transform = 'rotate(3deg)'
    dragImage.style.width = e.currentTarget.offsetWidth + 'px'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, e.currentTarget.offsetWidth / 2, 20)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }

  const handleDragEnd = (e) => {
    setIsDragging(false)
    e.dataTransfer.clearData()
  }

  const cancelTitleEdit = () => {
    setTitleDraft(card.titolo || '')
    setIsEditingTitle(false)
  }

  const commitTitleEdit = async () => {
    const nextTitle = titleDraft.trim()
    if (!nextTitle) {
      cancelTitleEdit()
      return
    }
    if (nextTitle === card.titolo) {
      setIsEditingTitle(false)
      return
    }
    try {
      await onQuickUpdate?.(card.id, { titolo: nextTitle })
    } finally {
      setIsEditingTitle(false)
    }
  }

  const commitPrioritaEdit = async (next) => {
    if (!next || next === card.priorita) {
      setIsEditingPriorita(false)
      return
    }
    try {
      await onQuickUpdate?.(card.id, { priorita: next })
    } finally {
      setIsEditingPriorita(false)
    }
  }

  const commitDueDateEdit = async () => {
    const next = dueDateDraft || null
    const current = toDateInputValue(card.data_fine_prevista)
    if (next === current) {
      setIsEditingDueDate(false)
      return
    }
    try {
      await onQuickUpdate?.(card.id, { data_fine_prevista: next })
    } finally {
      setIsEditingDueDate(false)
    }
  }

  const prioritaColor = getPrioritaColor(card.priorita)
  const dataFine = formatDateTime(card.data_fine_prevista)
  const noDeadline = !card.data_fine_prevista
  const dataInizio = formatDateTime(card.data_inizio)
  const scaduta = dataFine && isScaduta(card.data_fine_prevista)
  const scadenzaProssima = dataFine && isScadenzaProssima(card.data_fine_prevista)
  const commessaRef = card.commessa_id
    ? commesse.find((item) => String(item.id) === String(card.commessa_id))
    : null
  const commessaLabel = commessaRef?.titolo || (card.commessa_id ? `Commessa #${card.commessa_id}` : '')
  const isCompleted = Boolean(card.data_fine_effettiva)

  return (
    <div
      className="kanban-card"
      draggable={!isEditingTitle && !isEditingPriorita && !isEditingDueDate}
      onClick={handleCardClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'var(--bg-1)',
        border: `2px solid ${prioritaColor}`,
        borderRadius: 'var(--radius-sm)',
        padding: '0.75rem',
        marginBottom: '0.5rem',
        cursor: isDragging ? 'grabbing' : (isEditingTitle || isEditingPriorita || isEditingDueDate ? 'default' : 'grab'),
        transition: isDragging
          ? 'none'
          : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isDragging
          ? '0 8px 24px rgba(0, 0, 0, 0.2), 0 0 0 2px ' + prioritaColor + '40'
          : isHovered
            ? '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px ' + prioritaColor + '30'
            : 'var(--shadow-1)',
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging
          ? 'scale(0.98) rotate(2deg)'
          : isHovered
            ? 'translateY(-2px) scale(1.01)'
            : 'translateY(0) scale(1)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {isHovered && !isDragging && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(135deg, ${prioritaColor}08 0%, transparent 100%)`,
            pointerEvents: 'none',
            borderRadius: 'var(--radius-sm)'
          }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        {isEditingTitle ? (
          <input
            className="form-control form-control-sm"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitTitleEdit()
              }
              if (e.key === 'Escape') {
                cancelTitleEdit()
              }
            }}
            onBlur={commitTitleEdit}
            style={{ fontSize: '0.85rem', marginRight: '0.5rem' }}
          />
        ) : (
          <div style={{ flex: 1, marginRight: '0.5rem' }}>
            <h5
              onDoubleClick={(e) => {
                e.stopPropagation()
                suppressClickUntilRef.current = Date.now() + 400
                setIsEditingTitle(true)
              }}
              style={{
                margin: 0,
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--ink-800)'
              }}
            >
              {card.titolo}
            </h5>
            {isCompleted && (
              <div style={{ marginTop: '0.35rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: '#0f766e',
                    background: '#ccfbf1',
                    border: '1px solid #99f6e4',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '999px',
                    textTransform: 'uppercase'
                  }}
                >
                  Completata
                </span>
              </div>
            )}
          </div>
        )}

        {isEditingPriorita ? (
          <select
            className="form-select form-select-sm"
            value={card.priorita || 'media'}
            onChange={(e) => commitPrioritaEdit(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => setIsEditingPriorita(false)}
            style={{ fontSize: '0.75rem', minWidth: '110px' }}
          >
            <option value="bassa">Bassa</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        ) : (
          <div style={{ textAlign: 'right' }}>
            <span
              onClick={(e) => {
                e.stopPropagation()
                setIsEditingPriorita(true)
              }}
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.25rem 0.6rem',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${prioritaColor}25 0%, ${prioritaColor}15 100%)`,
                color: prioritaColor,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                border: `1px solid ${prioritaColor}30`,
                boxShadow: `0 2px 4px ${prioritaColor}15`,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                display: 'inline-block'
              }}
            >
              {getPrioritaLabel(card.priorita)}
            </span>
          </div>
        )}
      </div>

      {card.descrizione && (
        <p style={{
          fontSize: '0.8rem',
          color: 'var(--ink-600)',
          margin: '0.5rem 0',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {card.descrizione}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
        {card.commessa_id && (
          <div style={{ color: 'var(--ink-600)' }}>
            <strong>Commessa:</strong> {commessaLabel}
          </div>
        )}
        {card.cliente_nome && (
          <div style={{ color: 'var(--ink-600)' }}>
            <strong>Cliente:</strong> {card.cliente_nome}
          </div>
        )}
        {dataFine && !isEditingDueDate ? (
          <div style={{
            color: scaduta ? '#ef4444' : (scadenzaProssima ? '#f59e0b' : 'var(--ink-600)'),
            fontWeight: scaduta || scadenzaProssima ? 600 : 400,
            cursor: 'pointer'
          }}>
            <strong onClick={(e) => {
              e.stopPropagation()
              setIsEditingDueDate(true)
            }}>
              Scadenza:
            </strong>{' '}
            <span
              onClick={(e) => {
                e.stopPropagation()
                setIsEditingDueDate(true)
              }}
            >
              {dataFine}
            </span>
            {scaduta && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '0.25rem' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {scadenzaProssima && !scaduta && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '0.25rem' }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>
        ) : (dataInizio && !noDeadline) ? (
          <div style={{ color: 'var(--ink-600)' }}>
            <strong>Quando:</strong> {dataInizio}
          </div>
        ) : (!noDeadline) ? (
          <div style={{ color: 'var(--ink-600)' }}>
            <strong>Scadenza:</strong>{' '}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsEditingDueDate(true)
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                color: 'inherit',
                fontWeight: 400,
                cursor: 'pointer'
              }}
            >
              aggiungi
            </button>
          </div>
        ) : null}
        {isEditingDueDate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <strong style={{ color: 'var(--ink-600)' }}>Scadenza:</strong>
            <input
              type="date"
              className="form-control form-control-sm"
              value={dueDateDraft}
              onChange={(e) => setDueDateDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitDueDateEdit()
                }
                if (e.key === 'Escape') {
                  setIsEditingDueDate(false)
                }
              }}
              onBlur={commitDueDateEdit}
              style={{ maxWidth: '150px' }}
            />
          </div>
        )}
      </div>

      <div className="kanban-card-actions">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (isCompleted) return
            onQuickUpdate?.(card.id, { data_fine_effettiva: toLocalDateString(), avanzamento: 100 })
          }}
          disabled={isCompleted}
          title={isCompleted ? 'Già completata' : 'Segna come completata'}
          onMouseDown={(e) => e.stopPropagation()}
          className={`kanban-card-action ${isCompleted ? 'is-disabled' : 'is-complete'}`}
        >
          COMPLETATA
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.(card.id)
          }}
          title="Elimina card"
          onMouseDown={(e) => e.stopPropagation()}
          className="kanban-card-action is-delete"
        >
          ELIMINA
        </button>
      </div>
    </div>
  )
}

export default KanbanCard

