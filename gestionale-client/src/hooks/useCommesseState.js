import { useCallback, useReducer, useRef, useState } from 'react'

function useCommesseState({ createEmptyForm, defaultFilters, getTodayDate }) {
  const [commesse, setCommesse] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ ...defaultFilters })
  const [yearFilter, setYearFilter] = useState('')
  const [clienteFilterInput, setClienteFilterInput] = useState('')
  const [showClienteFilterAutocomplete, setShowClienteFilterAutocomplete] = useState(false)
  const [clienteFormInput, setClienteFormInput] = useState('')
  const [showClienteFormAutocomplete, setShowClienteFormAutocomplete] = useState(false)
  const [allowClienteEdit, setAllowClienteEdit] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState('essenziali')
  const [editingId, setEditingId] = useState(null)
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
  const [formData, dispatchForm] = useReducer(formReducer, createEmptyForm())
  const setFormData = useCallback((next) => {
    dispatchForm({ type: 'set', payload: next })
  }, [])
  const [initialFormData, setInitialFormData] = useState(createEmptyForm())
  const [selectedClienteViewId, setSelectedClienteViewId] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null })
  const [deleting, setDeleting] = useState(false)
  const [allegatiByCommessa, setAllegatiByCommessa] = useState({})
  const [initialAllegati, setInitialAllegati] = useState([])
  const [uploading, setUploading] = useState({})
  const [uploadStatusByCommessa, setUploadStatusByCommessa] = useState({})
  const [allegatiError, setAllegatiError] = useState(null)
  const [selectedCommessaId, setSelectedCommessaId] = useState('')
  const [uploadMessageByCommessa, setUploadMessageByCommessa] = useState({})
  const uploadMessageTimers = useRef({})
  const [previewAllegato, setPreviewAllegato] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewUrlRef = useRef('')
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
  const [structureParentId, setStructureParentId] = useState(null)

  return {
    commesse,
    setCommesse,
    loading,
    setLoading,
    error,
    setError,
    filters,
    setFilters,
    yearFilter,
    setYearFilter,
    clienteFilterInput,
    setClienteFilterInput,
    showClienteFilterAutocomplete,
    setShowClienteFilterAutocomplete,
    clienteFormInput,
    setClienteFormInput,
    showClienteFormAutocomplete,
    setShowClienteFormAutocomplete,
    allowClienteEdit,
    setAllowClienteEdit,
    showForm,
    setShowForm,
    formTab,
    setFormTab,
    editingId,
    setEditingId,
    formData,
    setFormData,
    initialFormData,
    setInitialFormData,
    selectedClienteViewId,
    setSelectedClienteViewId,
    saving,
    setSaving,
    deleteConfirm,
    setDeleteConfirm,
    deleting,
    setDeleting,
    allegatiByCommessa,
    setAllegatiByCommessa,
    initialAllegati,
    setInitialAllegati,
    uploading,
    setUploading,
    uploadStatusByCommessa,
    setUploadStatusByCommessa,
    allegatiError,
    setAllegatiError,
    selectedCommessaId,
    setSelectedCommessaId,
    uploadMessageByCommessa,
    setUploadMessageByCommessa,
    uploadMessageTimers,
    previewAllegato,
    setPreviewAllegato,
    previewUrl,
    setPreviewUrl,
    previewLoading,
    setPreviewLoading,
    previewUrlRef,
    utenti,
    setUtenti,
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
    commessaTracking,
    setCommessaTracking,
    commessaTrackingLoading,
    setCommessaTrackingLoading,
    commessaTrackingError,
    setCommessaTrackingError,
    auditNoteDate,
    setAuditNoteDate,
    auditNoteText,
    setAuditNoteText,
    auditNoteSaving,
    setAuditNoteSaving,
    sortByLatest,
    setSortByLatest,
    yearFoldersByCliente,
    setYearFoldersByCliente,
    yearFoldersLoading,
    setYearFoldersLoading,
    showYearFolderForm,
    setShowYearFolderForm,
    newYearFolder,
    setNewYearFolder,
    structureParentId,
    setStructureParentId
  }
}

export default useCommesseState
