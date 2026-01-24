import React from 'react'

function CommessaFilters({
  sortByLatest,
  onToggleSort,
  clienteFilterInput,
  onClienteFilterChange,
  showClienteFilterAutocomplete,
  setShowClienteFilterAutocomplete,
  filteredClienti,
  onSelectClienteForView,
  filters,
  setFilters,
  isClientListView,
  yearFilter,
  setYearFilter,
  availableYears,
  statiCommessa,
  statiPagamenti,
  tipiLavoro,
  getStatoPagamentiClass
}) {
  return (
    <div className="filters-section">
      <button
        type="button"
        className={`btn btn-sm ${sortByLatest ? 'btn-primary' : 'btn-secondary'}`}
        onClick={onToggleSort}
      >
        Ultime modifiche
      </button>
      <label>Cliente:</label>
      <div className="autocomplete-container" style={{ width: 'auto' }}>
        <input
          className="form-control"
          value={clienteFilterInput}
          onChange={(e) => onClienteFilterChange(e.target.value)}
          onFocus={() => setShowClienteFilterAutocomplete(true)}
          onBlur={() => {
            setTimeout(() => setShowClienteFilterAutocomplete(false), 200)
          }}
          placeholder="Cerca cliente..."
          style={{ width: 'auto' }}
        />
        {showClienteFilterAutocomplete && filteredClienti.length > 0 && (
          <div className="autocomplete-list">
            {filteredClienti.map((cliente) => (
              <div
                key={cliente.id}
                className="autocomplete-item"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelectClienteForView(cliente)
                }}
              >
                {cliente.denominazione}
              </div>
            ))}
          </div>
        )}
      </div>
      <label>Stato:</label>
      <select
        className="form-select"
        value={filters.stato}
        onChange={(e) => setFilters((prev) => ({ ...prev, stato: e.target.value }))}
        style={{ width: 'auto' }}
      >
        <option value="">Tutti</option>
        {statiCommessa.map((stato) => (
          <option key={stato} value={stato}>{stato}</option>
        ))}
      </select>
      {isClientListView && (
        <>
          <label>Anno:</label>
          <select
            className="form-select"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="">Tutti</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </>
      )}
      <label>Tipologia di lavoro:</label>
      <select
        className="form-select"
        value={filters.sottoStato}
        onChange={(e) => setFilters((prev) => ({ ...prev, sottoStato: e.target.value }))}
        style={{ width: 'auto' }}
      >
        <option value="">Tutti</option>
        {tipiLavoro.map((stato) => (
          <option key={stato} value={stato}>{stato}</option>
        ))}
      </select>
      <label>Stato pagamenti:</label>
      <select
        className={`form-select stato-pagamenti-select ${getStatoPagamentiClass(filters.statoPagamenti)}`}
        value={filters.statoPagamenti}
        onChange={(e) => setFilters((prev) => ({ ...prev, statoPagamenti: e.target.value }))}
        style={{ width: 'auto' }}
      >
        <option value="">Tutti</option>
        {statiPagamenti.map((stato) => (
          <option key={stato} value={stato}>{stato}</option>
        ))}
      </select>
    </div>
  )
}

export default CommessaFilters
