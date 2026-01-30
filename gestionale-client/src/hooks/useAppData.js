import { useEffect, useState } from 'react'
import api from '../services/api'

export const useAppData = (user) => {
  const [clienti, setClienti] = useState([])
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadClienti = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getClienti()
      setClienti(data)
    } catch (err) {
      console.error('Errore caricamento clienti:', err)
      if (err.status === 401) {
        setError('Sessione scaduta. Riprova piu tardi.')
      } else {
        setError('Errore nel caricamento dei clienti. Verifica che il server sia avviato.')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadUtenti = async () => {
    try {
      const data = await api.getUtenti()
      setUtenti(data || [])
    } catch (err) {
      console.error('Errore caricamento utenti:', err)
      setUtenti([])
    }
  }

  const updateClienti = async () => {
    await loadClienti()
  }

  const resetData = () => {
    setClienti([])
    setUtenti([])
    setError(null)
    setLoading(false)
  }

  useEffect(() => {
    if (user) {
      loadClienti()
      loadUtenti()
    }
  }, [user])

  return {
    clienti,
    utenti,
    loading,
    error,
    loadClienti,
    loadUtenti,
    updateClienti,
    resetData
  }
}
