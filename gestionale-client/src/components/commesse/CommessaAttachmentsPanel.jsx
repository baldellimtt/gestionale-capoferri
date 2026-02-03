import React, { useState } from 'react'

function CommessaAttachmentsPanel({
  selectedCommessa,
  selectedCommessaId,
  selectedAllegati,
  uploading,
  uploadStatus,
  uploadMessage,
  onUpload,
  onDeleteAllegato,
  onDownloadAllegato,
  onPreviewAllegato
}) {
  const [isDragActive, setIsDragActive] = useState(false)
  const isUploading = uploading[selectedCommessaId]
  const isDisabled = !selectedCommessaId || isUploading
  const totalUploads = uploadStatus?.total || 0
  const doneUploads = uploadStatus?.done || 0
  const failedUploads = uploadStatus?.failed || 0
  const progressValue = totalUploads ? Math.round((doneUploads / totalUploads) * 100) : 0

  const handleFiles = (files) => {
    if (!files || files.length === 0) return
    onUpload(selectedCommessaId, Array.from(files))
  }

  const handleChange = (event) => {
    handleFiles(event.target.files)
    event.target.value = ''
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    if (!isDisabled) setIsDragActive(true)
  }

  const handleDragLeave = () => {
    setIsDragActive(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragActive(false)
    if (isDisabled) return
    handleFiles(event.dataTransfer.files)
  }

  return (
    <div className="card mb-4">
      <div className="card-header">Allegati commessa</div>
      <div className="card-body">
        {!selectedCommessa ? (
          <div className="alert alert-info">Seleziona una commessa per vedere gli allegati.</div>
        ) : (
          <>
            <div className="row g-3 align-items-end">
              <div className="col-md-12">
                <label className="form-label">Carica nuovi allegati</label>
                <div
                  className={`commessa-dropzone ${isDragActive ? 'is-dragover' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    id="commessa-file-global"
                    type="file"
                    multiple
                    className="commessa-file-input"
                    onChange={handleChange}
                    disabled={isDisabled}
                  />
                  <div className="commessa-dropzone-content">
                    <div className="commessa-dropzone-title">
                      Trascina qui i file oppure selezionali
                    </div>
                    <div className="commessa-attachment-actions">
                      <label
                        className="btn btn-secondary btn-sm commessa-upload-btn"
                        htmlFor="commessa-file-global"
                        title="Carica allegati"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10.5V16a5 5 0 0 1-5 5H8a5 5 0 0 1 0-10h8a3 3 0 0 1 0 6H9a1 1 0 0 1 0-2h7" />
                        </svg>
                        <span>Seleziona file</span>
                      </label>
                      {isUploading && (
                        <span className="commessa-meta">Caricamento...</span>
                      )}
                    </div>
                    {totalUploads > 0 && (
                      <div className="commessa-upload-status">
                        <div className="commessa-upload-text">
                          Caricati {doneUploads} di {totalUploads}
                          {failedUploads > 0 ? ` (errori: ${failedUploads})` : ''}
                        </div>
                        <div className="progress commessa-upload-progress">
                          <div
                            className="progress-bar"
                            role="progressbar"
                            style={{ width: `${progressValue}%` }}
                            aria-valuenow={progressValue}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          />
                        </div>
                      </div>
                    )}
                    {uploadMessage && (
                      <div className="commessa-upload-message">{uploadMessage}</div>
                    )}
                    {!totalUploads && !uploadMessage && !isUploading && (
                      <div className="commessa-dropzone-hint">
                        Puoi selezionare o trascinare piu file insieme.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="commessa-attachments mt-4">
              <div className="commessa-meta">
                Allegati per: {selectedCommessa.titolo}
              </div>
              {selectedAllegati.length === 0 && (
                <div className="commessa-meta">Nessun allegato presente.</div>
              )}
              {selectedAllegati.length > 0 && (
                <ul className="commessa-attachments-list">
                  {selectedAllegati.map((allegato) => (
                    <li key={allegato.id}>
                      <span className="commessa-attachment-name">
                        {allegato.original_name}
                      </span>
                      <div className="commessa-attachment-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onPreviewAllegato(allegato)}
                        >
                          Apri
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onDownloadAllegato(allegato)}
                        >
                          Scarica
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onDeleteAllegato(selectedCommessa.id, allegato.id)}
                        >
                          Rimuovi
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CommessaAttachmentsPanel
