import { useEffect } from 'react'

function useKanbanCardDetailEffects({
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
}) {
  useEffect(() => {
    if (card) {
      const start = parseDateTime(card.data_inizio)
      const end = parseDateTime(card.data_fine_prevista)
      setFormData({
        titolo: card.titolo || '',
        descrizione: card.descrizione || '',
        colonna_id: card.colonna_id || '',
        priorita: card.priorita || 'media',
        cliente_id: card.cliente_id || '',
        cliente_nome: card.cliente_nome || '',
        commessa_id: card.commessa_id || '',
        data_inizio: start.date,
        data_fine_prevista: end.date,
        tags: card.tags ? (typeof card.tags === 'string' ? JSON.parse(card.tags) : card.tags) : [],
        recurrence_enabled: !!card.recurrence_enabled,
        recurrence_type: card.recurrence_type || 'mensile'
      })
      setTimeStart(start.time)
      setTimeEnd(end.time)
      setAllDay(!start.time && !end.time)
      setNoDeadline(!end.date)
      setClienteSearch(card.cliente_nome || '')
      // Imposta commessa search se esiste commessa_id
      if (card.commessa_id) {
        const commessa = commesse.find(c => c.id === card.commessa_id)
        setCommessaSearch(commessa?.titolo || '')
      } else {
        setCommessaSearch('')
      }
      setCommessaAudit([])
      setCommessaAuditError(null)
      setCommessaAuditCommessaId(null)
      setShowCommessaAudit(false)
      setAuditNoteDate(getTodayDate())
      setAuditNoteText('')
      setAuditNoteSaving(false)
      loadScadenze()
    } else {
      // Nuova card - imposta colonna predefinita (In Attesa)
      const backlogColonna = colonne.find(c => c.nome === 'In Attesa')
      setFormData({
        titolo: '',
        descrizione: '',
        colonna_id: backlogColonna?.id || '',
        priorita: 'media',
        cliente_id: '',
        cliente_nome: '',
        commessa_id: '',
        data_inizio: '',
        data_fine_prevista: '',
        tags: [],
        recurrence_enabled: false,
        recurrence_type: 'mensile'
      })
      setAllDay(false)
      setTimeStart('')
      setTimeEnd('')
      setNoDeadline(false)
      setClienteSearch('')
      setCommessaSearch('')
      setScadenze([])
      setCommessaAudit([])
      setCommessaAuditError(null)
      setCommessaAuditCommessaId(null)
      setShowCommessaAudit(false)
      setAuditNoteDate(getTodayDate())
      setAuditNoteText('')
      setAuditNoteSaving(false)
    }
  }, [card, colonne])

  // Gestione click outside per autocompletamento
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.autocomplete-container') && !e.target.closest('.autocomplete-portal')) {
        setPortalAutocomplete(null)
        setPortalCommessaAutocomplete(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reposizionamento portal autocompletamento cliente
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

    window.addEventListener('scroll', repositionPortal, true)
    window.addEventListener('resize', repositionPortal)
    return () => {
      window.removeEventListener('scroll', repositionPortal, true)
      window.removeEventListener('resize', repositionPortal)
    }
  }, [portalAutocomplete])

  // Reposizionamento portal autocompletamento commessa
  useEffect(() => {
    if (!portalCommessaAutocomplete?.anchorEl) return

    const repositionPortal = () => {
      setPortalCommessaAutocomplete((prev) => {
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

    window.addEventListener('scroll', repositionPortal, true)
    window.addEventListener('resize', repositionPortal)
    return () => {
      window.removeEventListener('scroll', repositionPortal, true)
      window.removeEventListener('resize', repositionPortal)
    }
  }, [portalCommessaAutocomplete])

  useEffect(() => {
    if (!showCommessaAudit) return
    const commessaId = formData.commessa_id
    if (!commessaId) {
      setCommessaAudit([])
      setCommessaAuditError(null)
      setCommessaAuditCommessaId(null)
      return
    }
    if (commessaAuditCommessaId === String(commessaId)) return
    loadCommessaAudit(commessaId)
  }, [showCommessaAudit, formData.commessa_id, commessaAuditCommessaId])
}

export default useKanbanCardDetailEffects
