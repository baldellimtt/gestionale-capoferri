import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import useDebouncedRowSave from '../hooks/useDebouncedRowSave'
import { formatDateEuropean, getDateGroups, getIsoDate, isWorkingDay } from '../utils/date'
import {
  buildServerFilters,
  calculateTotals,
  dedupeAttivita,
  filterAttivitaByDate,
  getRowValidation,
  normalizeAttivitaFromApi
} from '../utils/attivita'

function TabellaAttivita({ clienti, user }) {
  const [attivita, setAttivita] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [filterType, setFilterType] = useState('none')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [clienteSearch, setClienteSearch] = useState({})
  const [showAutocomplete, setShowAutocomplete] = useState({})
  const [portalAutocomplete, setPortalAutocomplete] = useState(null)
  const [editingRowId, setEditingRowId] = useState(null)
  const [saving, setSaving] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, isTemporary: false })
  const [deleting, setDeleting] = useState(false)
  const [deletedIds, setDeletedIds] = useState(new Set())
  const [hiddenTempDates, setHiddenTempDates] = useState(new Set())
  const [newRowDate, setNewRowDate] = useState(getIsoDate())
  const lastCreatedDateRef = useRef(null)
  const clearEditingTimeoutRef = useRef(null)
  const tableScrollRef = useRef(null)
  const [rimborsoKm, setRimborsoKm] = useState(user?.rimborso_km ?? 0)

  const ATTIVITA_OPTIONS = ['SOPRALLUOGO', 'TRASFERTA']

  const loadAttivita = useCallback(async (filters = {}) => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getAttivita(filters)
      const formatted = data.map(normalizeAttivitaFromApi)
      const unique = dedupeAttivita(formatted, deletedIds)
      setAttivita(unique)
    } catch (err) {
      console.error('Errore caricamento attività:', err)
      setError('Errore nel caricamento delle attività. Verifica che il server sia avviato.')
    } finally {
      setLoading(false)
    }
  }, [deletedIds])

  useEffect(() => {
    loadAttivita()
  }, [loadAttivita])

  useEffect(() => {
    setRimborsoKm(user?.rimborso_km ?? 0)
  }, [user])

  useEffect(() => {
    if (expanded) {
      const filters = buildServerFilters(filterType, customStartDate, customEndDate)
      loadAttivita(filters)
    } else {
      loadAttivita()
    }
  }, [expanded, filterType, customStartDate, customEndDate, loadAttivita])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.autocomplete-container') && !e.target.closest('.autocomplete-portal')) {
        setShowAutocomplete({})
        setPortalAutocomplete(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (loading) return

    const today = getIsoDate()
    if (lastCreatedDateRef.current === today) return
    if (!isWorkingDay(today)) {
      lastCreatedDateRef.current = today
      return
    }

    const hasTodayRow = attivita.some(
      (row) => row.data === today && row.id && typeof row.id === 'number' && !row.isTemporary
    )

    if (!hasTodayRow) {
      lastCreatedDateRef.current = today
      api.createAttivita({
        data: today,
        clienteId: null,
        clienteNome: '',
        attivita: '',
        km: 0,
        indennita: 0
      })
        .then((result) => {
          const newRow = {
            id: result.id,
            data: today,
            cliente: '',
            clienteId: null,
            attivita: '',
            km: '',
            indennita: false
          }
          setAttivita((prev) => {
            const alreadyExists = prev.some(
              (row) => row.id === result.id || (row.data === today && row.id && typeof row.id === 'number')
            )
            if (alreadyExists) return prev
            return [newRow, ...prev]
          })
        })
        .catch((err) => {
          console.error('Errore creazione riga oggi:', err)
          lastCreatedDateRef.current = null
        })
    } else {
      lastCreatedDateRef.current = today
    }
  }, [loading, attivita])

  const saveRow = useCallback(async (row) => {
    if (saving[row.id]) return

    setSaving((prev) => ({ ...prev, [row.id]: true }))

    try {
      const attivitaData = {
        data: row.data,
        clienteId: row.clienteId || null,
        clienteNome: row.cliente || null,
        attivita: row.attivita || null,
        km: parseFloat(row.km) || 0,
        indennita: row.indennita ? 1 : 0
      }

      if (row.id && typeof row.id === 'number') {
        await api.updateAttivita(row.id, attivitaData)
      } else {
        const result = await api.createAttivita(attivitaData)
        setAttivita((prev) => prev.map((r) => (r === row ? { ...r, id: result.id } : r)))
      }
    } catch (err) {
      console.error('Errore salvataggio attività:', err)
      setError('Errore nel salvataggio: ' + (err.message || 'Errore sconosciuto'))
    } finally {
      setSaving((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
    }
  }, [saving])

  const { scheduleSave } = useDebouncedRowSave(saveRow, 500)

  const updateRow = useCallback((id, field, value) => {
    setAttivita((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const newRow = { ...row, [field]: value }
          scheduleSave(row.id ?? id, newRow)
          return newRow
        }
        return row
      })
    )
  }, [scheduleSave])

  const handleDeleteClick = (row) => {
    const id = row?.id
    if (id == null) {
      setError('ID attività non valido')
      return
    }

    const isTemporaryRow = !!row?.isTemporary || (typeof id === 'string' && id.startsWith('temp-'))
    if (isTemporaryRow) {
      setDeleteConfirm({ show: true, id, isTemporary: true })
      return
    }

    const numericId = typeof id === 'string' ? parseInt(id, 10) : id
    if (isNaN(numericId)) {
      setError('ID attività non valido')
      return
    }

    setDeleteConfirm({ show: true, id: numericId, isTemporary: false })
  }

  const confirmDelete = async () => {
    const { id, isTemporary } = deleteConfirm
    if (id == null) {
      setDeleteConfirm({ show: false, id: null, isTemporary: false })
      return
    }

    if (isTemporary || (typeof id === 'string' && id.startsWith('temp-'))) {
      setDeleteConfirm({ show: false, id: null, isTemporary: false })
      setAttivita((prev) => prev.filter((row) => row?.id !== id))
      const tempDate = typeof id === 'string' && id.startsWith('temp-') ? id.slice(5) : null
      if (tempDate) {
        setHiddenTempDates((prev) => {
          const next = new Set(prev)
          next.add(tempDate)
          return next
        })
      }
      return
    }

    const idToDelete = Number(id)
    if (isNaN(idToDelete)) {
      setDeleteConfirm({ show: false, id: null, isTemporary: false })
      return
    }

    setDeleteConfirm({ show: false, id: null, isTemporary: false })
    setDeleting(true)

    setDeletedIds((prev) => {
      if (prev.has(idToDelete)) return prev
      const next = new Set(prev)
      next.add(idToDelete)
      return next
    })

    setAttivita((prev) => prev.filter((row) => Number(row?.id) !== idToDelete))

    try {
      await api.deleteAttivita(idToDelete)
    } catch (err) {
      console.error('Errore eliminazione API:', err)
      setError('Errore nell\'eliminazione: ' + (err.message || 'Errore sconosciuto'))
    } finally {
      setDeleting(false)
      await loadAttivita()
    }
  }

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, id: null, isTemporary: false })
  }

  const addNewRow = async () => {
    const dateToAdd = newRowDate || getIsoDate()
    await addRowForDate(dateToAdd)
  }

  const addRowForDate = async (date) => {
    try {
      const result = await api.createAttivita({
        data: date,
        clienteId: null,
        clienteNome: '',
        attivita: '',
        km: 0,
        indennita: 0
      })

      const newRow = {
        id: result.id,
        data: date,
        cliente: '',
        clienteId: null,
        attivita: '',
        km: '',
        indennita: false
      }

      setAttivita((prev) => {
        const dateIndex = prev.findIndex((row) => row.data === date)
        if (dateIndex >= 0) {
          return [...prev.slice(0, dateIndex + 1), newRow, ...prev.slice(dateIndex + 1)]
        }
        return [newRow, ...prev]
      })
    } catch (err) {
      console.error('Errore creazione attivitÃ :', err)
      setError('Errore nella creazione: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  const todayDate = getIsoDate()
  const dateGroups = getDateGroups()
  const recentWorkingDates = dateGroups
    .map((d) => d.date)
    .filter((date) => isWorkingDay(date))
  const recentWorkingSet = useMemo(() => new Set(recentWorkingDates), [recentWorkingDates])

  const visibleRows = useMemo(() => {
    return attivita.filter((row) => {
      if (!row) return false
      if (row.id) {
        const rowId = typeof row.id === 'string' ? parseInt(row.id, 10) : Number(row.id)
        if (!isNaN(rowId) && deletedIds.has(rowId)) return false
      }
      return true
    })
  }, [attivita, deletedIds])

  const recentRowsAll = useMemo(() => {
    return visibleRows.filter((row) => recentWorkingSet.has(row.data))
  }, [visibleRows, recentWorkingSet])

  const filteredAttivita = useMemo(() => {
    if (expanded) {
      return filterAttivitaByDate(visibleRows, expanded, filterType, customStartDate, customEndDate)
    }

    return recentRowsAll.filter((row) => {
      if (editingRowId != null && String(row.id) === String(editingRowId)) return true
      return !getRowValidation(row).isComplete
    })
  }, [expanded, visibleRows, filterType, customStartDate, customEndDate, recentRowsAll, editingRowId])

  const rowsByDateAll = useMemo(() => {
    const groups = {}
    recentRowsAll.forEach((att) => {
      if (!groups[att.data]) {
        groups[att.data] = []
      }
      groups[att.data].push(att)
    })
    return groups
  }, [recentRowsAll])

  const groupedByDate = useMemo(() => {
    const groups = {}
    filteredAttivita.forEach((att) => {
      if (!groups[att.data]) {
        groups[att.data] = []
      }
      groups[att.data].push(att)
    })
    return groups
  }, [filteredAttivita])

  const totals = useMemo(() => calculateTotals(filteredAttivita), [filteredAttivita])
  const rimborsoTotale = useMemo(() => {
    const kmValue = Number(totals.totalKm) || 0
    const rateValue = Number(rimborsoKm) || 0
    return kmValue * rateValue
  }, [totals.totalKm, rimborsoKm])

  const totalsTitle = useMemo(() => {
    if (filterType === 'mese') {
      const now = new Date()
      const monthLabel = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
      const formatted = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)
      return `Totale ${formatted}`
    }
    if (filterType === 'trimestre') {
      const now = new Date()
      const quarter = Math.floor(now.getMonth() / 3) + 1
      return `Totale Trimestre ${quarter} ${now.getFullYear()}`
    }
    return 'Totale periodo selezionato'
  }, [filterType])

  const getFilteredClienti = (searchTerm) => {
    if (!searchTerm) return []
    return clienti
      .filter((cliente) => cliente.denominazione?.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10)
  }

  const openAutocompletePortal = (rowId, value, target) => {
    if (!target) return
    const items = getFilteredClienti(value)
    if (items.length === 0) {
      setPortalAutocomplete(null)
      return
    }
    const rect = target.getBoundingClientRect()
    setPortalAutocomplete({
      rowId,
      items,
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      anchorEl: target
    })
  }

  const setEditingRow = (rowId) => {
    if (clearEditingTimeoutRef.current) {
      clearTimeout(clearEditingTimeoutRef.current)
      clearEditingTimeoutRef.current = null
    }
    setEditingRowId(rowId ?? null)
  }

  const clearEditingRow = () => {
    if (clearEditingTimeoutRef.current) {
      clearTimeout(clearEditingTimeoutRef.current)
    }
    clearEditingTimeoutRef.current = setTimeout(() => {
      setEditingRowId(null)
    }, 300)
  }

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

    const handleScroll = (e) => {
      const tableEl = tableScrollRef.current
      if (tableEl && e?.target && tableEl.contains(e.target)) {
        repositionPortal()
        return
      }
      setPortalAutocomplete(null)
      setShowAutocomplete({})
    }

    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', repositionPortal)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', repositionPortal)
    }
  }, [portalAutocomplete])

  const exportPDF = async () => {
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
    doc.text('Report Rimborsi', 14, reportTitleY)

    let filterText = 'Periodo: '
    if (!expanded) {
      filterText += 'Ultimi giorni lavorativi'
    } else if (filterType === 'mese') {
      const now = new Date()
      filterText += `Mese corrente (${now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })})`
    } else if (filterType === 'trimestre') {
      const now = new Date()
      const quarter = Math.floor(now.getMonth() / 3) + 1
      filterText += `Trimestre ${quarter} ${now.getFullYear()}`
    } else if (filterType === 'custom' && customStartDate && customEndDate) {
      filterText += `${customStartDate} - ${customEndDate}`
    } else {
      filterText += 'Tutti'
    }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    const filterY = reportTitleY + 7
    doc.text(filterText, 14, filterY)

    const dipendenteNome = [user?.nome, user?.cognome].filter(Boolean).join(' ').trim()
    const dipendenteLabel = dipendenteNome || user?.username || ''
    const mezzoLabel = user?.mezzo || ''
    const targaLabel = user?.targa || ''
    const details = [
      dipendenteLabel ? `Dipendente: ${dipendenteLabel}` : null,
      mezzoLabel ? `Autoveicolo: ${mezzoLabel}` : null,
      targaLabel ? `Targa: ${targaLabel}` : null
    ].filter(Boolean)
    if (details.length > 0) {
      doc.setFontSize(9)
      doc.setTextColor(90, 90, 90)
      details.forEach((line, idx) => {
        doc.text(line, 14, filterY + 6 + (idx * 5))
      })
    }

    const tableStartY = filterY + (details.length > 0 ? 6 + details.length * 5 + 3 : 6)
    const tableData = [...filteredAttivita]
      .sort((a, b) => (a?.data || '').localeCompare(b?.data || ''))
      .map((row) => {
      const dateFormatted = formatDateEuropean(row.data)
      return [
        dateFormatted,
        row.cliente || '',
        row.attivita || '',
        row.km || '0',
        row.indennita ? 'Sì' : 'No'
      ]
    })

    tableData.push([
      { content: 'Totale', styles: { fontStyle: 'bold', halign: 'center' } },
      '',
      '',
      { content: totals.totalKm.toFixed(2), styles: { halign: 'center', fontStyle: 'bold' } },
      { content: String(totals.totalIndennita), styles: { halign: 'center', fontStyle: 'bold' } }
    ])

    autoTable(doc, {
      head: [['Data', 'Cliente', 'Rimborso', 'KM', 'Indennita']],
      body: tableData,
      startY: tableStartY,
      styles: {
        fontSize: 9,
        textColor: [33, 33, 33],
        halign: 'center'
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [42, 63, 84],
        fontStyle: 'bold'
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [33, 33, 33]
      }
    })

    const summaryStartY = (doc.lastAutoTable?.finalY || filterY + 6) + 10
    const pageHeight = doc.internal.pageSize.height
    let summaryY = summaryStartY
    if (summaryY > pageHeight - 30) {
      doc.addPage()
      summaryY = 20
    }

    doc.setFontSize(10)
    doc.setTextColor(42, 63, 84)
    doc.setFont('helvetica', 'bold')
    doc.text('Rimborso chilometrico', 14, summaryY)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    const rimborsoText = `Totale KM (${totals.totalKm.toFixed(2)}) x Costo/km (€ ${Number(rimborsoKm || 0).toFixed(2)}) = € ${rimborsoTotale.toFixed(2)}`
    doc.text(rimborsoText, 14, summaryY + 6)

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

    doc.save(`report-rimborsi-${getIsoDate()}.pdf`)
  }

  const visibleDates = expanded
    ? Object.keys(groupedByDate).sort().reverse()
    : recentWorkingDates

  const getRowsForDate = (date) => {
    if (expanded) {
      return groupedByDate[date] || []
    }

    const rows = groupedByDate[date] || []
    if (rows.length > 0) {
      return rows
    }

    if (hiddenTempDates.has(date)) {
      return []
    }

    const existingRows = rowsByDateAll[date] || []
    if (existingRows.length > 0) {
      return []
    }

    return [
      {
        id: `temp-${date}`,
        data: date,
        cliente: '',
        clienteId: null,
        attivita: '',
        km: '',
        indennita: false,
        isTemporary: true
      }
    ]
  }

  const hasHomeRows = useMemo(() => {
    if (expanded) return true
    return visibleDates.some((date) => getRowsForDate(date).length > 0)
  }, [expanded, visibleDates, groupedByDate, hiddenTempDates, rowsByDateAll])


  const handleTemporaryRowChange = async (row, field, value) => {
    if (!row.isTemporary) return false

    try {
      const attivitaData = {
        data: row.data,
        clienteId: field === 'cliente' ? null : row.clienteId,
        clienteNome: field === 'cliente' ? value : row.cliente,
        attivita: field === 'attivita' ? value : row.attivita,
        km: field === 'km' ? parseFloat(value) || 0 : parseFloat(row.km) || 0,
        indennita: field === 'indennita' ? (value ? 1 : 0) : row.indennita ? 1 : 0
      }

      const result = await api.createAttivita(attivitaData)
      await loadAttivita()
      return result?.id || true
    } catch (err) {
      console.error('Errore creazione riga:', err)
      setError('Errore nella creazione della riga: ' + (err.message || 'Errore sconosciuto'))
      return false
    }
  }


  return (
    <div className="rimborsi-section">
      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0">Rimborsi</h2>
        <div className="d-flex gap-2">
          {expanded && (
            <button
              className="btn btn-secondary"
              onClick={() => setExpanded(false)}
            >
              Indietro
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Mostra da compilare' : 'Mostra tutte'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div className="filters-section">
            <label>Filtro Periodo:</label>
            <select
              className="form-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="none">Tutti</option>
              <option value="mese">Mese Corrente</option>
              <option value="trimestre">Trimestre Corrente</option>
              <option value="custom">Periodo Personalizzato</option>
            </select>

            {filterType === 'custom' && (
              <>
                <label>Da:</label>
                <input
                  type="date"
                  className="form-control"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{ width: 'auto' }}
                />
                <label>A:</label>
                <input
                  type="date"
                  className="form-control"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{ width: 'auto' }}
                />
              </>
            )}

            <button
              className="btn btn-primary"
              onClick={exportPDF}
              disabled={filteredAttivita.length === 0}
            >
              Esporta PDF
            </button>
          </div>

          <div className="mb-3">
            <input
              type="date"
              className="form-control"
              value={newRowDate}
              onChange={(e) => setNewRowDate(e.target.value)}
              style={{ width: 'auto', display: 'inline-block', marginRight: '0.5rem' }}
            />
            <button
              className="btn btn-secondary"
              onClick={addNewRow}
              disabled={loading}
            >
              + Aggiungi Rimborso
            </button>
          </div>
        </>
      )}

      <div className="attivita-table-container">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Caricamento...</span>
            </div>
          </div>
        ) : !expanded && !hasHomeRows ? (
          <div className="alert alert-info mt-3">
            Nessuna riga da compilare negli ultimi giorni lavorativi.
          </div>
        ) : (
          <div className="attivita-table-scroll" ref={tableScrollRef}>
            <table className="table table-dark attivita-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Attività</th>
                  <th>KM</th>
                  <th>Indennità</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {visibleDates.map((date) => {
                  const rows = getRowsForDate(date)
                  if (rows.length === 0) return null

                  return (
                    <React.Fragment key={date}>
                      {rows.length > 0 ? rows.map((row) => {
                        const rowId = row.id ? Number(row.id) : null
                        if (rowId && deletedIds.has(rowId)) {
                          return null
                        }

                        const isToday = row.data === todayDate
                        const validation = getRowValidation(row)
                        const isIncomplete = !validation.isComplete
                        const isTemporary = row.isTemporary

                        return (
                          <tr key={row.id} className={isIncomplete ? 'row-incomplete' : ''}>
                            <td className={isIncomplete ? 'row-incomplete-cell' : ''}>
                              <input
                                type="date"
                                className="form-control"
                                value={row.data}
                                onChange={(e) => {
                                  if (!isTemporary) {
                                    updateRow(row.id, 'data', e.target.value)
                                  }
                                }}
                                onFocus={() => setEditingRow(row.id)}
                                onBlur={clearEditingRow}
                                disabled={isToday}
                              />
                            </td>
                            <td className={isIncomplete ? 'row-incomplete-cell' : ''}>
                              <div className="autocomplete-container">
                                <input
                                  type="text"
                                  className="form-control"
                                  value={row.cliente}
                                onChange={async (e) => {
                                  const value = e.target.value
                                  if (isTemporary) {
                                    const createdId = await handleTemporaryRowChange(row, 'cliente', value)
                                    if (createdId) {
                                      setClienteSearch((prev) => ({ ...prev, [createdId]: value }))
                                      setShowAutocomplete((prev) => ({ ...prev, [createdId]: true }))
                                      openAutocompletePortal(createdId, value, e.target)
                                      setEditingRow(createdId)
                                    }
                                  } else {
                                    updateRow(row.id, 'cliente', value)
                                    setClienteSearch((prev) => ({ ...prev, [row.id]: value }))
                                    setShowAutocomplete((prev) => ({ ...prev, [row.id]: true }))
                                    openAutocompletePortal(row.id, value, e.target)
                                  }
                                }}
                                onFocus={(e) => {
                                  if (!isTemporary) {
                                    setClienteSearch((prev) => ({ ...prev, [row.id]: row.cliente }))
                                    setShowAutocomplete((prev) => ({ ...prev, [row.id]: true }))
                                    openAutocompletePortal(row.id, row.cliente, e.target)
                                  }
                                  setEditingRow(row.id)
                                }}
                                onBlur={() => {
                                  if (!isTemporary) {
                                    setTimeout(() => {
                                      setShowAutocomplete((prev) => ({ ...prev, [row.id]: false }))
                                      setPortalAutocomplete(null)
                                    }, 200)
                                  }
                                  clearEditingRow()
                                }}
                                placeholder="Cerca cliente..."
                              />
                            </div>
                          </td>
                            <td className={isIncomplete ? 'row-incomplete-cell' : ''}>
                            <select
                              className="form-select"
                              value={row.attivita}
                              onChange={async (e) => {
                                const value = e.target.value
                                if (isTemporary) {
                                  await handleTemporaryRowChange(row, 'attivita', value)
                                } else {
                                  updateRow(row.id, 'attivita', value)
                                }
                              }}
                              onFocus={() => setEditingRow(row.id)}
                              onBlur={clearEditingRow}
                            >
                                <option value="">Seleziona...</option>
                                {ATTIVITA_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </td>
                            <td className={isIncomplete ? 'row-incomplete-cell' : ''}>
                            <input
                              type="text"
                              className="form-control"
                              value={row.km}
                              onChange={async (e) => {
                                let value = e.target.value
                                value = value.replace(',', '.')
                                value = value.replace(/[^0-9.]/g, '')
                                const parts = value.split('.')
                                if (parts.length > 2) {
                                  value = parts[0] + '.' + parts.slice(1).join('')
                                }

                                if (isTemporary) {
                                  await handleTemporaryRowChange(row, 'km', value)
                                } else {
                                  updateRow(row.id, 'km', value)
                                }
                              }}
                              onFocus={() => setEditingRow(row.id)}
                              onBlur={clearEditingRow}
                              placeholder="0"
                              inputMode="decimal"
                            />
                            </td>
                            <td className={isIncomplete ? 'row-incomplete-cell' : ''}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={row.indennita}
                              onChange={async (e) => {
                                const value = e.target.checked
                                if (isTemporary) {
                                  await handleTemporaryRowChange(row, 'indennita', value)
                                } else {
                                  updateRow(row.id, 'indennita', value)
                                }
                              }}
                              onFocus={() => setEditingRow(row.id)}
                              onBlur={clearEditingRow}
                            />
                            </td>
                            <td className={isIncomplete ? 'row-incomplete-cell' : ''}>
                              <div className="d-flex gap-2 justify-content-center">
                                <button
                                  className="btn btn-sm btn-danger btn-icon"
                                  onClick={() => handleDeleteClick(row)}
                                  title="Elimina riga"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 7h16M9 7V4h6v3M8 7v13h8V7M10 11v6M14 11v6" />
                                  </svg>
                                </button>
                                <button
                                  className="btn btn-sm btn-secondary btn-icon"
                                  onClick={() => addRowForDate(row.data)}
                                  title={`Aggiungi riga (${row.data})`}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                      fill="currentColor"
                                      d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      }) : null}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && visibleDates.length === 0 && (
          <div className="alert alert-info mt-3">
            Nessun rimborso presente.
          </div>
        )}
      </div>

      {expanded && (
        <div className="card mt-4" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            {totalsTitle}
          </div>
          <div className="card-body">
            {loading ? (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Caricamento...</span>
                </div>
              </div>
            ) : (
              <div className="totals-grid">
                <div className="total-item">
                  <div className="total-item-label">Totale KM</div>
                  <div className="total-item-value">{totals.totalKm.toFixed(2)}</div>
                </div>
                <div className="total-item">
                  <div className="total-item-label">Indennità</div>
                  <div className="total-item-value">{totals.totalIndennita}</div>
                </div>
                <div className="total-item">
                  <div className="total-item-label">Costo KM</div>
                  <div className="total-item-value">€ {Number(rimborsoKm || 0).toFixed(2)}</div>
                </div>
                <div className="total-item">
                  <div className="total-item-label">Rimborso KM</div>
                  <div className="total-item-value">€ {rimborsoTotale.toFixed(2)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        show={deleteConfirm.show}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        loading={deleting}
      />
      {portalAutocomplete && (
        <div
          className="autocomplete-list autocomplete-portal"
          style={{
            position: 'fixed',
            top: `${portalAutocomplete.top}px`,
            left: `${portalAutocomplete.left}px`,
            width: `${portalAutocomplete.width}px`
          }}
        >
          {portalAutocomplete.items.map((cliente, idx) => (
            <div
              key={idx}
              className="autocomplete-item"
              onMouseDown={(e) => {
                e.preventDefault()
                const rowId = portalAutocomplete.rowId
                updateRow(rowId, 'cliente', cliente.denominazione)
                updateRow(rowId, 'clienteId', cliente.id)
                setShowAutocomplete((prev) => ({ ...prev, [rowId]: false }))
                setClienteSearch((prev) => ({ ...prev, [rowId]: '' }))
                setPortalAutocomplete(null)
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

export default TabellaAttivita

