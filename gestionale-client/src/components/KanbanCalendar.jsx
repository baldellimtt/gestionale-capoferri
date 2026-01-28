import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'

function KanbanCalendar({ card, scadenze, colonne, clienti, filters, onCardClick, onDateClick }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('month') // 'month', 'week', 'day'
  const [selectedDate, setSelectedDate] = useState(null)

  const parseDateTime = (value) => {
    if (!value) return { date: '', time: '' }
    const clean = String(value).trim()
    const [datePart, timePart] = clean.includes('T')
      ? clean.split('T')
      : clean.includes(' ')
        ? clean.split(' ')
        : [clean, '']
    return { date: datePart.slice(0, 10), time: timePart ? timePart.slice(0, 5) : '' }
  }

  const formatTimeLabel = (time) => {
    if (!time) return ''
    return time.replace(':', '.')
  }

  const getEventTimeLabel = (event) => {
    const start = parseDateTime(event.date)
    const end = parseDateTime(event.endDate)
    if (!start.time && !end.time) return ''
    if (start.time && end.time && start.date === end.date) {
      return `${formatTimeLabel(start.time)}-${formatTimeLabel(end.time)}`
    }
    if (start.time) return formatTimeLabel(start.time)
    return formatTimeLabel(end.time)
  }

  // Calcola gli eventi per il calendario
  const events = useMemo(() => {
    const allEvents = []
    
    // Aggiungi card come eventi
    card.forEach(c => {
      if (c.data_inizio) {
        allEvents.push({
          id: `card-${c.id}`,
          type: 'card',
          cardId: c.id,
          title: c.titolo,
          date: c.data_inizio,
          endDate: c.data_fine_prevista,
          priorita: c.priorita,
          cliente_nome: c.cliente_nome,
          colonna_nome: c.colonna_nome,
          avanzamento: c.avanzamento
        })
      }
      
      if (c.data_fine_prevista) {
        allEvents.push({
          id: `deadline-${c.id}`,
          type: 'deadline',
          cardId: c.id,
          title: `Scadenza: ${c.titolo}`,
          date: c.data_fine_prevista,
          priorita: c.priorita,
          cliente_nome: c.cliente_nome,
          isDeadline: true
        })
      }
    })
    
    // Aggiungi scadenze come eventi
    scadenze.forEach(s => {
      allEvents.push({
        id: `scadenza-${s.id}`,
        type: 'scadenza',
        scadenzaId: s.id,
        cardId: s.card_id,
        title: s.titolo,
        date: s.data_scadenza,
        priorita: s.priorita,
        completata: s.completata,
        isDeadline: true
      })
    })
    
    return allEvents
  }, [card, scadenze])

  // Filtra eventi in base ai filtri attivi
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (filters.cliente_id && event.cliente_nome) {
        const cliente = clienti.find(c => c.id == filters.cliente_id)
        if (!cliente || event.cliente_nome !== cliente.denominazione) {
          return false
        }
      }
      if (filters.priorita && event.priorita !== filters.priorita) {
        return false
      }
      if (filters.colonna_id && event.colonna_nome) {
        const colonna = colonne.find(c => c.id == filters.colonna_id)
        if (!colonna || event.colonna_nome !== colonna.nome) {
          return false
        }
      }
      return true
    })
  }, [events, filters, clienti, colonne])

  // Funzioni di navigazione
  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() - 1)
    }
    setCurrentDate(newDate)
  }

  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1)
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setDate(newDate.getDate() + 1)
    }
    setCurrentDate(newDate)
  }

  // Calcola giorni del mese
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days = []
    
    // Aggiungi giorni del mese precedente
    const prevMonth = new Date(year, month, 0)
    const daysInPrevMonth = prevMonth.getDate()
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false
      })
    }
    
    // Aggiungi giorni del mese corrente
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true
      })
    }
    
    // Aggiungi giorni del mese successivo per completare la griglia
    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false
      })
    }
    
    return days
  }, [currentDate])

  // Calcola settimana corrente
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Lunedì
    startOfWeek.setDate(diff)
    
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push(date)
    }
    return days
  }, [currentDate])

  // Ottieni eventi per una data specifica
  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.date).toISOString().split('T')[0]
      return eventDate === dateStr
    })
  }

  // Colori priorità
  const getPrioritaColor = (priorita) => {
    switch (priorita) {
      case 'urgente': return '#ef4444'
      case 'alta': return '#f59e0b'
      case 'media': return '#3b82f6'
      case 'bassa': return '#10b981'
      default: return '#6b7280'
    }
  }

  // Formatta data
  const formatDate = (date) => {
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatMonthYear = (date) => {
    const month = date.toLocaleDateString('it-IT', { month: 'long' })
    const year = date.getFullYear()
    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`
  }
  
  const formatWeekRange = (date) => {
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    
    const startStr = startOfWeek.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    const endStr = endOfWeek.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
    
    return `${startStr} - ${endStr}`
  }

  const isToday = (date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isPast = (date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate < today
  }

  // Render vista mensile
  const renderMonthView = () => {
    const weekDaysNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
    
    return (
      <div className="calendar-month-view">
        <div className="calendar-grid-header" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          {weekDaysNames.map(day => (
            <div key={day} style={{
              padding: '0.75rem',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
              color: 'var(--ink-600)',
              textTransform: 'uppercase'
            }}>
              {day}
            </div>
          ))}
        </div>
        
        <div className="calendar-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.5rem'
        }}>
          {monthDays.map((dayObj, index) => {
            const dayEvents = getEventsForDate(dayObj.date)
            const dayIsToday = isToday(dayObj.date)
            const dayIsPast = isPast(dayObj.date)
            
            return (
              <div
                key={index}
                className="calendar-day"
                onClick={() => {
                  setSelectedDate(dayObj.date)
                  if (onDateClick) onDateClick(dayObj.date)
                }}
                style={{
                  minHeight: '120px',
                  background: dayIsToday 
                    ? 'linear-gradient(135deg, var(--brand-500)10 0%, var(--bg-1) 100%)'
                    : dayObj.isCurrentMonth 
                      ? 'var(--bg-1)' 
                      : 'var(--bg-2)',
                  border: dayIsToday
                    ? `2px solid var(--brand-500)`
                    : `1px solid var(--border-soft)`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: dayObj.isCurrentMonth ? 1 : 0.4,
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = dayIsToday
                    ? 'linear-gradient(135deg, var(--brand-500)15 0%, var(--bg-2) 100%)'
                    : 'var(--bg-2)'
                  e.currentTarget.style.transform = 'scale(1.02)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = dayIsToday
                    ? 'linear-gradient(135deg, var(--brand-500)10 0%, var(--bg-1) 100%)'
                    : dayObj.isCurrentMonth 
                      ? 'var(--bg-1)' 
                      : 'var(--bg-2)'
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{
                  fontWeight: dayIsToday ? 700 : 600,
                  fontSize: '0.9rem',
                  color: dayIsToday 
                    ? 'var(--brand-700)'
                    : dayIsPast && dayObj.isCurrentMonth
                      ? 'var(--ink-400)'
                      : 'var(--ink-700)',
                  marginBottom: '0.5rem'
                }}>
                  {dayObj.date.getDate()}
                </div>
                
                <div className="calendar-day-events" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  maxHeight: '80px',
                  overflowY: 'auto'
                }}>
                  {dayEvents.slice(0, 3).map((event) => {
                    const timeLabel = getEventTimeLabel(event)
                    const displayTitle = timeLabel ? `${timeLabel} ${event.title}` : event.title
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onCardClick && event.cardId) {
                            const cardData = card.find(c => c.id === event.cardId)
                            if (cardData) onCardClick(cardData)
                          }
                        }}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px',
                          background: getPrioritaColor(event.priorita),
                          color: 'white',
                          fontWeight: 600,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)'
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)'
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
                        }}
                        title={displayTitle}
                      >
                        {displayTitle.length > 15 ? displayTitle.substring(0, 15) + '...' : displayTitle}
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--ink-500)',
                      fontWeight: 600,
                      textAlign: 'center'
                    }}>
                      +{dayEvents.length - 3} altri
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render vista settimanale
  const renderWeekView = () => {
    return (
      <div className="calendar-week-view">
        <div className="calendar-week-header" style={{
          display: 'grid',
          gridTemplateColumns: '200px repeat(7, 1fr)',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          <div style={{ padding: '0.75rem' }}></div>
          {weekDays.map(day => (
            <div key={day.toISOString()} style={{
              padding: '0.75rem',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: 'var(--ink-700)',
              borderBottom: '2px solid var(--border-soft)'
            }}>
              <div>{day.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
              <div style={{
                fontSize: '1.2rem',
                color: isToday(day) ? 'var(--brand-500)' : 'var(--ink-800)'
              }}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        
        <div className="calendar-week-body" style={{
          display: 'grid',
          gridTemplateColumns: '200px repeat(7, 1fr)',
          gap: '0.5rem',
          minHeight: '600px'
        }}>
          {/* Timeline orizzontale */}
          <div style={{ padding: '0.5rem' }}></div>
          
          {weekDays.map(day => {
            const dayEvents = getEventsForDate(day)
            const dayIsToday = isToday(day)
            
            return (
              <div
                key={day.toISOString()}
                style={{
                  background: dayIsToday
                    ? 'linear-gradient(135deg, var(--brand-500)08 0%, var(--bg-1) 100%)'
                    : 'var(--bg-1)',
                  border: dayIsToday
                    ? `2px solid var(--brand-500)`
                    : `1px solid var(--border-soft)`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem',
                  minHeight: '600px',
                  position: 'relative'
                }}
              >
                <div className="calendar-day-events" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  {dayEvents.map((event) => {
                    const timeLabel = getEventTimeLabel(event)
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onCardClick && event.cardId) {
                            const cardData = card.find(c => c.id === event.cardId)
                            if (cardData) onCardClick(cardData)
                          }
                        }}
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          background: `linear-gradient(135deg, ${getPrioritaColor(event.priorita)} 0%, ${getPrioritaColor(event.priorita)}dd 100%)`,
                          color: 'white',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: 'var(--shadow-1)',
                          transition: 'all 0.2s ease',
                          borderLeft: `4px solid ${getPrioritaColor(event.priorita)}`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)'
                          e.currentTarget.style.boxShadow = 'var(--shadow-2)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)'
                          e.currentTarget.style.boxShadow = 'var(--shadow-1)'
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                          {event.title}
                        </div>
                        {timeLabel && (
                          <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            Ore: {timeLabel}
                          </div>
                        )}
                        {event.cliente_nome && (
                          <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            {event.cliente_nome}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render vista giornaliera
  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate)
    const dayIsToday = isToday(currentDate)
    
    return (
      <div className="calendar-day-view" style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: '1rem',
        minHeight: '600px'
      }}>
        {/* Timeline */}
        <div style={{
          padding: '1rem',
          background: 'var(--bg-2)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-soft)'
        }}>
          <div style={{
            fontWeight: 700,
            fontSize: '1.1rem',
            marginBottom: '1rem',
            color: 'var(--ink-800)'
          }}>
            {formatDate(currentDate)}
          </div>
          
          {/* Timeline hours */}
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} style={{
              padding: '0.5rem',
              borderBottom: '1px solid var(--border-soft)',
              fontSize: '0.85rem',
              color: 'var(--ink-600)'
            }}>
              {i.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>
        
        {/* Events */}
        <div style={{
          background: dayIsToday
            ? 'linear-gradient(135deg, var(--brand-500)05 0%, var(--bg-1) 100%)'
            : 'var(--bg-1)',
          border: `1px solid var(--border-soft)`,
          borderRadius: 'var(--radius-sm)',
          padding: '1rem'
        }}>
          <div style={{
            fontWeight: 700,
            fontSize: '1.1rem',
            marginBottom: '1rem',
            color: 'var(--ink-800)'
          }}>
            Eventi del giorno
          </div>
          
          {dayEvents.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--ink-400)',
              fontStyle: 'italic'
            }}>
              Nessun evento per questo giorno
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {dayEvents.map((event) => {
                const timeLabel = getEventTimeLabel(event)
                return (
                  <div
                    key={event.id}
                    onClick={() => {
                      if (onCardClick && event.cardId) {
                        const cardData = card.find(c => c.id === event.cardId)
                        if (cardData) onCardClick(cardData)
                      }
                    }}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      background: `linear-gradient(135deg, ${getPrioritaColor(event.priorita)}15 0%, var(--bg-1) 100%)`,
                      border: `2px solid ${getPrioritaColor(event.priorita)}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: 'var(--shadow-1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-1)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: getPrioritaColor(event.priorita)
                      }}>
                        {event.title}
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        background: `${getPrioritaColor(event.priorita)}20`,
                        color: getPrioritaColor(event.priorita),
                        fontWeight: 700,
                        textTransform: 'uppercase'
                      }}>
                        {event.priorita}
                      </span>
                    </div>
                    
                    {event.cliente_nome && (
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--ink-600)',
                        marginBottom: '0.25rem'
                      }}>
                        <strong>Cliente:</strong> {event.cliente_nome}
                      </div>
                    )}
                    {timeLabel && (
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--ink-600)',
                        marginBottom: '0.25rem'
                      }}>
                        <strong>Ora:</strong> {timeLabel}
                      </div>
                    )}
                    
                    {event.colonna_nome && (
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--ink-600)',
                        marginBottom: '0.25rem'
                      }}>
                        <strong>Colonna:</strong> {event.colonna_nome}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="kanban-calendar" style={{ width: '100%' }}>
      {/* Header con controlli */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'var(--bg-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-soft)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={goToPrevious}
            style={{ minWidth: '40px' }}
          >
            ←
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={goToToday}
          >
            Oggi
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={goToNext}
            style={{ minWidth: '40px' }}
          >
            →
          </button>
          
          <div style={{
            marginLeft: '1rem',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--ink-800)'
          }}>
            {viewMode === 'month' 
              ? formatMonthYear(currentDate)
              : viewMode === 'week'
                ? formatWeekRange(currentDate)
                : formatDate(currentDate)
            }
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${viewMode === 'month' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('month')}
          >
            Mese
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('week')}
          >
            Settimana
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'day' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('day')}
          >
            Giorno
          </button>
        </div>
      </div>
      
      {/* Vista calendario */}
      <div style={{
        background: 'var(--bg-1)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        border: '1px solid var(--border-soft)',
        boxShadow: 'var(--shadow-1)'
      }}>
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </div>
    </div>
  )
}

export default KanbanCalendar


