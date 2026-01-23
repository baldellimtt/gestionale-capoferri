import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const STATI_COMMESSA = ['In corso', 'Preventivato', 'In attesa di approvazione', 'Richieste integrazioni', 'Personalizzato', 'Conclusa']
const STATI_PAGAMENTI = ['Non iniziato', 'Parziale', 'Consuntivo con altre commesse', 'Saldo']
const TIPI_LAVORO = [
  'Piano di sicurezza',
  'Pratica strutturale',
  'Variante pratica edilizia',
  'Variante pratica strutturale',
  'Fine lavori',
  'Accatastamento',
  'Relazione di calcolo',
  'Documentazione per pratica strutturale',
  'Documentazione per pratica edilizia'
]

function Consuntivi() {
  const [commesse, setCommesse] = useState([])
  const [clienti, setClienti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [consuntivoIds, setConsuntivoIds] = useState([])
  const [consuntivoSconto, setConsuntivoSconto] = useState('')
  const [filters, setFilters] = useState({ clienteId: '', stato: '', sottoStato: '', statoPagamenti: '' })
  const [yearFilter, setYearFilter] = useState('')
  const [clienteFilterInput, setClienteFilterInput] = useState('')
  const [showClienteFilterAutocomplete, setShowClienteFilterAutocomplete] = useState(false)

  const parseNumber = (value) => {
    if (value == null || value === '') return 0
    const parsed = Number(String(value).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : NaN
  }

  useEffect(() => {
    const loadClienti = async () => {
      try {
        const data = await api.getClienti()
        setClienti(Array.isArray(data) ? data : [])
      } catch (err) {
        console.warn('Impossibile caricare clienti per filtri consuntivi:', err)
        setClienti([])
      }
    }

    loadClienti()
  }, [])

  useEffect(() => {
    const loadCommesse = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await api.getCommesse(filters)
        setCommesse(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Errore caricamento commesse per consuntivi:', err)
        setError('Errore nel caricamento delle commesse. Verifica che il server sia avviato.')
      } finally {
        setLoading(false)
      }
    }

    loadCommesse()
  }, [filters])

  const parseTipologie = (value) => {
    if (!value) return []
    if (Array.isArray(value)) return value.filter(Boolean)
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const getCommessaYear = (commessa) => {
    const raw = commessa?.data_inizio || commessa?.created_at
    if (!raw) return ''
    if (typeof raw === 'string' && /^\d{4}/.test(raw)) {
      return raw.slice(0, 4)
    }
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return ''
    return String(parsed.getFullYear())
  }

  const commesseSorted = useMemo(() => {
    return [...commesse].sort((a, b) => {
      const clienteA = (a.cliente_nome || '').toLowerCase()
      const clienteB = (b.cliente_nome || '').toLowerCase()
      if (clienteA !== clienteB) return clienteA.localeCompare(clienteB)
      const titoloA = (a.titolo || '').toLowerCase()
      const titoloB = (b.titolo || '').toLowerCase()
      if (titoloA !== titoloB) return titoloA.localeCompare(titoloB)
      return Number(a.id) - Number(b.id)
    })
  }, [commesse])

  const filteredCommesse = useMemo(() => {
    return commesseSorted.filter((commessa) => {
      if (yearFilter) {
        const commessaYear = getCommessaYear(commessa)
        if (commessaYear !== yearFilter) {
          return false
        }
      }
      if (filters.sottoStato) {
        const tipologie = parseTipologie(commessa.sotto_stato)
        if (!tipologie.includes(filters.sottoStato)) {
          return false
        }
      }
      if (filters.statoPagamenti && commessa.stato_pagamenti !== filters.statoPagamenti) {
        return false
      }
      return true
    })
  }, [commesseSorted, filters.sottoStato, filters.statoPagamenti, yearFilter])

  const filteredClienti = useMemo(() => {
    if (!clienteFilterInput) return []
    const search = clienteFilterInput.toLowerCase()
    return clienti
      .filter((cliente) => cliente.denominazione?.toLowerCase().includes(search))
      .slice(0, 10)
  }, [clienteFilterInput, clienti])

  const availableYears = useMemo(() => {
    const years = new Set()
    commesse.forEach((commessa) => {
      const year = getCommessaYear(commessa)
      if (year) years.add(year)
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [commesse])

  const handleClienteFilterChange = (value) => {
    setClienteFilterInput(value)
    if (!value) {
      setFilters((prev) => ({ ...prev, clienteId: '' }))
      setShowClienteFilterAutocomplete(false)
      return
    }

    const match = clienti.find(
      (cliente) => cliente.denominazione?.toLowerCase() === value.toLowerCase()
    )
    if (match) {
      setFilters((prev) => ({ ...prev, clienteId: match.id }))
    } else {
      setFilters((prev) => ({ ...prev, clienteId: '' }))
    }
    setShowClienteFilterAutocomplete(true)
  }

  const toSlug = (value) => (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const getStatoPagamentiClass = (value) => (value ? `payments-${toSlug(value)}` : '')

  const toggleConsuntivoId = (id) => {
    setConsuntivoIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ))
  }

  const consuntivoCommesse = useMemo(
    () => filteredCommesse.filter((commessa) => consuntivoIds.includes(commessa.id)),
    [filteredCommesse, consuntivoIds]
  )
  const consuntivoTotale = useMemo(
    () => consuntivoCommesse.reduce((sum, commessa) => {
      const value = parseNumber(commessa.importo_totale ?? 0)
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0),
    [consuntivoCommesse]
  )
  const consuntivoScontoPercent = Math.max(0, parseNumber(consuntivoSconto) || 0)
  const consuntivoScontoValue = (consuntivoTotale * consuntivoScontoPercent) / 100
  const consuntivoFinale = consuntivoTotale - consuntivoScontoValue

  return (
    <div className="consuntivi-section">
      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Consuntivi</h2>
      </div>
      <div className="filters-section">
        <label>Cliente:</label>
        <div className="autocomplete-container" style={{ width: 'auto' }}>
          <input
            className="form-control"
            value={clienteFilterInput}
            onChange={(e) => handleClienteFilterChange(e.target.value)}
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
                    setClienteFilterInput(cliente.denominazione)
                    setFilters((prev) => ({ ...prev, clienteId: cliente.id }))
                    setShowClienteFilterAutocomplete(false)
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
          {STATI_COMMESSA.map((stato) => (
            <option key={stato} value={stato}>{stato}</option>
          ))}
        </select>
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
        <label>Tipologia di lavoro:</label>
        <select
          className="form-select"
          value={filters.sottoStato}
          onChange={(e) => setFilters((prev) => ({ ...prev, sottoStato: e.target.value }))}
          style={{ width: 'auto' }}
        >
          <option value="">Tutti</option>
          {TIPI_LAVORO.map((stato) => (
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
          {STATI_PAGAMENTI.map((stato) => (
            <option key={stato} value={stato}>{stato}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <div className="text-muted">Caricamento commesse...</div>
      ) : (
        <div className="card mb-4 consuntivo-card">
          <div className="card-body">
            <div className="consuntivo-grid">
              <div className="consuntivo-list">
                {filteredCommesse.map((commessa) => (
                  <label key={commessa.id} className="consuntivo-item">
                    <input
                      type="checkbox"
                      checked={consuntivoIds.includes(commessa.id)}
                      onChange={() => toggleConsuntivoId(commessa.id)}
                    />
                    <span className="consuntivo-label">
                      {commessa.cliente_nome || 'Cliente'} - {commessa.titolo}
                    </span>
                    <span className="consuntivo-value">
                      ??? {Number(parseNumber(commessa.importo_totale ?? 0) || 0).toFixed(2)}
                    </span>
                  </label>
                ))}
                {filteredCommesse.length === 0 && (
                  <div className="text-muted">Nessuna commessa disponibile.</div>
                )}
              </div>
              <div className="consuntivo-summary">
                <div className="consuntivo-row">
                  <span>Totale commesse selezionate</span>
                  <strong>??? {consuntivoTotale.toFixed(2)}</strong>
                </div>
                <div className="consuntivo-row">
                  <label className="form-label mb-1">Sconto (%)</label>
                  <input
                    className="form-control"
                    value={consuntivoSconto}
                    onChange={(e) => setConsuntivoSconto(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
                <div className="consuntivo-row">
                  <span>Sconto applicato</span>
                  <strong>- ??? {consuntivoScontoValue.toFixed(2)}</strong>
                </div>
                <div className="consuntivo-row consuntivo-final">
                  <span>Conto finale</span>
                  <strong>??? {consuntivoFinale.toFixed(2)}</strong>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setConsuntivoIds([])
                    setConsuntivoSconto('')
                  }}
                >
                  Reset selezione
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Consuntivi

