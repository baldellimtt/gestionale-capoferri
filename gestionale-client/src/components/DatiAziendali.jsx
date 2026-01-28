import { useEffect, useState } from 'react'
import api from '../services/api'

function DatiAziendali({ onBack, toast, showHeader = true }) {
  const [formData, setFormData] = useState({
    ragione_sociale: '',
    partita_iva: '',
    codice_fiscale: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [documenti, setDocumenti] = useState([])
  const [documentiError, setDocumentiError] = useState(null)
  const [uploadingDocumento, setUploadingDocumento] = useState(false)
  const [documentoNome, setDocumentoNome] = useState('')
  const [documentoFiles, setDocumentoFiles] = useState([])
  const [documentoSuccess, setDocumentoSuccess] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(Date.now())
  const [previewDoc, setPreviewDoc] = useState(null)
  const uploadsRoot = (import.meta.env.VITE_UPLOADS_BASE_URL || api.baseURL.replace(/\/api\/?$/, '')).replace(/\/$/, '')

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getDatiAziendali()
      setFormData({
        ragione_sociale: data.ragione_sociale || '',
        partita_iva: data.partita_iva || '',
        codice_fiscale: data.codice_fiscale || ''
      })
    } catch (err) {
      console.error('Errore caricamento dati aziendali:', err)
      setError('Errore nel caricamento dei dati aziendali.')
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
      const loadingToastId = toast?.showLoading('Salvataggio in corso...', 'Salvataggio dati aziendali')
      await api.updateDatiAziendali(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      if (loadingToastId) {
        toast?.updateToast(loadingToastId, { type: 'success', title: 'Completato', message: 'Dati aziendali aggiornati con successo', duration: 3000 })
      } else {
        toast?.showSuccess('Dati aziendali aggiornati con successo')
      }
    } catch (err) {
      console.error('Errore salvataggio dati aziendali:', err)
      const errorMsg = err.message || 'Errore nel salvataggio dei dati aziendali.'
      setError(errorMsg)
      toast?.showError(errorMsg, 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (text) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }).catch(err => {
      console.error('Errore copia:', err)
      setError('Errore nella copia del testo.')
    })
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
    const confirmed = window.confirm('Vuoi eliminare questo documento aziendale?')
    if (!confirmed) return
    try {
      await api.deleteDocumentoAziendale(docId)
      setDocumenti((prev) => prev.filter((doc) => doc.id !== docId))
      toast?.showSuccess('Documento eliminato')
    } catch (err) {
      console.error('Errore eliminazione documento aziendale:', err)
      const errorMsg = err.message || 'Errore nell\'eliminazione del documento.'
      setDocumentiError(errorMsg)
      toast?.showError(errorMsg, 'Errore eliminazione')
    }
  }

  const getDocUrl = (doc) => {
    const rawPath = String(doc?.file_path || '').replace(/^\/+/, '')
    if (!rawPath) return uploadsRoot
    if (rawPath.startsWith('uploads/')) {
      return `${uploadsRoot}/${rawPath}`
    }
    return `${uploadsRoot}/uploads/${rawPath}`
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
            <h2 className="section-title mb-0">Dati Aziendali</h2>
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
          <h2 className="section-title mb-0">Dati Aziendali</h2>
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

      {copySuccess && (
        <div className="alert alert-success mb-3">
          Testo copiato!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-12">
                <label className="form-label">Ragione Sociale</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    value={formData.ragione_sociale}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ragione_sociale: e.target.value }))}
                    placeholder="Inserisci ragione sociale"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(formData.ragione_sociale)}
                    disabled={!formData.ragione_sociale}
                    title="Copia"
                  >
                    Copia
                  </button>
                </div>
              </div>
              <div className="col-md-12">
                <label className="form-label">Partita IVA</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    value={formData.partita_iva}
                    onChange={(e) => setFormData((prev) => ({ ...prev, partita_iva: e.target.value }))}
                    placeholder="Inserisci partita IVA"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(formData.partita_iva)}
                    disabled={!formData.partita_iva}
                    title="Copia"
                  >
                    Copia
                  </button>
                </div>
              </div>
              <div className="col-md-12">
                <label className="form-label">Codice Fiscale</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    value={formData.codice_fiscale}
                    onChange={(e) => setFormData((prev) => ({ ...prev, codice_fiscale: e.target.value }))}
                    placeholder="Inserisci codice fiscale"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(formData.codice_fiscale)}
                    disabled={!formData.codice_fiscale}
                    title="Copia"
                  >
                    Copia
                  </button>
                </div>
              </div>
            </div>
            <div className="actions-sticky mt-4 d-flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
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
                        onClick={() => setPreviewDoc(doc)}
                      >
                        Apri
                      </button>
                      <a
                        className="btn btn-outline-secondary btn-sm"
                        href={getDocUrl(doc)}
                        download
                      >
                        Scarica
                      </a>
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDeleteDocumento(doc.id)}
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
            if (e.target === e.currentTarget) setPreviewDoc(null)
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
                {getPreviewType(previewDoc) === 'image' && (
                  <img
                    src={getDocUrl(previewDoc)}
                    alt={previewDoc.original_name}
                    style={{ width: '100%', height: '70vh', objectFit: 'contain', background: 'var(--bg-2)' }}
                  />
                )}
                {getPreviewType(previewDoc) === 'pdf' && (
                  <iframe
                    title={previewDoc.original_name}
                    src={getDocUrl(previewDoc)}
                    style={{ width: '100%', height: '70vh', border: 0 }}
                  />
                )}
                {getPreviewType(previewDoc) === 'other' && (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="mb-3">Anteprima non disponibile per questo formato.</div>
                    <a className="btn btn-primary" href={getDocUrl(previewDoc)} download>
                      Scarica file
                    </a>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <a className="btn btn-outline-secondary" href={getDocUrl(previewDoc)} download>
                  Scarica
                </a>
                <button type="button" className="btn btn-secondary" onClick={() => setPreviewDoc(null)}>
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatiAziendali

