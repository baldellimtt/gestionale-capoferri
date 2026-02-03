import { useCallback, useReducer, useRef, useState } from 'react'

function useTabellaAttivitaState({ user, getIsoDate }) {
  const [localAttivita, setLocalAttivita] = useState([])
  const [loading, setLoading] = useState(true)
  const lastDataVersionRef = useRef(0)
  const hasLoadedFromServerRef = useRef(false)
  const isMountedRef = useRef(true)
  const isLoadingRef = useRef(false)
  const suppressedAutoCreateDatesRef = useRef(new Set())

  const setAttivita = useCallback((updater) => {
    if (typeof updater === 'function') {
      setLocalAttivita(prev => {
        const newValue = updater(prev)
        return newValue
      })
    } else {
      setLocalAttivita(updater)
    }
  }, [])

  const [error, setError] = useState(null)
  const uiReducer = (state, action) => {
    switch (action.type) {
      case 'set':
        return { ...state, [action.field]: action.value }
      case 'patch':
        return { ...state, ...action.payload }
      default:
        return state
    }
  }
  const [uiState, dispatchUi] = useReducer(uiReducer, {
    expanded: false,
    showForm: true,
    showSection: true,
    filterType: 'none',
    customStartDate: '',
    customEndDate: ''
  })
  const setExpanded = useCallback((value) => {
    dispatchUi({ type: 'set', field: 'expanded', value })
  }, [])
  const setShowForm = useCallback((value) => {
    dispatchUi({ type: 'set', field: 'showForm', value })
  }, [])
  const setShowSection = useCallback((value) => {
    dispatchUi({ type: 'set', field: 'showSection', value })
  }, [])
  const setFilterType = useCallback((value) => {
    dispatchUi({ type: 'set', field: 'filterType', value })
  }, [])
  const setCustomStartDate = useCallback((value) => {
    dispatchUi({ type: 'set', field: 'customStartDate', value })
  }, [])
  const setCustomEndDate = useCallback((value) => {
    dispatchUi({ type: 'set', field: 'customEndDate', value })
  }, [])
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
  const [exportDate, setExportDate] = useState(getIsoDate())
  const lastCreatedDateRef = useRef(null)
  const clearEditingTimeoutRef = useRef(null)
  const tableScrollRef = useRef(null)
  const [rimborsoKm, setRimborsoKm] = useState(user?.rimborso_km ?? 0)

  return {
    localAttivita,
    setLocalAttivita,
    loading,
    setLoading,
    lastDataVersionRef,
    hasLoadedFromServerRef,
    isMountedRef,
    isLoadingRef,
    suppressedAutoCreateDatesRef,
    setAttivita,
    error,
    setError,
    expanded: uiState.expanded,
    setExpanded,
    showForm: uiState.showForm,
    setShowForm,
    showSection: uiState.showSection,
    setShowSection,
    filterType: uiState.filterType,
    setFilterType,
    customStartDate: uiState.customStartDate,
    setCustomStartDate,
    customEndDate: uiState.customEndDate,
    setCustomEndDate,
    clienteSearch,
    setClienteSearch,
    showAutocomplete,
    setShowAutocomplete,
    portalAutocomplete,
    setPortalAutocomplete,
    editingRowId,
    setEditingRowId,
    saving,
    setSaving,
    deleteConfirm,
    setDeleteConfirm,
    deleting,
    setDeleting,
    deletedIds,
    setDeletedIds,
    hiddenTempDates,
    setHiddenTempDates,
    newRowDate,
    setNewRowDate,
    exportDate,
    setExportDate,
    lastCreatedDateRef,
    clearEditingTimeoutRef,
    tableScrollRef,
    rimborsoKm,
    setRimborsoKm
  }
}

export default useTabellaAttivitaState
