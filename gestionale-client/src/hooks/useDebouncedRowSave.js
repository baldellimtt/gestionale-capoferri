import { useCallback, useEffect, useRef } from 'react'

const useDebouncedRowSave = (saveFn, delay = 500) => {
  const timersRef = useRef(new Map())

  const scheduleSave = useCallback((rowKey, row) => {
    if (rowKey == null) return
    const timers = timersRef.current
    if (timers.has(rowKey)) {
      clearTimeout(timers.get(rowKey))
    }
    const timeoutId = setTimeout(() => saveFn(row), delay)
    timers.set(rowKey, timeoutId)
  }, [saveFn, delay])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timeoutId) => clearTimeout(timeoutId))
      timersRef.current.clear()
    }
  }, [])

  return { scheduleSave }
}

export default useDebouncedRowSave
