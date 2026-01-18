import { getDateGroups } from './date'

export const normalizeAttivitaFromApi = (row) => ({
  id: row.id,
  data: row.data,
  cliente: row.cliente_nome || '',
  clienteId: row.cliente_id || null,
  attivita: row.attivita || '',
  km: row.km || '',
  indennita: row.indennita === 1
})

export const dedupeAttivita = (rows, deletedIds = new Set()) => {
  const seen = new Set()
  return rows.filter((row) => {
    if (!row || !row.id) return false
    const rowId = typeof row.id === 'string' ? parseInt(row.id, 10) : Number(row.id)
    if (isNaN(rowId)) return false
    if (deletedIds.has(rowId)) return false
    if (seen.has(rowId)) return false
    seen.add(rowId)
    return true
  })
}

export const buildServerFilters = (filterType, customStartDate, customEndDate) => {
  const filters = {}
  if (filterType === 'mese') {
    const now = new Date()
    filters.filter = 'month'
    filters.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  } else if (filterType === 'trimestre') {
    const now = new Date()
    const quarter = Math.floor(now.getMonth() / 3) + 1
    filters.filter = 'quarter'
    filters.quarter = quarter
    filters.year = now.getFullYear()
  } else if (filterType === 'custom' && customStartDate && customEndDate) {
    filters.startDate = customStartDate
    filters.endDate = customEndDate
  }
  return filters
}

export const filterAttivitaByDate = (rows, expanded, filterType, customStartDate, customEndDate) => {
  let filtered = [...rows]

  if (!expanded) {
    const dateGroups = getDateGroups()
    const visibleDates = new Set(dateGroups.map((d) => d.date))
    return filtered.filter((row) => visibleDates.has(row.data))
  }

  if (filterType === 'mese') {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    filtered = filtered.filter((row) => {
      const date = new Date(row.data)
      return date >= startOfMonth && date <= endOfMonth
    })
  } else if (filterType === 'trimestre') {
    const now = new Date()
    const quarter = Math.floor(now.getMonth() / 3)
    const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1)
    const endOfQuarter = new Date(now.getFullYear(), quarter * 3 + 3, 0)
    filtered = filtered.filter((row) => {
      const date = new Date(row.data)
      return date >= startOfQuarter && date <= endOfQuarter
    })
  } else if (filterType === 'custom' && customStartDate && customEndDate) {
    filtered = filtered.filter((row) => {
      const date = new Date(row.data)
      const start = new Date(customStartDate)
      const end = new Date(customEndDate)
      return date >= start && date <= end
    })
  }

  return filtered
}

export const calculateTotals = (rows = []) => {
  const totalKm = rows.reduce((sum, row) => {
    if (!row) return sum
    const kmValue = row.km === '' || row.km == null ? 0 : parseFloat(row.km)
    return sum + (isNaN(kmValue) ? 0 : kmValue)
  }, 0)

  const totalIndennita = rows.filter((row) => {
    if (!row) return false
    if (typeof row.indennita === 'boolean') return row.indennita
    if (typeof row.indennita === 'number') return row.indennita === 1
    return false
  }).length

  return {
    totalKm: totalKm || 0,
    totalIndennita: totalIndennita || 0
  }
}

export const getRowValidation = (row) => {
  const missing = []
  const cliente = row?.cliente ? row.cliente.trim() : ''
  const attivita = row?.attivita ? row.attivita.trim() : ''
  const kmRaw = row?.km ?? ''
  const kmValue = typeof kmRaw === 'string' ? Number(kmRaw.replace(',', '.')) : Number(kmRaw)

  if (!cliente) missing.push('Cliente')
  if (!attivita) missing.push('Rimborso')
  if (!kmRaw || Number.isNaN(kmValue) || kmValue <= 0) missing.push('KM')

  return {
    isComplete: missing.length === 0,
    missing
  }
}
