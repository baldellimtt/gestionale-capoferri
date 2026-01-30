import { useEffect, useRef, useState } from 'react'
import api from '../services/api'

export const usePresence = (user, activeView) => {
  const [activeUsers, setActiveUsers] = useState([])
  const [presenceLoading, setPresenceLoading] = useState(false)
  const [presenceError, setPresenceError] = useState(null)
  const presenceBusyRef = useRef(false)

  useEffect(() => {
    if (!user) {
      setActiveUsers([])
      setPresenceError(null)
      return
    }

    let cancelled = false
    const runPresence = async () => {
      if (presenceBusyRef.current) return
      presenceBusyRef.current = true
      setPresenceLoading(true)
      try {
        await api.presenceHeartbeat(activeView)
        const data = await api.getActiveUsers(2)
        if (!cancelled) {
          setActiveUsers(Array.isArray(data) ? data : [])
          setPresenceError(null)
        }
      } catch (err) {
        console.error('Errore presenza utenti:', err)
        if (!cancelled) {
          setPresenceError('Presenze non disponibili')
        }
      } finally {
        if (!cancelled) {
          setPresenceLoading(false)
        }
        presenceBusyRef.current = false
      }
    }

    runPresence()
    const intervalId = setInterval(runPresence, 30000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runPresence()
      }
    }

    window.addEventListener('focus', runPresence)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearInterval(intervalId)
      window.removeEventListener('focus', runPresence)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user, activeView])

  return {
    activeUsers,
    presenceLoading,
    presenceError
  }
}
