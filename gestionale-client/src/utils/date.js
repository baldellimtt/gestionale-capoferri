export const getIsoDate = (date = new Date()) => {
  return date.toISOString().split('T')[0]
}

const toDate = (input) => {
  if (!input) return new Date()
  if (input instanceof Date) return new Date(input.getTime())
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T00:00:00`)
  }
  return new Date(input)
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

const getEasterSunday = (year) => {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

export const isHoliday = (dateInput) => {
  const date = toDate(dateInput)
  if (isNaN(date.getTime())) return false

  const fixedHolidays = new Set([
    '01-01',
    '01-06',
    '04-25',
    '05-01',
    '06-02',
    '08-15',
    '11-01',
    '12-08',
    '12-25',
    '12-26'
  ])

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const monthDay = `${month}-${day}`
  if (fixedHolidays.has(monthDay)) return true

  const easterSunday = getEasterSunday(date.getFullYear())
  const easterMonday = new Date(easterSunday)
  easterMonday.setDate(easterSunday.getDate() + 1)
  const easterMonth = String(easterMonday.getMonth() + 1).padStart(2, '0')
  const easterDay = String(easterMonday.getDate()).padStart(2, '0')
  return `${easterMonth}-${easterDay}` === monthDay
}

export const isWeekend = (dateInput) => {
  const date = toDate(dateInput)
  if (isNaN(date.getTime())) return false
  const day = date.getDay()
  return day === 0 || day === 6
}

export const isWorkingDay = (dateInput) => {
  return !isWeekend(dateInput) && !isHoliday(dateInput)
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
