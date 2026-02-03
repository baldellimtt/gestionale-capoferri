import { useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import KanbanComments from './KanbanComments'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import useKanbanCardDetailState from '../hooks/useKanbanCardDetailState'
import useKanbanCardDetailEffects from '../hooks/useKanbanCardDetailEffects'

const getTodayDate = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function KanbanCardDetail({ card, colonne, clienti, commesse = [], currentUser, onSave, onDelete, onClose, onRefresh, toast }) {
  const parseDateTime = (value) => {
    if (!value) return { date: '', time: '' }
    const clean = String(value).trim()
    const [datePart, timePart] = clean.includes('T')
      ? clean.split('T')
      : clean.includes(' ')
        ? clean.split(' ')
        : [clean, '']
    const time = timePart ? timePart.slice(0, 5) : ''
    return { date: datePart.slice(0, 10), time }
  }

  const {
    formData,
    setFormData,
    allDay,
    setAllDay,
    timeStart,
    setTimeStart,
    timeEnd,
    setTimeEnd,
    noDeadline,
    setNoDeadline,
    scadenze,
    setScadenze,
    loading,
    setLoading,
    error,
    setError,
    showScadenzaForm,
    setShowScadenzaForm,
    clienteSearch,
    setClienteSearch,
    portalAutocomplete,
    setPortalAutocomplete,
    autocompleteRef,
    commessaSearch,
    setCommessaSearch,
    portalCommessaAutocomplete,
    setPortalCommessaAutocomplete,
    commessaAutocompleteRef,
    commessaAudit,
    setCommessaAudit,
    commessaAuditLoading,
    setCommessaAuditLoading,
    commessaAuditError,
    setCommessaAuditError,
    commessaAuditCommessaId,
    setCommessaAuditCommessaId,
    showCommessaAudit,
    setShowCommessaAudit,
    auditNoteDate,
    setAuditNoteDate,
    auditNoteText,
    setAuditNoteText,
    auditNoteSaving,
    setAuditNoteSaving,
    scadenzaForm,
    setScadenzaForm,
    deleteScadenzaId,
    setDeleteScadenzaId,
    deleteScadenzaLoading,
    setDeleteScadenzaLoading
  } = useKanbanCardDetailState({ getTodayDate })

  const queryClient = useQueryClient()

  const normalizeDatePart = (value) => {
    if (!value) return ''
    const clean = String(value).trim()
    if (!clean) return ''
    if (clean.includes('T')) return clean.split('T')[0]
    if (clean.includes(' ')) return clean.split(' ')[0]
    return clean
  }

  const addMonthsToDate = (dateValue, monthsToAdd) => {
    if (!dateValue) return ''
    const [yearStr, monthStr, dayStr] = normalizeDatePart(dateValue).split('-')
    const year = Number(yearStr)
    const month = Number(monthStr) - 1
    const day = Number(dayStr)
    if (!year || Number.isNaN(month) || !day) return ''
    const base = new Date(year, month, 1)
    base.setMonth(base.getMonth() + monthsToAdd)
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
    const finalDay = Math.min(day, lastDay)
    base.setDate(finalDay)
    const y = base.getFullYear()
    const m = String(base.getMonth() + 1).padStart(2, '0')
    const d = String(base.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const addMonthsToDateTime = (value, monthsToAdd) => {
    if (!value) return ''
    const clean = String(value).trim()
    if (!clean) return ''
    if (!clean.includes('T') && !clean.includes(' ')) {
      return addMonthsToDate(clean, monthsToAdd)
    }
    const [datePart, timePart] = clean.includes('T') ? clean.split('T') : clean.split(' ')
    const nextDate = addMonthsToDate(datePart, monthsToAdd)
    if (!nextDate) return ''
    return `${nextDate}${clean.includes('T') ? 'T' : ' '}${timePart}`
  }

  const buildCardPayload = () => {
    const buildDateTime = (dateValue, timeValue) => {
      if (!dateValue) return ''
      if (allDay || !timeValue) return dateValue
      return `${dateValue}T${timeValue}:00`
    }

    return {
      ...formData,
      tags: formData.tags && formData.tags.length > 0 ? formData.tags : null,
      data_inizio: buildDateTime(formData.data_inizio, timeStart),
      data_fine_prevista: noDeadline ? '' : buildDateTime(formData.data_fine_prevista, timeEnd),
      recurrence_enabled: !!formData.recurrence_enabled,
      recurrence_type: formData.recurrence_type || 'mensile',
      row_version: card?.row_version,
      commessa_id: (() => {
        if (!formData.commessa_id || formData.commessa_id === '' || formData.commessa_id === 0) return null;
        const num = typeof formData.commessa_id === 'number' ? formData.commessa_id : parseInt(formData.commessa_id, 10);
        return !isNaN(num) && num >= 1 ? num : null;
      })(),
      cliente_id: (() => {
        if (!formData.cliente_id || formData.cliente_id === '' || formData.cliente_id === 0) return null;
        const num = typeof formData.cliente_id === 'number' ? formData.cliente_id : parseInt(formData.cliente_id, 10);
        return !isNaN(num) && num >= 1 ? num : null;
      })()
    }
  }


  // Filtra clienti per autocompletamento
  const getFilteredClienti = (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      return clienti.slice(0, 10)
    }
    return clienti
      .filter((cliente) => cliente.denominazione?.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10)
  }

  // Apri portal autocompletamento
  const openAutocompletePortal = (value, target) => {
    if (!target) return
    const items = getFilteredClienti(value)
    if (items.length === 0 && value.trim() !== '') {
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

  // Gestisci selezione cliente
  const handleClienteSelect = (cliente) => {
    setFormData(prev => {
      const newClienteId = cliente.id
      // Se la commessa selezionata non appartiene al nuovo cliente, resettala
      const currentCommessa = commesse.find(c => c.id === prev.commessa_id)
      const shouldResetCommessa = currentCommessa && currentCommessa.cliente_id !== newClienteId
      
      // Se la commessa deve essere resettata, resetta anche il campo di ricerca
      if (shouldResetCommessa) {
        setCommessaSearch('')
      }
      
      return {
        ...prev,
        cliente_id: newClienteId,
        cliente_nome: cliente.denominazione,
        commessa_id: shouldResetCommessa ? '' : prev.commessa_id
      }
    })
    setClienteSearch(cliente.denominazione)
    setPortalAutocomplete(null)
  }

  // Filtra commesse per autocompletamento
  const getFilteredCommesse = (searchTerm) => {
    let filtered = commesse
    
    // Se Ã¨ selezionato un cliente, filtra solo le commesse di quel cliente
    if (formData.cliente_id) {
      const clienteId = typeof formData.cliente_id === 'number' 
        ? formData.cliente_id 
        : parseInt(formData.cliente_id, 10)
      if (!isNaN(clienteId)) {
        filtered = filtered.filter((commessa) => 
          commessa.cliente_id === clienteId
        )
      }
    }
    
    // Se c'Ã¨ un termine di ricerca, filtra anche per quello
    if (searchTerm && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter((commessa) => 
        commessa.titolo?.toLowerCase().includes(searchLower) ||
        commessa.cliente_nome?.toLowerCase().includes(searchLower)
      )
    }
    
    return filtered.slice(0, 10)
  }

  // Apri portal autocompletamento commessa
  const openCommessaAutocompletePortal = (value, target) => {
    if (!target) return
    const items = getFilteredCommesse(value)
    if (items.length === 0 && value.trim() !== '') {
      setPortalCommessaAutocomplete(null)
      return
    }
    const rect = target.getBoundingClientRect()
    setPortalCommessaAutocomplete({
      items,
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      anchorEl: target
    })
  }

  // Gestisci selezione commessa
  const handleCommessaSelect = (commessa) => {
    setFormData(prev => ({
      ...prev,
      commessa_id: commessa.id
    }))
    setCommessaSearch(commessa.titolo)
    setPortalCommessaAutocomplete(null)
    setCommessaAudit([])
    setCommessaAuditError(null)
    setCommessaAuditCommessaId(null)
  }

  const auditFieldLabels = {
    titolo: 'Titolo',
    cliente_nome: 'Cliente',
    stato: 'Stato commessa',
    sotto_stato: 'Fase di lavoro',
    stato_pagamenti: 'Stato pagamenti',
    preventivo: 'Preventivo',
    importo_preventivo: 'Importo preventivo',
    importo_totale: 'Importo totale',
    importo_pagato: 'Importo pagato',
    avanzamento_lavori: 'Avanzamento lavori',
    responsabile: 'Responsabile',
    data_inizio: 'Data inizio',
    data_fine: 'Data fine',
    note: 'Note'
  }

  const auditChangeActions = {
    stato: 'Cambio stato',
    stato_pagamenti: 'Cambio stato pagamenti',
    sotto_stato: 'Cambio fase di lavoro',
    cliente_nome: 'Cambio cliente',
    responsabile: 'Cambio responsabile',
    titolo: 'Modifica titolo',
    importo_preventivo: 'Modifica importo preventivo',
    importo_totale: 'Modifica importo totale',
    importo_pagato: 'Modifica importo pagato',
    avanzamento_lavori: 'Aggiornamento avanzamento lavori',
    preventivo: 'Cambio preventivo',
    data_inizio: 'Cambio data inizio',
    data_fine: 'Cambio data fine',
    note: 'Modifica note'
  }

  const getAuditChangeList = (entry) => {
    if (!entry) return []
    if (Array.isArray(entry.changes)) return entry.changes
    if (entry.changes && Array.isArray(entry.changes.changes)) return entry.changes.changes
    return []
  }

  const formatAuditAction = (entry) => {
    if (!entry) return 'Evento'
    if (entry.action === 'update') {
      const changeList = getAuditChangeList(entry)
      if (!changeList.length) return 'Aggiornamento'
      const details = changeList.map((change) => {
        if (!change?.field) return 'Aggiornamento'
        const label = formatFieldLabel(change.field)
        const from = formatChangeValue(change.from, change.field)
        const to = formatChangeValue(change.to, change.field)
        return `${label}: ${from} -> ${to}`
      })
      return details.join('; ')
    }
    const mapping = {
      create: 'Creazione',
      update: 'Aggiornamento',
      delete: 'Eliminazione',
      note: 'Nota',
      attachment_uploaded: 'Allegato caricato',
      attachment_deleted: 'Eliminazione allegato'
    }
    if (entry.action === 'attachment_uploaded' || entry.action === 'attachment_deleted') {
      const base = mapping[entry.action] || 'Allegato'
      const name = entry.changes?.original_name
      const version = entry.changes?.version ? ` (v${entry.changes.version})` : ''
      return name ? `${base}: ${name}${version}` : base
    }
    return mapping[entry.action] || entry.action || 'Evento'
  }

  const formatFieldLabel = (field) => {
    if (!field) return 'Campo'
    return auditFieldLabels[field] || String(field).replace(/_/g, ' ')
  }

  const formatChangeValue = (value, field) => {
    if (value == null || value === '') return '-'
    if (field === 'preventivo') {
      return Number(value) === 1 ? 'SÃ¬' : 'No'
    }
    if (typeof value === 'boolean') return value ? 'SÃ¬' : 'No'
    return String(value)
  }

  const formatAuditDate = (value) => {
    if (!value) return ''
    if (typeof value === 'string') {
      const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch
        return `${day}/${month}/${year}`
      }
      const dateTimeMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
      if (dateTimeMatch) {
        const [, year, month, day, hours, minutes, seconds] = dateTimeMatch
        const timePart = seconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`
        return `${day}/${month}/${year} ${timePart}`
      }
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('it-IT')
  }

  const formatAuditUser = (entry) => {
    const user = entry?.user
    const fullName = [user?.nome, user?.cognome].filter(Boolean).join(' ').trim()
    return fullName || user?.username || (entry?.user_id ? `Utente #${entry.user_id}` : 'Sistema')
  }

  const loadCommessaAudit = async (commessaId) => {
    if (!commessaId) return
    setCommessaAuditLoading(true)
    setCommessaAuditError(null)
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['commessa-audit', commessaId],
        queryFn: () => api.getCommessaAudit(commessaId),
        staleTime: 30 * 1000
      })
      setCommessaAudit(Array.isArray(data) ? data : [])
      setCommessaAuditCommessaId(String(commessaId))
    } catch (err) {
      console.error('Errore caricamento cronologia commessa:', err)
      setCommessaAuditError('Errore nel caricamento della cronologia commessa')
    } finally {
      setCommessaAuditLoading(false)
    }
  }

  const handleAddAuditNote = async () => {
    if (!formData.commessa_id) return
    const note = auditNoteText.trim()
    if (!note) {
      setCommessaAuditError('Inserisci una nota prima di salvare.')
      return
    }

    try {
      setAuditNoteSaving(true)
      setCommessaAuditError(null)
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Aggiungi nota')
      await api.addCommessaAuditNote(formData.commessa_id, {
        data: auditNoteDate || null,
        note
      })
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Nota aggiunta alla cronologia', duration: 3000 })
      } else {
        toast?.showSuccess('Nota aggiunta alla cronologia')
      }
      setAuditNoteText('')
      setAuditNoteDate(getTodayDate())
      await loadCommessaAudit(formData.commessa_id)
    } catch (err) {
      console.error('Errore aggiunta nota commessa:', err)
      const errorMsg = err.message || 'Errore nel salvataggio della nota.'
      setCommessaAuditError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setAuditNoteSaving(false)
    }
  }

  const loadScadenze = async () => {
    if (!card?.id) return
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['kanban-scadenze', card.id],
        queryFn: () => api.getKanbanScadenze(card.id),
        staleTime: 30 * 1000
      })
      setScadenze(data)
    } catch (err) {
      console.error('Errore caricamento scadenze:', err)
    }
  }

  useKanbanCardDetailEffects({
    card,
    colonne,
    commesse,
    formData,
    parseDateTime,
    setFormData,
    setTimeStart,
    setTimeEnd,
    setAllDay,
    setNoDeadline,
    setClienteSearch,
    setCommessaSearch,
    setScadenze,
    setCommessaAudit,
    setCommessaAuditError,
    setCommessaAuditCommessaId,
    setShowCommessaAudit,
    setAuditNoteDate,
    setAuditNoteText,
    setAuditNoteSaving,
    getTodayDate,
    loadScadenze,
    setPortalAutocomplete,
    setPortalCommessaAutocomplete,
    portalAutocomplete,
    portalCommessaAutocomplete,
    showCommessaAudit,
    commessaAuditCommessaId,
    loadCommessaAudit
  })

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (!formData.titolo || !formData.titolo.trim()) {
      setError('Titolo obbligatorio')
      return
    }
    if (!formData.colonna_id) {
      setError('Colonna obbligatoria')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Salvataggio card')
      
      const cardData = buildCardPayload()

      console.log('Salvataggio card con dati:', cardData)

      if (card?.id) {
        await onSave({ ...cardData, id: card.id })
        // Aggiorna il toast IMMEDIATAMENTE dopo il salvataggio riuscito
        // Non aspettare, mostra subito il toast
        if (loadingToastId) {
          toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Card aggiornata con successo', duration: 3000 })
        } else {
          toast?.showSuccess('Card aggiornata con successo')
        }
        // Delay piÃ¹ lungo per permettere al toast di essere visibile prima di chiudere la modal
        // Il toast ha durata di 3000ms, aspettiamo almeno 800ms per essere sicuri che sia visibile
        await new Promise(resolve => setTimeout(resolve, 800))
        // Chiudi la modal dopo il salvataggio riuscito
        onClose()
      } else {
        const created = await api.createKanbanCard(cardData)
        await onRefresh()
        // Aggiorna il toast subito dopo la creazione riuscita
        if (loadingToastId) {
          toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Card creata con successo', duration: 3000 })
        } else {
          toast?.showSuccess('Card creata con successo')
        }
        // Piccolo delay per permettere al toast di essere visibile prima di chiudere la modal
        await new Promise(resolve => setTimeout(resolve, 300))
        onClose()
      }
    } catch (err) {
      console.error('Errore salvataggio card:', err)
      console.error('Dettagli errore:', err.details)
      console.error('Dati inviati:', cardData)
      // Gestione errori piÃ¹ dettagliata
      let errorMsg = 'Errore nel salvataggio: ' + (err.message || 'Errore sconosciuto')
      if (err.status === 400) {
        errorMsg = err.message || 'Errore di validazione. Verifica i dati inseriti.'
        if (err.details && Array.isArray(err.details)) {
          console.error('Errori di validazione:', err.details)
          errorMsg = err.details.map(d => d.message || `${d.field}: ${d.message}`).join('. ')
        }
      } else if (err.status === 401) {
        errorMsg = 'Sessione scaduta. Ricarica la pagina e riprova.'
      }
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteCard = async () => {
    if (!card?.id) return
    if (card.data_fine_effettiva) return
    try {
      setLoading(true)
      const loadingToastId = toast?.showLoading('Completamento in corso...', 'Completa card')
      const payload = {
        ...buildCardPayload(),
        data_fine_effettiva: getTodayDate(),
        avanzamento: 100
      }
      await onSave({ ...payload, id: card.id })
      if (formData.recurrence_enabled) {
        const typeToMonths = {
          mensile: 1,
          trimestrale: 3,
          semestrale: 6,
          annuale: 12
        }
        const monthsToAdd = typeToMonths[formData.recurrence_type] || 1
        const baseDate = payload.data_fine_prevista || payload.data_inizio || getTodayDate()
        const nextFine = addMonthsToDateTime(baseDate, monthsToAdd)
        const nextInizio = payload.data_inizio
          ? addMonthsToDateTime(payload.data_inizio, monthsToAdd)
          : ''
        const nextCard = {
          ...payload,
          data_inizio: nextInizio,
          data_fine_prevista: nextFine,
          data_fine_effettiva: null,
          avanzamento: 0
        }
        await api.createKanbanCard(nextCard)
        await onRefresh()
      }
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Card completata', duration: 3000 })
      } else {
        toast?.showSuccess('Card completata')
      }
    } catch (err) {
      console.error('Errore completamento card:', err)
      const errorMsg = err.message || 'Errore completamento card'
      toast?.showError(errorMsg, 'Errore completamento')
    } finally {
      setLoading(false)
    }
  }

  const handleScadenzaSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation() // Ferma la propagazione al form principale
    
    // Validazione client-side completa
    const errors = []
    
    if (!scadenzaForm.titolo || !scadenzaForm.titolo.trim()) {
      errors.push('Il titolo Ã¨ obbligatorio')
    } else if (scadenzaForm.titolo.trim().length > 255) {
      errors.push('Il titolo Ã¨ troppo lungo (max 255 caratteri)')
    }
    
    if (!scadenzaForm.data_scadenza) {
      errors.push('La data scadenza Ã¨ obbligatoria')
    } else {
      // Valida formato data
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(scadenzaForm.data_scadenza)) {
        errors.push('Formato data non valido (atteso: YYYY-MM-DD)')
      } else {
        // Verifica che la data sia valida
        const date = new Date(scadenzaForm.data_scadenza)
        if (isNaN(date.getTime())) {
          errors.push('Data non valida')
        }
      }
    }
    
    if (scadenzaForm.descrizione && scadenzaForm.descrizione.length > 1000) {
      errors.push('La descrizione Ã¨ troppo lunga (max 1000 caratteri)')
    }
    
    if (scadenzaForm.tipo && scadenzaForm.tipo.length > 50) {
      errors.push('Il tipo Ã¨ troppo lungo (max 50 caratteri)')
    }
    
    if (scadenzaForm.priorita && !['bassa', 'media', 'alta', 'urgente'].includes(scadenzaForm.priorita)) {
      errors.push('PrioritÃ  non valida')
    }
    
    if (errors.length > 0) {
      setError(errors.join('. '))
      return
    }

    if (!card?.id) {
      setError('Salva prima la card per aggiungere scadenze')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Prepara i dati assicurandosi che siano nel formato corretto
      const scadenzaData = {
        titolo: scadenzaForm.titolo.trim(),
        data_scadenza: scadenzaForm.data_scadenza, // Formato YYYY-MM-DD (ISO8601 date)
        priorita: scadenzaForm.priorita || 'media'
      }
      
      // Aggiungi campi opzionali solo se hanno un valore
      if (scadenzaForm.descrizione && scadenzaForm.descrizione.trim()) {
        scadenzaData.descrizione = scadenzaForm.descrizione.trim()
      }
      
      if (scadenzaForm.tipo && scadenzaForm.tipo.trim()) {
        scadenzaData.tipo = scadenzaForm.tipo.trim()
      }
      
      const created = await api.createKanbanScadenza(card.id, scadenzaData)
      console.log('Scadenza creata con successo:', created)
      
      // Ricarica scadenze prima di chiudere il form
      await loadScadenze()
      
      // Reset form
      setScadenzaForm({
        titolo: '',
        descrizione: '',
        data_scadenza: '',
        tipo: '',
        priorita: 'media'
      })
      setShowScadenzaForm(false)
      setError(null) // Pulisci eventuali errori precedenti
    } catch (err) {
      console.error('Errore creazione scadenza:', err)
      // Gestione errori piÃ¹ dettagliata
      if (err.status === 400) {
        // Errore di validazione - mostra dettagli se disponibili
        let errorMsg = err.message || 'Errore di validazione. Verifica i dati inseriti.'
        // Se ci sono dettagli di validazione, usali
        if (err.details && Array.isArray(err.details)) {
          errorMsg = err.details.map(d => d.message || `${d.field}: ${d.message}`).join('. ')
        }
        setError(errorMsg)
      } else if (err.status === 401) {
        // Errore di autenticazione - non dovrebbe succedere se il token Ã¨ valido
        // NON reindirizzare automaticamente, mostra solo errore
        setError('Sessione scaduta. Ricarica la pagina e riprova.')
      } else {
        setError('Errore nella creazione della scadenza: ' + (err.message || 'Errore sconosciuto'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteScadenza = async (scadenza) => {
    try {
      await api.completeKanbanScadenza(scadenza.id, scadenza.row_version)
      await loadScadenze()
    } catch (err) {
      console.error('Errore completamento scadenza:', err)
      setError('Errore nel completamento della scadenza')
    }
  }

  const handleDeleteScadenza = (scadenzaId) => {
    setDeleteScadenzaId(scadenzaId)
  }

  const confirmDeleteScadenza = async () => {
    if (!deleteScadenzaId) return
    try {
      setDeleteScadenzaLoading(true)
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Eliminazione scadenza')
      await api.deleteKanbanScadenza(deleteScadenzaId)
      await loadScadenze()
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Scadenza eliminata con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Scadenza eliminata con successo')
      }
    } catch (err) {
      console.error('Errore eliminazione scadenza:', err)
      const errorMsg = 'Errore nell\'eliminazione della scadenza'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    } finally {
      setDeleteScadenzaLoading(false)
      setDeleteScadenzaId(null)
    }
  }

  return (
    <div
      className="modal kanban-card-detail-modal"
      style={{
        display: 'block',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(11, 18, 32, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1050,
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        className="modal-dialog modal-lg"
        style={{
          margin: '2rem auto',
          maxWidth: '800px',
          animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="modal-content"
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-soft)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            background: 'var(--bg-1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 4rem)'
          }}
        >
          <div 
            className="modal-header"
            style={{
              background: 'linear-gradient(135deg, var(--bg-2) 0%, var(--bg-1) 100%)',
              borderBottom: '1px solid var(--border-soft)',
              padding: '1.25rem 1.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h5
                className="modal-title"
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  color: 'var(--ink-800)'
                }}
              >
                {card ? 'Modifica Card' : 'Nuova Card'}
              </h5>
              {card?.data_fine_effettiva && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#0f766e',
                    background: '#ccfbf1',
                    border: '1px solid #99f6e4',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '999px'
                  }}
                >
                  Completata
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
              style={{
                transition: 'all 0.2s ease',
                opacity: 0.6
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.transform = 'rotate(90deg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.6'
                e.currentTarget.style.transform = 'rotate(0deg)'
              }}
            />
          </div>
          <div className="modal-body kanban-card-detail-body">
            {error && (
              <div className="alert alert-warning mb-3">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label">Titolo *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.titolo}
                    onChange={(e) => setFormData({ ...formData, titolo: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Colonna *</label>
                  <select
                    className="form-select"
                    value={formData.colonna_id}
                    onChange={(e) => setFormData({ ...formData, colonna_id: e.target.value })}
                    required
                  >
                    <option value="">Seleziona colonna</option>
                    {colonne.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-12">
                  <label className="form-label">Descrizione</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formData.descrizione}
                    onChange={(e) => setFormData({ ...formData, descrizione: e.target.value })}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">PrioritÃ </label>
                  <select
                    className="form-select"
                    value={formData.priorita}
                    onChange={(e) => setFormData({ ...formData, priorita: e.target.value })}
                    style={{
                      color: formData.priorita === 'urgente' ? '#ef4444' : 
                             formData.priorita === 'alta' ? '#f59e0b' :
                             formData.priorita === 'media' ? '#3b82f6' :
                             formData.priorita === 'bassa' ? '#10b981' : 'inherit',
                      fontWeight: formData.priorita === 'urgente' ? 600 : 'normal'
                    }}
                  >
                    <option value="bassa" style={{ color: '#10b981', backgroundColor: 'var(--bg-1)' }}>Bassa</option>
                    <option value="media" style={{ color: '#3b82f6', backgroundColor: 'var(--bg-1)' }}>Media</option>
                    <option value="alta" style={{ color: '#f59e0b', backgroundColor: 'var(--bg-1)' }}>Alta</option>
                    <option value="urgente" style={{ color: '#ef4444', backgroundColor: 'var(--bg-1)' }}>Urgente</option>
                  </select>
                </div>
                <div className="col-12">
                  <div className={`kanban-date-panel ${noDeadline ? 'is-no-deadline' : ''}`}>
                    <div className="kanban-date-header">
                      <div className="kanban-date-header-text">
                        <div className="kanban-date-title">Date e orari</div>
                        <div className="kanban-date-subtitle">Definisci inizio, scadenza e orari della card.</div>
                      </div>
                      <div className="kanban-date-actions">
                        <label className="form-check form-switch kanban-date-toggle">
                          <input
                            id="kanban-no-deadline"
                            type="checkbox"
                            className="form-check-input"
                            checked={noDeadline}
                            onChange={(e) => {
                              const next = e.target.checked
                              setNoDeadline(next)
                              if (next) {
                                setFormData((prev) => ({ ...prev, data_fine_prevista: '' }))
                                setTimeEnd('')
                              }
                            }}
                          />
                          <span className="form-check-label">Senza scadenza</span>
                        </label>
                        <label className="form-check form-switch kanban-date-toggle">
                          <input
                            id="kanban-all-day"
                            type="checkbox"
                            className="form-check-input"
                            checked={allDay}
                            onChange={(e) => {
                              const next = e.target.checked
                              setAllDay(next)
                              if (next) {
                                setTimeStart('')
                                setTimeEnd('')
                              }
                            }}
                          />
                          <span className="form-check-label">Senza orario</span>
                        </label>
                      </div>
                    </div>
                    <div className="row g-3 kanban-date-grid">
                      <div className="col-md-4">
                        <label className="form-label">Data Inizio</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.data_inizio}
                          onChange={(e) => setFormData({ ...formData, data_inizio: e.target.value })}
                          disabled={noDeadline}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Data Fine Prevista</label>
                        {noDeadline ? (
                          <div className="form-control kanban-date-placeholder" aria-disabled="true">
                            Nessuna scadenza
                          </div>
                        ) : (
                          <input
                            type="date"
                            className="form-control"
                            value={formData.data_fine_prevista}
                            onChange={(e) => setFormData({ ...formData, data_fine_prevista: e.target.value })}
                          />
                        )}
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Ora Inizio</label>
                        <input
                          type="time"
                          className="form-control"
                          value={timeStart}
                          onChange={(e) => setTimeStart(e.target.value)}
                          disabled={allDay}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Ora Fine</label>
                        <input
                          type="time"
                          className="form-control"
                          value={timeEnd}
                          onChange={(e) => setTimeEnd(e.target.value)}
                          disabled={allDay}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <div className={`kanban-plan-panel ${formData.recurrence_enabled ? 'is-recurring' : ''}`}>
                    <div className="kanban-plan-header">
                      <div className="kanban-plan-title">Pianificazione</div>
                      <label className="form-check form-switch kanban-plan-toggle">
                        <input
                          id="kanban-recurring"
                          type="checkbox"
                          className="form-check-input"
                          checked={!!formData.recurrence_enabled}
                          onChange={(e) => {
                            const next = e.target.checked
                            setFormData((prev) => ({
                              ...prev,
                              recurrence_enabled: next
                            }))
                          }}
                        />
                        <span className="form-check-label">Ricorrente</span>
                      </label>
                    </div>
                    <div className="row g-3 kanban-plan-grid">
                      <div className="col-md-4">
                        <label className="form-label">Frequenza</label>
                        <select
                          className="form-select"
                          value={formData.recurrence_type}
                          onChange={(e) => setFormData((prev) => ({ ...prev, recurrence_type: e.target.value }))}
                          disabled={!formData.recurrence_enabled}
                        >
                          <option value="mensile">Mensile</option>
                          <option value="trimestrale">Trimestrale</option>
                          <option value="semestrale">Semestrale</option>
                          <option value="annuale">Annuale</option>
                        </select>
                      </div>
                      <div className="col-md-8">
                        <div className="kanban-plan-hint">
                          La pianificazione usa la Data Fine Prevista; se assente, la Data Inizio.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Cliente</label>
                  <div className="autocomplete-container" style={{ position: 'relative' }} ref={autocompleteRef}>
                    <input
                      type="text"
                      className="form-control"
                      value={clienteSearch}
                      onChange={(e) => {
                        const value = e.target.value
                        setClienteSearch(value)
                        openAutocompletePortal(value, e.target)
                        // Se il valore viene cancellato, resetta anche cliente_id
                        if (value.trim() === '') {
                          setFormData(prev => ({
                            ...prev,
                            cliente_id: '',
                            cliente_nome: ''
                          }))
                        }
                      }}
                      onFocus={(e) => {
                        openAutocompletePortal(clienteSearch || formData.cliente_nome, e.target)
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setPortalAutocomplete(null)
                        }, 200)
                      }}
                      placeholder="Cerca cliente..."
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Commessa</label>
                  <div className="autocomplete-container" style={{ position: 'relative' }} ref={commessaAutocompleteRef}>
                    <input
                      type="text"
                      className="form-control"
                      value={commessaSearch}
                      onChange={(e) => {
                        const value = e.target.value
                        setCommessaSearch(value)
                        openCommessaAutocompletePortal(value, e.target)
                        // Se il valore viene cancellato, resetta anche commessa_id
                        if (value.trim() === '') {
                          setFormData(prev => ({
                            ...prev,
                            commessa_id: ''
                          }))
                        }
                      }}
                      onFocus={(e) => {
                        const currentCommessa = commesse.find(c => c.id === formData.commessa_id)
                        openCommessaAutocompletePortal(commessaSearch || currentCommessa?.titolo || '', e.target)
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setPortalCommessaAutocomplete(null)
                        }, 200)
                      }}
                      placeholder="Cerca commessa..."
                    />
                  </div>
                </div>
              </div>
            </form>

            {card?.id && (
              <div className="mt-4" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: '1.5rem' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 style={{ margin: 0 }}>Scadenze</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowScadenzaForm(true)
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Aggiungi Scadenza
                    </button>
                  </div>

                  {showScadenzaForm && (
                    <div className="card mb-3">
                      <div className="card-body">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleScadenzaSubmit(e)
                            return false
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                              e.preventDefault()
                              e.stopPropagation()
                            }
                          }}
                          style={{ position: 'relative', zIndex: 10 }}
                          noValidate
                        >
                          <div className="row g-2">
                            <div className="col-md-4">
                              <label className="form-label" style={{ fontSize: '0.85rem' }}>Titolo *</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={scadenzaForm.titolo}
                                onChange={(e) => setScadenzaForm({ ...scadenzaForm, titolo: e.target.value })}
                                required
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label" style={{ fontSize: '0.85rem' }}>Data Scadenza *</label>
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={scadenzaForm.data_scadenza}
                                onChange={(e) => setScadenzaForm({ ...scadenzaForm, data_scadenza: e.target.value })}
                                required
                              />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label" style={{ fontSize: '0.85rem' }}>Tipo</label>
                              <select
                                className="form-select form-select-sm"
                                value={scadenzaForm.tipo}
                                onChange={(e) => setScadenzaForm({ ...scadenzaForm, tipo: e.target.value })}
                              >
                                <option value="">Tipo</option>
                                <option value="pratica">Pratica</option>
                                <option value="amministrativa">Amministrativa</option>
                                <option value="cantiere">Cantiere</option>
                                <option value="documento">Documento</option>
                                <option value="altro">Altro</option>
                              </select>
                            </div>
                            <div className="col-md-2">
                              <label className="form-label" style={{ fontSize: '0.85rem' }}>PrioritÃ </label>
                              <select
                                className="form-select form-select-sm"
                                value={scadenzaForm.priorita}
                                onChange={(e) => setScadenzaForm({ ...scadenzaForm, priorita: e.target.value })}
                                style={{
                                  color: scadenzaForm.priorita === 'urgente' ? '#ef4444' : 
                                         scadenzaForm.priorita === 'alta' ? '#f59e0b' :
                                         scadenzaForm.priorita === 'media' ? '#3b82f6' :
                                         scadenzaForm.priorita === 'bassa' ? '#10b981' : 'inherit',
                                  fontWeight: scadenzaForm.priorita === 'urgente' ? 600 : 'normal'
                                }}
                              >
                                <option value="bassa" style={{ color: '#10b981', backgroundColor: 'var(--bg-1)' }}>Bassa</option>
                                <option value="media" style={{ color: '#3b82f6', backgroundColor: 'var(--bg-1)' }}>Media</option>
                                <option value="alta" style={{ color: '#f59e0b', backgroundColor: 'var(--bg-1)' }}>Alta</option>
                                <option value="urgente" style={{ color: '#ef4444', backgroundColor: 'var(--bg-1)' }}>Urgente</option>
                              </select>
                            </div>
                            <div className="col-md-12">
                              <label className="form-label" style={{ fontSize: '0.85rem' }}>Descrizione</label>
                              <textarea
                                className="form-control form-control-sm"
                                rows="2"
                                value={scadenzaForm.descrizione}
                                onChange={(e) => setScadenzaForm({ ...scadenzaForm, descrizione: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="mt-2 d-flex gap-2">
                            <button 
                              type="submit" 
                              className="btn btn-sm btn-primary" 
                              disabled={loading}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Salva
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowScadenzaForm(false)
                                setScadenzaForm({
                                  titolo: '',
                                  descrizione: '',
                                  data_scadenza: '',
                                  tipo: '',
                                  priorita: 'media'
                                })
                              }}
                            >
                              Annulla
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {scadenze.length === 0 ? (
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      Nessuna scadenza presente
                    </div>
                  ) : (
                    <div className="scadenze-list">
                      {scadenze.map((scadenza) => {
                        const scadenzaDate = new Date(scadenza.data_scadenza)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const isScaduta = scadenzaDate < today
                        const isProssima = scadenzaDate >= today && scadenzaDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

                        return (
                          <div
                            key={scadenza.id}
                            className="card mb-2"
                            style={{
                              background: scadenza.completata ? 'var(--bg-3)' : 'var(--bg-2)',
                              opacity: scadenza.completata ? 0.7 : 1,
                              border: isScaduta && !scadenza.completata ? '2px solid #ef4444' : '1px solid var(--border-soft)'
                            }}
                          >
                            <div className="card-body" style={{ padding: '0.75rem' }}>
                              <div className="d-flex justify-content-between align-items-start">
                                <div style={{ flex: 1 }}>
                                  <div className="d-flex align-items-center gap-2 mb-1">
                                    <h6 style={{ margin: 0, fontSize: '0.9rem', textDecoration: scadenza.completata ? 'line-through' : 'none' }}>
                                      {scadenza.titolo}
                                    </h6>
                                    {scadenza.tipo && (
                                      <span style={{
                                        fontSize: '0.7rem',
                                        padding: '0.15rem 0.4rem',
                                        background: 'var(--bg-3)',
                                        borderRadius: '4px',
                                        color: 'var(--ink-600)'
                                      }}>
                                        {scadenza.tipo}
                                      </span>
                                    )}
                                  </div>
                                  {scadenza.descrizione && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--ink-600)', margin: '0.25rem 0' }}>
                                      {scadenza.descrizione}
                                    </p>
                                  )}
                                  <div style={{ fontSize: '0.8rem', color: isScaduta && !scadenza.completata ? '#ef4444' : (isProssima ? '#f59e0b' : 'var(--ink-600)'), display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <strong>Scadenza:</strong> {new Date(scadenza.data_scadenza).toLocaleDateString('it-IT')}
                                    {isScaduta && !scadenza.completata && (
                                      <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                          <line x1="12" y1="9" x2="12" y2="13" />
                                          <line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                        <span>SCADUTA</span>
                                      </>
                                    )}
                                    {isProssima && !scadenza.completata && (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                <div className="d-flex gap-1">
                                  {!scadenza.completata && (
                                    <button
                                      className="btn btn-sm btn-success"
                                      onClick={() => handleCompleteScadenza(scadenza)}
                                      title="Completa"
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem 0.5rem' }}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDeleteScadenza(scadenza.id)}
                                    title="Elimina"
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem 0.5rem' }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

            {card?.id && (
              <KanbanComments
                cardId={card.id}
                currentUser={currentUser}
                onCommentAdded={() => {
                  if (onRefresh) onRefresh()
                }}
                toast={toast}
              />
            )}

            <div className="actions-sticky mt-4 d-flex gap-2">
              <button 
                type="button" 
                className="btn btn-primary" 
                disabled={loading}
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  // Chiama direttamente handleSubmit
                  await handleSubmit(e)
                }}
              >
                {loading ? 'Salvataggio...' : (card ? 'Salva Modifiche' : 'Crea Card')}
              </button>
              {card && (
                <button
                  type="button"
                  className="btn btn-outline-success"
                  disabled={loading || Boolean(card.data_fine_effettiva)}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleCompleteCard()
                  }}
                >
                  {card.data_fine_effettiva ? 'Completata' : 'Segna completata'}
                </button>
              )}
              {card && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (onDelete) {
                      await onDelete(card.id)
                    }
                  }}
                >
                  Elimina
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Portal autocompletamento cliente */}
      {portalAutocomplete && (
        <div
          className="autocomplete-list autocomplete-portal"
          style={{
            position: 'fixed',
            top: `${portalAutocomplete.top}px`,
            left: `${portalAutocomplete.left}px`,
            width: `${portalAutocomplete.width}px`,
            zIndex: 1060,
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {portalAutocomplete.items.map((cliente, idx) => (
            <div
              key={cliente.id}
              className="autocomplete-item"
              onClick={() => handleClienteSelect(cliente)}
              onMouseDown={(e) => e.preventDefault()}
            >
              {cliente.denominazione}
            </div>
          ))}
        </div>
      )}

      {/* Portal autocompletamento commessa */}
      {portalCommessaAutocomplete && (
        <div
          className="autocomplete-list autocomplete-portal"
          style={{
            position: 'fixed',
            top: `${portalCommessaAutocomplete.top}px`,
            left: `${portalCommessaAutocomplete.left}px`,
            width: `${portalCommessaAutocomplete.width}px`,
            zIndex: 1060,
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {portalCommessaAutocomplete.items.map((commessa, idx) => (
            <div
              key={commessa.id}
              className="autocomplete-item"
              onClick={() => handleCommessaSelect(commessa)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div>
                <strong>{commessa.titolo}</strong>
                {commessa.cliente_nome && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--ink-600)', marginTop: '0.25rem' }}>
                    {commessa.cliente_nome}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        show={Boolean(deleteScadenzaId)}
        title="Elimina scadenza"
        message="Sei sicuro di voler eliminare questa scadenza?"
        loading={deleteScadenzaLoading}
        onClose={() => {
          if (!deleteScadenzaLoading) setDeleteScadenzaId(null)
        }}
        onConfirm={confirmDeleteScadenza}
      />
    </div>
  )
}

export default KanbanCardDetail

