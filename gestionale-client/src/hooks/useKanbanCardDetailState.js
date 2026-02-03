import { useCallback, useReducer, useRef, useState } from 'react'

function useKanbanCardDetailState({ getTodayDate }) {
  const formReducer = (state, action) => {
    switch (action.type) {
      case 'set':
        return typeof action.payload === 'function' ? action.payload(state) : action.payload
      case 'patch':
        return { ...state, ...action.payload }
      case 'reset':
        return action.payload
      default:
        return state
    }
  }
  const [formData, dispatchForm] = useReducer(formReducer, {
    titolo: '',
    descrizione: '',
    colonna_id: '',
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
  const setFormData = useCallback((next) => {
    dispatchForm({ type: 'set', payload: next })
  }, [])
  const [allDay, setAllDay] = useState(true)
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [noDeadline, setNoDeadline] = useState(false)
  const [scadenze, setScadenze] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showScadenzaForm, setShowScadenzaForm] = useState(false)
  const [clienteSearch, setClienteSearch] = useState('')
  const [portalAutocomplete, setPortalAutocomplete] = useState(null)
  const autocompleteRef = useRef(null)
  const [commessaSearch, setCommessaSearch] = useState('')
  const [portalCommessaAutocomplete, setPortalCommessaAutocomplete] = useState(null)
  const commessaAutocompleteRef = useRef(null)
  const [commessaAudit, setCommessaAudit] = useState([])
  const [commessaAuditLoading, setCommessaAuditLoading] = useState(false)
  const [commessaAuditError, setCommessaAuditError] = useState(null)
  const [commessaAuditCommessaId, setCommessaAuditCommessaId] = useState(null)
  const [showCommessaAudit, setShowCommessaAudit] = useState(false)
  const [auditNoteDate, setAuditNoteDate] = useState(() => getTodayDate())
  const [auditNoteText, setAuditNoteText] = useState('')
  const [auditNoteSaving, setAuditNoteSaving] = useState(false)
  const [scadenzaForm, setScadenzaForm] = useState({
    titolo: '',
    descrizione: '',
    data_scadenza: '',
    tipo: '',
    priorita: 'media'
  })
  const [deleteScadenzaId, setDeleteScadenzaId] = useState(null)
  const [deleteScadenzaLoading, setDeleteScadenzaLoading] = useState(false)

  return {
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
  }
}

export default useKanbanCardDetailState
