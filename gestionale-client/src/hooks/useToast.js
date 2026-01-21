import { useState, useCallback } from 'react'

let toastIdCounter = 0

export const useToast = () => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    const id = ++toastIdCounter
    const newToast = {
      id,
      type: 'info',
      duration: 3000,
      ...toast
    }
    setToasts((prev) => [...prev, newToast])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showSuccess = useCallback(
    (message, title = 'Successo') => {
      return addToast({ type: 'success', message, title, duration: 3000 })
    },
    [addToast]
  )

  const showError = useCallback(
    (message, title = 'Errore') => {
      return addToast({ type: 'error', message, title, duration: 5000 })
    },
    [addToast]
  )

  const showLoading = useCallback(
    (message, title = 'Caricamento...') => {
      return addToast({ type: 'loading', message, title, duration: null })
    },
    [addToast]
  )

  const updateToast = useCallback((id, updates) => {
    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, ...updates } : toast))
    )
  }, [])

  const dismissToast = useCallback(
    (id) => {
      removeToast(id)
    },
    [removeToast]
  )

  return {
    toasts,
    showSuccess,
    showError,
    showLoading,
    updateToast,
    dismissToast,
    removeToast
  }
}

