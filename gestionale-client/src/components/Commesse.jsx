import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'

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

const createEmptyForm = () => ({
  titolo: '',
  cliente_id: '',
  cliente_nome: '',
  stato: 'In corso',
  sotto_stato: [],
  sotto_stato_custom: '',
  stato_pagamenti: 'Non iniziato',
  preventivo: false,
  importo_preventivo: '',
  importo_totale: '',
  importo_pagato: '',
  avanzamento_lavori: 0,
  responsabile: '',
  data_inizio: '',
  data_fine: '',
  note: '',
  allegati: ''
})

const getTodayDate = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function Commesse({ clienti, toast }) {
  const [commesse, setCommesse] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ clienteId: '', stato: '', sottoStato: '', statoPagamenti: '' })
  const [yearFilter, setYearFilter] = useState('')
  const [clienteFilterInput, setClienteFilterInput] = useState('')
  const [showClienteFilterAutocomplete, setShowClienteFilterAutocomplete] = useState(false)
  const [clienteFormInput, setClienteFormInput] = useState('')
  const [showClienteFormAutocomplete, setShowClienteFormAutocomplete] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState('essenziali')
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(createEmptyForm())
  const [initialFormData, setInitialFormData] = useState(createEmptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null })
  const [deleting, setDeleting] = useState(false)
  const [allegatiByCommessa, setAllegatiByCommessa] = useState({})
  const [initialAllegati, setInitialAllegati] = useState([])
  const [uploading, setUploading] = useState({})
  const [allegatiError, setAllegatiError] = useState(null)
  const [selectedCommessaId, setSelectedCommessaId] = useState('')
  const [utenti, setUtenti] = useState([])
  const [commessaAudit, setCommessaAudit] = useState([])
  const [commessaAuditLoading, setCommessaAuditLoading] = useState(false)
  const [commessaAuditError, setCommessaAuditError] = useState(null)
  const [commessaAuditCommessaId, setCommessaAuditCommessaId] = useState(null)
  const [showCommessaAudit, setShowCommessaAudit] = useState(false)
  const [auditNoteDate, setAuditNoteDate] = useState(() => getTodayDate())
  const [auditNoteText, setAuditNoteText] = useState('')
  const [auditNoteSaving, setAuditNoteSaving] = useState(false)
  const [showConsuntivo, setShowConsuntivo] = useState(false)
  const [consuntivoIds, setConsuntivoIds] = useState([])
  const [consuntivoSconto, setConsuntivoSconto] = useState('')

  const loadCommesse = async (nextFilters = filters) => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getCommesse(nextFilters)
      setCommesse(data)
    } catch (err) {
      console.error('Errore caricamento commesse:', err)
      setError('Errore nel caricamento delle commesse. Verifica che il server sia avviato.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCommesse()
  }, [])

  useEffect(() => {
    loadCommesse(filters)
  }, [filters])

  useEffect(() => {
    const loadUtenti = async () => {
      try {
        const data = await api.getUtenti()
        setUtenti(data || [])
      } catch (err) {
        console.warn('Impossibile caricare utenti per responsabile:', err)
        setUtenti([])
      }
    }
    loadUtenti()
  }, [])

  useEffect(() => {
    if (formData.stato === 'Conclusa' && formData.sotto_stato.length) {
      setFormData((prev) => ({ ...prev, sotto_stato: [], sotto_stato_custom: '' }))
    }
  }, [formData.stato, formData.sotto_stato])

  useEffect(() => {
    if (commesse.length === 0) {
      setAllegatiByCommessa({})
      return
    }

    const loadAll = async () => {
      try {
        const results = await Promise.all(
          commesse.map(async (commessa) => {
            const allegati = await api.getCommessaAllegati(commessa.id)
            return [commessa.id, allegati]
          })
        )
        const next = {}
        results.forEach(([id, allegati]) => {
          next[id] = allegati
        })
        setAllegatiByCommessa(next)
        
      } catch (err) {
        console.error('Errore caricamento allegati:', err)
        setAllegatiError('Errore nel caricamento degli allegati.')
      }
    }

    loadAll()
  }, [commesse])

  useEffect(() => {
    if (!editingId) {
      setSelectedCommessaId('')
    }
  }, [editingId])

  const parseNumber = (value) => {
    if (value == null || value === '') return 0
    const parsed = Number(String(value).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : NaN
  }

  const parseTipologie = (value) => {
    if (!value) return []
    if (Array.isArray(value)) return value.filter(Boolean)
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const clampPercent = (value) => {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(100, parsed))
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

  const toggleTipologia = (value) => {
    setFormData((prev) => {
      const current = prev.sotto_stato || []
      const exists = current.includes(value)
      return {
        ...prev,
        sotto_stato: exists ? current.filter((item) => item !== value) : [...current, value]
      }
    })
  }

  const addCustomTipologia = () => {
    const value = formData.sotto_stato_custom?.trim()
    if (!value) return
    setFormData((prev) => {
      const current = prev.sotto_stato || []
      if (current.includes(value)) {
        return { ...prev, sotto_stato_custom: '' }
      }
      return {
        ...prev,
        sotto_stato: [...current, value],
        sotto_stato_custom: ''
      }
    })
  }

  const resetForm = () => {
    const empty = createEmptyForm()
    setFormData(empty)
    setInitialFormData(empty)
    setInitialAllegati([])
    setEditingId(null)
    setShowForm(false)
    setFormTab('essenziali')
    setSelectedCommessaId('')
    setClienteFormInput('')
    setShowClienteFormAutocomplete(false)
    setCommessaAudit([])
    setCommessaAuditError(null)
    setCommessaAuditCommessaId(null)
    setShowCommessaAudit(false)
    setAuditNoteDate(getTodayDate())
    setAuditNoteText('')
    setAuditNoteSaving(false)
  }

  const handleClienteChange = (value) => {
    if (!value) {
      setFormData((prev) => ({ ...prev, cliente_id: '', cliente_nome: '' }))
      setClienteFormInput('')
      return
    }
    const selected = clienti.find((cliente) => String(cliente.id) === String(value))
    const label = selected?.denominazione || ''
    setFormData((prev) => ({
      ...prev,
      cliente_id: selected?.id || '',
      cliente_nome: label
    }))
    setClienteFormInput(label)
  }

  const handleClienteFormInputChange = (value) => {
    setClienteFormInput(value)
    if (!value) {
      setFormData((prev) => ({ ...prev, cliente_id: '', cliente_nome: '' }))
      return
    }
    setFormData((prev) => ({ ...prev, cliente_id: '', cliente_nome: value }))
  }

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

  const handleSubmit = async () => {
    if (!formData.titolo.trim()) {
      setError('Titolo commessa obbligatorio.')
      return
    }

    const importoPreventivo = parseNumber(formData.importo_preventivo)
    const importoTotale = parseNumber(formData.importo_totale)
    const importoPagato = parseNumber(formData.importo_pagato)

    if ([importoPreventivo, importoTotale, importoPagato].some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Importi non validi.')
      return
    }

    const tipologie = [...(formData.sotto_stato || [])]
    const customTipologia = formData.sotto_stato_custom?.trim()
    if (customTipologia && !tipologie.includes(customTipologia)) {
      tipologie.push(customTipologia)
    }
    const tipologieValue = tipologie.length ? tipologie.join(', ') : null

    const payload = {
      ...formData,
      titolo: formData.titolo.trim(),
      cliente_id: formData.cliente_id || null,
      cliente_nome: formData.cliente_nome || null,
      sotto_stato: formData.stato === 'Conclusa' ? null : tipologieValue,
      stato_pagamenti: formData.stato_pagamenti || 'Non iniziato',
      preventivo: !!formData.preventivo,
      importo_preventivo: importoPreventivo,
      importo_totale: importoTotale,
      importo_pagato: importoPagato,
      avanzamento_lavori: clampPercent(formData.avanzamento_lavori),
      data_inizio: formData.data_inizio && typeof formData.data_inizio === 'string' && formData.data_inizio.trim() ? formData.data_inizio.trim() : null,
      data_fine: formData.data_fine && typeof formData.data_fine === 'string' && formData.data_fine.trim() ? formData.data_fine.trim() : null,
      note: formData.note && typeof formData.note === 'string' && formData.note.trim() ? formData.note.trim() : null,
      allegati: formData.allegati || null
    }

    try {
      setSaving(true)
      setError(null)
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Salvataggio commessa')
      
      if (editingId) {
        await api.updateCommessa(editingId, payload)
        // Aggiorna gli allegati iniziali dopo il salvataggio per sincronizzare lo stato
        const currentAllegati = allegatiByCommessa[editingId] || []
        setInitialAllegati(JSON.parse(JSON.stringify(currentAllegati)))
        if (loadingToastId) {
          toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Commessa aggiornata con successo', duration: 3000 })
        } else {
          toast?.showSuccess('Commessa aggiornata con successo')
        }
      } else {
        await api.createCommessa(payload)
        if (loadingToastId) {
          toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Commessa creata con successo', duration: 3000 })
        } else {
          toast?.showSuccess('Commessa creata con successo')
        }
      }
      // Ricarica i dati dal server per assicurarsi che tutto sia aggiornato
      await loadCommesse(filters)
      resetForm()
    } catch (err) {
      console.error('Errore salvataggio commessa:', err)
      const errorMsg = err.message || 'Errore nel salvataggio della commessa.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (commessa) => {
    const parsedTipologie = parseTipologie(commessa.sotto_stato)
    const nextForm = {
      titolo: commessa.titolo || '',
      cliente_id: commessa.cliente_id || '',
      cliente_nome: commessa.cliente_nome || '',
      stato: commessa.stato || 'In corso',
      sotto_stato: parsedTipologie,
      sotto_stato_custom: '',
      stato_pagamenti: commessa.stato_pagamenti || 'Non iniziato',
      preventivo: !!commessa.preventivo,
      importo_preventivo: commessa.importo_preventivo ?? 0,
      importo_totale: commessa.importo_totale ?? 0,
      importo_pagato: commessa.importo_pagato ?? 0,
      avanzamento_lavori: commessa.avanzamento_lavori ?? 0,
      responsabile: commessa.responsabile || '',
      data_inizio: commessa.data_inizio || '',
      data_fine: commessa.data_fine || '',
      note: commessa.note || '',
      allegati: commessa.allegati || ''
    }
    setEditingId(commessa.id)
    setShowForm(true)
    setFormTab('essenziali')
    setSelectedCommessaId(String(commessa.id))
    setCommessaAudit([])
    setCommessaAuditError(null)
    setCommessaAuditCommessaId(null)
    setShowCommessaAudit(false)
    setAuditNoteDate(getTodayDate())
    setAuditNoteText('')
    setAuditNoteSaving(false)
    setFormData(nextForm)
    setInitialFormData(nextForm)
    // Carica gli allegati se non sono già stati caricati e salva una snapshot come iniziali
    let currentAllegati = allegatiByCommessa[commessa.id] || []
    if (!currentAllegati.length) {
      try {
        currentAllegati = await api.getCommessaAllegati(commessa.id)
        setAllegatiByCommessa((prev) => ({
          ...prev,
          [commessa.id]: currentAllegati
        }))
      } catch (err) {
        console.error('Errore caricamento allegati:', err)
        currentAllegati = []
      }
    }
    setInitialAllegati(JSON.parse(JSON.stringify(currentAllegati)))
    setClienteFormInput(nextForm.cliente_nome || '')
  }

  const auditFieldLabels = {
    titolo: 'Titolo',
    cliente_nome: 'Cliente',
    stato: 'Stato commessa',
    sotto_stato: 'Tipologia di lavoro',
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
    sotto_stato: 'Cambio tipologia di lavoro',
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

  const formatAuditAction = (entry) => {
    if (!entry) return 'Evento'
    if (entry.action === 'update' && Array.isArray(entry.changes)) {
      const labels = entry.changes.map((change) => {
        if (!change?.field) return 'Aggiornamento'
        return auditChangeActions[change.field] || `Modifica ${formatFieldLabel(change.field)}`
      })
      const unique = [...new Set(labels)]
      return unique.length ? unique.join(', ') : 'Aggiornamento'
    }
    const mapping = {
      create: 'Creazione',
      update: 'Aggiornamento',
      delete: 'Eliminazione',
      note: 'Nota',
      attachment_uploaded: 'Allegato caricato',
      attachment_deleted: 'Eliminazione allegato'
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
      return Number(value) === 1 ? 'Sì' : 'No'
    }
    if (typeof value === 'boolean') return value ? 'Sì' : 'No'
    return String(value)
  }

  const formatAuditDate = (value) => {
    if (!value) return ''
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parsed = new Date(`${value}T00:00:00`)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('it-IT')
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
      const data = await api.getCommessaAudit(commessaId)
      setCommessaAudit(Array.isArray(data) ? data : [])
      setCommessaAuditCommessaId(String(commessaId))
    } catch (err) {
      console.error('Errore caricamento cronologia commessa:', err)
      setCommessaAuditError('Errore nel caricamento della cronologia commessa')
    } finally {
      setCommessaAuditLoading(false)
    }
  }

  const handleDelete = (commessa) => {
    setDeleteConfirm({ show: true, id: commessa.id })
  }

  const handleAddAuditNote = async () => {
    if (!selectedCommessaId) return
    const note = auditNoteText.trim()
    if (!note) {
      setCommessaAuditError('Inserisci una nota prima di salvare.')
      return
    }

    try {
      setAuditNoteSaving(true)
      setCommessaAuditError(null)
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Aggiungi nota')
      await api.addCommessaAuditNote(selectedCommessaId, {
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
      await loadCommessaAudit(selectedCommessaId)
    } catch (err) {
      console.error('Errore aggiunta nota commessa:', err)
      const errorMsg = err.message || 'Errore nel salvataggio della nota.'
      setCommessaAuditError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setAuditNoteSaving(false)
    }
  }

  const handleUpload = async (commessaId, file) => {
    if (!file) return
    setUploading((prev) => ({ ...prev, [commessaId]: true }))
    setAllegatiError(null)
    try {
      const created = await api.uploadCommessaAllegato(commessaId, file)
      setAllegatiByCommessa((prev) => ({
        ...prev,
        [commessaId]: [created, ...(prev[commessaId] || [])]
      }))
    } catch (err) {
      console.error('Errore upload allegato:', err)
      setAllegatiError(err.message || 'Errore nel caricamento allegato.')
    } finally {
      setUploading((prev) => ({ ...prev, [commessaId]: false }))
    }
  }

  const handleDeleteAllegato = async (commessaId, allegatoId) => {
    try {
      await api.deleteCommessaAllegato(allegatoId)
      setAllegatiByCommessa((prev) => ({
        ...prev,
        [commessaId]: (prev[commessaId] || []).filter((item) => item.id !== allegatoId)
      }))
    } catch (err) {
      console.error('Errore eliminazione allegato:', err)
      setAllegatiError(err.message || 'Errore eliminazione allegato.')
    }
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) {
      setDeleteConfirm({ show: false, id: null })
      return
    }

    try {
      setDeleting(true)
      const idToDelete = deleteConfirm.id
      const loadingToastId = toast?.showLoading('Eliminazione in corso...', 'Eliminazione commessa')
      await api.deleteCommessa(idToDelete)
      setCommesse((prev) => prev.filter((item) => item.id !== idToDelete))
      setAllegatiByCommessa((prev) => {
        const next = { ...prev }
        delete next[idToDelete]
        return next
      })
      if (editingId === idToDelete) {
        resetForm()
      }
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Commessa eliminata con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Commessa eliminata con successo')
      }
    } catch (err) {
      console.error('Errore eliminazione commessa:', err)
      const errorMsg = err.message || 'Errore nell\'eliminazione della commessa.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    } finally {
      setDeleting(false)
      setDeleteConfirm({ show: false, id: null })
    }
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

  const toggleConsuntivoId = (id) => {
    setConsuntivoIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ))
  }

  const consuntivoCommesse = filteredCommesse.filter((commessa) => consuntivoIds.includes(commessa.id))
  const consuntivoTotale = consuntivoCommesse.reduce((sum, commessa) => {
    const value = parseNumber(commessa.importo_totale ?? 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)
  const consuntivoScontoPercent = Math.max(0, parseNumber(consuntivoSconto) || 0)
  const consuntivoScontoValue = (consuntivoTotale * consuntivoScontoPercent) / 100
  const consuntivoFinale = consuntivoTotale - consuntivoScontoValue

  const uploadsBase = api.baseURL.replace(/\/api\/?$/, '') + '/uploads'
  const selectedCommessa = commesse.find((item) => String(item.id) === String(selectedCommessaId))
  const selectedAllegati = selectedCommessa ? (allegatiByCommessa[selectedCommessa.id] || []) : []
  const getUtenteLabel = (utente) => {
    const fullName = [utente?.nome, utente?.cognome].filter(Boolean).join(' ').trim()
    return fullName || utente?.username || ''
  }
  const toSlug = (value) => (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const getStatoClass = (value) => (value === 'Conclusa' ? 'status-closed' : 'status-open')
  const getSottoStatoClass = (value) => (value ? `substatus-${toSlug(value)}` : '')
  const getStatoPagamentiClass = (value) => (value ? `payments-${toSlug(value)}` : '')
  const normalizeForm = (data) => {
    const tipologie = parseTipologie(data.sotto_stato)
    const normalized = {
      titolo: (data.titolo || '').trim(),
      cliente_id: data.cliente_id || '',
      cliente_nome: data.cliente_nome || '',
      stato: data.stato || 'In corso',
      sotto_stato: tipologie.sort(),
      sotto_stato_custom: (data.sotto_stato_custom || '').trim(),
      stato_pagamenti: data.stato_pagamenti || 'Non iniziato',
      preventivo: !!data.preventivo,
      importo_preventivo: Number(String(data.importo_preventivo ?? 0).replace(',', '.')) || 0,
      importo_totale: Number(String(data.importo_totale ?? 0).replace(',', '.')) || 0,
      importo_pagato: Number(String(data.importo_pagato ?? 0).replace(',', '.')) || 0,
      avanzamento_lavori: Number.parseInt(data.avanzamento_lavori ?? 0, 10) || 0,
      responsabile: data.responsabile || '',
      data_inizio: data.data_inizio || '',
      data_fine: data.data_fine || '',
      note: data.note || '',
      allegati: data.allegati || ''
    }
    return normalized
  }

  const isDirty = useMemo(() => {
    const formChanged = JSON.stringify(normalizeForm(formData)) !== JSON.stringify(normalizeForm(initialFormData))
    
    // Verifica se gli allegati sono cambiati
    const currentAllegati = selectedCommessaId ? (allegatiByCommessa[selectedCommessaId] || []) : []
    const allegatiChanged = JSON.stringify(currentAllegati.map(a => a.id).sort()) !== JSON.stringify(initialAllegati.map(a => a.id).sort())
    
    return formChanged || allegatiChanged
  }, [formData, initialFormData, allegatiByCommessa, selectedCommessaId, initialAllegati])

  const canSave = isDirty && formData.titolo.trim() !== '' && !saving
  const isConsuntivoPagamenti = formData.stato_pagamenti === 'Consuntivo con altre commesse'
  const filteredClienti = useMemo(() => {
    if (!clienteFilterInput) return []
    const search = clienteFilterInput.toLowerCase()
    return clienti
      .filter((cliente) => cliente.denominazione?.toLowerCase().includes(search))
      .slice(0, 10)
  }, [clienteFilterInput, clienti])
  const filteredClientiForm = useMemo(() => {
    if (!clienteFormInput) return []
    const search = clienteFormInput.toLowerCase()
    return clienti
      .filter((cliente) => cliente.denominazione?.toLowerCase().includes(search))
      .slice(0, 10)
  }, [clienteFormInput, clienti])
  const availableYears = useMemo(() => {
    const years = new Set()
    commesse.forEach((commessa) => {
      const year = getCommessaYear(commessa)
      if (year) years.add(year)
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [commesse])

  const truncate = (value, max = 80) => {
    if (!value) return ''
    return value.length > max ? `${value.slice(0, max)}…` : value
  }

  useEffect(() => {
    if (!showCommessaAudit) return
    if (!selectedCommessaId) {
      setCommessaAudit([])
      setCommessaAuditError(null)
      setCommessaAuditCommessaId(null)
      return
    }
    if (commessaAuditCommessaId === String(selectedCommessaId)) return
    loadCommessaAudit(selectedCommessaId)
  }, [showCommessaAudit, selectedCommessaId])

  return (
    <div className="commesse-section">
      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}
      {allegatiError && (
        <div className="alert alert-warning mb-3">
          {allegatiError}
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Commesse</h2>
        <div className="d-flex gap-2">
          {showForm ? (
            <button className="btn btn-secondary" onClick={resetForm}>
              Torna alla lista
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              onClick={() => {
                const empty = createEmptyForm()
                setFormData(empty)
                setInitialFormData(empty)
                setInitialAllegati([])
                setEditingId(null)
                setShowForm(true)
                setFormTab('essenziali')
                setSelectedCommessaId('')
                setClienteFormInput('')
                setShowClienteFormAutocomplete(false)
              }}
            >
              + Nuova Commessa
            </button>
          )}
        </div>
      </div>

      {!showForm && (
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
      )}

      {!showForm && (
        <div className="card mb-4 consuntivo-card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Consuntivo</span>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setShowConsuntivo((prev) => !prev)}
            >
              {showConsuntivo ? 'Chiudi consuntivo' : 'Crea consuntivo'}
            </button>
          </div>
          {showConsuntivo && (
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
                        € {Number(parseNumber(commessa.importo_totale ?? 0) || 0).toFixed(2)}
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
                    <strong>€ {consuntivoTotale.toFixed(2)}</strong>
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
                    <strong>- € {consuntivoScontoValue.toFixed(2)}</strong>
                  </div>
                  <div className="consuntivo-row consuntivo-final">
                    <span>Conto finale</span>
                    <strong>€ {consuntivoFinale.toFixed(2)}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
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
          )}
        </div>
      )}

      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            {editingId ? 'Scheda Commessa' : 'Nuova commessa'}
          </div>
          <div className="card-body">
            <div className="commessa-form-tabs">
              <button
                type="button"
                className={`btn btn-sm ${formTab === 'essenziali' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormTab('essenziali')}
              >
                Essenziali
              </button>
              <button
                type="button"
                className={`btn btn-sm ${formTab === 'dettagli' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFormTab('dettagli')}
              >
                Dettagli
              </button>
            </div>
            <div className="row g-3">
              {formTab === 'essenziali' && (
              <>
                <div className="col-md-6">
                <label className="form-label">Titolo commessa</label>
                <input
                  className="form-control"
                  value={formData.titolo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, titolo: e.target.value }))}
                />
              </div>
              <div className={`col-md-3 importo-pagato-row ${isConsuntivoPagamenti ? 'is-consuntivo' : ''}`}>
                <label className="form-label">Cliente</label>
                <div className="autocomplete-container">
                  <input
                    className="form-control"
                    value={clienteFormInput}
                    onChange={(e) => {
                      handleClienteFormInputChange(e.target.value)
                      setShowClienteFormAutocomplete(true)
                    }}
                    onFocus={() => setShowClienteFormAutocomplete(true)}
                    onBlur={() => {
                      setTimeout(() => setShowClienteFormAutocomplete(false), 200)
                    }}
                    placeholder="Cerca cliente..."
                  />
                  {showClienteFormAutocomplete && filteredClientiForm.length > 0 && (
                    <div className="autocomplete-list">
                      {filteredClientiForm.map((cliente) => (
                        <div
                          key={cliente.id}
                          className="autocomplete-item"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleClienteChange(cliente.id)
                            setShowClienteFormAutocomplete(false)
                          }}
                        >
                          {cliente.denominazione}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label">Stato</label>
                <select
                  className={`form-select stato-select ${getStatoClass(formData.stato)}`}
                  value={formData.stato}
                  onChange={(e) => setFormData((prev) => ({ ...prev, stato: e.target.value }))}
                >
                  {STATI_COMMESSA.map((stato) => (
                    <option key={stato} value={stato}>{stato}</option>
                  ))}
                </select>
              </div>
              {formData.stato !== 'Conclusa' && (
                <div className="col-12">
                  <label className="form-label">Tipologia di lavoro</label>
                  <div className="tipologie-lavoro-grid">
                    {TIPI_LAVORO.map((tipologia) => (
                      <label key={tipologia} className="form-check form-check-inline tipologia-item">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={formData.sotto_stato.includes(tipologia)}
                          onChange={() => toggleTipologia(tipologia)}
                        />
                        <span className="form-check-label">{tipologia}</span>
                      </label>
                    ))}
                  </div>
                  <div className="tipologia-custom-row">
                    <input
                      className="form-control"
                      value={formData.sotto_stato_custom}
                      onChange={(e) => setFormData((prev) => ({ ...prev, sotto_stato_custom: e.target.value }))}
                      placeholder="Aggiungi tipologia personalizzata"
                    />
                    <button type="button" className="btn btn-secondary" onClick={addCustomTipologia}>
                      Aggiungi
                    </button>
                  </div>
                  {formData.sotto_stato.some((item) => !TIPI_LAVORO.includes(item)) && (
                    <div className="tipologia-custom-tags">
                      {formData.sotto_stato
                        .filter((item) => !TIPI_LAVORO.includes(item))
                        .map((item) => (
                          <button
                            key={item}
                            type="button"
                            className="tipologia-tag"
                            onClick={() => toggleTipologia(item)}
                          >
                            {item} ×
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
              <div className="col-md-3">
                <label className="form-label">Preventivo</label>
                <select
                  className="form-select"
                  value={formData.preventivo ? 'si' : 'no'}
                  onChange={(e) => {
                    const isPreventivo = e.target.value === 'si'
                    setFormData((prev) => ({
                      ...prev,
                      preventivo: isPreventivo,
                      importo_preventivo: isPreventivo ? prev.importo_preventivo : ''
                    }))
                  }}
                >
                  <option value="si">Sì</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Importo preventivo (€)</label>
                <input
                  className="form-control"
                  value={formData.importo_preventivo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, importo_preventivo: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                  disabled={!formData.preventivo}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Importo totale (€)</label>
                <input
                  className="form-control"
                  value={formData.importo_totale}
                  onChange={(e) => setFormData((prev) => ({ ...prev, importo_totale: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Importo pagato (€)</label>
                <input
                  className="form-control"
                  value={formData.importo_pagato}
                  onChange={(e) => setFormData((prev) => ({ ...prev, importo_pagato: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Stato pagamenti</label>
                <select
                  className={`form-select stato-pagamenti-select ${getStatoPagamentiClass(formData.stato_pagamenti)}`}
                  value={formData.stato_pagamenti}
                  onChange={(e) => setFormData((prev) => ({ ...prev, stato_pagamenti: e.target.value }))}
                >
                  {STATI_PAGAMENTI.map((stato) => (
                    <option key={stato} value={stato}>{stato}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Responsabile</label>
                <select
                  className="form-select"
                  value={formData.responsabile}
                  onChange={(e) => setFormData((prev) => ({ ...prev, responsabile: e.target.value }))}
                >
                  <option value="">Seleziona responsabile</option>
                  {utenti.map((utente) => {
                    const label = getUtenteLabel(utente)
                    return (
                      <option key={utente.id} value={label}>
                        {label}
                      </option>
                    )
                  })}
                </select>
              </div>
              </>
              )}
              {formTab === 'dettagli' && (
              <>
              <div className="col-md-4">
                <label className="form-label">Data inizio</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.data_inizio}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_inizio: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Data fine</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.data_fine}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_fine: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Note</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.note}
                  onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Riferimenti (link o note extra)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.allegati}
                  onChange={(e) => setFormData((prev) => ({ ...prev, allegati: e.target.value }))}
                />
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && editingId && (
        <div className="card mb-4">
          <div className="card-header">Allegati commessa</div>
          <div className="card-body">
            {!selectedCommessa ? (
              <div className="alert alert-info">Seleziona una commessa per vedere gli allegati.</div>
            ) : (
              <>
                <div className="row g-3 align-items-end">
                  <div className="col-md-12">
                    <label className="form-label">Carica nuovo allegato</label>
                    <div className="commessa-attachment-actions">
                      <input
                        id="commessa-file-global"
                        type="file"
                        className="commessa-file-input"
                        onChange={(e) => handleUpload(selectedCommessaId, e.target.files?.[0])}
                        disabled={!selectedCommessaId || uploading[selectedCommessaId]}
                      />
                      <label
                        className="btn btn-secondary btn-sm btn-icon"
                        htmlFor="commessa-file-global"
                        title="Carica allegato"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10.5V16a5 5 0 0 1-5 5H8a5 5 0 0 1 0-10h8a3 3 0 0 1 0 6H9a1 1 0 0 1 0-2h7" />
                        </svg>
                      </label>
                      {uploading[selectedCommessaId] && (
                        <span className="commessa-meta">Caricamento...</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="commessa-attachments mt-4">
                  <div className="commessa-meta">
                    Allegati per: {selectedCommessa.titolo}
                  </div>
                  {selectedAllegati.length === 0 && (
                    <div className="commessa-meta">Nessun allegato presente.</div>
                  )}
                  {selectedAllegati.length > 0 && (
                    <ul className="commessa-attachments-list">
                      {selectedAllegati.map((allegato) => (
                        <li key={allegato.id}>
                          <a
                            href={`${uploadsBase}/${allegato.file_path}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {allegato.original_name}
                          </a>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteAllegato(selectedCommessa.id, allegato.id)}
                          >
                            Rimuovi
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showForm && editingId && (
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Cronologia commessa</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setShowCommessaAudit((prev) => !prev)}
              disabled={!selectedCommessaId}
            >
              {showCommessaAudit ? 'Nascondi' : 'Mostra'}
            </button>
          </div>
          <div className="card-body">
            {!selectedCommessaId && (
              <div className="alert alert-info mb-0">Seleziona una commessa per vedere la cronologia.</div>
            )}
            {selectedCommessaId && showCommessaAudit && (
              <>
                <div className="row g-2 align-items-end mb-3">
                  <div className="col-md-3">
                    <label className="form-label">Data</label>
                    <input
                      type="date"
                      className="form-control"
                      value={auditNoteDate}
                      onChange={(e) => setAuditNoteDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-7">
                    <label className="form-label">Nota</label>
                    <input
                      className="form-control"
                      value={auditNoteText}
                      onChange={(e) => setAuditNoteText(e.target.value)}
                      placeholder="Es. relazione inviata"
                    />
                  </div>
                  <div className="col-md-2 d-grid">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAddAuditNote}
                      disabled={auditNoteSaving}
                    >
                      {auditNoteSaving ? 'Salvataggio...' : 'Aggiungi'}
                    </button>
                  </div>
                </div>
                {commessaAuditLoading && (
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Caricamento cronologia...
                  </div>
                )}
                {commessaAuditError && (
                  <div className="alert alert-warning mb-0">
                    {commessaAuditError}
                  </div>
                )}
                {!commessaAuditLoading && !commessaAuditError && commessaAudit.length === 0 && (
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Nessuna modifica registrata.
                  </div>
                )}
                {!commessaAuditLoading && !commessaAuditError && commessaAudit.length > 0 && (
                  <div className="audit-list">
                    {commessaAudit.map((entry) => (
                      <div key={entry.id} className="audit-item">
                        <div className="audit-header">
                          <div>
                            <div className="audit-title">{formatAuditAction(entry)}</div>
                            <div className="audit-meta">Da: {formatAuditUser(entry)}</div>
                          </div>
                          <div className="audit-meta">{formatAuditDate(entry.created_at)}</div>
                        </div>
                        {entry.action === 'note' && entry.changes && typeof entry.changes === 'object' && (
                          <div className="audit-changes">
                            {entry.changes.date && (
                              <div>Data nota: {formatAuditDate(entry.changes.date)}</div>
                            )}
                            <div>{entry.changes.note || entry.changes.nota || '-'}</div>
                          </div>
                        )}
                        {Array.isArray(entry.changes) && entry.changes.length > 0 && (
                          <div className="audit-changes">
                            {entry.changes.map((change, idx) => (
                              <div key={`${entry.id}-change-${idx}`}>
                                {formatFieldLabel(change.field)}: {formatChangeValue(change.from, change.field)} -> {formatChangeValue(change.to, change.field)}
                              </div>
                            ))}
                          </div>
                        )}
                        {!Array.isArray(entry.changes) && entry.changes && entry.action?.startsWith('attachment') && (
                          <div className="audit-changes">
                            <div>Allegato: {entry.changes.original_name || 'N/D'}</div>
                            {entry.changes.version && (
                              <div>Versione: {entry.changes.version}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="commessa-actions-sticky mt-4 d-flex gap-2">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSave}>
            {saving ? 'Salvataggio...' : editingId ? 'Salva modifiche' : 'Crea commessa'}
          </button>
          {editingId && (
            <button
              className="btn btn-danger"
              onClick={() => handleDelete({ id: editingId })}
              disabled={saving}
            >
              Elimina
            </button>
          )}
          <button className="btn btn-secondary" onClick={resetForm} disabled={saving}>
            Annulla
          </button>
        </div>
      )}

      {!showForm && (
        <div className="attivita-table-container">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Caricamento...</span>
            </div>
          </div>
        ) : filteredCommesse.length === 0 ? (
          <div className="alert alert-info mt-3">
            Nessuna commessa presente.
          </div>
        ) : (
          <div className="attivita-table-scroll">
            <table className="table table-dark attivita-table commesse-table">
              <thead>
                <tr>
                  <th>Commessa</th>
                  <th>Cliente</th>
                  <th>Stato</th>
                  <th>Tipologia di lavoro</th>
                  <th>Stato pagamenti</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommesse.map((commessa) => {
                  const allegati = allegatiByCommessa[commessa.id] || []
                  return (
                    <tr
                      key={commessa.id}
                      className="commessa-row"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleEdit(commessa)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="commessa-title">{commessa.titolo}</div>
                        {commessa.note && (
                          <div className="commessa-meta">{commessa.note}</div>
                        )}
                        {allegati.length > 0 && (
                          <div className="commessa-meta">Allegati: {allegati.length}</div>
                        )}
                      </td>
                      <td>{commessa.cliente_nome || '-'}</td>
                      <td>
                        <span className={`status-badge ${getStatoClass(commessa.stato)}`}>
                          {commessa.stato || 'In corso'}
                        </span>
                      </td>
                      <td>
                        {commessa.sotto_stato ? (
                          <span className={`status-badge substatus-badge ${getSottoStatoClass(commessa.sotto_stato)}`}>
                            {commessa.sotto_stato}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <span className={`status-badge status-payments ${getStatoPagamentiClass(commessa.stato_pagamenti)}`}>
                          {commessa.stato_pagamenti || 'Non iniziato'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      )}

      <ConfirmDeleteModal
        show={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  )
}

export default Commesse
