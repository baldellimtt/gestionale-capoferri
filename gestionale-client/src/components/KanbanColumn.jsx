import { useState } from 'react'
import KanbanCard from './KanbanCard'

function KanbanColumn({ colonna, card, onCardClick, onMoveCard }) {
  const [dragOver, setDragOver] = useState(false)
  const [draggedCardId, setDraggedCardId] = useState(null)
  
  const cardInColonna = card.filter(c => c.colonna_id === colonna.id)

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    // Solo se stiamo uscendo dalla colonna, non da un elemento figlio
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false)
    }
  }

  const handleDrop = async (e) => {
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
              onCardClick={onCardClick}
              onMove={onMoveCard}
              colonne={[]}
              isDraggingOver={dragOver && draggedCardId === cardItem.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default KanbanColumn




