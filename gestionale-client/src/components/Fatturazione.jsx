import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'

const DOCUMENT_TABS = [
  { value: 'invoice', label: 'Fatture', singular: 'Fattura' },
  { value: 'quote', label: 'Preventivi', singular: 'Preventivo' },
  { value: 'proforma', label: 'Proforma', singular: 'Proforma' }
]

const DEFAULT_ITEM = {
  descrizione: '',
  qty: 1,
  net_price: '',
  vat_id: ''
}

const normalizeList = (data) => {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.data)) return data.data
  if (Array.isArray(data.items)) return data.items
  return []
}

function Fatturazione({ clienti = [], toast, draft, onDraftConsumed }) {
  const [status, setStatus] = useState({ configured: false, companyId: '' })
  const [precreateInfo, setPrecreateInfo] = useState(null)
  const [localFatture, setLocalFatture] = useState([])
  const [remoteFatture, setRemoteFatture] = useState([])
  const [loading, setLoading] = useState(true)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [remoteError, setRemoteError] = useState(null)
  const draftAppliedRef = useRef(false)
  const [activeDocType, setActiveDocType] = useState('invoice')
  const requestTokenRef = useRef(0)
  const precreateCacheRef = useRef(new Map())
  const lastSyncAtRef = useRef({})

  const [formData, setFormData] = useState({
    clienteId: '',
    date: new Date().toISOString().slice(0, 10),
    numeration: '',
    visibleSubject: '',
    subjectInternal: '',
    notes: '',
    paymentDueDate: '',
    paymentMethodId: '',
    paymentAccountId: '',
    paymentStatus: 'not_paid',
    defaultVatId: '',
    recipientCode: '',
    recipientPec: ''
  })
  const [items, setItems] = useState([{ ...DEFAULT_ITEM }])
  const [commessaIds, setCommessaIds] = useState([])
  const [syncLoading, setSyncLoading] = useState(false)

  const clientiById = useMemo(() => {
    const map = new Map()
    clienti.forEach((cliente) => {
      if (cliente?.id != null) {
        map.set(String(cliente.id), cliente)
      }
    })
    return map
  }, [clienti])

  const vatOptions = useMemo(() => {
    const raw = precreateInfo?.vat_types || precreateInfo?.data?.vat_types || precreateInfo?.vatTypes
    return Array.isArray(raw) ? raw : []
  }, [precreateInfo])

  const paymentMethods = useMemo(() => {
    const raw = precreateInfo?.payment_methods || precreateInfo?.data?.payment_methods || precreateInfo?.paymentMethods
    return Array.isArray(raw) ? raw : []
  }, [precreateInfo])

  const paymentAccounts = useMemo(() => {
    const raw = precreateInfo?.payment_accounts || precreateInfo?.data?.payment_accounts || precreateInfo?.paymentAccounts
    return Array.isArray(raw) ? raw : []
  }, [precreateInfo])

  const defaultVatId = useMemo(() => {
    const raw = precreateInfo?.default_vat?.id || precreateInfo?.data?.default_vat?.id || ''
    return raw ? String(raw) : ''
  }, [precreateInfo])

  const numerationOptions = useMemo(() => {
    const raw = precreateInfo?.numerations || precreateInfo?.data?.numerations
    if (Array.isArray(raw)) {
      return raw.filter(Boolean).map((item) => String(item))
    }
    if (raw && typeof raw === 'object') {
      const options = []
      Object.values(raw).forEach((value) => {
        if (Array.isArray(value)) {
          value.forEach((entry) => {
            if (entry) options.push(String(entry))
          })
        } else if (value) {
          options.push(String(value))
        }
      })
      return options
    }
    return []
  }, [precreateInfo])

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      defaultVatId: prev.defaultVatId || defaultVatId
    }))
  }, [defaultVatId])

  useEffect(() => {
    const docType = activeDocType
    const requestToken = ++requestTokenRef.current
    const isCurrent = () => requestToken === requestTokenRef.current
    const shouldSync = () => {
      const lastSyncAt = lastSyncAtRef.current[docType] || 0
      return Date.now() - lastSyncAt > 2 * 60 * 1000
    }

    const loadRemoteFatture = async ({ silent = false } = {}) => {
      if (!silent) setRemoteLoading(true)
      setRemoteError(null)
      try {
        const data = await api.getFattureInCloud({ type: docType, per_page: 20 })
        if (!isCurrent()) return
        const list = normalizeList(data)
        setRemoteFatture(list)
      } catch (err) {
        if (!isCurrent()) return
        console.error('Errore caricamento fatture Fatture in Cloud:', err)
        setRemoteError('Impossibile recuperare i documenti da Fatture in Cloud.')
      } finally {
        if (isCurrent() && !silent) {
          setRemoteLoading(false)
        }
      }
    }

    const syncNow = async (configured) => {
      if (!configured) return
      try {
        setSyncLoading(true)
        await api.syncFattureInCloud({ type: docType, year: new Date().getFullYear(), per_page: 50, max_pages: 10 })
        lastSyncAtRef.current[docType] = Date.now()
        const localData = await api.getFattureLocali(docType)
        if (!isCurrent()) return
        setLocalFatture(Array.isArray(localData) ? localData : [])
        await loadRemoteFatture({ silent: true })
      } catch (err) {
        if (!isCurrent()) return
        setRemoteError(err.message || 'Errore durante la sincronizzazione automatica')
      } finally {
        if (isCurrent()) {
          setSyncLoading(false)
        }
      }
    }

    const loadInitial = async () => {
      try {
        setLoading(true)
        setError(null)
        setRemoteError(null)
        setRemoteFatture([])
        const [statusData, localData] = await Promise.all([
          api.getFatturazioneStatus(),
          api.getFattureLocali(docType)
        ])
        if (!isCurrent()) return
        setStatus(statusData || {})
        setLocalFatture(Array.isArray(localData) ? localData : [])
        if (statusData?.configured) {
          try {
            if (precreateCacheRef.current.has(docType)) {
              setPrecreateInfo(precreateCacheRef.current.get(docType) || null)
            } else {
              const precreateData = await api.getFatturePrecreateInfo(docType)
              if (!isCurrent()) return
              precreateCacheRef.current.set(docType, precreateData || null)
              setPrecreateInfo(precreateData || null)
            }
          } catch (precreateErr) {
            console.error('Errore caricamento precreate info:', precreateErr)
            setPrecreateInfo(null)
          }
          if (shouldSync()) {
            await syncNow(statusData?.configured)
          } else {
            await loadRemoteFatture()
          }
        } else {
          setPrecreateInfo(null)
        }
      } catch (err) {
        console.error('Errore caricamento fatturazione:', err)
        setError('Errore nel caricamento della sezione fatturazione.')
      } finally {
        if (isCurrent()) {
          setLoading(false)
        }
      }
    }

    loadInitial()
  }, [activeDocType])

  useEffect(() => {
    if (!status?.configured) return undefined
    const intervalId = setInterval(async () => {
      const requestToken = requestTokenRef.current
      const docType = activeDocType
      const isCurrent = () => requestToken === requestTokenRef.current
      try {
        setSyncLoading(true)
        await api.syncFattureInCloud({ type: docType, year: new Date().getFullYear(), per_page: 50, max_pages: 10 })
        lastSyncAtRef.current[docType] = Date.now()
        const localData = await api.getFattureLocali(docType)
        if (!isCurrent()) return
        setLocalFatture(Array.isArray(localData) ? localData : [])
        const data = await api.getFattureInCloud({ type: docType, per_page: 20 })
        if (!isCurrent()) return
        setRemoteFatture(normalizeList(data))
      } catch (err) {
        if (!isCurrent()) return
        setRemoteError(err.message || 'Errore durante la sincronizzazione automatica')
      } finally {
        if (isCurrent()) {
          setSyncLoading(false)
        }
      }
    }, 6 * 60 * 60 * 1000)
    return () => {
      clearInterval(intervalId)
    }
  }, [status?.configured, activeDocType])

  useEffect(() => {
    if (!draft || draftAppliedRef.current) return
    draftAppliedRef.current = true
    setFormData((prev) => ({
      ...prev,
      clienteId: draft.clienteId ? String(draft.clienteId) : prev.clienteId,
      visibleSubject: draft.visibleSubject || draft.description || prev.visibleSubject,
      subjectInternal: draft.subjectInternal || prev.subjectInternal,
      date: draft.date || prev.date
    }))
    if (Array.isArray(draft.items) && draft.items.length) {
      setItems(
        draft.items.map((item) => ({
          ...DEFAULT_ITEM,
          ...item,
          descrizione: item.descrizione || item.description || item.name || '',
          qty: item.qty ?? 1
        }))
      )
    }
    setCommessaIds(Array.isArray(draft.commessaIds) ? draft.commessaIds : [])
    if (onDraftConsumed) {
      onDraftConsumed()
    }
  }, [draft, onDraftConsumed])

  useEffect(() => {
    if (!formData.clienteId) return
    const cliente = clientiById.get(String(formData.clienteId))
    if (!cliente) return
    setFormData((prev) => ({
      ...prev,
      recipientCode: prev.recipientCode || cliente.codice_destinatario_sdi || '',
      recipientPec: prev.recipientPec || cliente.pec || ''
    }))
  }, [formData.clienteId, clientiById])

  const totalNet = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.qty || 0)
      const price = Number(String(item.net_price || '').replace(',', '.'))
      if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum
      return sum + qty * price
    }, 0)
  }, [items])

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addItemRow = () => {
    setItems((prev) => [...prev, { ...DEFAULT_ITEM, vat_id: formData.defaultVatId }])
  }

  const removeItemRow = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleOpenPdf = async (fattura) => {
    if (!fattura?.fic_document_id) return
    try {
      const data = await api.getFatturaInCloudUrls(fattura.fic_document_id)
      const url = data?.attachment_url || data?.url
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        toast?.showError('PDF non disponibile per questa fattura', 'Fatturazione')
      }
    } catch (err) {
      toast?.showError(err.message || 'Errore apertura PDF', 'Fatturazione')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!formData.clienteId) {
      toast?.showError('Seleziona un cliente', 'Fatturazione')
      return
    }
    if (!items.length || items.some((item) => !String(item.descrizione || '').trim())) {
      toast?.showError('Compila almeno una riga con descrizione', 'Fatturazione')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const payload = {
        cliente_id: Number(formData.clienteId),
        commessa_ids: commessaIds,
        type: activeDocType,
        date: formData.date,
        numeration: formData.numeration || undefined,
        currency: 'EUR',
        items: items.map((item) => ({
          descrizione: item.descrizione,
          name: item.descrizione,
          qty: Number(item.qty || 1),
          net_price: Number(String(item.net_price || '').replace(',', '.')) || 0,
          vat_id: item.vat_id || formData.defaultVatId || undefined
        })),
        visible_subject: formData.visibleSubject || undefined,
        subject: formData.subjectInternal || undefined,
        notes: formData.notes || undefined,
        payment_method_id: formData.paymentMethodId || undefined,
        payment_account_id: formData.paymentAccountId || undefined,
        payment_due_date: formData.paymentDueDate || undefined,
        payment_status: formData.paymentStatus || undefined,
        vat_id: formData.defaultVatId || undefined,
        recipient_code: formData.recipientCode || undefined,
        recipient_pec: formData.recipientPec || undefined
      }

      const loadingToastId = toast?.showLoading(`Emissione ${activeDocSingular.toLowerCase()} in corso...`, 'Fatturazione')
      await api.createIssuedDocument(payload)
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, {
          type: 'success',
          title: `${activeDocSingular} emesso`,
          message: 'La fattura è stata inviata a Fatture in Cloud.',
          duration: 3500
        })
      } else {
        toast?.showSuccess(`${activeDocSingular} emesso con successo`, 'Fatturazione')
      }
      const localData = await api.getFattureLocali(activeDocType)
      setLocalFatture(Array.isArray(localData) ? localData : [])
      setRemoteLoading(true)
      try {
        const remoteData = await api.getFattureInCloud({ type: activeDocType, per_page: 20 })
        setRemoteFatture(normalizeList(remoteData))
      } finally {
        setRemoteLoading(false)
      }
      setItems([{ ...DEFAULT_ITEM, vat_id: formData.defaultVatId }])
      setCommessaIds([])
      setFormData((prev) => ({
        ...prev,
        numeration: '',
        visibleSubject: '',
        subjectInternal: '',
        notes: '',
        paymentDueDate: ''
      }))
    } catch (err) {
      const message = err.message || `Errore nella creazione del ${activeDocSingular.toLowerCase()}.`
      setError(message)
      toast?.showError(message, 'Fatturazione')
    } finally {
      setSaving(false)
    }
  }

  const selectedCliente = formData.clienteId
    ? clientiById.get(String(formData.clienteId))
    : null
  const activeDocMeta = useMemo(
    () => DOCUMENT_TABS.find((tab) => tab.value === activeDocType) || DOCUMENT_TABS[0],
    [activeDocType]
  )
  const activeDocLabel = activeDocMeta?.label || 'Documenti'
  const activeDocSingular = activeDocMeta?.singular || 'Documento'
  const defaultStatusLabel = activeDocType === 'invoice' ? 'inviata' : 'inviato'

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Caricamento...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fatturazione-section">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="section-title mb-0 no-title-line">Fatturazione</h2>
        {!status?.configured && (
          <span className="badge bg-warning text-dark">Token non configurato</span>
        )}
      </div>
      <div className="fatturazione-tabs mb-4">
        {DOCUMENT_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`fatturazione-tab ${activeDocType === tab.value ? 'is-active' : ''}`}
            onClick={() => setActiveDocType(tab.value)}
          >
            <span className="tab-label">{tab.label}</span>
            <span className="tab-subtitle">Emissione e storico</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      <div className="fatturazione-layout">
        <form className="fatturazione-panel" onSubmit={handleSubmit}>
          <div className="card">
            <div className="card-header">Emissione {activeDocSingular.toLowerCase()}</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Cliente</label>
                  <select
                    className="form-select"
                    value={formData.clienteId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, clienteId: e.target.value }))}
                  >
                    <option value="">Seleziona...</option>
                    {clienti.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.denominazione}
                      </option>
                    ))}
                  </select>
                  {selectedCliente?.fatture_in_cloud_id ? (
                    <small className="form-text text-muted">FIC ID: {selectedCliente.fatture_in_cloud_id}</small>
                  ) : (
                    <small className="form-text text-muted">Il cliente deve essere sincronizzato con Fatture in Cloud.</small>
                  )}
                </div>
                <div className="col-md-3">
                  <label className="form-label">Data</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Numero {activeDocSingular.toLowerCase()}</label>
                  <input
                    className="form-control"
                    value="Automatico"
                    disabled
                  />
                  <small className="form-text text-muted">
                    La numerazione viene gestita automaticamente da Fatture in Cloud.
                  </small>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Numerazione</label>
                  {numerationOptions.length ? (
                    <select
                      className="form-select"
                      value={formData.numeration}
                      onChange={(e) => setFormData((prev) => ({ ...prev, numeration: e.target.value }))}
                    >
                      <option value="">Seleziona...</option>
                      {numerationOptions.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-control"
                      value={formData.numeration}
                      onChange={(e) => setFormData((prev) => ({ ...prev, numeration: e.target.value }))}
                      placeholder="Es. 2026"
                    />
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Oggetto (visibile in PDF)</label>
                  <input
                    className="form-control"
                    value={formData.visibleSubject}
                    onChange={(e) => setFormData((prev) => ({ ...prev, visibleSubject: e.target.value }))}
                    placeholder="Descrizione che appare nel documento"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Oggetto interno</label>
                  <input
                    className="form-control"
                    value={formData.subjectInternal}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subjectInternal: e.target.value }))}
                    placeholder="Uso interno (non visibile nel PDF)"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Note nel documento</label>
                  <input
                    className="form-control"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Note visibili in documento"
                  />
                </div>
              </div>

              <div className="fatturazione-items mt-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Righe</h6>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>
                    Aggiungi riga
                  </button>
                </div>
                <div className="fatturazione-items-grid">
                  {items.map((item, idx) => (
                    <div key={`item-${idx}`} className="fatturazione-item-row">
                      <div className="fatturazione-item-main">
                        <input
                          className="form-control"
                          value={item.descrizione}
                          onChange={(e) => handleItemChange(idx, 'descrizione', e.target.value)}
                          placeholder="Descrizione"
                        />
                        <input
                          className="form-control"
                          type="number"
                          min="0"
                          step="0.1"
                          value={item.qty}
                          onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                          placeholder="Q.tà"
                        />
                        <input
                          className="form-control"
                          value={item.net_price}
                          onChange={(e) => handleItemChange(idx, 'net_price', e.target.value)}
                          placeholder="Importo"
                          inputMode="decimal"
                        />
                        <select
                          className="form-select"
                          value={item.vat_id || formData.defaultVatId}
                          onChange={(e) => handleItemChange(idx, 'vat_id', e.target.value)}
                        >
                          <option value="">IVA</option>
                          {vatOptions.map((vat) => (
                            <option key={vat.id} value={vat.id}>
                              {vat.name || vat.description || `IVA ${vat.value || ''}`.trim()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length === 1}
                      >
                        Rimuovi
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fatturazione-payments mt-4">
                <h6 className="mb-2">Pagamento (opzionale)</h6>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Scadenza</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.paymentDueDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, paymentDueDate: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Metodo pagamento</label>
                    <select
                      className="form-select"
                      value={formData.paymentMethodId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethodId: e.target.value }))}
                    >
                      <option value="">Seleziona...</option>
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name || method.description || `Metodo ${method.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Conto incasso</label>
                    <select
                      className="form-select"
                      value={formData.paymentAccountId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, paymentAccountId: e.target.value }))}
                    >
                      <option value="">Seleziona...</option>
                      {paymentAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name || account.description || `Conto ${account.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="fatturazione-payments mt-4">
                <h6 className="mb-2">Fatturazione elettronica (opzionale)</h6>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Codice SDI</label>
                    <input
                      className="form-control"
                      value={formData.recipientCode}
                      onChange={(e) => setFormData((prev) => ({ ...prev, recipientCode: e.target.value }))}
                      placeholder="Es. ABCD123"
                      maxLength={10}
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">PEC destinatario</label>
                    <input
                      className="form-control"
                      value={formData.recipientPec}
                      onChange={(e) => setFormData((prev) => ({ ...prev, recipientPec: e.target.value }))}
                      placeholder="esempio@pec.it"
                    />
                  </div>
                </div>
              </div>

              <div className="fatturazione-summary mt-4">
                <div className="fatturazione-total">
                  <span>Totale netto</span>
                  <strong>&euro; {totalNet.toFixed(2)}</strong>
                </div>
                {!!commessaIds.length && (
                  <div className="fatturazione-meta">
                    Commesse collegate: {commessaIds.length}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="actions-sticky d-flex gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !status?.configured}
            >
              {saving ? 'Emissione...' : `Emetti ${activeDocSingular.toLowerCase()}`}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setItems([{ ...DEFAULT_ITEM, vat_id: formData.defaultVatId }])
                setCommessaIds([])
                setFormData((prev) => ({
                  ...prev,
                  clienteId: '',
                  number: '',
                  numeration: '',
                  description: '',
                  paymentDueDate: ''
                }))
              }}
            >
              Reset
            </button>
          </div>
        </form>

        <div className="fatturazione-panel">
          <div className="card mb-4">
            <div className="card-header">
              {activeDocType === 'invoice' ? 'Fatture emesse' : `${activeDocLabel} emessi`}
            </div>
            <div className="card-body">
              {remoteError && (
                <div className="alert alert-warning mb-3">
                  {remoteError}
                </div>
              )}
              <div className="fatture-list">
                {localFatture.length === 0 ? (
                  <div className="alert alert-info mb-0">
                    Nessun documento emesso dal gestionale.
                  </div>
                ) : (
                  <ul className="list-group">
                    {localFatture.map((fattura) => (
                      <li key={fattura.id} className="list-group-item">
                        <div className="fattura-row">
                          <div className="fattura-main">
                            <div className="fw-semibold">
                              {fattura.numero ? `${activeDocSingular} ${fattura.numero}` : activeDocSingular}
                            </div>
                            <div className="text-muted small">
                              {fattura.cliente_nome || 'Cliente'} - {fattura.data || 'Data n/d'}
                            </div>
                          </div>
                          <div className="fattura-meta">
                            <span className="badge-chip">{fattura.stato || defaultStatusLabel}</span>
                            <strong>
                              &euro; {Number(fattura.totale || 0).toFixed(2)}
                            </strong>
                            {fattura.fic_document_id && (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => handleOpenPdf(fattura)}
                              >
                                Apri PDF
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Fatturazione
