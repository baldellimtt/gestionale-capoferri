import { useEffect } from 'react'
import { buildServerFilters, dedupeAttivita, normalizeAttivitaFromApi } from '../utils/attivita'
import { getIsoDate, isWorkingDay } from '../utils/date'
import api from '../services/api'

function useTabellaAttivitaEffects({
  dataVersion,
  lastDataVersionRef,
  hasLoadedFromServerRef,
  isMountedRef,
  isLoadingRef,
  suppressedAutoCreateDatesRef,
  loadSuppressedAutoCreateDates,
  loadAttivita,
  setLocalAttivita,
  loading,
  effectiveUserId,
  user,
  setRimborsoKm,
  expanded,
  filterType,
  customStartDate,
  customEndDate,
  setShowAutocomplete,
  setPortalAutocomplete,
  portalAutocomplete,
  tableScrollRef,
  attivita,
  clearAutoCreateSuppression,
  lastCreatedDateRef,
  setAttivita,
  clearEditingTimeoutRef,
  notifyAttivitaChanged
}) {
  useEffect(() => {
    suppressedAutoCreateDatesRef.current = loadSuppressedAutoCreateDates()
  }, [loadSuppressedAutoCreateDates])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Quando dataVersion cambia (notifica di refresh globale dal Context), ricarica sempre dal server
  useEffect(() => {
    if (dataVersion > lastDataVersionRef.current) {
      lastDataVersionRef.current = dataVersion
      if (hasLoadedFromServerRef.current) {
        loadAttivita({}, true).catch(err => {
          console.error('Errore refresh attivita:', err)
        })
      }
    }
  }, [dataVersion])

  // Caricamento iniziale sempre dal server
  useEffect(() => {
    hasLoadedFromServerRef.current = false
    setLocalAttivita([])
    loadAttivita({}, true).catch(err => {
      console.error('Errore caricamento iniziale attivita:', err)
    })
    return () => {
      hasLoadedFromServerRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!effectiveUserId) return
    setLocalAttivita([])
    loadAttivita({}, true).catch(err => {
      console.error('Errore caricamento attivita per utente:', err)
    })
  }, [effectiveUserId])

  useEffect(() => {
    setRimborsoKm(user?.rimborso_km ?? 0)
  }, [user])

  // Caricamento dati al cambio filtri
  useEffect(() => {
    if (!hasLoadedFromServerRef.current || isLoadingRef.current) {
      return
    }
    if (expanded) {
      const filters = buildServerFilters(filterType, customStartDate, customEndDate)
      loadAttivita(filters, true).catch(err => {
        console.error('Errore caricamento filtrato attivita:', err)
      })
    } else {
      loadAttivita({}, true).catch(err => {
        console.error('Errore caricamento attivita:', err)
      })
    }
  }, [expanded, filterType, customStartDate, customEndDate])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.autocomplete-container') && !e.target.closest('.autocomplete-portal')) {
        setShowAutocomplete({})
        setPortalAutocomplete(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (loading || !hasLoadedFromServerRef.current) return

    const today = getIsoDate()
    const hasTodayRow = attivita.some(
      (row) => row.data === today && row.id && typeof row.id === 'number' && !row.isTemporary
    )

    if (hasTodayRow) {
      clearAutoCreateSuppression(today)
      lastCreatedDateRef.current = today
      return
    }

    if (lastCreatedDateRef.current === today) return
    if (suppressedAutoCreateDatesRef.current.has(today)) {
      lastCreatedDateRef.current = today
      return
    }
    if (!isWorkingDay(today)) {
      lastCreatedDateRef.current = today
      return
    }

    if (!hasTodayRow) {
      lastCreatedDateRef.current = today
      api.createAttivita({
        data: today,
        userId: effectiveUserId || null,
        clienteId: null,
        clienteNome: '',
        attivita: '',
        km: 0,
        indennita: 0,
        note: null
      })
        .then((result) => {
          if (!isMountedRef.current) return
          if (!result?.id) return
          setAttivita((prev) => {
            const normalized = normalizeAttivitaFromApi(result)
            const next = dedupeAttivita([...prev, normalized], new Set())
            return next
          })
          notifyAttivitaChanged?.()
        })
        .catch((err) => {
          console.error('Errore auto-creazione attivita:', err)
        })
    }
  }, [loading, attivita, effectiveUserId])

  // Cleanup timeout al unmount
  useEffect(() => {
    return () => {
      if (clearEditingTimeoutRef?.current) {
        clearTimeout(clearEditingTimeoutRef.current)
        clearEditingTimeoutRef.current = null
      }
    }
  }, [])

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

    const handleScroll = (e) => {
      const tableEl = tableScrollRef.current
      if (tableEl && e?.target && tableEl.contains(e.target)) {
        repositionPortal()
        return
      }
      setPortalAutocomplete(null)
      setShowAutocomplete({})
    }

    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', repositionPortal)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', repositionPortal)
    }
  }, [portalAutocomplete])
}

export default useTabellaAttivitaEffects
