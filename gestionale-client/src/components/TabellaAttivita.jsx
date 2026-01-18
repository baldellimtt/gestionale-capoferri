import React, { useState, useMemo, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, isTemporary: false })
  const [deleting, setDeleting] = useState(false)
  const [deletedIds, setDeletedIds] = useState(new Set()) // ID eliminati da nascondere in UI
  const [hiddenTempDates, setHiddenTempDates] = useState(new Set()) // Date con righe temporanee nascoste
  const [newRowDate, setNewRowDate] = useState(new Date().toISOString().split('T')[0])

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
      
      // RIMUOVI DUPLICATI per ID (mantieni solo la prima occorrenza)
      // E FILTRA gli ID appena eliminati (anche se il server li restituisce ancora)
      const seen = new Set()
      const unique = formatted.filter(a => {
        if (!a || !a.id) return false
        
        // Converti ID a numero per confronto
        const rowId = typeof a.id === 'string' ? parseInt(a.id, 10) : Number(a.id)
        if (isNaN(rowId)) return false
        
        // Controlla duplicati
        if (seen.has(rowId)) {
          console.log('🚫 Duplicato rimosso:', rowId)
          return false
        }
        
        // Se questo ID è stato appena eliminato, non includerlo
        if (deletedIds.has(rowId)) {
          console.log('🚫 Filtro ID eliminato dal caricamento:', a.id, 'Blacklist:', Array.from(deletedIds))
          return false
        }
        
        seen.add(rowId)
        return true
      })
      
      setAttivita(unique)
    } catch (err) {
      console.error('Errore caricamento attività:', err)
      setError('Errore nel caricamento delle attività. Verifica che il server sia avviato.')
    } finally {
      setLoading(false)
    }
  }, [deletedIds]) // Ricarica se cambia la blacklist eliminazioni

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

  // Crea automaticamente la riga per oggi se non esiste - SOLO UNA VOLTA
  // Usa la data di oggi come chiave per evitare creazioni multiple nello stesso giorno
  const [lastCreatedDate, setLastCreatedDate] = useState(null)
  
  useEffect(() => {
    if (loading) return // Non fare nulla durante il caricamento
    
    const today = new Date().toISOString().split('T')[0]
    
    // Se abbiamo già creato una riga oggi, non crearla di nuovo
    if (lastCreatedDate === today) return
    
    // Verifica se esiste già una riga per oggi
    const hasTodayRow = attivita.some(a => a.data === today && a.id && typeof a.id === 'number' && !a.isTemporary)
    
    if (!hasTodayRow) {
      setLastCreatedDate(today) // Imposta il flag PRIMA di creare
      
      // Crea la riga per oggi
      api.createAttivita({
        data: today,
        clienteId: null,
        clienteNome: '',
        attivita: '',
        km: 0,
        indennita: 0
      })
        .then(result => {
          const newRow = {
            id: result.id,
            data: today,
            cliente: '',
            clienteId: null,
            attivita: '',
            km: '',
            indennita: false
          }
          // Aggiungi in cima all'array solo se non esiste già
          setAttivita(prev => {
            const alreadyExists = prev.some(a => a.id === result.id || (a.data === today && a.id && typeof a.id === 'number' && !a.isTemporary))
            if (alreadyExists) return prev
            return [newRow, ...prev]
          })
        })
        .catch(err => {
          console.error('Errore creazione riga oggi:', err)
          setLastCreatedDate(null) // Reset flag in caso di errore
        })
    } else {
      // Se esiste già, aggiorna il flag
      setLastCreatedDate(today)
    }
  }, [loading, lastCreatedDate]) // Rimosso attivita dalle dipendenze per evitare loop

  // Verifica se una riga è compilata
  const getRowValidation = (row) => {
    const missing = []
    const cliente = row?.cliente ? row.cliente.trim() : ''
    const attivita = row?.attivita ? row.attivita.trim() : ''
    const kmRaw = row?.km ?? ''
    const kmValue = typeof kmRaw === 'string' ? Number(kmRaw.replace(',', '.')) : Number(kmRaw)

    if (!cliente) missing.push('Cliente')
    if (!attivita) missing.push('Attivit�')
    if (!kmRaw || Number.isNaN(kmValue) || kmValue <= 0) missing.push('KM')

    return {
      isComplete: missing.length === 0,
      missing
    }
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
  const handleDeleteClick = (row) => {
    const id = row?.id
    console.log('🔴 CLICK ELIMINA - ID ricevuto:', id, 'Tipo:', typeof id)
    
    // Validazione ID
    if (id == null) {
      console.error('❌ ID non valido (null/undefined)')
      setError('ID attività non valido')
      return
    }

    const isTemporaryRow = !!row?.isTemporary || (typeof id === 'string' && id.startsWith('temp-'))
    if (isTemporaryRow) {
      setDeleteConfirm({ show: true, id, isTemporary: true })
      return
    }

    // Converti ID a numero se necessario
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id
    if (isNaN(numericId)) {
      console.error('❌ ID non valido (NaN):', id)
      setError('ID attività non valido')
      return
    }

    console.log('✅ Apertura modal eliminazione per ID:', numericId)
    setDeleteConfirm({ show: true, id: numericId, isTemporary: false })
  }

  // Conferma eliminazione - SOLUZIONE SEMPLICE E DIRETTA
  const confirmDelete = async () => {
    const { id, isTemporary } = deleteConfirm
    if (id == null) {
      setDeleteConfirm({ show: false, id: null, isTemporary: false })
      return
    }

    if (isTemporary || (typeof id === 'string' && id.startsWith('temp-'))) {
      setDeleteConfirm({ show: false, id: null, isTemporary: false })
      setAttivita(prev => prev.filter(row => row?.id !== id))
      const tempDate = typeof id === 'string' && id.startsWith('temp-') ? id.slice(5) : null
      if (tempDate) {
        setHiddenTempDates(prev => {
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
    
    // Chiudi modal subito
    setDeleteConfirm({ show: false, id: null, isTemporary: false })
    setDeleting(true)
    
    // Aggiungi alla blacklist
    setDeletedIds(prev => {
      if (prev.has(idToDelete)) return prev
      const next = new Set(prev)
      next.add(idToDelete)
      return next
    })
    
    // Rimuovi la riga dallo stato - CONFRONTO DIRETTO E SEMPLICE
    setAttivita(prev => {
      const filtered = prev.filter(row => {
        if (!row || row.id == null || row.id === undefined) return true
        const rowId = Number(row.id)
        const toDelete = Number(idToDelete)
        const keep = rowId !== toDelete
        if (!keep) {
          console.log('RIMOSSA RIGA con ID:', rowId, 'confrontato con:', toDelete)
        }
        return keep
      })
      console.log('PRIMA:', prev.length, 'righe, DOPO:', filtered.length, 'righe. ID eliminato:', idToDelete)
      return filtered
    })
    
    // Chiama API e riallinea lo stato con il server
    try {
      await api.deleteAttivita(idToDelete)
    } catch (err) {
      console.error('Errore eliminazione API:', err)
      setError('Errore nell\'eliminazione: ' + (err.message || 'Errore sconosciuto'))
    } finally {
      setDeleting(false)
      await reloadWithCurrentFilters()
    }
  }

  // Annulla eliminazione
  const cancelDelete = () => {
    setDeleteConfirm({ show: false, id: null, isTemporary: false })
  }

  // Aggiungi nuova riga manuale (per oggi)
  const addNewRow = async () => {
    const dateToAdd = newRowDate || new Date().toISOString().split('T')[0]
    await addRowForDate(dateToAdd)
  }

  // Aggiungi nuova riga per una data specifica
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
      
      // Inserisci la nuova riga in cima all'array (così appare subito dopo l'header della data)
      setAttivita(prev => {
        // Trova l'indice della prima riga con questa data
        const dateIndex = prev.findIndex(r => r.data === date)
        if (dateIndex >= 0) {
          // Inserisci dopo la prima riga con questa data
          return [
            ...prev.slice(0, dateIndex + 1),
            newRow,
            ...prev.slice(dateIndex + 1)
          ]
        } else {
          // Se non ci sono righe per questa data, inserisci all'inizio
          return [newRow, ...prev]
        }
      })
    } catch (err) {
      console.error('Errore creazione attività:', err)
      setError('Errore nella creazione: ' + (err.message || 'Errore sconosciuto'))
    }
  }

  // Filtra attività in base ai filtri selezionati (lato client per performance)
  // RIMUOVE DUPLICATI per data e ID
  // ESCLUDE gli ID nella blacklist (righe eliminate)
  const filteredAttivita = useMemo(() => {
    // PRIMA: rimuovi duplicati (stesso ID o stessa data+stesso contenuto vuoto)
    // E ESCLUDI gli ID nella blacklist
    const seen = new Set()
    const unique = attivita.filter(a => {
      if (!a || !a.data) return false
      
      // ESCLUDI gli ID nella blacklist (righe eliminate)
      if (a.id) {
        const rowId = typeof a.id === 'string' ? parseInt(a.id, 10) : Number(a.id)
        if (!isNaN(rowId) && deletedIds.has(rowId)) {
          console.log('🚫 Riga esclusa da filteredAttivita (blacklist):', rowId)
          return false
        }
      }
      
      // Per righe con ID, usa l'ID come chiave univoca
      if (a.id && typeof a.id === 'number') {
        if (seen.has(`id-${a.id}`)) return false
        seen.add(`id-${a.id}`)
        return true
      }
      // Per righe temporanee o senza ID, usa data+contenuto
      const key = `date-${a.data}-${a.cliente || ''}-${a.attivita || ''}-${a.km || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    
    let filtered = [...unique]

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
  }, [attivita, expanded, filterType, customStartDate, customEndDate, deletedIds])

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
    const headerTextTopY = 18
    let headerX = 70
    let logoBottomY = 10
    
    // Intestazione con logo e ragione sociale
    try {
      // Carica il logo
      const logoImg = new Image()
      logoImg.src = '/logo-studio-ingegneria-removebg-preview.png'
      
      await new Promise((resolve, reject) => {
        logoImg.onload = () => {
          try {
            // Aggiungi logo mantenendo il rapporto di aspetto
            const maxW = 42
            const maxH = 22
            const ratio = logoImg.width && logoImg.height ? (logoImg.width / logoImg.height) : 1
            let w = maxW
            let h = w / ratio
            if (h > maxH) {
              h = maxH
              w = h * ratio
            }
            const logoX = 14
            const logoY = 12
            doc.addImage(logoImg, 'PNG', logoX, logoY, w, h)
            headerX = logoX + w + 8
            logoBottomY = logoY + h
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
    doc.text('Studio Capoferri', headerX, headerTextTopY)
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Ingegneria | Architettura | Urbanistica', headerX, headerTextTopY + 7)
    
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text('Via Piave 35, 25030 Adro (BS)', headerX, headerTextTopY + 14)
    doc.text('Tel: +39 030 7357263 | Email: info@studiocapoferri.eu', headerX, headerTextTopY + 20)
    doc.text('P.IVA: 04732710985', headerX, headerTextTopY + 26)
    
    const headerTextBottomY = headerTextTopY + 26
    const headerBottomY = Math.max(logoBottomY, headerTextBottomY)
    
    // Titolo report
    doc.setFontSize(14)
    doc.setTextColor(42, 63, 84)
    doc.setFont('helvetica', 'bold')
    const reportTitleY = headerBottomY + 12
    doc.text('Report Attivita', 14, reportTitleY)
    
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
    const filterY = reportTitleY + 7
    doc.text(filterText, 14, filterY)
    
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
    
    autoTable(doc, {
      head: [['Data', 'Cliente', 'Attività', 'KM', 'Indennità']],
      body: tableData,
      startY: filterY + 6,
      styles: { 
        fontSize: 9,
        textColor: [33, 33, 33]
      },
      headStyles: { 
        fillColor: [255, 255, 255],
        textColor: [42, 63, 84],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
        textColor: [33, 33, 33]
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [33, 33, 33]
      }
    })
    
    // Totali - calcola la posizione Y finale
    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : (filterY + 6) + (tableData.length * 7) + 20
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
      if (hiddenTempDates.has(date)) {
        return []
      }
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
                        <div className="date-group-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{dateLabel ? `${dateLabel} - ${dateFormatted}` : dateFormatted}</span>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => addRowForDate(date)}
                            disabled={loading}
                            style={{ 
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.875rem',
                              lineHeight: '1.2'
                            }}
                            title="Aggiungi riga per questo giorno"
                          >
                            + Riga
                          </button>
                        </div>
                      </td>
                    </tr>
                    {rows.length > 0 ? rows.map((row, rowIndex) => {
                      // CONTROLLO ESPLICITO: escludi righe eliminate dalla blacklist
                      const rowId = row.id ? Number(row.id) : null
                      if (rowId && deletedIds.has(rowId)) {
                        return null // Non renderizzare righe eliminate
                      }
                      
                      const isToday = row.data === todayDate
                      const validation = getRowValidation(row)
                      const isIncomplete = !validation.isComplete
                      const isTemporary = row.isTemporary
                      
                      return (
                        <tr key={row.id} >
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
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDeleteClick(row)}
                              disabled={!isTemporary && isToday && rows.length === 1}
                              title={!isTemporary && isToday && rows.length === 1 ? 'La riga di oggi non puo essere eliminata' : ''}
                            >
                              Elimina
                            </button>
                            {isIncomplete && (
                              <span className="badge bg-warning text-dark ms-2">Incompleta</span>
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





















