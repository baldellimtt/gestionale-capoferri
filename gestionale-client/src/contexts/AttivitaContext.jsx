import { createContext, useContext, useState, useCallback } from 'react'
import api from '../services/api'
import { normalizeAttivitaFromApi, dedupeAttivita } from '../utils/attivita'

const AttivitaContext = createContext(null)

export const useAttivita = () => {
  const context = useContext(AttivitaContext)
  if (!context) {
    throw new Error('useAttivita must be used within AttivitaProvider')
  }
  return context
}

export const AttivitaProvider = ({ children }) => {
  const [attivita, setAttivita] = useState([])
  const [dataVersion, setDataVersion] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadAttivita = useCallback(async (filters = {}, forceReset = false) => {
    try {
      setLoading(true)
      const data = await api.getAttivita(filters, forceReset)
      const formatted = data.map(normalizeAttivitaFromApi)
      const unique = dedupeAttivita(formatted, new Set())
      
      setAttivita(unique)
      // Incrementa la versione per forzare il refresh di tutti i componenti che usano i dati
      setDataVersion(prev => prev + 1)
      
      return unique
    } catch (err) {
      console.error('Errore caricamento attività:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshAttivita = useCallback(async () => {
    // Refresh globale - notifica tutti i componenti che i dati sono cambiati
    setDataVersion(prev => prev + 1)
    return loadAttivita({}, true)
  }, [loadAttivita])

  const notifyAttivitaChanged = useCallback(() => {
    setDataVersion(prev => prev + 1)
  }, [])

  return (
    <AttivitaContext.Provider value={{
      attivita,
      dataVersion,
      loading,
      loadAttivita,
      refreshAttivita,
      notifyAttivitaChanged,
      setAttivita
    }}>
      {children}
    </AttivitaContext.Provider>
  )
}



