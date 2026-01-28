import React from 'react'

function CommessaAttachmentsPanel({
  selectedCommessa,
  selectedCommessaId,
  selectedAllegati,
  uploading,
  onUpload,
  onDeleteAllegato,
  onDownloadAllegato
}) {
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
                <label className="form-label">Carica nuovo allegato</label>
                <div className="commessa-attachment-actions">
                  <input
                    id="commessa-file-global"
                    type="file"
                    className="commessa-file-input"
                    onChange={(e) => onUpload(selectedCommessaId, e.target.files?.[0])}
                    disabled={!selectedCommessaId || uploading[selectedCommessaId]}
                  />
                  <label
                    className="btn btn-secondary btn-sm btn-icon"
                    htmlFor="commessa-file-global"
                    title="Carica allegato"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10.5V16a5 5 0 0 1-5 5H8a5 5 0 0 1 0-10h8a3 3 0 0 1 0 6H9a1 1 0 0 1 0-2h7" />
                    </svg>
                  </label>
                  {uploading[selectedCommessaId] && (
                    <span className="commessa-meta">Caricamento...</span>
                  )}
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
                      <button
                        type="button"
                        className="btn btn-link p-0"
                        onClick={() => onDownloadAllegato(allegato)}
                      >
                        {allegato.original_name}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onDeleteAllegato(selectedCommessa.id, allegato.id)}
                      >
                        Rimuovi
                      </button>
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
