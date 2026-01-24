import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import CommessaTrackingPanel from './commesse/CommessaTrackingPanel'
import CommessaAuditPanel from './commesse/CommessaAuditPanel'
import CommessaAttachmentsPanel from './commesse/CommessaAttachmentsPanel'
import CommessaFilters from './commesse/CommessaFilters'
import CommessaForm from './commesse/CommessaForm'

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
  monte_ore_stimato: '',
  responsabile: '',
  ubicazione: '',
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

function Commesse({ clienti, toast, onOpenTracking }) {
  const [commesse, setCommesse] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ clienteId: '', stato: '', sottoStato: '', statoPagamenti: '' })
  const [yearFilter, setYearFilter] = useState('')
  const [clienteFilterInput, setClienteFilterInput] = useState('')
  const [showClienteFilterAutocomplete, setShowClienteFilterAutocomplete] = useState(false)
  const [clienteFormInput, setClienteFormInput] = useState('')
  const [showClienteFormAutocomplete, setShowClienteFormAutocomplete] = useState(false)
  const [allowClienteEdit, setAllowClienteEdit] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState('essenziali')
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(createEmptyForm())
  const [initialFormData, setInitialFormData] = useState(createEmptyForm())
  const [selectedClienteViewId, setSelectedClienteViewId] = useState('')
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
  const [commessaTracking, setCommessaTracking] = useState(null)
  const [commessaTrackingLoading, setCommessaTrackingLoading] = useState(false)
  const [commessaTrackingError, setCommessaTrackingError] = useState(null)
  const [auditNoteDate, setAuditNoteDate] = useState(() => getTodayDate())
  const [auditNoteText, setAuditNoteText] = useState('')
  const [auditNoteSaving, setAuditNoteSaving] = useState(false)
  const [sortByLatest, setSortByLatest] = useState(false)
  const [yearFoldersByCliente, setYearFoldersByCliente] = useState({})
  const [yearFoldersLoading, setYearFoldersLoading] = useState(false)
  const [showYearFolderForm, setShowYearFolderForm] = useState(false)
  const [newYearFolder, setNewYearFolder] = useState('')

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
    setShowYearFolderForm(false)
    setNewYearFolder('')
  }, [selectedClienteViewId])

  useEffect(() => {
    if (!selectedClienteViewId) return
    let isActive = true
    const loadFolders = async () => {
      try {
        setYearFoldersLoading(true)
        const data = await api.getCommesseYearFolders(selectedClienteViewId)
        if (!isActive) return
        const years = Array.isArray(data) ? data.map((item) => String(item.anno)) : []
        setYearFoldersByCliente((prev) => ({
          ...prev,
          [selectedClienteViewId]: years
        }))
      } catch (err) {
        console.error('Errore caricamento cartelle anno:', err)
        toast?.showError('Errore nel caricamento delle cartelle anno', 'Cartelle anno')
      } finally {
        if (isActive) setYearFoldersLoading(false)
      }
    }
    loadFolders()
    return () => {
      isActive = false
    }
  }, [selectedClienteViewId, toast])

  useEffect(() => {
    if (!showForm || editingId) return
    const clienteId = formData.cliente_id ? String(formData.cliente_id) : ''
    if (!clienteId || yearFoldersByCliente[clienteId]) return
    let isActive = true
    const loadFolders = async () => {
      try {
        const data = await api.getCommesseYearFolders(clienteId)
        if (!isActive) return
        const years = Array.isArray(data) ? data.map((item) => String(item.anno)) : []
        setYearFoldersByCliente((prev) => ({
          ...prev,
          [clienteId]: years
        }))
      } catch (err) {
        console.error('Errore caricamento cartelle anno:', err)
        toast?.showError('Errore nel caricamento delle cartelle anno', 'Cartelle anno')
      }
    }
    loadFolders()
    return () => {
      isActive = false
    }
  }, [showForm, editingId, formData.cliente_id, yearFoldersByCliente, toast])

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
      setCommessaTracking(null)
      setCommessaTrackingError(null)
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
    setAllowClienteEdit(false)
    setCommessaAudit([])
    setCommessaAuditError(null)
    setCommessaAuditCommessaId(null)
    setShowCommessaAudit(false)
    setAuditNoteDate(getTodayDate())
    setAuditNoteText('')
    setAuditNoteSaving(false)
  }

  const startNewCommessa = (options = {}) => {
    const empty = createEmptyForm()
    const selectedCliente = selectedClienteViewId
      ? clienti.find((cliente) => String(cliente.id) === String(selectedClienteViewId))
      : null
    if (selectedCliente) {
      empty.cliente_id = selectedCliente.id
      empty.cliente_nome = selectedCliente.denominazione || ''
    }
    const year = options.year || (selectedClienteViewId ? yearFilter : '')
    if (year) {
      empty.data_inizio = `${year}-01-01`
    }
    setFormData(empty)
    setInitialFormData(empty)
    setInitialAllegati([])
    setEditingId(null)
    setShowForm(true)
    setFormTab('essenziali')
    setSelectedCommessaId('')
    setClienteFormInput(selectedCliente?.denominazione || '')
    setShowClienteFormAutocomplete(false)
    setAllowClienteEdit(!selectedCliente)
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
      setSelectedClienteViewId('')
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

  const selectClienteForView = (cliente) => {
    if (!cliente?.id) return
    setClienteFilterInput(cliente.denominazione || '')
    setFilters((prev) => ({ ...prev, clienteId: cliente.id }))
    setSelectedClienteViewId(String(cliente.id))
    setShowClienteFilterAutocomplete(false)
  }

  const handleClienteListSelect = (cliente) => {
    selectClienteForView(cliente)
  }

  const handleBackToClientList = () => {
    setSelectedClienteViewId('')
    setClienteFilterInput('')
    setFilters((prev) => ({ ...prev, clienteId: '' }))
    setShowClienteFilterAutocomplete(false)
  }

  const handleSubmit = async () => {
    if (!formData.titolo.trim()) {
      setError('Titolo commessa obbligatorio.')
      return
    }

    const importoPreventivo = parseNumber(formData.importo_preventivo)
    const importoTotale = parseNumber(formData.importo_totale)
    const importoPagato = parseNumber(formData.importo_pagato)
    const monteOreStimato = formData.monte_ore_stimato === '' ? null : parseNumber(formData.monte_ore_stimato)

    if ([importoPreventivo, importoTotale, importoPagato].some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Importi non validi.')
      return
    }

    if (monteOreStimato !== null && (!Number.isFinite(monteOreStimato) || monteOreStimato < 0)) {
      setError('Monte ore stimato non valido.')
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
      monte_ore_stimato: monteOreStimato,
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
      monte_ore_stimato: commessa.monte_ore_stimato ?? '',
      responsabile: commessa.responsabile || '',
      ubicazione: commessa.ubicazione || '',
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
    setAllowClienteEdit(true)
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
    monte_ore_stimato: 'Monte ore stimato',
    responsabile: 'Responsabile',
    ubicazione: 'Ubicazione',
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
    ubicazione: 'Cambio ubicazione',
    titolo: 'Modifica titolo',
    importo_preventivo: 'Modifica importo preventivo',
    importo_totale: 'Modifica importo totale',
    importo_pagato: 'Modifica importo pagato',
    avanzamento_lavori: 'Aggiornamento avanzamento lavori',
    monte_ore_stimato: 'Modifica monte ore stimato',
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
      return Number(value) === 1 ? 'Sì' : 'No'
    }
    if (typeof value === 'boolean') return value ? 'Sì' : 'No'
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

  const getAuditUserBadgeStyle = (entry) => {
    const user = entry?.user
    const seed = String(user?.id || user?.username || entry?.user_id || 'system')
    let hash = 0
    for (let i = 0; i < seed.length; i += 1) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i)
      hash |= 0
    }
    const hue = Math.abs(hash) % 360
    return {
      background: `hsl(${hue} 75% 88%)`,
      color: `hsl(${hue} 55% 28%)`,
      border: `1px solid hsl(${hue} 55% 70%)`
    }
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

  const loadCommessaTracking = async (commessaId) => {
    if (!commessaId) return
    try {
      setCommessaTrackingLoading(true)
      setCommessaTrackingError(null)
      const data = await api.getCommessaTrackingEntries(commessaId)
      setCommessaTracking(data || null)
    } catch (err) {
      console.error('Errore caricamento tracking commessa:', err)
      setCommessaTrackingError('Errore nel caricamento del tracking ore')
    } finally {
      setCommessaTrackingLoading(false)
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
    const compareValues = (first, second) => {
      return String(first || '').localeCompare(String(second || ''), 'it', { sensitivity: 'base' })
    }
    const getUpdatedTimestamp = (commessa) => {
      const value = commessa?.updated_at || commessa?.created_at
      if (!value) return 0
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
    }
    return [...commesse].sort((a, b) => {
      if (sortByLatest) {
        const updatedCompare = getUpdatedTimestamp(b) - getUpdatedTimestamp(a)
        if (updatedCompare !== 0) return updatedCompare
      }
      const clienteCompare = compareValues(a.cliente_nome, b.cliente_nome)
      if (clienteCompare !== 0) return clienteCompare
      const titoloCompare = compareValues(a.titolo, b.titolo)
      if (titoloCompare !== 0) return titoloCompare
      return Number(a.id) - Number(b.id)
    })
  }, [commesse, sortByLatest])

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

  const clientiSorted = useMemo(() => {
    return [...clienti].sort((a, b) => {
      return String(a?.denominazione || '').localeCompare(String(b?.denominazione || ''), 'it', { sensitivity: 'base' })
    })
  }, [clienti])

  const clientiList = useMemo(() => {
    const clientiWithCommesse = new Set(
      filteredCommesse
        .map((commessa) => commessa?.cliente_id)
        .filter((value) => value != null)
        .map((value) => String(value))
    )
    const availableClienti = clientiSorted.filter((cliente) => clientiWithCommesse.has(String(cliente.id)))
    if (!clienteFilterInput) return availableClienti
    const search = clienteFilterInput.toLowerCase()
    return availableClienti.filter((cliente) => cliente.denominazione?.toLowerCase().includes(search))
  }, [clientiSorted, clienteFilterInput, filteredCommesse])


  const uploadsBase = api.baseURL.replace(/\/api\/?$/, '') + '/uploads'
  const selectedCommessa = commesse.find((item) => String(item.id) === String(selectedCommessaId))
  const selectedAllegati = selectedCommessa ? (allegatiByCommessa[selectedCommessa.id] || []) : []
  const isClientListView = !showForm && !selectedClienteViewId
  const selectedClienteFormId = formData.cliente_id ? String(formData.cliente_id) : ''
  const selectedFormYear = (() => {
    const match = String(formData.data_inizio || '').match(/^(\d{4})/)
    return match ? match[1] : ''
  })()
  const formYearFolders = selectedClienteFormId ? (yearFoldersByCliente[selectedClienteFormId] || []) : []
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
      ubicazione: data.ubicazione || '',
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

  const selectedClienteYearFolders = useMemo(() => {
    if (!selectedClienteViewId) return []
    const custom = yearFoldersByCliente[selectedClienteViewId] || []
    const years = new Set([...availableYears, ...custom])
    if (yearFilter) years.add(yearFilter)
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [availableYears, selectedClienteViewId, yearFoldersByCliente, yearFilter])

  const formYearFolderOptions = useMemo(() => {
    if (!formYearFolders.length && !selectedFormYear) return []
    const years = new Set(formYearFolders)
    if (selectedFormYear) years.add(selectedFormYear)
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [formYearFolders, selectedFormYear])

  const handleSelectYearFolder = (year) => {
    setYearFilter(year || '')
  }

  const handleCreateYearFolder = async () => {
    const year = newYearFolder.trim()
    if (!/^\d{4}$/.test(year)) {
      toast?.showError('Inserisci un anno valido (es. 2026).', 'Nuova cartella')
      return
    }
    if (!selectedClienteViewId) return
    try {
      setYearFoldersLoading(true)
      const created = await api.createCommessaYearFolder(selectedClienteViewId, year)
      const createdYear = created?.anno ? String(created.anno) : year
      setYearFoldersByCliente((prev) => {
        const existing = prev[selectedClienteViewId] || []
        if (existing.includes(createdYear)) return prev
        return {
          ...prev,
          [selectedClienteViewId]: [...existing, createdYear]
        }
      })
      setNewYearFolder('')
      setShowYearFolderForm(false)
      setYearFilter(createdYear)
      startNewCommessa({ year: createdYear })
    } catch (err) {
      console.error('Errore creazione cartella anno:', err)
      toast?.showError('Errore nella creazione della cartella', 'Nuova cartella')
    } finally {
      setYearFoldersLoading(false)
    }
  }

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

  useEffect(() => {
    if (!editingId) return
    loadCommessaTracking(editingId)
  }, [editingId])

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
            <>
              {!isClientListView && (
                <button
                  className="btn btn-secondary"
                  onClick={handleBackToClientList}
                >
                  Torna ai clienti
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => {
                  startNewCommessa()
                }}
              >
                + Nuova Commessa
              </button>
            </>
          )}
        </div>
      </div>

      {!showForm && (
        <CommessaFilters
          sortByLatest={sortByLatest}
          onToggleSort={() => setSortByLatest((prev) => !prev)}
          clienteFilterInput={clienteFilterInput}
          onClienteFilterChange={handleClienteFilterChange}
          showClienteFilterAutocomplete={showClienteFilterAutocomplete}
          setShowClienteFilterAutocomplete={setShowClienteFilterAutocomplete}
          filteredClienti={filteredClienti}
          onSelectClienteForView={selectClienteForView}
          filters={filters}
          setFilters={setFilters}
          isClientListView={isClientListView}
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          availableYears={availableYears}
          statiCommessa={STATI_COMMESSA}
          statiPagamenti={STATI_PAGAMENTI}
          tipiLavoro={TIPI_LAVORO}
          getStatoPagamentiClass={getStatoPagamentiClass}
        />
      )}

      {showForm && (
        <CommessaForm
          editingId={editingId}
          onOpenTracking={onOpenTracking}
          formTab={formTab}
          setFormTab={setFormTab}
          formData={formData}
          setFormData={setFormData}
          allowClienteEdit={allowClienteEdit}
          setAllowClienteEdit={setAllowClienteEdit}
          clienteFormInput={clienteFormInput}
          showClienteFormAutocomplete={showClienteFormAutocomplete}
          setShowClienteFormAutocomplete={setShowClienteFormAutocomplete}
          filteredClientiForm={filteredClientiForm}
          handleClienteFormInputChange={handleClienteFormInputChange}
          handleClienteChange={handleClienteChange}
          statiCommessa={STATI_COMMESSA}
          statiPagamenti={STATI_PAGAMENTI}
          tipiLavoro={TIPI_LAVORO}
          toggleTipologia={toggleTipologia}
          addCustomTipologia={addCustomTipologia}
          getStatoClass={getStatoClass}
          getStatoPagamentiClass={getStatoPagamentiClass}
          utenti={utenti}
          getUtenteLabel={getUtenteLabel}
          isConsuntivoPagamenti={isConsuntivoPagamenti}
          formYearFolderOptions={formYearFolderOptions}
          selectedFormYear={selectedFormYear}
        />
      )}

      {showForm && editingId && (
        <CommessaAttachmentsPanel
          selectedCommessa={selectedCommessa}
          selectedCommessaId={selectedCommessaId}
          selectedAllegati={selectedAllegati}
          uploading={uploading}
          uploadsBase={uploadsBase}
          onUpload={handleUpload}
          onDeleteAllegato={handleDeleteAllegato}
        />
      )}

      {showForm && editingId && (
        <CommessaTrackingPanel
          tracking={commessaTracking}
          loading={commessaTrackingLoading}
          error={commessaTrackingError}
          onOpenTracking={onOpenTracking}
          editingId={editingId}
        />
      )}

      {showForm && editingId && (
        <CommessaAuditPanel
          selectedCommessaId={selectedCommessaId}
          showCommessaAudit={showCommessaAudit}
          onToggle={() => setShowCommessaAudit((prev) => !prev)}
          auditNoteDate={auditNoteDate}
          onChangeDate={setAuditNoteDate}
          auditNoteText={auditNoteText}
          onChangeText={setAuditNoteText}
          onAddNote={handleAddAuditNote}
          auditNoteSaving={auditNoteSaving}
          commessaAuditLoading={commessaAuditLoading}
          commessaAuditError={commessaAuditError}
          commessaAudit={commessaAudit}
          formatAuditAction={formatAuditAction}
          formatAuditUser={formatAuditUser}
          getAuditUserBadgeStyle={getAuditUserBadgeStyle}
          formatAuditDate={formatAuditDate}
          getAuditChangeList={getAuditChangeList}
          formatFieldLabel={formatFieldLabel}
          formatChangeValue={formatChangeValue}
        />
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

      {!showForm && isClientListView && (
        <div className="clienti-list">
          {clientiList.length === 0 ? (
            <div className="alert alert-info mt-3">
              Nessun cliente trovato.
            </div>
          ) : (
            clientiList.map((cliente) => (
              <div
                key={cliente.id}
                className="cliente-card"
                role="button"
                tabIndex={0}
                onClick={() => handleClienteListSelect(cliente)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleClienteListSelect(cliente)
                  }
                }}
              >
                <div className="cliente-card-header">
                  <h3>{cliente.denominazione || '-'}</h3>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!showForm && !isClientListView && (
        <>
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                {showYearFolderForm ? (
                  <div className="d-flex align-items-center gap-2">
                    <input
                      className="form-control form-control-sm"
                      style={{ width: '6.5rem' }}
                      value={newYearFolder}
                      onChange={(e) => setNewYearFolder(e.target.value)}
                      placeholder="2026"
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleCreateYearFolder}
                    >
                      Crea
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowYearFolderForm(false)
                        setNewYearFolder('')
                      }}
                    >
                      Annulla
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowYearFolderForm(true)}
                  >
                    Nuova cartella
                  </button>
                )}
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${!yearFilter ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleSelectYearFolder('')}
                >
                  Tutte
                </button>
                {yearFoldersLoading ? (
                  <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                    Caricamento cartelle...
                  </span>
                ) : selectedClienteYearFolders.length === 0 ? (
                  <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                    Nessuna cartella disponibile.
                  </span>
                ) : (
                  selectedClienteYearFolders.map((year) => (
                    <button
                      key={year}
                      type="button"
                      className={`btn btn-sm ${yearFilter === year ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleSelectYearFolder(year)}
                    >
                      {year}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
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
              <table className={`table table-striped commesse-table ${selectedClienteViewId ? 'no-client-column' : ''}`}>
                <thead className="table-dark visually-hidden">
                  <tr>
                    {!selectedClienteViewId && <th>Cliente</th>}
                    <th>Commessa</th>
                    <th>Stato</th>
                    <th>Tipologia</th>
                    <th>Pagamenti</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommesse.map((commessa) => (
                    <tr
                      key={commessa.id}
                      className="commessa-row"
                      onClick={() => handleEdit(commessa)}
                    >
                      {!selectedClienteViewId && (
                        <td>
                          <div className="commessa-title">{commessa.cliente_nome || '-'}</div>
                        </td>
                      )}
                      <td>
                        <div className="commessa-title">{commessa.titolo || '-'}</div>
                        {commessa.responsabile && (
                          <div className="commessa-meta">Resp: {commessa.responsabile}</div>
                        )}
                      </td>
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
                          <span className="commessa-meta">-</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge status-payments ${getStatoPagamentiClass(commessa.stato_pagamenti)}`}>
                          {commessa.stato_pagamenti || 'Non iniziato'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </>
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
