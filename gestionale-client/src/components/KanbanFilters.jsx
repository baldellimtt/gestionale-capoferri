import { useState, useEffect, useRef } from 'react'

function KanbanFilters({ colonne, clienti, filters, onFiltersChange, onReset }) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [portalAutocomplete, setPortalAutocomplete] = useState(null)
  const inputRef = useRef(null)

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const handleReset = () => {
    const resetFilters = {
      cliente_id: '',
      colonna_id: '',
      priorita: '',
      ricerca: '',
      data_inizio_da: '',
      data_inizio_a: '',
      data_fine_da: '',
      data_fine_a: ''
    }
    setClienteSearch('')
    setShowAutocomplete(false)
    setPortalAutocomplete(null)
    onFiltersChange(resetFilters)
    if (onReset) {
      onReset()
    }
  }

  const hasActiveFilters = () => {
    return !!(
      filters.cliente_id ||
      filters.colonna_id ||
      filters.priorita ||
      filters.ricerca ||
      filters.data_inizio_da ||
      filters.data_inizio_a ||
      filters.data_fine_da ||
      filters.data_fine_a
    )
  }

  // Funzione per filtrare clienti
  const getFilteredClienti = (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      return clienti.slice(0, 10)
    }
    return clienti
      .filter((cliente) => cliente.denominazione?.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10)
  }

  // Funzione per aprire il portal autocompletamento
  const openAutocompletePortal = (value, target) => {
    if (!target) return
    const items = getFilteredClienti(value)
    if (items.length === 0) {
      setPortalAutocomplete(null)
      return
    }
    const rect = target.getBoundingClientRect()
    setPortalAutocomplete({
      items,
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      anchorEl: target
    })
  }

  // Gestione click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.autocomplete-container') && !e.target.closest('.autocomplete-portal')) {
        setShowAutocomplete(false)
        setPortalAutocomplete(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Gestione scroll e resize per riposizionare il portal
  useEffect(() => {
    if (!portalAutocomplete?.anchorEl) return

    const repositionPortal = () => {
      setPortalAutocomplete((prev) => {
        if (!prev?.anchorEl) return prev
        const rect = prev.anchorEl.getBoundingClientRect()
        return {
          ...prev,
          top: rect.bottom + 6,
          left: rect.left,
          width: rect.width
        }
      })
    }

    const handleScroll = () => {
      repositionPortal()
    }

    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', repositionPortal)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', repositionPortal)
    }
  }, [portalAutocomplete])

  // Ottieni il nome del cliente selezionato
  const selectedCliente = clienti.find(c => c.id == filters.cliente_id)
  const displayCliente = selectedCliente ? selectedCliente.denominazione : clienteSearch

  return (
    <div className="kanban-filters">
      <div className="d-flex gap-2 align-items-center flex-wrap">
        {/* Filtri base */}
        <div className="autocomplete-container" style={{ position: 'relative', width: 'auto', minWidth: '200px' }}>
          <input
            ref={inputRef}
            type="text"
            className="form-control form-control-sm"
            placeholder="Cerca cliente..."
            value={displayCliente}
            onChange={(e) => {
              const value = e.target.value
              setClienteSearch(value)
              setShowAutocomplete(true)
              openAutocompletePortal(value, e.target)
              
              // Se il valore è vuoto, rimuovi il filtro
              if (!value.trim()) {
                handleFilterChange('cliente_id', '')
              }
            }}
            onFocus={(e) => {
              setShowAutocomplete(true)
              openAutocompletePortal(clienteSearch || displayCliente, e.target)
            }}
            onBlur={() => {
              setTimeout(() => {
                setShowAutocomplete(false)
                setPortalAutocomplete(null)
              }, 200)
            }}
            style={{ width: '100%' }}
          />
          {filters.cliente_id && (
            <button
              type="button"
              className="btn-close btn-close-sm"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.7rem',
                opacity: 0.6
              }}
              onClick={(e) => {
                e.stopPropagation()
                handleFilterChange('cliente_id', '')
                setClienteSearch('')
                if (inputRef.current) {
                  inputRef.current.focus()
                }
              }}
              aria-label="Rimuovi filtro cliente"
            />
          )}
        </div>

        <select
          className="form-select form-select-sm"
          style={{ width: 'auto', minWidth: '150px' }}
          value={filters.colonna_id || ''}
          onChange={(e) => handleFilterChange('colonna_id', e.target.value)}
        >
          <option value="">Tutte le colonne</option>
          {colonne.map((colonna) => (
            <option key={colonna.id} value={colonna.id}>
              {colonna.nome}
            </option>
          ))}
        </select>

        <select
          className="form-select form-select-sm"
          style={{ 
            width: 'auto', 
            minWidth: '120px',
            color: filters.priorita === 'urgente' ? '#ef4444' : 
                   filters.priorita === 'alta' ? '#f59e0b' :
                   filters.priorita === 'media' ? '#3b82f6' :
                   filters.priorita === 'bassa' ? '#10b981' : 'inherit',
            fontWeight: filters.priorita === 'urgente' ? 600 : 'normal'
          }}
          value={filters.priorita || ''}
          onChange={(e) => handleFilterChange('priorita', e.target.value)}
        >
          <option value="">Tutte le priorità</option>
          <option value="bassa" style={{ color: '#10b981', backgroundColor: 'var(--bg-1)' }}>Bassa</option>
          <option value="media" style={{ color: '#3b82f6', backgroundColor: 'var(--bg-1)' }}>Media</option>
          <option value="alta" style={{ color: '#f59e0b', backgroundColor: 'var(--bg-1)' }}>Alta</option>
          <option value="urgente" style={{ color: '#ef4444', backgroundColor: 'var(--bg-1)' }}>Urgente</option>
        </select>

        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Cerca..."
          style={{ width: 'auto', minWidth: '200px' }}
          value={filters.ricerca || ''}
          onChange={(e) => handleFilterChange('ricerca', e.target.value)}
        />

        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▼' : '▶'} Avanzati
        </button>

        {hasActiveFilters() && (
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={handleReset}
          >
            Reset
          </button>
        )}
      </div>

      {showAdvanced && (
        <div 
          className="mt-3 p-3" 
          style={{ 
            background: 'linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%)', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-1)',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label" style={{ fontSize: '0.85rem' }}>
                Data inizio da
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.data_inizio_da || ''}
                onChange={(e) => handleFilterChange('data_inizio_da', e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" style={{ fontSize: '0.85rem' }}>
                Data inizio a
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.data_inizio_a || ''}
                onChange={(e) => handleFilterChange('data_inizio_a', e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" style={{ fontSize: '0.85rem' }}>
                Data fine da
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.data_fine_da || ''}
                onChange={(e) => handleFilterChange('data_fine_da', e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" style={{ fontSize: '0.85rem' }}>
                Data fine a
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.data_fine_a || ''}
                onChange={(e) => handleFilterChange('data_fine_a', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Portal autocompletamento */}
      {portalAutocomplete && (
        <div
          className="autocomplete-list autocomplete-portal"
          style={{
            position: 'fixed',
            top: `${portalAutocomplete.top}px`,
            left: `${portalAutocomplete.left}px`,
            width: `${portalAutocomplete.width}px`,
            zIndex: 9999
          }}
        >
          {portalAutocomplete.items.map((cliente, idx) => (
            <div
              key={cliente.id}
              className="autocomplete-item"
              onMouseDown={(e) => {
                e.preventDefault()
                handleFilterChange('cliente_id', cliente.id.toString())
                setClienteSearch(cliente.denominazione)
                setShowAutocomplete(false)
                setPortalAutocomplete(null)
                if (inputRef.current) {
                  inputRef.current.blur()
                }
              }}
            >
              {cliente.denominazione}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default KanbanFilters

