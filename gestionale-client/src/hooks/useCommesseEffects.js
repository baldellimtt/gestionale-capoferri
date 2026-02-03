import { useEffect } from 'react'
import api from '../services/api'

function useCommesseEffects({
  commesseQuery,
  filters,
  setCommesse,
  setLoading,
  setError,
  openCommessaId,
  editingId,
  commesse,
  onOpenCommessaHandled,
  handleEdit,
  setFilters,
  defaultFilters,
  setYearFilter,
  setSelectedClienteViewId,
  setClienteFilterInput,
  setShowForm,
  yearFilter,
  selectedClienteViewId,
  toast,
  loading,
  setUtenti,
  formData,
  setFormData,
  setShowYearFolderForm,
  setNewYearFolder,
  setYearFoldersLoading,
  setYearFoldersByCliente,
  showForm,
  yearFoldersByCliente,
  setAllegatiByCommessa,
  setAllegatiError,
  setSelectedCommessaId,
  setCommessaTracking,
  setCommessaTrackingError,
  previewAllegato,
  previewUrlRef,
  setPreviewUrl,
  setPreviewLoading,
  setPreviewAllegato,
  getMimeFromName,
  structureParentId,
  structureParent,
  filteredCommesse,
  setStructureParentId,
  showCommessaAudit,
  selectedCommessaId,
  commessaAuditCommessaId,
  setCommessaAudit,
  setCommessaAuditError,
  setCommessaAuditCommessaId,
  loadCommessaAudit,
  loadCommessaTracking
}) {
  useEffect(() => {
    if (commesseQuery?.data) {
      setCommesse(commesseQuery.data)
    }
  }, [commesseQuery?.data])

  useEffect(() => {
    if (commesseQuery) {
      setLoading(commesseQuery.isFetching)
    }
  }, [commesseQuery?.isFetching])

  useEffect(() => {
    if (commesseQuery?.error) {
      console.error('Errore caricamento commesse:', commesseQuery.error)
      setError('Errore nel caricamento delle commesse. Verifica che il server sia avviato.')
    }
  }, [commesseQuery?.error])

  useEffect(() => {
    if (!commesseQuery?.error) {
      setError(null)
    }
  }, [commesseQuery?.error])

  useEffect(() => {
    if (!openCommessaId) return
    const openId = String(openCommessaId)
    if (editingId && String(editingId) === openId) {
      onOpenCommessaHandled?.()
      return
    }
    const commessa = commesse.find((item) => String(item.id) === openId)
    if (commessa) {
      void handleEdit(commessa)
      onOpenCommessaHandled?.()
      return
    }
    const hasActiveFilters = Boolean(
      filters.clienteId ||
      filters.stato ||
      filters.sottoStato ||
      filters.statoPagamenti ||
      yearFilter ||
      selectedClienteViewId
    )
    if (hasActiveFilters) {
      setLoading(true)
      setFilters({ ...defaultFilters })
      setYearFilter('')
      setSelectedClienteViewId('')
      setClienteFilterInput('')
      setShowForm(false)
      return
    }
    if (!loading) {
      toast?.showError('Commessa non trovata.', 'Commesse')
      onOpenCommessaHandled?.()
    }
  }, [openCommessaId, editingId, commesse, filters, yearFilter, selectedClienteViewId, loading, toast, onOpenCommessaHandled])

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
        const ids = commesse.map((commessa) => commessa.id)
        const allegatiList = await api.getCommesseAllegatiBulk(ids)
        const next = {}
        allegatiList.forEach((allegato) => {
          const key = Number(allegato.commessa_id)
          if (!next[key]) next[key] = []
          next[key].push(allegato)
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

  useEffect(() => {
    let isActive = true
    const loadPreview = async () => {
      if (!previewAllegato?.id) {
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current)
          previewUrlRef.current = ''
        }
        setPreviewUrl('')
        setPreviewLoading(false)
        return
      }
      setPreviewLoading(true)
      setPreviewUrl('')
      try {
        const { blob, contentType } = await api.downloadCommessaAllegato(previewAllegato.id)
        if (!isActive) return
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current)
        }
        const resolvedType = (contentType && contentType !== 'application/octet-stream')
          ? contentType
          : (getMimeFromName(previewAllegato.original_name) || blob.type || '')
        const nextBlob = resolvedType && resolvedType !== blob.type
          ? new Blob([blob], { type: resolvedType })
          : blob
        const nextUrl = URL.createObjectURL(nextBlob)
        previewUrlRef.current = nextUrl
        setPreviewUrl(nextUrl)
      } catch (err) {
        console.error('Errore preview allegato:', err)
        if (isActive) {
          toast?.showError('Errore nel caricamento anteprima', 'Allegati')
          setPreviewAllegato(null)
        }
      } finally {
        if (isActive) setPreviewLoading(false)
      }
    }
    void loadPreview()
    return () => {
      isActive = false
    }
  }, [previewAllegato, toast])

  useEffect(() => {
    if (structureParentId && !structureParent) {
      setStructureParentId(null)
    }
  }, [structureParentId, structureParent])

  useEffect(() => {
    if (!structureParentId) return
    const stillVisible = filteredCommesse.some((commessa) => String(commessa.id) === String(structureParentId))
    if (!stillVisible) {
      setStructureParentId(null)
    }
  }, [filteredCommesse, structureParentId])

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
}

export default useCommesseEffects
