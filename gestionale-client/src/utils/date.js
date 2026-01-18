export const getIsoDate = (date = new Date()) => {
  return date.toISOString().split('T')[0]
}

export const getDateGroups = () => {
  const today = new Date()
  const yesterday = new Date(today)
  const dayBefore = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  dayBefore.setDate(dayBefore.getDate() - 2)

  return [
    { date: getIsoDate(today), label: 'Oggi' },
    { date: getIsoDate(yesterday), label: 'Ieri' },
    { date: getIsoDate(dayBefore), label: "L'altro ieri" }
  ]
}

export const formatDateEuropean = (dateString) => {
  if (!dateString) return ''
  if (dateString.includes('-')) {
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateString
  }
}
