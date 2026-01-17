import React, { useState, useMemo, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'

function TabellaAttivita({ clienti }) {
  const [attivita, setAttivita] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const [filterType, setFilterType] = useState('none')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [clienteSearch, setClienteSearch] = useState({})
  const [showAutocomplete, setShowAutocomplete] = useState({})
  const [saving, setSaving] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null })
  const [deleting, setDeleting] = useState(false)

  const ATTIVITA_OPTIONS = ['SOPRALLUOGO', 'TRASFERTA']

  // Carica attività dal server
  const loadAttivita = useCallback(async (filters = {}) => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getAttivita(filters)
      
      // Converti formato DB a formato UI
      const formatted = data.map(a => ({
        id: a.id,
        data: a.data,
        cliente: a.cliente_nome || '',
        clienteId: a.cliente_id || null,
        attivita: a.attivita || '',
        km: a.km || '',
        indennita: a.indennita === 1
      }))
      
      setAttivita(formatted)
    } catch (err) {
      console.error('Errore caricamento attività:', err)
      setError('Errore nel caricamento delle attività. Verifica che il server sia avviato.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Carica attività iniziale
  useEffect(() => {
    loadAttivita()
  }, [loadAttivita])

  // Carica attività quando cambiano i filtri (solo in modalità expanded)
  useEffect(() => {
    if (expanded) {
      const filters = {}
      if (filterType === 'mese') {
        const now = new Date()
        filters.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      } else if (filterType === 'trimestre') {
        const now = new Date()
        const quarter = Math.floor(now.getMonth() / 3) + 1
        filters.quarter = quarter
        filters.year = now.getFullYear()
      } else if (filterType === 'custom' && customStartDate && customEndDate) {
        filters.startDate = customStartDate
        filters.endDate = customEndDate
      }
      // Se filterType === 'none', carica tutte le attività senza filtri
      loadAttivita(filters)
    } else {
      // In modalità home, carica tutte le attività (il filtro viene applicato lato client)
      loadAttivita()
    }
  }, [expanded, filterType, customStartDate, customEndDate, loadAttivita])

  // Chiudi autocomplete quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        setShowAutocomplete({})
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Funzione per formattare data in formato europeo gg/mm/yyyy
  const formatDateEuropean = (dateString) => {
    if (!dateString) return ''
    // Se è già in formato ISO (yyyy-mm-dd), parsalo direttamente
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-')
      return `${day}/${month}/${year}`
    }
    // Altrimenti prova a parsare come Date
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    } catch {
      return dateString
    }
  }

  // Funzione per ottenere le date (oggi, ieri, l'altro ieri)
  const getDateGroups = () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const dayBefore = new Date(today)
    dayBefore.setDate(dayBefore.getDate() - 2)

    const formatDate = (date) => {
      return date.toISOString().split('T')[0]
    }

    return [
      { date: formatDate(today), label: 'Oggi' },
      { date: formatDate(yesterday), label: 'Ieri' },
      { date: formatDate(dayBefore), label: 'L\'altro ieri' }
    ]
  }

  // Assicura che le righe per le ultime 3 date esistano sempre
  useEffect(() => {
    const dateGroups = getDateGroups()
    const existingDates = new Set(attivita.map(a => a.data).filter(d => d))
    
    const createMissingRows = async () => {
      const toCreate = []
      dateGroups.forEach(({ date }) => {
        if (!existingDates.has(date) && !loading) {
          toCreate.push({
            data: date,
            clienteId: null,
            clienteNome: '',
            attivita: '',
            km: 0,
            indennita: 0
          })
        }
      })

      if (toCreate.length > 0) {
        try {
          await Promise.all(toCreate.map(row => api.createAttivita(row)))
          await loadAttivita()
        } catch (err) {
          console.error('Errore creazione righe automatiche:', err)
        }
      }
    }

    // Crea le righe solo se non stiamo caricando
    if (!loading) {
      createMissingRows()
    }
  }, [attivita.length, loading, loadAttivita])

  // Verifica se una riga è compilata
  const isRowComplete = (row) => {
    return row.cliente && row.cliente.trim() !== '' && 
           row.km && parseFloat(row.km) > 0 && 
           row.attivita && row.attivita.trim() !== ''
  }

  // Salva riga sul server (con debounce)
  const saveRow = useCallback(async (row) => {
    if (saving[row.id]) return // Evita chiamate duplicate
    
    setSaving(prev => ({ ...prev, [row.id]: true }))
    
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
        // Aggiorna ID locale
        setAttivita(prev => prev.map(r => r === row ? { ...r, id: result.id } : r))
      }
    } catch (err) {
      console.error('Errore salvataggio attività:', err)
      setError('Errore nel salvataggio: ' + (err.message || 'Errore sconosciuto'))
    } finally {
      setSaving(prev => {
        const newSaving = { ...prev }
        delete newSaving[row.id]
        return newSaving
      })
    }
  }, [saving])

  // Aggiorna riga (ottimistic update + salvataggio)
  const updateRow = useCallback((id, field, value) => {
    setAttivita(prev => {
      const updated = prev.map(row => {
        if (row.id === id) {
          const newRow = { ...row, [field]: value }
          // Salva dopo un breve delay per evitare troppe chiamate
          setTimeout(() => saveRow(newRow), 500)
          return newRow
        }
        return row
      })
      return updated
    })
  }, [saveRow])

  // Helper per ricaricare i dati con i filtri correnti
  const reloadWithCurrentFilters = useCallback(async () => {
    if (expanded) {
      const filters = {}
      if (filterType === 'mese') {
        const now = new Date()
        filters.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      } else if (filterType === 'trimestre') {
        const now = new Date()
        const quarter = Math.floor(now.getMonth() / 3) + 1
        filters.quarter = quarter
        filters.year = now.getFullYear()
      } else if (filterType === 'custom' && customStartDate && customEndDate) {
        filters.startDate = customStartDate
        filters.endDate = customEndDate
      }
      await loadAttivita(filters)
    } else {
      await loadAttivita()
    }
  }, [expanded, filterType, customStartDate, customEndDate, loadAttivita])

  // Mostra modal di conferma eliminazione
  const handleDeleteClick = (id) => {
    // Validazione ID
    if (!id) {
      setError('ID attività non valido')
      return
    }

    // Non eliminare righe temporanee
    if (typeof id === 'string' && id.startsWith('temp-')) {
      return
    }

    // Converti ID a numero se necessario
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id
    if (isNaN(numericId)) {
      setError('ID attività non valido')
      return
    }

    setDeleteConfirm({ show: true, id: numericId })
  }

  // Conferma eliminazione
  const confirmDelete = async () => {
    const { id } = deleteConfirm
    if (!id) {
      console.error('ID attività mancante per eliminazione')
      setError('ID attività non valido')
      setDeleteConfirm({ show: false, id: null })
      return
    }

    try {
      setDeleting(true)
      setError(null)
      
      console.log('Eliminazione attività con ID:', id, 'Tipo:', typeof id)
      
      // Chiama l'API di eliminazione
      const response = await api.deleteAttivita(id)
      
      console.log('Risposta eliminazione:', response)
      
      // Verifica risposta - il backend restituisce { success: true } o un errore
      if (response && response.error) {
        throw new Error(response.error)
      }

      // Chiudi modal immediatamente per feedback visivo
      setDeleteConfirm({ show: false, id: null })
      
      // Rimuovi ottimisticamente dalla lista locale (gestisce sia numeri che stringhe)
      setAttivita(prev => {
        const filtered = prev.filter(row => {
          const rowId = row.id
          // Confronta in tutti i modi possibili per gestire numeri e stringhe
          return rowId !== id && 
                 rowId !== String(id) && 
                 String(rowId) !== String(id) &&
                 Number(rowId) !== Number(id)
        })
        console.log('Eliminazione: righe prima:', prev.length, 'righe dopo:', filtered.length, 'ID eliminato:', id)
        return filtered
      })
      
      // Ricarica i dati con i filtri correnti per sincronizzare
      await reloadWithCurrentFilters()
    } catch (err) {
      console.error('Errore eliminazione attività:', err)
      setError('Errore nell\'eliminazione: ' + (err.message || 'Errore sconosciuto'))
      // Non chiudere il modal in caso di errore, così l'utente può riprovare
    } finally {
      setDeleting(false)
    }
  }

  // Annulla eliminazione
  const cancelDelete = () => {
    setDeleteConfirm({ show: false, id: null })
  }

  // Aggiungi nuova riga manuale
  const addNewRow = async () => {
    const today = new Date()
    const todayDate = today.toISOString().split('T')[0]
    
    try {
      const result = await api.createAttivita({
        data: todayDate,
        clienteId: null,
        clienteNome: '',
        attivita: '',
        km: 0,
        indennita: 0
      })
      
      const newRow = {
        id: result.id,
        data: todayDate,
        cliente: '',
        clienteId: null,
        attivita: '',
        km: '',
        indennita: false
      }
      
      setAttivita([newRow, ...attivita])
    } catch (err) {
      console.error('Errore creazione attività:', err)
      setError('Errore nella creazione: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  // Filtra attività in base ai filtri selezionati (lato client per performance)
  const filteredAttivita = useMemo(() => {
    let filtered = [...attivita]

    if (!expanded) {
      // In modalità home, mostra solo ultime 3 date
      const dateGroups = getDateGroups()
      const visibleDates = new Set(dateGroups.map(d => d.date))
      filtered = filtered.filter(a => visibleDates.has(a.data))
    } else {
      // Filtro per date
      if (filterType === 'mese') {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        filtered = filtered.filter(a => {
          const date = new Date(a.data)
          return date >= startOfMonth && date <= endOfMonth
        })
      } else if (filterType === 'trimestre') {
        const now = new Date()
        const quarter = Math.floor(now.getMonth() / 3)
        const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1)
        const endOfQuarter = new Date(now.getFullYear(), quarter * 3 + 3, 0)
        filtered = filtered.filter(a => {
          const date = new Date(a.data)
          return date >= startOfQuarter && date <= endOfQuarter
        })
      } else if (filterType === 'custom' && customStartDate && customEndDate) {
        filtered = filtered.filter(a => {
          const date = new Date(a.data)
          const start = new Date(customStartDate)
          const end = new Date(customEndDate)
          return date >= start && date <= end
        })
      }
    }

    return filtered
  }, [attivita, expanded, filterType, customStartDate, customEndDate])

  // Raggruppa per data
  const groupedByDate = useMemo(() => {
    const groups = {}
    filteredAttivita.forEach(att => {
      if (!groups[att.data]) {
        groups[att.data] = []
      }
      groups[att.data].push(att)
    })
    return groups
  }, [filteredAttivita])

  // Calcola totali
  const totals = useMemo(() => {
    const filtered = Array.isArray(filteredAttivita) ? filteredAttivita : []
    
    // Calcola totale KM (gestisce stringhe vuote e valori null)
    const totalKm = filtered.reduce((sum, a) => {
      if (!a) return sum
      const kmValue = a.km === '' || a.km === null || a.km === undefined ? 0 : parseFloat(a.km)
      return sum + (isNaN(kmValue) ? 0 : kmValue)
    }, 0)
    
    // Calcola numero di indennità spuntate (gestisce booleani e numeri)
    const totalIndennita = filtered.filter(a => {
      if (!a) return false
      if (typeof a.indennita === 'boolean') return a.indennita
      if (typeof a.indennita === 'number') return a.indennita === 1
      return false
    }).length

    return {
      totalKm: totalKm || 0,
      totalIndennita: totalIndennita || 0
    }
  }, [filteredAttivita])

  // Autocompletamento clienti per riga
  const getFilteredClienti = (rowId, searchTerm) => {
    if (!searchTerm) return []
    return clienti.filter(c => 
      c.denominazione?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10)
  }

  // Export PDF
  const exportPDF = async () => {
    const doc = new jsPDF()
    
    // Intestazione con logo e ragione sociale
    try {
      // Carica il logo
      const logoImg = new Image()
      logoImg.src = '/logo-studio-ingegneria-removebg-preview.png'
      
      await new Promise((resolve, reject) => {
        logoImg.onload = () => {
          try {
            // Aggiungi logo (dimensioni: 50x50, posizione: 14, 10)
            doc.addImage(logoImg, 'PNG', 14, 10, 50, 50)
            resolve()
          } catch (err) {
            console.warn('Errore aggiunta logo al PDF:', err)
            resolve() // Continua anche se il logo non si carica
          }
        }
        logoImg.onerror = () => {
          console.warn('Logo non trovato, PDF generato senza logo')
          resolve() // Continua anche se il logo non si carica
        }
      })
    } catch (err) {
      console.warn('Errore caricamento logo:', err)
    }
    
    // Ragione sociale e dati studio
    doc.setFontSize(16)
    doc.setTextColor(42, 63, 84) // Grigio scuro Studio Capoferri
    doc.setFont('helvetica', 'bold')
    doc.text('Studio Capoferri', 70, 20)
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Ingegneria | Architettura | Urbanistica', 70, 28)
    
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text('Via Piave 35, 25030 Adro (BS)', 70, 36)
    doc.text('Tel: +39 030 7357263 | Email: info@studiocapoferri.eu', 70, 42)
    doc.text('P.IVA: 04732710985', 70, 48)
    
    // Titolo report
    doc.setFontSize(14)
    doc.setTextColor(42, 63, 84)
    doc.setFont('helvetica', 'bold')
    doc.text('Report Attività', 14, 65)
    
    // Filtri applicati
    let filterText = 'Periodo: '
    if (filterType === 'mese') {
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
    doc.text(filterText, 14, 72)
    
    // Tabella
    const tableData = filteredAttivita.map(a => {
      const dateFormatted = formatDateEuropean(a.data)
      return [
        dateFormatted,
        a.cliente || '',
        a.attivita || '',
        a.km || '0',
        a.indennita ? 'Sì' : 'No'
      ]
    })
    
    doc.autoTable({
      head: [['Data', 'Cliente', 'Attività', 'KM', 'Indennità']],
      body: tableData,
      startY: 78,
      styles: { 
        fontSize: 9,
        textColor: [255, 255, 255]
      },
      headStyles: { 
        fillColor: [42, 63, 84],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [42, 63, 84],
        textColor: [255, 255, 255]
      },
      bodyStyles: {
        fillColor: [31, 46, 61],
        textColor: [255, 255, 255]
      }
    })
    
    // Totali
    const finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(42, 63, 84)
    doc.text('Totali:', 14, finalY)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text(`Totale KM: ${totals.totalKm.toFixed(2)}`, 14, finalY + 7)
    doc.text(`Indennità: ${totals.totalIndennita}`, 14, finalY + 14)
    
    // Data generazione
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
    
    doc.save(`report-attivita-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const dateGroups = getDateGroups()
  const todayDate = new Date().toISOString().split('T')[0]
  
  // Assicura che oggi sia sempre presente nelle date visibili
  const visibleDates = expanded 
    ? Object.keys(groupedByDate).sort().reverse() 
    : dateGroups.map(d => d.date)
  
  // Crea righe vuote per le ultime 3 date se non esistono (solo per visualizzazione)
  const getRowsForDate = (date) => {
    const rows = groupedByDate[date] || []
    const dateGroups = getDateGroups()
    const isLastThreeDays = dateGroups.some(d => d.date === date)
    
    // Se è una delle ultime 3 date e non ci sono righe, mostra una riga temporanea vuota
    // Questa verrà creata sul server quando l'utente modifica qualcosa
    if (isLastThreeDays && rows.length === 0) {
      return [{
        id: `temp-${date}`,
        data: date,
        cliente: '',
        clienteId: null,
        attivita: '',
        km: '',
        indennita: false,
        isTemporary: true
      }]
    }
    
    return rows
  }

  // Crea la riga sul server se è temporanea e l'utente modifica qualcosa
  const handleTemporaryRowChange = async (row, field, value) => {
    if (!row.isTemporary) return false
    
    try {
      // Crea la riga sul server con i valori attuali + il nuovo valore
      const attivitaData = {
        data: row.data,
        clienteId: field === 'cliente' ? null : row.clienteId,
        clienteNome: field === 'cliente' ? value : row.cliente,
        attivita: field === 'attivita' ? value : row.attivita,
        km: field === 'km' ? (parseFloat(value) || 0) : (parseFloat(row.km) || 0),
        indennita: field === 'indennita' ? (value ? 1 : 0) : (row.indennita ? 1 : 0)
      }
      
      await api.createAttivita(attivitaData)
      await loadAttivita() // Ricarica per ottenere la riga con ID reale
      return true
    } catch (err) {
      console.error('Errore creazione riga:', err)
      setError('Errore nella creazione della riga: ' + (err.message || 'Errore sconosciuto'))
      return false
    }
  }

  return (
    <div>
      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0">Attività</h2>
        <div className="d-flex gap-2">
          {expanded && (
            <button 
              className="btn btn-secondary"
              onClick={() => setExpanded(false)}
            >
              ← Indietro
            </button>
          )}
          <button 
            className="btn btn-secondary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Mostra Solo Ultimi 3 Giorni' : 'Mostra tutte'}
          </button>
        </div>
      </div>

      {/* Filtri e pulsante aggiungi */}
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
            <button 
              className="btn btn-secondary"
              onClick={addNewRow}
              disabled={loading}
            >
              + Aggiungi Attività
            </button>
          </div>
        </>
      )}

      {/* Tabella */}
      <div className="attivita-table-container">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Caricamento...</span>
            </div>
          </div>
        ) : (
          <table className="table table-dark table-striped attivita-table">
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
              {visibleDates.map(date => {
                const rows = getRowsForDate(date)
                
                // In modalità expanded, salta le date senza righe (tranne oggi)
                if (expanded && rows.length === 0 && date !== todayDate) return null

                const dateLabel = dateGroups.find(d => d.date === date)?.label || ''
                const dateFormatted = formatDateEuropean(date)

                return (
                  <React.Fragment key={date}>
                    <tr>
                      <td colSpan="6" className="date-group">
                        <div className="date-group-header">
                          {dateLabel ? `${dateLabel} - ${dateFormatted}` : dateFormatted}
                        </div>
                      </td>
                    </tr>
                    {rows.length > 0 ? rows.map((row, rowIndex) => {
                      const isToday = row.data === todayDate
                      const isIncomplete = !isRowComplete(row)
                      const isTemporary = row.isTemporary
                      
                      return (
                        <tr key={row.id} className={isIncomplete ? 'row-incomplete' : ''}>
                          <td>
                            <input
                              type="date"
                              className="form-control"
                              value={row.data}
                              onChange={(e) => {
                                if (!isTemporary) {
                                  updateRow(row.id, 'data', e.target.value)
                                }
                                // La data di oggi non può essere modificata
                              }}
                              disabled={isToday}
                            />
                          </td>
                          <td>
                            <div className="autocomplete-container">
                              <input
                                type="text"
                                className="form-control"
                                value={row.cliente}
                                onChange={async (e) => {
                                  const value = e.target.value
                                  if (isTemporary) {
                                    await handleTemporaryRowChange(row, 'cliente', value)
                                  } else {
                                    updateRow(row.id, 'cliente', value)
                                    setClienteSearch({ ...clienteSearch, [row.id]: value })
                                    setShowAutocomplete({ ...showAutocomplete, [row.id]: true })
                                  }
                                }}
                                onFocus={() => {
                                  if (!isTemporary) {
                                    setClienteSearch({ ...clienteSearch, [row.id]: row.cliente })
                                    setShowAutocomplete({ ...showAutocomplete, [row.id]: true })
                                  }
                                }}
                                onBlur={() => {
                                  if (!isTemporary) {
                                    setTimeout(() => {
                                      setShowAutocomplete({ ...showAutocomplete, [row.id]: false })
                                    }, 200)
                                  }
                                }}
                                placeholder="Cerca cliente..."
                              />
                              {!isTemporary && showAutocomplete[row.id] && getFilteredClienti(row.id, clienteSearch[row.id] || row.cliente).length > 0 && (
                                <div className="autocomplete-list">
                                  {getFilteredClienti(row.id, clienteSearch[row.id] || row.cliente).map((cliente, idx) => (
                                    <div
                                      key={idx}
                                      className="autocomplete-item"
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        updateRow(row.id, 'cliente', cliente.denominazione)
                                        updateRow(row.id, 'clienteId', cliente.id)
                                        setShowAutocomplete({ ...showAutocomplete, [row.id]: false })
                                        setClienteSearch({ ...clienteSearch, [row.id]: '' })
                                      }}
                                    >
                                      {cliente.denominazione}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
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
                            >
                              <option value="">Seleziona...</option>
                              {ATTIVITA_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control"
                              value={row.km}
                              onChange={async (e) => {
                                let value = e.target.value
                                // Permetti solo numeri, punto decimale e virgola (convertita in punto)
                                value = value.replace(',', '.')
                                // Rimuovi tutto tranne numeri e punto decimale
                                value = value.replace(/[^0-9.]/g, '')
                                // Permetti solo un punto decimale
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
                              placeholder="0"
                              inputMode="decimal"
                            />
                          </td>
                          <td>
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
                            />
                          </td>
                          <td>
                            {!isTemporary && (
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteClick(row.id)}
                                disabled={isToday && rows.length === 1}
                                title={isToday && rows.length === 1 ? 'La riga di oggi non può essere eliminata' : ''}
                              >
                                Elimina
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    }) : null}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}

        {!loading && filteredAttivita.length === 0 && !expanded && (
          <div className="alert alert-info mt-3">
            Le righe per oggi, ieri e l'altro ieri vengono generate automaticamente.
          </div>
        )}
        
        {!loading && visibleDates.length === 0 && (
          <div className="alert alert-info mt-3">
            Nessuna attività presente.
          </div>
        )}
      </div>

      {/* Totali - Sempre visibile quando expanded è true */}
      {expanded && (
        <div className="card mt-4" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            Totale periodo selezionato
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
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal di conferma eliminazione */}
      <ConfirmDeleteModal
        show={deleteConfirm.show}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  )
}

export default TabellaAttivita
