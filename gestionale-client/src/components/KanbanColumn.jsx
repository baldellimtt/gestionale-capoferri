import { useState } from 'react'
import KanbanCard from './KanbanCard'

function KanbanColumn({
  colonna,
  card,
  commesse = [],
  onCardClick,
  onMoveCard,
  onQuickUpdate,
  onDelete,
  cardsOverride = null,
  disableDrop = false,
  onColumnDragStart = null,
  onColumnDragEnd = null,
  onColumnDrop = null,
  columnDragDisabled = false,
  isColumnDragging = false,
  columnDragId = null
}) {
  const [dragOver, setDragOver] = useState(false)
  const [columnDragOver, setColumnDragOver] = useState(false)
  
  const cardInColonna = Array.isArray(cardsOverride)
    ? cardsOverride
    : card.filter(c => c.colonna_id === colonna.id)

  const isColumnDrag = (e) => {
    if (columnDragId) return true
    const types = Array.from(e.dataTransfer?.types || [])
    return types.includes('application/x-kanban-column')
  }

  const getColumnDragId = (e) => {
    const direct = e.dataTransfer.getData('application/x-kanban-column')
    if (direct) return direct
    const plain = e.dataTransfer.getData('text/plain') || ''
    if (plain.startsWith('kanban-column:')) {
      return plain.replace('kanban-column:', '')
    }
    return columnDragId
  }

  const handleDragOver = (e) => {
    if (isColumnDrag(e)) {
      if (columnDragDisabled || !onColumnDrop) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setColumnDragOver(true)
      return
    }
    if (disableDrop) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    if (isColumnDrag(e)) {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setColumnDragOver(false)
      }
      return
    }
    if (disableDrop) return
    e.preventDefault()
    // Solo se stiamo uscendo dalla colonna, non da un elemento figlio
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false)
    }
  }

  const handleDrop = async (e) => {
    const columnData = getColumnDragId(e)
    if (columnData && onColumnDrop) {
      setColumnDragOver(false)
      onColumnDrop(e)
      return
    }
    if (disableDrop) return
    e.preventDefault()
    setDragOver(false)
    
    const cardData = e.dataTransfer.getData('application/json')
    if (!cardData) return
    
    try {
      const draggedCard = JSON.parse(cardData)
      
      // Se la card è già in questa colonna, non fare nulla
      if (draggedCard.colonna_id === colonna.id) {
        return
      }
      
      // Calcola la nuova posizione (alla fine della colonna)
      const maxOrdine = cardInColonna.length > 0
        ? Math.max(...cardInColonna.map(c => c.ordine || 0))
        : 0
      
      const newOrdine = maxOrdine + 1
      
      // Chiama onMoveCard per spostare la card
      if (onMoveCard) {
        await onMoveCard(draggedCard.id, colonna.id, newOrdine)
      }
    } catch (err) {
      console.error('Errore durante il drop:', err)
    }
  }

  return (
    <div
      className="kanban-column"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        minWidth: '300px',
        width: '300px',
        background: dragOver
          ? `linear-gradient(135deg, ${colonna.colore || '#3b82f6'}10 0%, var(--bg-2) 100%)`
          : 'var(--bg-2)',
        borderRadius: 'var(--radius-sm)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        border: dragOver
          ? `2px dashed ${colonna.colore || '#3b82f6'}`
          : `1px solid var(--border-soft)`,
        boxShadow: dragOver
          ? `0 0 0 4px ${colonna.colore || '#3b82f6'}20, var(--shadow-2)`
          : 'var(--shadow-1)',
        outline: columnDragOver ? `2px solid ${colonna.colore || '#3b82f6'}70` : 'none',
        outlineOffset: '2px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative'
      }}
    >
      {/* Drop indicator */}
      {dragOver && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `${colonna.colore || '#3b82f6'}08`,
            borderRadius: 'var(--radius-sm)',
            pointerEvents: 'none',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: `2px solid ${colonna.colore || '#3b82f6'}`
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--ink-800)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          {onColumnDragStart && !columnDragDisabled && (
            <span
              draggable
              onDragStart={onColumnDragStart}
              onDragEnd={onColumnDragEnd}
              title="Trascina per riordinare"
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.2rem',
                cursor: isColumnDragging ? 'grabbing' : 'grab',
                color: 'var(--ink-500)',
                userSelect: 'none'
              }}
            >
              |||
            </span>
          )}
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: colonna.colore || '#3b82f6',
              display: 'inline-block'
            }}
          />
          {colonna.nome}
        </h3>
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: colonna.colore || '#3b82f6',
            background: `linear-gradient(135deg, ${colonna.colore || '#3b82f6'}15 0%, ${colonna.colore || '#3b82f6'}08 100%)`,
            padding: '0.3rem 0.7rem',
            borderRadius: '16px',
            border: `1px solid ${colonna.colore || '#3b82f6'}30`,
            boxShadow: `0 2px 4px ${colonna.colore || '#3b82f6'}15`,
            minWidth: '32px',
            textAlign: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          {cardInColonna.length}
        </span>
      </div>

      <div
        className="kanban-column-cards"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: '200px'
        }}
      >
        {cardInColonna.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              color: 'var(--ink-400)',
              fontSize: '0.85rem',
              fontStyle: 'italic'
            }}
          >
            Nessuna card
          </div>
        ) : (
          cardInColonna.map((cardItem) => (
            <KanbanCard
              key={cardItem.id}
              card={cardItem}
              commesse={commesse}
              onCardClick={onCardClick}
              onQuickUpdate={onQuickUpdate}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default KanbanColumn


