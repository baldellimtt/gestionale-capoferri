import { useEffect, useRef, useState } from 'react'
import api from '../services/api'
import ConfirmDeleteModal from './ConfirmDeleteModal'

const REGIMI_FISCALI = [
  'Regime ordinario',
  'Regime semplificato',
  'Regime forfettario',
  'Regime agevolato',
  'Startup innovativa'
]

const TIPI_DOCUMENTO = [
  { value: 'TD01', label: 'TD01 - Fattura' },
  { value: 'TD02', label: 'TD02 - Acconto/Anticipo su fattura' },
  { value: 'TD03', label: 'TD03 - Acconto/Anticipo su parcella' },
  { value: 'TD04', label: 'TD04 - Nota di credito' },
  { value: 'TD05', label: 'TD05 - Nota di debito' },
  { value: 'TD06', label: 'TD06 - Parcella' }
]

const PROVINCE_ITALIA = [
  'AG', 'AL', 'AN', 'AO', 'AR', 'AP', 'AT', 'AV', 'BA', 'BT', 'BL', 'BN', 'BG', 'BI', 'BO',
  'BZ', 'BS', 'BR', 'CA', 'CL', 'CB', 'CI', 'CE', 'CT', 'CZ', 'CH', 'CO', 'CS', 'CR', 'KR',
  'CN', 'EN', 'FM', 'FE', 'FI', 'FG', 'FC', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'SP', 'AQ',
  'LT', 'LE', 'LC', 'LI', 'LO', 'LU', 'MC', 'MN', 'MS', 'MT', 'VS', 'ME', 'MI', 'MO', 'MB',
  'NA', 'NO', 'NU', 'OG', 'OT', 'PD', 'PA', 'PR', 'PV', 'PG', 'PU', 'PE', 'PC', 'PI', 'PT',
  'PN', 'PZ', 'PO', 'RG', 'RA', 'RC', 'RE', 'RI', 'RN', 'RM', 'RO', 'SA', 'SS', 'SV', 'SI',
  'SR', 'SO', 'SU', 'TA', 'TE', 'TR', 'TO', 'TP', 'TN', 'TV', 'TS', 'UD', 'VA', 'VE', 'VB',
  'VC', 'VR', 'VV', 'VI', 'VT'
]

