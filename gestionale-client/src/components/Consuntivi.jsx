import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../services/api'
import { getIsoDate } from '../utils/date'

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

function Consuntivi({ onCreateFattura }) {
  const [commesse, setCommesse] = useState([])
  const [clienti, setClienti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [consuntivoIds, setConsuntivoIds] = useState([])
  const [consuntivoSconto, setConsuntivoSconto] = useState('')
  const [consuntivoScontoTipo, setConsuntivoScontoTipo] = useState('percent')
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
  const selectedClienteIds = useMemo(() => {
    const set = new Set()
    consuntivoCommesse.forEach((commessa) => {
      if (commessa?.cliente_id) {
        set.add(String(commessa.cliente_id))
      }
    })
    return set
  }, [consuntivoCommesse])
  const canCreateFattura = consuntivoCommesse.length > 0 && selectedClienteIds.size === 1
  const selectedClienteId = canCreateFattura ? Array.from(selectedClienteIds)[0] : ''
  const consuntivoTotale = useMemo(
    () => consuntivoCommesse.reduce((sum, commessa) => {
      const value = parseNumber(commessa.importo_totale ?? 0)
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0),
    [consuntivoCommesse]
  )
  const consuntivoScontoRaw = Math.max(0, parseNumber(consuntivoSconto) || 0)
  const consuntivoScontoValue = consuntivoScontoTipo === 'percent'
    ? (consuntivoTotale * consuntivoScontoRaw) / 100
    : Math.min(consuntivoTotale, consuntivoScontoRaw)
  const consuntivoFinale = Math.max(0, consuntivoTotale - consuntivoScontoValue)

  const exportPDF = async () => {
    if (!consuntivoCommesse.length) return

    const doc = new jsPDF()
    const headerTextTopY = 18
    let headerX = 14
    let logoBottomY = 10

    try {
      const logoImg = new Image()
      logoImg.src = '/logo-studio-ingegneria-removebg-preview.png'

      await new Promise((resolve) => {
        logoImg.onload = () => {
          try {
            const maxW = 42
            const maxH = 22
            const ratio = logoImg.width && logoImg.height ? logoImg.width / logoImg.height : 1
            let w = maxW
            let h = w / ratio
            if (h > maxH) {
              h = maxH
              w = h * ratio
            }
            const logoX = 14
            const logoY = 12
            doc.addImage(logoImg, 'PNG', logoX, logoY, w, h)
            headerX = logoX
            logoBottomY = logoY + h
            resolve()
          } catch {
            resolve()
          }
        }
        logoImg.onerror = () => resolve()
      })
    } catch {
      // Continua anche se il logo non si carica
    }

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text('Via Piave 35, 25030 Adro (BS)', headerX, headerTextTopY + 10)
    doc.text('Tel: +39 030 7357263 | Email: info@studiocapoferri.eu', headerX, headerTextTopY + 16)
    doc.text('P.IVA: 04732710985', headerX, headerTextTopY + 22)

    const headerTextBottomY = headerTextTopY + 22
    const headerBottomY = Math.max(logoBottomY, headerTextBottomY)

    doc.setFontSize(14)
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'bold')
    const reportTitleY = headerBottomY + 12
    doc.text('Consuntivo commesse', 14, reportTitleY)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    const summaryLine = `Commesse selezionate: ${consuntivoCommesse.length}`
    doc.text(summaryLine, 14, reportTitleY + 7)

    const tableData = consuntivoCommesse.map((commessa) => {
      const value = parseNumber(commessa.importo_totale ?? 0)
      const amount = Number.isFinite(value) ? value : 0
      return [
        commessa.cliente_nome || 'Cliente',
        commessa.titolo || '',
        `EUR ${amount.toFixed(2)}`
      ]
    })

    tableData.push([
      { content: 'Totale', styles: { fontStyle: 'bold' } },
      '',
      { content: `EUR ${consuntivoTotale.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } }
    ])

    const tableStartY = reportTitleY + 12
    autoTable(doc, {
      head: [['Cliente', 'Commessa', 'Parziale']],
      body: tableData,
      startY: tableStartY,
      styles: {
        fontSize: 9,
        textColor: [33, 33, 33],
        halign: 'left'
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [42, 63, 84],
        fontStyle: 'bold'
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [33, 33, 33]
      },
      columnStyles: {
        2: { halign: 'right' }
      }
    })

    const summaryStartY = (doc.lastAutoTable?.finalY || tableStartY) + 10
    const pageHeight = doc.internal.pageSize.height
    let summaryY = summaryStartY
    if (summaryY > pageHeight - 30) {
      doc.addPage()
      summaryY = 20
    }

    doc.setFontSize(10)
    doc.setTextColor(42, 63, 84)
    doc.setFont('helvetica', 'bold')
    doc.text('Riepilogo', 14, summaryY)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`Totale commesse: EUR ${consuntivoTotale.toFixed(2)}`, 14, summaryY + 6)
    doc.text(`Sconto applicato: - EUR ${consuntivoScontoValue.toFixed(2)}`, 14, summaryY + 12)
    doc.text(`Totale finale: EUR ${consuntivoFinale.toFixed(2)}`, 14, summaryY + 18)

    const dataGenerazione = new Date().toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Generato il: ${dataGenerazione}`, 14, doc.internal.pageSize.height - 10)

    doc.save(`consuntivo-commesse-${getIsoDate()}.pdf`)
  }

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
                      &euro; {Number(parseNumber(commessa.importo_totale ?? 0) || 0).toFixed(2)}
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
                  <strong>&euro; {consuntivoTotale.toFixed(2)}</strong>
                </div>
                <div className="consuntivo-row">
                  <label className="form-label mb-1">Sconto</label>
                  <div className="d-flex gap-2 align-items-center">
                    <select
                      className="form-select"
                      value={consuntivoScontoTipo}
                      onChange={(e) => setConsuntivoScontoTipo(e.target.value)}
                      style={{ width: 'auto' }}
                    >
                      <option value="percent">%</option>
                      <option value="value">&euro;</option>
                    </select>
                  <input
                    className="form-control"
                    value={consuntivoSconto}
                    onChange={(e) => setConsuntivoSconto(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                  </div>
                </div>
                <div className="consuntivo-row">
                  <span>Sconto applicato</span>
                  <strong>- &euro; {consuntivoScontoValue.toFixed(2)}</strong>
                </div>
                <div className="consuntivo-row consuntivo-final">
                  <span>Conto finale</span>
                  <strong>&euro; {consuntivoFinale.toFixed(2)}</strong>
                </div>
                <div className="consuntivo-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={exportPDF}
                    disabled={consuntivoCommesse.length === 0}
                  >
                    Esporta PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!canCreateFattura}
                    onClick={() => {
                      if (!canCreateFattura) return
                      const items = consuntivoCommesse.map((commessa) => ({
                        name: commessa.titolo || 'Commessa',
                        qty: 1,
                        net_price: Number(parseNumber(commessa.importo_totale ?? 0) || 0)
                      }))
                      const draft = {
                        clienteId: Number(selectedClienteId),
                        commessaIds: consuntivoCommesse.map((commessa) => commessa.id),
                        items,
                        visibleSubject: `Consuntivo commesse (${consuntivoCommesse.length})`
                      }
                      if (onCreateFattura) {
                        onCreateFattura(draft)
                      }
                    }}
                  >
                    Crea fattura
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setConsuntivoIds([])
                      setConsuntivoSconto('')
                      setConsuntivoScontoTipo('percent')
                    }}
                  >
                    Reset selezione
                  </button>
                </div>
                {!canCreateFattura && consuntivoCommesse.length > 1 && (
                  <div className="text-muted small">
                    Seleziona commesse dello stesso cliente per creare una fattura unica.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Consuntivi

