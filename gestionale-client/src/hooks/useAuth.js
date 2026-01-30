import { useEffect, useState } from 'react'
import api from '../services/api'

export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    const checkAuth = async () => {
      if (!api.getToken()) {
        setAuthError(null)
        setAuthChecking(false)
        return
      }

      try {
        const me = await api.me()
        setUser(me)
        setAuthError(null)
      } catch (err) {
        if (err.status === 429) {
          console.warn('Rate limit raggiunto per /auth/me:', err.retryAfter, 'secondi')
          api.clearTokens()
          setUser(null)
          setAuthError(null)
        } else if (err.status === 401) {
          setAuthError('Sessione scaduta. Riprova piu tardi.')
        } else {
          setAuthError('Errore di connessione. Riprova.')
        }
      } finally {
        setAuthChecking(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (credentials) => {
    try {
      setAuthLoading(true)
      setAuthError(null)
      const data = await api.login(credentials)
      setUser(data.user)
      setAuthError(null)
    } catch (err) {
      console.error('Errore login:', err)
      if (err.status === 401) {
        setAuthError('Credenziali non valide. Riprova.')
      } else if (err.status === 429) {
        setAuthError(`Troppe richieste. Riprova tra ${err.retryAfter || 60} secondi.`)
      } else if (err.message && err.message.includes('fetch')) {
        setAuthError('Errore di connessione. Verifica che il server sia avviato.')
      } else {
        setAuthError(err.message || 'Errore durante il login. Riprova.')
      }
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = async () => {
    try {
      await api.logout()
    } catch (err) {
      console.error('Errore durante logout:', err)
    } finally {
      api.clearTokens()
      setUser(null)
    }
  }

  return {
    user,
    setUser,
    authChecking,
    authLoading,
    authError,
    login,
    logout
  }
}