function DatiFiscali({ onBack, toast, showHeader = true }) {
  const [formData, setFormData] = useState({
    codice_destinatario_sdi: '',
    pec: '',
    regime_fiscale: '',
    codice_ateco: '',
    numero_rea: '',
    provincia_rea: '',
    ufficio_iva: '',
    iban: '',
    banca: '',
    tipo_documento_predefinito: '',
    ritenuta_acconto: '',
    rivalsa_inps: '',
    cassa_previdenziale: '',
    row_version: null
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [documenti, setDocumenti] = useState([])
  const [documentiError, setDocumentiError] = useState(null)
  const [uploadingDocumento, setUploadingDocumento] = useState(false)
  const [documentoNome, setDocumentoNome] = useState('')
  const [documentoFiles, setDocumentoFiles] = useState([])
  const [documentoSuccess, setDocumentoSuccess] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(Date.now())
  const [previewDoc, setPreviewDoc] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [documentUrls, setDocumentUrls] = useState({})
  const documentUrlsRef = useRef({})
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, name: '' })
  const [deletingDocumento, setDeletingDocumento] = useState(false)

  useEffect(() => {
    documentUrlsRef.current = documentUrls
  }, [documentUrls])

  useEffect(() => {
    return () => {
      Object.values(documentUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url)
      })
    }
  }, [])

  useEffect(() => {
    if (!previewDoc) {
      setPreviewUrl('')
    }
  }, [previewDoc])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getDatiFiscali()
      setFormData({
        codice_destinatario_sdi: data.codice_destinatario_sdi || '',
        pec: data.pec || '',
        regime_fiscale: data.regime_fiscale || '',
        codice_ateco: data.codice_ateco || '',
        numero_rea: data.numero_rea || '',
        provincia_rea: data.provincia_rea || '',
        ufficio_iva: data.ufficio_iva || '',
        iban: data.iban || '',
        banca: data.banca || '',
        tipo_documento_predefinito: data.tipo_documento_predefinito || '',
        ritenuta_acconto: data.ritenuta_acconto ? String(data.ritenuta_acconto) : '',
        rivalsa_inps: data.rivalsa_inps ? String(data.rivalsa_inps) : '',
        cassa_previdenziale: data.cassa_previdenziale || '',
        row_version: data.row_version ?? null
      })
    } catch (err) {
      console.error('Errore caricamento dati fiscali:', err)
      setError('Errore nel caricamento dei dati fiscali.')
    } finally {
      setLoading(false)
    }
  }

  const loadDocumenti = async () => {
    try {
      setDocumentiError(null)
      const data = await api.getDocumentiAziendali()
      setDocumenti(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Errore caricamento documenti aziendali:', err)
      setDocumentiError('Errore nel caricamento dei documenti aziendali.')
    }
  }

  useEffect(() => {
    loadData()
    loadDocumenti()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Salvataggio dati fiscali')
      await api.updateDatiFiscali(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Dati fiscali aggiornati con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Dati fiscali aggiornati con successo')
      }
    } catch (err) {
      console.error('Errore salvataggio dati fiscali:', err)
      const errorMsg = err.message || 'Errore nel salvataggio dei dati fiscali.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!Number.isFinite(bytes)) return ''
    if (bytes < 1024) return `${bytes} B`
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    return `${mb.toFixed(1)} MB`
  }

  const handleUploadDocumento = async (e) => {
    e.preventDefault()
    if (!documentoNome.trim()) {
      const errorMsg = 'Il nome documento è obbligatorio.'
      setDocumentiError(errorMsg)
      toast?.showError(errorMsg, 'Dati mancanti')
      return
    }
    if (!documentoFiles.length) return
    try {
      setUploadingDocumento(true)
      setDocumentoSuccess(false)
      setDocumentiError(null)
      const loadingToastId = toast?.showLoading('Caricamento documento...', 'Documentazione aziendale')
      const createdDocs = []
      for (const file of documentoFiles) {
        const created = await api.uploadDocumentoAziendale(file, documentoNome.trim())
        createdDocs.push(created)
      }
      setDocumenti((prev) => [...createdDocs, ...prev])
      setDocumentoNome('')
      setDocumentoFiles([])
      setFileInputKey(Date.now())
      setDocumentoSuccess(true)
      setTimeout(() => setDocumentoSuccess(false), 3000)
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Documento/i caricati con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Documento/i caricati con successo')
      }
    } catch (err) {
      console.error('Errore upload documento aziendale:', err)
      const errorMsg = err.message || 'Errore nel caricamento del documento.'
      setDocumentiError(errorMsg)
      toast?.showError(errorMsg, 'Errore upload')
    } finally {
      setUploadingDocumento(false)
    }
  }

  const handleDeleteDocumento = async (docId) => {
    if (!docId) return
    try {
      setDeletingDocumento(true)
      await api.deleteDocumentoAziendale(docId)
      setDocumentUrls((prev) => {
        const next = { ...prev }
        if (next[docId]) {
          URL.revokeObjectURL(next[docId])
          delete next[docId]
        }
        return next
      })
      if (previewDoc?.id === docId) {
        setPreviewDoc(null)
        setPreviewUrl('')
      }
      setDocumenti((prev) => prev.filter((doc) => doc.id !== docId))
      toast?.showSuccess('Documento eliminato')
    } catch (err) {
      console.error('Errore eliminazione documento aziendale:', err)
      const errorMsg = err.message || 'Errore nell\'eliminazione del documento.'
      setDocumentiError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    } finally {
      setDeletingDocumento(false)
    }
  }

  const openDeleteDocumento = (doc) => {
    if (!doc?.id) return
    setDeleteConfirm({
      show: true,
      id: doc.id,
      name: doc.original_name || 'documento'
    })
  }

  const confirmDeleteDocumento = async () => {
    const targetId = deleteConfirm.id
    setDeleteConfirm({ show: false, id: null, name: '' })
    await handleDeleteDocumento(targetId)
  }

  const ensureDocUrl = async (doc) => {
    if (!doc?.id) return ''
    const existing = documentUrlsRef.current[doc.id]
    if (existing) return existing
    const { blob } = await api.downloadDocumentoAziendale(doc.id)
    const url = URL.createObjectURL(blob)
    setDocumentUrls((prev) => ({ ...prev, [doc.id]: url }))
    return url
  }

  const handleDownloadDocumento = async (doc) => {
    if (!doc?.id) return
    try {
      const { blob, filename } = await api.downloadDocumentoAziendale(doc.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || doc.original_name || 'documento'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Errore download documento:', err)
      toast?.showError('Errore nel download del documento', 'Documenti aziendali')
    }
  }

  const openPreview = async (doc) => {
    if (!doc) return
    setPreviewDoc(doc)
    setPreviewLoading(true)
    setPreviewUrl('')
    try {
      const url = await ensureDocUrl(doc)
      setPreviewUrl(url)
    } catch (err) {
      console.error('Errore apertura documento:', err)
      toast?.showError('Errore nell\'apertura del documento', 'Documenti aziendali')
      setPreviewDoc(null)
      setPreviewUrl('')
    } finally {
      setPreviewLoading(false)
    }
  }

  const getPreviewType = (doc) => {
    const name = String(doc?.original_name || '').toLowerCase()
    if (doc?.mime_type?.startsWith('image/')) return 'image'
    if (doc?.mime_type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
    return 'other'
  }

  if (loading) {
    return (
      <div>
        {showHeader && (
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="section-title mb-0">Dati Fiscali</h2>
            {onBack && (
              <button className="btn btn-secondary" onClick={onBack}>
                Indietro
              </button>
            )}
          </div>
        )}
        <div className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Caricamento...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {showHeader && (
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="section-title mb-0">Dati Fiscali</h2>
          {onBack && (
            <button className="btn btn-secondary" onClick={onBack}>
              Indietro
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="alert alert-warning mb-3">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success mb-3">
          Dati salvati con successo!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Fatturazione Elettronica</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Codice Destinatario SDI</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.codice_destinatario_sdi}
                  onChange={(e) => setFormData((prev) => ({ ...prev, codice_destinatario_sdi: e.target.value }))}
                  placeholder="Es. 7 caratteri alfanumerici"
                  maxLength={7}
                />
                <small className="form-text text-muted">Codice a 7 caratteri per la trasmissione via SDI</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">PEC (Posta Elettronica Certificata)</label>
                <input
                  type="email"
                  className="form-control"
                  value={formData.pec}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pec: e.target.value }))}
                  placeholder="esempio@pec.it"
                />
                <small className="form-text text-muted">Indirizzo PEC per ricevere fatture elettroniche</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Tipo Documento Predefinito</label>
                <select
                  className="form-select"
                  value={formData.tipo_documento_predefinito}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tipo_documento_predefinito: e.target.value }))}
                >
                  <option value="">Seleziona...</option>
                  {TIPI_DOCUMENTO.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Regime Fiscale e Dati Aziendali</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Regime Fiscale</label>
                <select
                  className="form-select"
                  value={formData.regime_fiscale}
                  onChange={(e) => setFormData((prev) => ({ ...prev, regime_fiscale: e.target.value }))}
                >
                  <option value="">Seleziona...</option>
                  {REGIMI_FISCALI.map((regime) => (
                    <option key={regime} value={regime}>
                      {regime}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Codice ATECO</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.codice_ateco}
                  onChange={(e) => setFormData((prev) => ({ ...prev, codice_ateco: e.target.value }))}
                  placeholder="Es. 71.12.10"
                  maxLength={10}
                />
                <small className="form-text text-muted">Codice attività economica</small>
              </div>
              <div className="col-md-4">
                <label className="form-label">Numero REA</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.numero_rea}
                  onChange={(e) => setFormData((prev) => ({ ...prev, numero_rea: e.target.value }))}
                  placeholder="Es. 123456"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Provincia REA</label>
                <select
                  className="form-select"
                  value={formData.provincia_rea}
                  onChange={(e) => setFormData((prev) => ({ ...prev, provincia_rea: e.target.value }))}
                >
                  <option value="">Seleziona...</option>
                  {PROVINCE_ITALIA.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Dati Bancari</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">IBAN</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.iban}
                  onChange={(e) => setFormData((prev) => ({ ...prev, iban: e.target.value.toUpperCase() }))}
                  placeholder="IT60 X054 2811 1010 0000 0123 456"
                  maxLength={34}
                />
                <small className="form-text text-muted">Codice IBAN per pagamenti</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Banca</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.banca}
                  onChange={(e) => setFormData((prev) => ({ ...prev, banca: e.target.value }))}
                  placeholder="Nome della banca"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Ritenute e Contributi</h5>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Ritenuta d'Acconto (%)</label>
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control"
                    value={formData.ritenuta_acconto}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw.trim().toLowerCase() === 'non prevista') {
                        setFormData((prev) => ({ ...prev, ritenuta_acconto: 'NON PREVISTA' }))
                        return
                      }
                      const value = raw.replace(',', '.')
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setFormData((prev) => ({ ...prev, ritenuta_acconto: value }))
                      }
                    }}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setFormData((prev) => ({ ...prev, ritenuta_acconto: 'NON PREVISTA' }))}
                  >
                    Non prevista
                  </button>
                </div>
                <small className="form-text text-muted">Percentuale ritenuta d'acconto o NON PREVISTA</small>
              </div>
              <div className="col-md-4">
                <label className="form-label">Rivalsa Previdenza (%)</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.rivalsa_inps}
                  onChange={(e) => {
                    const value = e.target.value.replace(',', '.')
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setFormData((prev) => ({ ...prev, rivalsa_inps: value }))
                    }
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                />
                <small className="form-text text-muted">Percentuale rivalsa previdenza</small>
              </div>
              <div className="col-md-4">
                <label className="form-label">Cassa Previdenziale</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.cassa_previdenziale}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cassa_previdenziale: e.target.value }))}
                  placeholder="Es. ENPAM, CNI, ecc."
                />
                <small className="form-text text-muted">Nome della cassa previdenziale</small>
              </div>
            </div>
          </div>
        </div>

        <div className="actions-sticky d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </form>

      <div className="card mt-4">
        <div className="card-header">Documentazione aziendale</div>
        <div className="card-body">
          {documentiError && (
            <div className="alert alert-warning mb-3">
              {documentiError}
            </div>
          )}

          {documentoSuccess && (
            <div className="alert alert-success mb-3">
              Documento caricato con successo!
            </div>
          )}

          <form onSubmit={handleUploadDocumento}>
            <div className="row g-3 align-items-end">
              <div className="col-md-5">
                <label className="form-label">Nome documento</label>
                <input
                  className="form-control"
                  value={documentoNome}
                  onChange={(e) => setDocumentoNome(e.target.value)}
                  placeholder="Es. atto costitutivo, visura, visura camerale"
                  required
                />
              </div>
              <div className="col-md-5">
                <label className="form-label">File</label>
                <input
                  key={fileInputKey}
                  type="file"
                  className="form-control"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.dwg,.dxf,.zip,.rar,.7z,.txt,.csv"
                  multiple
                  onChange={(e) => setDocumentoFiles(Array.from(e.target.files || []))}
                  disabled={uploadingDocumento}
                />
              </div>
              <div className="col-md-2 d-grid">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!documentoFiles.length || uploadingDocumento}
                >
                  {uploadingDocumento ? 'Caricamento...' : 'Carica'}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-4">
            {documenti.length === 0 ? (
              <div className="alert alert-info mb-0">
                Nessun documento aziendale caricato.
              </div>
            ) : (
              <ul className="list-group">
                {documenti.map((doc) => (
                  <li key={doc.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-semibold">{doc.original_name}</div>
                      <div className="text-muted small">
                        {doc.categoria ? `Nome: ${doc.categoria}` : 'Nome: n/d'}
                        {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => openPreview(doc)}
                      >
                        Apri
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handleDownloadDocumento(doc)}
                      >
                        Scarica
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => openDeleteDocumento(doc)}
                      >
                        Elimina
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {previewDoc && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          role="dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewDoc(null)
              setPreviewUrl('')
            }
          }}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header">
                <h5 className="modal-title">{previewDoc.original_name}</h5>
                <button type="button" className="btn-close" onClick={() => setPreviewDoc(null)} />
              </div>
              <div className="modal-body" style={{ padding: 0, background: 'var(--bg-2)' }}>
                {previewLoading && (
                  <div className="text-center py-5">
                    <div className="spinner-border" role="status">
                      <span className="visually-hidden">Caricamento...</span>
                    </div>
                  </div>
                )}
                {previewUrl && getPreviewType(previewDoc) === 'image' && (
                  <img
                    src={previewUrl}
                    alt={previewDoc.original_name}
                    style={{ width: '100%', height: '70vh', objectFit: 'contain', background: 'var(--bg-2)' }}
                  />
                )}
                {previewUrl && getPreviewType(previewDoc) === 'pdf' && (
                  <iframe
                    title={previewDoc.original_name}
                    src={previewUrl}
                    style={{ width: '100%', height: '70vh', border: 0 }}
                  />
                )}
                {getPreviewType(previewDoc) === 'other' && (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="mb-3">Anteprima non disponibile per questo formato.</div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleDownloadDocumento(previewDoc)}
                    >
                      Scarica file
                    </button>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => handleDownloadDocumento(previewDoc)}
                >
                  Scarica
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setPreviewDoc(null)
                    setPreviewUrl('')
                  }}
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        show={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null, name: '' })}
        onConfirm={confirmDeleteDocumento}
        loading={deletingDocumento}
        title="Elimina documento"
        message={`Vuoi eliminare "${deleteConfirm.name}"?`}
      />
    </div>
  )
}

export default DatiFiscali

